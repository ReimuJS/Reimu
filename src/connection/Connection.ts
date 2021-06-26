import EventEmitter from "events";
import msgpack from "msgpack-lite";
import WebSocket from "ws";

export default class Connection extends EventEmitter {
  /**
   * The Connection Class
   * @constructor
   */
  constructor(ws: WebSocket) {
    super();

    this.ws = ws;
    this.messageId = 0;
  }

  // Variables

  private ws;
  private messageId: number;

  // Functions

  private sendRaw = async (data: any) => {
    const dataEncoded = msgpack.encode(data);
    this.ws?.send(dataEncoded);
  };

  /**
   * Sends data to the server
   * @param {any} data - Data to be sent
   * @returns {void}
   */
  public send(data: any): void {
    this.sendRaw({ id: this.messageId++, type: "message", data });
  }
}
