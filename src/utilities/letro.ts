const RELAYCORP_OID = '1.3.6.1.4.1.58708';
export const LETRO_OID = `${RELAYCORP_OID}.2`;

export const RELAYCORP_LETRO_TYPES = {
  ACCOUNT_CREATION: 'application/vnd.relaycorp.letro.account-creation',

  // Connection params retrieval
  CONNECTION_PARAMS_REQUEST: 'application/vnd.relaycorp.letro.connection-params-request',
  CONNECTION_PARAMS: 'application/vnd.relaycorp.letro.connection-params',
  MISCONFIGURED_ENDPOINT: 'application/vnd.relaycorp.letro.misconfigured-internet-endpoint',
};
