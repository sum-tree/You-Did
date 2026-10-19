import { useState } from "react";
import {
  CalendarDays,
  Check,
  ListTodo,
  Plus,
  Settings2,
  Trophy,
} from "lucide-react";
import {
  balance,
  chooseDaily,
  completeTask,
  dailyTasks,
  getStepEncouragement,
  localDate,
  monthBalance,
  saveTask,
  schedulable,
  toggleInterviewStep,
  uncompleteTask,
} from "./domain.ts";
import type { CalendarEvent, Task } from "./domain.ts";
import { download, EventForm, KalamiIcon, Modal, TaskForm } from "./components.tsx";
import { useAppStore, useDraft } from "./useAppStore.ts";
import {
  ChooserSheet,
  DaySheet,
  InterviewSplitSheet,
  SettingsSheet,
  TaskMenuSheet,
} from "./sheets.tsx";
import type { SyncNotice } from "./sheets.tsx";
import { AchievementPage } from "./pages/AchievementPage.tsx";
import { CalendarPage } from "./pages/CalendarPage.tsx";
import { DailyPage } from "./pages/DailyPage.tsx";
import { initialPoolView, PoolPage } from "./pages/PoolPage.tsx";
import { KalamiPage } from "./pages/KalamiPage.tsx";

// Bottom navigation tabs: 成就, 每日, 日历, 卡拉米; pool (待办) lives under daily.
type Page = "achievement" | "daily" | "calendar" | "kalami" | "pool";

export default function App() {
  const [settings, setSettings] = useState(false);
  const app = useAppStore(() => setSettings(true));
  const { snapshot, data, today, update, setToast } = app;
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
  const [splitTask, setSplitTask, splitTaskBase] = useDraft<Task | null>(
    snapshot,
    null,
  );
  const [selection, setSelection] = useState<string[]>([]);
  const [poolView, setPoolView] = useState(initialPoolView);
  const [month, setMonth] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState(localDate);
  async function finish(task: Task) {
    if (!app.canChange()) return;
    const date = localDate();
    app.setToday(date);
    const base = snapshot.current;
    if (task.status === "done") {
      const isToday = data.completions.some(
        (item) => item.taskId === task.id && item.date === date,
      );
      if (!isToday) {
        setToast("只能撤销今天完成的任务。");
        return;
      }
      const result = await update((previous) => {
        const undone = uncompleteTask(previous, task.id, date);
        const currentDaily = undone.daily[date] ?? dailyTasks(previous, date).map((t) => t.id);
        const nextDaily = currentDaily.includes(task.id)
          ? currentDaily
          : [task.id, ...currentDaily];
        return {
          ...undone,
          daily: {
            ...undone.daily,
            [date]: nextDaily,
          },
        };
      }, base);
      if (!result) return;
      const taken = balance(base.data) - balance(result.snapshot.data);
      setToast(`已撤销完成，收回${taken}卡拉米。`);
      return;
    }
    if (task.status === "open" && task.steps && task.steps.length > 0) {
      const allDone = task.steps.every((s) => s.done);
      if (!allDone) {
        setToast("请在细分子菜单中按顺序完成各准备步骤～");
        return;
      }
    }
    const result = await update(
      (previous) => completeTask(previous, task.id, date),
      base,
    );
    if (!result) return;
    const earned = balance(result.snapshot.data) - balance(base.data);
    setToast(`You did it! +${earned} 卡拉米 · 每一步都算数`);
  }
  async function toggleStep(task: Task, stepId: string) {
    if (!app.canChange()) return;
    const date = localDate();
    app.setToday(date);
    const base = snapshot.current;
    const targetStep = task.steps?.find((s) => s.id === stepId);
    const willBeDone = targetStep ? !targetStep.done : false;

    const result = await update(
      (previous) => toggleInterviewStep(previous, task.id, stepId, date),
      base,
    );
    if (!result) return;
    const earned = balance(result.snapshot.data) - balance(base.data);
    if (earned > 0) {
      setToast(`You did it! 全部步骤已完成，+${earned} 卡拉米 · 每一步都算数`);
    } else if (willBeDone && targetStep) {
      setToast(getStepEncouragement(targetStep.title));
    }
  }
  async function commitTask(
    task: Task,
    todaySelected: boolean,
    addToCalendar?: boolean,
  ) {
    if (!app.canChange()) return;
    const date = localDate();
    const result = await update((previous) => {
      const next = saveTask(previous, task, date);
      const withDaily = todaySelected
        ? chooseDaily(next, date, [
            ...dailyTasks(previous, date).map((item) => item.id),
            task.id,
          ])
        : next;
      if (!addToCalendar) return withDaily;
      const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        title: task.title,
        date: task.dueDate || date,
        time: "",
        kind: task.kind === "interview" ? "interview" : "deadline",
        note: "",
      };
      return {
        ...withDaily,
        events: [...withDaily.events, newEvent],
      };
    }, taskFormBase.current);
    if (!result) return;
    setTaskForm(null);
    setToast(
      addToCalendar
        ? "任务已保存并加入日历，小小的一步也很棒。"
        : "任务已保存，小小的一步也很棒。",
    );
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
            className={`coin-pill ${page === "kalami" ? "active" : ""}`}
            aria-label={`卡拉米：本月 ${monthBalance(data, today.slice(0, 7))}，累计 ${balance(data)}`}
            onClick={() => changePage("kalami")}
          >
            <KalamiIcon size={18} />
            <strong>{monthBalance(data, today.slice(0, 7))}</strong>
            <span className="coin-pill-sub">/ 累计 {balance(data)}</span>
          </button>
          {(page === "achievement" || page === "kalami") && (
            <button
              className="icon-button"
              aria-label="设置与数据备份"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={19} />
            </button>
          )}
          {page === "daily" && (
            <button
              className="add-button"
              aria-label="添加任务"
              onClick={() => setTaskForm("new")}
            >
              <Plus size={20} />
            </button>
          )}
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
      {(app.error || app.saveIssue || pendingBackup) && (
        <div className="storage-warning" role="alert">
          {app.error || app.saveIssue || "有一份待保存备份，可在设置中导出。"}
          <button onClick={() => setSettings(true)}>数据备份</button>
        </div>
      )}
      <main>
        {page === "daily" && (
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
            onToggleStep={toggleStep}
            onOpenSplit={(task) => setSplitTask(task)}
          />
        )}
        {page === "achievement" && (
          <AchievementPage data={data} today={today} />
        )}
        {page === "pool" && (
          <PoolPage
            data={data}
            today={today}
            view={poolView}
            setView={setPoolView}
            onMenu={(task) => setTaskMenu(task)}
            onBack={() => changePage("daily")}
            onOpenSplit={(task) => setSplitTask(task)}
          />
        )}
        {page === "calendar" && (
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
        {page === "kalami" && <KalamiPage data={data} today={today} />}
      </main>
      <nav className="bottom-nav" aria-label="主要导航">
        {[
          {
            key: "achievement" as const,
            label: "成就",
            renderIcon: (active: boolean) => (
              <Trophy size={21} strokeWidth={active ? 2.2 : 1.7} />
            ),
          },
          {
            key: "daily" as const,
            label: "每日",
            renderIcon: (active: boolean) => (
              <ListTodo size={21} strokeWidth={active ? 2.2 : 1.7} />
            ),
          },
          {
            key: "calendar" as const,
            label: "日历",
            renderIcon: (active: boolean) => (
              <CalendarDays size={21} strokeWidth={active ? 2.2 : 1.7} />
            ),
          },
          {
            key: "kalami" as const,
            label: "卡拉米",
            renderIcon: (active: boolean) => (
              <KalamiIcon
                size={21}
                variant="red"
                className={active ? "kalami-active-bounce" : ""}
              />
            ),
          },
        ].map(({ key, label, renderIcon }) => {
          // The todo list lives under daily, so daily stays highlighted there.
          const active = page === key || (key === "daily" && page === "pool");
          return (
            <button
              key={key}
              aria-current={active ? "page" : undefined}
              className={active ? "active" : ""}
              onClick={() => changePage(key)}
            >
              <span>{renderIcon(active)}</span>
              {label}
            </button>
          );
        })}
      </nav>
      {app.toast && (
        <div className="toast" role="status">
          <KalamiIcon size={18} />
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
            defaultToday={page === "daily"}
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
          onSplit={(task, base) => {
            setSplitTask(task, base);
            setTaskMenu(null);
          }}
        />
      )}
      {splitTask && (
        <InterviewSplitSheet
          sync={sync}
          update={update}
          notify={setToast}
          close={() => setSplitTask(null)}
          task={splitTask}
          base={splitTaskBase.current}
        />
      )}
      {chooser && (
        <ChooserSheet
          sync={sync}
          update={update}
          close={() => setChooser(false)}
          candidates={data.tasks
            .filter((task) => schedulable(task, today))
            .sort((a, b) => a.priority - b.priority)}
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
