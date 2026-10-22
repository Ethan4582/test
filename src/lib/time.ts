export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;

export function now(): Date {
  return new Date();
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * SECOND);
}

export function isPast(date: Date, reference: Date = now()): boolean {
  return date.getTime() <= reference.getTime();
}

export function backoffDelay(attempt: number): number {
  const base = Math.min(2 ** attempt, 60);
  const jitter = Math.random() * 0.3;
  return Math.round((base + jitter) * SECOND);
}

export function formatDuration(ms: number): string {
  if (ms < SECOND) return `${ms}ms`;
  if (ms < MINUTE) return `${(ms / SECOND).toFixed(1)}s`;
  return `${(ms / MINUTE).toFixed(1)}m`;
}