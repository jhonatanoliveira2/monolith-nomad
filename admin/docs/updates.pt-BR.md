# Atualizações

Três coisas se atualizam de forma independente:

| Tipo | O que é | De onde vem |
|---|---|---|
| **Software** | A Central de Comando | Releases deste repositório e `ghcr.io/jhonatanoliveira2` |
| **Apps** | Kiwix, Ollama, Kolibri e os outros do [Depósito](/supply-depot) | Registro de imagens de cada autor |
| **Conteúdo** | ZIMs, mapas e o Bulário | Catálogos do Kiwix e de mapas, com SHA-256 conferido |

## Manual

- **Software:** [Atualizações](/settings/update). Leva de 2 a 5 minutos; se falhar, a versão anterior continua no ar.
- **Apps:** **Gerenciar › Atualizar** no cartão do app. Se o container novo não subir, o app volta à versão anterior.
- **Conteúdo:** [Gerenciador de Conteúdo](/settings/zim) e [Explorador](/settings/zim/remote-explorer).

## Automáticas

Opcionais e **desligadas por padrão**, em [Atualizações](/settings/update).

- Rodam só na **janela de horário** que você define.
- **Versões principais nunca são automáticas**, só menores e de correção.
- Antes, conferem espaço em disco e se não há outro download ou instalação em andamento.
- Sem internet, a rodada é pulada.
- **Software:** espera um período configurável depois de cada release e desliga sozinho se falhar repetidamente.
- **Apps:** exigem o interruptor geral **e** o interruptor do app no Depósito.
- **Conteúdo:** janela noturna própria, com limite de banda; a Base de Conhecimento acompanha a troca da Wikipédia.

## Acesso Antecipado

Em [Atualizações](/settings/update), o canal de Acesso Antecipado instala versões candidatas (release candidates). Dá para voltar ao canal estável quando quiser.

**[Verificar atualizações →](/settings/update)** · **[Notas de Versão →](/docs/release-notes)**
