import Connection from "./Connection";

export default class Message {
  /**
   * The Message Class
   * @constructor
   */
  constructor(message: any, connection: Connection) {
    this.connection = connection;

    if (!message.type) {
      connection.disconnect(1002);
      return;
    }

    if (message.type == "batch") {
      if (!Array.isArray(message.data)) connection.disconnect(1002);
      else {
        for (const msg of message) {
          new Message(msg, connection);
        }
      }
      return;
    }

    this.data = message.data;

    if (message.id == undefined) {
      if (!message.for) {
        connection.disconnect(1002);
        return;
      }
      this.id = message.for;

      switch (message.type) {
        case "acknoledge":
          const droppedPacket = connection.droppedPackets.find(
            (data) => data.id == message.replyFor
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
        (data) => data.id == message.replyFor
      );

      if (!initialMessage) return;
      connection.awaitCallback.splice(
        connection.awaitCallback.indexOf(initialMessage),
        1
      );
      switch (message.type) {
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
      this.id = message.id;

      switch (message.type) {
        case "message":
          connection.emit("message", message.data);
          break;
        case "close":
          connection.close = { code: message.data.code, server: false };
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
