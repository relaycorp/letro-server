# letro-server

Awala endpoint backend backing Letro's centralised service

## Architecture

## Install

### Environment variables

- `VERSION` (required): The version of the image being used. This value is used when reporting errors.
- `REQUEST_ID_HEADER` (default: `X-Request-ID`): The name of the HTTP header that contains the request id.
- DB connection variables:
  - `MONGODB_URI` (required): The URI to connect to MongoDB (e.g., `mongodb://localhost:27017/awala-endpoint`).
  - `MONGODB_DB` (optional): The name of the MongoDB database (e.g., `awala-endpoint`).
  - `MONGODB_USER` (optional): The username to connect to MongoDB (e.g., `alice`).
  - `MONGODB_PASSWORD` (optional): The password to connect to MongoDB (e.g., `s3cr3t`).
- VeraId Authority variables:
  - `VAUTH_API_URL` (required): The URL of the VeraId Authority API.
- CloudEvents variables:
  - `CE_TRANSPORT` (default: `ce-http-binary`): The [`@relaycorp/cloudevents-transport`](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) transport to use. Each transport has its own set of environment variables.
- Logging variables:
  - `LOG_TARGET` (optional): The [`@relaycorp/pino-cloud`](https://www.npmjs.com/package/@relaycorp/pino-cloud) target (e.g., `gcp`).
