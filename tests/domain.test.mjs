import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  archiveTasks,
  balance,
  buildInterviewSteps,
  chooseDaily,
  cleanupDuplicateTasks,
  completeTask,
  computeCourseWeek,
  dailyTasks,
  dailyView,
  emptyData,
  ensureWeek,
  generatedSeries,
  getStepEncouragement,
  SERIES_NAME,
  inferContribution,
  interviewRewardInfo,
  localDate,
  MOCK_INTERVIEW_STEPS,
  monthBalance,
  moveTasks,
  normalizeData,
  poolTasks,
  saveTask,
  setInterviewSteps,
  shouldSuggestInterviewSplit,
  toggleInterviewStep,
  uncompleteTask,
  upgradeData,
  settleRewards,
  validateData,
  validDate,
  VIDEO_INTERVIEW_STEPS,
  weekStart,
  weekStats,
  yearlyMonthsStats,
  getStartMonth,
  visibleYearlyMonthsStats,
} from "../src/domain.ts";

const day = "2026-10-12";
function task(id, kind = "none", amount = 1, extra = {}) {
  const category = ["resume", "interview", "test"].includes(kind)
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
test("course completion receives its single reward and is idempotent", () => {
  const data = dataWith(task("course", "course"));
  const done = completeTask(data, "course", day);
  assert.equal(balance(done), 1);
  assert.equal(done.completions.length, 1);
  assert.deepEqual(completeTask(done, "course", day), done);
  assert.equal(validateData(done), true);
});
test("task contribution records quantity rather than task count", () => {
  const done = completeTask(dataWith(task("cv", "resume", 3)), "cv", day);
  assert.equal(weekStats(done, day).resumes, 3);
  assert.equal(balance(done), 4);
});
test("job target needs 15 resumes AND all scheduled interviews", () => {
  let data = dataWith(task("cv", "resume", 15), task("interview", "interview"));
  data = completeTask(data, "cv", day);
  assert.equal(weekStats(data, day).jobPercent, 50);
  assert.equal(balance(data), 4);
  data = completeTask(data, "interview", day);
  assert.equal(weekStats(data, day).jobPercent, 100);
  assert.equal(balance(data), 26);
  assert.equal(settleRewards(data, day, day).rewards.length, 3);
});
test("no scheduled interview means that condition is already satisfied", () => {
  const data = completeTask(dataWith(task("cv", "resume", 15)), "cv", day);
  assert.equal(weekStats(data, day).interviewTotal, 0);
  assert.equal(weekStats(data, day).jobComplete, true);
  assert.equal(balance(data), 14);
});
test("job challenges accumulate early and are paid after base target completion", () => {
  let data = dataWith(task("cv", "resume", 22), task("interview", "interview"));
  data = completeTask(data, "cv", day);
  assert.equal(balance(data), 4);
  data = completeTask(data, "interview", day);
  assert.equal(balance(data), 34); // resume 4, interview 12, base 10, two extra tiers 8
  assert.equal(weekStats(data, day).jobTiers, 2);
  assert.equal(balance(settleRewards(data, day, day)), 34);
});
test("new interview recalculates progress without retracting or reissuing rewards", () => {
  let data = completeTask(dataWith(task("cv", "resume", 18)), "cv", day);
  assert.equal(balance(data), 18);
  data = saveTask(data, task("late", "interview"), day);
  assert.equal(weekStats(data, day).jobPercent, 50);
  assert.equal(balance(data), 18);
  data = completeTask(data, "late", day);
  assert.equal(balance(data), 30);
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
  assert.equal(balance(data), 2);
  data = completeTask(data, "english", day);
  assert.equal(weekStats(data, day).speechPercent, 100);
  assert.equal(balance(data), 13);
});
test("listening is accumulated in whole ten-minute tiers and retroactively paid", () => {
  let data = dataWith(
    task("listen", "listening", 25),
    task("c", "cantonese", 2),
    task("e", "english", 9),
  );
  data = completeTask(data, "listen", day);
  assert.equal(balance(data), 2);
  data = finishAll(data, ["c", "e"]);
  assert.equal(balance(data), 19);
  data = saveTask(data, task("listen2", "listening", 5), day);
  data = completeTask(data, "listen2", day);
  assert.equal(balance(data), 23); // new task +2, third listening tier +2
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
  assert.equal(balance(data), 28);
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
  assert.equal(balance(moved), 1);
  assert.deepEqual(moved.daily[day], []);
  const cleared = archiveTasks(data, ["open", "done"]);
  assert.equal(cleared.tasks.find((t) => t.id === "done").status, "done");
  assert.equal(cleared.tasks.find((t) => t.id === "open").status, "archived");
  assert.equal(balance(cleared), 1);
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
test("manual planning is exact, deduplicated, and can be explicitly empty or exceed default three", () => {
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
    ["b", "a", "c", "d"],
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
  assert.equal(balance(data), 18);
  assert.equal(validateData(data), true);
});

test("historical daily plans may reference completed and archived tasks", () => {
  let data = chooseDaily(dataWith(task("a"), task("b")), day, ["a", "b"]);
  data = completeTask(data, "a", day);
  data = archiveTasks(data, ["b"]);
  assert.equal(validateData(data), true);
});

test("single-unit contribution kinds reject unsupported backup amounts", () => {
  for (const kind of ["interview", "test", "course", "none"]) {
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
  assert.equal(balance(data), 4);
  data = moveTasks(data, ["interview"], "2026-10-14");
  assert.equal(balance(data), 14);
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
    ["完成在线测试", "job", "test", 1],
    ["汇丰笔试", "job", "test", 1],
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
  const status = (id) => next.tasks.find((t) => t.id === id)?.status;
  assert.equal(status(auto("resume", 1)), "done");
  // Uncompleted weekly generated tasks are removed instead of polluting "已清空"
  assert.equal(next.tasks.find((t) => t.id === auto("resume", 2)), undefined);
  assert.equal(next.tasks.find((t) => t.id === auto("cantonese", 2)), undefined);
  assert.equal(status("mine"), "open");
  assert.equal(next.tasks.filter((t) => t.plannedWeek === "2026-10-19").length, 8);
  assert.equal(balance(next), balance(data));
  assert.equal(validateData(next), true);
});
test("daily plan: P0 tasks first, then P1 series and ordinary tasks", () => {
  let data = ensureWeek(dataWith(task("a", "none", 1, { priority: 0 }), task("b")), day);
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    ["a", auto("resume", 1), auto("english", 1)],
  );
  data = ensureWeek(emptyData(), day);
  assert.deepEqual(
    dailyTasks(data, day).map((t) => t.id),
    [auto("resume", 1), auto("english", 1)],
  );
});
test("daily tasks always sorted by priority P0-P2 regardless of manual addition order", () => {
  const data = dataWith(
    task("p1_task", "none", 1, { priority: 1 }),
    task("p2_task", "none", 1, { priority: 2 }),
    task("p0_task", "none", 1, { priority: 0 }),
  );
  const chosen = chooseDaily(data, day, ["p1_task", "p2_task", "p0_task"]);
  assert.deepEqual(
    dailyTasks(chosen, day).map((t) => t.id),
    ["p0_task", "p1_task", "p2_task"],
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
test("a task completed today can be undone and loses its own reward", () => {
  const data = dataWith(task("a"));
  const done = completeTask(data, "a", day);
  const undone = uncompleteTask(done, "a", day);
  assert.deepEqual(undone, data);
  assert.equal(validateData(undone), true);
  assert.equal(uncompleteTask(undone, "a", day), undone);
  assert.equal(uncompleteTask(done, "a", nextDay), done);
});
test("undo revokes the goal and tiers that completion produced today", () => {
  const data = completeTask(dataWith(task("cv", "resume", 18)), "cv", day);
  assert.equal(balance(data), 18);
  const undone = uncompleteTask(data, "cv", day);
  assert.equal(balance(undone), 0);
  assert.equal(validateData(undone), true);
});
test("undo keeps rewards earned on earlier days", () => {
  let data = dataWith(task("cv1", "resume", 15), task("cv2", "resume", 3));
  data = completeTask(data, "cv1", day);
  data = completeTask(data, "cv2", nextDay);
  assert.equal(balance(data), 22);
  const undone = uncompleteTask(data, "cv2", nextDay);
  assert.equal(balance(undone), 14);
  assert.equal(undone.rewards.some((r) => r.id === `goal:${day}:job`), true);
  assert.equal(validateData(undone), true);
});
test("undoing the interview that completed the goal revokes it", () => {
  let data = dataWith(task("cv", "resume", 15), task("iv", "interview"));
  data = finishAll(data, ["cv", "iv"]);
  assert.equal(balance(data), 26);
  const undone = uncompleteTask(data, "iv", day);
  assert.equal(balance(undone), 4);
  assert.equal(weekStats(undone, day).jobComplete, false);
  assert.equal(validateData(undone), true);
});
test("undoing an unrelated task never touches goal rewards", () => {
  let data = finishAll(dataWith(task("cv", "resume", 15), task("hw", "course")), ["cv", "hw"]);
  data = saveTask(data, task("late", "interview"), day);
  assert.equal(balance(data), 15);
  const undone = uncompleteTask(data, "hw", day);
  assert.equal(balance(undone), 14);
  assert.equal(undone.rewards.some((r) => r.id === `goal:${day}:job`), true);
  assert.equal(validateData(undone), true);
});
test("undoing speaking and listening revokes only the unsupported part", () => {
  let data = dataWith(
    task("c", "cantonese", 2),
    task("e", "english", 9),
    task("l1", "listening", 10),
    task("l2", "listening", 10),
  );
  data = finishAll(data, ["c", "e", "l1"]);
  data = completeTask(data, "l2", nextDay);
  assert.equal(balance(data), 21); // tasks 2+4+2+2, goal 7, two listening tiers 4
  const lessListening = uncompleteTask(data, "l2", nextDay);
  assert.equal(balance(lessListening), 17);
  assert.equal(validateData(lessListening), true);
  const noGoal = uncompleteTask(lessListening, "e", day);
  assert.equal(balance(noGoal), 4);
  assert.equal(validateData(noGoal), true);
});
test("an undone weekly task returns to today's plan", () => {
  let data = ensureWeek(emptyData(), day);
  data = completeTask(data, auto("resume", 1), day);
  assert.equal(dailyTasks(data, day).some((t) => t.id.includes("resume")), false);
  data = uncompleteTask(data, auto("resume", 1), day);
  assert.equal(dailyTasks(data, day)[0].id, auto("resume", 1));
});
test("without scheduled interviews job progress follows resumes only", () => {
  assert.equal(weekStats(emptyData(), day).jobPercent, 0);
  const six = completeTask(dataWith(task("cv", "resume", 6)), "cv", day);
  assert.equal(weekStats(six, day).jobPercent, 40);
  const full = completeTask(dataWith(task("cv", "resume", 15)), "cv", day);
  assert.equal(weekStats(full, day).jobPercent, 100);
  const withInterview = dataWith(task("iv", "interview"));
  assert.equal(weekStats(withInterview, day).jobPercent, 0);
});
test("each kind of task earns its own reward", () => {
  const cases = [
    ["none", 1, 2],
    ["resume", 3, 4],
    ["test", 1, 8],
    ["cantonese", 1, 2],
    ["english", 3, 4],
    ["listening", 5, 2],
    ["course", 1, 1],
  ];
  for (const [kind, amount, reward] of cases) {
    const done = completeTask(dataWith(task("x", kind, amount)), "x", day);
    assert.equal(balance(done), reward, kind);
    assert.equal(validateData(done), true, kind);
  }
});
test("interview reward depends on days since it was added, not on its DDL", () => {
  const created = { createdAt: "2026-10-12T09:00:00", dueDate: "2026-10-30" };
  for (const [date, reward] of [
    ["2026-10-12", 12],
    ["2026-10-15", 12],
    ["2026-10-16", 4],
    ["2026-10-18", 4],
    ["2026-10-19", 2],
    ["2026-10-22", 2],
    ["2026-10-23", 1],
  ]) {
    const done = completeTask(dataWith(task("iv", "interview", 1, created)), "iv", date);
    assert.equal(done.rewards.find((r) => r.id === "task:iv").amount, reward, date);
    assert.equal(validateData(done), true, date);
  }
  const forged = completeTask(dataWith(task("iv", "interview", 1, created)), "iv", "2026-10-23");
  forged.rewards[0].amount = 12;
  assert.equal(validateData(forged), false);
});
test("tests and written exams gate the job goal like interviews", () => {
  let data = dataWith(task("cv", "resume", 15), task("t", "test"));
  data = completeTask(data, "cv", day);
  assert.equal(weekStats(data, day).jobComplete, false);
  assert.equal(weekStats(data, day).jobPercent, 50);
  data = completeTask(data, "t", day);
  assert.equal(weekStats(data, day).jobComplete, true);
  assert.equal(balance(data), 4 + 8 + 10);
  const undone = uncompleteTask(data, "t", day);
  assert.equal(balance(undone), 4);
});
test("version 1 records are recomputed under the new reward rules", () => {
  const legacy = {
    version: 1,
    tasks: [
      { ...task("cv", "resume", 18), status: "done" },
      { ...task("t", "interview", 1, { title: "在线测试" }), status: "done" },
      { ...task("c", "course"), status: "done" },
    ],
    completions: [
      { taskId: "cv", title: "任务 cv", category: "job", kind: "resume", amount: 18, date: day, week: day },
      { taskId: "t", title: "在线测试", category: "job", kind: "interview", amount: 1, date: day, week: day },
      { taskId: "c", title: "任务 c", category: "course", kind: "course", amount: 1, date: day, week: day },
    ],
    rewards: [
      { id: "task:cv", amount: 5, label: "任务 cv", date: day, week: day },
      { id: "task:t", amount: 5, label: "在线测试", date: day, week: day },
      { id: "task:c", amount: 5, label: "任务 c", date: day, week: day },
      { id: `goal:${day}:job`, amount: 20, label: "香港揾工 · 本周基础目标", date: day, week: day },
      { id: `bonus:${day}:job:1`, amount: 10, label: "额外", date: day, week: day },
    ],
    daily: {},
    events: [],
    courseWeek: 6,
  };
  assert.equal(validateData(legacy), false);
  const upgraded = upgradeData(legacy);
  assert.equal(upgraded.version, 2);
  assert.equal(upgraded.tasks.find((t) => t.id === "t").kind, "test");
  assert.equal(upgraded.completions.find((c) => c.taskId === "t").kind, "test");
  assert.deepEqual(
    upgraded.rewards.map((r) => [r.id, r.amount]),
    [["task:cv", 4], ["task:t", 8], ["task:c", 1], [`goal:${day}:job`, 10], [`bonus:${day}:job:1`, 4]],
  );
  assert.equal(validateData(upgraded), true);
  const current = completeTask(dataWith(task("a")), "a", day);
  assert.equal(upgradeData(current), current);
  assert.equal(upgradeData({ ...legacy, rewards: [] }), null);
  assert.equal(upgradeData("broken"), null);
});
test("interview cards can show the current reward and when it next drops", () => {
  const iv = task("iv", "interview", 1, { createdAt: "2026-10-12T09:00:00" });
  assert.deepEqual(interviewRewardInfo(iv, "2026-10-12"), { now: 12, next: 4, inDays: 4 });
  assert.deepEqual(interviewRewardInfo(iv, "2026-10-15"), { now: 12, next: 4, inDays: 1 });
  assert.deepEqual(interviewRewardInfo(iv, "2026-10-16"), { now: 4, next: 2, inDays: 3 });
  assert.deepEqual(interviewRewardInfo(iv, "2026-10-22"), { now: 2, next: 1, inDays: 1 });
  assert.deepEqual(interviewRewardInfo(iv, "2026-10-23"), { now: 1 });
});
test("generated tasks report their series and todo display name", () => {
  const data = ensureWeek(emptyData(), day);
  const names = data.tasks.map((t) => [generatedSeries(t), SERIES_NAME[generatedSeries(t)]]);
  assert.deepEqual(names[0], ["resume", "香港秋招简历投递"]);
  assert.deepEqual(names[3], ["english", "英语口语练习"]);
  assert.deepEqual(names[6], ["cantonese", "粤语口语练习"]);
  assert.equal(generatedSeries(task("mine", "resume", 5)), undefined);
});

test("createdAt later than date clamps daysSinceAdded to 0 and inDays never exceeds 4", () => {
  const futureTask = task("future", "interview", 1, { createdAt: "2026-10-15T09:00:00" });
  const info = interviewRewardInfo(futureTask, "2026-10-12");
  assert.equal(info.now, 12);
  assert.equal(info.next, 4);
  assert.equal(info.inDays, 4);
});

test("cross-midnight saveTask aligns plannedWeek of new tasks to current week", () => {
  const prevWeek = "2026-10-05";
  const thisWeek = "2026-10-12";
  const newTask = task("new-one", "none", 1, { plannedWeek: prevWeek });
  const saved = saveTask(emptyData(), newTask, thisWeek);
  assert.equal(saved.tasks[0].plannedWeek, thisWeek);
});

test("manual planning releases slots on completion allowing new tasks and preserves empty list", () => {
  const t1 = task("t1");
  const t2 = task("t2");
  const t3 = task("t3");
  const t4 = task("t4");
  let data = dataWith(t1, t2, t3, t4);
  // User manually schedules 3 tasks
  data = chooseDaily(data, day, ["t1", "t2", "t3"]);
  assert.equal(dailyTasks(data, day).length, 3);

  // Complete t1
  data = completeTask(data, "t1", day);
  const remaining = dailyTasks(data, day);
  // Slot is freed: only 2 open tasks remain in core slots
  assert.equal(remaining.length, 2);
  assert.deepEqual(remaining.map((t) => t.id), ["t2", "t3"]);

  // Now t4 can be added
  data = chooseDaily(data, day, [...remaining.map((t) => t.id), "t4"]);
  assert.equal(dailyTasks(data, day).length, 3);
  assert.deepEqual(dailyTasks(data, day).map((t) => t.id), ["t2", "t3", "t4"]);

  // Removing all tasks leaves explicit empty array
  data = chooseDaily(data, day, []);
  assert.deepEqual(data.daily[day], []);
  assert.equal(dailyTasks(data, day).length, 0);
});

test("interview split: trigger condition requires open interview with DDL overdue by at least 3 days", () => {
  // Overdue 2 days -> false
  const iv2 = task("iv2", "interview", 1, { dueDate: "2026-10-10" });
  assert.equal(shouldSuggestInterviewSplit(iv2, "2026-10-12"), false);

  // Overdue 3 days -> true
  const iv3 = task("iv3", "interview", 1, { dueDate: "2026-10-09" });
  assert.equal(shouldSuggestInterviewSplit(iv3, "2026-10-12"), true);

  // Overdue 5 days -> true
  const iv5 = task("iv5", "interview", 1, { dueDate: "2026-10-07" });
  assert.equal(shouldSuggestInterviewSplit(iv5, "2026-10-12"), true);

  // No DDL -> false
  const ivNoDdl = task("ivNoDdl", "interview", 1, { dueDate: "" });
  assert.equal(shouldSuggestInterviewSplit(ivNoDdl, "2026-10-12"), false);

  // Already done -> false
  const ivDone = task("ivDone", "interview", 1, { dueDate: "2026-10-07", status: "done" });
  assert.equal(shouldSuggestInterviewSplit(ivDone, "2026-10-12"), false);

  // Non-interview -> false
  const nonIv = task("nonIv", "test", 1, { dueDate: "2026-10-07" });
  assert.equal(shouldSuggestInterviewSplit(nonIv, "2026-10-12"), false);
});

test("buildInterviewSteps generates correct deduplicated steps for 1, 2, 4, 8 questions", () => {
  const s1 = buildInterviewSteps(1);
  assert.equal(s1.length, 9);
  assert.ok(!s1.some((s) => s.title.includes("记住2道")));
  assert.ok(!s1.some((s) => s.title.includes("记住5道")));
  assert.equal(s1[3].title, "记住所有回答（共1道）");

  const s2 = buildInterviewSteps(2);
  assert.equal(s2.length, 9);
  assert.ok(!s2.some((s) => s.title === "记住2道回答"));
  assert.equal(s2[3].title, "记住所有回答（共2道）");

  const s4 = buildInterviewSteps(4);
  assert.equal(s4.length, 10);
  assert.equal(s4[3].title, "记住2道回答");
  assert.equal(s4[4].title, "记住所有回答（共4道）");

  const s8 = buildInterviewSteps(8);
  assert.equal(s8.length, 11);
  assert.equal(s8[3].title, "记住2道回答");
  assert.equal(s8[4].title, "记住5道回答");
  assert.equal(s8[5].title, "记住所有回答（共8道）");
});

test("step toggles do not grant rewards until the last step completes the interview task", () => {
  const iv = task("iv", "interview", 1, {
    dueDate: "2026-10-08",
    createdAt: "2026-10-12T08:00:00",
  });
  let data = dataWith(iv);
  const steps = [
    { id: "s1", title: "搜集问题", done: false },
    { id: "s2", title: "写出回答", done: false },
    { id: "s3", title: "录视频", done: false },
  ];
  data = setInterviewSteps(data, "iv", steps);
  assert.equal(data.tasks[0].steps.length, 3);
  assert.equal(balance(data), 0);

  // Check step 1: no reward
  data = toggleInterviewStep(data, "iv", "s1", day);
  assert.equal(data.tasks[0].status, "open");
  assert.equal(data.tasks[0].steps[0].done, true);
  assert.equal(balance(data), 0);

  // Check step 2: no reward
  data = toggleInterviewStep(data, "iv", "s2", day);
  assert.equal(data.tasks[0].status, "open");
  assert.equal(balance(data), 0);

  // Check step 3 (last step): completes task and awards interview reward (12)
  data = toggleInterviewStep(data, "iv", "s3", day);
  assert.equal(data.tasks[0].status, "done");
  assert.equal(data.completions.length, 1);
  assert.equal(balance(data), 12);
  assert.ok(data.tasks[0].steps.every((s) => s.done));

  // Uncomplete task resets last step and revokes reward
  data = uncompleteTask(data, "iv", day);
  assert.equal(data.tasks[0].status, "open");
  assert.equal(data.tasks[0].steps[2].done, false);
  assert.equal(data.tasks[0].steps[0].done, true);
  assert.equal(data.tasks[0].steps[1].done, true);
  assert.equal(balance(data), 0);
});

test("PRD 4.2: buildInterviewSteps generates exact 11 steps for video and interview templates", () => {
  const videoSteps = buildInterviewSteps("video");
  assert.equal(videoSteps.length, 11);
  assert.deepEqual(
    videoSteps.map((s) => s.title),
    [...VIDEO_INTERVIEW_STEPS],
  );
  assert.equal(videoSteps[0].title, "搜集问题");
  assert.equal(videoSteps[6].title, "录一次视频");
  assert.equal(videoSteps[10].title, "录最终视频");

  const ivSteps = buildInterviewSteps("interview");
  assert.equal(ivSteps.length, 11);
  assert.deepEqual(
    ivSteps.map((s) => s.title),
    [...MOCK_INTERVIEW_STEPS],
  );
  assert.equal(ivSteps[0].title, "搜集问题");
  assert.equal(ivSteps[6].title, "Mock interview 10 题");
  assert.equal(ivSteps[7].title, "复盘薄弱项，复读 3 遍");
  assert.equal(ivSteps[10].title, "完成面试");
});

test("PRD 4.2: steps must be checked in sequence without skipping", () => {
  const iv = task("iv-seq", "interview", 1, {
    dueDate: "2026-10-15",
    steps: buildInterviewSteps("interview"),
  });
  let data = dataWith(iv);

  // Trying to check step 2 while step 1 is not done is rejected
  data = toggleInterviewStep(data, "iv-seq", "step-2", day);
  assert.equal(data.tasks[0].steps[1].done, false);

  // Check step 1: succeeds
  data = toggleInterviewStep(data, "iv-seq", "step-1", day);
  assert.equal(data.tasks[0].steps[0].done, true);

  // Trying to check step 3 while step 2 is not done is rejected
  data = toggleInterviewStep(data, "iv-seq", "step-3", day);
  assert.equal(data.tasks[0].steps[2].done, false);

  // Check step 2: succeeds
  data = toggleInterviewStep(data, "iv-seq", "step-2", day);
  assert.equal(data.tasks[0].steps[1].done, true);

  // Trying to uncheck step 1 while step 2 is done is rejected
  data = toggleInterviewStep(data, "iv-seq", "step-1", day);
  assert.equal(data.tasks[0].steps[0].done, true);

  // Unchecking step 2 succeeds
  data = toggleInterviewStep(data, "iv-seq", "step-2", day);
  assert.equal(data.tasks[0].steps[1].done, false);

  // Now unchecking step 1 succeeds
  data = toggleInterviewStep(data, "iv-seq", "step-1", day);
  assert.equal(data.tasks[0].steps[0].done, false);
});

test("PRD 4.2: completing all 11 steps sequentially completes the parent interview task", () => {
  const iv = task("iv-11", "interview", 1, {
    createdAt: "2026-10-12T09:00:00",
    steps: buildInterviewSteps("video"),
  });
  let data = dataWith(iv);

  for (let i = 1; i <= 10; i++) {
    data = toggleInterviewStep(data, "iv-11", `step-${i}`, day);
    assert.equal(data.tasks[0].status, "open");
    assert.equal(balance(data), 0);
  }

  // Completing the 11th step completes the interview task and awards 12 kalami
  data = toggleInterviewStep(data, "iv-11", "step-11", day);
  assert.equal(data.tasks[0].status, "done");
  assert.equal(balance(data), 12);
  assert.ok(data.tasks[0].steps.every((s) => s.done));
});

test("PRD 4.2: getStepEncouragement returns tailored messages for interview steps", () => {
  assert.ok(getStepEncouragement("搜集问题").includes("搜集问题"));
  assert.ok(getStepEncouragement("写出所有问题的回答").includes("写出回答"));
  assert.ok(getStepEncouragement("录一次视频").includes("面对镜头"));
  assert.ok(getStepEncouragement("Mock interview 10 题").includes("Mock"));
  assert.ok(getStepEncouragement("未知步骤").includes("踏实"));
});

test("tasks with steps survive validateData and normalizeData", () => {
  const iv = task("iv", "interview", 1, {
    dueDate: "2026-10-08",
    steps: buildInterviewSteps(3),
  });
  const data = dataWith(iv);
  assert.equal(validateData(data), true);
  const normalized = normalizeData(data);
  assert.equal(validateData(normalized), true);
  assert.equal(normalized.tasks[0].steps.length, 10);
});

test("any task can be decomposed into custom steps and cleared", () => {
  const ordinary = task("hw-1", "course", 1, { title: "课程作业3" });
  let data = dataWith(ordinary);
  const steps = [
    { id: "s1", title: "阅读章节", done: false },
    { id: "s2", title: "编写代码", done: false },
  ];
  data = setInterviewSteps(data, "hw-1", steps);
  assert.equal(data.tasks[0].steps.length, 2);

  // Toggle step 1
  data = toggleInterviewStep(data, "hw-1", "s1", day);
  assert.equal(data.tasks[0].status, "open");
  assert.equal(data.tasks[0].steps[0].done, true);
  assert.equal(balance(data), 0);

  // Toggle step 2 -> complete ordinary course task (awards course reward: 1)
  data = toggleInterviewStep(data, "hw-1", "s2", day);
  assert.equal(data.tasks[0].status, "done");
  assert.equal(balance(data), 1);

  // Clearing steps on an open task removes steps field
  let openData = dataWith(ordinary);
  openData = setInterviewSteps(openData, "hw-1", steps);
  assert.equal(openData.tasks[0].steps.length, 2);
  openData = setInterviewSteps(openData, "hw-1", []);
  assert.equal(openData.tasks[0].steps, undefined);
});

test("monthBalance accurately computes balance strictly for a given month", () => {
  const data = {
    ...emptyData(),
    rewards: [
      { id: "r1", amount: 10, label: "任务1", date: "2026-09-30", week: "2026-09-28" },
      { id: "r2", amount: 25, label: "任务2", date: "2026-10-01", week: "2026-09-28" },
      { id: "r3", amount: 20, label: "任务3", date: "2026-10-15", week: "2026-10-12" },
      { id: "r4", amount: 15, label: "任务4", date: "2026-11-02", week: "2026-11-02" },
    ],
  };

  assert.equal(monthBalance(data, "2026-09"), 10);
  assert.equal(monthBalance(data, "2026-10"), 45);
  assert.equal(monthBalance(data, "2026-11"), 15);
  assert.equal(monthBalance(data, "2026-12"), 0);
  assert.equal(balance(data), 70);
});

test("yearlyMonthsStats returns 12 months with correct totals, fullJars, and remCoins", () => {
  const data = {
    ...emptyData(),
    rewards: [
      { id: "r1", amount: 45, label: "1月", date: "2026-01-10", week: "2026-01-05" },
      { id: "r2", amount: 120, label: "3月满罐", date: "2026-03-12", week: "2026-03-09" },
      { id: "r3", amount: 205, label: "5月两罐", date: "2026-05-18", week: "2026-05-18" },
      { id: "r4", amount: 50, label: "2025年奖励", date: "2025-05-18", week: "2025-05-18" },
    ],
  };

  const stats2026 = yearlyMonthsStats(data, 2026);
  assert.equal(stats2026.length, 12);

  // Jan: 45 coins, 0 full jars
  assert.deepEqual(stats2026[0], {
    month: "2026-01",
    monthNumber: 1,
    total: 45,
    fullJars: 0,
    remCoins: 45,
  });

  // Feb: 0 coins
  assert.deepEqual(stats2026[1], {
    month: "2026-02",
    monthNumber: 2,
    total: 0,
    fullJars: 0,
    remCoins: 0,
  });

  // Mar: 120 coins, 1 full jar, 20 rem
  assert.deepEqual(stats2026[2], {
    month: "2026-03",
    monthNumber: 3,
    total: 120,
    fullJars: 1,
    remCoins: 20,
  });

  // May: 205 coins, 2 full jars, 5 rem
  assert.deepEqual(stats2026[4], {
    month: "2026-05",
    monthNumber: 5,
    total: 205,
    fullJars: 2,
    remCoins: 5,
  });

  // 2025 reward was not counted in 2026
  const stats2025 = yearlyMonthsStats(data, 2025);
  assert.equal(stats2025[4].total, 50);
});

test("visibleYearlyMonthsStats displays only months starting from first recorded month this year, and 12 months for subsequent years", () => {
  const currentApp = {
    ...emptyData(),
    rewards: [
      { id: "r1", amount: 13, label: "10月任务", date: "2026-10-15", week: "2026-10-12" },
    ],
  };

  assert.equal(getStartMonth(currentApp), "2026-10");

  // This year (2026): only from 10 to 12
  const visible2026 = visibleYearlyMonthsStats(currentApp, 2026);
  assert.equal(visible2026.length, 3);
  assert.equal(visible2026[0].month, "2026-10");
  assert.equal(visible2026[0].total, 13);
  assert.equal(visible2026[1].month, "2026-11");
  assert.equal(visible2026[1].total, 0);
  assert.equal(visible2026[2].month, "2026-12");
  assert.equal(visible2026[2].total, 0);

  // Next year (2027): full 12 months
  const visible2027 = visibleYearlyMonthsStats(currentApp, 2027);
  assert.equal(visible2027.length, 12);
  assert.equal(visible2027[0].month, "2027-01");
  assert.equal(visible2027[11].month, "2027-12");

  // Prior year (2025): empty
  const visible2025 = visibleYearlyMonthsStats(currentApp, 2025);
  assert.equal(visible2025.length, 0);
});

test("daily tasks can exceed default three when user explicitly adds or chooses more tasks", () => {
  // When there are ordinary tasks, auto-planning picks 3 tasks (resume, ordinary, speech)
  let data = ensureWeek(dataWith(task("a", "none", 1, { priority: 0 }), task("b")), day);
  const defaultTasks = dailyTasks(data, day);
  assert.equal(defaultTasks.length, 3);

  // User adds a 4th custom task to today's schedule
  const customTask = task("custom_today", "none", 1, { plannedWeek: day });
  data = saveTask(data, customTask, day);
  const updatedDaily = chooseDaily(data, day, [
    ...defaultTasks.map((t) => t.id),
    customTask.id,
  ]);
  const tasksNow = dailyTasks(updatedDaily, day);
  assert.equal(tasksNow.length, 4);
  assert.ok(tasksNow.some((t) => t.id === "custom_today"));
});

test("validateData accepts daily selection with more than three tasks", () => {
  const tasks = Array.from({ length: 5 }, (_, i) => task(`t${i}`));
  const data = dataWith(...tasks);
  const withFour = {
    ...data,
    daily: {
      [day]: ["t0", "t1", "t2", "t3"],
    },
  };
  assert.equal(validateData(withFour), true);
});

test("poolTasks includes uncompleted past-week tasks and due-this-week tasks in current week view", () => {
  const pastWeek = "2026-10-12";
  const thisWeekMonday = "2026-10-19";
  const todayDate = "2026-10-20";
  const nextWeekMonday = "2026-10-26";

  const taskPastNoDdl = task("cs_noddl", "none", 1, {
    category: "course",
    plannedWeek: pastWeek,
    dueDate: "",
  });
  const taskPastWithDdlThisWeek = task("cs_assign1_due", "none", 1, {
    category: "course",
    plannedWeek: pastWeek,
    dueDate: "2026-10-23",
  });
  const taskThisWeek = task("cs_this_week", "none", 1, {
    category: "course",
    plannedWeek: thisWeekMonday,
    dueDate: "",
  });
  const taskNextWeekDueLater = task("next_task", "none", 1, {
    category: "course",
    plannedWeek: nextWeekMonday,
    dueDate: "2026-10-28",
  });
  const taskNextWeekDueThisWeek = task("next_but_urgent", "none", 1, {
    category: "job",
    plannedWeek: nextWeekMonday,
    dueDate: "2026-10-22",
  });

  const data = dataWith(
    taskPastNoDdl,
    taskPastWithDdlThisWeek,
    taskThisWeek,
    taskNextWeekDueLater,
    taskNextWeekDueThisWeek,
  );

  const currentPool = poolTasks(data, todayDate, "current", "all");
  const currentIds = currentPool.map((t) => t.id);

  // All 3 CS tasks are in the current week pool:
  assert.ok(currentIds.includes("cs_noddl"));
  assert.ok(currentIds.includes("cs_assign1_due"));
  assert.ok(currentIds.includes("cs_this_week"));
  // Next week task due this week is pulled into current pool:
  assert.ok(currentIds.includes("next_but_urgent"));
  // Next week task due next week stays out of current pool:
  assert.equal(currentIds.includes("next_task"), false);

  // Next week pool check:
  const nextPool = poolTasks(data, todayDate, "next", "all");
  const nextIds = nextPool.map((t) => t.id);
  assert.ok(nextIds.includes("next_task"));
  assert.equal(nextIds.includes("next_but_urgent"), false);

  // Category filter check:
  const coursePool = poolTasks(data, todayDate, "current", "course");
  assert.equal(coursePool.length, 3);
  assert.ok(coursePool.every((t) => t.category === "course"));
});

test("poolTasks filters correctly by status: open, done, and archived", () => {
  const thisWeek = "2026-10-19";
  const today = "2026-10-20";
  const openTask = task("t_open", "none", 1, {
    plannedWeek: thisWeek,
    category: "course",
  });
  const doneTask = task("t_done", "none", 1, {
    plannedWeek: thisWeek,
    category: "job",
  });
  const archivedTask = task("t_archived", "none", 1, {
    plannedWeek: thisWeek,
    category: "course",
    status: "archived",
  });

  let data = dataWith(openTask, doneTask, archivedTask);
  data = completeTask(data, "t_done", today);

  // Status open: only openTask
  const openList = poolTasks(data, today, "current", "all", "open");
  assert.equal(openList.length, 1);
  assert.equal(openList[0].id, "t_open");

  // Status done: only doneTask
  const doneList = poolTasks(data, today, "current", "all", "done");
  assert.equal(doneList.length, 1);
  assert.equal(doneList[0].id, "t_done");

  // Status archived: only archivedTask
  const archivedList = poolTasks(data, today, "current", "all", "archived");
  assert.equal(archivedList.length, 1);
  assert.equal(archivedList[0].id, "t_archived");
});

test("dailyTasks auto-fills uncompleted ordinary tasks carried over from past weeks", () => {
  const pastWeek = "2026-10-05";
  const currentDay = "2026-10-13";
  const oldTask = task("old_review", "none", 1, {
    category: "course",
    plannedWeek: pastWeek,
    dueDate: "",
  });
  const data = dataWith(oldTask);
  const picked = dailyTasks(data, currentDay);
  assert.ok(picked.some((t) => t.id === "old_review"));
});

test("cleanupDuplicateTasks removes duplicate open custom tasks and legacy archived clutter", () => {
  const taskWithDdl = task("cs_with_ddl", "none", 1, {
    title: "CS5187 Assign1",
    category: "course",
    dueDate: "2026-10-23",
  });
  const taskWithoutDdl = task("cs_no_ddl", "none", 1, {
    title: "CS5187 Assign1",
    category: "course",
    dueDate: "",
  });
  const distinctTask = task("cs_review", "none", 1, {
    title: "CS5187 L7复习",
    category: "course",
    dueDate: "",
  });

  const data = dataWith(taskWithoutDdl, taskWithDdl, distinctTask);
  const cleaned = cleanupDuplicateTasks(data);

  // The one with deadline remains open
  assert.equal(cleaned.tasks.find((t) => t.id === "cs_with_ddl").status, "open");
  // The duplicate one without deadline is deleted (not archived to pollute "已清空")
  assert.equal(cleaned.tasks.find((t) => t.id === "cs_no_ddl"), undefined);
  // Distinct task remains open
  assert.equal(cleaned.tasks.find((t) => t.id === "cs_review").status, "open");

  // Also purges legacy auto-archived generated tasks and duplicate archived tasks, while keeping genuine user-cleared tasks
  const legacyArchivedGen = task("auto:2026-10-12:resume:1", "resume", 5, {
    title: "香港秋招简历x5",
    status: "archived",
  });
  const legacyArchivedDup = task("cs_dup_archived", "none", 1, {
    title: "CS5187 Assign1",
    category: "course",
    status: "archived",
  });
  const userClearedTask = task("real_cleared", "none", 1, {
    title: "买水果",
    category: "course",
    status: "archived",
  });
  const dataWithLegacy = dataWith(
    taskWithDdl,
    legacyArchivedGen,
    legacyArchivedDup,
    userClearedTask,
  );
  const purged = cleanupDuplicateTasks(dataWithLegacy);
  assert.equal(
    purged.tasks.find((t) => t.id === "auto:2026-10-12:resume:1"),
    undefined,
  );
  assert.equal(purged.tasks.find((t) => t.id === "cs_dup_archived"), undefined);
  assert.equal(
    purged.tasks.find((t) => t.id === "real_cleared").status,
    "archived",
  );

  // Generated tasks with identical titles are never deduplicated
  const gen1 = task("auto:2026-10-19:resume:1", "resume", 5, {
    title: "香港秋招简历x5",
  });
  const gen2 = task("auto:2026-10-19:resume:2", "resume", 5, {
    title: "香港秋招简历x5",
  });
  const dataWithGen = dataWith(gen1, gen2);
  const cleanedGen = cleanupDuplicateTasks(dataWithGen);
  assert.equal(cleanedGen.tasks.find((t) => t.id === "auto:2026-10-19:resume:1").status, "open");
  assert.equal(cleanedGen.tasks.find((t) => t.id === "auto:2026-10-19:resume:2").status, "open");
});

test("computeCourseWeek calculates correct 1-15 week based on calendar date", () => {
  assert.equal(computeCourseWeek("2026-08-31"), 1);
  assert.equal(computeCourseWeek("2026-09-02"), 1);
  assert.equal(computeCourseWeek("2026-10-05"), 6);
  assert.equal(computeCourseWeek("2026-10-12"), 7);
  assert.equal(computeCourseWeek("2026-10-19"), 8);
  assert.equal(computeCourseWeek("2026-10-22"), 8);
  assert.equal(computeCourseWeek("2026-10-26"), 9);
  assert.equal(computeCourseWeek("2026-12-07"), 15);
  // Boundary clamping
  assert.equal(computeCourseWeek("2026-08-01"), 1);
  assert.equal(computeCourseWeek("2027-01-01"), 15);
});

test("ensureWeek automatically updates lagging courseWeek to current week and advances across weeks", () => {
  // 1. Data stuck at week 6 on week 2026-10-19 updates to week 8
  const stuckData = { ...emptyData(), courseWeek: 6, autoWeek: "2026-10-19" };
  const updated = ensureWeek(stuckData, "2026-10-22");
  assert.equal(updated.courseWeek, 8);
  assert.equal(updated.autoWeek, "2026-10-19");

  // 2. Crossing into next week advances courseWeek by 1
  const nextWeek = ensureWeek(updated, "2026-10-26");
  assert.equal(nextWeek.courseWeek, 9);
  assert.equal(nextWeek.autoWeek, "2026-10-26");

  // 3. User custom adjustment (e.g. week 7 instead of 8) is preserved and advances next week
  const customAdjusted = { ...updated, courseWeek: 7 };
  const customNextWeek = ensureWeek(customAdjusted, "2026-10-26");
  assert.equal(customNextWeek.courseWeek, 8);
});






