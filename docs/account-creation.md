---
permalink: /account-creation
nav_order: 1
---

# Account creation

This module allows users to create VeraId identifiers under Relaycorp-managed domain names for use in Letro. Such domain names are available for various locales, such as American English (`applepie.rocks`) and Venezuelan Spanish (`guarapo.cafe`), with `nautilus.ink` used as a fallback.

## User name constraints

In addition to the constraints imposed by VeraId (i.e., at signs are not allowed and the name must contain at least one Unicode character), the following constraints are imposed:

- Whitespace is not allowed, and will be removed from the name.
- Upper case characters will be converted to lower case.
- The name must be up to 16 characters long.
- If the name contains reserved words (e.g., "admin", "support", "Relaycorp", "Gus Narea"), the entire name will be replaced with a randomly generated name.
- If the name is already taken, we will create one with a randomly-generated suffix. For example, if `alice@nautilus.ink` is requested but already taken, we will create something like `alice-12345@nautilus.ink`.

## Messages

### Account creation request

This message signifies a Letro user's intention to create a VeraId identifier.

- Recipient: Letro server.
- Content type: `application/vnd.relaycorp.letro.account-request`.
- Content: A DER-serialised `AccountRequestSignature` structure (see below).

The ASN.1 `AccountRequestSignature` structure is defined as follows:

```asn1
AccountRequestSignature ::= SEQUENCE {
  request   [0] AccountRequest,
  signature [1] BIT STRING
}

AccountRequest ::= SEQUENCE {
  userName  [0] VisibleString,       -- E.g., "maria"
  locale    [1] VisibleString,       -- E.g., "es-ve"
  publicKey [2] SubjectPublicKeyInfo -- From the X.509 spec
}
```

`AccountRequestSignature.signature` MUST be the digital signature of the DER-serialised `AccountRequestSignature.request` using the private key corresponding to `AccountRequest.publicKey`.

### Account creation

This message signifies that a VeraId identifier has been created.

- Recipient: Letro user agent.
- Content type: `application/vnd.relaycorp.letro.account-creation`.
- Content: A DER-serialised `AccountCreation` structure (see below).

The ASN.1 `AccountCreation` structure is defined as follows:

```asn1
AccountCreation ::= SEQUENCE {
  requestedUserName [0] VisibleString, -- E.g., "maria"
  locale            [1] VisibleString, -- E.g., "es-ve"
  assignedUserId    [2] VisibleString, -- E.g., "maria@guarapo.cafe"
  veraidBundle      [3] OCTET STRING
```

## Data persistence

We do not store any data related to this module, beyond what's already stored by the [VeraId Authority](https://docs.relaycorp.tech/veraid-authority/) server.
