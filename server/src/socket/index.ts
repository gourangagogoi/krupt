import { Server } from "socket.io";
import { prisma } from "../lib/prisma";
import { joinSession, leaveSession } from "../presence";
import { SessionDelta } from "../delta";
import { queueEvents } from "../events/queueEvents";
import { bulkSetVersionedValues, setVersionedValue } from "../services/stateStore";

const activeSessions = new Map<string, Map<string, string>>();
const jobSession = new Map<string, string>()

let deltaSeq = 0;

interface DeltaEntry {
  id: number;
  sessionId: string;
  delta: SessionDelta;
  at: number
}

const deltaLog: DeltaEntry[] = [];
const DELTA_LOG_MAX = 500;

function broadcastDelta(io: Server, sessionId: string, delta: SessionDelta){
  const id = ++deltaSeq;
  const entry = {id, sessionId, delta, at: Date.now()}
  deltaLog.push(entry);
  if (deltaLog.length > DELTA_LOG_MAX) deltaLog.shift();

  io.to(sessionId).emit("session:delta", {...delta,id})
}

export function wireSessionJobEvents(io: Server){
  queueEvents.on("active", ({jobId})=>{
    const sessionId = jobSession.get(jobId);
    if(!sessionId) return;

    broadcastDelta(io, sessionId, {
      type: "job_status",
      jobId,
      status: "active",
      updatedAt: new Date().toISOString(),
    })
  })

  queueEvents.on("completed", ({ jobId }) => {
    const sessionId = jobSession.get(jobId);
    if (!sessionId) return;
    broadcastDelta(io, sessionId, {
      type: "job_status",
      jobId,
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  });

  queueEvents.on("failed", ({ jobId }) => {
    const sessionId = jobSession.get(jobId);
    if (!sessionId) return;
    broadcastDelta(io, sessionId, {
      type: "job_status",
      jobId,
      status: "failed",
      updatedAt: new Date().toISOString(),
    });
  });
}


export function setupSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log("client connected:", socket.id);

    socket.on("watch:token", async (token: string) => {
      const previousRooms = [...socket.rooms].filter((r) =>
        r.startsWith("token:"),
      );
      previousRooms.forEach((room) => socket.leave(room));

      socket.join(`token:${token}`);
      console.log(`socket ${socket.id} watching token:${token}`);

      const history = await prisma.webhookEvent.findMany({
        where: { token },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      socket.emit("request:history", history.reverse());
    });

    socket.on("session:join",  async(data: {sessionId: string; userId:string})=>{
      const {sessionId, userId} = data;

      await socket.join(sessionId);

      const sessions = activeSessions.get(socket.id) ?? new Map<string, string>();
      const alreadyJoined = sessions.has(sessionId);
      sessions.set(sessionId, userId);
      activeSessions.set(socket.id, sessions);
      const members = await joinSession(sessionId, userId, socket.id);

      socket.emit("session:members", {members})

      if (!alreadyJoined) broadcastDelta(io, sessionId, {
        type: "member_joined",
        userId,
        members,
      })
    })

    socket.on("session:leave", async(data: {sessionId: string, userId: string})=>{
      const {sessionId, userId} = data;

      const sessions = activeSessions.get(socket.id);
      if (sessions?.get(sessionId) !== userId) return;
      await socket.leave(sessionId);
      sessions.delete(sessionId);
      const members = await leaveSession(sessionId, userId, socket.id);

      if (!members.includes(userId)) broadcastDelta(io,sessionId, {
        type: "member_left",
        userId,
        members
      })
    })

    socket.on("session:attach-job", (data: {sessionId: string, jobId: string})=>{
      const {sessionId, jobId} = data;
      jobSession.set(jobId, sessionId);
      socket.emit("session:job-attatched", {jobId, sessionId})
      
    })

    socket.on('session:state:set', async(data: {sessionId: string, key: string; value: string; expectedVersion: number})=>{
      const result = await setVersionedValue(data.sessionId, data.key,{
        value: data.value,
        expectedVersion: data.expectedVersion,
        socketId: socket.id
      });
      if(result.ok){
        broadcastDelta(io, data.sessionId, {
          type: 'state_updated',
          key: data.key,
          current: result.current
        });
      }else{
        socket.emit("session:delta", {
          type: 'state_conflict',
          key: data.key,
          current: result.current,
        })
      }
    });

    socket.on("session:state:bulk-set",
      async(data: { sessionId: string,
       updates: Array<{key: string; value: string; expectedVersion: number}>})=>{
        const results = await bulkSetVersionedValues(data.sessionId, data.updates.map(u =>({
          ...u
        })),
       socket.id,);

       for(const r of results){
        if(r.ok){
          broadcastDelta(io, data.sessionId, {
            type: 'state_updated',
            key: r.key,
            current: r.current 
          })
        }else{
          socket.emit('session:delta', {
            type: 'state_conflict',
            key: r.key,
            current: r.current, 
          })
        }
       }
      }
    );
    



    socket.on("disconnect", async() => {

      const sessions = activeSessions.get(socket.id) ?? new Map<string, string>();
      for (const [sessionId, userId] of sessions) {
        const members = await leaveSession(sessionId, userId, socket.id);
        if (!members.includes(userId)) broadcastDelta(io, sessionId, {
          type: "member_left",
          userId,
          members
        });
      }
      activeSessions.delete(socket.id);
    
    });
  });
}



export function getJobsForSession(sessionId: string): string[] {
  const jobIds: string[] = [];
  for(const [jobId, currentSessionId] of jobSession){
    if( currentSessionId === sessionId){
      jobIds.push(jobId);
    }
  }
  return jobIds;
}

export function getDeltasAfter(sessionId: string, afterId: number): DeltaEntry[] {
  return deltaLog.filter(
    (entry) => entry.sessionId === sessionId && entry.id > afterId
  )
}
