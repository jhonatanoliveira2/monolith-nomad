# Referência da API

API REST em `/api/`, com respostas em JSON.

- **[/reference](/reference)**: referência interativa (Scalar), gerada das rotas e dos validadores; permite testar chamadas.
- **[/api/openapi.json](/api/openapi.json)**: documento OpenAPI 3.1, para Postman, Insomnia ou geradores de código.

## Convenções

- **URL base:** `http://<seu-servidor>/api`
- **Sucesso:** status 2xx, com `{ "success": true }`.
- **Erro:** 400, 404, 409, 422 ou 500, com uma mensagem.
- **Operações longas** (downloads, benchmarks, embeddings): 201 ou 202 com um ID; consulte o status até concluir.
