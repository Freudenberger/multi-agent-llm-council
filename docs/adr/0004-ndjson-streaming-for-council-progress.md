# ADR-0004: NDJSON Streaming for Council Progress

## Status

Accepted

## Date

2026-06-11

## Context

A council run fans out to multiple LLM agents in parallel, then synthesises a final report. A typical run takes 10–30 seconds. During that time, the user stares at a loading spinner with no feedback — they don't know which agents have responded, which are still running, or whether the run is stuck.

We need a way to push incremental progress from the server to the browser so the UI can show live per-agent status.

Options:

1. **Polling** — the client periodically `GET`s a status endpoint.
2. **Server-Sent Events (SSE)** — unidirectional stream from server to client.
3. **WebSocket** — bidirectional persistent connection.
4. **NDJSON streaming** — the `POST /api/council` response is a stream of newline-delimited JSON objects, one per progress event, ending with the final result.

Forces at play:

- The council API is a single `POST` request/response — adding a separate status endpoint or WebSocket connection adds state management complexity.
- Next.js API routes support `ReadableStream` responses natively.
- The client already makes a `fetch()` call — we just need to consume the response as a stream.
- Progress events are fire-and-forget — the client doesn't need to send anything back during the run.
- Cancellation must be supported — the user should be able to abort a running council.

## Decision

We will use **NDJSON streaming** over the existing `POST /api/council` endpoint. The response is a stream of JSON objects, one per line:

```
{"type":"phase_started","phase":"specialists"}
{"type":"agent_completed","agentId":"optimist","durationMs":3200,"ok":true}
{"type":"agent_completed","agentId":"sceptic","durationMs":4100,"ok":true}
{"type":"phase_started","phase":"judge"}
{"type":"result","data":{...}}
```

The final line is always `{"type":"result","data":{...}}` containing the full council output. The client consumes the stream with `response.body.getReader()` and updates the UI incrementally.

Cancellation is handled via `AbortController` — the client calls `abort()` on the controller passed to `fetch()`, which fires the `AbortSignal` threaded through `runCouncil` → `provider.generate()`, aborting in-flight HTTP requests. The server catches `CouncilAbortedError` and ends the stream cleanly.

## Consequences

### Positive

- No additional endpoints or WebSocket infrastructure — the existing `POST` endpoint just returns a stream instead of a JSON blob.
- Real-time feedback: the UI shows each agent completing as it happens.
- Cancellation actually stops in-flight requests (not just ignored).
- NDJSON is simple to parse (split on `\n`, `JSON.parse` each line).
- Works through proxies and CDNs that buffer SSE/WebSocket but pass through streaming responses.

### Negative

- The client must handle partial reads and reassemble lines — more complex than a single `response.json()`.
- Error handling is split: transient errors appear as `agent_completed` with `ok:false`, while fatal errors end the stream with an error object.
- No built-in reconnection — if the connection drops mid-stream, the client must retry the entire run.

### Neutral

- The stream is one-shot — once consumed, the progress events are gone. History is persisted separately via the storage layer.

## Alternatives Considered

### Polling

Simple to implement, but adds latency (polling interval) and server load (repeated `GET` requests). Requires server-side state to track in-progress runs.

### Server-Sent Events (SSE)

Standardised, auto-reconnecting, but requires a separate `GET` endpoint and server-side state to correlate the SSE connection with the running council. More infrastructure for no real benefit over NDJSON in this use case.

### WebSocket

Full bidirectional communication, but massive overkill for a fire-and-forget progress feed. Requires connection management, heartbeat, and a WebSocket server — all unnecessary complexity for the MVP.

## References

- [src/app/api/council/route.ts](../../src/app/api/council/route.ts) — NDJSON streaming response
- [src/core/runCouncil.ts](../../src/core/runCouncil.ts) — `onProgress` callback, `AbortSignal` threading
- [src/core/errors.ts](../../src/core/errors.ts) — `CouncilAbortedError`
