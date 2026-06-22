// src/hooks/useCheckinActive.js
import { useState, useEffect } from "react";
import { subscribeMyCheckin } from "../lib/db";

export function useCheckinActive(memberId) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!memberId) { setActive(false); return; }
    const unsub = subscribeMyCheckin(memberId, c => setActive(c?.status === "active"));
    return () => unsub?.();
  }, [memberId]);
  return active;
}
