# API Reference

A REST API under `/api/`, answering in JSON.

- **[/reference](/reference)**: interactive reference (Scalar), generated from the routes and validators; try calls live.
- **[/api/openapi.json](/api/openapi.json)**: the OpenAPI 3.1 document, for Postman, Insomnia or code generators.

## Conventions

- **Base URL:** `http://<your-server>/api`
- **Success:** a 2xx status with `{ "success": true }`.
- **Error:** 400, 404, 409, 422 or 500 with a message.
- **Long operations** (downloads, benchmarks, embeddings): 201 or 202 with an ID; poll the status until done.
