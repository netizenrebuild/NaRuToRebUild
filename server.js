import http from "node:http";
import handler from "./api/index.js";

const port = Number(process.env.PORT || 7000);
http.createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(`Naruto Rebuild Debrid setup: http://localhost:${port}/configure`);
});
