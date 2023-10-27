import { index, modelOptions, prop } from '@typegoose/typegoose';
import { secondsInDay } from 'date-fns';

const TTL_DAYS = 90;
const TTL_SECONDS = secondsInDay * TTL_DAYS;

@modelOptions({ schemaOptions: { timestamps: { createdAt: 'creationDate', updatedAt: false } } })
@index({ requesterVeraId: 1, targetVeraId: 1 }, { unique: true })
@index({ creationDate: 1 }, { expireAfterSeconds: TTL_SECONDS })
export class ContactPairingRequest {
  /**
   * The VeraId of the requester (e.g., `alice@example.com`).
   */
  @prop({ required: true })
  public requesterVeraId!: string;

  /**
   * The VeraId of the target (e.g., `bob@example.com`).
   */
  @prop({ required: true })
  public targetVeraId!: string;

  /**
   * The requester's Awala endpoint id.
   */
  @prop({ required: true })
  public requesterEndpointId!: string;

  /**
   * The requester's Awala endpoint id key.
   */
  @prop({ required: true })
  public requesterIdKey!: Buffer;

  /**
   * The VeraId Signature Bundle that encapsulates the contact pairing request from the requester.
   */
  @prop()
  public signatureBundle?: Buffer;
}
