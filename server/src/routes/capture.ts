import { Request, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { CapturedRequest } from "../types";
import { getIO } from "../lib/io";
import { requestQueue } from "../lib/queue";
export const captureRouter = Router();

captureRouter.all("/in/:token", async (req: Request, res: Response) => {
  const token = req.params.token as string;

  const bodyString =
    req.rawBody && req.rawBody.length > 0
      ? req.rawBody.toString("utf-8")
      : null;

  let parsedBody: object = {};
  try {
    parsedBody = bodyString ? JSON.parse(bodyString) : {};
  } catch {
    parsedBody = { raw: bodyString };
  }

  const event = await prisma.webhookEvent.create({
    data: {
      token,
      payload: parsedBody,
      headers: req.headers as object,
      method: req.method,
    },
  });

  const captured: CapturedRequest = {
    id: event.id,
    token,
    method: req.method,
    path: req.path,
    headers: req.headers as Record<string, string | string[] | undefined>,
    query: req.query as Record<string, string | string[] | undefined>,
    body: bodyString,
    contentType: req.headers["content-type"] ?? null,
    capturedAt: event.createdAt.toISOString(),
    sizeBytes: req.rawBody?.length ?? 0,
  };

  await requestQueue.add(
    "request-captured",
    { captured },
    {
      priority: req.headers["x-priority"]
        ? parseInt(req.headers["x-priority"] as string, 10)
        : undefined,
    },
  );

  getIO().to(`token:${token}`).emit("request:captured", captured);

  res.status(200).json({ ok: true, id: captured.id });
});
