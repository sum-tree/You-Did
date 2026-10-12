import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Coins,
  Ellipsis,
  Flame,
  Headphones,
  ListTodo,
  LockKeyhole,
  Mic,
  Plus,
  Settings2,
  Sparkles,
  Sprout,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import {
  addDays,
  archiveTasks,
  balance,
  CATEGORY,
  chooseDaily,
  completeTask,
  dailyTasks,
  dateObject,
  KIND,
  localDate,
  moveTasks,
  saveTask,
  validateData,
  weekStart,
  weekStats,
} from "./domain.ts";
import type {
  AppData,
  CalendarEvent,
  Category,
  Contribution,
  Task,
} from "./domain.ts";
import { loadData, persistData, STORAGE_KEY } from "./storage.ts";

type Page = "daily" | "achievement" | "pool" | "calendar";
const store = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
const shortDate = (date: string) =>
  dateObject(date).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
const dateLabel = (date: string, today: string) =>
  !date
    ? "无截止日期"
    : date === today
      ? "今天截止"
      : date < today
        ? `已逾期 · ${shortDate(date)}`
        : `${shortDate(date)}截止`;
const categoryIcon = (category: Category, size = 20) =>
  category === "job" ? (
    <BriefcaseBusiness size={size} />
  ) : category === "speech" ? (
    <Mic size={size} />
  ) : (
    <BookOpen size={size} />
  );
function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLInputElement>(
        'input:not([type="checkbox"]),textarea,select',
      )
      ?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function TaskForm({
  existing,
  today,
  commit,
  close,
}: {
  existing?: Task;
  today: string;
  commit: (task: Task, todaySelected: boolean) => void;
  close: () => void;
}) {
  const [category, setCategory] = useState<Category>(
    existing?.category ?? "job",
  );
  const [kind, setKind] = useState<Contribution>(existing?.kind ?? "resume");
  const [amount, setAmount] = useState(existing?.amount ?? 1);
  const [plannedWeek, setPlannedWeek] = useState(
    existing?.plannedWeek ?? weekStart(today),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get("title")).trim();
    if (!title) {
      const input = event.currentTarget.elements.namedItem(
        "title",
      ) as HTMLInputElement;
      input.setCustomValidity("请填写任务名称，不能只有空格。");
      input.reportValidity();
      return;
    }
    commit(
      {
        id: existing?.id ?? crypto.randomUUID(),
        title,
        category,
        priority: Number(fields.get("priority")) as 0 | 1 | 2,
        dueDate: String(fields.get("dueDate")),
        plannedWeek,
        kind,
        amount:
          kind === "interview" || kind === "none" || kind === "course"
            ? 1
            : amount,
        status: "open",
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      },
      fields.get("today") === "on",
    );
  };
  return (
    <form onSubmit={submit} className="form">
      <label>
        想完成什么？
        <input
          name="title"
          aria-label="任务名称"
          required
          maxLength={200}
          placeholder="例如：投递3份心仪的岗位"
          defaultValue={existing?.title}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          autoFocus
        />
      </label>
      <label>
        任务类型
        <select
          aria-label="任务类型"
          value={category}
          onChange={(e) => {
            const next = e.target.value as Category;
            setCategory(next);
            setKind(
              next === "job"
                ? "resume"
                : next === "speech"
                  ? "cantonese"
                  : "course",
            );
            setAmount(1);
          }}
        >
          {Object.entries(CATEGORY).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        计入哪个目标？
        <select
          aria-label="目标贡献"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Contribution);
            setAmount(1);
          }}
        >
          {Object.entries(KIND)
            .filter(
              ([, value]) => !value.category || value.category === category,
            )
            .map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
        </select>
      </label>
      {!["interview", "course", "none"].includes(kind) && (
        <label>
          完成量（{KIND[kind].unit}）
          <input
            aria-label="完成量"
            type="number"
            min={1}
            max={10000}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
      )}
      <div className="form-row">
        <label>
          优先级
          <select name="priority" defaultValue={existing?.priority ?? 1}>
            <option value="0">P0 · 优先完成</option>
            <option value="1">P1 · 正常安排</option>
            <option value="2">P2 · 不着急</option>
          </select>
        </label>
        <label>
          截止日期
          <input
            name="dueDate"
            type="date"
            defaultValue={existing?.dueDate ?? today}
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
      </div>
      <label>
        计划周
        <select
          aria-label="计划周"
          value={plannedWeek}
          onChange={(e) => setPlannedWeek(e.target.value)}
        >
          {existing &&
            ![weekStart(today), addDays(weekStart(today), 7)].includes(
              existing.plannedWeek,
            ) && (
              <option value={existing.plannedWeek}>
                原计划 · {shortDate(existing.plannedWeek)}起
              </option>
            )}
          <option value={weekStart(today)}>
            本周 · {shortDate(weekStart(today))}起
          </option>
          <option value={addDays(weekStart(today), 7)}>
            下周 · {shortDate(addDays(weekStart(today), 7))}起
          </option>
        </select>
      </label>
      {!existing && plannedWeek <= weekStart(today) && (
        <label className="checkbox-label">
          <input name="today" type="checkbox" />
          加入今日核心任务
        </label>
      )}
      <p className="form-note">
        <Coins size={15} />
        完成后获得5卡拉米。目标量在完成时计入当周。
      </p>
      <button className="primary" type="submit">
        {existing ? "保存修改" : "添加任务"}
        <Plus size={18} />
      </button>
      <button className="text-button" type="button" onClick={close}>
        再想一想
      </button>
    </form>
  );
}
function EventForm({
  existing,
  date,
  commit,
}: {
  existing?: CalendarEvent;
  date: string;
  commit: (event: CalendarEvent) => void;
}) {
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const title = String(f.get("title")).trim();
        if (!title) {
          const input = e.currentTarget.elements.namedItem(
            "title",
          ) as HTMLInputElement;
          input.setCustomValidity("请填写事项名称，不能只有空格。");
          input.reportValidity();
          return;
        }
        commit({
          id: existing?.id ?? crypto.randomUUID(),
          title,
          date: String(f.get("date")),
          time: String(f.get("time")),
          kind: String(f.get("kind")) as CalendarEvent["kind"],
          note: String(f.get("note")).trim(),
        });
      }}
    >
      <label>
        重要事项
        <input
          name="title"
          required
          maxLength={200}
          placeholder="例如：公司面试 / 作业DDL"
          defaultValue={existing?.title}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
          autoFocus
        />
      </label>
      <div className="form-row">
        <label>
          日期
          <input
            name="date"
            type="date"
            required
            defaultValue={existing?.date ?? date}
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
        <label>
          时间（选填）
          <input name="time" type="time" defaultValue={existing?.time} />
        </label>
      </div>
      <label>
        事项类型
        <select name="kind" defaultValue={existing?.kind ?? "reminder"}>
          <option value="interview">面试 / 测试</option>
          <option value="deadline">重要截止日期</option>
          <option value="reminder">提醒事项</option>
        </select>
      </label>
      <label>
        备注
        <textarea
          name="note"
          maxLength={1000}
          rows={3}
          placeholder="地点、准备事项……"
          defaultValue={existing?.note}
        />
      </label>
      <p className="form-note">日历事项用于提醒，不自动计入任务或发放积分。</p>
      <button className="primary" type="submit">
        {existing ? "保存事项" : "添加事项"}
        <Plus size={18} />
      </button>
    </form>
  );
}

export default function App() {
  const [loaded] = useState(() => loadData(store));
  const [data, setData] = useState<AppData>(loaded.data);
  const [blocked, setBlocked] = useState(Boolean(loaded.error));
  const [rawRecovery, setRawRecovery] = useState(loaded.raw);
  const [error, setError] = useState(loaded.error);
  const [page, setPage] = useState<Page>("daily");
  const [today, setToday] = useState(localDate);
  const [toast, setToast] = useState("");
  const [taskForm, setTaskForm] = useState<Task | "new" | null>(null);
  const [taskMenu, setTaskMenu] = useState<Task | null>(null);
  const [eventForm, setEventForm] = useState<CalendarEvent | "new" | null>(
    null,
  );
  const [eventMenu, setEventMenu] = useState<CalendarEvent | null>(null);
  const [settings, setSettings] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [poolWeek, setPoolWeek] = useState<
    "current" | "next" | "past" | "archived"
  >("current");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [batch, setBatch] = useState<"move" | "archive" | null>(null);
  const [month, setMonth] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState(localDate);
  const week = weekStart(today);
  const stats = weekStats(data, week);
  const daily = dailyTasks(data, today);
  const urgent = data.tasks
    .filter(
      (task) => task.status === "open" && task.dueDate && task.dueDate <= today,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completedToday = data.completions.filter((item) => item.date === today);
  const pool = data.tasks
    .filter((task) => {
      if (filter !== "all" && task.category !== filter) return false;
      if (poolWeek === "archived") return task.status === "archived";
      if (task.status === "archived" || (!showDone && task.status === "done"))
        return false;
      return poolWeek === "current"
        ? task.plannedWeek === week
        : poolWeek === "next"
          ? task.plannedWeek === addDays(week, 7)
          : task.plannedWeek < week;
    })
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        a.priority - b.priority ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );
  const openThisWeek = data.tasks.filter(
    (task) =>
      task.status === "open" &&
      (task.plannedWeek <= week || (task.dueDate && task.dueDate <= today)),
  );
  const canChange = () => {
    if (blocked) {
      setSettings(true);
      setToast("先导出原始记录，再恢复有效备份。");
      return false;
    }
    return true;
  };
  const update = (change: (previous: AppData) => AppData) => {
    if (canChange()) {
      setToday(localDate());
      setData(change);
    }
  };
  useEffect(() => {
    if (!blocked) setError(persistData(store, data));
  }, [data, blocked]);
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
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = loadData(store);
        setData(next.data);
        setBlocked(Boolean(next.error));
        setRawRecovery(next.raw);
        setError(next.error);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  function finish(task: Task) {
    if (!canChange()) return;
    const date = localDate();
    setToday(date);
    const next = completeTask(data, task.id, date);
    const earned = balance(next) - balance(data);
    setData((previous) => completeTask(previous, task.id, date));
    setToast(`You did it! +${earned} 卡拉米 · 每一步都算数`);
  }
  function commitTask(task: Task, todaySelected: boolean) {
    if (!canChange()) return;
    const date = localDate();
    const dailyNow = dailyTasks(data, date);
    if (todaySelected && dailyNow.length >= 3) {
      setToast("今日已有3项核心任务，请先更换或移出一项。");
      return;
    }
    update((previous) => {
      const next = saveTask(previous, task, date);
      return todaySelected
        ? chooseDaily(next, date, [
            ...dailyTasks(previous, date).map((item) => item.id),
            task.id,
          ])
        : next;
    });
    setTaskForm(null);
    setToast("任务已保存，小小的一步也很棒。");
  }
  function taskCard(task: Task, compact = false) {
    const done = task.status === "done";
    return (
      <article
        className={`task-card ${done ? "is-done" : ""} ${compact ? "compact" : ""}`}
        key={task.id}
      >
        <button
          className={`task-check ${done ? "checked" : ""}`}
          aria-label={`${done ? "已完成" : "完成"}：${task.title}`}
          disabled={task.status !== "open"}
          onClick={() => finish(task)}
        >
          {done && <Check size={17} />}
        </button>
        <div className="task-content">
          <h3>{task.title}</h3>
          <div className="task-meta">
            <span className={`tag ${task.category}`}>
              {CATEGORY[task.category].short}
            </span>
            <span
              className={`due ${task.dueDate && task.dueDate < today && !done ? "late" : ""}`}
            >
              {done ? "已完成" : dateLabel(task.dueDate, today)}
            </span>
            <span className="priority">P{task.priority}</span>
          </div>
          {!compact && (
            <div className="task-bottom">
              <span>
                {task.kind === "none"
                  ? "每一次行动都值得奖励"
                  : `${KIND[task.kind].label.split("（")[0]} · ${task.amount}${KIND[task.kind].unit}`}
              </span>
              <span className="task-reward">
                <Coins size={13} />
                +5
              </span>
            </div>
          )}
        </div>
        <button
          className="icon-button more"
          aria-label={`任务操作：${task.title}`}
          onClick={() => setTaskMenu(task)}
        >
          <Ellipsis size={20} />
        </button>
      </article>
    );
  }
  const heading = (eyebrow: string, title: string, subtitle: string) => (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
  const empty = (
    title: string,
    description: string,
    action?: () => void,
    actionLabel = "添加任务",
  ) => (
    <div className="empty">
      <span className="empty-icon">
        <Sprout size={31} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="small-button" onClick={action}>
          <Plus size={16} />
          {actionLabel}
        </button>
      )}
    </div>
  );
  const changePage = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changePage("daily");
          }}
        >
          <span className="brand-mark">
            <Check size={19} strokeWidth={3} />
          </span>
          You Did<span className="brand-dot">!</span>
        </a>
        <div className="header-actions">
          <button
            className="coin-pill"
            aria-label={`卡拉米余额：${balance(data)}`}
            onClick={() => changePage("achievement")}
          >
            <Coins size={17} />
            <strong>{balance(data)}</strong>
          </button>
          <button
            className="icon-button"
            aria-label="设置与数据备份"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      {error && (
        <div className="storage-warning" role="alert">
          {error}
          <button onClick={() => setSettings(true)}>数据备份</button>
        </div>
      )}
      <main>
        {page === "daily" && (
          <>
            {heading(
              `${dateObject(today).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })} · TODAY`,
              "把今天过好，就很好。",
              "不用一下做完所有事。先走好眼前这一步。",
            )}
            <section className="daily-hero">
              <div>
                <span className="eyebrow">ONE LITTLE STEP AT A TIME</span>
                <h2>今天，也有小小的进步。</h2>
                <p>完成一件事，就为自己点个赞。</p>
                <div className="hero-stat">
                  <span className="hero-count">{completedToday.length}</span>
                  <span>
                    项任务已完成
                    <br />
                    <strong>
                      {data.rewards
                        .filter((r) => r.date === today)
                        .reduce((n, r) => n + r.amount, 0)}{" "}
                      卡拉米入账
                    </strong>
                  </span>
                </div>
              </div>
              <div className="plant-art" aria-hidden="true">
                <span className="sun" />
                <span className="stem" />
                <span className="leaf leaf-one" />
                <span className="leaf leaf-two" />
                <span className="leaf leaf-three" />
                <span className="pot" />
                <span className="plant-star star-one">✧</span>
                <span className="plant-star star-two">✦</span>
              </div>
            </section>
            {urgent.length > 0 && (
              <details className="urgent-panel" open={urgent.length > 3}>
                <summary>
                  <Clock3 size={17} />
                  <span>{urgent.length}项到期或逾期，留意一下</span>
                  <ChevronRight size={17} />
                </summary>
                <p>核心任务最多3项。如今天安排过满，可手动调整截止日期。</p>
                {urgent.map((task) => (
                  <button key={task.id} onClick={() => setTaskForm(task)}>
                    <span>
                      {task.title}
                      <small>{dateLabel(task.dueDate, today)}</small>
                    </span>
                    <span>
                      改DDL
                      <ArrowRight size={13} />
                    </span>
                  </button>
                ))}
              </details>
            )}
            <div className="section-heading">
              <h2>
                今日专注 <span className="count-badge">{daily.length} / 3</span>
              </h2>
              <button
                className="text-button"
                onClick={() => {
                  setSelection(daily.map((task) => task.id));
                  setChooser(true);
                }}
              >
                手动安排
                <Settings2 size={14} />
              </button>
            </div>
            <p className="section-caption">
              {Object.hasOwn(data.daily, today)
                ? "按你的安排，慢慢来就好。"
                : "已优先安排到期任务，再按优先级选择。"}
            </p>
            <div className="task-stack">
              {daily.length
                ? daily.map((task) => taskCard(task))
                : empty(
                    "从一件小事开始",
                    "给今天一个轻轻的起点。任务会从本周计划中自动安排。",
                    () => setTaskForm("new"),
                  )}
            </div>
            {daily.length > 0 && daily.length < 3 && (
              <button className="add-dashed" onClick={() => setTaskForm("new")}>
                <Plus size={18} />
                给今天再加一小步
              </button>
            )}
            {completedToday.length > 0 && (
              <details className="completed-list">
                <summary>
                  <CircleCheck size={17} />
                  今日已完成 · {completedToday.length}
                  <ChevronRight size={16} />
                </summary>
                {completedToday.map((item) => (
                  <div key={item.taskId}>
                    <Check size={15} />
                    <span>{item.title}</span>
                    <span>+5</span>
                  </div>
                ))}
              </details>
            )}
            <button
              className="week-peek"
              onClick={() => changePage("achievement")}
            >
              <span className="peek-icon">
                <Trophy size={21} />
              </span>
              <span>
                <strong>看看这一周的积累</strong>
                <small>
                  {stats.completed}项完成 · {stats.earned}卡拉米
                </small>
              </span>
              <ArrowRight size={18} />
            </button>
            <p className="footer-quote">
              “每一个小小的完成，都在让你靠近想要的生活。”
            </p>
          </>
        )}
        {page === "achievement" && (
          <>
            {heading(
              "YOUR LITTLE WINS",
              "你做到了，值得庆祝。",
              `${shortDate(week)} — ${shortDate(addDays(week, 6))} · 本周的每一步都算数`,
            )}
            <section className="balance-card">
              <div>
                <span>我的卡拉米</span>
                <h2>
                  {balance(data)}
                  <Coins size={24} />
                </h2>
                <p>这是你一点一点攒下的努力。</p>
              </div>
              <span className="medal" aria-hidden="true">
                <Trophy size={39} strokeWidth={1.5} />
              </span>
            </section>
            <div className="stat-row">
              <div>
                <Flame size={16} />
                <strong>{stats.completed}</strong>
                <span>本周完成</span>
              </div>
              <div>
                <Coins size={16} />
                <strong>{stats.earned}</strong>
                <span>本周获得</span>
              </div>
            </div>
            <div className="section-heading">
              <h2>本周目标</h2>
              <span className="muted">一点点，也在前进</span>
            </div>
            <section className="goal-card job">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("job")}</span>
                <div>
                  <h3>香港揾工</h3>
                  <p>给未来一个新的可能</p>
                </div>
                <strong>{stats.jobPercent}%</strong>
              </div>
              <Progress value={stats.jobPercent} label="香港揾工本周进度" />
              <div className="goal-detail">
                <span>简历投递</span>
                <strong>{stats.resumes} / 15份</strong>
              </div>
              <div className="goal-detail">
                <span>本周测试 / 面试</span>
                <strong>
                  {stats.interviewTotal
                    ? `${stats.interviewDone} / ${stats.interviewTotal}项`
                    : "暂无安排 · 已满足"}
                </strong>
              </div>
              <div className="goal-reward">
                <Coins size={14} />
                <span>
                  {data.rewards.some((r) => r.id === `goal:${week}:job`)
                    ? "本周目标奖励已领取"
                    : "两项都达标，获得20卡拉米"}
                </span>
                {stats.jobComplete && <Check size={15} />}
              </div>
              <div
                className={`challenge ${stats.jobComplete ? "unlocked" : ""}`}
              >
                <div>
                  <span>
                    {stats.jobComplete ? (
                      <Sparkles size={16} />
                    ) : (
                      <LockKeyhole size={15} />
                    )}
                    特别挑战
                  </span>
                  <strong>每额外3份 · +10</strong>
                </div>
                <p>
                  {stats.jobComplete
                    ? `已超额${Math.max(0, stats.resumes - 15)}份 · 已获${data.rewards.filter((r) => r.id.startsWith(`bonus:${week}:job:`)).length}档奖励`
                    : "基础目标达标后解锁，提前完成的超额量也算。"}
                </p>
              </div>
            </section>
            <section className="goal-card speech">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("speech")}</span>
                <div>
                  <h3>大胆说口语</h3>
                  <p>开口，就是一次勇敢</p>
                </div>
                <strong>{stats.speechPercent}%</strong>
              </div>
              <Progress
                value={stats.speechPercent}
                label="大胆说口语本周进度"
              />
              <div className="goal-detail">
                <span>粤语练习 · 30分钟 / 次</span>
                <strong>{stats.cantonese} / 2次</strong>
              </div>
              <div className="goal-detail">
                <span>英语面试题</span>
                <strong>{stats.english} / 9题</strong>
              </div>
              <div className="goal-reward">
                <Coins size={14} />
                <span>
                  {data.rewards.some((r) => r.id === `goal:${week}:speech`)
                    ? "本周目标奖励已领取"
                    : "两项都达标，获得20卡拉米"}
                </span>
              </div>
              <div
                className={`challenge ${stats.speechComplete ? "unlocked" : ""}`}
              >
                <div>
                  <span>
                    {stats.speechComplete ? (
                      <Headphones size={16} />
                    ) : (
                      <LockKeyhole size={15} />
                    )}
                    特别挑战
                  </span>
                  <strong>每听力10分钟 · +5</strong>
                </div>
                <p>
                  已累计{stats.listening}分钟 ·{" "}
                  {stats.speechComplete
                    ? `已获${data.rewards.filter((r) => r.id.startsWith(`bonus:${week}:speech:`)).length}档奖励`
                    : "达标后自动补领本周听力奖励"}
                </p>
              </div>
            </section>
            <section className="goal-card course">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("course")}</span>
                <div>
                  <h3>课程作业</h3>
                  <p>离假期，又近了一点</p>
                </div>
                <strong>
                  {data.courseWeek}
                  <small> / 15周</small>
                </strong>
              </div>
              <Progress
                value={Math.round((data.courseWeek / 15) * 100)}
                label="学期进度"
              />
              <div className="goal-detail">
                <span>
                  {data.courseWeek === 15
                    ? "最后一周，辛苦啦！"
                    : `还有${15 - data.courseWeek}周就结束本学期啦`}
                </span>
                <button
                  className="text-button"
                  onClick={() => setSettings(true)}
                >
                  调整周数
                </button>
              </div>
              <div className="goal-reward">
                <Coins size={14} />
                每完成一项课程任务，获得5卡拉米
              </div>
            </section>
            <details className="reward-history">
              <summary>
                <Coins size={17} />
                卡拉米明细
                <ChevronRight size={16} />
              </summary>
              {data.rewards.length === 0 ? (
                <p>完成第一项任务，让努力被看见。</p>
              ) : (
                data.rewards
                  .slice()
                  .reverse()
                  .map((reward) => (
                    <div key={reward.id}>
                      <span>
                        {reward.label}
                        <small>{shortDate(reward.date)}</small>
                      </span>
                      <strong>+{reward.amount}</strong>
                    </div>
                  ))
              )}
            </details>
            <p className="footer-quote">不用和别人比，你已经比昨天更进一步。</p>
          </>
        )}
        {page === "pool" && (
          <>
            {heading(
              "MAKE A LITTLE PLAN",
              "给这一周，留点方向。",
              "先把想做的事放下来，再一件一件完成。",
            )}
            <div className="pool-summary">
              <span className="summary-icon">
                <ListTodo size={23} />
              </span>
              <span>
                <strong>{openThisWeek.length}项待完成</strong>
                <small>本周及之前的未完成任务</small>
              </span>
              <button
                className="small-button"
                onClick={() => setTaskForm("new")}
              >
                <Plus size={16} />
                新任务
              </button>
            </div>
            <div className="segmented" aria-label="任务计划周">
              {(
                [
                  ["current", "本周"],
                  ["next", "下周"],
                  ["past", "往周"],
                  ["archived", "已清空"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={poolWeek === key ? "active" : ""}
                  onClick={() => setPoolWeek(key)}
                  aria-pressed={poolWeek === key}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <button
                className={`filter-chip ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                全部
              </button>
              {Object.entries(CATEGORY).map(([key, value]) => (
                <button
                  key={key}
                  className={`filter-chip ${filter === key ? "active" : ""}`}
                  onClick={() => setFilter(key as Category)}
                >
                  {value.short}
                </button>
              ))}
            </div>
            <div className="section-heading">
              <h2>
                {poolWeek === "archived" ? "已清空记录" : "任务清单"}
                <span className="count-badge">{pool.length}</span>
              </h2>
              {poolWeek !== "archived" && (
                <label className="done-toggle">
                  <input
                    type="checkbox"
                    checked={showDone}
                    onChange={(e) => setShowDone(e.target.checked)}
                  />
                  显示已完成
                </label>
              )}
            </div>
            <div className="task-stack">
              {pool.length
                ? pool.map((task) => taskCard(task))
                : empty(
                    poolWeek === "archived"
                      ? "这里还没有清空记录"
                      : "给这周一个小计划",
                    poolWeek === "past"
                      ? "跨周不会自动删除任务，也不会扣积分。"
                      : "投递简历、练习口语，或完成一份作业。",
                    poolWeek === "archived"
                      ? undefined
                      : () => setTaskForm("new"),
                  )}
            </div>
            {pool.some((task) => task.status === "open") &&
              poolWeek !== "next" && (
                <div className="week-actions">
                  <p>没做完也没关系，重新安排就好。</p>
                  <div>
                    <button onClick={() => setBatch("move")}>
                      未完成移至下周
                      <ArrowRight size={15} />
                    </button>
                    <button onClick={() => setBatch("archive")}>
                      清空未完成
                    </button>
                  </div>
                  <small>仅处理当前筛选的未完成任务，已获积分保留。</small>
                </div>
              )}
          </>
        )}
        {page === "calendar" && (
          <>
            {heading(
              "DATES THAT MATTER",
              "重要的日子，记在这里。",
              "面试、截止日期，还有想提醒自己的事。",
            )}
            <section className="calendar-card">
              <div className="month-heading">
                <button
                  className="icon-button"
                  aria-label="上个月"
                  onClick={() => {
                    const d = dateObject(month);
                    d.setMonth(d.getMonth() - 1);
                    setMonth(localDate(d));
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <h2>
                  {dateObject(month).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                  })}
                </h2>
                <button
                  className="icon-button"
                  aria-label="下个月"
                  onClick={() => {
                    const d = dateObject(month);
                    d.setMonth(d.getMonth() + 1);
                    setMonth(localDate(d));
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="calendar-weekdays">
                {"一二三四五六日".split("").map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {Array.from({ length: 42 }, (_, i) =>
                  addDays(weekStart(month), i),
                ).map((date) => (
                  <button
                    key={date}
                    aria-label={date}
                    aria-pressed={selectedDate === date}
                    className={`${date.slice(0, 7) !== month.slice(0, 7) ? "other-month" : ""} ${date === today ? "today" : ""} ${date === selectedDate ? "selected" : ""}`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <span>{dateObject(date).getDate()}</span>
                    {data.events.some((event) => event.date === date) && <i />}
                  </button>
                ))}
              </div>
              <button
                className="text-button calendar-today"
                onClick={() => {
                  setMonth(`${today.slice(0, 7)}-01`);
                  setSelectedDate(today);
                }}
              >
                回到今天
              </button>
            </section>
            <div className="section-heading">
              <h2>{shortDate(selectedDate)} · 重要事项</h2>
              <button
                className="text-button"
                onClick={() => setEventForm("new")}
              >
                <Plus size={16} />
                添加
              </button>
            </div>
            {data.events.filter((event) => event.date === selectedDate)
              .length ? (
              <div className="event-stack">
                {data.events
                  .filter((event) => event.date === selectedDate)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((event) => (
                    <button
                      className={`event-card ${event.kind}`}
                      key={event.id}
                      onClick={() => setEventMenu(event)}
                    >
                      <span className="event-icon">
                        {event.kind === "interview" ? (
                          <BriefcaseBusiness size={19} />
                        ) : event.kind === "deadline" ? (
                          <Clock3 size={19} />
                        ) : (
                          <CalendarDays size={19} />
                        )}
                      </span>
                      <span>
                        <small>
                          {event.time || "全天"} ·{" "}
                          {event.kind === "interview"
                            ? "面试 / 测试"
                            : event.kind === "deadline"
                              ? "重要DDL"
                              : "提醒"}
                        </small>
                        <strong>{event.title}</strong>
                        {event.note && <p>{event.note}</p>}
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
              </div>
            ) : (
              empty(
                "这一天，留点从容",
                "这里只显示重要日期与提醒。普通任务放在待办里。",
                () => setEventForm("new"),
                "添加重要事项",
              )
            )}
            <div className="calendar-note">
              <Sprout size={18} />
              提醒会在应用内显示。记得给重要的日子留出准备时间。
            </div>
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="主要导航">
        {(
          [
            ["daily", "每日", ListTodo],
            ["achievement", "成就", Trophy],
            ["pool", "待办", CircleCheck],
            ["calendar", "日历", CalendarDays],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            aria-current={page === key ? "page" : undefined}
            className={page === key ? "active" : ""}
            onClick={() => changePage(key)}
          >
            <span>
              <Icon size={21} strokeWidth={page === key ? 2.2 : 1.7} />
            </span>
            {label}
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Sparkles size={18} />
          {toast}
        </div>
      )}
      {taskForm && (
        <Modal
          title={taskForm === "new" ? "添加一小步" : "调整任务"}
          close={() => setTaskForm(null)}
        >
          <TaskForm
            existing={taskForm === "new" ? undefined : taskForm}
            today={today}
            close={() => setTaskForm(null)}
            commit={commitTask}
          />
        </Modal>
      )}
      {taskMenu && (
        <Modal title={taskMenu.title} close={() => setTaskMenu(null)}>
          <p className="form-note">
            {CATEGORY[taskMenu.category].name} ·{" "}
            {dateLabel(taskMenu.dueDate, today)}
          </p>
          <div className="action-list">
            {taskMenu.status === "open" ? (
              <>
                <button
                  onClick={() => {
                    setTaskForm(taskMenu);
                    setTaskMenu(null);
                  }}
                >
                  编辑任务 / 修改DDL
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={() => {
                    const date = localDate();
                    const ids = dailyTasks(data, date).map((item) => item.id);
                    if (!ids.includes(taskMenu.id) && ids.length >= 3) {
                      setToast("今日最多3项，请使用手动安排更换任务。");
                      return;
                    }
                    if (
                      taskMenu.plannedWeek > weekStart(date) &&
                      (!taskMenu.dueDate || taskMenu.dueDate > date)
                    ) {
                      setToast("这是下周的任务，调整计划周后再加入今日。");
                      return;
                    }
                    update((previous) =>
                      chooseDaily(
                        previous,
                        date,
                        ids.includes(taskMenu.id)
                          ? ids.filter((id) => id !== taskMenu.id)
                          : [...ids, taskMenu.id],
                      ),
                    );
                    setTaskMenu(null);
                  }}
                >
                  {daily.some((item) => item.id === taskMenu.id)
                    ? "从今日移出"
                    : "加入今日"}
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={() => {
                    update((previous) =>
                      moveTasks(previous, [taskMenu.id], localDate()),
                    );
                    setTaskMenu(null);
                    setToast("已移至下周，已获积分保留。");
                  }}
                >
                  移至下周
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={() => {
                    update((previous) => archiveTasks(previous, [taskMenu.id]));
                    setTaskMenu(null);
                    setToast("任务已清空，可在待办「已清空」中恢复。");
                  }}
                >
                  清空任务<span>可恢复</span>
                </button>
              </>
            ) : taskMenu.status === "archived" ? (
              <button
                onClick={() => {
                  update((previous) => ({
                    ...previous,
                    tasks: previous.tasks.map((task) =>
                      task.id === taskMenu.id
                        ? { ...task, status: "open" }
                        : task,
                    ),
                  }));
                  setTaskMenu(null);
                  setToast("任务已恢复。");
                }}
              >
                恢复任务
                <ArrowRight size={17} />
              </button>
            ) : (
              <p>已完成并奖励5卡拉米。完成记录保留，不重复计分。</p>
            )}
          </div>
        </Modal>
      )}
      {chooser && (
        <Modal title="安排今天的3件小事" close={() => setChooser(false)}>
          <p className="form-note">
            选择最多3项。未选入的到期任务仍会在提醒区显示。
          </p>
          <div className="chooser-list">
            {openThisWeek.length ? (
              openThisWeek.map((task) => (
                <label key={task.id}>
                  <input
                    type="checkbox"
                    checked={selection.includes(task.id)}
                    disabled={
                      !selection.includes(task.id) && selection.length >= 3
                    }
                    onChange={(e) =>
                      setSelection((previous) =>
                        e.target.checked
                          ? [...previous, task.id]
                          : previous.filter((id) => id !== task.id),
                      )
                    }
                  />
                  <span>
                    {task.title}
                    <small>
                      {CATEGORY[task.category].short} ·{" "}
                      {dateLabel(task.dueDate, today)}
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p className="muted">先添加本周任务，再来安排今天。</p>
            )}
          </div>
          <button
            className="primary"
            onClick={() => {
              update((previous) => chooseDaily(previous, localDate(), selection));
              setChooser(false);
            }}
          >
            保存今日安排
            <Check size={18} />
          </button>
          <button
            className="text-button full"
            onClick={() => {
              update((previous) => {
                const days = { ...previous.daily };
                delete days[localDate()];
                return { ...previous, daily: days };
              });
              setChooser(false);
            }}
          >
            恢复自动安排
          </button>
        </Modal>
      )}
      {batch && (
        <Modal
          title={batch === "move" ? "把未完成留给下周" : "清空这些未完成任务？"}
          close={() => setBatch(null)}
        >
          <p className="form-note">
            当前筛选中有{pool.filter((task) => task.status === "open").length}
            项未完成任务。
            {batch === "move"
              ? "计划周改为下周，早于下周一的DDL调整到下周一；你可以继续手动修改。"
              : "任务移入可恢复的「已清空」记录。"}
            已获积分保留。
          </p>
          <button
            className="primary"
            onClick={() => {
              const ids = pool
                .filter((task) => task.status === "open")
                .map((task) => task.id);
              update((previous) =>
                batch === "move"
                  ? moveTasks(previous, ids, localDate())
                  : archiveTasks(previous, ids),
              );
              setBatch(null);
              setToast("已重新安排，慢慢来就好。");
            }}
          >
            确认{batch === "move" ? "移至下周" : "清空"}
            <Check size={18} />
          </button>
        </Modal>
      )}
      {eventForm && (
        <Modal
          title={eventForm === "new" ? "记下一个重要日子" : "编辑重要事项"}
          close={() => setEventForm(null)}
        >
          <EventForm
            existing={eventForm === "new" ? undefined : eventForm}
            date={selectedDate}
            commit={(event) => {
              update((previous) => ({
                ...previous,
                events: previous.events.some((item) => item.id === event.id)
                  ? previous.events.map((item) =>
                      item.id === event.id ? event : item,
                    )
                  : [...previous.events, event],
              }));
              setEventForm(null);
              setSelectedDate(event.date);
              setMonth(`${event.date.slice(0, 7)}-01`);
              setToast("重要事项已记好。");
            }}
          />
        </Modal>
      )}
      {eventMenu && (
        <Modal title={eventMenu.title} close={() => setEventMenu(null)}>
          <p className="form-note">
            {eventMenu.date} · {eventMenu.time || "全天"}
          </p>
          <p>{eventMenu.note}</p>
          <div className="action-list">
            <button
              onClick={() => {
                setEventForm(eventMenu);
                setEventMenu(null);
              }}
            >
              编辑事项
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => {
                update((previous) => ({
                  ...previous,
                  events: previous.events.filter(
                    (event) => event.id !== eventMenu.id,
                  ),
                }));
                setEventMenu(null);
                setToast("事项已移除。");
              }}
            >
              移除事项
              <X size={17} />
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="按自己的节奏来" close={() => setSettings(false)}>
          <div className="settings-section">
            <h3>学期进度</h3>
            <p>共13周课程 + 2周考试；按实际教学周调整。</p>
            <label className="course-setting">
              当前第
              <select
                aria-label="当前学期周数"
                value={data.courseWeek}
                onChange={(e) =>
                  update((previous) => ({
                    ...previous,
                    courseWeek: Number(e.target.value),
                  }))
                }
              >
                {Array.from({ length: 15 }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
              周 / 共15周
            </label>
          </div>
          <div className="settings-section">
            <h3>保存你的每一步</h3>
            <p>
              记录只存在当前浏览器中。换设备、换网址或清理浏览器前，先导出备份。
            </p>
            <button
              className="outline-button full"
              onClick={() =>
                download(JSON.stringify(data, null, 2), `you-did-${today}.json`)
              }
            >
              <ArrowDownToLine size={17} />
              导出备份
            </button>
            {blocked && rawRecovery && (
              <button
                className="outline-button full"
                onClick={() =>
                  download(rawRecovery!, `you-did-original-${today}.json`)
                }
              >
                导出原始记录
              </button>
            )}
            <label className="outline-button full import-button">
              <Upload size={17} />
              导入备份
              <input
                type="file"
                accept=".json,application/json"
                aria-label="导入备份"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  try {
                    if (file.size > 10 * 1024 * 1024)
                      throw new Error("too large");
                    const value: unknown = JSON.parse(await file.text());
                    if (!validateData(value)) throw new Error("invalid");
                    if (
                      window.confirm(
                        "导入会替换当前记录。请先导出当前备份，确定导入吗？",
                      )
                    ) {
                      setData(value);
                      setBlocked(false);
                      setToast("备份已恢复，继续积累你的小小进步。");
                    }
                  } catch {
                    setToast("备份格式无效或文件过大，当前记录保持不变。");
                  }
                }}
              />
            </label>
          </div>
          <div className="settings-section">
            <h3>奖励小约定</h3>
            <p>
              普通 / 课程任务 +5；求职、口语每周基础目标各 +20；求职额外每3份
              +10；听力每10分钟 +5。基础目标完成后自动补领特别挑战奖励。
            </p>
            <p>清空任务不扣积分。完成记录保留，奖励只发一次。</p>
          </div>
          <div className="settings-foot">
            <span className="wordmark">You Did!</span>
            <span>v0.2 · 每一步都算数</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
