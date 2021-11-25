import { rawTypes } from "..";

export type messageDecoded =
  | {
      id: number;
      type: rawTypes.UDATA | rawTypes.URES;
      data: Buffer;
    }
  | {
      id: number;
      type: rawTypes.ACK;
    };

export function decodeRawMessage(
  message: ArrayBuffer
): messageDecoded | messageDecoded[] {
  const bufferMessage = Buffer.from(message);
  const type = bufferMessage[0];
  switch (type) {
    case rawTypes.ACK: {
      const id = parseInt(bufferMessage.slice(1).toString("hex"), 16);
      return {
        id,
        type,
      };
    }
    case rawTypes.UBUF: {
      let packets: messageDecoded[] = [];
      for (let nextPacketStart = 1; nextPacketStart >= bufferMessage.length; ) {
        const nextPacketLength1 = bufferMessage[nextPacketStart];
        const nextPacketLength = parseInt(
          bufferMessage
            .slice(nextPacketStart + 1, nextPacketStart + 1 + nextPacketLength1)
            .toString("hex"),
          16
        );
        const nextPacket = bufferMessage.slice(
          nextPacketStart + 2 + nextPacketLength1,
          nextPacketStart + 2 + nextPacketLength1 + nextPacketLength
        );
        const nextPacketDecoded = decodeRawMessage(nextPacket);
        if (Array.isArray(nextPacketDecoded)) {
          packets = packets.concat(nextPacketDecoded);
        } else {
          packets.push(nextPacketDecoded);
        }
      }
      return packets;
    }
    default: {
      const idLength = bufferMessage[1];
      const id = parseInt(
        bufferMessage.slice(2, 3 + idLength).toString("hex"),
        16
      );
      const data = bufferMessage.slice(3 + idLength);
      return {
        id,
        type,
        data,
      };
    }
  }
}
