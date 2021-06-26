import EventEmitter from "events";
import WebSocket from "ws";
import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";

export default class WebSocketManager extends EventEmitter {
  /**
   * The WebSocketManager Class
   * @constructor
   */
  constructor(options: { server: HTTPServer | HTTPSServer; path?: string }) {
    super();

    !options.path ? (this.path = "/reimu") : (this.path = options.path);
    this.server = options.server;

    this.start();
  }

  // Variables

  /**
   * The WebSocket server
   * @type {WebSocket.Server}
   * @optional
   */
  public ws?: WebSocket.Server;

  /**
   * The path for the WebSocket
   * @type {string}
   */
  public path: string;

  /**
   * The HTTP(S) server the WebSocket is connected to
   * @type {HTTPServer | HTTPSServer}
   */
  public server!: HTTPServer | HTTPSServer;

  // Functions

  /**
   * Upgrade Listener
   * @param {any} request
   * @param {any} socket
   * @param {any} head
   * @returns {void}
   */
  private listener = async (
    request: any,
    socket: any,
    head: any
  ): Promise<void> => {
    const pathname = request.url;

    console.log(pathname, this.path, this.ws);
    if (pathname === this.path && this.ws) {
      this.ws.handleUpgrade(request, socket, head, (ws) => {
        ws.send("test");

        ws.on("message", (data) => {});
      });
    }
  };

  /**
   * Starts listening for connections
   * @returns {void}
   */
  public start(): void {
    this.server.on("upgrade", this.listener);
    this.ws = new WebSocket.Server({ noServer: true });
  }

  /**
   * Stops listening for connections
   * @returns {void}
   */
  public close(): void {
    this.server.off("upgrade", this.listener);
    this.ws?.close(() => {
      this.emit("close");
    });
    this.ws = undefined;
  }
}

export default interface WebSocketManager {
  /**
   * Emitted when the WebSocket closed
   */
  on(event: "close", callback: () => void): this;
}
