const uws = require("uWebSockets.js");
const { Reimu } = require("../dist/index");

const t = uws
  .App()
  .ws(
    "/*",
    Reimu({
      open: (ws) => {
        ws.send("testMessage", (message) => {
          console.log(message);
        });
      },
      message: (ws, message) => {
        console.log(message);
        message.reply("testReply");
      },
      close: (ws) => {
        console.log("close");
      },
      disconnect: (ws) => {
        console.log("disconnect");
      },
    })
  )
  .listen(3000, () => {});
