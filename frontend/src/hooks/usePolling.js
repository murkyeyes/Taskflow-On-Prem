import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 7000;

export default function usePolling({ enabled = true, fetchUpdates, onUpdates, intervalMs = DEFAULT_INTERVAL_MS }) {
  const sinceRef = useRef(new Date(0).toISOString());

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let running = false;

    async function poll() {
      if (running) return;
      running = true;
      try {
        const updates = await fetchUpdates(sinceRef.current);
        if (active) {
          onUpdates(updates);
          sinceRef.current = updates.serverTime;
        }
      } catch {
        // A later poll retries; page-level actions still surface their own errors.
      } finally {
        running = false;
      }
    }

    poll();
    const timer = window.setInterval(poll, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, fetchUpdates, intervalMs, onUpdates]);
}

export { DEFAULT_INTERVAL_MS };
