// Cold-start notice: the free backend sleeps after 15 idle minutes and takes about a minute to wake.

import { useEffect, useState, useSyncExternalStore } from "react";
import { serverStatus } from "../api/client";
import s from "./WakingServer.module.css";

export function useServerStatus() {
  return useSyncExternalStore(serverStatus.subscribe, serverStatus.get, serverStatus.get);
}

export function WakingServer() {
  const status = useServerStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "waking") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status !== "waking") return null;
  const since = serverStatus.wakingSince() ?? now;
  const elapsed = Math.max(0, Math.round((now - since) / 1000));
  const progress = Math.min(0.95, elapsed / 60);

  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <div className={s.inner}>
        <span className={s.pulse} aria-hidden="true" />
        <div className={s.text}>
          <strong>Waking the server…</strong>{" "}
          <span className={s.detail}>
            The free backend naps when nobody is using it. It usually wakes in about a minute
            {elapsed >= 5 ? ` (${elapsed}s so far)` : ""}. Your data will appear automatically.
          </span>
        </div>
      </div>
      <div className={s.track} aria-hidden="true">
        <div className={s.bar} style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
