import Server from "./Server";
import Connection from "./connection/Connection";
import Message from "./connection/Message";

export { Server, Connection, Message };

export interface DecodedMessage {
  id: number;
  type: string;
  data: any;
}

export const closeCodes = {
  1000: "General client failure",
  1001: "Client closed",
  2000: "General server failure",
  2001: "Server closed",
  3000: "No response",
  3001: "Protocol violation",
};
