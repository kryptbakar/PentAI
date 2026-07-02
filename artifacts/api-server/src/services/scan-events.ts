import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for live scan progress. The scan executor emits lifecycle
 * and finding events here; the SSE endpoint (`GET /scans/:id/stream`) subscribes
 * and forwards them to the browser so findings stream in as they land instead of
 * only appearing once the whole scan completes.
 *
 * This is intentionally in-process. For multi-instance deployments, back it with
 * Redis pub/sub (see roadmap) — the emit/subscribe surface stays the same.
 */

export type ScanEvent =
  | { type: "status"; scanId: number; status: string; at: string }
  | { type: "finding"; scanId: number; severity: string; title: string; tool: string; at: string }
  | { type: "log"; scanId: number; message: string; at: string };

const emitter = new EventEmitter();
// A scan can have many concurrent viewers; lift the default 10-listener cap.
emitter.setMaxListeners(0);

function channel(scanId: number): string {
  return `scan:${scanId}`;
}

export function emitScanEvent(event: ScanEvent): void {
  emitter.emit(channel(event.scanId), event);
}

export function subscribeScan(scanId: number, listener: (event: ScanEvent) => void): () => void {
  const ch = channel(scanId);
  emitter.on(ch, listener);
  return () => emitter.off(ch, listener);
}
