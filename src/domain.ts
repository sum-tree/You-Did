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
  const interviewIds = new Set([
    ...data.tasks
      .filter((task) => task.kind === "interview" && task.plannedWeek === week)
      .map((task) => task.id),
    ...completedIds,
  ]);
  const interviewDone = [...interviewIds].filter((id) =>
    completedIds.has(id),
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
    jobPercent: percent(
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
  const nextWeek = addDays(weekStart(date), 7);
  return {
    ...data,
    tasks: data.tasks.map((task) =>
      ids.includes(task.id) && task.status === "open"
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
        selected.filter((id) => !ids.includes(id)),
      ]),
    ),
  };
}
function prioritySort(a: Task, b: Task) {
  return (
    a.priority - b.priority ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}
export function dailyTasks(data: AppData, date: string): Task[] {
  const currentWeek = weekStart(date);
  const open = data.tasks.filter(
    (task) =>
      task.status === "open" &&
      (task.plannedWeek <= currentWeek ||
        (task.dueDate && task.dueDate <= date)),
  );
  const urgent = open
    .filter((task) => task.dueDate && task.dueDate <= date)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || prioritySort(a, b));
  const manual = data.daily[date];
  if (manual !== undefined) {
    // Explicit selection takes precedence; all urgent tasks remain in the reminder area.
    return manual
      .map((id) => open.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task))
      .slice(0, 3);
  }
  const picked = urgent.slice(0, 3);
  for (const task of [...open]
    .filter((task) => task.plannedWeek === currentWeek)
    .sort(prioritySort)) {
    if (picked.length >= Math.max(2, Math.min(urgent.length, 3))) break;
    if (!picked.some((item) => item.id === task.id)) picked.push(task);
  }
  return picked;
}
export function chooseDaily(
  data: AppData,
  date: string,
  ids: string[],
): AppData {
  const eligible = new Set(
    data.tasks
      .filter(
        (task) =>
          task.status === "open" &&
          (task.plannedWeek <= weekStart(date) ||
            (task.dueDate && task.dueDate <= date)),
      )
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
    Array.isArray(d.daily)
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
  const completedIds = new Set(d.completions.map((c) => c.taskId));
  if (!d.tasks.every((t) => (t.status === "done") === completedIds.has(t.id)))
    return false;
  return d.completions.every(
    (c) =>
      d.tasks.some((t) => t.id === c.taskId && t.status === "done") &&
      d.rewards.some(
        (r) =>
          r.id === `task:${c.taskId}` && r.amount === 5 && r.week === c.week,
      ),
  );
}
