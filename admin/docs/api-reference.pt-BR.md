# Referência da API

O monolith-nomad expõe uma API REST para todas as operações. Todos os endpoints ficam em `/api/` e respondem em JSON.

---

## Referência interativa

A referência completa e sempre atualizada dos endpoints é gerada diretamente das rotas e dos validadores do
aplicativo e servida numa interface interativa do [Scalar](https://scalar.com):

- **[/reference](/reference)**: navegue por todos os endpoints e esquemas de requisição e resposta, e teste chamadas ao vivo
- **[/api/openapi.json](/api/openapi.json)**: o documento OpenAPI 3.1 bruto (para importar no Postman, no Insomnia, em geradores de código etc.)

Como ela é derivada dos mesmos validadores VineJS que a API usa, nunca fica diferente da implementação.
Prefira essa referência a qualquer lista de endpoints escrita à mão.

---

## Convenções

**URL base:** `http://<seu-servidor>/api`

**Respostas:**
- Respostas de sucesso incluem `{ "success": true }` e um status HTTP 2xx
- Respostas de erro devolvem o status HTTP adequado (400, 404, 409, 500) com uma mensagem de erro
- Operações demoradas (downloads, benchmarks, embeddings) devolvem 201 ou 202 com um ID de job ou de benchmark para consulta

**Padrão assíncrono:** envie um job → receba um ID → consulte um endpoint de status até a conclusão.
