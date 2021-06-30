import EventEmitter from "events";
import msgpack from "msgpack-lite";
import WebSocket from "ws";
import uniqid from "uniqid";
import Message from "./Message";
import { DecodedMessage } from "../index";
import Server from "../Server";
import { IncomingMessage } from "http";

export default class Connection extends EventEmitter {
  /**
   * The Connection Class
   * @constructor
   */
  constructor(
    ws: WebSocket,
    droppedPackets: Map<string, DecodedMessage[]>,
    reconnects: Map<string, { reconnects: number; lastReconnect: Date }>,
    server: Server,
    request: IncomingMessage
  ) {
    super();

    this.ws = ws;
    this.id = uniqid();
    this.messageId = 0;
    this.connected = false;
    this.server = server;

    this.ws.on("close", (code) => {
      this.pingTimer && clearInterval(this.pingTimer);
      this.emit("close", this.closeCode || code, !!this.closeCode);
      this.connected = false;
      if (this.droppedPackets.length > 0 && !this.closeCode)
        droppedPackets.set(this.id, this.droppedPackets);
    });

    this.ws.on("message", (data) => {
      new Message(data, this);
    });

    this.sendRaw(
      {
        id: this.messageId++,
        type: "hello",
        data: { id: this.id },
      },
      {
        cb: (data) => {
          if (data.data.id != this.id) {
            this.id = data.data.id;
            let pastReconnects = reconnects.get(this.id) || {
              reconnects: 0,
              lastReconnect: new Date(),
            };

            if (
              new Date().getTime() - pastReconnects.lastReconnect.getTime() >
              server.options.reconnectTimeout
            )
              pastReconnects.reconnects = 0;
            pastReconnects.reconnects++;

            reconnects.set(this.id, pastReconnects);

            // TODO: Send past dropped packets and clear them
          } else {
            server.emit("connect", this, request);
          }
          this.connected = true;
        },
        type: "response",
      },
      true
    );
    this.pingTimer = setInterval(() => {
      this.ping();
    }, 5000);
  }

  // Variables

  private server;
  private pingTimer?: NodeJS.Timeout;
  private ws;
  private closeCode?: number;
  private messageId: number;

  /**
   * The connection id
   * @type {string}
   */
  public id: string;

  /**
   * Whether or not Reimu has managed to successfully connect
   * @type {boolean}
   */
  public connected: boolean;

  /**
   * Packets that haven't been acknoledged
   * @type {DecodedMessage[]}
   */
  public droppedPackets: DecodedMessage[] = [];

  /**
   * Messages that are awaiting callbacks
   * @type {any[]}
   */
  public awaitCallback: {
    id?: number;
    for?: number;
    type: string;
    data: any;
    callback:
      | { cb: (data: Message) => void; type: "response" }
      | { cb: () => void; type: "acknoledge" };
  }[] = [];

  // Functions

  private ping = () => {
    // TODO: Pinging system
  };

  private sendRaw = async (
    data: any,
    callback?:
      | { cb: (data: Message) => void; type: "response" }
      | { cb: () => void; type: "acknoledge" },
    system?: boolean
  ) => {
    const dataEncoded = msgpack.encode(data);
    this.ws?.send(dataEncoded);

    this.droppedPackets.push({ ...data, system: !!system });

    if (!!callback) {
      this.awaitCallback.push({ ...data, callback });
    }
  };

  /**
   * Attempts to disconnect with the user
   * @param {number} code - The error code
   */
  public disconnect(code: number) {
    if (this.closeCode) return;
    this.closeCode = code;
    const mId = this.messageId++;

    const ifNotAcknoledge = setInterval(() => {
      if (this.connected) this.ws.close(code);
    }, 10000);
    this.sendRaw(
      {
        id: mId,
        type: "close",
        data: { code },
      },
      {
        cb: () => {
          clearInterval(ifNotAcknoledge);
          this.ws.close(code);
        },
        type: "acknoledge",
      },
      true
    );
  }

  /**
   * Sends data to the server
   * @param {any} data - Data to be sent
   * @param {Function} [responseCallback] - The callback to use if a response is sent
   * @returns {void | Message}
   */
  public send(data: any, responseCallback?: (data: Message) => void): void {
    const message = { id: this.messageId++, type: "message", data };
    this.sendRaw(
      message,
      responseCallback ? { cb: responseCallback, type: "response" } : undefined
    );
  }

  /**
   * Responds to the message.
   * @param {any} data - Data to be sent
   * @param {Message} message - Message Class
   * @returns {void}
   */
  public respond(data: any, message: Message): void {
    this.sendRaw({ for: message.id, type: "response", data });
  }
}

export default interface WebSocketManager {
  /**
   * Emitted when the connection recieves a message
   */
  on(event: "message", callback: (message: Message) => void): this;

  /**
   * Emitted when the connection is closed
   */
  on(event: "close", callback: (code: number, server: boolean) => void): this;
}
