import { emptyData, upgradeData, validateData } from "./domain.ts";
import type { AppData } from "./domain.ts";

export const STORAGE_KEY = "you-did:v1";
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface Snapshot {
  data: AppData;
  error: string;
  raw: string | null;
}
export interface WriteLock {
  request<T>(name: string, callback: () => T | PromiseLike<T>): Promise<T>;
}
export type SaveResult = {
  status: "saved" | "conflict" | "error";
  snapshot: Snapshot;
  message: string;
  attempted?: AppData;
};
export const WRITE_LOCK = `${STORAGE_KEY}:write`;
export function loadData(storage: Store): Snapshot {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { data: emptyData(), error: "", raw: null };
    // Older versions are upgraded in memory; the stored text is rewritten only by
    // the next real save, so conflict checks still compare against what is stored.
    const data = upgradeData(JSON.parse(raw));
    if (!data) throw new Error("invalid");
    return { data, error: "", raw };
  } catch {
    return {
      data: emptyData(),
      error:
        "无法读取本地记录。原数据已保留，请先导出原始记录，再导入有效备份。",
      raw,
    };
  }
}
// All app writes, including backup replacement, must use the same origin-wide lock.
// Comparing the raw snapshot also protects forms opened before a storage event arrives.
export async function saveChange(
  storage: Store,
  locks: WriteLock | undefined,
  base: Snapshot,
  change: (previous: AppData) => AppData,
  restore = false,
): Promise<SaveResult> {
  let attempted: AppData | undefined;
  try {
    attempted = change(base.data);
    if (!validateData(attempted))
      return {
        status: "error",
        snapshot: base,
        message: "本次改动无效，未写入记录。",
      };
    if (!locks)
      return {
        status: "error",
        snapshot: base,
        attempted,
        message:
          "当前浏览器不支持安全的多页面保存，已暂停写入。请导出待保存备份，再使用新版浏览器打开正式网站。",
      };
    return await locks.request(WRITE_LOCK, () => {
      const current = loadData(storage);
      if (current.error && (!restore || current.raw === null))
        return {
          status: "error",
          snapshot: current,
          attempted,
          message: current.error,
        };
      if (current.raw !== base.raw)
        return {
          status: "conflict",
          snapshot: current,
          attempted,
          message:
            "另一页面已更新记录，本次改动未保存。输入仍保留，可先导出待保存备份，再关闭并重新打开编辑窗口，核对最新记录。",
        };
      const raw = JSON.stringify(attempted);
      try {
        if (raw !== current.raw) storage.setItem(STORAGE_KEY, raw);
        return {
          status: "saved",
          snapshot: { data: attempted!, raw, error: "" },
          message: "",
        };
      } catch {
        return {
          status: "error",
          snapshot: current,
          attempted,
          message:
            "本地保存失败，本次改动未写入。请导出待保存备份，并检查浏览器存储空间。",
        };
      }
    });
  } catch {
    return {
      status: "error",
      snapshot: base,
      attempted,
      message: "无法安全保存，本次改动未写入。请导出待保存备份后重试。",
    };
  }
}
