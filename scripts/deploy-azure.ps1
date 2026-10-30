[CmdletBinding()]
param(
    [ValidatePattern('^[a-zA-Z0-9._()-]+$')]
    [string]$ResourceGroup = 'rg-rota-leve',
    [ValidatePattern('^[a-zA-Z0-9-]+$')]
    [string]$Name = 'rota-leve',
    [ValidateSet('westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia')]
    [string]$Location = 'westus2',
    [string]$Repository = '',
    [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$sitePath = Join-Path $projectPath 'site'

if (-not (Test-Path -LiteralPath (Join-Path $sitePath 'index.html'))) {
    throw "Nao encontrei site/index.html em $projectPath."
}

$azureCommand = Get-Command az -ErrorAction SilentlyContinue
if (-not $azureCommand) {
    throw 'Instale o Azure CLI e execute az login antes de publicar.'
}

function Invoke-AzureJson {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $response = & $azureCommand.Source @Arguments --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI falhou: az $($Arguments[0]) $($Arguments[1])." }
    if ($response) { return ($response -join "`n" | ConvertFrom-Json) }
}

if ($Repository) {
    $Repository = $Repository -replace '^https://github\.com/', '' -replace '\.git$', ''
    $Repository = $Repository.TrimEnd('/')
    if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
        throw 'Repository deve ser dono/repositorio ou https://github.com/dono/repositorio.'
    }
}

$account = Invoke-AzureJson -Arguments @('account', 'show')
# az login --allow-no-subscriptions pode selecionar um diretorio sem assinatura.
# Nesse caso, id e tenantId coincidem: autenticar nao habilita criar recursos.
if ([string]::IsNullOrWhiteSpace([string]$account.id) -or
    $account.id -eq $account.tenantId -or
    $account.name -match 'tenant level account') {
    throw 'Login Azure aceito, mas nenhuma assinatura real esta selecionada. Conclua a ativacao de uma assinatura no portal Azure; depois execute az login, az account list --refresh e az account set --subscription <ID_DA_ASSINATURA>. Nenhum recurso foi criado.'
}
Write-Host "Assinatura selecionada: $($account.name)"

$groupExists = Invoke-AzureJson -Arguments @('group', 'exists', '--name', $ResourceGroup)
if (-not $groupExists) {
    $null = Invoke-AzureJson -Arguments @('group', 'create', '--name', $ResourceGroup, '--location', $Location)
}

$apps = @(Invoke-AzureJson -Arguments @('staticwebapp', 'list', '--resource-group', $ResourceGroup))
$app = $apps | Where-Object { $_.name -eq $Name } | Select-Object -First 1
if ($app -and $app.sku.name -ne 'Free') {
    throw "O recurso $Name ja existe no plano $($app.sku.name). Este script aceita somente Free."
}
if (-not $app) {
    Write-Host 'Criando Azure Static Web App no plano Free...'
    $app = Invoke-AzureJson -Arguments @(
        'staticwebapp', 'create', '--name', $Name, '--resource-group', $ResourceGroup,
        '--location', $Location, '--sku', 'Free'
    )
}

$priorToken = [Environment]::GetEnvironmentVariable('SWA_CLI_DEPLOYMENT_TOKEN', 'Process')
$priorDebug = [Environment]::GetEnvironmentVariable('SWA_CLI_DEBUG', 'Process')
$deploymentToken = $null
try {
    $secrets = Invoke-AzureJson -Arguments @('staticwebapp', 'secrets', 'list', '--name', $Name, '--resource-group', $ResourceGroup)
    $deploymentToken = $secrets.properties.apiKey
    if (-not $deploymentToken) { throw 'O Azure nao retornou o token de publicacao.' }
    $secrets = $null

    if ($Repository) {
        $githubCommand = Get-Command gh -ErrorAction SilentlyContinue
        if (-not $githubCommand) { throw 'Instale GitHub CLI e execute gh auth login para configurar Repository.' }
        & $githubCommand.Source auth status *> $null
        if ($LASTEXITCODE -ne 0) { throw 'Execute gh auth login antes de configurar Repository.' }
        # O token entra por stdin; nunca aparece nos argumentos nem nos arquivos do projeto.
        $deploymentToken | & $githubCommand.Source secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo $Repository
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel gravar o secret de deploy no GitHub.' }
        Write-Host "Secret AZURE_STATIC_WEB_APPS_API_TOKEN configurado em $Repository."
    }

    if (-not $SkipDeploy) {
        $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
        if (-not $npxCommand) { $npxCommand = Get-Command npx -ErrorAction SilentlyContinue }
        if (-not $npxCommand) { throw 'Instale Node.js 22 ou superior para executar o SWA CLI.' }
        $env:SWA_CLI_DEPLOYMENT_TOKEN = $deploymentToken
        $env:SWA_CLI_DEBUG = 'silent'
        Write-Host 'Publicando site/ em producao...'
        & $npxCommand.Source --yes --package '@azure/static-web-apps-cli' swa deploy $sitePath --env production --verbose silent
        if ($LASTEXITCODE -ne 0) { throw 'A publicacao falhou. O recurso Free foi preservado para uma nova tentativa.' }
    }
}
finally {
    [Environment]::SetEnvironmentVariable('SWA_CLI_DEPLOYMENT_TOKEN', $priorToken, 'Process')
    [Environment]::SetEnvironmentVariable('SWA_CLI_DEBUG', $priorDebug, 'Process')
    $deploymentToken = $null
}

$app = Invoke-AzureJson -Arguments @('staticwebapp', 'show', '--name', $Name, '--resource-group', $ResourceGroup)
Write-Host "URL: https://$($app.defaultHostname)"
if ($SkipDeploy) { Write-Host 'Recurso preparado. O deploy ainda precisa ser executado.' }
if (-not $Repository) {
    Write-Host 'Para atualizacoes automaticas, configure AZURE_STATIC_WEB_APPS_API_TOKEN nos Secrets do repositorio GitHub.'
}
