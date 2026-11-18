import { pub as redis } from "./lib/redis";

function memberKey(sessionId: string){
    return `session:${sessionId}:members`;
}

function connectionsKey(sessionId: string, userId: string) {
    return `session:${sessionId}:member:${userId}:connections`;
}

export async function joinSession(sessionId: string,
    userId: string,
    socketId: string,
): Promise<string[]> {
    const key = connectionsKey(sessionId, userId);
    await redis.sadd(key, socketId);
    await redis.expire(key, 60*60*24);
    await redis.sadd(memberKey(sessionId), userId);
    await redis.expire(memberKey(sessionId), 60*60*24);
    return redis.smembers(memberKey(sessionId));
}

export async function leaveSession(
    sessionId: string,
    userId: string,
    socketId: string,
): Promise<string[]> {
    const key = connectionsKey(sessionId, userId);
    await redis.srem(key, socketId);
    if (await redis.scard(key) === 0) {
        await redis.del(key);
        await redis.srem(memberKey(sessionId), userId);
    }
    return redis.smembers(memberKey(sessionId));
}

export async function getMembers(sessionId: string): Promise<string[]> {
    return redis.smembers(memberKey(sessionId));
}
