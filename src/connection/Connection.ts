import cuid from "cuid";
import { WebSocket } from "uWebSockets.js";
import { Message } from "../message/Message";
import { numToHex, rawTypes } from "../index";
import { pack } from "msgpackr";

export function createBufferMessage(
  starting: Buffer,
  packedMessage: Buffer
): Buffer {
  return Buffer.concat([
    starting,
    numToHex(packedMessage.length - 1),
    packedMessage,
  ]);
}

export default function createConnection<MessageType>(
  ws: WebSocket
): Connection<MessageType> {
  let currentMessageId = 0;

  let awaitingData: Buffer = Buffer.from([rawTypes.UBUF]);

  function sendRaw(packedMessage: Buffer) {
    if (ws.getBufferedAmount() < 512) {
      ws.send(packedMessage, true);
    } else {
      awaitingData = createBufferMessage(awaitingData, packedMessage);
    }
  }
  let replyHandlers: { handler: (message: any) => any }[] = [];

  return {
    ws,

    id: cuid(),
    disconnected: -1,
    expectedClose: false,

    currentMessageId,

    awaitingData,
    replyHandlers,

    sendRaw,

    send: (data, onReply) => {
      const message = Buffer.concat([
        Buffer.from([rawTypes.UDATA]),
        numToHex(currentMessageId++),
        pack(data),
      ]);
      sendRaw(message);

      onReply && replyHandlers.push({ handler: onReply });
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

export interface Connection<MessageType> {
  /** The raw websocket. */
  ws: WebSocket;

  /** The connection id. */
  id: string;
  /** Unix time value (or -1 if connected). */
  disconnected: number;
  /** If the server expected this to close (aka server closed it). */
  expectedClose: boolean;

  /** Array of bufferred data awaiting backpressure to be drained . */
  awaitingData: Buffer;
  /** Array of reply handlers. */
  replyHandlers: { handler: (message: any) => any }[];

  /** The current Message id. */
  currentMessageId: number;

  /** Sends a raw message. */
  sendRaw: (packedMessage: Buffer) => void;
  /** Send a message. */
  send: (data: MessageType, onReply?: (message: any) => any) => void;
  /** Send a reply. */
  reply(originalMessage: Message<MessageType>, data: any): void;

  /** Arbitrary user data may be attached to this object. */
  [key: string]: any;
}
