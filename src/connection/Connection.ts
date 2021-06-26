import EventEmitter from "events";
import msgpack from "msgpack-lite";
import WebSocket from "ws";
import uniqid from "uniqid";

export default class Connection extends EventEmitter {
  /**
   * The Connection Class
   * @constructor
   */
  constructor(
    ws: WebSocket,
    droppedPackets: Map<string, any>,
    ordered: boolean
  ) {
    super();

    this.ws = ws;
    this.id = uniqid();
    this.messageId = 0;
    this.connected = false;
    this.ordered = ordered;

    this.ws.on("close", () => {
      this.connected && this.emit("close");
      if (this.droppedPackets.length > 0)
        droppedPackets.set(this.id, this.droppedPackets);
    });

    this.ws.on("message", (data) => {
      let decoded;
      try {
        decoded = msgpack.decode(new Uint8Array(data as ArrayBufferLike));
      } catch (e) {
        this.disconnect(3001);
      }
      if (!decoded) return;

      this.incomingQueue.push(decoded);
    });

    this.sendRaw({
      id: this.messageId++,
      type: "hello",
      data: { id: this.id },
    });
  }

  // Variables

  private ws;
  private messageId: number;
  private droppedPackets: any[] = [];
  private awaitHidden: any[] = [];
  private incomingQueue: any[] = [];
  private ordered: boolean;

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

  // Functions

  private sendRaw = async (data: any, awaitHidden?: boolean) => {
    const dataEncoded = msgpack.encode(data);
    this.ws?.send(dataEncoded);

    if (!awaitHidden) {
      this.droppedPackets.push(data);
    } else {
      this.awaitHidden.push(data);
    }
  };

  private disconnect(code: number) {
    this.connected = false;
    this.sendRaw(
      {
        id: this.messageId++,
        type: "close",
        data: { code },
      },
      true
    );
  }

  /**
   * Sends data to the server
   * @param {any} data - Data to be sent
   * @returns {void}
   */
  public send(data: any): void {
    this.sendRaw({ id: this.messageId++, type: "message", data });
  }
}
