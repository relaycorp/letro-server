import { index, modelOptions, prop } from '@typegoose/typegoose';
import { secondsInDay } from 'date-fns';

const TTL_DAYS = 90;
const TTL_SECONDS = secondsInDay * TTL_DAYS;

@index({ requesterId: 1, targetId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { timestamps: { createdAt: 'creationDate', updatedAt: false } } })
@index({ creationDate: 1 }, { expireAfterSeconds: TTL_SECONDS })
export class ContactPairingRequest {
  /**
   * The VeraId of the requester (e.g., `alice@example.com`).
   */
  @prop({ required: true })
  public requesterId!: string;

  /**
   * The VeraId of the target (e.g., `bob@example.com`).
   */
  @prop({ required: true })
  public targetId!: string;

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
}
