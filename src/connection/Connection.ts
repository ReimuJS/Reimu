import cuid from "cuid";
import { RecognizedString, WebSocket } from "uWebSockets.js";
import { Message } from "../message/Message";
import { numToHex, rawTypes } from "../index";
import { pack } from "msgpackr";

export default function createConnection<MessageType>(
  ws: WebSocket
): Connection<MessageType> {
  let currentMessageId = 0;

  let awaitingData: Buffer[] = [];

  let disconnected: number = -1;

  function sendRaw(packedMessage: Buffer, publish?: RecognizedString) {
    if (disconnected === -1 && ws.getBufferedAmount() < 512) {
      publish
        ? ws.publish(publish, packedMessage, true)
        : ws.send(packedMessage, true);
    } else {
      packedMessage[0] != rawTypes.USDATA &&
        !publish &&
        awaitingData.push(packedMessage);
    }
  }
  let replyHandlers: { id: number; handler: (message: any) => any }[] = [];

  let acknoledgeList: {
    in: {
      [rawTypes.UDATA]: number[];
      [rawTypes.URES]: number[];
    };
    out: {
      [rawTypes.UDATA]: { id: number; data: Buffer }[];
      [rawTypes.URES]: { id: number; data: Buffer }[];
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
    disconnected,
    expectedClose: false,
    mayReconnect: true,

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

      acknoledgeList.out[rawTypes.UDATA].push({ id, data: message });

      onReply && replyHandlers.push({ id, handler: onReply });
    },

    stream: (data, publish) => {
      const message = Buffer.concat([
        Buffer.from([rawTypes.USDATA]),
        pack(data),
      ]);
      sendRaw(message, publish);
    },

    reply: (originalMessage, data) => {
      const message = Buffer.concat([
        Buffer.from([rawTypes.URES]),
        numToHex(originalMessage.id),
        pack(data),
      ]);
      sendRaw(message);

      acknoledgeList.out[rawTypes.URES].push({
        id: originalMessage.id,
        data: message,
      });
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
  /** If the client is allowed to reconnect (if ws was not closed normally). */
  mayReconnect: boolean;
  /** If the server expected this to close (aka server closed it). */
  expectedClose: boolean;

  /** List of outgoing ids waiting to be acknoledged and inboung ids already acknoledged. */
  acknoledgeList: {
    in: Record<rawTypes.UDATA | rawTypes.URES, number[]>;
    out: Record<rawTypes.UDATA | rawTypes.URES, { id: number; data: Buffer }[]>;
  };
  /** Arrayed of buffered data awaiting backpressure to be drained . */
  awaitingData: Buffer[];
  /** Array of reply handlers. */
  replyHandlers: { id: number; handler: (message: any) => any }[];

  /** The current Message id. */
  currentMessageId: number;

  /** Sends a raw message. */
  sendRaw: (packedMessage: Buffer, publish?: string) => void;
  /** Send a message. */
  send: (data: any, onReply?: (message: any) => any) => void;
  /** Send a stream message (message that isn't always expected to be recieved). */
  stream: (data: any, publish?: RecognizedString) => void;
  /** Send a reply. */
  reply(originalMessage: Message<MessageType>, data: any): void;

  /** Arbitrary user data may be attached to this object. */
  [key: string]: any;
}
