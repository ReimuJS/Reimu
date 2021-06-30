import EventEmitter from "events";
import WebSocket from "ws";
import { Server as HTTPServer, IncomingMessage, ServerResponse } from "http";
import { Server as HTTPSServer } from "https";
import fs from "fs";
import Connection from "./connection/Connection";
import { DecodedMessage } from ".";

const client = fs.existsSync(`${__dirname}/client.js`)
  ? fs.readFileSync(`${__dirname}/client.js`)
  : false;

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

  private ws?: WebSocket.Server;
  private path: string;
  private serveClient!: boolean;
  private server!: HTTPServer | HTTPSServer;
  private droppedPackets: Map<string, DecodedMessage[]> = new Map();

  // Functions

  private listener = async (
    request: IncomingMessage,
    socket: any,
    head: Buffer
  ): Promise<void> => {
    const pathname = request.url;

    if (pathname === this.path && this.ws) {
      this.ws.handleUpgrade(request, socket, head, async (ws) => {
        const connection = new Connection(ws, this.droppedPackets);
        this.emit("connect", connection, request);
      });
    }
  };

  private requestHandler = async (
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> => {
    if (req.url?.startsWith(`${this.path}/reimu.js`)) {
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
    this.serveClient && this.server.on("request", this.requestHandler);
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
    this.serveClient && this.server.off("request", this.requestHandler);
  }
}

export default interface WebSocketManager {
  /**
   * Emitted when the WebSocket closed
   */
  on(event: "close", callback: () => void): this;

  /**
   * Emitted when the WebSocket closed
   */
  on(
    event: "connect",
    callback: (connection: Connection, request: IncomingMessage) => void
  ): this;
}
