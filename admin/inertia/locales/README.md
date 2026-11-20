# Traduções da interface

A interface usa **i18next** (`inertia/lib/i18n.ts`). O idioma padrão é o **pt-BR**, e o inglês é o idioma-fonte.

## Convenção

- **A chave é o texto em inglês:** `t('Settings')`, `t('Downloaded {{size}} of {{total}}', { size, total })`.
  Se faltar uma tradução, o texto em inglês aparece já interpolado, nunca uma chave crua.
- Os catálogos são **JSON planos** em `inertia/locales/<idioma>/<área>.json` (`{ "Settings": "Configurações" }`). Todos os arquivos de um idioma são mesclados, e cada área da interface tem o seu.
- Não há catálogo `en/`, porque o inglês está nas próprias chaves.
- **Componentes:** `const { t } = useTranslation()` (de `react-i18next`).
- **Fora de componentes** (helpers, notificações): `import { t } from '~/lib/i18n'`, sempre chamado no momento do uso, nunca guardado numa constante de módulo.
- **Constantes de módulo** (listas de itens, rótulos): mantenha o texto em inglês na constante e traduza ao renderizar, com `t(item.label)`. Assim a troca de idioma funciona sem recarregar.
- **Plural:** escreva as duas chaves, `count === 1 ? t('1 file') : t('{{count}} files', { count })`.
- **Frases com links ou negrito:** divida em pedaços traduzíveis, ou use `<Trans>` (`react-i18next`).
- **Datas e números:** `formatDate`, `formatDateTime`, `formatTime`, `formatNumber` e `formatRelative` de `~/lib/format`. Nunca use `toLocaleString()` sem idioma nem `'en-US'` fixo.
- **Não traduza:** nomes de produtos de terceiros (Kiwix, Ollama, Kolibri, Docker, ZIM…), comandos, caminhos, chaves de API e valores técnicos.

## Para adicionar um idioma

1. Crie `inertia/locales/<código>/` (por exemplo `es/`) com os mesmos arquivos JSON de `pt-BR/`, traduzidos.
2. Acrescente o idioma em `SUPPORTED_LOCALES` (`inertia/lib/i18n.ts`).

## Glossário pt-BR

| Inglês | pt-BR |
|---|---|
| Command Center | Central de Comando |
| Supply Depot | Depósito de Apps |
| Easy Setup | Configuração Rápida |
| Content Explorer | Explorador de Conteúdo |
| Content Manager | Gerenciador de Conteúdo |
| Maps / Maps Manager | Mapas / Gerenciador de Mapas |
| Information Library | Biblioteca de Informação |
| Knowledge Base | Base de Conhecimento |
| AI Assistant | Assistente de IA |
| Drug Reference | Bulário |
| Creator Packs | Pacotes de Criadores |
| Benchmark / NOMAD Score | Benchmark / Pontuação do Sistema |
| Builder Tag | Etiqueta de Montador |
| Service Logs & Metrics | Logs e Métricas dos Serviços |
| Check for Updates | Verificar Atualizações |
| System / Advanced | Sistema / Avançado |
| API Reference | Referência da API |
| Legal Notices | Avisos Legais |
| About & Support | Sobre e Suporte |
| Back to Home / Home | Voltar ao Início / Início |
| Docs | Documentação |
| Settings | Configurações |
| Download (substantivo / verbo) | Download / Baixar |
| Install / Uninstall / Update | Instalar / Desinstalar / Atualizar |
| Cancel / Confirm / Save / Delete | Cancelar / Confirmar / Salvar / Excluir |
| Collection | Coleção |
| Curated | Selecionado(a) / Curado(a) |
| Wikipedia | Wikipédia |
| storage / disk | armazenamento / disco |
| model (AI) | modelo |
| app | app (masculino: "o app") |

**Marca:** "Project NOMAD" e "NOMAD" nos textos viram **monolith-nomad** (ou "o servidor", quando soar melhor). Os identificadores técnicos (`nomad_*`, `/opt/project-nomad`) não mudam.

**Tom:** direto, em segunda pessoa ("você"), frases curtas, sem gírias. Termos técnicos consagrados (download, backup, log, benchmark, cache, token) ficam como estão.
