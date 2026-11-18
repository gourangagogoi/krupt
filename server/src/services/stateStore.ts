import { pub } from "../lib/redis";
import { VersionedValue } from "../session";

const stateKey = (sessionId: string, key: string) =>{
    return `session:${sessionId}:state:${key}`;
}

export async function getVersionedValue(
    sessionId: string,
    key: string
): Promise<VersionedValue | null> {
    const raw = await pub.hgetall(stateKey(sessionId, key));
    if(!raw.version) return null;  //cause hgetall dsnt return null, it rtrns {}
    return {
        value: raw.value,
        version: parseInt(raw.version,10),
        updatedAt: raw.updatedAt,
        updatedBy: raw.updatedBy,
    };
}

export async function setVersionedValue(
    sessionId: string,
    key: string,
    incoming: {value: string, expectedVersion: number, socketId: string}
): Promise<{ ok: true; current: VersionedValue } | { ok: false; current: VersionedValue }> {
    const k = stateKey(sessionId, key);
    const updatedAt = new Date().toISOString();
    const result = await pub.eval(
        `local version = tonumber(redis.call('HGET', KEYS[1], 'version') or '0')
         if version ~= tonumber(ARGV[1]) then
           return {0, version, redis.call('HGET', KEYS[1], 'value') or '', redis.call('HGET', KEYS[1], 'updatedAt') or '', redis.call('HGET', KEYS[1], 'updatedBy') or ''}
         end
         local nextVersion = version + 1
         redis.call('HSET', KEYS[1], 'value', ARGV[2], 'version', nextVersion, 'updatedAt', ARGV[3], 'updatedBy', ARGV[4])
         return {1, nextVersion, ARGV[2], ARGV[3], ARGV[4]}`,
        1,
        k,
        incoming.expectedVersion,
        incoming.value,
        updatedAt,
        incoming.socketId,
    ) as [number, number, string, string, string];

    const [written, version, value, storedAt, updatedBy] = result;
    return {
        ok: written === 1,
        current: {
            value,
            version,
            updatedAt: storedAt || updatedAt,
            updatedBy,
        },
    };
}

export async function bulkSetVersionedValues(
    sessionId: string,
    updates: Array<{key: string; value: string; expectedVersion: number;}>,
    socketId: string,
): Promise<Array<{key: string; ok: boolean, current: VersionedValue}>>
{
    const results = [];
    for(const u of updates){
        const r = await setVersionedValue(sessionId, u.key, {
            value: u.value,
            expectedVersion: u.expectedVersion,
            socketId: socketId,
        });
        results.push({
            key: u.key,
            ...r
        })
    }
    return results;
}
