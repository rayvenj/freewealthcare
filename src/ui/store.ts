import { createContext, useContext } from "react";
import type { Budget } from "../core/types";
import type { Db } from "../storage/db";

export interface Store {
  db: Db;
  budget: Budget;
  /**
   * Runs a write, then reloads state from the database so the UI never drifts from storage.
   * Resolves false (and shows the error) when the write fails, so callers only
   * report success for data that was actually saved.
   */
  mutate: (write: (db: Db) => Promise<unknown>) => Promise<boolean>;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside StoreContext");
  return s;
}
