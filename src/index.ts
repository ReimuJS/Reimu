import Server from "./Server";

export { Server };

export const closeCodes = {
  1000: "General client failure",
  1001: "Client closed",
  2000: "General server failure",
  2001: "Server closed",
  3000: "No response",
  3001: "Protocol violation",
};
