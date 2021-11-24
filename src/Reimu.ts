import { WebSocketBehavior, CompressOptions } from "uWebSockets.js";
import { closeReason } from ".";
import createConnection, { Connection } from "./connection/Connection";
import createMessage, { Message } from "./message/Message";
import cuid from "cuid";

export default function <MessageType, ReplyType>(
  options: Partial<options<MessageType, ReplyType>>
): WebSocketBehavior {
  const opts: options<MessageType, ReplyType> = {
    reconnectTimeout: 40,
    pruneStaleConnection: 60,
    ...options,
  };

  const connections: Connection<MessageType, ReplyType>[] = [];

  return {
    compression: opts.compression,

    message: (ws, raw) => {
      if (!ws.conn) {
        // No Connection Assigned
        const message = Buffer.from(raw).toString();

        if (message == "hello") {
          // Create Connection
          connections.push(createConnection(ws));
        } else {
          if (cuid.isCuid(message)) {
            // Check for existing connections
            const found = connections.find(
              (conn) => conn.id == message && conn.disconnected
            );

            if (
              found &&
              new Date().getTime() - found.disconnected <
                opts.reconnectTimeout * 1000
            ) {
              ws.conn = found;
              found.disconnected = -1;
              if (opts.reconnect) opts.reconnect(found);
              return;
            }
          }

          return ws.end(1002, "Invalid ID");
        }
      } else {
        // Connection Assigned
        if (opts.message) {
          const message = createMessage<MessageType, ReplyType>(ws.conn, raw);
          opts.message(ws.conn, message);
        }
      }
    },
    close: (ws, code, message) => {
      switch (code) {
        case 1006:
          ws.conn.disconnected = new Date().getTime();
          options.disconnect && options.disconnect(ws.conn);
          break;
      }
    },
  };
}

export interface options<MessageType, ReplyType> {
  /** Maximum time in seconds that a client can be disconnected before it will no longer be allowed to reconnect. Defaults to 40. */
  reconnectTimeout: number;
  /** Time in seconds to check for stale connections and prune them. Defaults to 60. */
  pruneStaleConnection: number;

  /** Handler for new Connection. */
  open?: (connection: Connection<MessageType, ReplyType>) => any;
  /** Handler for new Message. */
  message?: (
    connection: Connection<MessageType, ReplyType>,
    message: Message<MessageType>
  ) => any;
  /** Handler for disconnection due to ping timeout (reconnects still allowed). */
  disconnect?: (connection: Connection<MessageType, ReplyType>) => any;
  /** Handler for reconnection. */
  reconnect?: (connection: Connection<MessageType, ReplyType>) => any;
  /** Handler for close event. */
  close?: (
    connection: Connection<MessageType, ReplyType>,
    reason: closeReason
  ) => any;

  /** What permessage-deflate compression to use. uWS.DISABLED, uWS.SHARED_COMPRESSOR or any of the uWS.DEDICATED_COMPRESSOR_xxxKB. Defaults to uWS.DISABLED. */
  compression?: CompressOptions;
}
