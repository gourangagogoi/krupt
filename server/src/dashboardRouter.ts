import { Router } from "express";
import { Queue } from "bullmq";
import { redisConnection } from "./lib/redis";
import { getEventsForJob } from "./eventLog";
import { prisma } from "./lib/prisma";

const router = Router();
const queue = new Queue("incoming-requests", { connection: redisConnection });

router.get("/dashboard", async (req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  res.json({ waiting, active, completed, failed });
});

router.get("/jobs", async (req, res) => {
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(0, 20),
    queue.getFailed(0, 20),
  ]);

  const format = (jobs: any[], status: string) =>
    jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }));
  res.json([
    ...format(waiting, "waiting"),
    ...format(active, "active"),
    ...format(completed, "completed"),
    ...format(failed, "failed"),
  ]);
});

router.get("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const job = await queue.getJob(id);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const state = await job.getState();
  const events = getEventsForJob(id);

  res.json({
    id,
    name: job.name,
    data: job.data,
    state,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    returnvalue: job.returnvalue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    events,
  });
});
router.get("/jobs/:id/logs", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const events = getEventsForJob(req.params.id);
  const result = [...events].reverse().slice(0, limit);
  res.json(result);
});

router.get("/requests", async (req, res) => {
  const requests = await prisma.webhookEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      method: true,
      headers: true,
      payload: true,
      createdAt: true,
    },
  });
  res.json(requests);
});

router.get("/requests/:id", async (req, res) => {
  const request = await prisma.webhookEvent.findUnique({
    where: { id: req.params.id },
  });
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.json(request);
});

export default router;
