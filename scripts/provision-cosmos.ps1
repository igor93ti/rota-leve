[CmdletBinding()]
param(
    [Parameter(Mandatory)][Guid]$SubscriptionId,
    [Parameter(Mandatory)][Guid]$TenantId,
    [ValidateLength(1, 90)]
    [ValidatePattern('^[a-zA-Z0-9_()-][a-zA-Z0-9._()-]*[a-zA-Z0-9_()-]$|^[a-zA-Z0-9_()-]$')]
    [string]$ResourceGroup = 'rg-rota-leve',
    [ValidatePattern('^[a-zA-Z0-9-]+$')]
    [ValidateLength(1, 60)]
    [string]$SiteName = 'rota-leve',
    # O nome da conta Cosmos e unico no Azure inteiro; troque se ja estiver em uso.
    [ValidatePattern('^[a-z0-9][a-z0-9-]{1,42}[a-z0-9]$')]
    [string]$AccountName = 'rota-leve-perfis',
    [ValidateSet('westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia')]
    [string]$Location = 'westus2'
)

# Cria o Cosmos DB for NoSQL na camada gratuita (1000 RU/s e 25 GB pela vida da conta) e liga a API de perfis.
# O teto de throughput da conta fica em 1000 RU/s: acima disso o Cosmos responde 429 em vez de cobrar.
# https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier
# https://learn.microsoft.com/en-us/azure/cosmos-db/limit-total-account-throughput
# https://learn.microsoft.com/en-us/rest/api/cosmos-db-resource-provider/database-accounts/create-or-update
# https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-or-update-static-site-app-settings
$ErrorActionPreference = 'Stop'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
if ($SubscriptionId -eq [Guid]::Empty -or $TenantId -eq [Guid]::Empty -or $SubscriptionId -eq $TenantId) {
    throw 'Informe IDs validos e distintos de assinatura e diretorio Azure.'
}
$azureCommand = Get-Command az -ErrorAction SilentlyContinue
if (-not $azureCommand) { throw 'Instale Azure CLI e entre na conta com acesso a assinatura antes de continuar.' }

$armBase = 'https://management.azure.com'
$subscriptionPath = "/subscriptions/$SubscriptionId"
$groupPath = "$subscriptionPath/resourceGroups/$([Uri]::EscapeDataString($ResourceGroup))"
$providerPath = "$subscriptionPath/providers/Microsoft.DocumentDB"
$accountPath = "$groupPath/providers/Microsoft.DocumentDB/databaseAccounts/$AccountName"
$databasePath = "$accountPath/sqlDatabases/rotaleve"
$containerPath = "$databasePath/containers/profiles"
$sitePath = "$groupPath/providers/Microsoft.Web/staticSites/$([Uri]::EscapeDataString($SiteName))"
$cosmosApi = '2024-11-15'
$siteApi = '2025-05-01'
$resourceApi = '2021-04-01'
$freeTierLimit = 1000
$armHeaders = @{}
$armToken = $null
$tokenOutput = $null
$keys = $null
$settings = $null

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
        TimeoutSec = 60
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
        # Nunca emitir o objeto de erro HTTP, headers ou corpo de respostas com chaves.
        throw "ARM $Method falhou (HTTP $status, $armErrorCode). Recurso: $Path"
    }
}

function Wait-Resource {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][int]$Minutes, [Parameter(Mandatory)][string]$Label)
    $deadline = [DateTime]::UtcNow.AddMinutes($Minutes)
    do {
        $resource = Invoke-Arm -Method GET -Path $Path -ApiVersion $cosmosApi -AllowNotFound
        $state = $resource.properties.provisioningState
        if ($state -in @('Failed', 'Canceled')) { throw "O Azure informou falha ao criar $Label." }
        if ($resource -and (-not $state -or $state -eq 'Succeeded')) { return $resource }
        if ([DateTime]::UtcNow -ge $deadline) { throw "$Label ainda pendente apos $Minutes minutos. Rode o script de novo mais tarde; ele reaproveita o que ja existe." }
        Start-Sleep -Seconds 10
    } while ($true)
}

function Assert-FreeAccount {
    param([Parameter(Mandatory)][object]$Account)
    if ($Account.properties.enableFreeTier -ne $true) { throw 'A conta Cosmos existente nao esta na camada gratuita. Nada foi alterado.' }
    $limit = $Account.properties.capacity.totalThroughputLimit
    if ($null -eq $limit -or $limit -lt 0 -or $limit -gt $freeTierLimit) { throw "A conta Cosmos existente nao limita o throughput a $freeTierLimit RU/s. Nada foi alterado." }
}

try {
    $tokenOutput = & $azureCommand.Source account get-access-token --tenant $TenantId --resource 'https://management.azure.com/' --query accessToken --output tsv --only-show-errors 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tokenOutput) {
        throw 'Nao foi possivel obter acesso ao ARM nesse diretorio. Conclua az login para o TenantId informado e tente novamente.'
    }
    $armToken = ($tokenOutput -join '').Trim()
    $tokenOutput = $null
    $armHeaders.Authorization = "Bearer $armToken"

    $subscription = Invoke-Arm -Method GET -Path $subscriptionPath -ApiVersion '2022-12-01'
    if ($subscription.subscriptionId -ne $SubscriptionId.ToString() -or $subscription.tenantId -ne $TenantId.ToString() -or $subscription.state -ne 'Enabled') {
        throw 'A assinatura nao corresponde aos IDs informados ou nao esta Enabled. Nenhum recurso foi criado.'
    }
    $site = Invoke-Arm -Method GET -Path $sitePath -ApiVersion $siteApi
    if ($site.sku.name -ne 'Free') { throw 'O Static Web App nao esta confirmado no plano Free. Nada foi alterado.' }
    Write-Host 'Assinatura e Static Web App Free confirmados.'

    $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion $resourceApi
    if ($provider.registrationState -in @('NotRegistered', 'Unregistered')) {
        Write-Host 'Registrando Microsoft.DocumentDB na assinatura...'
        $null = Invoke-Arm -Method POST -Path "$providerPath/register" -ApiVersion $resourceApi
    }
    $providerDeadline = [DateTime]::UtcNow.AddMinutes(5)
    while ($provider.registrationState -ne 'Registered') {
        if ([DateTime]::UtcNow -ge $providerDeadline) { throw 'Registro de Microsoft.DocumentDB ainda pendente apos 5 minutos. Tente novamente mais tarde.' }
        Start-Sleep -Seconds 5
        $provider = Invoke-Arm -Method GET -Path $providerPath -ApiVersion $resourceApi
    }

    $account = Invoke-Arm -Method GET -Path $accountPath -ApiVersion $cosmosApi -AllowNotFound
    if ($account) {
        Assert-FreeAccount -Account $account
        Write-Host 'Conta Cosmos gratuita ja existe; reaproveitando.'
    }
    else {
        # So uma conta por assinatura pode usar a camada gratuita; outra conta gratuita impede a criacao.
        $existing = Invoke-Arm -Method GET -Path "$providerPath/databaseAccounts" -ApiVersion $cosmosApi
        $used = @($existing.value | Where-Object { $_.properties.enableFreeTier -eq $true })
        if ($used.Count) { throw "A camada gratuita do Cosmos ja esta em uso na conta $($used[0].name). Nenhum recurso foi criado." }
        Write-Host 'Criando conta Cosmos DB na camada gratuita (pode levar alguns minutos)...'
        $accountBody = @{
            location = $Location
            kind = 'GlobalDocumentDB'
            properties = @{
                databaseAccountOfferType = 'Standard'
                enableFreeTier = $true
                locations = @(@{ locationName = $Location; failoverPriority = 0; isZoneRedundant = $false })
                capacity = @{ totalThroughputLimit = $freeTierLimit }
                consistencyPolicy = @{ defaultConsistencyLevel = 'Session' }
                minimalTlsVersion = 'Tls12'
            }
        }
        $null = Invoke-Arm -Method PUT -Path $accountPath -ApiVersion $cosmosApi -Body $accountBody
        $account = Wait-Resource -Path $accountPath -Minutes 20 -Label 'a conta Cosmos'
        Assert-FreeAccount -Account $account
    }

    if (-not (Invoke-Arm -Method GET -Path $databasePath -ApiVersion $cosmosApi -AllowNotFound)) {
        # 400 RU/s compartilhados entre os conteineres, dentro dos 1000 RU/s gratuitos.
        Write-Host 'Criando banco rotaleve com 400 RU/s compartilhados...'
        $null = Invoke-Arm -Method PUT -Path $databasePath -ApiVersion $cosmosApi -Body @{ properties = @{ resource = @{ id = 'rotaleve' }; options = @{ throughput = 400 } } }
        $null = Wait-Resource -Path $databasePath -Minutes 5 -Label 'o banco rotaleve'
    }
    if (-not (Invoke-Arm -Method GET -Path $containerPath -ApiVersion $cosmosApi -AllowNotFound)) {
        Write-Host 'Criando conteiner profiles...'
        $containerBody = @{ properties = @{ resource = @{ id = 'profiles'; partitionKey = @{ paths = @('/id'); kind = 'Hash'; version = 2 } }; options = @{} } }
        $null = Invoke-Arm -Method PUT -Path $containerPath -ApiVersion $cosmosApi -Body $containerBody
        $null = Wait-Resource -Path $containerPath -Minutes 5 -Label 'o conteiner profiles'
    }

    # A chave fica so na memoria deste processo e nas configuracoes do Static Web App; nunca no repositorio.
    $keys = Invoke-Arm -Method POST -Path "$accountPath/listKeys" -ApiVersion $cosmosApi
    if (-not $keys.primaryMasterKey -or -not $account.properties.documentEndpoint) { throw 'O Azure nao retornou o endereco ou a chave da conta Cosmos.' }
    $current = Invoke-Arm -Method POST -Path "$sitePath/listAppSettings" -ApiVersion $siteApi
    $settings = @{}
    if ($current.properties) { foreach ($property in $current.properties.PSObject.Properties) { $settings[$property.Name] = [string]$property.Value } }
    $settings['COSMOS_ENDPOINT'] = $account.properties.documentEndpoint
    $settings['COSMOS_KEY'] = $keys.primaryMasterKey
    $settings['COSMOS_DATABASE'] = 'rotaleve'
    $settings['COSMOS_CONTAINER'] = 'profiles'
    $null = Invoke-Arm -Method PUT -Path "$sitePath/config/appsettings" -ApiVersion $siteApi -Body @{ properties = $settings }
    Write-Host "Perfis prontos: conta $AccountName ($Location), teto de $freeTierLimit RU/s, configuracoes gravadas no Static Web App $SiteName."
    Write-Host 'A API passa a usar o banco no proximo deploy do site ou em ate alguns minutos, quando o Azure reiniciar as funcoes.'
}
finally {
    $armHeaders.Clear()
    $armToken = $null
    $tokenOutput = $null
    $keys = $null
    $settings = $null
}
