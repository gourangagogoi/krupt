import { Queue } from "bullmq";
import { redisConnection } from "./redis";

export const requestQueue = new Queue("incoming-requests", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const dlq = new Queue("webhook-dlq", { connection: redisConnection });
