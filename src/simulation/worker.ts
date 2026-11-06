import { planPath } from './planner';
import type { PlanningRequest, PlanningResult } from '../domain/types';

type WorkerRequest = { type: 'plan'; id: string; request: PlanningRequest };
type WorkerResponse = { type: 'progress'; id: string; expanded: number } | { type: 'result'; id: string; result: PlanningResult } | { type: 'error'; id: string; message: string };

const scope = self as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null; postMessage: (message: WorkerResponse) => void };
scope.onmessage = ({ data }) => {
  if (data.type !== 'plan') return;
  try {
    const result = planPath(data.request, () => false, (expanded) => scope.postMessage({ type: 'progress', id: data.id, expanded }));
    scope.postMessage({ type: 'result', id: data.id, result });
  } catch (error) {
    scope.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : 'Unbekannter Berechnungsfehler.' });
  }
};

export type PlanCallbacks = { onProgress?: (expanded: number) => void };
export function planInWorker(request: PlanningRequest, callbacks: PlanCallbacks = {}, signal?: AbortSignal): Promise<PlanningResult> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const finish = () => worker.terminate();
    const abort = () => { finish(); reject(new DOMException('Berechnung abgebrochen.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.id !== id) return;
      if (data.type === 'progress') callbacks.onProgress?.(data.expanded);
      if (data.type === 'result') { finish(); signal?.removeEventListener('abort', abort); resolve(data.result); }
      if (data.type === 'error') { finish(); signal?.removeEventListener('abort', abort); reject(new Error(data.message)); }
    };
    worker.onerror = (event) => { finish(); signal?.removeEventListener('abort', abort); reject(new Error(event.message || 'Web Worker konnte nicht ausgeführt werden.')); };
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ type: 'plan', id, request } satisfies WorkerRequest);
  });
}
