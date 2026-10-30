[CmdletBinding()]
param(
    [Parameter(Mandatory)][Guid]$SubscriptionId,
    [Parameter(Mandatory)][Guid]$TenantId,
    [ValidateLength(1, 90)]
    [ValidatePattern('^[a-zA-Z0-9_()-][a-zA-Z0-9._()-]*[a-zA-Z0-9_()-]$|^[a-zA-Z0-9_()-]$')]
    [string]$ResourceGroup = 'rg-rota-leve',
    [ValidateLength(1, 60)][ValidatePattern('^[a-zA-Z0-9-]+$')]
    [string]$Name = 'rota-leve',
    [ValidateSet('westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia')]
    [string]$Location = 'westus2',
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repository = 'igor93ti/rota-leve',
    [Parameter(Mandatory)][ValidatePattern('^[1-9][0-9]{0,19}$')][string]$OwnerId,
    [Parameter(Mandatory)][ValidatePattern('^[1-9][0-9]{0,19}$')][string]$RepositoryId
)

# Configure only the Azure side of one GitHub repository/branch trust.
# No GitHub CLI, PAT, Microsoft Graph, Entra application registration or deployment
# token is used/requested here. ARM bearer credentials stay in process memory.
# Official API contracts checked 2026-10-30:
# Subscription GET 2022-12-01; provider GET/POST register 2021-04-01:
# https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/get
# https://learn.microsoft.com/en-us/rest/api/resources/providers/register
# UAMI and FIC PUT/GET 2023-01-31 (complete Microsoft ARM Swagger):
# https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/msi/resource-manager/Microsoft.ManagedIdentity/ManagedIdentity/stable/2023-01-31/ManagedIdentity.json
# RBAC role definition/assignment PUT 2022-04-01:
# https://learn.microsoft.com/en-us/rest/api/authorization/role-definitions/create-or-update
# https://learn.microsoft.com/en-us/rest/api/authorization/role-assignments/create
# Existing Static Web App GET 2025-05-01:
# https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/get-static-site
# GitHub immutable subject format for repositories created after 2026-07-15:
# https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims
# Pass OwnerId/RepositoryId verified from GitHub repository metadata, not guesses.

$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
if ($SubscriptionId -eq [Guid]::Empty -or $TenantId -eq [Guid]::Empty -or $SubscriptionId -eq $TenantId) {
    throw 'Informe IDs validos e distintos de assinatura e diretorio Azure.'
}
$azureCommand = Get-Command az -ErrorAction SilentlyContinue
if (-not $azureCommand) { throw 'Instale Azure CLI e entre no TenantId informado antes de configurar OIDC.' }

$projectPath = Split-Path -Parent $PSScriptRoot
$armBase = 'https://management.azure.com'
$subscriptionPath = "/subscriptions/$($SubscriptionId.ToString())"
$groupPath = "$subscriptionPath/resourceGroups/$([Uri]::EscapeDataString($ResourceGroup))"
$sitePath = "$groupPath/providers/Microsoft.Web/staticSites/$([Uri]::EscapeDataString($Name))"
$identityName = "id-$Name-github"
$identityPath = "$groupPath/providers/Microsoft.ManagedIdentity/userAssignedIdentities/$identityName"
$providerPath = "$subscriptionPath/providers/Microsoft.ManagedIdentity"
$ficPath = "$identityPath/federatedIdentityCredentials/github-main"
$repositoryParts = $Repository.Split('/')
$subject = "repo:$($repositoryParts[0])@$OwnerId/$($repositoryParts[1])@${RepositoryId}:ref:refs/heads/main"
$issuer = 'https://token.actions.githubusercontent.com'
$audience = 'api://AzureADTokenExchange'
$armHeaders = @{}
$armToken = $null
$tokenOutput = $null

function New-DeterministicGuid {
    param([Parameter(Mandatory)][string]$Seed)
    $hash = [Security.Cryptography.SHA256]::Create()
    try {
        $digest = $hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Seed.ToLowerInvariant()))
        $bytes = New-Object byte[] 16
        [Array]::Copy($digest, $bytes, 16)
        return ([Guid]::new($bytes)).ToString()
    }
    finally { $hash.Dispose() }
}

function Invoke-Arm {
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'PUT', 'POST')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$ApiVersion,
        [object]$Body,
        [switch]$AllowNotFound,
        [switch]$RetryPrincipalPropagation
    )
    if (-not $Path.StartsWith($subscriptionPath, [StringComparison]::OrdinalIgnoreCase) -or $Path.Contains('?') -or $Path.Contains('#')) {
        throw 'Caminho ARM fora da assinatura ou formato inesperado.'
    }
    $attemptLimit = 5
    if ($RetryPrincipalPropagation) { $attemptLimit = 8 }
    for ($attempt = 1; $attempt -le $attemptLimit; $attempt++) {
        $request = @{
            Method = $Method
            Uri = "${armBase}${Path}?api-version=$ApiVersion"
            Headers = $armHeaders
            UseBasicParsing = $true
            TimeoutSec = 30
            ErrorAction = 'Stop'
        }
        if ($null -ne $Body) {
            $request.ContentType = 'application/json; charset=utf-8'
            $request.Body = $Body | ConvertTo-Json -Depth 20 -Compress
        }
        try {
            $response = Invoke-WebRequest @request
            if ($response.Content) { return ($response.Content | ConvertFrom-Json) }
            return $null
        }
        catch {
            $status = 0
            if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
            if ($AllowNotFound -and $status -eq 404) { return $null }
            $armErrorCode = 'RequestFailed'
            try {
                $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
                if ($errorBody.error.code -match '^[a-zA-Z0-9_.-]+$') { $armErrorCode = $errorBody.error.code }
            }
            catch { }
            $transient = $status -in @(408, 429, 500, 502, 503, 504)
            $propagating = $RetryPrincipalPropagation -and $armErrorCode -in @('PrincipalNotFound', 'RoleDefinitionDoesNotExist', 'RoleDefinitionNotFound')
            if (($transient -or $propagating) -and $attempt -lt $attemptLimit) {
                Start-Sleep -Seconds ([Math]::Min(15, [Math]::Pow(2, $attempt)))
                continue
            }
            # Never print original HTTP errors, headers or token-bearing objects.
            throw "ARM $Method falhou (HTTP $status, $armErrorCode). Recurso: $Path"
        }
    }
}

function Assert-FreeStaticSite {
    param([Parameter(Mandatory)][object]$Site)
    if ($Site.sku.name -ne 'Free' -or $Site.sku.tier -ne 'Free') {
        throw 'O Static Web App existente nao esta confirmado no plano Free. Nenhuma permissao sera concedida.'
    }
    if ($Site.id -ine [Uri]::UnescapeDataString($sitePath)) { throw 'O ARM retornou um Static Web App diferente do solicitado.' }
    if (-not $Site.properties.defaultHostname -or $Site.properties.defaultHostname -notmatch '^[a-z0-9.-]+\.azurestaticapps\.net$') {
        throw 'O Static Web App ainda nao possui um hostname Azure valido.'
    }
    if ($Site.properties.provisioningState -in @('Failed', 'Canceled', 'Deleting')) { throw 'O Static Web App nao esta em estado valido para configurar OIDC.' }
}

try {
    # Capture only stdout in memory; suppress stderr rather than exposing CLI errors.
    $tokenOutput = & $azureCommand.Source account get-access-token --tenant $TenantId --resource 'https://management.azure.com/' --query accessToken --output tsv --only-show-errors 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tokenOutput) {
        throw 'Nao foi possivel obter token ARM no TenantId informado. Conclua az login nesse diretorio e tente novamente.'
    }
    $armToken = ($tokenOutput -join '').Trim()
    $tokenOutput = $null
    if (-not $armToken) { throw 'O Azure CLI nao retornou acesso ARM.' }
    $armHeaders.Authorization = "Bearer $armToken"

    $subscription = Invoke-Arm -Method GET -Path $subscriptionPath -ApiVersion '2022-12-01'
    if ($subscription.subscriptionId -ine $SubscriptionId.ToString() -or $subscription.id -ine $subscriptionPath -or $subscription.tenantId -ine $TenantId.ToString() -or $subscription.state -ne 'Enabled') {
        throw 'A assinatura nao corresponde aos IDs informados ou nao esta Enabled. Nenhum recurso foi alterado.'
    }
    # Require the already-created SWA; never create or upgrade a hosting resource.
    $site = Invoke-Arm -Method GET -Path $sitePath -ApiVersion '2025-05-01'
    Assert-FreeStaticSite -Site $site

    $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion '2021-04-01'
    if ($provider.registrationState -in @('NotRegistered', 'Unregistered')) {
        $null = Invoke-Arm -Method POST -Path "$providerPath/register" -ApiVersion '2021-04-01'
    }
    elseif ($provider.registrationState -notin @('Registered', 'Registering')) {
        throw "Microsoft.ManagedIdentity esta no estado $($provider.registrationState). Aguarde antes de tentar novamente."
    }
    $providerDeadline = [DateTime]::UtcNow.AddMinutes(5)
    while ($provider.registrationState -ne 'Registered') {
        if ([DateTime]::UtcNow -ge $providerDeadline) { throw 'Registro Microsoft.ManagedIdentity pendente apos 5 minutos. Tente novamente mais tarde.' }
        Start-Sleep -Seconds 5
        $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion '2021-04-01'
    }

    $identity = Invoke-Arm -Method GET -Path $identityPath -ApiVersion '2023-01-31' -AllowNotFound
    if ($identity) {
        if ($identity.id -ine [Uri]::UnescapeDataString($identityPath) -or $identity.properties.tenantId -ine $TenantId.ToString()) {
            throw 'A identidade existente nao corresponde ao recurso/diretorio esperado.'
        }
        if ($identity.tags.deploymentRepository -ine $Repository -or $identity.tags.staticSiteResourceId -ine [Uri]::UnescapeDataString($sitePath)) {
            throw 'A identidade existente nao esta identificada como pertencente a este site e repositorio. Nenhuma confianca sera alterada.'
        }
    }
    else {
        $identity = Invoke-Arm -Method PUT -Path $identityPath -ApiVersion '2023-01-31' -Body @{
            location = $Location
            tags = @{ deploymentRepository = $Repository; staticSiteResourceId = [Uri]::UnescapeDataString($sitePath); managedBy = 'RotaLeveOidcSetup' }
        }
    }
    $identityDeadline = [DateTime]::UtcNow.AddMinutes(3)
    while (-not $identity.properties.clientId -or -not $identity.properties.principalId -or $identity.properties.provisioningState -in @('Creating', 'Updating', 'Accepted')) {
        if ([DateTime]::UtcNow -ge $identityDeadline) { throw 'Identidade gerenciada ainda pendente apos 3 minutos. Tente novamente mais tarde.' }
        Start-Sleep -Seconds 3
        $identity = Invoke-Arm -Method GET -Path $identityPath -ApiVersion '2023-01-31'
    }
    if ($identity.properties.provisioningState -in @('Failed', 'Canceled') -or $identity.properties.tenantId -ine $TenantId.ToString()) { throw 'Falha ou diretorio inesperado na identidade gerenciada.' }
    $clientId = [Guid]::Parse([string]$identity.properties.clientId).ToString()
    $principalId = [Guid]::Parse([string]$identity.properties.principalId).ToString()
    if ($clientId -eq [Guid]::Empty.ToString() -or $principalId -eq [Guid]::Empty.ToString()) { throw 'O ARM retornou IDs vazios para a identidade.' }

    $null = Invoke-Arm -Method PUT -Path $ficPath -ApiVersion '2023-01-31' -Body @{ properties = @{ issuer = $issuer; subject = $subject; audiences = @($audience) } }
    $fic = Invoke-Arm -Method GET -Path $ficPath -ApiVersion '2023-01-31'
    if ($fic.properties.subject -cne $subject -or $fic.properties.issuer -cne $issuer -or @($fic.properties.audiences).Count -ne 1 -or $fic.properties.audiences[0] -cne $audience) {
        throw 'A credencial federada retornada nao corresponde exatamente ao repositorio/main informado.'
    }

    # Stable role GUID includes subscription/RG/site; no random IDs or broad roles.
    $roleGuid = New-DeterministicGuid -Seed "$subscriptionPath|$ResourceGroup|$Name|swa-github-deployment-role"
    $roleDefinitionPath = "$subscriptionPath/providers/Microsoft.Authorization/roleDefinitions/$roleGuid"
    $roleName = "RotaLeve SWA deploy $Name $($roleGuid.Substring(0, 8))"
    $roleDescription = "RotaLeve OIDC deployment-token reader for $([Uri]::UnescapeDataString($sitePath)) only."
    $priorRole = Invoke-Arm -Method GET -Path $roleDefinitionPath -ApiVersion '2022-04-01' -AllowNotFound
    if ($priorRole -and ($priorRole.properties.roleName -cne $roleName -or $priorRole.properties.description -cne $roleDescription)) {
        throw 'GUID deterministico de role ja utilizado por outra definicao. Nenhuma role sera sobrescrita.'
    }
    $role = Invoke-Arm -Method PUT -Path $roleDefinitionPath -ApiVersion '2022-04-01' -Body @{
        properties = @{
            roleName = $roleName
            description = $roleDescription
            type = 'CustomRole'
            assignableScopes = @([Uri]::UnescapeDataString($groupPath))
            permissions = @(@{
                actions = @('Microsoft.Web/staticSites/read', 'Microsoft.Web/staticSites/listsecrets/action')
                notActions = @()
                dataActions = @()
                notDataActions = @()
            })
        }
    }
    if ($role.id -ine [Uri]::UnescapeDataString($roleDefinitionPath)) { throw 'O ARM retornou uma role diferente da solicitada.' }

    # Re-check Free immediately before granting deployment-token read access.
    $site = Invoke-Arm -Method GET -Path $sitePath -ApiVersion '2025-05-01'
    Assert-FreeStaticSite -Site $site
    # Include the principal in the assignment GUID: reruns are stable, while a
    # deliberately recreated identity does not try to mutate an immutable assignment.
    $assignmentGuid = New-DeterministicGuid -Seed "$sitePath|$principalId|$roleGuid|swa-github-assignment"
    $assignmentPath = "$sitePath/providers/Microsoft.Authorization/roleAssignments/$assignmentGuid"
    $assignment = Invoke-Arm -Method GET -Path $assignmentPath -ApiVersion '2022-04-01' -AllowNotFound
    if ($assignment -and ($assignment.properties.principalId -ine $principalId -or $assignment.properties.roleDefinitionId -ine [Uri]::UnescapeDataString($roleDefinitionPath) -or $assignment.properties.scope -ine [Uri]::UnescapeDataString($sitePath))) {
        throw 'A atribuicao existente nao corresponde a identidade, role e recurso exclusivos esperados.'
    }
    if (-not $assignment) {
        $assignment = Invoke-Arm -Method PUT -Path $assignmentPath -ApiVersion '2022-04-01' -RetryPrincipalPropagation -Body @{
            properties = @{
                principalId = $principalId
                principalType = 'ServicePrincipal'
                roleDefinitionId = [Uri]::UnescapeDataString($roleDefinitionPath)
                description = 'GitHub OIDC main branch; token reader for this Static Web App only.'
            }
        }
    }
    if ($assignment.properties.principalId -ine $principalId -or $assignment.properties.scope -ine [Uri]::UnescapeDataString($sitePath) -or $assignment.properties.roleDefinitionId -ine [Uri]::UnescapeDataString($roleDefinitionPath)) {
        throw 'A atribuicao ARM nao confirmou a identidade, role e escopo exclusivos solicitados.'
    }

    # Public identifiers only. CI logs in with GitHub OIDC and reads the SWA token
    # at runtime; no bearer or deployment token is stored in this JSON.
    $metadata = [ordered]@{
        schemaVersion = 1
        clientId = $clientId
        tenantId = $TenantId.ToString()
        subscriptionId = $SubscriptionId.ToString()
        resourceGroup = $ResourceGroup
        name = $Name
        location = $site.location
        sku = 'Free'
        url = "https://$($site.properties.defaultHostname)"
        repository = $Repository
        ownerId = $OwnerId
        repositoryId = $RepositoryId
        branch = 'main'
        issuer = $issuer
        audience = $audience
        subject = $subject
        identityName = $identityName
        identityResourceId = [Uri]::UnescapeDataString($identityPath)
        principalId = $principalId
        resourceId = [Uri]::UnescapeDataString($sitePath)
        roleDefinitionId = [Uri]::UnescapeDataString($roleDefinitionPath)
        roleAssignmentId = [Uri]::UnescapeDataString($assignmentPath)
    }
    $configPath = Join-Path $projectPath 'config'
    $null = New-Item -ItemType Directory -Path $configPath -Force
    $destination = Join-Path $configPath 'azure-deployment.json'
    $temporaryPath = "$destination.tmp"
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($temporaryPath, (($metadata | ConvertTo-Json -Depth 10) + "`n"), $utf8)
    Move-Item -LiteralPath $temporaryPath -Destination $destination -Force
    Write-Host "Azure target: $([Uri]::UnescapeDataString($sitePath))"
    Write-Host "URL Free: $($metadata.url)"
    Write-Host "Repository/main: $Repository"
    Write-Host "OIDC subject: $subject"
    Write-Host "Client ID: $clientId"
    Write-Host "Principal ID: $principalId"
    Write-Host "Role definition: $($metadata.roleDefinitionId)"
    Write-Host "Role assignment: $($metadata.roleAssignmentId)"
    Write-Host 'Configuracao nao secreta gravada em config/azure-deployment.json.'
}
finally {
    $armHeaders.Clear()
    $armToken = $null
    $tokenOutput = $null
}
