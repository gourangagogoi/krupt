import { UnrecoverableError, Worker } from "bullmq";
import { redisConnection } from "./redis";
import { dlq } from "./queue";
import { prisma } from "./prisma";

const worker = new Worker(
  "incoming-requests",
  async (job) => {
    const { captured } = job.data;

    if (!captured || !captured.token) {
      throw new UnrecoverableError("Invalid payload: missing token");
    }

    await prisma.webhookEvent.update({
      where: { id: captured.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  },
  { connection: redisConnection },
);

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed.`);
});

worker.on("failed", async (job, err) => {
  if (!job) return;

  console.error(`Job ${job.id} failed: ${err.message}`);

  if (
    job.attemptsMade >= (job.opts.attempts ?? 1) ||
    err instanceof UnrecoverableError
  ) {
    await dlq.add(
      "failed-event",
      {
        originalJobId: job.id,
        data: job.data,
        failedReason: err.message,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: false },
    );
    console.log(`Moved job ${job.id} to DLQ`);
  }
});

console.log("[worker] started, waiting for jobs...");
