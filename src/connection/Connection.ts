import cuid from "cuid";
import { WebSocket } from "uWebSockets.js";
import { Message } from "../message/Message";
import { rawTypes } from "../index";
import { pack } from "msgpackr";

function numToHex(num: number): Buffer {
  const numHex = Buffer.from(num.toString(16), "hex");
  return Buffer.concat([Buffer.from([numHex.length - 1]), numHex]);
}

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
      const message = Buffer.concat([
        Buffer.from([rawTypes.UDATA]),
        numToHex(currentMessageId++),
        pack(data),
      ]);
      sendRaw(message);

      onReply && onReplyList.push(onReply);
    },

    reply: (originalMessage, data) => {
      const message = Buffer.concat([
        Buffer.from([rawTypes.URES]),
        numToHex(originalMessage.id),
        pack(data),
      ]);
      sendRaw(message);
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
