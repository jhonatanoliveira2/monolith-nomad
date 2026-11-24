# Perguntas frequentes (FAQ)

Dúvidas de uso estão também na [FAQ do app](admin/docs/faq.pt-BR.md). Esta página cobre instalação e operação.

## Instalação e host

**Posso mudar portas ou o local dos dados?** Sim, editando `/opt/project-nomad/compose.yml`: portas dos serviços principais (`8080`, `9999`, MySQL, Redis) e bind mounts. Os apps instaláveis ainda não aceitam portas personalizadas.

**Disco externo ou de rede (iSCSI, SMB, NFS)?** Funciona, mas a montagem é responsabilidade do host, antes de o monolith-nomad iniciar. Disco local é mais rápido.

**macOS, WSL2 ou distro que não seja Debian?** Não há suporte. O instalador foi feito e testado para Debian e Ubuntu; os containers podem rodar em outros sistemas com Docker, sem garantia.

**Raspberry Pi ou ARM?** Não. Só há imagens x86-64; o instalador avisa e a instalação provavelmente falha.

**Convive com outros containers?** Sim. Os containers do monolith-nomad têm o prefixo `nomad_`, e o instalador para antes de criar algo se uma porta estiver ocupada.

**Por que ele acessa o socket do Docker?** A Central de Comando gerencia os containers dos apps no próprio host (Docker-outside-of-Docker).

## IA

**Posso usar qualquer modelo?** Qualquer um do [Ollama](https://ollama.com/search). Se não aparecer em Modelos de IA:

```bash
curl -X POST -H "Content-Type: application/json" -d '{"model":"NOME_DO_MODELO"}' http://localhost:8080/api/ollama/models
```

Também é possível usar LM Studio ou llama.cpp (API compatível com a OpenAI), inclusive em outro computador.

**GPU AMD?** Sim. O instalador detecta a placa (modelo gfx) e o Assistente de IA usa ROCm. NVIDIA também é suportada, pelo NVIDIA Container Toolkit.

**A IA é obrigatória?** Não. Ollama, Qdrant e o RAG são opcionais.

## Projeto

**Tecnologias:** Docker, Node.js/TypeScript com [AdonisJS](https://adonisjs.com/), React com [Vite](https://vitejs.dev/) e [Inertia.js](https://inertiajs.com/), MySQL, Redis e aria2c.

**É gratuito?** Sim, Apache License 2.0, sem recursos pagos.

**Envia dados?** Não há telemetria. Serviços online de terceiros ficam desligados por padrão ([`docs/distribuicao.md`](docs/distribuicao.md)).

**Bugs, sugestões e PRs:** [Issues](https://github.com/jhonatanoliveira2/monolith-nomad/issues), com os modelos de bug ou de sugestão. Não há prazo garantido; problemas de segurança e que afetam muita gente vêm primeiro. Vulnerabilidades: [`SECURITY.md`](SECURITY.md), nunca em issue pública. Para PRs, siga o [`CONTRIBUTING.md`](CONTRIBUTING.md).
