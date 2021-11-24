import { Connection } from "../connection/Connection";
import { unpack } from "msgpackr";

export default function createMessage<MessageType, ReplyType>(
  connection: Connection<MessageType, ReplyType>,
  rawMessage: ArrayBuffer
): Message<MessageType> {
  const messageUnpacked = unpack(Buffer.from(rawMessage));
  const message: Message<MessageType> = {
    id: messageUnpacked.id,
    data: messageUnpacked.data,

    reply: (reply: any) => {
      connection.reply(message, reply);
    },
  };
  return message;
}

export interface Message<MessageType> {
  /** An incrementing id. */
  id: number;

  /** The message data. */
  data: MessageType;

  /** Reply to the message. */
  reply: (reply: any) => void;

  /** Arbitrary user data may be attached to this object */
  [key: string]: any;
}
