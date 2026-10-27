export type Category = "job" | "speech" | "course";
export type Contribution =
  | "resume"
  | "interview"
  | "test"
  | "cantonese"
  | "english"
  | "listening"
  | "course"
  | "none";
export interface InterviewStep {
  id: string;
  title: string;
  done: boolean;
}
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
  steps?: InterviewStep[];
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
  // 2: reward rules of PRD v0.6. Version 1 records are recomputed on load.
  version: 2;
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
  interview: { label: "面试", unit: "项", category: "job" },
  test: { label: "测试 / 笔试", unit: "项", category: "job" },
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
    if (/面试|interview|录视频/i.test(title)) return one("interview");
    if (/测试|笔试|test/i.test(title)) return one("test");
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
// Tests and interviews both must be finished for the weekly job goal.
const gatesJob = (kind: Contribution) => kind === "interview" || kind === "test";
const TASK_REWARD: Record<Exclude<Contribution, "interview">, number> = {
  none: 2,
  resume: 4,
  test: 8,
  cantonese: 2,
  english: 4,
  listening: 2,
  course: 1,
};
export const GOAL_REWARD = { job: 10, speech: 7 } as const;
export const TIER_REWARD = { job: 4, speech: 2 } as const;
// Interview reward decays with days since the task was added (local dates),
// independent of its DDL, so moving the DDL never resets the clock.
function addedDate(task: Task): string {
  const created = new Date(task.createdAt);
  return Number.isNaN(created.getTime()) ? task.plannedWeek : localDate(created);
}
const INTERVIEW_TIERS = [
  { lastDay: 3, reward: 12 },
  { lastDay: 6, reward: 4 },
  { lastDay: 10, reward: 2 },
  { lastDay: Infinity, reward: 1 },
];
function daysSinceAdded(task: Task, date: string): number {
  return Math.max(
    0,
    Math.round(
      (dateObject(date).getTime() - dateObject(addedDate(task)).getTime()) /
        86400000,
    ),
  );
}
export function interviewReward(task: Task, date: string): number {
  const days = daysSinceAdded(task, date);
  return INTERVIEW_TIERS.find((tier) => days <= tier.lastDay)!.reward;
}
// For the card hint: today's reward and, if it will drop, the next value and
// how many days until then (a calm day count, not a countdown).
export function interviewRewardInfo(
  task: Task,
  date: string,
): { now: number; next?: number; inDays?: number } {
  const days = daysSinceAdded(task, date);
  const index = INTERVIEW_TIERS.findIndex((tier) => days <= tier.lastDay);
  const tier = INTERVIEW_TIERS[index];
  const next = INTERVIEW_TIERS[index + 1];
  return next
    ? { now: tier.reward, next: next.reward, inDays: tier.lastDay - days + 1 }
    : { now: tier.reward };
}
export function taskReward(task: Task, date: string): number {
  return task.kind === "interview"
    ? interviewReward(task, date)
    : TASK_REWARD[task.kind];
}
export function emptyData(): AppData {
  return {
    version: 2,
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
export function monthBalance(data: AppData, month: string): number {
  return data.rewards
    .filter((reward) => reward.date.slice(0, 7) === month)
    .reduce((total, reward) => total + reward.amount, 0);
}
export interface MonthStat {
  month: string;
  monthNumber: number;
  total: number;
  fullJars: number;
  remCoins: number;
}
export function yearlyMonthsStats(data: AppData, year: number): MonthStat[] {
  const yearPrefix = `${year}-`;
  const monthlyTotals = new Map<string, number>();
  for (const reward of data.rewards) {
    if (reward.date.startsWith(yearPrefix)) {
      const month = reward.date.slice(0, 7);
      monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + reward.amount);
    }
  }
  return Array.from({ length: 12 }, (_, i) => {
    const monthNumber = i + 1;
    const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const total = monthlyTotals.get(month) ?? 0;
    return {
      month,
      monthNumber,
      total,
      fullJars: Math.floor(total / 100),
      remCoins: total % 100,
    };
  });
}

export function getStartMonth(data: AppData): string {
  let earliest: string | null = null;
  const consider = (dateStr?: string) => {
    if (!dateStr) return;
    const ym = dateStr.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(ym)) {
      if (!earliest || ym < earliest) {
        earliest = ym;
      }
    }
  };
  for (const r of data.rewards) consider(r.date);
  for (const c of data.completions) consider(c.date);
  for (const t of data.tasks) consider(t.createdAt);
  return earliest ?? "2026-10";
}

export function visibleYearlyMonthsStats(data: AppData, year: number): MonthStat[] {
  const startMonth = getStartMonth(data);
  const startYear = Number(startMonth.slice(0, 4));
  const startMonthNum = Number(startMonth.slice(5, 7));
  const allMonths = yearlyMonthsStats(data, year);

  if (year < startYear) {
    return [];
  }
  if (year === startYear) {
    return allMonths.filter((stat) => stat.monthNumber >= startMonthNum);
  }
  return allMonths;
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
    records.filter((item) => gatesJob(item.kind)).map((item) => item.taskId),
  );
  // Cross-week work belongs to the completion week; archived interviews are not completions.
  const planned = data.tasks
    .filter((task) => gatesJob(task.kind) && task.plannedWeek === week)
    .map((task) => task.id);
  const interviewIds = new Set([...planned, ...completedIds]);
  // Finishing a planned interview early also satisfies its planned week; late completion does not.
  const earlyIds = new Set(
    data.completions
      .filter(
        (item) =>
          gatesJob(item.kind) &&
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
    grant(`goal:${week}:job`, GOAL_REWARD.job, "香港揾工 · 本周基础目标");
    for (let tier = 1; tier <= stats.jobTiers; tier++)
      grant(
        `bonus:${week}:job:${tier}`,
        TIER_REWARD.job,
        `香港揾工 · 额外3份简历（第${tier}档）`,
      );
  }
  if (stats.speechComplete) {
    grant(`goal:${week}:speech`, GOAL_REWARD.speech, "大胆说口语 · 本周基础目标");
    for (let tier = 1; tier <= stats.speechTiers; tier++)
      grant(
        `bonus:${week}:speech:${tier}`,
        TIER_REWARD.speech,
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
        item.id === id
          ? {
              ...item,
              status: "done",
              ...(item.steps
                ? { steps: item.steps.map((s) => ({ ...s, done: true })) }
                : {}),
            }
          : item,
      ),
      completions: [...data.completions, completion],
      rewards: [
        ...data.rewards,
        {
          id: `task:${id}`,
          amount: taskReward(task, date),
          label: task.title,
          date,
          week,
        },
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
  const revertTask = (item: Task): Task => {
    if (item.id !== id) return item;
    if (item.steps && item.steps.length > 0) {
      const steps = [...item.steps];
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].done) {
          steps[i] = { ...steps[i], done: false };
          break;
        }
      }
      return { ...item, status: "open", steps };
    }
    return { ...item, status: "open" };
  };
  const next: AppData = {
    ...data,
    tasks: data.tasks.map(revertTask),
    completions: data.completions.filter((item) => item.taskId !== id),
    rewards: data.rewards.filter((item) => item.id !== `task:${id}`),
  };
  const stats = weekStats(next, week);
  const job = record.kind === "resume" || gatesJob(record.kind);
  const speech = ["cantonese", "english", "listening"].includes(record.kind);
  if (!job && !speech) return next;
  const category = job ? "job" : "speech";
  const goalLost = job
    ? stats.resumes < 15 || (gatesJob(record.kind) && !stats.jobComplete)
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
  const normalizedTask = existing
    ? task
    : { ...task, plannedWeek: weekStart(date) };
  return settleRewards(
    {
      ...data,
      tasks: existing
        ? data.tasks.map((item) => (item.id === task.id ? normalizedTask : item))
        : [...data.tasks, normalizedTask],
    },
    weekStart(date),
    date,
  );
}
export const VIDEO_INTERVIEW_STEPS = [
  "搜集问题",
  "写出所有问题的回答",
  "每个回答读 3 遍",
  "记住 2 道回答",
  "记住 5 道回答",
  "记住所有回答",
  "录一次视频",
  "回看视频，查找问题",
  "再录一次视频",
  "再次回看",
  "录最终视频",
] as const;

export const MOCK_INTERVIEW_STEPS = [
  "搜集问题",
  "写出所有问题的回答",
  "每个回答读 3 遍",
  "记住 2 道回答",
  "记住 5 道回答",
  "记住所有回答",
  "Mock interview 10 题",
  "复盘薄弱项，复读 3 遍",
  "Mock interview 10 题",
  "复盘薄弱项，复读 3 遍",
  "完成面试",
] as const;

export type InterviewFormType = "video" | "interview";

export function buildInterviewSteps(
  typeOrCount: InterviewFormType | number = "interview",
): InterviewStep[] {
  if (typeOrCount === "video") {
    return VIDEO_INTERVIEW_STEPS.map((title, index) => ({
      id: `step-${index + 1}`,
      title,
      done: false,
    }));
  }
  if (typeOrCount === "interview") {
    return MOCK_INTERVIEW_STEPS.map((title, index) => ({
      id: `step-${index + 1}`,
      title,
      done: false,
    }));
  }
  const count = Math.min(50, Math.max(1, Math.floor(typeOrCount)));
  const titles: string[] = [
    "搜集问题",
    "写出所有问题的回答",
    "每个回答读3遍",
  ];
  if (count > 2) {
    titles.push("记住2道回答");
  }
  if (count > 5) {
    titles.push("记住5道回答");
  }
  titles.push(`记住所有回答（共${count}道）`);
  titles.push(
    "录一次视频",
    "回看视频，查找问题",
    "再录一次视频",
    "再次回看",
    "录最终视频",
  );
  return titles.map((title, index) => ({
    id: `step-${index + 1}`,
    title,
    done: false,
  }));
}

export const STEP_ENCOURAGEMENTS: Record<string, string> = {
  搜集问题: "太棒了，完成搜集问题！每一步都算数～",
  写出所有问题的回答: "写出回答就是胜利，思路越来越清晰了！",
  每个回答读3遍: "读了3遍，语感正在悄悄建立～",
  "每个回答读 3 遍": "读了3遍，语感正在悄悄建立～",
  记住2道回答: "记住2道啦！大脑正在高速建立神经连接！",
  "记住 2 道回答": "记住2道啦！大脑正在高速建立神经连接！",
  记住5道回答: "哇，已经记住5道了！记忆力超棒！",
  "记住 5 道回答": "哇，已经记住5道了！记忆力超棒！",
  记住所有回答: "所有回答都记住了，太了不起了！",
  录一次视频: "录了一次视频，敢于面对镜头就是巨大突破！",
  "回看视频，查找问题": "认真复盘查找问题，你正在变得更专业！",
  再录一次视频: "再次录制明显更从容了，状态大好！",
  再次回看: "又复盘了一遍，细节打磨得越来越好！",
  录最终视频: "最终视频完成！恭喜你征服了这场录制！",
  "Mock interview 10 题": "Mock 练习完成，面试手感渐入佳境！",
  "复盘薄弱项，复读 3 遍": "薄弱项复盘到位，自信心倍增！",
  完成面试: "恭喜完成面试！每一次全力以赴都值得骄傲！",
};

export function getStepEncouragement(stepTitle: string): string {
  for (const [key, msg] of Object.entries(STEP_ENCOURAGEMENTS)) {
    if (stepTitle.includes(key) || key.includes(stepTitle)) {
      return msg;
    }
  }
  return "太棒了，又迈出踏实的一小步！继续保持～";
}

export function shouldSuggestInterviewSplit(task: Task, today: string): boolean {
  if (task.kind !== "interview" || task.status !== "open" || !task.dueDate) {
    return false;
  }
  const overdueDays = Math.round(
    (dateObject(today).getTime() - dateObject(task.dueDate).getTime()) /
      86400000,
  );
  return overdueDays >= 3;
}
export function setInterviewSteps(
  data: AppData,
  taskId: string,
  steps: InterviewStep[],
): AppData {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "open") return data;
  return {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === taskId
        ? { ...item, steps: steps.length > 0 ? steps : undefined }
        : item,
    ),
  };
}
export function toggleInterviewStep(
  data: AppData,
  taskId: string,
  stepId: string,
  date: string,
): AppData {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "open" || !task.steps) return data;
  const targetIndex = task.steps.findIndex((s) => s.id === stepId);
  if (targetIndex === -1) return data;
  const target = task.steps[targetIndex];

  // 严格顺序勾选：
  // 勾选某步时，前面所有步骤必须已完成
  if (!target.done) {
    const canCheck = task.steps.slice(0, targetIndex).every((s) => s.done);
    if (!canCheck) return data;
  } else {
    // 撤销某步时，后面所有步骤必须未完成（只能从后往前逐步撤销）
    const canUncheck = task.steps.slice(targetIndex + 1).every((s) => !s.done);
    if (!canUncheck) return data;
  }

  const steps = task.steps.map((s, idx) =>
    idx === targetIndex ? { ...s, done: !s.done } : s,
  );
  const allDone = steps.length > 0 && steps.every((s) => s.done);
  const nextData: AppData = {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === taskId ? { ...item, steps } : item,
    ),
  };
  if (allDone) {
    return completeTask(nextData, taskId, date);
  }
  return nextData;
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
    priority: 1,
  },
  {
    series: "english",
    title: "英语面试练习3题",
    category: "speech",
    kind: "english",
    amount: 3,
    count: 3,
    priority: 1,
  },
  {
    series: "cantonese",
    title: "粤语30分钟",
    category: "speech",
    kind: "cantonese",
    amount: 1,
    count: 2,
    priority: 1,
  },
] as const;
type Series = (typeof WEEKLY_TASKS)[number]["series"];
function seriesOf(id: string): Series | undefined {
  return /^auto:\d{4}-\d{2}-\d{2}:(resume|english|cantonese):\d+$/.exec(
    id,
  )?.[1] as Series | undefined;
}
export const isGenerated = (task: Task) => seriesOf(task.id) !== undefined;
export const generatedSeries = (task: Task) => seriesOf(task.id);
// The todo list shows each weekly series as one calm row without quantities;
// daily cards keep the task titles with their amounts.
export const SERIES_NAME: Record<Series, string> = {
  resume: "香港秋招简历投递",
  cantonese: "粤语口语练习",
  english: "英语口语练习",
};
export const SEMESTER_START_WEEK = "2026-08-31";

export function computeCourseWeek(date: string): number {
  const week = weekStart(date);
  const diffDays = Math.round(
    (new Date(`${week}T00:00:00`).getTime() -
      new Date(`${SEMESTER_START_WEEK}T00:00:00`).getTime()) /
      86400000,
  );
  const diffWeeks = Math.floor(diffDays / 7);
  return Math.min(15, Math.max(1, 1 + diffWeeks));
}

// Runs once per week: archives earlier generated tasks still open (the Sunday-midnight
// clear), then creates this week's set. IDs and timestamps are deterministic so
// concurrent tabs write identical records. Restored or archived ones are left alone.
// Also advances courseWeek automatically as calendar weeks progress.
export function ensureWeek(data: AppData, date: string): AppData {
  const week = weekStart(date);
  const expectedCourseWeek = computeCourseWeek(date);

  let nextCourseWeek = data.courseWeek;
  if (!data.autoWeek) {
    nextCourseWeek = expectedCourseWeek;
  } else if (data.autoWeek < week) {
    const diffDays = Math.round(
      (new Date(`${week}T00:00:00`).getTime() -
        new Date(`${data.autoWeek}T00:00:00`).getTime()) /
        86400000,
    );
    const elapsedWeeks = Math.floor(diffDays / 7);
    nextCourseWeek = Math.min(15, Math.max(1, data.courseWeek + elapsedWeeks));
  } else if (data.courseWeek < expectedCourseWeek) {
    nextCourseWeek = expectedCourseWeek;
  }

  const courseWeekChanged = nextCourseWeek !== data.courseWeek;
  if (data.autoWeek && data.autoWeek >= week && !courseWeekChanged) return data;

  const existing = new Set(data.tasks.map((task) => task.id));
  const tasks: Task[] = data.tasks
    .filter((task) => {
      // 往周未完成的周固定自动任务在跨周后直接清理，不移入「已清空」造成列表堆积
      if (
        isGenerated(task) &&
        task.status === "open" &&
        task.plannedWeek < week
      ) {
        return false;
      }
      return true;
    })
    .map((task) => {
      if (!isGenerated(task)) return task;
      if (task.status === "open" && task.priority === 0) {
        return { ...task, priority: 1 };
      }
      return task;
    });
  for (const item of WEEKLY_TASKS)
    for (let n = 1; n <= item.count; n++) {
      const id = `auto:${week}:${item.series}:${n}`;
      if (existing.has(id)) continue;
      tasks.push({
        id,
        title: item.title,
        category: item.category,
        priority: item.priority,
        dueDate: "",
        plannedWeek: week,
        kind: item.kind,
        amount: item.amount,
        status: "open",
        createdAt: `${week}T00:00:00`,
      });
    }
  return { ...data, tasks, autoWeek: week, courseWeek: nextCourseWeek };
}
// Open tasks planned up to this week, or already due, may be placed on a day.
export function schedulable(task: Task, date: string): boolean {
  return (
    task.status === "open" &&
    (task.plannedWeek <= weekStart(date) ||
      (!!task.dueDate && task.dueDate <= date))
  );
}

// Clean up duplicate non-generated open tasks (e.g. accidentally added twice),
// and purge legacy auto-archived generated tasks / duplicate archived items from "已清空".
// Ensures "已清空" strictly contains tasks intentionally cleared by the user.
export function cleanupDuplicateTasks(data: AppData): AppData {
  const seen = new Map<string, Task>();
  const toDelete = new Set<string>();

  const openCustom = data.tasks.filter(
    (t) => !isGenerated(t) && t.status === "open",
  );

  for (const task of openCustom) {
    const key = `${task.category}:${task.title.trim().toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, task);
      continue;
    }
    if (existing.dueDate && !task.dueDate) {
      toDelete.add(task.id);
    } else if (!existing.dueDate && task.dueDate) {
      toDelete.add(existing.id);
      seen.set(key, task);
    } else {
      toDelete.add(task.id);
    }
  }

  // 1. 清理历史上由系统跨周自动标记为 archived 的生成任务（保证已清空只包含用户手动清空的任务）
  for (const task of data.tasks) {
    if (isGenerated(task) && task.status === "archived") {
      toDelete.add(task.id);
    }
  }

  // 2. 清理历史上因去重被标记为 archived 的重复副本（与现有 open 任务同分类同名的 archived 副本）
  const openKeys = new Set(
    data.tasks
      .filter(
        (t) => !isGenerated(t) && t.status === "open" && !toDelete.has(t.id),
      )
      .map((t) => `${t.category}:${t.title.trim().toLowerCase()}`),
  );
  for (const task of data.tasks) {
    if (!isGenerated(task) && task.status === "archived") {
      const key = `${task.category}:${task.title.trim().toLowerCase()}`;
      if (openKeys.has(key)) {
        toDelete.add(task.id);
      }
    }
  }

  if (toDelete.size === 0) return data;

  return {
    ...data,
    tasks: data.tasks.filter((t) => !toDelete.has(t.id)),
    daily: Object.fromEntries(
      Object.entries(data.daily).map(([day, ids]) => [
        day,
        ids.filter((id) => !toDelete.has(id)),
      ]),
    ),
  };
}
export type PoolWeekFilter = "current" | "next" | "past" | "archived";
export type PoolStatusFilter = "open" | "done" | "archived";

export function poolTasks(
  data: AppData,
  date: string,
  weekView: PoolWeekFilter = "current",
  categoryFilter: Category | "all" = "all",
  statusFilter: PoolStatusFilter = "open",
): Task[] {
  const week = weekStart(date);
  const isArchived = statusFilter === "archived" || weekView === "archived";
  return data.tasks.filter((task) => {
    if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
    if (isArchived) return task.status === "archived";
    if (statusFilter === "done") {
      if (task.status !== "done") return false;
      const comp = data.completions.find((c) => c.taskId === task.id);
      const taskWeek = comp ? comp.week : task.plannedWeek;
      return weekView === "current"
        ? taskWeek === week
        : weekView === "next"
          ? taskWeek === addDays(week, 7)
          : taskWeek < week;
    }
    if (task.status !== "open") return false;
    const isDueThisWeekOrOverdue = Boolean(
      task.dueDate && task.dueDate <= addDays(week, 6),
    );
    return weekView === "current"
      ? task.plannedWeek <= week || isDueThisWeekOrOverdue
      : weekView === "next"
        ? task.plannedWeek === addDays(week, 7) && !isDueThisWeekOrOverdue
        : task.plannedWeek < week;
  });
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
      .sort((a, b) => a.priority - b.priority);
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
    .filter((task) => !isGenerated(task) && task.plannedWeek <= currentWeek)
    .sort(prioritySort)) {
    if (picked.length >= 2) break;
    if (!picked.includes(task)) picked.push(task);
  }
  const speaking =
    doneToday.has("english") || doneToday.has("cantonese")
      ? undefined
      : (next("english") ?? next("cantonese"));
  if (speaking && picked.length < 3) picked.push(speaking);
  return picked.sort((a, b) => a.priority - b.priority);
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
      [date]: [...new Set(ids)].filter((id) => eligible.has(id)),
    },
  };
}
// Backups may carry unknown fields; persist only the validated schema.
export function normalizeData(data: AppData): AppData {
  return {
    version: 2,
    tasks: data.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      priority: isGenerated(t) && t.priority === 0 ? 1 : t.priority,
      dueDate: t.dueDate,
      plannedWeek: t.plannedWeek,
      kind: t.kind,
      amount: t.amount,
      status: t.status,
      createdAt: t.createdAt,
      ...(t.steps
        ? {
            steps: t.steps.map((s) => ({
              id: s.id,
              title: s.title,
              done: s.done,
            })),
          }
        : {}),
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
// Version 1 paid flat amounts (5 per task, 20 per goal, 10/5 per tier); version 2
// uses the current reward table. Structure and consistency rules are shared.
function validateRecord(value: unknown, version: 1 | 2): boolean {
  if (!value || typeof value !== "object") return false;
  const d = value as Omit<AppData, "version"> & { version: unknown };
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
    d.version !== version ||
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
  const step = (s: unknown) =>
    Boolean(
      s &&
        typeof s === "object" &&
        text((s as InterviewStep).id, 100) &&
        Boolean((s as InterviewStep).id) &&
        text((s as InterviewStep).title, 200) &&
        Boolean((s as InterviewStep).title.trim()) &&
        typeof (s as InterviewStep).done === "boolean",
    );
  const stepsList = (v: unknown): v is InterviewStep[] =>
    v === undefined ||
    (Array.isArray(v) && v.length <= 20 && v.every(step));
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
        (!["interview", "test", "course", "none"].includes(t.kind) ||
          t.amount === 1) &&
        ["open", "done", "archived"].includes(t.status) &&
        text(t.createdAt, 50) &&
        (t.steps === undefined || (version === 2 && stepsList(t.steps))),
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
        Number.isSafeInteger(r.amount) &&
        r.amount >= 1 &&
        r.amount <= 20 &&
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
        ids.length <= 100 &&
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
      reward.amount !==
        (version === 1 ? 5 : taskReward(task, completion.date)) ||
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
    const category = match[2] as "job" | "speech";
    // Added interviews can lower present progress after a legitimate reward was earned.
    // Only immutable quantities can be checked; do not require the current goal to be complete.
    if (
      category === "job"
        ? week.resumes < 15
        : week.cantonese < 2 || week.english < 9
    )
      return false;
    if (goal) {
      if (reward.amount !== (version === 1 ? 20 : GOAL_REWARD[category]))
        return false;
    } else {
      const tier = Number(match[3]);
      const maxTier =
        category === "job"
          ? Math.floor((week.resumes - 15) / 3)
          : Math.floor(week.listening / 10);
      if (
        !Number.isSafeInteger(tier) ||
        tier > maxTier ||
        reward.amount !==
          (version === 1
            ? category === "job"
              ? 10
              : 5
            : TIER_REWARD[category]) ||
        !rewards.has(`goal:${reward.week}:${category}`)
      )
        return false;
    }
  }
  return true;
}
export function validateData(value: unknown): value is AppData {
  return validateRecord(value, 2);
}
// Loads current records as they are; version 1 records are checked against the
// old rules and then recomputed under the current table, as the user chose.
// Old interview tasks titled as tests or written exams become `test`.
export function upgradeData(value: unknown): AppData | null {
  if (validateData(value)) return value;
  if (!validateRecord(value, 1)) return null;
  const legacy = value as Omit<AppData, "version">;
  const kindOf = (task: Task): Contribution =>
    task.kind === "interview" &&
    inferContribution(task.title, "job").kind === "test"
      ? "test"
      : task.kind;
  const tasks = legacy.tasks.map((task) => ({ ...task, kind: kindOf(task) }));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const completions = legacy.completions.map((item) => ({
    ...item,
    kind: byId.get(item.taskId)!.kind,
  }));
  const doneOn = new Map(completions.map((item) => [item.taskId, item.date]));
  const rewards = legacy.rewards.map((reward) => {
    if (reward.id.startsWith("task:")) {
      const id = reward.id.slice(5);
      return { ...reward, amount: taskReward(byId.get(id)!, doneOn.get(id)!) };
    }
    const category = reward.id.split(":")[2] as "job" | "speech";
    return {
      ...reward,
      amount: reward.id.startsWith("goal:")
        ? GOAL_REWARD[category]
        : TIER_REWARD[category],
    };
  });
  const upgraded: AppData = {
    ...legacy,
    version: 2,
    tasks,
    completions,
    rewards,
  };
  return validateData(upgraded) ? upgraded : null;
}
