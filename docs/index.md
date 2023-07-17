# Letro's VeraId integration server

This server is part of a [centralised Awala service](https://awala.network/service-providers/implementation/architecture#centralised-service) that integrates [VeraId](https://veraid.net) in Relaycorp's [Letro](https://letro.app/en) user agents, such as [Letro for Android](https://github.com/relaycorp/letro-android), in order to offer a superior user experience. The server supports the following modules:

- VeraId account creation with Relaycorp-operated domains.
- VeraId account claim with non-Relaycorp-operated domains.
- Contact pairing using VeraId.

This component effectively makes Relaycorp's Letro implementation an [Awala hybrid service](https://awala.network/service-providers/implementation/architecture#hybrid-services), where the core Letro protocol remains [fully decentralised](https://awala.network/service-providers/implementation/architecture#decentralised-service).

## Architecture

This server is an [Awala Internet Endpoint](https://docs.relaycorp.tech/awala-endpoint-internet/) backend deployed on [Google Cloud Run](https://cloud.google.com/run). It uses the following backing services:

- [MongoDB](https://www.mongodb.com).
- A messaging broker supported by [@relaycorp/cloudevents-transport](https://www.npmjs.com/package/@relaycorp/cloudevents-transport) (e.g., [Google PubSub](https://cloud.google.com/pubsub)).
- [VeraId Authority](https://docs.relaycorp.tech/veraid-authority/).

## Third-party Letro user agents

This server is only meant to be used by Relaycorp's Letro user agents. If you want to build an alternative user agent **and** use the functionality supported by this app, you should fork this app for the following reasons:

- We will introduce backwards-incompatible changes without prior notice.
- We won't support cloud providers other than Google Cloud Platform.
- If you're implementing your own user agent, chances are you want to do things differently anyway.

Note that any forks will remain subject to terms of the GNU Affero General Public License v3.0.
