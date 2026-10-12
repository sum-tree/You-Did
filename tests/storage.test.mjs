import test from "node:test";
import assert from "node:assert/strict";
import { emptyData } from "../src/domain.ts";
import { loadData, persistData, STORAGE_KEY } from "../src/storage.ts";
function store(raw = null) {
  const values = new Map(raw === null ? [] : [[STORAGE_KEY, raw]]);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
test("fresh state and persisted JSON survive reload", () => {
  const storage = store();
  const data = emptyData();
  data.courseWeek = 8;
  assert.equal(loadData(storage).data.courseWeek, 6);
  assert.equal(persistData(storage, data), "");
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
test("unavailable storage and quota failures have visible recoverable errors", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("quota");
    },
  };
  assert.ok(loadData(storage).error);
  assert.ok(persistData(storage, emptyData()));
});
