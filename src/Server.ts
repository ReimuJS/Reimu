import EventEmitter from "events";
import WebSocket from "ws";
import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";
import fs from "fs";

const client = fs.readFileSync(`${__dirname}/../client.js`);

export default class Server extends EventEmitter {
  /**
   * The Server Class
   * @constructor
   */
  constructor(options: {
    server: HTTPServer | HTTPSServer;
    path?: string;
    serveClient?: boolean;
  }) {
    super();

    this.path = options.path || "/reimu";
    this.serveClient = options.serveClient || true;

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
   * Whether or not to serve the client files
   * @type {boolean}
   * @readonly
   */
  public serveClient!: boolean;

  /**
   * The HTTP(S) server the WebSocket is connected to
   * @type {HTTPServer | HTTPSServer}
   * @readonly
   */
  public server!: HTTPServer | HTTPSServer;

  // Functions

  /**
   * Upgrade Listener
   * @param {any} request
   * @param {any} socket
   * @param {any} head
   * @returns {Promise<void>}
   */
  private listener = async (
    request: any,
    socket: any,
    head: any
  ): Promise<void> => {
    const pathname = request.url;

    if (pathname === this.path && this.ws) {
      this.ws.handleUpgrade(request, socket, head, (ws) => {
        ws.on("message", (data) => {});
      });
    }
  };

  /**
   * Request Handler
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  private requestHandler = async (req: any, res: any): Promise<void> => {
    if (req.url.startsWith(`${this.path}/reimu.js`)) {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(client);
    }
  };

  /**
   * Starts listening for connections
   * @returns {void}
   */
  public start(): void {
    this.server.on("upgrade", this.listener);
    this.ws = new WebSocket.Server({ noServer: true });
    this.server.on("request", this.requestHandler);
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
    this.server.off("request", this.requestHandler);
  }
}

export default interface WebSocketManager {
  /**
   * Emitted when the WebSocket closed
   */
  on(event: "close", callback: () => void): this;
}
