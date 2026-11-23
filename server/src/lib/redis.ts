import Redis from "ioredis";

function getRedisOptions() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error("REDIS_URL must use the redis:// or rediss:// scheme");
    }

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  return {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  };
}

const redisOptions = getRedisOptions();

export const pub = new Redis(redisOptions);
export const sub = pub.duplicate();

export const redisConnection = redisOptions;
console.log("REDIS_HOST:", process.env.REDIS_HOST);
pub.on("connect", () => console.log("Redis pub connected"));
pub.on("error", (err) => console.log("Redis pub error:", err));
sub.on("connect", () => console.log("Redis sub connected"));
sub.on("error", (err) => console.log("Redis sub error:", err));
