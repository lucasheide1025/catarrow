import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./useAuth";
import {
  BOOTSTRAP_COST_CONTROL, COST_CAPABILITIES, DEFAULT_COST_CONTROL,
  canManualRecovery, isCostCapabilityAllowed, normalizeCostControl,
  setEffectiveCostControl,
} from "../lib/costControl";

function cachedPolicy() {
  try {
    const raw = localStorage.getItem("costControl:lastPolicy");
    return raw ? normalizeCostControl(JSON.parse(raw)) : BOOTSTRAP_COST_CONTROL;
  } catch {
    return BOOTSTRAP_COST_CONTROL;
  }
}

const CostControlContext = createContext({
  policy: DEFAULT_COST_CONTROL,
  allows: capability => capability === COST_CAPABILITIES.coreOperations,
  recoverTo: async () => {},
});

export function CostControlProvider({ children }) {
  const { role, profile } = useAuth();
  const [policy, setPolicy] = useState(cachedPolicy);

  useEffect(() => {
    if (!role) {
      setEffectiveCostControl(DEFAULT_COST_CONTROL);
      setPolicy(DEFAULT_COST_CONTROL);
      return undefined;
    }
    const initial = cachedPolicy();
    setEffectiveCostControl(initial);
    setPolicy(initial);
    return onSnapshot(doc(db, "sysConfig", "costControl"), snap => {
      const next = snap.exists() ? normalizeCostControl(snap.data()) : cachedPolicy();
      setEffectiveCostControl(next);
      setPolicy(next);
      try { localStorage.setItem("costControl:lastPolicy", JSON.stringify(next)); } catch {}
    }, () => {
      const cached = cachedPolicy();
      setEffectiveCostControl(cached);
      setPolicy(cached);
    });
  }, [role]);

  const value = useMemo(() => ({
    policy,
    allows: capability => isCostCapabilityAllowed(capability, policy),
    recoverTo: async level => {
      if (!canManualRecovery(policy, level)) throw new Error("成本防護一次只能降低一個等級");
      if (role !== "admin") throw new Error("只有管理員可以解除成本防護。");
      await setDoc(doc(db, "sysConfig", "costControl"), {
        ...policy,
        level,
        source: "admin_manual_recovery",
        reason: `管理員手動恢復至 ${level}`,
        manualRecoveryRequired: false,
        revision: policy.revision + 1,
        recoveredAt: serverTimestamp(),
        recoveredBy: profile?.id || profile?.uid || "admin",
      }, { merge:true });
    },
  }), [policy, profile?.id, profile?.uid, role]);

  return <CostControlContext.Provider value={value}>{children}</CostControlContext.Provider>;
}

export function useCostControl() {
  return useContext(CostControlContext);
}
