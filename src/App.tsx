import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Coins,
  Ellipsis,
  ListTodo,
  Plus,
  Settings2,
  Sparkles,
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
  dailyView,
  dateObject,
  KIND,
  localDate,
  moveTasks,
  normalizeData,
  saveTask,
  schedulable,
  validateData,
  weekStart,
  weekStats,
} from "./domain.ts";
import type { AppData, CalendarEvent, Category, Task } from "./domain.ts";
import { loadData, saveChange, STORAGE_KEY } from "./storage.ts";
import type { Snapshot } from "./storage.ts";
import {
  categoryIcon,
  dateLabel,
  download,
  EventForm,
  Modal,
  Progress,
  shortDate,
  TaskForm,
} from "./components.tsx";

type Page = "daily" | "achievement" | "pool" | "calendar";
const store = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
};
function useDraft<T>(snapshot: { current: Snapshot }, initial: T) {
  const [value, setValue] = useState(initial);
  const base = useRef(snapshot.current);
  const set = (next: T, origin = snapshot.current) => {
    base.current = origin;
    setValue(next);
  };
  return [value, set, base] as const;
}
const longDate = (date: string, weekday = false) =>
  dateObject(date).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    ...(weekday ? { weekday: "long" } : {}),
  });
const eventKind = (kind: CalendarEvent["kind"]) =>
  kind === "interview" ? "面试 / 测试" : kind === "deadline" ? "重要DDL" : "提醒";

export default function App() {
  const [loaded] = useState(() => loadData(store));
  const snapshot = useRef(loaded);
  const saving = useRef(false);
  const [data, setData] = useState<AppData>(loaded.data);
  const [blocked, setBlocked] = useState(Boolean(loaded.error));
  const [rawRecovery, setRawRecovery] = useState(loaded.raw);
  const [error, setError] = useState(loaded.error);
  const [saveIssue, setSaveIssue] = useState("");
  const [pendingBackup, setPendingBackup] = useState<AppData | null>(null);
  const [page, setPage] = useState<Page>("daily");
  const [today, setToday] = useState(localDate);
  const [toast, setToast] = useState("");
  const [taskForm, setTaskForm, taskFormBase] = useDraft<Task | "new" | null>(
    snapshot,
    null,
  );
  const [taskMenu, setTaskMenu, taskMenuBase] = useDraft<Task | null>(
    snapshot,
    null,
  );
  const [eventForm, setEventForm, eventFormBase] = useDraft<
    CalendarEvent | "new" | null
  >(snapshot, null);
  const [daySheet, setDaySheet, daySheetBase] = useDraft<string | null>(
    snapshot,
    null,
  );
  const [settings, setSettings] = useState(false);
  const [chooser, setChooser, chooserBase] = useDraft(snapshot, false);
  const [selection, setSelection] = useState<string[]>([]);
  const [poolWeek, setPoolWeek] = useState<
    "current" | "next" | "past" | "archived"
  >("current");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batch, setBatch, batchBase] = useDraft<"move" | "archive" | null>(
    snapshot,
    null,
  );
  const [month, setMonth] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState(localDate);
  const week = weekStart(today);
  const stats = weekStats(data, week);
  const daily = dailyTasks(data, today);
  const todayList = dailyView(data, today);
  const manualToday = Object.hasOwn(data.daily, today);
  const urgent = data.tasks
    .filter(
      (task) => task.status === "open" && task.dueDate && task.dueDate <= today,
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completedToday = data.completions.filter((item) => item.date === today);
  const earnedToday = data.rewards
    .filter((r) => r.date === today)
    .reduce((n, r) => n + r.amount, 0);
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
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const poolOpen = pool.filter((task) => task.status === "open");
  const openThisWeek = data.tasks.filter((task) => schedulable(task, today));
  const canChange = () => {
    if (blocked) {
      setSettings(true);
      setToast("先导出原始记录，再恢复有效备份。");
      return false;
    }
    return true;
  };
  const accept = (next: Snapshot) => {
    snapshot.current = next;
    setData(next.data);
    setBlocked(Boolean(next.error));
    setRawRecovery(next.raw);
    setError(next.error);
  };
  const update = async (
    change: (previous: AppData) => AppData,
    base = snapshot.current,
    restore = false,
  ) => {
    if (!restore && !canChange()) return null;
    if (saving.current) {
      setToast("上一项正在保存，请稍后再试。");
      return null;
    }
    saving.current = true;
    try {
      const result = await saveChange(
        store,
        navigator.locks,
        base,
        change,
        restore,
      );
      accept(result.snapshot);
      setSaveIssue(result.message);
      if (result.status !== "saved") {
        if (result.attempted) setPendingBackup(result.attempted);
        setToast("本次改动未保存，请查看保存提示。");
        return null;
      }
      setToday(localDate());
      return result;
    } finally {
      saving.current = false;
    }
  };
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
    const synchronize = () => {
      const next = loadData(store);
      if (
        next.raw !== snapshot.current.raw ||
        next.error !== snapshot.current.error
      )
        accept(next);
    };
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        synchronize();
      }
    };
    window.addEventListener("storage", handler);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, []);
  async function finish(task: Task) {
    if (!canChange()) return;
    const date = localDate();
    setToday(date);
    const base = snapshot.current;
    const result = await update(
      (previous) => completeTask(previous, task.id, date),
      base,
    );
    if (!result) return;
    const earned = balance(result.snapshot.data) - balance(base.data);
    setToast(`You did it! +${earned} 卡拉米 · 每一步都算数`);
  }
  async function commitTask(task: Task, todaySelected: boolean) {
    if (!canChange()) return;
    const date = localDate();
    const dailyNow = dailyTasks(data, date);
    if (todaySelected && dailyNow.length >= 3) {
      setToast("今日已有3项核心任务，请先更换或移出一项。");
      return;
    }
    const result = await update((previous) => {
      const next = saveTask(previous, task, date);
      return todaySelected
        ? chooseDaily(next, date, [
            ...dailyTasks(previous, date).map((item) => item.id),
            task.id,
          ])
        : next;
    }, taskFormBase.current);
    if (!result) return;
    setTaskForm(null);
    setToast("任务已保存，小小的一步也很棒。");
  }
  const syncNotice = {
    notice: saveIssue,
    exportPending: pendingBackup
      ? () =>
          download(
            JSON.stringify(pendingBackup, null, 2),
            `you-did-pending-${localDate()}.json`,
          )
      : undefined,
  };
  const checkButton = (task: Task) => {
    const done = task.status === "done";
    return (
      <button
        className={`task-check ${done ? "checked" : ""}`}
        aria-label={`${done ? "已完成" : "完成"}：${task.title}`}
        disabled={task.status !== "open"}
        onClick={() => finish(task)}
      >
        {done && <Check size={17} />}
      </button>
    );
  };
  function taskCard(task: Task) {
    const done = task.status === "done";
    return (
      <article className={`task-card ${done ? "is-done" : ""}`} key={task.id}>
        {checkButton(task)}
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
            {task.kind !== "none" && (
              <span className="due">
                {KIND[task.kind].label.split("（")[0]} · {task.amount}
                {KIND[task.kind].unit}
              </span>
            )}
            <span className="priority">P{task.priority}</span>
          </div>
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
  function todoRow(task: Task) {
    const done = task.status === "done";
    const open = expanded === task.id;
    return (
      <div className={`todo-row ${done ? "is-done" : ""}`} key={task.id}>
        <div className="todo-main">
          {checkButton(task)}
          <button
            className="todo-title"
            aria-expanded={open}
            onClick={() => setExpanded(open ? null : task.id)}
          >
            {task.title}
          </button>
          <span className={`tag ${task.category}`}>
            {CATEGORY[task.category].short}
          </span>
          <span
            className={`todo-due ${task.dueDate && task.dueDate < today && !done ? "late" : ""}`}
          >
            {!task.dueDate
              ? "—"
              : task.dueDate === today
                ? "今天"
                : shortDate(task.dueDate)}
          </span>
          <span className="todo-priority">P{task.priority}</span>
        </div>
        {open && (
          <div className="todo-detail">
            <span>计划周 · {shortDate(task.plannedWeek)}起</span>
            <span>
              {KIND[task.kind].label.split("（")[0]} · {task.amount}
              {KIND[task.kind].unit}
            </span>
            <span>{done ? "已完成" : dateLabel(task.dueDate, today)}</span>
            <button
              className="text-button"
              onClick={() => setTaskMenu(task)}
            >
              任务操作
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }
  const changePage = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const dayEvents = (date: string) =>
    data.events
      .filter((event) => event.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
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
          {page === "pool" && (
            <button
              className="add-button"
              aria-label="添加待办"
              onClick={() => setTaskForm("new")}
            >
              <Plus size={20} />
            </button>
          )}
          {page === "calendar" && (
            <button
              className="add-button"
              aria-label="添加提醒"
              onClick={() => setEventForm("new")}
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </header>
      {(error || saveIssue || pendingBackup) && (
        <div className="storage-warning" role="alert">
          {error || saveIssue || "有一份待保存备份，可在设置中导出。"}
          <button onClick={() => setSettings(true)}>数据备份</button>
        </div>
      )}
      <main>
        {page === "daily" && (
          <>
            <div className="page-bar">
              <h1>{longDate(today, true)}</h1>
              <button
                className="text-button"
                aria-label={`调整今日安排，当前为${manualToday ? "手动" : "自动"}安排`}
                onClick={() => {
                  setSelection(daily.map((task) => task.id));
                  setChooser(true);
                }}
              >
                {manualToday ? "手动安排" : "自动安排"}
                <Settings2 size={14} />
              </button>
            </div>
            <p className="summary-line">
              今日完成 <strong>{completedToday.length}</strong> 项 · 获得{" "}
              <strong>{earnedToday}</strong> 卡拉米
            </p>
            {urgent.length > 0 && (
              <details className="urgent-panel" open={urgent.length > 3}>
                <summary>
                  <Clock3 size={17} />
                  <span>{urgent.length}项到期或逾期</span>
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
            <div className="task-stack">
              {todayList.length ? (
                todayList.map((task) => taskCard(task))
              ) : (
                <p className="empty-line">今天暂无任务</p>
              )}
            </div>
          </>
        )}
        {page === "achievement" && (
          <>
            <p className="week-range">
              本周 · {shortDate(week)} — {shortDate(addDays(week, 6))}
            </p>
            <div className="balance-row">
              <span>
                <Coins size={17} />
                我的卡拉米
              </span>
              <strong>{balance(data)}</strong>
            </div>
            <h2 className="section-title">待办项</h2>
            <section className="goal-card job">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("job")}</span>
                <h3>香港揾工</h3>
                <strong>{stats.jobPercent}%</strong>
              </div>
              <Progress value={stats.jobPercent} label="香港揾工本周进度" />
            </section>
            <section className="goal-card speech">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("speech")}</span>
                <h3>大胆说口语</h3>
                <strong>{stats.speechPercent}%</strong>
              </div>
              <Progress
                value={stats.speechPercent}
                label="大胆说口语本周进度"
              />
            </section>
            <section className="goal-card course">
              <div className="goal-heading">
                <span className="goal-icon">{categoryIcon("course")}</span>
                <h3>课程作业</h3>
                <strong>
                  第{data.courseWeek}
                  <small> / 15周</small>
                </strong>
              </div>
              <Progress
                value={Math.round((data.courseWeek / 15) * 100)}
                label="学期进度"
              />
              <div className="goal-foot">
                <span>
                  {data.courseWeek === 15
                    ? "本学期最后一周"
                    : `还有${15 - data.courseWeek}周结束本学期`}
                </span>
                <button
                  className="text-button"
                  onClick={() => setSettings(true)}
                >
                  调整周数
                </button>
              </div>
            </section>
            <details className="reward-history">
              <summary>
                <Coins size={17} />
                卡拉米明细
                <ChevronRight size={16} />
              </summary>
              {data.rewards.length === 0 ? (
                <p>暂无奖励记录。</p>
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
          </>
        )}
        {page === "pool" && (
          <section className="todo-table" aria-label="待办清单">
            <div className="table-tools">
              <select
                aria-label="计划周筛选"
                value={poolWeek}
                onChange={(e) => {
                  setPoolWeek(e.target.value as typeof poolWeek);
                  setExpanded(null);
                }}
              >
                <option value="current">本周</option>
                <option value="next">下周</option>
                <option value="past">往周</option>
                <option value="archived">已清空</option>
              </select>
              <select
                aria-label="类型筛选"
                value={filter}
                onChange={(e) => setFilter(e.target.value as Category | "all")}
              >
                <option value="all">全部类型</option>
                {Object.entries(CATEGORY).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.name}
                  </option>
                ))}
              </select>
              {poolWeek !== "archived" && (
                <label className="done-toggle">
                  <input
                    type="checkbox"
                    checked={showDone}
                    onChange={(e) => setShowDone(e.target.checked)}
                  />
                  已完成
                </label>
              )}
            </div>
            <div className="todo-head" aria-hidden="true">
              <span />
              <span>标题</span>
              <span>类型</span>
              <span>DDL</span>
              <span>优先</span>
            </div>
            {pool.length ? (
              pool.map((task) => todoRow(task))
            ) : (
              <p className="table-empty">暂无记录</p>
            )}
            {poolOpen.length > 0 && (
              <div className="table-foot">
                <span>未完成 {poolOpen.length} 项</span>
                {poolWeek !== "next" && (
                  <button onClick={() => setBatch("move")}>
                    移至下周
                    <ArrowRight size={14} />
                  </button>
                )}
                <button onClick={() => setBatch("archive")}>清空</button>
              </div>
            )}
          </section>
        )}
        {page === "calendar" && (
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
              ).map((date) => {
                const count = data.events.filter(
                  (event) => event.date === date,
                ).length;
                return (
                  <button
                    key={date}
                    aria-label={`${longDate(date)}${date === today ? "，今天" : ""}，${count ? `${count}项事项` : "无事项"}`}
                    aria-pressed={selectedDate === date}
                    className={`${date.slice(0, 7) !== month.slice(0, 7) ? "other-month" : ""} ${date === today ? "today" : ""} ${date === selectedDate ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedDate(date);
                      setDaySheet(date);
                    }}
                  >
                    <span>{dateObject(date).getDate()}</span>
                    {count > 0 && <i />}
                  </button>
                );
              })}
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
        )}
      </main>
      <nav className="bottom-nav" aria-label="主要导航">
        {(
          [
            ["achievement", "成就", Trophy],
            ["daily", "每日", ListTodo],
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
          {...syncNotice}
          title={taskForm === "new" ? "添加待办" : "调整任务"}
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
        <Modal
          {...syncNotice}
          title={taskMenu.title}
          close={() => setTaskMenu(null)}
        >
          <p className="form-note">
            {CATEGORY[taskMenu.category].name} ·{" "}
            {dateLabel(taskMenu.dueDate, today)}
          </p>
          <div className="action-list">
            {taskMenu.status === "open" ? (
              <>
                <button
                  onClick={() => {
                    setTaskForm(taskMenu, taskMenuBase.current);
                    setTaskMenu(null);
                  }}
                >
                  编辑任务 / 修改DDL
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={async () => {
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
                    const result = await update(
                      (previous) =>
                        chooseDaily(
                          previous,
                          date,
                          ids.includes(taskMenu.id)
                            ? ids.filter((id) => id !== taskMenu.id)
                            : [...ids, taskMenu.id],
                        ),
                      taskMenuBase.current,
                    );
                    if (!result) return;
                    setTaskMenu(null);
                  }}
                >
                  {daily.some((item) => item.id === taskMenu.id)
                    ? "从今日移出"
                    : "加入今日"}
                  <ArrowRight size={17} />
                </button>
                {taskMenu.plannedWeek < addDays(week, 7) && (
                  <button
                    onClick={async () => {
                      const result = await update(
                        (previous) =>
                          moveTasks(previous, [taskMenu.id], localDate()),
                        taskMenuBase.current,
                      );
                      if (!result) return;
                      setTaskMenu(null);
                      setToast("已移至下周，已获积分保留。");
                    }}
                  >
                    移至下周
                    <ArrowRight size={17} />
                  </button>
                )}
                <button
                  onClick={async () => {
                    const result = await update(
                      (previous) => archiveTasks(previous, [taskMenu.id]),
                      taskMenuBase.current,
                    );
                    if (!result) return;
                    setTaskMenu(null);
                    setToast("任务已清空，可在待办「已清空」中恢复。");
                  }}
                >
                  清空任务<span>可恢复</span>
                </button>
              </>
            ) : taskMenu.status === "archived" ? (
              <button
                onClick={async () => {
                  const result = await update(
                    (previous) => ({
                      ...previous,
                      tasks: previous.tasks.map((task) =>
                        task.id === taskMenu.id
                          ? { ...task, status: "open" }
                          : task,
                      ),
                    }),
                    taskMenuBase.current,
                  );
                  if (!result) return;
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
        <Modal
          {...syncNotice}
          title="安排今天的3件小事"
          close={() => setChooser(false)}
        >
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
              <p className="muted">先在待办添加本周任务，再来安排今天。</p>
            )}
          </div>
          <button
            className="primary"
            onClick={async () => {
              const result = await update(
                (previous) => chooseDaily(previous, localDate(), selection),
                chooserBase.current,
              );
              if (!result) return;
              setChooser(false);
            }}
          >
            保存今日安排
            <Check size={18} />
          </button>
          <button
            className="text-button full"
            onClick={async () => {
              const result = await update((previous) => {
                const days = { ...previous.daily };
                delete days[localDate()];
                return { ...previous, daily: days };
              }, chooserBase.current);
              if (!result) return;
              setChooser(false);
            }}
          >
            恢复自动安排
          </button>
        </Modal>
      )}
      {batch && (
        <Modal
          {...syncNotice}
          title={batch === "move" ? "把未完成移至下周" : "清空这些未完成任务？"}
          close={() => setBatch(null)}
        >
          <p className="form-note">
            当前筛选中有{poolOpen.length}项未完成任务。
            {batch === "move"
              ? "计划周改为下周，早于下周一的DDL调整到下周一；你可以继续手动修改。"
              : "任务移入可恢复的「已清空」记录。"}
            已获积分保留。
          </p>
          <button
            className="primary"
            onClick={async () => {
              const ids = poolOpen.map((task) => task.id);
              const result = await update(
                (previous) =>
                  batch === "move"
                    ? moveTasks(previous, ids, localDate())
                    : archiveTasks(previous, ids),
                batchBase.current,
              );
              if (!result) return;
              setBatch(null);
              setToast("已重新安排，慢慢来就好。");
            }}
          >
            确认{batch === "move" ? "移至下周" : "清空"} {poolOpen.length} 项
            <Check size={18} />
          </button>
        </Modal>
      )}
      {daySheet && (
        <Modal
          {...syncNotice}
          title={longDate(daySheet, true)}
          close={() => setDaySheet(null)}
        >
          {dayEvents(daySheet).length ? (
            <div className="event-stack">
              {dayEvents(daySheet).map((event) => (
                <article className={`event-card ${event.kind}`} key={event.id}>
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
                      {event.time || "全天"} · {eventKind(event.kind)}
                    </small>
                    <strong>{event.title}</strong>
                    {event.note && <p>{event.note}</p>}
                    <span className="event-actions">
                      <button
                        className="text-button"
                        aria-label={`编辑事项：${event.title}`}
                        onClick={() => {
                          setEventForm(event, daySheetBase.current);
                          setDaySheet(null);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="text-button"
                        aria-label={`移除事项：${event.title}`}
                        onClick={async () => {
                          const result = await update(
                            (previous) => ({
                              ...previous,
                              events: previous.events.filter(
                                (item) => item.id !== event.id,
                              ),
                            }),
                            daySheetBase.current,
                          );
                          if (!result) return;
                          // Later edits in this sheet start from the record just saved.
                          setDaySheet(daySheet, result.snapshot);
                          setToast("事项已移除。");
                        }}
                      >
                        移除
                        <X size={14} />
                      </button>
                    </span>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-line">这一天没有事项。</p>
          )}
        </Modal>
      )}
      {eventForm && (
        <Modal
          {...syncNotice}
          title={eventForm === "new" ? "添加提醒" : "编辑重要事项"}
          close={() => setEventForm(null)}
        >
          <EventForm
            existing={eventForm === "new" ? undefined : eventForm}
            date={selectedDate}
            commit={async (event) => {
              const result = await update(
                (previous) => ({
                  ...previous,
                  events: previous.events.some((item) => item.id === event.id)
                    ? previous.events.map((item) =>
                        item.id === event.id ? event : item,
                      )
                    : [...previous.events, event],
                }),
                eventFormBase.current,
              );
              if (!result) return;
              setEventForm(null);
              setSelectedDate(event.date);
              setMonth(`${event.date.slice(0, 7)}-01`);
              setToast("重要事项已记好。");
            }}
          />
        </Modal>
      )}
      {settings && (
        <Modal
          {...syncNotice}
          title="设置"
          close={() => setSettings(false)}
        >
          <div className="settings-section">
            <h3>学期进度</h3>
            <p>共13周课程 + 2周考试；按实际教学周调整。</p>
            <label className="course-setting">
              当前第
              <select
                aria-label="当前学期周数"
                value={data.courseWeek}
                onChange={(e) => {
                  const courseWeek = Number(e.target.value);
                  void update((previous) => ({
                    ...previous,
                    courseWeek,
                  }));
                }}
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
            <p>
              多个页面同时编辑时，过期的改动会停止保存。待保存备份仅保留在当前页面，关闭或刷新前请先导出；它包含本次尝试的记录，不会自动合并到最新记录。
            </p>
            {pendingBackup && (
              <button
                className="text-button full"
                onClick={() => {
                  if (window.confirm("丢弃待保存备份？已保存的记录不受影响。"))
                    setPendingBackup(null);
                }}
              >
                丢弃待保存备份
              </button>
            )}
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
                  const base = snapshot.current;
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
                      const result = await update(
                        () => normalizeData(value),
                        base,
                        true,
                      );
                      if (!result) return;
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
            <h3>奖励规则</h3>
            <p>
              普通 / 课程任务 +5；求职、口语每周基础目标各 +20；求职额外每3份
              +10；听力每10分钟 +5。基础目标完成后自动补领特别挑战奖励，未满一档不发分，也不跨周累计。
            </p>
            <p>
              成就页的进度按两个子目标各占一半计算。香港揾工：本周投递15份简历，且本周安排的测试/面试全部完成；本周没有面试安排时这一半视为已满足，所以只差简历时显示50%。临时新增面试会让进度下降，但已发奖励不收回。提前完成的面试计入原计划周。大胆说口语：粤语30分钟×2次，以及英语面试题×9题。
            </p>
            <p>清空任务不扣积分。完成记录保留，奖励只发一次。</p>
          </div>
          <div className="settings-foot">
            <span className="wordmark">You Did!</span>
            <span>v0.3</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
