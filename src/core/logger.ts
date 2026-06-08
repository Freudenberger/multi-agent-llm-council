/**
 * Structured logger with configurable log levels.
 *
 * Environment variable:
 *   LOG_LEVEL=debug|info|error  (default: info)
 *
 * Usage:
 *   import { logger } from "@/core/logger";
 *   logger.debug("Detailed info", { key: "value" });
 *   logger.info("Step completed", { durationMs: 123 });
 *   logger.error("Something failed", { error: err.message });
 */

export type LogLevel = "debug" | "info" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  error: 2,
};

function getConfiguredLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel === "debug" || envLevel === "info" || envLevel === "error") {
    return envLevel;
  }
  return "info";
}

function shouldLog(messageLevel: LogLevel): boolean {
  const configured = getConfiguredLevel();
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configured];
}

function formatMessage(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, data));
    }
  },

  info(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("info")) {
      console.log(formatMessage("info", message, data));
    }
  },

  error(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, data));
    }
  },

  /** Returns the currently active log level. */
  getLevel(): LogLevel {
    return getConfiguredLevel();
  },
};

/**
 * Times an async operation and returns [result, durationMs].
 * Logs the duration automatically at info level.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  logData?: Record<string, unknown>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  logger.debug(`Starting: ${label}`, logData);
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  logger.info(`${label} completed`, { durationMs, ...logData });
  return { result, durationMs };
}
