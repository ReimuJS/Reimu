import Server from "./Server";
import Connection from "./connection/Connection";
import Message from "./connection/Message";

export { Server, Connection, Message };

export interface DecodedMessage {
  id: number;
  type: string;
  data: any;
  system: boolean;
}
