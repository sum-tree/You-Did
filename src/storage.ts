import { emptyData, validateData } from "./domain.ts";
import type { AppData } from "./domain.ts";

export const STORAGE_KEY = "you-did:v1";
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadData(storage: Store): {
  data: AppData;
  error: string;
  raw: string | null;
} {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { data: emptyData(), error: "", raw: null };
    const data: unknown = JSON.parse(raw);
    if (!validateData(data)) throw new Error("invalid");
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
export function persistData(storage: Store, data: AppData): string {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return "";
  } catch {
    return "本地保存失败。当前改动仍在本次页面中，请立即导出备份，并检查浏览器存储空间。";
  }
}
