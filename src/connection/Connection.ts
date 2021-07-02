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
    droppedPackets: Map<
      string,
      { connection: Connection; messages: DecodedMessage[] }
    >,
    reconnects: Map<string, { reconnects: number; lastReconnect: Date }>,
    server: Server,
    request: IncomingMessage
  ) {
    super();

    this.ws = ws;
    this.id = uniqid();
    this.dPM = droppedPackets;
    this.messageId = 0;
    this.connected = false;
    this.server = server;

    this.ws.on("close", this.closeListener);
    this.ws.on("message", this.messageListener);

    this.lastContact = { client: new Date(), server: new Date() };

    this.pingTimer = setInterval(() => {
      this.ping();
    }, 500);

    this.sendRaw(
      {
        id: this.messageId++,
        type: "hello",
        data: { id: this.id },
      },
      {
        cb: (data) => {
          if (data.data.id != this.id) {
            const dropped = droppedPackets.get(data.data.id);
            if (!dropped) return this.disconnect(1003);

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
            pastReconnects.lastReconnect = new Date();

            reconnects.set(this.id, pastReconnects);

            this.pingTimer && clearInterval(this.pingTimer);

            this.ws.off("close", this.closeListener);
            this.ws.off("message", this.messageListener);

            this.connected = false;

            dropped.connection.reconnect(this.ws);

            this.sendRaw({ type: "batch", data: dropped.messages });
            droppedPackets.delete(this.id);
          } else {
            server.emit("connect", this, request);
          }
          this.connected = true;
        },
        type: "response",
      },
      true
    );
  }

  // Variables

  private server;
  private pingTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private ws;
  private dPM;
  private messageId: number;

  /**
   * Last sent packet
   */
  public lastContact: { client: Date; server: Date };

  /**
   * Close info
   */
  public close?: { code: number; server: boolean | "unexpected" | "ping" };

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
   * Packets that are being queued
   * @type {DecodedMessage[]}
   */
  public queue: DecodedMessage[] = [];

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

  private closeListener = (code: number) => {
    !this.close && (this.close = { code: code, server: "unexpected" });

    this.readyReconnect();
  };

  private messageListener = (data: WebSocket.Data) => {
    this.lastContact.client = new Date();

    let decoded: any;
    try {
      if (typeof data == "string") {
        this.disconnect(1002);
        return;
      }
      decoded = msgpack.decode(new Uint8Array(data as ArrayBufferLike));
    } catch (e) {
      this.disconnect(1002);
    }

    if (!decoded) return;

    new Message(decoded, this);
  };

  public reconnect = (ws: WebSocket) => {
    this.reconnectTimer && clearTimeout(this.reconnectTimer);

    this.ws = ws;

    this.ws.on("close", this.closeListener);
    this.ws.on("message", this.messageListener);

    this.lastContact = { client: new Date(), server: new Date() };

    this.pingTimer = setInterval(() => {
      this.ping();
    }, 500);
  };

  private readyReconnect = () => {
    if (!this.close) return;

    this.pingTimer && clearInterval(this.pingTimer);

    this.ws.off("close", this.closeListener);
    this.ws.off("message", this.messageListener);

    this.connected = false;

    const filtered = this.droppedPackets.filter((packet) => !packet.system);
    if (
      filtered.length > 0 &&
      this.close &&
      ["unexpected", "ping"].includes(this.close.server.toString())
    ) {
      // Prepare for reconnect
      this.dPM.set(this.id, { connection: this, messages: filtered });

      this.reconnectTimer = setTimeout(() => {
        this.dPM.delete(this.id);
        this.emit("close", this.close?.code, !!this.close?.server);
      }, this.server.options.reconnectTimeout);
    }
  };

  private ping = () => {
    let pingTimeout = this.server.options.pingTimeout;

    if (this.close) {
      return;
    }

    // Safely assume a ping would be sent
    if (
      new Date().getTime() - this.lastContact.server.getTime() >
      pingTimeout / 2
    ) {
      this.sendRaw({ id: this.messageId++, type: "ping" });
    } else {
      // Now, check time between last client send and last server send
      if (
        this.lastContact.server.getTime() - this.lastContact.client.getTime() >
        pingTimeout
      ) {
        this.readyReconnect();
      }
    }
  };

  private sendRaw = async (
    data: any,
    callback?:
      | { cb: (data: Message) => void; type: "response" }
      | { cb: () => void; type: "acknoledge" },
    system?: boolean
  ) => {
    if (data.type != "batch") {
      this.droppedPackets.push({ ...data, system: !!system });

      if (!!callback) {
        this.awaitCallback.push({ ...data, callback });
      }

      if (this.ws.bufferedAmount > 512) {
        this.queue.push({ ...data, system: !!system });
        return;
      }
    }

    if (!this.connected) {
      this.queue.push({ ...data, system: !!system });
      return;
    }

    const dataEncoded = msgpack.encode(data);
    this.lastContact.server = new Date();
    this.ws?.send(dataEncoded);
  };

  /**
   * Attempts to disconnect with the user
   * @param {number} code - The error code
   */
  public disconnect(code: number) {
    if (this.close) return;
    this.close = { code, server: true };
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
   * Responds to the message
   * @param {any} data - Data to be sent
   * @param {Message} message - Message Class
   * @returns {void}
   */
  public respond(data: any, message: Message): void {
    this.sendRaw({ for: message.id, type: "response", data });
  }

  /**
   * Acknoledges the message
   * @param {Message} message - Message Class
   * @returns {void}
   */
  public acknoledge(message: Message): void {
    this.sendRaw({ for: message.id, type: "acknoledge" });
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

  /**
   * Emitted when the connection reconnected
   */
  on(event: "reconnect", callback: () => void): this;

  /**
   * Emitted when the connection is reconnecting
   */
  on(event: "reconnecting", callback: () => void): this;
}
