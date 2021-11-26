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
  let replyHandlers: { id: number; handler: (message: any) => any }[] = [];

  let acknoledgeList: {
    in: {
      [rawTypes.UDATA]: number[];
      [rawTypes.URES]: number[];
    };
    out: {
      [rawTypes.UDATA]: number[];
      [rawTypes.URES]: number[];
    };
  } = {
    in: {
      [rawTypes.UDATA]: [],
      [rawTypes.URES]: [],
    },
    out: {
      [rawTypes.UDATA]: [],
      [rawTypes.URES]: [],
    },
  };

  return {
    ws,

    id: cuid(),
    disconnected: -1,
    expectedClose: false,

    acknoledgeList,

    currentMessageId,

    awaitingData,
    replyHandlers,

    sendRaw,

    send: (data, onReply) => {
      const id = currentMessageId++;
      const message = Buffer.concat([
        Buffer.from([rawTypes.UDATA]),
        numToHex(id),
        pack(data),
      ]);
      sendRaw(message);

      acknoledgeList.out[rawTypes.UDATA].push(id);

      onReply && replyHandlers.push({ id, handler: onReply });
    },

    reply: (originalMessage, data) => {
      const message = Buffer.concat([
        Buffer.from([rawTypes.URES]),
        numToHex(originalMessage.id),
        pack(data),
      ]);
      sendRaw(message);

      acknoledgeList.out[rawTypes.UDATA].push(originalMessage.id);
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

  /** List of outgoing ids waiting to be acknoledged and inboung ids already acknoledged. */
  acknoledgeList: {
    in: Record<rawTypes.UDATA | rawTypes.URES, number[]>;
    out: Record<rawTypes.UDATA | rawTypes.URES, number[]>;
  };
  /** Array of bufferred data awaiting backpressure to be drained . */
  awaitingData: Buffer;
  /** Array of reply handlers. */
  replyHandlers: { id: number; handler: (message: any) => any }[];

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
