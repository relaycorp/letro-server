# letro-server

Awala endpoint backend backing Letro's centralised service

## Environment variables

- `VERSION` (required): The version of the app.
- `LOG_LEVEL` (default: `info`): The log level.
- `LOG_TARGET` (optional): The [`@relaycorp/pino-cloud`](https://www.npmjs.com/package/@relaycorp/pino-cloud) target (e.g., `gcp`).
- `MONGODB_URI`: The URI to connect to MongoDB (e.g., `mongodb://localhost:27017/awala-endpoint`).
- `REQUEST_ID_HEADER` (default: `X-Request-ID`): The name of the header that contains the request id.

## Supported events

### Account creation

```http
POST http://letro-server.default.10.107.166.111.sslip.io
Content-Type: application/vnd.relaycorp.letro.account-creation-request
Ce-Id: the-id
Ce-Type: tech.relaycorp.awala.endpoint-internet.incoming-service-message
Ce-Specversion: 1.0
Ce-Source: https://example.com/the-source
```
