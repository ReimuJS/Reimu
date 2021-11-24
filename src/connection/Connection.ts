import cuid from "cuid";
import { WebSocket } from "uWebSockets.js";
import { Message } from "../message/Message";
import { rawTypes } from "../index";
import { pack } from "msgpackr";

export default function createConnection<MessageType, ReplyType>(
  ws: WebSocket
): Connection<MessageType, ReplyType> {
  let currentMessageId = 0;

  function sendRaw(packedMessage: Buffer) {
    ws.send(packedMessage, true);
  }
  let onReplyList: ((message: ReplyType) => any)[] = [];

  return {
    id: cuid(),
    disconnected: -1,
    currentMessageId,

    send: (data, onReply) => {
      const message = {
        id: currentMessageId++,
        type: rawTypes.UDATA,
        data,
      };
      sendRaw(pack(message));

      onReply && onReplyList.push(onReply);
    },

    reply: (originalMessage, data) => {
      const message = {
        id: originalMessage.id,
        type: rawTypes.URES,
        data,
      };
      sendRaw(pack(message));
    },
  };
}

export interface Connection<MessageType, ReplyType> {
  /** The connection id. */
  id: string;
  /** Unix time value (or -1 if connected). */
  disconnected: number;

  /** The current Message id. */
  currentMessageId: number;

  /** Send a message. */
  send: (data: MessageType, onReply?: (message: ReplyType) => any) => void;
  /** Send a reply. */
  reply(originalMessage: Message<MessageType>, data: any): void;

  /** Arbitrary user data may be attached to this object. */
  [key: string]: any;
}
