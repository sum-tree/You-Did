import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  archiveTasks,
  balance,
  chooseDaily,
  completeTask,
  dailyTasks,
  dailyView,
  emptyData,
  ensureWeek,
  inferContribution,
  localDate,
  moveTasks,
  normalizeData,
  saveTask,
  settleRewards,
  validateData,
  validDate,
  weekStart,
  weekStats,
} from "../src/domain.ts";

const day = "2026-10-12";
function task(id, kind = "none", amount = 1, extra = {}) {
  const category = ["resume", "interview"].includes(kind)
    ? "job"
    : ["cantonese", "english", "listening"].includes(kind)
      ? "speech"
      : "course";
  return {
    id,
    title: `任务 ${id}`,
    category,
    priority: 1,
    dueDate: "",
    plannedWeek: day,
    kind,
    amount,
    status: "open",
    createdAt: "2026-10-12T08:00:00.000Z",
    ...extra,
  };
}
function dataWith(...tasks) {
  return { ...emptyData(), tasks };
}
function finishAll(data, ids, date = day) {
  return ids.reduce((previous, id) => completeTask(previous, id, date), data);
}

test("local dates and Monday weeks are stable across Sunday and year boundaries", () => {
  assert.equal(weekStart("2026-10-18"), day);
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(localDate(new Date(2026, 9, 12, 0, 1)), day);
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2028-02-29"), true);
});
test("ordinary/course completion receives exactly five and is idempotent", () => {
  const data = dataWith(task("course", "course"));
  const done = completeTask(data, "course", day);
  assert.equal(balance(done), 5);
  assert.equal(done.completions.length, 1);
  assert.deepEqual(completeTask(done, "course", day), done);
  assert.equal(validateData(done), true);
});
test("task contribution records quantity rather than task count", () => {
  const done = completeTask(dataWith(task("cv", "resume", 3)), "cv", day);
  assert.equal(weekStats(done, day).resumes, 3);
  assert.equal(balance(done), 5);
});
test("job target needs 15 resumes AND all scheduled interviews", () => {
  let data = dataWith(task("cv", "resume", 15), task("interview", "interview"));
  data = completeTask(data, "cv", day);
  assert.equal(weekStats(data, day).jobPercent, 50);
  assert.equal(balance(data), 5);
  data = completeTask(data, "interview", day);
  assert.equal(weekStats(data, day).jobPercent, 100);
  assert.equal(balance(data), 30);
  assert.equal(settleRewards(data, day, day).rewards.length, 3);
});
test("no scheduled interview means that condition is already satisfied", () => {
  const data = completeTask(dataWith(task("cv", "resume", 15)), "cv", day);
  assert.equal(weekStats(data, day).interviewTotal, 0);
  assert.equal(weekStats(data, day).jobComplete, true);
  assert.equal(balance(data), 25);
});
test("job challenges accumulate early and are paid after base target completion", () => {
  let data = dataWith(task("cv", "resume", 22), task("interview", "interview"));
  data = completeTask(data, "cv", day);
  assert.equal(balance(data), 5);
  data = completeTask(data, "interview", day);
  assert.equal(balance(data), 50); // two task rewards, base 20, two extra tiers 20
  assert.equal(weekStats(data, day).jobTiers, 2);
  assert.equal(balance(settleRewards(data, day, day)), 50);
});
test("new interview recalculates progress without retracting or reissuing rewards", () => {
  let data = completeTask(dataWith(task("cv", "resume", 18)), "cv", day);
  assert.equal(balance(data), 35);
  data = saveTask(data, task("late", "interview"), day);
  assert.equal(weekStats(data, day).jobPercent, 50);
  assert.equal(balance(data), 35);
  data = completeTask(data, "late", day);
  assert.equal(balance(data), 40);
  assert.equal(
    data.rewards.filter((r) => r.id === `goal:${day}:job`).length,
    1,
  );
});
test("oral goal requires two 30-minute sessions and nine questions", () => {
  let data = dataWith(
    task("cantonese", "cantonese", 2),
    task("english", "english", 9),
  );
  data = completeTask(data, "cantonese", day);
  assert.equal(weekStats(data, day).speechPercent, 50);
  assert.equal(balance(data), 5);
  data = completeTask(data, "english", day);
  assert.equal(weekStats(data, day).speechPercent, 100);
  assert.equal(balance(data), 30);
});
test("listening is accumulated in whole ten-minute tiers and retroactively paid", () => {
  let data = dataWith(
    task("listen", "listening", 25),
    task("c", "cantonese", 2),
    task("e", "english", 9),
  );
  data = completeTask(data, "listen", day);
  assert.equal(balance(data), 5);
  data = finishAll(data, ["c", "e"]);
  assert.equal(balance(data), 45);
  data = saveTask(data, task("listen2", "listening", 5), day);
  data = completeTask(data, "listen2", day);
  assert.equal(balance(data), 55); // new task +5, third listening tier +5
});
test("a near-complete goal never rounds up to 100 percent", () => {
  const data = completeTask(dataWith(task("cv", "resume", 14)), "cv", day);
  assert.equal(weekStats(data, day).jobComplete, false);
  assert.ok(weekStats(data, day).jobPercent < 100);
});
test("completion counts in actual week and base rewards can occur in different weeks", () => {
  let data = dataWith(task("week1", "resume", 15), task("week2", "resume", 15));
  data = completeTask(data, "week1", day);
  data = completeTask(data, "week2", "2026-10-19");
  assert.equal(weekStats(data, day).resumes, 15);
  assert.equal(weekStats(data, "2026-10-19").resumes, 15);
  assert.equal(balance(data), 50);
});
test("a carried interview counts in the completion week", () => {
  const data = completeTask(
    dataWith(task("old", "interview", 1, { plannedWeek: "2026-10-05" })),
    "old",
    day,
  );
  assert.equal(weekStats(data, day).interviewDone, 1);
  assert.equal(weekStats(data, day).interviewTotal, 1);
  assert.equal(weekStats(data, "2026-10-05").interviewDone, 0);
});
test("archiving and carrying open tasks preserve ledger and completed tasks", () => {
  let data = completeTask(
    dataWith(task("done", "course"), task("open")),
    "done",
    day,
  );
  data = chooseDaily(data, day, ["open"]);
  const moved = moveTasks(data, ["open", "done"], day);
  assert.equal(
    moved.tasks.find((t) => t.id === "open").plannedWeek,
    "2026-10-19",
  );
  assert.equal(moved.tasks.find((t) => t.id === "done").plannedWeek, day);
  assert.equal(balance(moved), 5);
  assert.deepEqual(moved.daily[day], []);
  const cleared = archiveTasks(data, ["open", "done"]);
  assert.equal(cleared.tasks.find((t) => t.id === "done").status, "done");
  assert.equal(cleared.tasks.find((t) => t.id === "open").status, "archived");
  assert.equal(balance(cleared), 5);
});
test("moving deadlines earlier than next week sets them to next Monday", () => {
  const data = moveTasks(
    dataWith(
      task("overdue", "none", 1, { dueDate: "2026-10-01" }),
      task("future", "none", 1, { dueDate: "2026-11-10" }),
    ),
    ["overdue", "future"],
    day,
  );
  assert.equal(data.tasks[0].dueDate, "2026-10-19");
  assert.equal(data.tasks[1].dueDate, "2026-11-10");
});
test("automatic daily planning chooses two tasks by priority, then deadline", () => {
  const data = dataWith(
    task("low", "none", 1, { priority: 2 }),
    task("p0later", "none", 1, { priority: 0, dueDate: "2026-10-16" }),
    task("p0earlier", "none", 1, { priority: 0, dueDate: "2026-10-14" }),
  );
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    ["p0earlier", "p0later"],
  );
});
test("overdue tasks take precedence and daily list never exceeds three", () => {
  const data = dataWith(
    ...Array.from({ length: 5 }, (_, i) =>
      task(`urgent${i}`, "none", 1, { dueDate: addDays(day, -i) }),
    ),
    task("important", "none", 1, { priority: 0 }),
  );
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    ["urgent4", "urgent3", "urgent2"],
  );
});
test("urgent deadlines cannot be hidden by a future planned week", () => {
  const data = dataWith(
    task("urgent", "none", 1, { plannedWeek: "2026-10-19", dueDate: day }),
  );
  assert.equal(dailyTasks(data, day)[0].id, "urgent");
  assert.equal(chooseDaily(data, day, ["urgent"]).daily[day][0], "urgent");
});
test("manual planning is exact, deduplicated and capped, and can be explicitly empty", () => {
  const data = dataWith(
    task("a"),
    task("b"),
    task("c"),
    task("d", "none", 1, { dueDate: day }),
  );
  assert.deepEqual(
    dailyTasks(chooseDaily(data, day, ["b", "b", "a", "c", "d"]), day).map(
      (t) => t.id,
    ),
    ["b", "a", "c"],
  );
  assert.deepEqual(dailyTasks(chooseDaily(data, day, []), day), []);
  assert.deepEqual(
    dailyTasks(chooseDaily(data, day, ["a"]), day).map((t) => t.id),
    ["a"],
  );
});
test("future, archived and completed tasks do not auto-fill today", () => {
  const data = dataWith(
    task("next", "none", 1, { plannedWeek: "2026-10-19" }),
    task("archived", "none", 1, { status: "archived" }),
  );
  assert.deepEqual(dailyTasks(data, day), []);
});
test("invalid or inconsistent backups are rejected without accepting duplicate rewards", () => {
  const valid = completeTask(dataWith(task("a")), "a", day);
  assert.equal(validateData(valid), true);
  assert.equal(
    validateData({ ...valid, rewards: [...valid.rewards, valid.rewards[0]] }),
    false,
  );
  assert.equal(validateData({ ...valid, completions: [] }), false);
  assert.equal(
    validateData({ ...emptyData(), tasks: [task("a", "resume", -1)] }),
    false,
  );
  assert.equal(validateData({ ...emptyData(), courseWeek: 16 }), false);
  assert.equal(
    validateData({
      ...emptyData(),
      tasks: [task("a", "resume", 1, { category: "speech" })],
    }),
    false,
  );
  assert.equal(
    validateData({
      ...emptyData(),
      events: [
        {
          id: "e",
          title: "bad date",
          date: "2026-02-30",
          time: "",
          kind: "reminder",
          note: "",
        },
      ],
    }),
    false,
  );
});

test("backup daily selection rejects duplicates and nonexistent tasks", () => {
  const data = dataWith(task("a"));
  const duplicate = { ...data, daily: { [day]: ["a", "a"] } };
  assert.equal(validateData(duplicate), false);
  assert.deepEqual(
    dailyTasks(duplicate, day).map((t) => t.id),
    ["a"],
  );
  assert.equal(validateData({ ...data, daily: { [day]: ["missing"] } }), false);
});

test("immutable completion snapshots must match the completed task", () => {
  const data = completeTask(dataWith(task("course", "course")), "course", day);
  for (const change of [
    { title: "another" },
    { amount: 18 },
    { category: "job", kind: "resume", amount: 18 },
  ]) {
    const invalid = structuredClone(data);
    Object.assign(invalid.completions[0], change);
    assert.equal(validateData(invalid), false);
  }
});

test("orphan task rewards and inconsistent reward dates are rejected", () => {
  const done = completeTask(dataWith(task("a")), "a", day);
  const orphan = { ...emptyData(), rewards: [...done.rewards] };
  assert.equal(validateData(orphan), false);
  const mismatch = structuredClone(done);
  mismatch.rewards[0].date = addDays(day, 1);
  assert.equal(validateData(mismatch), false);
});

test("goal and challenge rewards require matching quantities and amounts", () => {
  const valid = completeTask(dataWith(task("cv", "resume", 18)), "cv", day);
  assert.equal(validateData(valid), true);
  const wrongAmount = structuredClone(valid);
  wrongAmount.rewards.find((r) => r.id.startsWith("goal:")).amount = 5;
  assert.equal(validateData(wrongAmount), false);
  const wrongTier = structuredClone(valid);
  wrongTier.rewards.find((r) => r.id.startsWith("bonus:")).id =
    `bonus:${day}:job:2`;
  assert.equal(validateData(wrongTier), false);
  assert.equal(
    validateData({
      ...valid,
      rewards: valid.rewards.filter((r) => !r.id.startsWith("goal:")),
    }),
    false,
  );
  const unknownReward = {
    ...valid,
    rewards: [
      ...valid.rewards,
      { id: "unknown", label: "unknown", amount: 5, date: day, week: day },
    ],
  };
  assert.equal(validateData(unknownReward), false);
});

test("valid backups retain earned rewards when a new interview lowers progress", () => {
  let data = completeTask(dataWith(task("cv", "resume", 18)), "cv", day);
  data = saveTask(data, task("new-interview", "interview"), day);
  assert.equal(weekStats(data, day).jobPercent, 50);
  assert.equal(balance(data), 35);
  assert.equal(validateData(data), true);
});

test("historical daily plans may reference completed and archived tasks", () => {
  let data = chooseDaily(dataWith(task("a"), task("b")), day, ["a", "b"]);
  data = completeTask(data, "a", day);
  data = archiveTasks(data, ["b"]);
  assert.equal(validateData(data), true);
});

test("single-unit contribution kinds reject unsupported backup amounts", () => {
  for (const kind of ["interview", "course", "none"]) {
    assert.equal(validateData(dataWith(task("a", kind, 2))), false);
  }
});

test("an interview completed before its planned week satisfies that week", () => {
  const next = "2026-10-19";
  let data = dataWith(
    task("early", "interview", 1, { plannedWeek: next }),
    task("cv", "resume", 15, { plannedWeek: next }),
  );
  data = completeTask(data, "early", "2026-10-13");
  data = completeTask(data, "cv", "2026-10-20");
  assert.equal(weekStats(data, next).interviewDone, 1);
  assert.equal(weekStats(data, next).jobComplete, true);
  assert.equal(
    data.rewards.some((r) => r.id === `goal:${next}:job`),
    true,
  );
  assert.equal(validateData(data), true);
});
test("moving the last open interview away settles the now-met goal", () => {
  let data = dataWith(task("cv", "resume", 15), task("interview", "interview"));
  data = completeTask(data, "cv", "2026-10-13");
  assert.equal(balance(data), 5);
  data = moveTasks(data, ["interview"], "2026-10-14");
  assert.equal(balance(data), 25);
  const goal = data.rewards.find((r) => r.id === `goal:${day}:job`);
  assert.equal(goal.date, "2026-10-14");
  assert.equal(validateData(data), true);
});
test("moving to next week never pulls later-planned tasks back", () => {
  const later = "2026-10-26";
  let data = dataWith(task("later", "none", 1, { plannedWeek: later }));
  data = { ...data, daily: { [day]: ["later"] } };
  const moved = moveTasks(data, ["later"], day);
  assert.equal(moved.tasks[0].plannedWeek, later);
  assert.deepEqual(moved.daily[day], ["later"]);
});
test("imported backups keep only known fields", () => {
  const done = completeTask(dataWith(task("a")), "a", day);
  const extra = structuredClone(done);
  extra.extra = "x";
  extra.tasks[0].note = "x";
  extra.completions[0].note = "x";
  extra.rewards[0].note = "x";
  extra.events = [
    { id: "e", title: "t", date: day, time: "", kind: "reminder", note: "", x: 1 },
  ];
  assert.equal(validateData(extra), true);
  assert.deepEqual(normalizeData(extra), {
    ...done,
    events: [{ id: "e", title: "t", date: day, time: "", kind: "reminder", note: "" }],
  });
});
test("today's view keeps completed tasks checked in the same list without using core slots", () => {
  let data = dataWith(task("a"), task("b"), task("c"), task("d"), task("e"));
  data = chooseDaily(data, day, ["a", "b", "c"]);
  data = completeTask(data, "a", day);
  data = completeTask(data, "d", day);
  data = completeTask(data, "e", addDays(day, -1));
  data = chooseDaily(data, day, ["b", "c", "x"]);
  const view = dailyView(data, day);
  assert.deepEqual(
    view.map((t) => [t.id, t.status]),
    [
      ["b", "open"],
      ["c", "open"],
      ["a", "done"],
      ["d", "done"],
    ],
  );
  assert.equal(new Set(view.map((t) => t.id)).size, view.length);
  assert.ok(view.filter((t) => t.status === "open").length <= 3);
});
test("task titles determine the goal contribution and quantity", () => {
  const cases = [
    ["投递3份简历", "job", "resume", 3],
    ["改简历", "job", "resume", 1],
    ["准备汇丰面试", "job", "interview", 1],
    ["完成在线测试", "job", "interview", 1],
    ["整理求职笔记", "job", "none", 1],
    ["粤语练习2次", "speech", "cantonese", 2],
    ["粤语对话60分钟", "speech", "cantonese", 2],
    ["粤语听力20分钟", "speech", "listening", 20],
    ["英语面试题 9题", "speech", "english", 9],
    ["背单词", "speech", "none", 1],
    ["统计作业 Week 6 交3份报告", "course", "course", 1],
  ];
  for (const [title, category, kind, amount] of cases)
    assert.deepEqual(inferContribution(title, category), { kind, amount }, title);
});
const nextDay = "2026-10-13";
const auto = (series, n, week = day) => `auto:${week}:${series}:${n}`;
test("each week generates the eight fixed tasks once", () => {
  const data = ensureWeek(emptyData(), nextDay);
  assert.equal(data.autoWeek, day);
  assert.deepEqual(
    data.tasks.map((t) => [t.id, t.title, t.kind, t.amount, t.plannedWeek]),
    [
      [auto("resume", 1), "香港秋招简历x5", "resume", 5, day],
      [auto("resume", 2), "香港秋招简历x5", "resume", 5, day],
      [auto("resume", 3), "香港秋招简历x5", "resume", 5, day],
      [auto("english", 1), "英语面试练习3题", "english", 3, day],
      [auto("english", 2), "英语面试练习3题", "english", 3, day],
      [auto("english", 3), "英语面试练习3题", "english", 3, day],
      [auto("cantonese", 1), "粤语30分钟", "cantonese", 1, day],
      [auto("cantonese", 2), "粤语30分钟", "cantonese", 1, day],
    ],
  );
  assert.equal(ensureWeek(data, "2026-10-18"), data);
  assert.equal(validateData(data), true);
  const cleared = archiveTasks(data, [auto("resume", 3)]);
  assert.equal(ensureWeek(cleared, day), cleared);
});
test("a new week clears last week's open generated tasks but keeps records", () => {
  let data = ensureWeek(emptyData(), day);
  data = completeTask(data, auto("resume", 1), day);
  data = saveTask(data, task("mine"), day);
  const next = ensureWeek(data, "2026-10-19");
  const status = (id) => next.tasks.find((t) => t.id === id).status;
  assert.equal(status(auto("resume", 1)), "done");
  assert.equal(status(auto("resume", 2)), "archived");
  assert.equal(status(auto("cantonese", 2)), "archived");
  assert.equal(status("mine"), "open");
  assert.equal(next.tasks.filter((t) => t.plannedWeek === "2026-10-19").length, 8);
  assert.equal(balance(next), balance(data));
  assert.equal(validateData(next), true);
  const restored = {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === auto("resume", 2) ? { ...t, status: "open" } : t,
    ),
  };
  assert.equal(ensureWeek(restored, "2026-10-20"), restored);
});
test("daily plan: resume first, ordinary tasks next, then one speech task", () => {
  let data = ensureWeek(dataWith(task("a", "none", 1, { priority: 0 }), task("b")), day);
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    [auto("resume", 1), "a", auto("english", 1)],
  );
  data = ensureWeek(emptyData(), day);
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    [auto("resume", 1), auto("english", 1)],
  );
});
test("each series appears once a day and Cantonese waits for English", () => {
  let data = ensureWeek(emptyData(), day);
  data = finishAll(data, [auto("resume", 1), auto("english", 1)]);
  assert.deepEqual(dailyTasks(data, day), []);
  assert.deepEqual(
    dailyView(data, day).map((t) => t.id),
    [auto("resume", 1), auto("english", 1)],
  );
  assert.deepEqual(
    dailyTasks(data, nextDay).map((t) => t.id),
    [auto("resume", 2), auto("english", 2)],
  );
  data = finishAll(data, [auto("english", 2), auto("english", 3)], nextDay);
  assert.deepEqual(
    dailyTasks(data, "2026-10-14").map((t) => t.id),
    [auto("resume", 2), auto("cantonese", 1)],
  );
});
test("resume stays guaranteed when ordinary tasks are overdue", () => {
  const data = ensureWeek(
    dataWith(
      ...[1, 2, 3].map((i) => task(`u${i}`, "none", 1, { dueDate: addDays(day, -i) })),
    ),
    day,
  );
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    [auto("resume", 1), "u3", "u2"],
  );
});
test("manual planning ignores the weekly series rules", () => {
  const data = chooseDaily(ensureWeek(dataWith(task("a")), day), day, ["a"]);
  assert.deepEqual(dailyTasks(data, day).map((t) => t.id), ["a"]);
});
test("generated titles keep their quantity when re-inferred", () => {
  assert.deepEqual(inferContribution("香港秋招简历x5", "job"), { kind: "resume", amount: 5 });
  assert.deepEqual(inferContribution("英语面试练习3题", "speech"), { kind: "english", amount: 3 });
  assert.deepEqual(inferContribution("粤语30分钟", "speech"), { kind: "cantonese", amount: 1 });
});
