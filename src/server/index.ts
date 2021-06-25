import WebSocketManager from "./websocket/WebSocketManager";
import { Server as HTTPServer } from "http";
import { Server as HTTPSServer } from "https";

export interface WebSocketManagerOptions {
  port?: number;
  server?: HTTPServer | HTTPSServer;
  noServer?: boolean;
}

export default WebSocketManager;
