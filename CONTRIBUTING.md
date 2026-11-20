# Como contribuir com o monolith-nomad

Obrigado pelo interesse em contribuir! Leia este guia inteiro antes de começar: ele economiza o seu tempo e o do mantenedor.

O monolith-nomad é uma distribuição independente e não oficial, derivada do Project N.O.M.A.D. (Crosstalk Solutions, LLC, Apache-2.0). Contribuições feitas aqui valem para esta distribuição. Mudanças que fazem sentido para o projeto original também podem ser propostas lá, seguindo as regras dele.

> **Observação:** a aceitação de contribuições não é garantida. Cada pull request é avaliado pela qualidade, pela relevância e pelo alinhamento com os objetivos do projeto. O mantenedor pode aceitar, recusar ou modificar qualquer pull request, a critério dele.

---

## Sumário

- [Código de Conduta](#código-de-conduta)
- [Antes de começar](#antes-de-começar)
- [Primeiros passos](#primeiros-passos)
- [Fluxo de desenvolvimento](#fluxo-de-desenvolvimento)
- [Regras desta distribuição](#regras-desta-distribuição)
- [Traduções](#traduções)
- [Consistência da interface](#consistência-da-interface)
- [Mensagens de commit](#mensagens-de-commit)
- [Notas de versão](#notas-de-versão)
- [Versionamento](#versionamento)
- [Enviando um pull request](#enviando-um-pull-request)

---

## Código de Conduta

Leia o [Código de Conduta](CODE_OF_CONDUCT.md) antes de contribuir. Em resumo: seja respeitoso e atencioso em todas as interações com o mantenedor e com outras pessoas que contribuem. Comportamento desrespeitoso ou abusivo não será tolerado.

---

## Antes de começar

**Abra uma issue primeiro.** Antes de escrever código para uma mudança que não seja trivial, [abra uma issue](https://github.com/jhonatanoliveira2/monolith-nomad/issues/new/choose) para discutir a proposta. Isso evita trabalho duplicado e garante que a contribuição combina com a direção do projeto. **Pull requests sem issue correspondente podem ser fechados.**

**Correções triviais não precisam de issue** e podem ir direto como PR. Exemplos:

- correções de digitação e gramática;
- esclarecimentos na documentação;
- correções pequenas, de uma linha, com causa óbvia.

Na dúvida se a sua mudança é trivial, abra uma issue.

Ao abrir uma issue:

- use um título claro e descritivo;
- descreva o problema que você quer resolver ou o recurso que quer adicionar;
- se for bug, inclua os passos para reproduzir e o máximo de detalhes sobre o seu ambiente;
- remova informações pessoais ou sensíveis de logs, configurações etc.

Vulnerabilidades de segurança **não** vão em issue: siga o [`SECURITY.md`](SECURITY.md).

---

## Primeiros passos

**Atenção:** este é o guia para desenvolver e contribuir, **não** para [instalar o monolith-nomad](README.md#instalação) para uso normal.

### Pré-requisitos

- Sistema baseado em Debian (Ubuntu 24.04 ou 26.04 LTS recomendado) para testar o instalador e a instalação real
- Privilégios de `sudo`/root
- Docker instalado e rodando
- Conexão estável com a internet (para baixar as dependências)
- Node.js 22 (para trabalhar no `admin/`)

Você pode desenvolver em outro sistema Linux, mas o produto continua tendo o Ubuntu como alvo. Não troque pacotes, caminhos, comandos ou serviços do Ubuntu por equivalentes de outra distribuição. Para testar a instalação fora do Ubuntu, use uma VM ou um container com Ubuntu.

### Fork e clone

1. Clique em **Fork** no canto superior direito deste repositório.
2. Clone o seu fork:
   ```bash
   git clone https://github.com/SEU_USUARIO/monolith-nomad.git
   cd monolith-nomad
   ```
3. Adicione este repositório como remoto `upstream`, para manter o seu fork em dia:
   ```bash
   git remote add upstream https://github.com/jhonatanoliveira2/monolith-nomad.git
   ```

### Evite instalar uma versão publicada na mesma máquina

Como o monolith-nomad depende muito do Docker, não recomendamos instalar uma versão publicada na mesma máquina em que você desenvolve. Isso pode causar conflitos de portas (`8080`, `9999`), volumes e outros recursos. Rode a versão de desenvolvimento num ambiente Docker separado. **Dá** para fazer, mas complica a configuração e o fluxo de trabalho; se fizer, tenha um plano claro para lidar com os conflitos.

---

## Fluxo de desenvolvimento

1. **Sincronize com o `upstream`** antes de começar. Preferimos rebase a commits de merge, para manter o histórico do git limpo e linear (isso também facilita a revisão):
   ```bash
   git fetch upstream
   git checkout main
   git rebase upstream/main
   ```

2. **Crie uma branch** a partir da `main`, com nome descritivo:
   ```bash
   git checkout -b fix/issue-123
   # ou
   git checkout -b feature/nova-ferramenta
   ```

3. **Faça as mudanças.** Siga o estilo e as convenções do código existente. Teste localmente, contra uma instância rodando, antes de enviar.

4. **Rode as verificações** a partir de `admin/`:
   ```bash
   npm run typecheck
   npm run lint
   npm run test:unit    # specs puros (node --test), sem serviços: rápido
   npm run test:app     # specs que inicializam o app (Japa): precisa de MySQL migrado e Redis
   ```
   A suíte completa, no mesmo ambiente da imagem (Node 22.23.5, addons nativos compilados), com MySQL e Redis
   descartáveis, a partir da raiz do repositório:
   ```bash
   bash scripts/test-in-docker.sh        # all | unit | app
   ```
   Se mexeu no instalador (`install/`), rode também:
   ```bash
   bash -n install/install_nomad.sh
   bash install/tests/install_nomad_preflight_test.sh   # precisa terminar com "all tests passed"
   bash install/tests/install_source_test.sh            # origem dos arquivos (release/tag/branch)
   ```
   Se adicionou, alterou ou removeu arquivos, regenere o aviso da Apache-2.0 §4(b):
   ```bash
   bash scripts/list-modifications.sh > MODIFICATIONS.md
   ```

5. **Se mexeu no Assistente de IA ou no RAG, meça.** Mudanças em chunking, embeddings, recuperação, reranking, limiares, prompts de sistema ou montagem de contexto precisam de números, não de uma olhada rápida. "Pareceu melhor na janela do chat" é como uma regressão chega à produção. A partir de `admin/`:

   ```bash
   node ace eval:corpus --ingest        # uma vez; seguro, nunca mexe na sua Base de Conhecimento real
   node ace eval:retrieval --ablate     # segundos, determinístico, sem modelo de chat
   node ace eval:generation --model=<seu modelo> --all-modes
   ```

   Inclua os números de antes e depois no pull request. Veja em [`admin/tests/eval/README.md`](admin/tests/eval/README.md) o que cada métrica significa, como os três modos de geração separam um bug no código de um modelo pequeno demais e as limitações conhecidas.

6. **Faça os commits** seguindo os [Conventional Commits](#mensagens-de-commit).

7. **Envie a branch** e abra um pull request.

---

## Regras desta distribuição

- **Independência do fork.** Instalador, compose, atualizador, CI, verificação de atualizações e catálogos precisam apontar para este repositório e para as imagens do fork, nunca de volta para o projeto original. O teste [`admin/tests/unit/fork_independence.spec.ts`](admin/tests/unit/fork_independence.spec.ts) garante isso e falha se uma URL fixa do upstream voltar (por exemplo, num merge do projeto original). Ao trazer mudanças do upstream, rode esse teste. Detalhes em [`docs/distribuicao.md`](docs/distribuicao.md).
- **Identificadores técnicos não mudam.** `/opt/project-nomad`, os containers `nomad_*`, o projeto compose `project-nomad`, os nomes das imagens `project-nomad*` e os cabeçalhos `X-NOMAD-*` ficam como estão, para não quebrar instalações e atualizações existentes. Nos **textos**, use "monolith-nomad".
- **Ubuntu continua sendo o alvo.** Não altere pacotes, comandos, caminhos ou nomes de serviço do instalador sem uma necessidade justificada.
- **AMD primeiro, sem quebrar NVIDIA.** Evite dependências desnecessárias de NVIDIA/CUDA. O suporte a NVIDIA existente deve continuar funcionando.
- **Downloads.** Mudanças em `admin/app/utils/` (mirrors, aria2c, SHA-256) devem manter as regras de [`docs/downloads.md`](docs/downloads.md): URL canônica, credenciais só para a origem, nada parcial instalado e só mirrors verificados. Não invente números de benchmark: documente medições reais.
- **Créditos e licenças.** Preserve os avisos de copyright e as licenças. Créditos de terceiros ficam centralizados em [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## Traduções

O idioma padrão é o **pt-BR**, e o inglês é o idioma-fonte. Antes de mexer em textos da interface, leia [`admin/inertia/locales/README.md`](admin/inertia/locales/README.md). Em resumo:

- a chave é o texto em inglês (`t('Settings')`), e os catálogos são JSON planos em `admin/inertia/locales/<idioma>/<área>.json`;
- todo texto novo na interface deve passar por `t()` e ganhar a tradução em `pt-BR/`;
- datas e números usam os helpers de `~/lib/format`, nunca `toLocaleString()` sem idioma;
- não traduza nomes de produtos (Kiwix, Ollama, Docker…), comandos, caminhos nem valores técnicos;
- siga o glossário e o tom (direto, em "você", frases curtas) do README de traduções.

Mensagens do instalador e dos scripts em `install/` também ficam em pt-BR. Prompts de confirmação aceitam `s`/`S` e também `y`/`Y`.

---

## Consistência da interface

O princípio da interface é: **facilidade de uso em primeiro lugar**. Um controle que parece ou se comporta diferente do resto do app soa como defeito para um usuário não técnico. Todo trabalho novo no frontend (Inertia/React) deve ser visual e funcionalmente uniforme com o que já existe, incluindo o tema Nothing. Antes de adicionar um elemento, olhe os vizinhos e reaproveite os componentes compartilhados em vez de criar um avulso.

**Reaproveite os componentes compartilhados** em `admin/inertia/components/` (e `.../components/inputs/`):

| Necessidade | Use | Não use |
|---|---|---|
| Configuração liga/desliga | `Switch` | um `<input type="checkbox">` cru |
| Ajuda ao passar o mouse | `InfoTooltip` | um atributo `title=` cru ou um tooltip próprio |
| Modal / diálogo de confirmação | `StyledModal` | uma sobreposição feita à mão |
| Campo de texto | `Input` | um `<input>` cru |
| Título de seção | `StyledSectionHeader` | marcação de título improvisada |

Procure um componente existente antes de criar um novo.

**Siga os vizinhos.** Copie as classes e convenções dos elementos ao lado:

- **Rótulos:** siga a pontuação e a capitalização dos rótulos irmãos. Se o campo ao lado diz `Modelo:` (com dois-pontos), o seu deve dizer `Raciocínio:`, e não `Raciocínio`. Reaproveite os mesmos tokens de tipografia (por exemplo `text-sm text-text-secondary`).
- **Tema:** use os tokens de design (`text-*`, `bg-*`, `border-*`) para o elemento funcionar nos modos claro e escuro. Nunca fixe cores no código.
- **Posição:** garanta que popovers e tooltips não fiquem cortados ou espremidos na borda da tela, inclusive quando o gatilho está perto da borda.

**Quando um controle cru é aceitável.** Essas convenções são sobre seguir a intenção, não sobre proibir elementos básicos. Uma caixa de seleção crua serve para uma lista de múltipla escolha ou um aceite; grupos de rádio e selects nativos servem onde não existe componente compartilhado. A ideia é usar o componente compartilhado quando o seu caso combina com a intenção dele (uma configuração liga/desliga deve ser um `Switch`).

**Teste mudanças de interface num navegador de verdade.** A maioria dessas convenções depende de julgamento, e as ferramentas não conseguem garantir tudo. O hábito mais importante é abrir a mudança no navegador, contra uma instância rodando, antes de enviar. Vários problemas (tooltips cortados ou apertados, layout quebrando em larguras diferentes, telas em branco por erro de renderização) não aparecem na checagem de tipos, só quando você olha a página. Confira os estados que devem aparecer *e* os que devem ficar ocultos, nos temas claro e escuro, e teste mais de uma largura de janela quando houver layout ou posicionamento envolvido.

---

## Mensagens de commit

Este projeto usa [Conventional Commits](https://www.conventionalcommits.org/pt-br/). Todas as mensagens de commit devem seguir o formato:

```
<tipo>(<escopo>): <descrição>
```

O tipo e o escopo ficam em inglês (são lidos pelo `semantic-release`). A descrição pode ser em português.

**Tipos mais comuns:**

| Tipo | Quando usar |
|---|---|
| `feat` | Um recurso novo para o usuário |
| `fix` | Correção de bug |
| `docs` | Só documentação |
| `refactor` | Mudança de código que não é correção nem recurso e não altera o funcionamento |
| `chore` | Build, atualização de dependências, ferramentas |
| `test` | Adição ou atualização de testes |

O **escopo** é opcional, mas recomendado: indica a área afetada (por exemplo `api`, `ui`, `maps`, `downloads`, `i18n`, `install`).

**Exemplos:**

```
feat(ui): adiciona alternância de tema escuro na Central de Comando
fix(api): corrige status do container que não atualizava após reiniciar
docs: atualiza requisitos de hardware no README
chore(deps): atualiza o docker-compose para a v2.24
```

---

## Notas de versão

As notas de versão legíveis ficam em [`admin/docs/release-notes.md`](admin/docs/release-notes.md) e aparecem direto na Central de Comando.

Se o seu PR for aceito, o mantenedor atualiza as notas de versão com um resumo da contribuição e o crédito para você. Não edite esse arquivo no PR (isso pode gerar conflitos de merge), mas você pode sugerir um texto na descrição do PR.

---

## Versionamento

Este projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão fica no `package.json` da raiz e é atualizada automaticamente pelo `semantic-release` nas branches `main` e `rc`. A imagem Docker `project-nomad` usa essa versão. A versão em `admin/package.json` fica em `0.0.0` e não deve ser alterada à mão.

---

## Enviando um pull request

1. Envie a branch para o seu fork:
   ```bash
   git push origin nome-da-sua-branch
   ```
2. Abra um pull request contra a branch `main` deste repositório.
3. Na descrição do PR:
   - resuma o que as mudanças fazem e por quê;
   - cite a issue relacionada (por exemplo `Closes #123`), obrigatório para mudanças não triviais;
   - informe os passos de teste e os detalhes de ambiente relevantes (inclusive os resultados das verificações acima).
4. Responda aos comentários: o mantenedor pode pedir mudanças. Pull requests parados por muito tempo podem ser fechados.

---

*O monolith-nomad é licenciado sob a [Apache License 2.0](LICENSE). Ao contribuir, você concorda que a sua contribuição será distribuída sob a mesma licença (seção 5 da Apache License 2.0).*
