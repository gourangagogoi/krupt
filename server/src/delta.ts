import { VersionedValue } from "./session";

export type SessionDelta =
  | { type: 'member_joined'; userId: string; members: string[] }
  | { type: 'member_left'; userId: string; members: string[] }
  | { type: 'job_status'; jobId: string;  status: string; updatedAt: string }
  | { type: 'state_updated'; key: string; current: VersionedValue }
  | { type: 'state_conflict'; key: string; current: VersionedValue }