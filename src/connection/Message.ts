import msgpack, { decode } from "msgpack-lite";
import WebSocket from "ws";
import Connection from "./Connection";

export default class Message {
  /**
   * The Message Class
   * @constructor
   */
  constructor(data: WebSocket.Data, connection: Connection) {
    this.connection = connection;

    let decoded: any;
    try {
      if (typeof data == "string") {
        connection.disconnect(3001);
        return;
      }
      decoded = msgpack.decode(new Uint8Array(data as ArrayBufferLike));
    } catch (e) {
      connection.disconnect(3001);
    }
    if (!decoded) return;

    if (!decoded.type) {
      connection.disconnect(3001);
      return;
    }

    this.data = decoded.data;

    if (decoded.id == undefined) {
      if (!decoded.for) {
        connection.disconnect(3001);
        return;
      }
      this.id = decoded.for;

      switch (decoded.type) {
        case "acknoledge":
          // TODO: Remove packet from list droppedPackets / awaitSystem
          break;

        default:
          connection.disconnect(3001);
          break;
      }

      const initialMessage = connection.awaitCallback.find(
        (data) => data.id == decoded.replyFor
      );

      if (!initialMessage) return;
      switch (decoded.type) {
        case "acknoledge":
          if (initialMessage.callback.type != "acknoledge") return;
          initialMessage.callback.cb();
          break;
        case "response":
          if (initialMessage.callback.type != "response") return;
          initialMessage.callback.cb(this);
          break;

        default:
          connection.disconnect(3001);
          return;
      }
    } else {
    }

    this.id = decoded.id;

    switch (decoded.type) {
      case "message":
        connection.emit("message", decoded.data);
        break;

      default:
        connection.disconnect(3001);
        return;
    }
  }

  // Variables

  private connection!: Connection;

  /**
   * The message id
   * @type {number}
   * @readonly
   */
  public id!: number;

  /**
   * The message data
   * @type {any}
   */
  public data: any;

  // Functions

  /**
   * Responds to the message.
   * @param {any} data - Data to be sent
   * @returns {void}
   */
  public respond(data: any): void {
    this.connection.respond(data, this);
  }
}
