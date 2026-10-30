# Rota Leve

Radar de passagens saindo de Fortaleza (FOR) e Recife (REC), com ofertas nacionais e internacionais em dinheiro e milhas. Interface pública, responsiva e sem autenticação, preparada para Azure Static Web Apps Free.

## Executar e validar

Requer Node.js 22 ou superior. O site usa HTML, CSS e JavaScript, sem build de framework.

```powershell
npm start
npm run check
npm test
npm run collect
```

Abra o endereço exibido por `npm start`. `site/` contém todos os arquivos publicados; scripts, instruções do agente e credenciais ficam fora dessa pasta.

## Dados e qualidade das ofertas

O coletor publica um catálogo estático. Cada oportunidade deve manter sua fonte, o horário da consulta e o tipo de informação encontrada. Uma promoção anunciada por uma fonte editorial não confirma disponibilidade no momento da emissão. O preço final e as regras precisam ser consultados na companhia ou no programa de fidelidade.

Não existe nesta versão uma integração universal que consulte todas as companhias e todos os programas. A cobertura é a das fontes habilitadas. Consultas em dinheiro e resgates em milhas têm inventários diferentes; milhas não são dinheiro, e as taxas devem ser apresentadas separadamente. Ofertas vencidas ou sem evidência suficiente não devem ser promovidas a tarifas confirmadas.

O agente pode pesquisar novas oportunidades e registrar os resultados no formato esperado pelo coletor. A rotina deve preservar fontes e datas, evitar inferir uma tarifa de Fortaleza/Recife a partir de um preço genérico e manter falhas de consulta visíveis. A existência dos arquivos de agendamento não significa que a execução já esteja ativa: é necessário publicar o repositório, habilitar Actions e configurar o token do Azure.

Oportunidades de reposicionamento comparam o custo total de sair de FOR/REC, chegar a outro aeroporto e usar uma promoção originada ali. A recomendação precisa incluir ida e volta do deslocamento quando aplicável, taxas, bagagem, hospedagem necessária e margem entre voos. Bilhetes separados podem exigir novo check-in e não oferecem uma conexão protegida; uma economia sem esses custos não deve ser anunciada como vantagem garantida.

## Publicar no Azure Free

O projeto precisa de uma assinatura Azure e um repositório GitHub. O plano escolhido pelo script é explicitamente `Free`; ele não cria banco de dados, máquina virtual, Functions independente ou serviço pago.

### Opção 1: publicar diretamente pelo computador

Instale o Azure CLI e Node.js. Confira a assinatura ativa antes de criar o recurso:

```powershell
az login
az account show --query name -o tsv
.\scripts\deploy-azure.ps1
```

O script cria/reutiliza o grupo `rg-rota-leve` e o Static Web App `rota-leve` em `westus2`, publica `site/` em produção e informa a URL. O nome deve ser único no contexto exigido pelo Azure; personalize se necessário:

```powershell
.\scripts\deploy-azure.ps1 -ResourceGroup rg-meu-radar -Name meu-radar -Location westus2
```

O deploy usa o SWA CLI via `npx`. O token passa somente por variável de ambiente e é removido/restaurado ao terminar. Não execute esse script com logs de depuração de credenciais ou transcrição de sessão. Com `-SkipDeploy`, apenas prepara o recurso e, se solicitado, o Secret do repositório.

### Opção 2: publicação e atualização pelo GitHub

1. Envie o projeto para um repositório com branch padrão `main` e habilite GitHub Actions.
2. Crie um recurso **Static Web App → Free**, escolhendo origem de deploy **Other** no Azure. O workflow deste projeto já define a publicação; não é necessário gerar outro pelo portal.
3. Em **Overview → Manage deployment token**, copie o token para o Secret de repositório **Settings → Secrets and variables → Actions → New repository secret**, com o nome `AZURE_STATIC_WEB_APPS_API_TOKEN`. Não coloque o token no código ou neste README.
4. Execute o workflow **Publicar no Azure** manualmente uma vez. Depois, alterações em `site/` na `main` e coletas concluídas com sucesso atualizam o site.

Também é possível preparar o recurso e cadastrar o Secret sem copiar o token. Requer GitHub CLI autenticado e permissão de administração de Secrets no repositório existente:

```powershell
gh auth login
.\scripts\deploy-azure.ps1 -Repository dono/repositorio -SkipDeploy
```

O parâmetro aceita `dono/repositorio` ou a URL do GitHub e grava o Secret por stdin. Ele não cria um repositório novo.

## Atualizações quatro vezes ao dia

O workflow **Atualizar ofertas** roda em `00:17`, `06:17`, `12:17` e `18:17`, horário de `America/Sao_Paulo`. O minuto 17 evita o começo de cada hora, período de maior carga no agendador. Também pode ser iniciado manualmente pela aba Actions.

A coleta valida e salva o catálogo no repositório. O workflow **Publicar no Azure** reage à conclusão bem-sucedida da coleta usando `workflow_run` e baixa a versão atual da `main`. Isso é necessário porque commits feitos com `GITHUB_TOKEN` normalmente não disparam outro workflow de `push`.

O agendamento do GitHub é de melhor esforço: pode atrasar ou perder execuções, só usa a branch padrão e pode ser desativado em repositórios públicos após 60 dias sem atividade. A automação local do agente depende de o computador e o Codex estarem disponíveis; o coletor do GitHub continua independente depois de configurado. Pesquisas com APIs externas exigem suas próprias credenciais e podem ter limites ou custos, mesmo que a hospedagem seja gratuita.

## Limites gratuitos

Conforme a documentação oficial consultada em 30/10/2026, Azure Static Web Apps Free oferece 100 GB de tráfego mensal por assinatura, 250 MB por ambiente, 500 MB somando ambientes, SSL e dois domínios personalizados. Não possui SLA; ao exceder o tráfego, o serviço pode deixar de servir o site. Um domínio próprio, se desejado, precisa ser adquirido separadamente.

Runners padrão de GitHub Actions em repositórios públicos são gratuitos. Para repositórios privados, o plano GitHub Free inclui atualmente US$ 12/mês de compute compartilhado e 500 MB de artefatos; consumo adicional pode ser cobrado conforme a configuração da conta. Este projeto usa jobs curtos em Linux e dispensa o armazenamento de grandes artefatos, mas a franquia também pode ser consumida por outros projetos.

## Documentação oficial

- [Preços e limites do Azure Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/)
- [Criar Static Web App pelo portal](https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal)
- [Configuração de build e publicação](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
- [Deploy com o SWA CLI e token por variável de ambiente](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli)
- [Azure CLI: criar Static Web App no plano Free](https://learn.microsoft.com/en-us/cli/azure/staticwebapp?view=azure-cli-latest)
- [GitHub Actions: eventos e limites do agendamento](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions: cobrança e franquias](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
