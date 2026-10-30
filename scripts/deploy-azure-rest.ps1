[CmdletBinding()]
param(
    [Parameter(Mandatory)][Guid]$SubscriptionId,
    [Parameter(Mandatory)][Guid]$TenantId,
    [ValidateLength(1, 90)]
    [ValidatePattern('^[a-zA-Z0-9_()-][a-zA-Z0-9._()-]*[a-zA-Z0-9_()-]$|^[a-zA-Z0-9_()-]$')]
    [string]$ResourceGroup = 'rg-rota-leve',
    [ValidatePattern('^[a-zA-Z0-9-]+$')]
    [ValidateLength(1, 60)]
    [string]$Name = 'rota-leve',
    [ValidateSet('westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia')]
    [string]$Location = 'westus2',
    [switch]$SkipDeploy
)

# REST oficial: nao depende de a assinatura nova aparecer no cache do Azure CLI.
# https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/get?view=rest-resources-2022-12-01
# https://learn.microsoft.com/en-us/rest/api/resources/resource-groups/create-or-update?view=rest-resources-2021-04-01
# https://learn.microsoft.com/en-us/rest/api/resources/providers/register?view=rest-resources-2021-04-01
# https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-or-update-static-site?view=rest-appservice-2025-05-01
# https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/list-static-site-secrets?view=rest-appservice-2025-05-01
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
$projectPath = Split-Path -Parent $PSScriptRoot
$sitePath = Join-Path $projectPath 'site'
if (-not (Test-Path -LiteralPath (Join-Path $sitePath 'index.html'))) {
    throw "Nao encontrei site/index.html em $projectPath."
}
if ($SubscriptionId -eq [Guid]::Empty -or $TenantId -eq [Guid]::Empty -or $SubscriptionId -eq $TenantId) {
    throw 'Informe IDs validos e distintos de assinatura e diretorio Azure.'
}

$azureCommand = Get-Command az -ErrorAction SilentlyContinue
if (-not $azureCommand) { throw 'Instale Azure CLI e entre na conta com acesso a assinatura antes de publicar.' }
$npxCommand = $null
if (-not $SkipDeploy) {
    $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npxCommand) { $npxCommand = Get-Command npx -ErrorAction SilentlyContinue }
    if (-not $npxCommand) { throw 'Instale Node.js 22 ou superior para executar o SWA CLI.' }
}

$armBase = 'https://management.azure.com'
$subscriptionPath = "/subscriptions/$SubscriptionId"
$groupPath = "$subscriptionPath/resourceGroups/$([Uri]::EscapeDataString($ResourceGroup))"
$providerPath = "$subscriptionPath/providers/Microsoft.Web"
$siteResourcePath = "$groupPath/providers/Microsoft.Web/staticSites/$([Uri]::EscapeDataString($Name))"
$resourceApi = '2021-04-01'
$siteApi = '2025-05-01'
$armHeaders = @{}
$armToken = $null
$tokenOutput = $null
$secrets = $null
$deploymentToken = $null
$priorDeploymentToken = [Environment]::GetEnvironmentVariable('SWA_CLI_DEPLOYMENT_TOKEN', 'Process')
$priorSwaDebug = [Environment]::GetEnvironmentVariable('SWA_CLI_DEBUG', 'Process')

function Invoke-Arm {
    param(
        [Parameter(Mandatory)][ValidateSet('GET', 'PUT', 'POST')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$ApiVersion,
        [object]$Body,
        [switch]$AllowNotFound
    )
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
        # Nunca emitir o objeto de erro HTTP, headers ou corpo da resposta de secrets.
        throw "ARM $Method falhou (HTTP $status, $armErrorCode). Recurso: $Path"
    }
}

function Assert-FreeStaticSite {
    param([Parameter(Mandatory)][object]$Site)
    if ($Site.sku.name -ne 'Free' -or $Site.sku.tier -ne 'Free') {
        throw 'O Static Web App existente nao esta confirmado no plano Free. Nenhum plano sera alterado.'
    }
    if ($Site.id -ne [Uri]::UnescapeDataString($siteResourcePath)) { throw 'O ARM retornou um Static Web App diferente do solicitado.' }
}

try {
    # O stdout contendo o token permanece em memoria; nao usar --debug nem imprimir.
    $tokenOutput = & $azureCommand.Source account get-access-token --tenant $TenantId --resource 'https://management.azure.com/' --query accessToken --output tsv --only-show-errors 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tokenOutput) {
        throw 'Nao foi possivel obter acesso ao ARM nesse diretorio. Conclua az login para o TenantId informado e tente novamente.'
    }
    $armToken = ($tokenOutput -join '').Trim()
    $tokenOutput = $null
    if (-not $armToken) { throw 'O Azure CLI nao retornou um token ARM.' }
    $armHeaders.Authorization = "Bearer $armToken"

    $subscription = Invoke-Arm -Method GET -Path $subscriptionPath -ApiVersion '2022-12-01'
    if ($subscription.subscriptionId -ne $SubscriptionId.ToString() -or
        $subscription.id -ne $subscriptionPath -or
        $subscription.tenantId -ne $TenantId.ToString() -or
        $subscription.state -ne 'Enabled') {
        throw 'A assinatura nao corresponde aos IDs informados ou nao esta Enabled. Nenhum recurso foi criado.'
    }
    Write-Host 'Assinatura e diretorio confirmados pelo ARM; assinatura Enabled.'

    $group = Invoke-Arm -Method GET -Path $groupPath -ApiVersion $resourceApi -AllowNotFound
    if (-not $group) {
        Write-Host 'Criando grupo de recursos...'
        $group = Invoke-Arm -Method PUT -Path $groupPath -ApiVersion $resourceApi -Body @{ location = $Location }
    }

    $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion $resourceApi
    if ($provider.registrationState -in @('NotRegistered', 'Unregistered')) {
        Write-Host 'Registrando Microsoft.Web na assinatura...'
        $null = Invoke-Arm -Method POST -Path "$providerPath/register" -ApiVersion $resourceApi
    }
    elseif ($provider.registrationState -notin @('Registered', 'Registering')) {
        throw "Microsoft.Web esta no estado $($provider.registrationState). Aguarde a conclusao antes de tentar novamente."
    }
    $providerDeadline = [DateTime]::UtcNow.AddMinutes(5)
    while ($provider.registrationState -ne 'Registered') {
        if ([DateTime]::UtcNow -ge $providerDeadline) {
            throw 'Registro de Microsoft.Web ainda pendente apos 5 minutos. Nenhum servico pago foi criado; tente novamente mais tarde.'
        }
        Start-Sleep -Seconds 5
        $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion $resourceApi
    }

    $site = Invoke-Arm -Method GET -Path $siteResourcePath -ApiVersion $siteApi -AllowNotFound
    if ($site) {
        Assert-FreeStaticSite -Site $site
    }
    else {
        Write-Host 'Criando Azure Static Web App exclusivamente Free...'
        $siteBody = @{
            location = $Location
            sku = @{ name = 'Free'; tier = 'Free' }
            properties = @{
                provider = 'Custom'
                buildProperties = @{ appLocation = 'site'; apiLocation = ''; appArtifactLocation = '' }
            }
        }
        $null = Invoke-Arm -Method PUT -Path $siteResourcePath -ApiVersion $siteApi -Body $siteBody
        $siteDeadline = [DateTime]::UtcNow.AddMinutes(5)
        do {
            $site = Invoke-Arm -Method GET -Path $siteResourcePath -ApiVersion $siteApi -AllowNotFound
            if ($site) {
                Assert-FreeStaticSite -Site $site
                if ($site.properties.provisioningState -in @('Failed', 'Canceled')) { throw 'O Azure informou falha ao criar o Static Web App Free.' }
                if ($site.properties.defaultHostname -and $site.properties.provisioningState -notin @('Creating', 'Updating', 'Accepted', 'Running')) { break }
            }
            if ([DateTime]::UtcNow -ge $siteDeadline) { throw 'Static Web App ainda pendente apos 5 minutos. Tente novamente mais tarde.' }
            Start-Sleep -Seconds 5
        } while ($true)
    }

    if (-not $site.properties.defaultHostname) { throw 'O Azure ainda nao disponibilizou o hostname do site Free.' }
    $publicMetadata = [ordered]@{
        url = "https://$($site.properties.defaultHostname)"
        name = $Name
        resourceGroup = $ResourceGroup
        location = $site.location
        sku = 'Free'
    }
    $targetMetadata = [ordered]@{
        subscriptionId = $SubscriptionId.ToString()
        tenantId = $TenantId.ToString()
        name = $Name
        resourceGroup = $ResourceGroup
        location = $site.location
        url = $publicMetadata.url
        sku = 'Free'
    }
    $localAzurePath = Join-Path $projectPath '.azure'
    $null = New-Item -ItemType Directory -Path $localAzurePath -Force
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $localAzurePath 'target.json'), (($targetMetadata | ConvertTo-Json) + "`n"), $utf8)

    if ($SkipDeploy) {
        Write-Host "Recurso Free preparado: $($publicMetadata.url)"
        Write-Host 'Deploy nao executado. Nenhum token de publicacao foi solicitado ou gravado.'
    }
    else {
        $secrets = Invoke-Arm -Method POST -Path "$siteResourcePath/listSecrets" -ApiVersion $siteApi
        $deploymentToken = $secrets.properties.apiKey
        $secrets = $null
        if (-not $deploymentToken) { throw 'O Azure nao retornou o token de publicacao do Static Web App.' }
        $env:SWA_CLI_DEPLOYMENT_TOKEN = $deploymentToken
        $env:SWA_CLI_DEBUG = 'silent'
        Write-Host 'Publicando site/ em producao...'
        & $npxCommand.Source --yes --package '@azure/static-web-apps-cli' swa deploy $sitePath --env production --verbose silent
        if ($LASTEXITCODE -ne 0) { throw 'A publicacao falhou. O recurso Free foi preservado para uma nova tentativa.' }
        [IO.File]::WriteAllText((Join-Path $projectPath 'deployment.json'), (($publicMetadata | ConvertTo-Json) + "`n"), $utf8)
        Write-Host "Publicacao concluida: $($publicMetadata.url)"
    }
}
finally {
    [Environment]::SetEnvironmentVariable('SWA_CLI_DEPLOYMENT_TOKEN', $priorDeploymentToken, 'Process')
    [Environment]::SetEnvironmentVariable('SWA_CLI_DEBUG', $priorSwaDebug, 'Process')
    $armHeaders.Clear()
    $armToken = $null
    $tokenOutput = $null
    $secrets = $null
    $deploymentToken = $null
    $priorDeploymentToken = $null
    $priorSwaDebug = $null
}
