/**
 * Next.js instrumentation hook (runs once at server startup).
 *
 * OpenTelemetry tracing is opt-in: it only registers when an OTLP collector
 * endpoint is configured, so a normal/dev run pays nothing and emits no noise.
 * `@vercel/otel` auto-instruments fetch + HTTP, which covers the LLM provider
 * calls that dominate every council/discussion run.
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318  # enables tracing
 *   OTEL_SERVICE_NAME=llm-council                       # optional, defaults below
 *
 * ponytail: env-gated, single canonical package. No manual span plumbing —
 * the runId already in the logs correlates app-level steps; reach for explicit
 * spans only if auto-instrumentation proves too coarse.
 */
export async function register() {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;

  const { registerOTel } = await import("@vercel/otel");
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "llm-council",
  });
}
