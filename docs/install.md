---
permalink: /install
nav_order: 1
---

# Install

## Environment variables

All the processes use the following variables:

- `VERSION` (required): The version of the image being used. This value is used when reporting errors.
- `MONGODB_URI`: The URI to connect to MongoDB (e.g., `mongodb://localhost:27017/awala-endpoint`).
- `CE_TRANSPORT` (default: `ce-http-binary`): The [`@relaycorp/cloudevents-transport`](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) transport to use. Each transport has its own set of environment variables.
- `LOG_TARGET` (optional): The [`@relaycorp/pino-cloud`](https://www.npmjs.com/package/@relaycorp/pino-cloud) target (e.g., `gcp`).
- `REQUEST_ID_HEADER` (default: `X-Request-ID`): The name of the HTTP header that contains the request id.
