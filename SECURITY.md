# Política de segurança

## Versões com suporte

Só a versão mais recente publicada do monolith-nomad recebe correções de segurança. Se você usa uma versão antiga, atualize antes de reportar um problema.

Reporte aqui os problemas de segurança do monolith-nomad.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública para uma vulnerabilidade de segurança.**

Reporte de forma privada pelo formulário do GitHub:

- <https://github.com/jhonatanoliveira2/monolith-nomad/security/advisories/new>

Ou abra a [aba Security](https://github.com/jhonatanoliveira2/monolith-nomad/security) do repositório e clique em **Report a vulnerability**.

Isso cria um aviso de segurança (advisory) privado, que só o mantenedor vê. Ele continua privado até haver uma correção e o aviso ser publicado.

Não publique detalhes de exploração em issues, discussões, pull requests ou qualquer outro canal público.

### O que incluir

Quanto mais destes itens você trouxer, mais rápido dá para confirmar e corrigir:

- A versão do monolith-nomad testada e o sistema operacional do host
- O componente afetado (Central de Comando, instalador, sidecar de atualização, downloads/mirrors, um app do Depósito de Apps etc.)
- Os passos para reproduzir, de preferência com a requisição ou o comando exato
- O que um atacante ganha e de que acesso ele precisa para começar
- Uma sugestão de correção, se você tiver

### O que esperar

O monolith-nomad é mantido de forma independente, sem prazo de resposta garantido. Todos os relatos são lidos. Se o relato for válido, vamos trabalhar com você na correção e dar o crédito no aviso publicado, a menos que você prefira ficar anônimo.

Não há programa de recompensa (bug bounty), e não é possível pagar por relatos.

## Escopo

### Dentro do escopo

- Execução remota de código, fuga de container ou escalada de privilégio no host
- Qualquer caminho pelo qual alguém que **não** está na rede local consiga afetar uma instância, inclusive ataques feitos pelo navegador de um usuário
- Acesso sem autenticação a dados fora da raiz de armazenamento (`/opt/project-nomad/storage`)
- Path traversal, SSRF que vá além do alvo pretendido ou injeção na API da Central de Comando
- Downloads: uso de mirror fora da lista oficial, instalação de arquivo sem a verificação de SHA-256 quando o hash é conhecido, ou credenciais enviadas a um host que não seja a origem ([`docs/downloads.md`](docs/downloads.md))
- Problemas na cadeia de suprimentos do build e da publicação (workflows, imagens no ghcr)
- Credenciais ou segredos commitados neste repositório

### Fora do escopo

Algumas coisas parecem vulnerabilidades, mas são decisões de projeto deliberadas para um produto offline, de aparelho único e de rede local. Relatos sobre os itens abaixo costumam ser fechados:

- **Falta de autenticação na Central de Comando.** É intencional e está documentado no [README](README.md#segurança). O monolith-nomad foi feito para ficar aberto numa rede local confiável. Se você precisa de controle de acesso, use controles de rede.
- **Qualquer coisa que exija expor o monolith-nomad diretamente à internet.** Isso não tem suporte e é desaconselhado.
- **Acesso por alguém que já está na rede local.** Por projeto, a rede local é a fronteira de confiança.
- **Requisições a endereços internos ou privados.** É esperado que o monolith-nomad acesse outros hosts da rede local, então destinos RFC1918 não são tratados como SSRF.
- A chave de assinatura de envio do benchmark. Ela vai dentro da imagem porque um aparelho offline não tem como guardar um segredo do lado do servidor. Além disso, o envio ao leaderboard fica desligado por padrão nesta distribuição.
- Falta de cabeçalhos de segurança, de limite de requisições ou achados parecidos sem impacto demonstrado num aparelho com este projeto.
- Vulnerabilidades em apps de terceiros do Depósito de Apps. Reporte-as ao projeto de cada app. Mas avise aqui se o problema for causado pela forma como o monolith-nomad configura ou implanta o app.
- Achados de scanner automático sem prova de conceito funcional.

Se não tiver certeza de que algo está no escopo, reporte mesmo assim. É melhor ler um relato fora do escopo do que perder um problema real.

## Segredos neste repositório

Se você acredita que uma credencial foi commitada, reporte de forma privada pelo processo acima, e não por issue, para que ela seja trocada antes de ficar pública.

O instalador gera localmente, no momento da instalação, todas as senhas do banco de dados e a chave do aplicativo. Os valores `replaceme` em `install/management_compose.yaml` não são credenciais reais.
