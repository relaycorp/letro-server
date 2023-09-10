---
permalink: /connection-params-retrieval
nav_order: 2
---

# Connection params retrieval

This module allows users to retrieve the connection parameters for an Awala Internet endpoint. It serves two purposes in Letro user agents by Relaycorp:

- It allows the user to exchange messages with an Awala Internet endpoint (e.g., `bbc.com`, `mundo.bbc.com`).
- It allows the user agent to communicate with a [VeraId Authority](https://docs.relaycorp.tech/veraid-authority/) server [via Awala](https://docs.relaycorp.tech/veraid-authority/awala). For example, to claim a VeraId identifier from a non-Relaycorp-managed domain name (e.g., `your-company.com`).

Consequently, this functionality is agnostic of Letro and VeraId, but we're implementing here until [Awala itself supports it natively](https://github.com/AwalaNetwork/specs/issues/101).

## Messages

### Connection params request

This message signifies a Letro user's intention to retrieve the connection parameters for an Awala Internet endpoint.

- Recipient: Letro server.
- Content type: `application/vnd.relaycorp.letro.connection-params-request`.
- Content: The domain name encoded as a UTF-8 string. Non-ASCII domain names (e.g., `はじめよう.みんな`) are supported.

### Connection params

This message contains the connection params requested.

- Recipient: Letro user agent.
- Content type: `application/vnd.relaycorp.letro.connection-params`.
- Content: A DER-serialised `NodeConnectionParams` structure as defined in Awala, so it's ready to be imported as is with the Awala SDK.

### Misconfigured Internet endpoint

This message signifies that the requested Internet endpoint is misconfigured (e.g., DNSSEC is not properly configured, the Awala DNS record is missing).

- Recipient: Letro user agent.
- Content type: `application/vnd.relaycorp.letro.misconfigured-internet-endpoint`.
- Content: The domain name encoded as a UTF-8 string.

## Data persistence

No data related to this module is stored.
