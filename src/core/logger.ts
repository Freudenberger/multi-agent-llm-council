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

export type LogData = Record<string, unknown>;

export interface Logger {
  debug(message: string, data?: LogData): void;
  info(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
  /** Returns the currently active log level. */
  getLevel(): LogLevel;
  /**
   * Returns a logger whose every line is tagged with `context` (e.g. a runId),
   * so a whole request can be correlated across modules without threading the
   * id through every call. Per-call `data` overrides the bound context on key
   * collisions.
   */
  child(context: LogData): Logger;
}

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

function createLogger(baseContext: LogData = {}): Logger {
  const hasContext = Object.keys(baseContext).length > 0;
  const merge = (data?: LogData): LogData | undefined => {
    if (!hasContext) return data;
    return { ...baseContext, ...data };
  };

  return {
    debug(message: string, data?: LogData): void {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", message, merge(data)));
      }
    },

    info(message: string, data?: LogData): void {
      if (shouldLog("info")) {
        console.log(formatMessage("info", message, merge(data)));
      }
    },

    error(message: string, data?: LogData): void {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message, merge(data)));
      }
    },

    getLevel(): LogLevel {
      return getConfiguredLevel();
    },

    child(context: LogData): Logger {
      return createLogger({ ...baseContext, ...context });
    },
  };
}

export const logger: Logger = createLogger();

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
