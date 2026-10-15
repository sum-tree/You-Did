import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  Upload,
  X,
} from "lucide-react";
import {
  addDays,
  archiveTasks,
  balance,
  CATEGORY,
  chooseDaily,
  dailyTasks,
  localDate,
  moveTasks,
  normalizeData,
  uncompleteTask,
  validateData,
  weekStart,
} from "./domain.ts";
import type { AppData, CalendarEvent, Task } from "./domain.ts";
import type { Snapshot } from "./storage.ts";
import type { Update } from "./useAppStore.ts";
import { dateLabel, download, eventKind, longDate, Modal } from "./components.tsx";

// Every sheet shows the latest save problem and offers the pending backup.
export interface SyncNotice {
  notice: string;
  exportPending?: () => void;
}
interface SheetProps {
  sync: SyncNotice;
  update: Update;
  notify: (message: string) => void;
  close: () => void;
}

export function TaskMenuSheet({
  sync,
  update,
  notify,
  close,
  task,
  base,
  data,
  today,
  onEdit,
}: SheetProps & {
  task: Task;
  base: Snapshot;
  data: AppData;
  today: string;
  onEdit: (task: Task, base: Snapshot) => void;
}) {
  const inToday = dailyTasks(data, today).some((item) => item.id === task.id);
  return (
    <Modal {...sync} title={task.title} close={close}>
      <p className="form-note">
        {CATEGORY[task.category].name} · {dateLabel(task.dueDate, today)}
      </p>
      <div className="action-list">
        {task.status === "open" ? (
          <>
            <button onClick={() => onEdit(task, base)}>
              编辑任务 / 修改DDL
              <ArrowRight size={17} />
            </button>
            <button
              onClick={async () => {
                const date = localDate();
                const ids = dailyTasks(data, date).map((item) => item.id);
                if (!ids.includes(task.id) && ids.length >= 3) {
                  notify("今日最多3项，请使用手动安排更换任务。");
                  return;
                }
                if (
                  task.plannedWeek > weekStart(date) &&
                  (!task.dueDate || task.dueDate > date)
                ) {
                  notify("这是下周的任务，调整计划周后再加入今日。");
                  return;
                }
                const result = await update(
                  (previous) =>
                    chooseDaily(
                      previous,
                      date,
                      ids.includes(task.id)
                        ? ids.filter((id) => id !== task.id)
                        : [...ids, task.id],
                    ),
                  base,
                );
                if (!result) return;
                close();
              }}
            >
              {inToday ? "从今日移出" : "加入今日"}
              <ArrowRight size={17} />
            </button>
            {task.plannedWeek < addDays(weekStart(today), 7) && (
              <button
                onClick={async () => {
                  const result = await update(
                    (previous) => moveTasks(previous, [task.id], localDate()),
                    base,
                  );
                  if (!result) return;
                  close();
                  notify("已移至下周，已获积分保留。");
                }}
              >
                移至下周
                <ArrowRight size={17} />
              </button>
            )}
            <button
              onClick={async () => {
                const result = await update(
                  (previous) => archiveTasks(previous, [task.id]),
                  base,
                );
                if (!result) return;
                close();
                notify("任务已清空，可在待办「已清空」中恢复。");
              }}
            >
              清空任务<span>可恢复</span>
            </button>
          </>
        ) : task.status === "archived" ? (
          <button
            onClick={async () => {
              const result = await update(
                (previous) => ({
                  ...previous,
                  tasks: previous.tasks.map((item) =>
                    item.id === task.id ? { ...item, status: "open" } : item,
                  ),
                }),
                base,
              );
              if (!result) return;
              close();
              notify("任务已恢复。");
            }}
          >
            恢复任务
            <ArrowRight size={17} />
          </button>
        ) : (
          <>
            <p>已完成并奖励5卡拉米。完成记录保留，不重复计分。</p>
            {data.completions.some(
              (item) => item.taskId === task.id && item.date === today,
            ) && (
              <button
                onClick={async () => {
                  const date = localDate();
                  if (
                    !data.completions.some(
                      (item) => item.taskId === task.id && item.date === date,
                    )
                  ) {
                    notify("只能撤销今天完成的任务。");
                    return;
                  }
                  const result = await update(
                    (previous) => uncompleteTask(previous, task.id, date),
                    base,
                  );
                  if (!result) return;
                  const taken =
                    balance(base.data) - balance(result.snapshot.data);
                  close();
                  notify(`已撤销完成，收回${taken}卡拉米。`);
                }}
              >
                撤销完成<span>仅限今天完成的任务</span>
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function ChooserSheet({
  sync,
  update,
  close,
  candidates,
  selection,
  setSelection,
  today,
  base,
}: Omit<SheetProps, "notify"> & {
  candidates: Task[];
  selection: string[];
  setSelection: (change: (previous: string[]) => string[]) => void;
  today: string;
  base: Snapshot;
}) {
  return (
    <Modal {...sync} title="安排今天的3件小事" close={close}>
      <p className="form-note">选择最多3项。</p>
      <div className="chooser-list">
        {candidates.length ? (
          candidates.map((task) => (
            <label key={task.id}>
              <input
                type="checkbox"
                checked={selection.includes(task.id)}
                disabled={!selection.includes(task.id) && selection.length >= 3}
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
            base,
          );
          if (!result) return;
          close();
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
          }, base);
          if (!result) return;
          close();
        }}
      >
        恢复自动安排
      </button>
    </Modal>
  );
}

export function DaySheet({
  sync,
  update,
  notify,
  close,
  date,
  events,
  base,
  onEdit,
  rebase,
}: SheetProps & {
  date: string;
  events: CalendarEvent[];
  base: Snapshot;
  onEdit: (event: CalendarEvent, base: Snapshot) => void;
  rebase: (snapshot: Snapshot) => void;
}) {
  const dayEvents = events
    .filter((event) => event.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <Modal {...sync} title={longDate(date, true)} close={close}>
      {dayEvents.length ? (
        <div className="event-stack">
          {dayEvents.map((event) => (
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
                    onClick={() => onEdit(event, base)}
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
                        base,
                      );
                      if (!result) return;
                      // Later edits in this sheet start from the record just saved.
                      rebase(result.snapshot);
                      notify("事项已移除。");
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
  );
}

export function SettingsSheet({
  sync,
  update,
  notify,
  close,
  data,
  today,
  blocked,
  rawRecovery,
  hasPending,
  discardPending,
  snapshot,
}: SheetProps & {
  data: AppData;
  today: string;
  blocked: boolean;
  rawRecovery: string | null;
  hasPending: boolean;
  discardPending: () => void;
  snapshot: { current: Snapshot };
}) {
  return (
    <Modal {...sync} title="设置" close={close}>
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
        {hasPending && (
          <button
            className="text-button full"
            onClick={() => {
              if (window.confirm("丢弃待保存备份？已保存的记录不受影响。"))
                discardPending();
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
              download(rawRecovery, `you-did-original-${today}.json`)
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
                if (file.size > 10 * 1024 * 1024) throw new Error("too large");
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
                  notify("备份已恢复，继续积累你的小小进步。");
                }
              } catch {
                notify("备份格式无效或文件过大，当前记录保持不变。");
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
          香港揾工：本周投递15份简历，且本周安排的测试/面试全部完成。没有面试安排时进度只看简历；有面试安排时简历与面试各占一半。临时新增面试会让进度下降，但已发奖励不收回。提前完成的面试计入原计划周。大胆说口语：粤语30分钟×2次，以及英语面试题×9题。
        </p>
        <p>
          每周自动在待办生成：香港秋招简历x5（3条）、英语面试练习3题（3条）、粤语30分钟（2条）。自动安排时，每日先放一条简历，再放普通任务，列表不到3条时加一条英语（英语做完后才轮到粤语）；同一系列每天只安排一条，英语和粤语不同天出现。手动安排时不套用这些规则。新的一周开始时，上周未完成的自动任务移入「已清空」，可恢复。
        </p>
        <p>
          清空任务不扣积分。完成记录保留，奖励只发一次。误点完成时，可在当天从任务菜单「撤销完成」，会收回这次完成带来的卡拉米；隔天后不能撤销。
        </p>
      </div>
      <div className="settings-foot">
        <span className="wordmark">You Did!</span>
        <span>v0.5</span>
      </div>
    </Modal>
  );
}
