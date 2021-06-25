import EventEmitter from "events";
import WebSocket from "ws";
import { WebSocketManagerOptions } from "..";

export default class WebSocketManager extends EventEmitter {
  constructor({ port, server, noServer }: WebSocketManagerOptions) {
    super();

    this.ws = new WebSocket.Server({ port, server, noServer });
  }

  /**
   * The WebSocket server
   * @type {WebSocket.Server}
   * @readonly
   */
  public ws!: WebSocket.Server;
}
