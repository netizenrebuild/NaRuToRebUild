import http from "node:http";
import { handler } from "./src/app.js";

const port = Number(process.env.PORT || 7000);
http.createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(`Naruto Rebuild RD Library setup: http://localhost:${port}/configure`);
});
