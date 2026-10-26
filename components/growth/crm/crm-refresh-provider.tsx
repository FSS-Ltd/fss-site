"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type CrmRefreshState = {
  busy: boolean;
  beginCommand: () => void;
  endCommand: () => void;
  refresh: () => void;
};
const CrmRefreshContext = createContext<CrmRefreshState | null>(null);

/** Keep all CRM controls on the same committed version while an RSC refresh is pending. */
export function CrmRefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [commands, setCommands] = useState(0);
  const [refreshing, startTransition] = useTransition();
  const beginCommand = useCallback(() => setCommands((count) => count + 1), []);
  const endCommand = useCallback(
    () => setCommands((count) => Math.max(0, count - 1)),
    [],
  );
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );
  const busy = commands > 0 || refreshing;
  const state = useMemo(
    () => ({ busy, beginCommand, endCommand, refresh }),
    [busy, beginCommand, endCommand, refresh],
  );
  return (
    <CrmRefreshContext.Provider value={state}>
      {children}
    </CrmRefreshContext.Provider>
  );
}
export function useCrmRefresh(): CrmRefreshState {
  const state = useContext(CrmRefreshContext);
  if (!state) throw new Error("CRM controls require CrmRefreshProvider.");
  return state;
}
