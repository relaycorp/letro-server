---
nav_order: 0
---
# Letro's VeraId integration server

This server is part of a [centralised Awala service](https://awala.network/service-providers/implementation/architecture#centralised-service) that integrates [VeraId](https://veraid.net) in Relaycorp's [Letro](https://letro.app/en) user agents, such as [Letro for Android](https://github.com/relaycorp/letro-android), in order to offer a superior user experience. The server supports the following modules:

- [VeraId account creation with Relaycorp-operated domains](./account-creation.md).
- [Retrieval of connection parameters for Awala Internet endpoints](./connection-params-retrieval.md).
- [Contact pairing using VeraId](./contact-pairing.md).

This component effectively makes Relaycorp's Letro implementation an [Awala hybrid service](https://awala.network/service-providers/implementation/architecture#hybrid-services), where the core Letro protocol remains [fully decentralised](https://awala.network/service-providers/implementation/architecture#decentralised-service).

## Architecture

This server is an [Awala Internet Endpoint](https://docs.relaycorp.tech/awala-endpoint-internet/) backend deployed on [Google Cloud Run](https://cloud.google.com/run). It uses the following backing services:

- [MongoDB](https://www.mongodb.com).
- A messaging broker supported by [@relaycorp/cloudevents-transport](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) (e.g., [Google PubSub](https://cloud.google.com/pubsub)).
- [VeraId Authority](https://docs.relaycorp.tech/veraid-authority/).

The production environment for this app can be found in the [`letro-cloud`](https://github.com/relaycorp/letro-cloud) project.

### Data persistence

Refer to the documentation of each module for details on the data persisted (if any). Note that the server also uses logging extensively for debugging purposes and such logs will often contain data from the incoming messages (e.g., VeraId member ids).

### Awala service messages

All messages exchanged with this server have a type beginning with `application/vnd.relaycorp.letro.` and are serialised with ASN.1 DER.

## Third-party Letro user agents

**This server is only meant to be used by Relaycorp's Letro user agents**. If you want to build an alternative user agent **and** use the functionality supported by this app, you MUST deploy it to your own hosting environment.

Our T&Cs forbid third-parties from using our instance of this app, as it'd be unfair for Relaycorp to bear the hosting and operation costs of maintaining this app for the benefit of third-party Letro agents. Note that if you're a third-party user agent developer, you'd still want to fork this app for the following reasons:

- We will introduce backwards-incompatible changes without prior notice.
- We won't support cloud providers other than Google Cloud Platform.
- If you're implementing your own user agent, chances are you want to do things differently anyway.

Note that any forks will remain subject to terms of the GNU Affero General Public License v3.0.
