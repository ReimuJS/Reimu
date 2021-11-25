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
  UBUF,
}

export enum closeReason {}

export function numToHex(num: number): Buffer {
  let hex = num.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }
  const numHex = Buffer.from(hex, "hex");
  return Buffer.concat([Buffer.from([numHex.length - 1]), numHex]);
}
