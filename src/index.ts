import Reimu, { options } from "./Reimu";
import Connection from "./connection/Connection";

export { Reimu, options, Connection };

export interface DecodedMessage<MessageTypes> {
  id: number;
  type: rawTypes;
  data: MessageTypes;
}

export enum rawTypes {
  ACK,
  UDATA,
  URES,
}

export enum closeReason {}
