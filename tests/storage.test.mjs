import test from "node:test";
import assert from "node:assert/strict";
import { completeTask, emptyData } from "../src/domain.ts";
import {
  loadData,
  saveChange,
  STORAGE_KEY,
  WRITE_LOCK,
} from "../src/storage.ts";
function locks() {
  let queue = Promise.resolve();
  return {
    request(name, callback) {
      assert.equal(name, WRITE_LOCK);
      const result = queue.then(callback);
      queue = result.catch(() => {});
      return result;
    },
  };
}
function store(raw = null) {
  const values = new Map(raw === null ? [] : [[STORAGE_KEY, raw]]);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
test("fresh state and persisted JSON survive reload", async () => {
  const storage = store();
  const data = emptyData();
  data.courseWeek = 8;
  assert.equal(loadData(storage).data.courseWeek, 6);
  assert.equal(
    (await saveChange(storage, locks(), loadData(storage), () => data)).status,
    "saved",
  );
  assert.deepEqual(loadData(storage).data, data);
});
test("corrupt or incompatible stored data is returned for recovery and not overwritten", () => {
  for (const raw of ["broken JSON", '{"version":2}']) {
    const storage = store(raw);
    const result = loadData(storage);
    assert.ok(result.error);
    assert.equal(result.raw, raw);
    assert.equal(storage.values.get(STORAGE_KEY), raw);
  }
});
test("unavailable storage and quota failures have visible recoverable errors", async () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.ok(loadData(storage).error);
  assert.equal(
    (await saveChange(storage, locks(), loadData(storage), (data) => data))
      .status,
    "error",
  );
});

test("simultaneous tabs serialize writes and reject the stale snapshot without losing the winner", async () => {
  const storage = store();
  const lock = locks();
  const base = loadData(storage);
  const [a, b] = await Promise.all([
    saveChange(storage, lock, base, (data) => ({ ...data, courseWeek: 7 })),
    saveChange(storage, lock, base, (data) => ({ ...data, courseWeek: 8 })),
  ]);
  assert.equal(a.status, "saved");
  assert.equal(b.status, "conflict");
  assert.equal(b.snapshot.data.courseWeek, 7);
  assert.equal(b.attempted.courseWeek, 8);
  assert.equal(loadData(storage).data.courseWeek, 7);
  const retried = await saveChange(
    storage,
    lock,
    loadData(storage),
    (data) => ({ ...data, courseWeek: 8 }),
  );
  assert.equal(retried.status, "saved");
});

test("an editor opened before an update cannot overwrite it even after the view synchronizes", async () => {
  const storage = store(JSON.stringify(emptyData()));
  const lock = locks();
  const editor = loadData(storage);
  await saveChange(storage, lock, editor, (data) => ({
    ...data,
    courseWeek: 10,
  }));
  const synchronizedView = loadData(storage);
  assert.equal(synchronizedView.data.courseWeek, 10);
  const result = await saveChange(storage, lock, editor, (data) => ({
    ...data,
    courseWeek: 4,
  }));
  assert.equal(result.status, "conflict");
  assert.equal(loadData(storage).data.courseWeek, 10);
});

test("two tabs completing the same task cannot double reward or lose the completion", async () => {
  const data = emptyData();
  data.tasks.push({
    id: "a",
    title: "Task",
    category: "course",
    priority: 1,
    dueDate: "2026-10-12",
    plannedWeek: "2026-10-12",
    kind: "course",
    amount: 1,
    status: "open",
    createdAt: "2026-10-12",
  });
  const storage = store(JSON.stringify(data));
  const lock = locks();
  const base = loadData(storage);
  const results = await Promise.all(
    [0, 1].map(() =>
      saveChange(storage, lock, base, (previous) =>
        completeTask(previous, "a", "2026-10-12"),
      ),
    ),
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["saved", "conflict"],
  );
  const stored = loadData(storage).data;
  assert.equal(stored.completions.length, 1);
  assert.equal(stored.rewards.length, 1);
  const repeated = await saveChange(
    storage,
    lock,
    loadData(storage),
    (previous) => completeTask(previous, "a", "2026-10-12"),
  );
  assert.equal(repeated.status, "saved");
  assert.equal(loadData(storage).data.rewards.length, 1);
});

test("backup replacement and other tabs clearing storage both honor conflict protection", async () => {
  const storage = store(JSON.stringify(emptyData()));
  const lock = locks();
  const beforeImport = loadData(storage);
  await saveChange(storage, lock, beforeImport, (data) => ({
    ...data,
    courseWeek: 9,
  }));
  const imported = await saveChange(
    storage,
    lock,
    beforeImport,
    () => emptyData(),
    true,
  );
  assert.equal(imported.status, "conflict");
  assert.equal(loadData(storage).data.courseWeek, 9);
  const beforeClear = loadData(storage);
  storage.values.clear();
  const cleared = await saveChange(storage, lock, beforeClear, (data) => ({
    ...data,
    courseWeek: 11,
  }));
  assert.equal(cleared.status, "conflict");
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("corrupt storage is preserved and only an explicit unchanged backup restore may replace it", async () => {
  const storage = store("broken JSON");
  const lock = locks();
  const base = loadData(storage);
  assert.equal(
    (await saveChange(storage, lock, base, () => emptyData())).status,
    "error",
  );
  assert.equal(storage.getItem(STORAGE_KEY), "broken JSON");
  assert.equal(
    (await saveChange(storage, lock, base, () => emptyData(), true)).status,
    "saved",
  );
  assert.equal(loadData(storage).error, "");
});

test("missing or failed locks never fall back to an unsafe write", async () => {
  const storage = store();
  for (const lock of [
    undefined,
    {
      request: async () => {
        throw new Error("lock failed");
      },
    },
  ]) {
    const result = await saveChange(
      storage,
      lock,
      loadData(storage),
      (data) => ({ ...data, courseWeek: 7 }),
    );
    assert.equal(result.status, "error");
    assert.equal(result.attempted.courseWeek, 7);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});

test("quota failures preserve saved state and offer the attempted data for backup", async () => {
  const storage = store(JSON.stringify(emptyData()));
  storage.setItem = () => {
    throw new Error("quota");
  };
  const result = await saveChange(
    storage,
    locks(),
    loadData(storage),
    (data) => ({ ...data, courseWeek: 12 }),
  );
  assert.equal(result.status, "error");
  assert.equal(result.attempted.courseWeek, 12);
  assert.equal(result.snapshot.data.courseWeek, 6);
  assert.equal(loadData(storage).data.courseWeek, 6);
});

test("invalid mutations are rejected before any write", async () => {
  const storage = store();
  const result = await saveChange(
    storage,
    locks(),
    loadData(storage),
    (data) => ({ ...data, courseWeek: 30 }),
  );
  assert.equal(result.status, "error");
  assert.equal(storage.getItem(STORAGE_KEY), null);
});
test("version 1 records load upgraded, are kept as stored, and save as version 2", async () => {
  const legacy = {
    version: 1,
    tasks: [
      {
        id: "a",
        title: "整理笔记",
        category: "course",
        priority: 1,
        dueDate: "",
        plannedWeek: "2026-10-12",
        kind: "none",
        amount: 1,
        status: "done",
        createdAt: "2026-10-12T09:00:00",
      },
    ],
    completions: [
      { taskId: "a", title: "整理笔记", category: "course", kind: "none", amount: 1, date: "2026-10-12", week: "2026-10-12" },
    ],
    rewards: [{ id: "task:a", amount: 5, label: "整理笔记", date: "2026-10-12", week: "2026-10-12" }],
    daily: {},
    events: [],
    courseWeek: 6,
  };
  const raw = JSON.stringify(legacy);
  const storage = store(raw);
  const loaded = loadData(storage);
  assert.equal(loaded.error, "");
  assert.equal(loaded.raw, raw);
  assert.equal(loaded.data.version, 2);
  assert.equal(loaded.data.rewards[0].amount, 2);
  assert.equal(storage.values.get(STORAGE_KEY), raw);
  const result = await saveChange(storage, locks(), loaded, (previous) => ({ ...previous, courseWeek: 7 }));
  assert.equal(result.status, "saved");
  assert.equal(JSON.parse(storage.values.get(STORAGE_KEY)).version, 2);
});
