import Redis from "ioredis";

export const pub = new Redis({ host: "localhost", port: 6379 });
export const sub = pub.duplicate();

export const redisConnection = {
  host: "localhost",
  port: 6379,
};

pub.on("connect", () => console.log("Redis pub connected"));
pub.on("error", (err) => console.log("Redis pub error:", err.message));
sub.on("connect", () => console.log("Redis sub connected"));
sub.on("error", (err) => console.log("Redis sub error:", err.message));
