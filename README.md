# Rota Leve

[Abrir o site](https://green-ground-03cab511e.3.azurestaticapps.net) · [Repositório igor93ti/rota-leve](https://github.com/igor93ti/rota-leve) · [Execuções no GitHub Actions](https://github.com/igor93ti/rota-leve/actions)

Radar público de passagens saindo de Fortaleza (FOR) e Recife (REC), em dinheiro e milhas, com destinos nacionais e internacionais. O site está publicado no **Azure Static Web Apps Free**, sem autenticação. A publicação inicial e o acesso público foram verificados com resposta HTTP 200; o histórico de Actions mostra o resultado de cada execução automática.

O catálogo inicial de 30/10/2026 reúne 246 anúncios de Azul, GOL, LATAM, TAP, Air France e KLM. A quantidade muda a cada coleta. As ofertas em milhas vêm atualmente do **Azul Fidelidade**. LATAM Pass, Smiles e outros programas dependem de pesquisa complementar ou de novos conectores; a cobertura não é universal. Cada oferta mostra a fonte e a data da observação.

## Executar e verificar

Requer Node.js 22 ou superior. HTML, CSS e JavaScript são publicados diretamente, sem build de framework ou dependências de aplicação.

```powershell
npm start
```

Abra o endereço informado pelo servidor. Para verificar o projeto e atualizar o catálogo:

```powershell
npm run check
npm test
npm run collect
```

`npm run collect` acessa as fontes habilitadas; exige internet e altera `site/data/offers.json`. `npm run collect:offline` regenera o catálogo a partir das observações locais disponíveis. Consulte [a rotina do agente](docs/AGENT.md) antes de registrar novas oportunidades. Apenas `site/` é publicado; scripts e arquivos de operação ficam fora do site.

## Atualizações quatro vezes ao dia

Há duas rotinas complementares, preparadas para **00:17, 06:17, 12:17 e 18:17**, horário de Brasília (`America/Sao_Paulo`):

- **GitHub Actions — Atualizar ofertas:** consulta páginas oficiais estruturadas, valida o catálogo e salva os dados na `main`. Executa na nuvem, independentemente do computador local, quando Actions e o agendamento estão habilitados.
- **Agente no Codex:** amplia a pesquisa, busca oportunidades em outros programas e avalia combinações de rotas. A automação local depende do computador ligado, do aplicativo aberto e do acesso ao projeto e às ferramentas conectadas.

O workflow **Publicar no Azure** publica alterações em `site/` na `main` e reage à conclusão bem-sucedida de **Atualizar ofertas** por `workflow_run`. Esse segundo gatilho é necessário porque commits feitos com `GITHUB_TOKEN` normalmente não disparam outro workflow de `push`. A publicação valida os dados antes do envio. Também é possível iniciar os workflows manualmente pela aba Actions.

O agendamento do GitHub é de melhor esforço: pode atrasar ou perder execuções, usa a branch padrão e pode ser desativado em repositórios públicos após 60 dias sem atividade. O minuto 17 evita o começo de cada hora, período de maior carga. A presença dos arquivos de workflow não comprova uma execução: confira o histórico de Actions e o horário exibido no site.

## Dados e limites da pesquisa

Uma página promocional informa um **preço anunciado**, sem confirmar disponibilidade no pagamento. O preço final, as taxas, a bagagem e as regras precisam ser conferidos na companhia ou no programa. A coleta preserva a fonte, o momento da leitura e falhas de consulta; não renova anúncios antigos para esconder indisponibilidade.

Não existe nesta versão uma integração que consulte todas as companhias e programas. O coletor lê as páginas habilitadas em `config/sources.json`, e o agente complementa o catálogo em `sources/observations.json`. Valores genéricos sem origem e data de viagem identificadas não devem virar ofertas. Milhas de programas diferentes não representam o mesmo custo; taxas são registradas separadamente e `null` significa não informado.

**Reposicionamento:** o motor está implementado, mas o catálogo inicial não recomenda combinações. Uma oportunidade só aparece quando há evidência dos bilhetes, horários com fuso, bagagem, taxas e custos de transporte/pernoite, com margem entre voos e economia suficiente. Para ida e volta, o cálculo inclui o retorno ao aeroporto de origem. Bilhetes separados podem exigir novo check-in e não oferecem uma conexão protegida. Sem esses dados, não se anuncia uma economia presumida.

## Publicação no Azure Free

O recurso atual é um Static Web App no plano `Free`. Os scripts conferem esse plano e recusam reutilizar um recurso em outra camada. Não criam banco de dados, máquina virtual, Functions independente ou serviço de IA pago.

### Publicar pelo computador

Requer Azure CLI autenticado e Node.js. O caminho REST aceita assinatura e diretório explicitamente, inclusive quando uma assinatura nova ainda não aparece na lista local do CLI:

```powershell
$subscriptionId = Read-Host 'ID da assinatura Azure'
$tenantId = Read-Host 'ID do diretório Azure'
az login --tenant $tenantId --allow-no-subscriptions
.\scripts\deploy-azure-rest.ps1 -SubscriptionId $subscriptionId -TenantId $tenantId
```

O script cria ou reutiliza `rg-rota-leve` e `rota-leve` em `westus2`, confere o plano Free e publica `site/` pelo SWA CLI via `npx`. Aceita `-ResourceGroup`, `-Name` e `-Location` para outro destino. `-SkipDeploy` apenas prepara e verifica o recurso, sem solicitar o token de publicação.

O token de publicação fica no processo durante o deploy e a variável de ambiente é restaurada ao terminar. Não use transcrição ou logs de depuração de credenciais ao executar scripts de implantação.

### Publicação automática com OIDC

O fluxo principal do GitHub usa **OIDC**, sem armazenar um Secret de token do Azure no repositório. Uma identidade gerenciada permite autenticar a `main` deste repositório; o papel de acesso autoriza somente `Microsoft.Web/staticSites/read` e `Microsoft.Web/staticSites/listsecrets/action`, atribuídos ao Static Web App específico. O workflow obtém o token de publicação durante a execução, mascara o valor nos logs e o entrega à ação de deploy.

Para configurar esse vínculo em um ambiente novo, publique primeiro o site Free pelo comando anterior. Use uma conta Azure com permissão para criar a identidade gerenciada e definir/atribuir o papel de acesso. Obtenha os IDs numéricos imutáveis do proprietário e do repositório nos metadados do GitHub; não substitua esses IDs por nomes nem os adivinhe:

```powershell
$repository = 'igor93ti/rota-leve'
$repositoryInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository"
.\scripts\configure-azure-oidc.ps1 `
  -SubscriptionId $subscriptionId `
  -TenantId $tenantId `
  -Repository $repository `
  -OwnerId ([string]$repositoryInfo.owner.id) `
  -RepositoryId ([string]$repositoryInfo.id)
```

O script restringe a confiança à branch `main`, ao emissor OIDC do GitHub e à audiência Azure indicada. Ele configura somente o lado Azure e grava `config/azure-deployment.json`, com identificadores não secretos para o workflow. Envie esse arquivo com `.github/workflows/deploy.yml` para a `main`, habilite Actions e acompanhe a primeira execução de **Publicar no Azure**. Não é necessário instalar GitHub CLI nem criar um Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` para esse fluxo. A conexão do plugin GitHub usada pelo agente é independente da identidade de publicação do Azure.

### Arquivos de implantação

- `deployment.json`: URL pública, nomes do recurso/grupo, região e plano `Free`; pode ser versionado.
- `config/azure-deployment.json`: IDs não secretos da identidade, do destino e da confiança OIDC; consumido pelo workflow.
- `.azure/target.json`: metadados locais da assinatura e do destino usados na operação; a pasta `.azure/` é ignorada pelo Git. Não contém token de publicação e não precisa ser enviada ao repositório.

`scripts/deploy-azure.ps1` mantém o caminho anterior baseado no contexto ativo do CLI. Sua opção de cadastrar um Secret é compatibilidade manual e não é necessária nem usada pelo fluxo OIDC atual.

## Limites gratuitos

Conforme a documentação oficial consultada em 30/10/2026, Azure Static Web Apps Free oferece 100 GB de tráfego mensal por assinatura, 250 MB por ambiente, 500 MB somando ambientes, SSL e dois domínios personalizados. Não possui SLA; ao exceder o tráfego, o serviço pode deixar de servir o site. Um domínio próprio precisa ser adquirido separadamente, se desejado. A identidade gerenciada usada pelo OIDC não acrescenta cobrança.

Runners padrão de GitHub Actions em repositórios públicos são gratuitos. Em repositórios privados, a franquia depende do plano e compartilha consumo com outros projetos. APIs externas podem ter limites ou custos próprios; a hospedagem gratuita não inclui crédito de APIs ou de IA.

A avaliação gratuita de uma assinatura Azure é diferente da camada Free deste site. Depois da avaliação, a assinatura precisa continuar ativa para manter os serviços. O Static Web App pode permanecer no plano Free; outros recursos criados na assinatura podem gerar cobranças.

## Documentação oficial

- [Preços e limites do Azure Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/)
- [Identidades gerenciadas do Azure](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
- [GitHub Actions e autenticação OIDC no Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
- [GitHub OIDC e identificadores imutáveis](https://docs.github.com/en/actions/reference/security/oidc)
- [Publicação com o SWA CLI](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli)
- [GitHub Actions: eventos e limites do agendamento](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions: cobrança e franquias](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Fim da avaliação gratuita do Azure](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/avoid-charges-free-account)
