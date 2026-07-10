import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";

/**
 * Tracks effective connectivity: the browser's online flag AND backend reachability.
 * `navigator.onLine` alone is unreliable (it's true on captive networks / dead backend),
 * so we also ping the health endpoint periodically.
 */
export function useOnline(pollMs = 20000): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (!navigator.onLine) {
        if (!cancelled) setOnline(false);
        return;
      }
      const reachable = await checkHealth();
      if (!cancelled) setOnline(reachable);
    }

    const onChange = () => void probe();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);

    void probe();
    const timer = window.setInterval(probe, pollMs);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return online;
}
