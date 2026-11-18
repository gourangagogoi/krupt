import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { rawBodyMiddleware } from "./middleware/rawBody";
import { captureRouter } from "./routes/capture";
import { sessionRouter } from "./routes/session.router";
import { setupSocket, wireSessionJobEvents } from "./socket/index";
import "./types";
import "dotenv/config";
import { createAdapter } from "@socket.io/redis-adapter";
import { pub, sub } from "./lib/redis";
import { setIO } from "./lib/io";
import "./lib/worker";
import "./events/queueEvents";
import dashboardRouter from "./dashboardRouter";
import cors from "cors";


console.log("PORT env:", process.env.PORT);

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2*60*1000,
    skipMiddlewares: true
  },
  cors: { origin: "*" },
  adapter: createAdapter(pub, sub),
  
});

setIO(io);

app.use(rawBodyMiddleware);
app.use(express.json());
app.use(captureRouter);
app.use(sessionRouter);
app.use(dashboardRouter);

wireSessionJobEvents(io);
setupSocket(io);

const PORT = process.env.PORT ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});
