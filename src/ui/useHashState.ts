import { useCallback, useEffect, useState } from "react";

// Keeps view state in the URL hash (#game=ironvale&view=catchup&since=...) so a
// catch-up report can be bookmarked or shared.

function read(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1));
}

export function useHashState(): [URLSearchParams, (patch: Record<string, string | undefined>) => void] {
  const [params, setParams] = useState(read);

  useEffect(() => {
    const onChange = () => setParams(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const update = useCallback((patch: Record<string, string | undefined>) => {
    const next = read();
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) next.delete(k);
      else next.set(k, v);
    }
    history.replaceState(null, "", `#${next.toString()}`);
    setParams(next);
  }, []);

  return [params, update];
}
