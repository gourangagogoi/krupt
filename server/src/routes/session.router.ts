import { Router } from "express";
import { getMembers } from "../presence";
import { getDeltasAfter, getJobsForSession } from "../socket/index";
import { requestQueue } from "../lib/queue";
import { pub } from "../lib/redis";
import { VersionedValue } from "../session";

export const sessionRouter = Router();
const router = sessionRouter;

router.get("/:sessionId/state", async (req, res) => {
  const jobs = [];
  const sessionId = req.params.sessionId;
  const members = await getMembers(sessionId);
  const jobIds = getJobsForSession(sessionId);
  for (const jobId of jobIds) {
    const job = await requestQueue.getJob(jobId);
    const status = await job?.getState();
    jobs.push({ jobId, status });
  }
  res.json({
    sessionId,
    members,
    jobs
  });
});

router.get("/:sessionId/events", (req,res)=>{
  const sessionId = req.params.sessionId;
  const after = parseInt(req.query.after as string) || 0;

  const missedDeltas = getDeltasAfter(sessionId, after);
  res.json({sessionId, after, missedDeltas})
})

router.get("/sessions/:sessionId/state", async(req, res)=>{
  const {sessionId} = req.params;
  const prefix = `session:${sessionId}:state:`;
  const keys = await pub.keys(`${prefix}*`);
  const result: Record<string, VersionedValue>= {};

  for(const fullkey of keys){
    const raw = await pub.hgetall(fullkey);
    if(raw.version){
      const slotkey = fullkey.replace(prefix, "")
      // fullkey.slice(prefix.length)
      result[slotkey] = {
        value: raw.value,
        version: parseInt(raw.version,10),
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy
      }
    }
  }
  res.json({ sessionId, state: result });
})
