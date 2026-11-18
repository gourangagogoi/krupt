type JobEvent = {
  jobId: string;
  event: string;
  timestamp: number;
  data?: Record<string, unknown>;
};

const MAX_EVENTS = 500;
const log: JobEvent[] = [];

export function recordEvent(
  jobId: string,
  event: string,
  data?: Record<string, unknown>,
) {
  log.push({ jobId, event, timestamp: Date.now(), data });

  if (log.length > MAX_EVENTS) log.shift();
}

export function getEventsForJob(jobId: string): JobEvent[] {
  return log.filter((e) => e.jobId === jobId);
}

export function getAllEvents(): JobEvent[] {
  return [...log];
}
