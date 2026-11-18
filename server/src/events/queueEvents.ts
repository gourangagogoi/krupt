import { QueueEvents } from "bullmq";
import { redisConnection } from "../lib/redis";
import { recordEvent } from "../eventLog";

export const queueEvents = new QueueEvents("incoming-requests", {
  connection: redisConnection,
});

queueEvents.on("waiting", ({ jobId }) => {
  recordEvent(jobId, "waiting");
});
queueEvents.on("active", ({ jobId, prev }) => {
  recordEvent(jobId, "active", { prev });
});
queueEvents.on("completed", ({ jobId, returnvalue }) => {
  recordEvent(jobId, "completed", { returnvalue });
});
queueEvents.on("failed", ({ jobId, failedReason }) => {
  recordEvent(jobId, "failed", { failedReason });
});
queueEvents.on("retries-exhausted", ({ jobId, attemptsMade }) => {
  recordEvent(jobId, "retries-exhausted", { attemptsMade });
});
