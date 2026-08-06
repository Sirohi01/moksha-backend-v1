/** Minimal dependency-free logger. Swap for winston/pino later without touching call sites. */
type LogMeta = Record<string, unknown> | undefined;

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, meta?: LogMeta) =>
    console.log(`[INFO] ${timestamp()} - ${message}`, meta ?? ""),
  warn: (message: string, meta?: LogMeta) =>
    console.warn(`[WARN] ${timestamp()} - ${message}`, meta ?? ""),
  error: (message: string, meta?: LogMeta) =>
    console.error(`[ERROR] ${timestamp()} - ${message}`, meta ?? ""),
};
