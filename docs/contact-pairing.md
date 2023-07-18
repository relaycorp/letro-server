---
permalink: /contact-pairing
nav_order: 2
---

# Contact pairing

Contact pairing is a two-phase process due to Awala's E2E encryption and pre-authorisation requirements:

1. The two parties exchange [_pairing requests_](#contact-pairing-request), using this server as a broker. The order in which requests are received is irrelevant, as the server will wait until both have been received before forwarding them to each other in the form of [_pairing matches_](#contact-pairing-match).
2. The two parties exchange [_pairing connection parameters_](#contact-pairing-authorisation), using this server as a broker. The order in which parameters are received is irrelevant because the server will forward them as soon as they are received in the form of [_pairing completion_](#contact-pairing-completion) messages.

The diagram below illustrates the process above:

![Contact pairing diagram](./assets/contact-pairing.svg)

The two parties will then be able to communicate with each other using the Awala protocol, without further intervention from this server.

## Messages

### Contact pairing request

This message signifies  a Letro user's intention to pair with another user.

- Recipient: Letro server.
- Content type: `application/vnd.relaycorp.letro.pairing-request-tmp`.
- Content: A comma-separated, UTF-8 string containing: The requester's VeraId (e.g., `alice@applepie.rocks`), the intended contact's VeraId (e.g., `bob@tickety.boo`) and the requester's Awala endpoint public key (base64-encoded). For example:
  
  ```
  alice@applepie.rocks,bob@tickety.boo,<requester's base64-encoded endpoint key>
  ```

The following pseudocode illustrates how to generate the message content above using the Android SDK:

```kotlin
fun generatePairingRequest(
    requesterVeraId: String,
    contactVeraId: String,
    requesterEndpoint: FirstPartyEndpoint
): ByteArray {
    val publicKey = requesterEndpoint.publicKey
    val publicKeyBase64 = Base64.encodeToString(publicKey.encoded, Base64.NO_WRAP)
    val content = "$requesterVeraId,$contactVeraId,$publicKeyBase64"
    return content.toByteArray()
}
```

### Contact pairing match

This message signifies that there's a match for a previous [pairing request](#contact-pairing).

- Recipient: Letro user agent.
- Content type: `application/vnd.relaycorp.letro.pairing-match-tmp`.
- Content: A comma-separated, UTF-8 string containing: the requester's VeraId (e.g., `alice@applepie.rocks`), the contact's VeraId (e.g., `bob@tickety.boo`), the contact's Awala endpoint id (e.g., `055be8417a3d1dad19799e66596ac085fd5c68f0b1dbd9bfea5e39c072dd3cf88`) and the contact's Awala endpoint public key (base64-encoded). For example (whitespace for readability purposes only):
  
  ```
  alice@applepie.rocks,
  bob@tickety.boo,
  055be8417a3d1dad19799e66596ac085fd5c68f0b1dbd9bfea5e39c072dd3cf88,
  <contact's base64-encoded endpoint key>
  ```

The following pseudocode illustrates how to parse the message content above using the Android SDK:

```kotlin
data class PairingMatch(
    val requesterVeraId: String,
    val contactVeraId: String,
    val contactEndpointId: String,
    val contactEndpointPublicKey: ByteArray
)

fun parsePairingMatch(content: ByteArray): PairingMatch {
    val contentString = content.toString(Charset.defaultCharset())
    val parts = contentString.split(",")
    return PairingMatch(
        requesterVeraId = parts[0],
        contactVeraId = parts[1],
        contactEndpointId = parts[2],
        contactEndpointPublicKey = Base64.decode(parts[3], Base64.NO_WRAP)
    )
}
```

### Contact pairing authorisation

This message encapsulates the Awala _connection parameters_ whereby a Letro user (the granter) authorises another user (the grantee) to message them.

- Recipient: Letro server.
- Content type: `application/vnd.relaycorp.letro.pairing-auth-tmp`.
- Content: An Awala endpoint's connection parameters binary. For example, the output from `FirstPartyEndpoint.authorizeIndefinitely()` in the Awala Android SDK.

Building on the pseudocode from the [pairing match](#contact-pairing-match) section, the following pseudocode illustrates how to generate the message content above using the Android SDK:

```kotlin
fun processPairingAuth(
    match: PairingMatch,
    firstPartyEndpoint: FirstPartyEndpoint,
): ByteArray {
    checkContactRequestExists(match.requesterVeraId, match.contactVeraId)
    val auth = firstPartyEndpoint.authorizeIndefinitely(
        match.contactEndpointPublicKey,
    )
    storeContactAwalaId(
        match.requesterVeraId,
        match.contactVeraId,
        match.contactEndpointId,
    )
    return auth
}
```

### Contact pairing completion

This message signifies the completion of one of the two sides of the pairing process. The server will send this message to the grantee of an [authorisation](#contact-pairing-authorisation).

- Recipient: Letro user agent.
- Content type: `application/vnd.relaycorp.letro.pairing-completion-tmp`.
- Content: A comma-separated, UTF-8 string containing: The granter's Awala endpoint id (e.g., `055be8417a3d1dad19799e66596ac085fd5c68f0b1dbd9bfea5e39c072dd3cf88`) and the respective connection parameters from the [authorisation](#contact-pairing-authorisation) message (base64-encoded). For example (whitespace for readability purposes only):

  ```
  055be8417a3d1dad19799e66596ac085fd5c68f0b1dbd9bfea5e39c072dd3cf88,
  <connection parameters, base64-encoded>
  ```
