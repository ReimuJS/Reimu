import EventEmitter from "events";
import msgpack from "msgpack-lite";
import WebSocket from "ws";
import uniqid from "uniqid";
import Message from "./Message";
import { closeCodes, DecodedMessage } from "../index";

export default class Connection extends EventEmitter {
  /**
   * The Connection Class
   * @constructor
   */
  constructor(ws: WebSocket, droppedPackets: Map<string, DecodedMessage[]>) {
    super();

    this.ws = ws;
    this.id = uniqid();
    this.messageId = 0;
    this.connected = false;

    this.ws.on("close", () => {
      this.emit("close", this.close);
      this.connected = false;
      if (this.droppedPackets.length > 0)
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
        cb: () => {
          // TODO: check if user sends a resume packet in response
        },
        type: "response",
      },
      true
    );
  }

  // Variables

  private ws;
  private messageId: number;
  private droppedPackets: DecodedMessage[] = [];
  private awaitSystem: DecodedMessage[] = [];
  private close?: { code: number; reason: string };

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
   * Messages that are awaiting callbacks
   * @type {any[]}
   */
  public awaitCallback: {
    id: number;
    type: string;
    data: any;
    callback:
      | { cb: (data: any) => void; type: "response" }
      | { cb: () => void; type: "acknoledge" };
  }[] = [];

  // Functions

  private sendRaw = async (
    data: any,
    callback?:
      | { cb: (data: any) => void; type: "response" }
      | { cb: () => void; type: "acknoledge" },
    system?: boolean
  ) => {
    const dataEncoded = msgpack.encode(data);
    this.ws?.send(dataEncoded);

    if (!system) {
      this.droppedPackets.push(data);
    } else {
      this.awaitSystem.push(data);
    }

    if (!!callback) {
      this.awaitCallback.push({ ...data, callback });
    } else return;
  };

  /**
   * Attempts to disconnect with the user
   * @param {number} code - The error code
   */
  public disconnect(code: number) {
    const mId = this.messageId++;
    this.close = {
      code,
      //@ts-ignore
      reason: closeCodes[code],
    };

    const ifNotAcknoledge = setInterval(() => {
      if (this.connected)
        this.ws.close(
          code,
          //@ts-ignore
          closeCodes[code]
        );
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
          this.ws.close(
            code,
            //@ts-ignore
            closeCodes[code]
          );
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
  public send(data: any, responseCallback?: (data: any) => void): void {
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
   * Emitted when the connection disconnected
   */
  on(event: "disconnect", callback: (fatal: boolean) => void): this;

  /**
   * Emitted when the connection is closed
   */
  on(
    event: "close",
    callback: (code?: { code: number; message: string }) => void
  ): this;
}
