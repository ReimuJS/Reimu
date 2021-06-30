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
        connection.disconnect(1002);
        return;
      }
      decoded = msgpack.decode(new Uint8Array(data as ArrayBufferLike));
    } catch (e) {
      connection.disconnect(1002);
    }
    if (!decoded) return;

    if (!decoded.type) {
      connection.disconnect(1002);
      return;
    }

    this.data = decoded.data;

    if (decoded.id == undefined) {
      if (!decoded.for) {
        connection.disconnect(1002);
        return;
      }
      this.id = decoded.for;

      switch (decoded.type) {
        case "acknoledge":
          const droppedPacket = connection.droppedPackets.find(
            (data) => data.id == decoded.replyFor
          );
          if (!droppedPacket) return;
          connection.droppedPackets.splice(
            connection.droppedPackets.indexOf(droppedPacket),
            1
          );
          break;

        default:
          connection.disconnect(1002);
          break;
      }

      const initialMessage = connection.awaitCallback.find(
        (data) => data.id == decoded.replyFor
      );

      if (!initialMessage) return;
      connection.awaitCallback.splice(
        connection.awaitCallback.indexOf(initialMessage),
        1
      );
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
          connection.disconnect(1002);
          return;
      }
    } else {
      this.id = decoded.id;

      switch (decoded.type) {
        case "message":
          connection.emit("message", decoded.data);
          break;

        default:
          connection.disconnect(1002);
          return;
      }
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
