export type Category = "job" | "speech" | "course";
export type Contribution =
  | "resume"
  | "interview"
  | "cantonese"
  | "english"
  | "listening"
  | "course"
  | "none";
export interface Task {
  id: string;
  title: string;
  category: Category;
  priority: 0 | 1 | 2;
  dueDate: string;
  plannedWeek: string;
  kind: Contribution;
  amount: number;
  status: "open" | "done" | "archived";
  createdAt: string;
}
export interface Completion {
  taskId: string;
  title: string;
  category: Category;
  kind: Contribution;
  amount: number;
  date: string;
  week: string;
}
export interface Reward {
  id: string;
  amount: number;
  label: string;
  date: string;
  week: string;
}
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  kind: "interview" | "deadline" | "reminder";
  note: string;
}
export interface AppData {
  version: 1;
  tasks: Task[];
  completions: Completion[];
  rewards: Reward[];
  daily: Record<string, string[]>;
  events: CalendarEvent[];
  courseWeek: number;
  // Week whose generated tasks were created and whose predecessors were cleared.
  autoWeek?: string;
}
export const CATEGORY: Record<Category, { name: string; short: string }> = {
  job: { name: "香港揾工", short: "揾工" },
  speech: { name: "大胆说口语", short: "口语" },
  course: { name: "课程作业", short: "课程" },
};
export const KIND: Record<
  Contribution,
  { label: string; unit: string; category: Category | null }
> = {
  resume: { label: "简历投递", unit: "份", category: "job" },
  interview: { label: "测试 / 面试", unit: "项", category: "job" },
  cantonese: {
    label: "粤语练习（每次30分钟）",
    unit: "次",
    category: "speech",
  },
  english: { label: "英语面试题", unit: "题", category: "speech" },
  listening: { label: "粤语 / 英语听力", unit: "分钟", category: "speech" },
  course: { label: "课程 / 作业任务", unit: "项", category: "course" },
  none: { label: "普通任务（不计目标量）", unit: "项", category: null },
};
// The form has no contribution picker: keywords in the title choose the goal,
// and a number next to that goal's unit sets the quantity (default 1).
export function inferContribution(
  title: string,
  category: Category,
): { kind: Contribution; amount: number } {
  const count = (unit: RegExp) => {
    const match = new RegExp(`(\\d+)\\s*(?:${unit.source})`, "i").exec(title);
    return match ? Math.min(10000, Math.max(1, Number(match[1]))) : 0;
  };
  const times = () => {
    const match = /[x×*]\s*(\d+)/i.exec(title);
    return match ? Math.min(10000, Math.max(1, Number(match[1]))) : 0;
  };
  const one = (kind: Contribution) => ({ kind, amount: 1 });
  if (category === "course") return one("course");
  if (category === "job") {
    if (/面试|测试|笔试|interview/i.test(title)) return one("interview");
    if (/简历|投递|cv|resume/i.test(title))
      return {
        kind: "resume",
        amount: count(/份|封|个|家/) || times() || 1,
      };
    return one("none");
  }
  if (/听力|listening/i.test(title))
    return {
      kind: "listening",
      amount: count(/分钟|min/) || count(/小时|h/) * 60 || 1,
    };
  if (/粤语|cantonese/i.test(title))
    return {
      kind: "cantonese",
      amount: count(/次/) || Math.max(1, Math.floor(count(/分钟|min/) / 30)),
    };
  if (/英语|面试题|english/i.test(title))
    return { kind: "english", amount: count(/题|道/) || 1 };
  return one("none");
}
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateObject(date: string): Date {
  return new Date(`${date}T12:00:00`);
}
export function addDays(date: string, amount: number): string {
  const value = dateObject(date);
  value.setDate(value.getDate() + amount);
  return localDate(value);
}
export function weekStart(date: string): string {
  const day = dateObject(date).getDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(dateObject(value).getTime()) &&
    localDate(dateObject(value)) === value
  );
}
export function emptyData(): AppData {
  return {
    version: 1,
    tasks: [],
    completions: [],
    rewards: [],
    daily: {},
    events: [],
    courseWeek: 6,
  };
}
export function balance(data: AppData): number {
  return data.rewards.reduce((total, reward) => total + reward.amount, 0);
}
function ratio(value: number, target: number): number {
  return target === 0 ? 1 : Math.min(1, value / target);
}
export function weekStats(data: AppData, week: string) {
  const records = data.completions.filter((item) => item.week === week);
  const sum = (kind: Contribution) =>
    records
      .filter((item) => item.kind === kind)
      .reduce((total, item) => total + item.amount, 0);
  const completedIds = new Set(
    records
      .filter((item) => item.kind === "interview")
      .map((item) => item.taskId),
  );
  // Cross-week work belongs to the completion week; archived interviews are not completions.
  const planned = data.tasks
    .filter((task) => task.kind === "interview" && task.plannedWeek === week)
    .map((task) => task.id);
  const interviewIds = new Set([...planned, ...completedIds]);
  // Finishing a planned interview early also satisfies its planned week; late completion does not.
  const earlyIds = new Set(
    data.completions
      .filter(
        (item) =>
          item.kind === "interview" &&
          item.week < week &&
          planned.includes(item.taskId),
      )
      .map((item) => item.taskId),
  );
  const interviewDone = [...interviewIds].filter(
    (id) => completedIds.has(id) || earlyIds.has(id),
  ).length;
  const resumes = sum("resume");
  const cantonese = sum("cantonese");
  const english = sum("english");
  const listening = sum("listening");
  const jobComplete = resumes >= 15 && interviewDone === interviewIds.size;
  const speechComplete = cantonese >= 2 && english >= 9;
  const percent = (a: number, b: number, complete: boolean) =>
    complete ? 100 : Math.min(99, Math.floor((a + b) * 50));
  return {
    resumes,
    cantonese,
    english,
    listening,
    interviewDone,
    interviewTotal: interviewIds.size,
    jobComplete,
    speechComplete,
    // With no interview scheduled, progress is resumes alone (not a free 50%).
    jobPercent:
      interviewIds.size === 0
        ? percent(ratio(resumes, 15), ratio(resumes, 15), jobComplete)
        : percent(
            ratio(resumes, 15),
            ratio(interviewDone, interviewIds.size),
            jobComplete,
          ),
    speechPercent: percent(
      ratio(cantonese, 2),
      ratio(english, 9),
      speechComplete,
    ),
    jobTiers: Math.floor(Math.max(0, resumes - 15) / 3),
    speechTiers: Math.floor(listening / 10),
    completed: records.length,
    earned: data.rewards
      .filter((item) => item.week === week)
      .reduce((total, item) => total + item.amount, 0),
  };
}
export function settleRewards(
  data: AppData,
  week: string,
  date: string,
): AppData {
  const rewards = [...data.rewards];
  const ids = new Set(rewards.map((item) => item.id));
  const grant = (id: string, amount: number, label: string) => {
    if (!ids.has(id)) {
      rewards.push({ id, amount, label, date, week });
      ids.add(id);
    }
  };
  const stats = weekStats(data, week);
  if (stats.jobComplete) {
    grant(`goal:${week}:job`, 20, "香港揾工 · 本周基础目标");
    for (let tier = 1; tier <= stats.jobTiers; tier++)
      grant(
        `bonus:${week}:job:${tier}`,
        10,
        `香港揾工 · 额外3份简历（第${tier}档）`,
      );
  }
  if (stats.speechComplete) {
    grant(`goal:${week}:speech`, 20, "大胆说口语 · 本周基础目标");
    for (let tier = 1; tier <= stats.speechTiers; tier++)
      grant(
        `bonus:${week}:speech:${tier}`,
        5,
        `大胆说口语 · 听力10分钟（第${tier}档）`,
      );
  }
  return { ...data, rewards };
}
export function completeTask(data: AppData, id: string, date: string): AppData {
  const task = data.tasks.find((item) => item.id === id);
  if (
    !task ||
    task.status !== "open" ||
    data.completions.some((item) => item.taskId === id)
  )
    return data;
  const week = weekStart(date);
  const completion: Completion = {
    taskId: id,
    title: task.title,
    category: task.category,
    kind: task.kind,
    amount: task.amount,
    date,
    week,
  };
  return settleRewards(
    {
      ...data,
      tasks: data.tasks.map((item) =>
        item.id === id ? { ...item, status: "done" } : item,
      ),
      completions: [...data.completions, completion],
      rewards: [
        ...data.rewards,
        { id: `task:${id}`, amount: 5, label: task.title, date, week },
      ],
    },
    week,
    date,
  );
}
// Undo is limited to completions made on `date` (today), so earlier days' ledger is
// never rewritten. Goal and tier rewards are revoked only when they were granted
// today and this completion's goal no longer qualifies; an unrelated undo, or a
// later-added interview, cannot take back a reward this completion did not cause.
export function uncompleteTask(
  data: AppData,
  id: string,
  date: string,
): AppData {
  const record = data.completions.find((item) => item.taskId === id);
  const task = data.tasks.find((item) => item.id === id);
  if (!record || !task || record.date !== date || task.status !== "done")
    return data;
  const week = record.week;
  const next: AppData = {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === id ? { ...item, status: "open" } : item,
    ),
    completions: data.completions.filter((item) => item.taskId !== id),
    rewards: data.rewards.filter((item) => item.id !== `task:${id}`),
  };
  const stats = weekStats(next, week);
  const job = record.kind === "resume" || record.kind === "interview";
  const speech = ["cantonese", "english", "listening"].includes(record.kind);
  if (!job && !speech) return next;
  const category = job ? "job" : "speech";
  const goalLost = job
    ? stats.resumes < 15 || (record.kind === "interview" && !stats.jobComplete)
    : record.kind !== "listening" && (stats.cantonese < 2 || stats.english < 9);
  const maxTier = job ? stats.jobTiers : stats.speechTiers;
  const revoked = (reward: Reward) => {
    if (reward.date !== date || reward.week !== week) return false;
    if (reward.id === `goal:${week}:${category}`) return goalLost;
    const prefix = `bonus:${week}:${category}:`;
    if (!reward.id.startsWith(prefix)) return false;
    return goalLost || Number(reward.id.slice(prefix.length)) > maxTier;
  };
  return { ...next, rewards: next.rewards.filter((item) => !revoked(item)) };
}
export function saveTask(data: AppData, task: Task, date: string): AppData {
  const existing = data.tasks.find((item) => item.id === task.id);
  if (existing && existing.status !== "open") return data;
  return settleRewards(
    {
      ...data,
      tasks: existing
        ? data.tasks.map((item) => (item.id === task.id ? task : item))
        : [...data.tasks, task],
    },
    weekStart(date),
    date,
  );
}
export function archiveTasks(data: AppData, ids: string[]): AppData {
  return {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.includes(task.id) && task.status === "open"
        ? { ...task, status: "archived" }
        : task,
    ),
  };
}
export function moveTasks(data: AppData, ids: string[], date: string): AppData {
  const week = weekStart(date);
  const nextWeek = addDays(week, 7);
  const moved = new Set(
    data.tasks
      .filter(
        (task) =>
          ids.includes(task.id) &&
          task.status === "open" &&
          task.plannedWeek < nextWeek,
      )
      .map((task) => task.id),
  );
  // Moving an open interview away can complete this week's goal; past weeks are never re-settled.
  return settleRewards(
    {
      ...data,
      tasks: data.tasks.map((task) =>
        moved.has(task.id)
          ? {
              ...task,
              plannedWeek: nextWeek,
              dueDate: task.dueDate
                ? task.dueDate < nextWeek
                  ? nextWeek
                  : task.dueDate
                : "",
            }
          : task,
      ),
      daily: Object.fromEntries(
        Object.entries(data.daily).map(([day, selected]) => [
          day,
          selected.filter((id) => !moved.has(id)),
        ]),
      ),
    },
    week,
    date,
  );
}
function prioritySort(a: Task, b: Task) {
  return (
    a.priority - b.priority ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
export const WEEKLY_TASKS = [
  {
    series: "resume",
    title: "香港秋招简历x5",
    category: "job",
    kind: "resume",
    amount: 5,
    count: 3,
  },
  {
    series: "english",
    title: "英语面试练习3题",
    category: "speech",
    kind: "english",
    amount: 3,
    count: 3,
  },
  {
    series: "cantonese",
    title: "粤语30分钟",
    category: "speech",
    kind: "cantonese",
    amount: 1,
    count: 2,
  },
] as const;
type Series = (typeof WEEKLY_TASKS)[number]["series"];
function seriesOf(id: string): Series | undefined {
  return /^auto:\d{4}-\d{2}-\d{2}:(resume|english|cantonese):\d+$/.exec(
    id,
  )?.[1] as Series | undefined;
}
export const isGenerated = (task: Task) => seriesOf(task.id) !== undefined;
// Runs once per week: archives earlier generated tasks still open (the Sunday-midnight
// clear), then creates this week's set. IDs and timestamps are deterministic so
// concurrent tabs write identical records. Restored or archived ones are left alone.
export function ensureWeek(data: AppData, date: string): AppData {
  const week = weekStart(date);
  if (data.autoWeek && data.autoWeek >= week) return data;
  const existing = new Set(data.tasks.map((task) => task.id));
  const tasks: Task[] = data.tasks.map((task) =>
    isGenerated(task) && task.status === "open" && task.plannedWeek < week
      ? { ...task, status: "archived" }
      : task,
  );
  for (const item of WEEKLY_TASKS)
    for (let n = 1; n <= item.count; n++) {
      const id = `auto:${week}:${item.series}:${n}`;
      if (existing.has(id)) continue;
      tasks.push({
        id,
        title: item.title,
        category: item.category,
        priority: 1,
        dueDate: "",
        plannedWeek: week,
        kind: item.kind,
        amount: item.amount,
        status: "open",
        createdAt: `${week}T00:00:00`,
      });
    }
  return { ...data, tasks, autoWeek: week };
}
// Open tasks planned up to this week, or already due, may be placed on a day.
export function schedulable(task: Task, date: string): boolean {
  return (
    task.status === "open" &&
    (task.plannedWeek <= weekStart(date) ||
      (!!task.dueDate && task.dueDate <= date))
  );
}
export function dailyTasks(data: AppData, date: string): Task[] {
  const currentWeek = weekStart(date);
  const open = data.tasks.filter((task) => schedulable(task, date));
  const urgent = open
    .filter((task) => task.dueDate && task.dueDate <= date)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || prioritySort(a, b));
  const manual = data.daily[date];
  if (manual !== undefined) {
    // Explicit selection takes precedence; all urgent tasks remain in the reminder area.
    return [...new Set(manual)]
      .map((id) => open.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task))
      .slice(0, 3);
  }
  // Generated series: one task per series per day; resume is guaranteed, then
  // ordinary tasks fill to two, then English (else Cantonese) if a slot is left.
  const doneToday = new Set(
    data.completions
      .filter((item) => item.date === date)
      .map((item) => seriesOf(item.taskId)),
  );
  const next = (series: Series) =>
    doneToday.has(series)
      ? undefined
      : open
          .filter(
            (task) =>
              seriesOf(task.id) === series && task.plannedWeek === currentWeek,
          )
          .sort((a, b) => a.id.localeCompare(b.id))[0];
  const picked: Task[] = [];
  const resume = next("resume");
  if (resume) picked.push(resume);
  for (const task of urgent.filter((task) => !isGenerated(task))) {
    if (picked.length >= 3) break;
    picked.push(task);
  }
  for (const task of open
    .filter((task) => !isGenerated(task) && task.plannedWeek === currentWeek)
    .sort(prioritySort)) {
    if (picked.length >= 2) break;
    if (!picked.includes(task)) picked.push(task);
  }
  const speaking =
    doneToday.has("english") || doneToday.has("cantonese")
      ? undefined
      : (next("english") ?? next("cantonese"));
  if (speaking && picked.length < 3) picked.push(speaking);
  return picked;
}
// Open core tasks first, then tasks actually completed that day; each ID appears once.
export function dailyView(data: AppData, date: string): Task[] {
  const view = dailyTasks(data, date);
  const seen = new Set(view.map((task) => task.id));
  const tasks = new Map(data.tasks.map((task) => [task.id, task]));
  for (const item of data.completions) {
    const task = tasks.get(item.taskId);
    if (item.date !== date || !task || seen.has(task.id)) continue;
    seen.add(task.id);
    view.push(task);
  }
  return view;
}
export function chooseDaily(
  data: AppData,
  date: string,
  ids: string[],
): AppData {
  const eligible = new Set(
    data.tasks
      .filter((task) => schedulable(task, date))
      .map((task) => task.id),
  );
  return {
    ...data,
    daily: {
      ...data.daily,
      [date]: [...new Set(ids)].filter((id) => eligible.has(id)).slice(0, 3),
    },
  };
}
// Backups may carry unknown fields; persist only the validated schema.
export function normalizeData(data: AppData): AppData {
  return {
    version: 1,
    tasks: data.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: t.priority,
      dueDate: t.dueDate,
      plannedWeek: t.plannedWeek,
      kind: t.kind,
      amount: t.amount,
      status: t.status,
      createdAt: t.createdAt,
    })),
    completions: data.completions.map((c) => ({
      taskId: c.taskId,
      title: c.title,
      category: c.category,
      kind: c.kind,
      amount: c.amount,
      date: c.date,
      week: c.week,
    })),
    rewards: data.rewards.map((r) => ({
      id: r.id,
      amount: r.amount,
      label: r.label,
      date: r.date,
      week: r.week,
    })),
    daily: Object.fromEntries(
      Object.entries(data.daily).map(([date, ids]) => [date, [...ids]]),
    ),
    events: data.events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      kind: e.kind,
      note: e.note,
    })),
    courseWeek: data.courseWeek,
    ...(data.autoWeek ? { autoWeek: data.autoWeek } : {}),
  };
}
export function validateData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const d = value as AppData;
  const text = (v: unknown, max = 200) =>
    typeof v === "string" && v.length <= max;
  const category = (v: unknown) =>
    v === "job" || v === "speech" || v === "course";
  const amount = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 1 && v <= 10000;
  const contribution = (k: unknown, c: Category) =>
    typeof k === "string" &&
    Object.hasOwn(KIND, k) &&
    (!KIND[k as Contribution].category ||
      KIND[k as Contribution].category === c);
  const list = (v: unknown): v is unknown[] =>
    Array.isArray(v) && v.length <= 20000;
  if (
    d.version !== 1 ||
    !list(d.tasks) ||
    !list(d.completions) ||
    !list(d.rewards) ||
    !list(d.events) ||
    !Number.isInteger(d.courseWeek) ||
    d.courseWeek < 1 ||
    d.courseWeek > 15 ||
    !d.daily ||
    typeof d.daily !== "object" ||
    Array.isArray(d.daily) ||
    (d.autoWeek !== undefined &&
      !(validDate(d.autoWeek) && weekStart(d.autoWeek) === d.autoWeek))
  )
    return false;
  if (
    !d.tasks.every(
      (t) =>
        t &&
        text(t.id, 100) &&
        !!t.id &&
        text(t.title) &&
        !!t.title.trim() &&
        category(t.category) &&
        [0, 1, 2].includes(t.priority) &&
        (t.dueDate === "" || validDate(t.dueDate)) &&
        validDate(t.plannedWeek) &&
        weekStart(t.plannedWeek) === t.plannedWeek &&
        contribution(t.kind, t.category) &&
        amount(t.amount) &&
        (!["interview", "course", "none"].includes(t.kind) || t.amount === 1) &&
        ["open", "done", "archived"].includes(t.status) &&
        text(t.createdAt, 50),
    )
  )
    return false;
  if (
    !d.completions.every(
      (c) =>
        c &&
        text(c.taskId, 100) &&
        !!c.taskId &&
        text(c.title) &&
        category(c.category) &&
        contribution(c.kind, c.category) &&
        amount(c.amount) &&
        validDate(c.date) &&
        c.week === weekStart(c.date),
    )
  )
    return false;
  if (
    !d.rewards.every(
      (r) =>
        r &&
        text(r.id, 150) &&
        text(r.label) &&
        typeof r.amount === "number" &&
        [5, 10, 20].includes(r.amount) &&
        validDate(r.date) &&
        validDate(r.week) &&
        weekStart(r.week) === r.week,
    )
  )
    return false;
  if (
    !d.events.every(
      (e) =>
        e &&
        text(e.id, 100) &&
        text(e.title) &&
        !!e.title.trim() &&
        validDate(e.date) &&
        typeof e.time === "string" &&
        (e.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) &&
        ["interview", "deadline", "reminder"].includes(e.kind) &&
        text(e.note, 1000),
    )
  )
    return false;
  if (
    Object.keys(d.daily).length > 20000 ||
    !Object.entries(d.daily).every(
      ([date, ids]) =>
        validDate(date) &&
        Array.isArray(ids) &&
        ids.length <= 3 &&
        ids.every((id) => text(id, 100)),
    )
  )
    return false;
  const unique = (items: string[]) => new Set(items).size === items.length;
  if (
    !unique(d.tasks.map((t) => t.id)) ||
    !unique(d.completions.map((c) => c.taskId)) ||
    !unique(d.rewards.map((r) => r.id)) ||
    !unique(d.events.map((e) => e.id))
  )
    return false;
  const tasks = new Map(d.tasks.map((t) => [t.id, t]));
  const completions = new Map(d.completions.map((c) => [c.taskId, c]));
  const rewards = new Map(d.rewards.map((r) => [r.id, r]));
  if (!d.tasks.every((t) => (t.status === "done") === completions.has(t.id)))
    return false;
  if (
    !Object.values(d.daily).every(
      (ids) => unique(ids) && ids.every((id) => tasks.has(id)),
    )
  )
    return false;

  const totals = new Map<
    string,
    { resumes: number; cantonese: number; english: number; listening: number }
  >();
  for (const completion of d.completions) {
    const task = tasks.get(completion.taskId);
    const reward = rewards.get(`task:${completion.taskId}`);
    if (
      !task ||
      task.status !== "done" ||
      task.title !== completion.title ||
      task.category !== completion.category ||
      task.kind !== completion.kind ||
      task.amount !== completion.amount ||
      !reward ||
      reward.amount !== 5 ||
      reward.date !== completion.date ||
      reward.week !== completion.week ||
      reward.label !== completion.title
    )
      return false;
    const week = totals.get(completion.week) ?? {
      resumes: 0,
      cantonese: 0,
      english: 0,
      listening: 0,
    };
    if (completion.kind === "resume") week.resumes += completion.amount;
    if (completion.kind === "cantonese") week.cantonese += completion.amount;
    if (completion.kind === "english") week.english += completion.amount;
    if (completion.kind === "listening") week.listening += completion.amount;
    totals.set(completion.week, week);
  }
  for (const reward of d.rewards) {
    if (weekStart(reward.date) !== reward.week) return false;
    if (reward.id.startsWith("task:")) {
      if (!completions.has(reward.id.slice(5))) return false;
      continue;
    }
    const goal = /^goal:(\d{4}-\d{2}-\d{2}):(job|speech)$/.exec(reward.id);
    const bonus = /^bonus:(\d{4}-\d{2}-\d{2}):(job|speech):([1-9]\d*)$/.exec(
      reward.id,
    );
    const match = goal ?? bonus;
    if (!match || match[1] !== reward.week) return false;
    const week = totals.get(reward.week);
    if (!week) return false;
    const category = match[2];
    // Added interviews can lower present progress after a legitimate reward was earned.
    // Only immutable quantities can be checked; do not require the current goal to be complete.
    if (
      category === "job"
        ? week.resumes < 15
        : week.cantonese < 2 || week.english < 9
    )
      return false;
    if (goal) {
      if (reward.amount !== 20) return false;
    } else {
      const tier = Number(match[3]);
      const maxTier =
        category === "job"
          ? Math.floor((week.resumes - 15) / 3)
          : Math.floor(week.listening / 10);
      if (
        !Number.isSafeInteger(tier) ||
        tier > maxTier ||
        reward.amount !== (category === "job" ? 10 : 5) ||
        !rewards.has(`goal:${reward.week}:${category}`)
      )
        return false;
    }
  }
  return true;
}
