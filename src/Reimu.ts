import { WebSocketBehavior, CompressOptions, WebSocket } from "uWebSockets.js";
import { numToHex, rawTypes } from ".";
import createConnection, { Connection } from "./connection/Connection";
import createMessage, { Message } from "./message/Message";
import cuid from "cuid";
import { decodeRawMessage, messageDecoded } from "./message";
import { unpack } from "msgpackr";

export default function <MessageType>(
  options: Partial<options<MessageType>>
): WebSocketBehavior {
  const opts: options<MessageType> = {
    reconnectTimeout: 40,
    pruneStaleConnection: 60,
    ...options,
  };

  const connections: Connection<MessageType>[] = [];

  setInterval(() => {
    connections.forEach((connection) => {
      if (Date.now() - connection.disconnected > opts.reconnectTimeout * 1000) {
        connections.splice(connections.indexOf(connection), 1);
      }
    });
  }, opts.reconnectTimeout);

  return {
    compression: opts.compression,

    message: (ws, raw) => {
      if (!ws.conn) {
        // No Connection Assigned
        const message = Buffer.from(raw).toString();

        if (message == "hello") {
          // Create Connection
          const conn = createConnection(ws);
          ws.conn = conn;
          connections.push(conn);
          ws.send(conn.id);
          opts.open && opts.open(conn);
        } else {
          if (cuid.isCuid(message)) {
            // Check for existing connections
            const found = connections.find(
              (conn) =>
                conn.id == message && conn.disconnected && conn.mayReconnect
            );

            if (
              found &&
              new Date().getTime() - found.disconnected <
                opts.reconnectTimeout * 1000
            ) {
              ws.conn = found;
              found.disconnected = -1;
              ws.send(found.id);
              if (found.awaitingData.length > 1) {
                found.sendRaw(
                  createBufferMessage(
                    found.awaitingData.splice(0, found.awaitingData.length)
                  )
                );
              }
              if (opts.reconnect) opts.reconnect(found);
              return;
            }
          }

          return ws.end(1002, "Invalid ID");
        }
      } else {
        const conn: Connection<MessageType> = ws.conn;
        // Connection Assigned
        const decoded = decodeRawMessage(raw);
        if (Array.isArray(decoded)) {
          let bufferSend: Buffer[] = [];
          decoded.some((message) => {
            try {
              const output = handleMessage(message, ws);
              if (output && bufferSend) {
                bufferSend.push(output);
              }
              return false;
            } catch (e) {
              conn.expectedClose = true;
              ws.end(1002, "Invalid Message");
              return true;
            }
          });
          if (bufferSend.length > 0) {
            conn.sendRaw(createBufferMessage(bufferSend));
          }
        } else {
          try {
            const output = handleMessage(decoded, ws);
            if (output) {
              conn.sendRaw(output);
            }
          } catch (e) {
            conn.expectedClose = true;
            ws.end(1002, "Invalid Message");
          }
        }
      }
    },
    drain: (ws) => {
      if (
        ws.conn &&
        ws.conn.awaitingData.length > 1 &&
        ws.getBufferedAmount() < 512
      ) {
        const conn: Connection<MessageType> = ws.conn;
        conn.sendRaw(
          createBufferMessage(
            conn.awaitingData.splice(0, conn.awaitingData.length)
          )
        );
      }
    },
    close: (ws, code, message) => {
      if (!ws.conn) return;
      ws.conn.disconnected = new Date().getTime();
      switch (code) {
        case 1000:
          ws.conn.mayReconnect = false;
          opts.close && opts.close(ws.conn, message);
          break;
        default:
          opts.disconnect && opts.disconnect(ws.conn, message);
          break;
      }
    },
  };
  function handleMessage(
    decoded: messageDecoded,
    ws: WebSocket
  ): Buffer | void {
    const conn: Connection<MessageType> = ws.conn;
    switch (decoded.type) {
      case rawTypes.ACK:
        {
          const i = conn.acknoledgeList.out[decoded.to].indexOf(decoded.id);
          if (i > -1) {
            conn.acknoledgeList.out[decoded.to].splice(i, 1);
          }
        }
        break;
      case rawTypes.UDATA: {
        if (!conn.acknoledgeList.in[decoded.type].includes(decoded.id)) {
          if (opts.message) {
            const message = createMessage<MessageType>(
              ws.conn,
              decoded.id,
              decoded.data
            );
            opts.message(ws.conn, message);
          }
          conn.acknoledgeList.in[decoded.type].push(decoded.id);
        }
        return createAckMessage(decoded.id, rawTypes.UDATA);
      }
      case rawTypes.URES: {
        if (!conn.acknoledgeList.in[decoded.type].includes(decoded.id)) {
          const replyHandler = conn.replyHandlers.find(
            (r) => r.id == decoded.id
          );
          if (replyHandler) {
            const data = unpack(decoded.data);
            replyHandler.handler(data);
          }
          conn.acknoledgeList.in[decoded.type].push(decoded.id);
        }
        return createAckMessage(decoded.id, rawTypes.URES);
      }
    }
  }
}

function createAckMessage(id: number, to: rawTypes) {
  return Buffer.concat([Buffer.from([rawTypes.ACK, to]), numToHex(id)]);
}

function createBufferMessage(buffers: Buffer[]): Buffer {
  let toConcat = [Buffer.from([rawTypes.UBUF])];
  for (const buffer of buffers) {
    toConcat.push(numToHex(buffer.length));
    toConcat.push(buffer);
  }
  return Buffer.concat(toConcat);
}

export interface options<MessageType> {
  /** Maximum time in seconds that a client can be disconnected before it will no longer be allowed to reconnect. Defaults to 40. */
  reconnectTimeout: number;
  /** Time in seconds to check for stale connections and prune them. Defaults to 60. */
  pruneStaleConnection: number;

  /** Handler for new Connection. */
  open?: (connection: Connection<MessageType>) => any;
  /** Handler for new Message. */
  message?: (
    connection: Connection<MessageType>,
    message: Message<MessageType>
  ) => any;
  /** Handler for disconnection due to ping timeout (reconnects still allowed). */
  disconnect?: (
    connection: Connection<MessageType>,
    reason: ArrayBuffer
  ) => any;
  /** Handler for reconnection. */
  reconnect?: (connection: Connection<MessageType>) => any;
  /** Handler for close event. */
  close?: (connection: Connection<MessageType>, reason: ArrayBuffer) => any;

  /** What permessage-deflate compression to use. uWS.DISABLED, uWS.SHARED_COMPRESSOR or any of the uWS.DEDICATED_COMPRESSOR_xxxKB. Defaults to uWS.DISABLED. */
  compression?: CompressOptions;
}
