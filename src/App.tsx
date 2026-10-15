import { useState } from "react";
import {
  CalendarDays,
  Check,
  Coins,
  ListTodo,
  Plus,
  Settings2,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  balance,
  chooseDaily,
  completeTask,
  dailyTasks,
  localDate,
  saveTask,
  schedulable,
} from "./domain.ts";
import type { CalendarEvent, Task } from "./domain.ts";
import { download, EventForm, Modal, TaskForm } from "./components.tsx";
import { useAppStore, useDraft } from "./useAppStore.ts";
import {
  ChooserSheet,
  DaySheet,
  SettingsSheet,
  TaskMenuSheet,
} from "./sheets.tsx";
import type { SyncNotice } from "./sheets.tsx";
import { AchievementPage } from "./pages/AchievementPage.tsx";
import { CalendarPage } from "./pages/CalendarPage.tsx";
import { DailyPage } from "./pages/DailyPage.tsx";
import { initialPoolView, PoolPage } from "./pages/PoolPage.tsx";
import { KalamiPage } from "./pages/KalamiPage.tsx";

// The task board has three tabs; the todo list ("pool") is reached from daily.
type Page = "daily" | "achievement" | "pool" | "calendar";
type Board = "task" | "kalami";

export default function App() {
  const [settings, setSettings] = useState(false);
  const app = useAppStore(() => setSettings(true));
  const { snapshot, data, today, update, setToast } = app;
  const [board, setBoard] = useState<Board>("task");
  const [page, setPage] = useState<Page>("daily");
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
  const [chooser, setChooser, chooserBase] = useDraft(snapshot, false);
  const [selection, setSelection] = useState<string[]>([]);
  const [poolView, setPoolView] = useState(initialPoolView);
  const [month, setMonth] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState(localDate);
  async function finish(task: Task) {
    if (!app.canChange()) return;
    const date = localDate();
    app.setToday(date);
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
    if (!app.canChange()) return;
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
  const pendingBackup = app.pendingBackup;
  const sync: SyncNotice = {
    notice: app.saveIssue,
    exportPending: pendingBackup
      ? () =>
          download(
            JSON.stringify(pendingBackup, null, 2),
            `you-did-pending-${localDate()}.json`,
          )
      : undefined,
  };
  const changePage = (next: Page) => {
    setBoard("task");
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const changeBoard = (next: Board) => {
    setBoard(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const onTask = board === "task";
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
            onClick={() => changeBoard("kalami")}
          >
            <Coins size={17} />
            <strong>{balance(data)}</strong>
          </button>
          {onTask && page === "achievement" && (
            <button
              className="icon-button"
              aria-label="设置与数据备份"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={19} />
            </button>
          )}
          {onTask && page === "daily" && (
            <button
              className="add-button"
              aria-label="添加任务"
              onClick={() => setTaskForm("new")}
            >
              <Plus size={20} />
            </button>
          )}
          {onTask && page === "pool" && (
            <button
              className="add-button"
              aria-label="添加待办"
              onClick={() => setTaskForm("new")}
            >
              <Plus size={20} />
            </button>
          )}
          {onTask && page === "calendar" && (
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
      <div className="board-switch" role="tablist" aria-label="板块">
        {(
          [
            ["task", "任务"],
            ["kalami", "卡拉米"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={board === key}
            className={board === key ? "active" : ""}
            onClick={() => changeBoard(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {(app.error || app.saveIssue || pendingBackup) && (
        <div className="storage-warning" role="alert">
          {app.error || app.saveIssue || "有一份待保存备份，可在设置中导出。"}
          <button onClick={() => setSettings(true)}>数据备份</button>
        </div>
      )}
      <main>
        {!onTask && <KalamiPage data={data} />}
        {onTask && page === "daily" && (
          <DailyPage
            data={data}
            today={today}
            onFinish={finish}
            onMenu={(task) => setTaskMenu(task)}
            onArrange={() => {
              setSelection(dailyTasks(data, today).map((task) => task.id));
              setChooser(true);
            }}
            onTodo={() => changePage("pool")}
          />
        )}
        {onTask && page === "achievement" && (
          <AchievementPage data={data} today={today} />
        )}
        {onTask && page === "pool" && (
          <PoolPage
            data={data}
            today={today}
            view={poolView}
            setView={setPoolView}
            onFinish={finish}
            onMenu={(task) => setTaskMenu(task)}
            onBack={() => changePage("daily")}
          />
        )}
        {onTask && page === "calendar" && (
          <CalendarPage
            events={data.events}
            today={today}
            month={month}
            setMonth={setMonth}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            openDay={(date) => setDaySheet(date)}
          />
        )}
      </main>
      {onTask && (
        <nav className="bottom-nav" aria-label="主要导航">
          {(
            [
              ["achievement", "成就", Trophy],
              ["daily", "每日", ListTodo],
              ["calendar", "日历", CalendarDays],
            ] as const
          ).map(([key, label, Icon]) => {
            // The todo list lives under daily, so daily stays highlighted there.
            const active = page === key || (key === "daily" && page === "pool");
            return (
              <button
                key={key}
                aria-current={active ? "page" : undefined}
                className={active ? "active" : ""}
                onClick={() => changePage(key)}
              >
                <span>
                  <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      )}
      {app.toast && (
        <div className="toast" role="status">
          <Sparkles size={18} />
          {app.toast}
        </div>
      )}
      {taskForm && (
        <Modal
          {...sync}
          title={taskForm === "new" ? "添加任务" : "调整任务"}
          close={() => setTaskForm(null)}
        >
          <TaskForm
            existing={taskForm === "new" ? undefined : taskForm}
            today={today}
            defaultToday={
              page === "daily" && dailyTasks(data, today).length < 3
            }
            close={() => setTaskForm(null)}
            commit={commitTask}
          />
        </Modal>
      )}
      {taskMenu && (
        <TaskMenuSheet
          sync={sync}
          update={update}
          notify={setToast}
          close={() => setTaskMenu(null)}
          task={taskMenu}
          base={taskMenuBase.current}
          data={data}
          today={today}
          onEdit={(task, base) => {
            setTaskForm(task, base);
            setTaskMenu(null);
          }}
        />
      )}
      {chooser && (
        <ChooserSheet
          sync={sync}
          update={update}
          close={() => setChooser(false)}
          candidates={data.tasks.filter((task) => schedulable(task, today))}
          selection={selection}
          setSelection={setSelection}
          today={today}
          base={chooserBase.current}
        />
      )}
      {daySheet && (
        <DaySheet
          sync={sync}
          update={update}
          notify={setToast}
          close={() => setDaySheet(null)}
          date={daySheet}
          events={data.events}
          base={daySheetBase.current}
          onEdit={(event, base) => {
            setEventForm(event, base);
            setDaySheet(null);
          }}
          rebase={(next) => setDaySheet(daySheet, next)}
        />
      )}
      {eventForm && (
        <Modal
          {...sync}
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
        <SettingsSheet
          sync={sync}
          update={update}
          notify={setToast}
          close={() => setSettings(false)}
          data={data}
          today={today}
          blocked={app.blocked}
          rawRecovery={app.rawRecovery}
          hasPending={Boolean(pendingBackup)}
          discardPending={() => app.setPendingBackup(null)}
          snapshot={snapshot}
        />
      )}
    </div>
  );
}
