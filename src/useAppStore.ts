import { useEffect, useRef, useState } from "react";
import { ensureWeek, localDate } from "./domain.ts";
import type { AppData } from "./domain.ts";
import { loadData, saveChange, STORAGE_KEY } from "./storage.ts";
import type { SaveResult, Snapshot } from "./storage.ts";

const store = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
export type Update = (
  change: (previous: AppData) => AppData,
  base?: Snapshot,
  restore?: boolean,
) => Promise<SaveResult | null>;
// A draft remembers the stored snapshot it was opened from, so a save made after
// another tab changed the record is rejected instead of overwriting it.
export function useDraft<T>(snapshot: { current: Snapshot }, initial: T) {
  const [value, setValue] = useState(initial);
  const base = useRef(snapshot.current);
  const set = (next: T, origin = snapshot.current) => {
    base.current = origin;
    setValue(next);
  };
  return [value, set, base] as const;
}
export function useAppStore(onBlocked: () => void) {
  const [loaded] = useState(() => loadData(store));
  const snapshot = useRef(loaded);
  const saving = useRef(false);
  const [data, setData] = useState<AppData>(loaded.data);
  const [blocked, setBlocked] = useState(Boolean(loaded.error));
  const [rawRecovery, setRawRecovery] = useState(loaded.raw);
  const [error, setError] = useState(loaded.error);
  const [saveIssue, setSaveIssue] = useState("");
  const [pendingBackup, setPendingBackup] = useState<AppData | null>(null);
  const [today, setToday] = useState(localDate);
  const [toast, setToast] = useState("");
  const canChange = () => {
    if (blocked) {
      onBlocked();
      setToast("先导出原始记录，再恢复有效备份。");
      return false;
    }
    return true;
  };
  const accept = (next: Snapshot) => {
    snapshot.current = next;
    setData(next.data);
    setBlocked(Boolean(next.error));
    setRawRecovery(next.raw);
    setError(next.error);
  };
  const update: Update = async (
    change,
    base = snapshot.current,
    restore = false,
  ) => {
    if (!restore && !canChange()) return null;
    if (saving.current) {
      setToast("上一项正在保存，请稍后再试。");
      return null;
    }
    saving.current = true;
    try {
      const result = await saveChange(
        store,
        navigator.locks,
        base,
        change,
        restore,
      );
      accept(result.snapshot);
      setSaveIssue(result.message);
      if (result.status !== "saved") {
        if (result.attempted) setPendingBackup(result.attempted);
        setToast("本次改动未保存，请查看保存提示。");
        return null;
      }
      setToday(localDate());
      return result;
    } finally {
      saving.current = false;
    }
  };
  useEffect(() => {
    const updateDate = () => setToday(localDate());
    const timer = setInterval(updateDate, 30000);
    window.addEventListener("focus", updateDate);
    document.addEventListener("visibilitychange", updateDate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", updateDate);
      document.removeEventListener("visibilitychange", updateDate);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const synchronize = () => {
      const next = loadData(store);
      if (
        next.raw !== snapshot.current.raw ||
        next.error !== snapshot.current.error
      )
        accept(next);
    };
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        synchronize();
      }
    };
    window.addEventListener("storage", handler);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, []);
  useEffect(() => {
    // Weekly generation is the only write without a user action. It is idempotent:
    // on a conflict the newer record is accepted and this effect re-checks it.
    if (blocked || saving.current) return;
    if (ensureWeek(snapshot.current.data, today) === snapshot.current.data)
      return;
    saving.current = true;
    void saveChange(store, navigator.locks, snapshot.current, (previous) =>
      ensureWeek(previous, today),
    )
      .then((result) => {
        if (result.status === "error") setSaveIssue(result.message);
        else accept(result.snapshot);
      })
      .finally(() => {
        saving.current = false;
      });
  }, [today, data, blocked]);
  return {
    snapshot,
    data,
    blocked,
    rawRecovery,
    error,
    saveIssue,
    pendingBackup,
    setPendingBackup,
    today,
    setToday,
    toast,
    setToast,
    canChange,
    update,
  };
}
