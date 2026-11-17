import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clock3,
  Menu,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  addDays,
  archiveTasks,
  balance,
  buildInterviewSteps,
  calendarDayItems,
  CATEGORY,
  chooseDaily,
  dailyTasks,
  isGenerated,
  localDate,
  MAX_INTERVIEW_STEPS,
  moveTasks,
  moveTasksToCurrentWeek,
  normalizeData,
  setInterviewSteps,
  uncompleteTask,
  upgradeData,
  weekStart,
} from "./domain.ts";
import type { AppData, CalendarEvent, InterviewStep, Task } from "./domain.ts";
import type { Snapshot } from "./storage.ts";
import type { Update } from "./useAppStore.ts";
import {
  categoryIcon,
  dateLabel,
  eventKind,
  longDate,
  Modal,
  shareOrDownload,
  taskRewardHint,
} from "./components.tsx";

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
  onSplit,
}: SheetProps & {
  task: Task;
  base: Snapshot;
  data: AppData;
  today: string;
  onEdit: (task: Task, base: Snapshot) => void;
  onSplit?: (task: Task, base: Snapshot) => void;
}) {
  const inToday = dailyTasks(data, today).some((item) => item.id === task.id);
  const currentWeek = weekStart(today);
  const nextWeek = addDays(currentWeek, 7);
  const canMoveWeek = !isGenerated(task);
  const isPlannedFuture = task.plannedWeek >= nextWeek;
  return (
    <Modal {...sync} title={task.title} close={close}>
      <p className="form-note">
        {CATEGORY[task.category].name} · {dateLabel(task.dueDate, today)}
        {task.status === "open" && ` · ${taskRewardHint(task, today)}`}
      </p>
      <div className="action-list">
        {task.status === "open" ? (
          <>
            <button onClick={() => onEdit(task, base)}>
              编辑任务 / 修改DDL
              <ArrowRight size={17} />
            </button>
            {onSplit && task.kind !== "cantonese" && (
              <button onClick={() => onSplit(task, base)}>
                {task.steps && task.steps.length > 0
                  ? "调整拆解步骤"
                  : "拆解任务"}
                <ArrowRight size={17} />
              </button>
            )}
            <button
              onClick={async () => {
                const date = localDate();
                const ids = dailyTasks(data, date).map((item) => item.id);
                if (
                  task.plannedWeek > weekStart(date) &&
                  (!task.dueDate || task.dueDate > date)
                ) {
                  notify("这是下周的任务，先移回本周后再加入今日。");
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
            {canMoveWeek && (
              <button
                onClick={async () => {
                  const date = localDate();
                  const result = await update(
                    (previous) =>
                      isPlannedFuture
                        ? moveTasksToCurrentWeek(previous, [task.id], date)
                        : moveTasks(previous, [task.id], date),
                    base,
                  );
                  if (!result) return;
                  close();
                  notify(
                    isPlannedFuture
                      ? "已移回本周待办。"
                      : "已移至下周待办。",
                  );
                }}
              >
                {isPlannedFuture ? "移至本周" : "移至下周"}
                <span>{isPlannedFuture ? "纳入本周安排" : "推迟至下周一"}</span>
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
            <p>
              已完成并获得
              {data.rewards.find((item) => item.id === `task:${task.id}`)
                ?.amount ?? 0}
              卡拉米。完成记录保留，不重复计分。
            </p>
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
                  const result = await update((previous) => {
                    const undone = uncompleteTask(previous, task.id, date);
                    const currentDaily =
                      undone.daily[date] ??
                      dailyTasks(previous, date).map((t) => t.id);
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
    <Modal {...sync} title="安排今天的小事" close={close}>
      <p className="form-note">选择要专注的任务，默认推荐3项。</p>
      <div className="chooser-list">
        {candidates.length ? (
          candidates.map((task) => (
            <label key={task.id}>
              <input
                type="checkbox"
                checked={selection.includes(task.id)}
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
          // Save only what the panel shows, so hidden duplicates of a weekly
          // series never sneak into today's list.
          const visible = new Set(candidates.map((task) => task.id));
          const result = await update(
            (previous) =>
              chooseDaily(
                previous,
                localDate(),
                selection.filter((id) => visible.has(id)),
              ),
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
  data,
  today,
  showAllTasks,
  base,
  onEdit,
  onOpenTask,
  rebase,
}: SheetProps & {
  date: string;
  data: AppData;
  today: string;
  showAllTasks: boolean;
  base: Snapshot;
  onEdit: (event: CalendarEvent, base: Snapshot) => void;
  onOpenTask: (task: Task, base: Snapshot) => void;
  rebase: (snapshot: Snapshot) => void;
}) {
  const dayEvents = data.events.filter((event) => event.date === date);
  const dayTaskItems = showAllTasks
    ? (calendarDayItems(data, today, true).get(date) ?? []).filter(
        (item) => item.source === "task" && item.task,
      )
    : [];
  const hasContent = dayEvents.length > 0 || dayTaskItems.length > 0;
  return (
    <Modal {...sync} title={longDate(date, true)} close={close}>
      {hasContent ? (
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
                  {event.time ? `${event.time} · ` : ""}
                  {eventKind(event.kind)}
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
          {dayTaskItems.map((item) => {
            const task = item.task!;
            const done = task.status === "done";
            return (
              <article
                className={`event-card task-ddl-card ${task.kind === "interview" ? "interview" : task.category} ${done ? "is-done" : ""}`}
                key={item.id}
              >
                <span
                  className={`event-icon ${task.kind === "interview" ? "interview" : task.category}`}
                >
                  {categoryIcon(task.category, 18)}
                </span>
                <span>
                  <small>
                    {CATEGORY[task.category].name}
                    {item.taskNote ? ` · ${item.taskNote}` : ""}
                  </small>
                  <strong>{task.title}</strong>
                  <span className="event-actions">
                    <button
                      className="text-button"
                      aria-label={`查看任务操作：${task.title}`}
                      onClick={() => onOpenTask(task, base)}
                    >
                      {done ? "查看详情" : "任务操作"}
                      <ArrowRight size={13} />
                    </button>
                  </span>
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-line">
          {showAllTasks ? "这一天暂无重要事项或任务。" : "这一天暂无重要事项。"}
        </p>
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [stagedImport, setStagedImport] = useState<{
    value: AppData;
    fileName: string;
    base: Snapshot;
  } | null>(null);

  return (
    <Modal {...sync} title="设置" close={close}>
      <div className="settings-section">
        <h3>学期进度</h3>
        <p>共13周课程 + 2周考试；按实际教学周自动推进，也可手动微调。</p>
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
          记录保存在当前浏览器本地。换设备、换网址或清理浏览器缓存前，请先导出备份。
        </p>
        <p>
          多标签页同时编辑时，过期改动会暂停覆盖并保留为「待保存备份」，关闭或刷新前可导出保存。
        </p>
        {hasPending &&
          (!confirmDiscard ? (
            <button
              type="button"
              className="text-button full"
              onClick={() => setConfirmDiscard(true)}
            >
              丢弃待保存备份
            </button>
          ) : (
            <div className="inline-confirm" role="alert">
              <p>确定丢弃待保存备份吗？当前已保存的正式记录不受影响。</p>
              <div className="inline-confirm-actions">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setConfirmDiscard(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="confirm-danger-btn"
                  onClick={() => {
                    setConfirmDiscard(false);
                    discardPending();
                  }}
                >
                  确认丢弃
                </button>
              </div>
            </div>
          ))}
        <button
          type="button"
          className="outline-button full"
          onClick={() =>
            void shareOrDownload(
              JSON.stringify(data, null, 2),
              `you-did-${today}.json`,
            )
          }
        >
          <ArrowDownToLine size={17} />
          导出备份
        </button>
        {blocked && rawRecovery && (
          <button
            type="button"
            className="outline-button full"
            onClick={() =>
              void shareOrDownload(
                rawRecovery,
                `you-did-original-${today}.json`,
              )
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
                const value = upgradeData(JSON.parse(await file.text()));
                if (!value) throw new Error("invalid");
                setStagedImport({
                  value,
                  fileName: file.name,
                  base,
                });
              } catch {
                setStagedImport(null);
                notify("备份格式无效或文件过大，当前记录保持不变。");
              }
            }}
          />
        </label>
        {stagedImport && (
          <div className="inline-confirm" role="alert">
            <p>
              已读取「{stagedImport.fileName}」，导入后将替换当前浏览器中的记录。建议先点击上方「导出备份」留存当前进度。
            </p>
            <div className="inline-confirm-actions">
              <button
                type="button"
                className="outline-button"
                onClick={() => setStagedImport(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="confirm-primary-btn"
                onClick={async () => {
                  const currentStaged = stagedImport;
                  setStagedImport(null);
                  const result = await update(
                    () => normalizeData(currentStaged.value),
                    currentStaged.base,
                    true,
                  );
                  if (!result) return;
                  notify("备份已恢复，继续积累你的小小进步。");
                }}
              >
                确认导入替换
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="settings-section">
        <h3>奖励与排期规则</h3>
        <p>
          完成任务：普通任务 +2，简历投递 +4，测试/笔试 +8，英语面试题 +4，听力 +2，课程作业 +1；粤语口语 +2（使用计时器满15分钟 +1、满30分钟 +2，也可直接勾选完成 +2）。面试按添加后第几天完成：0–3天 +12，4–6天 +4，7–10天 +2，更晚 +1，与截止日期无关。
        </p>
        <p>
          每周目标：香港揾工 +10，超出15份后每3份 +4；大胆说口语 +7，听力每10分钟 +2。基础目标完成后自动补领挑战奖励，未满一档不发分，也不跨周累计。
        </p>
        <p>
          目标进度：香港揾工需本周投递15份简历且完成本周计划的测试/笔试与面试（无面试安排时仅看简历；提前完成的面试计入原计划周）。大胆说口语为粤语4份 + 英语2份即达100%（粤语满30分钟计1份、15–29分钟计半份；英语每完成1条计1份）。
        </p>
        <p>
          每周自动生成：香港秋招简历x5（3条）、粤语30分钟（7条）、英语面试练习3题（3条）。自动安排时，每日默认预留1条粤语与1条简历，穿插逾期或高优普通任务；本周完成2次粤语后，若当日列表未满3项会自动加入1条英语。新的一周开始时，上周未完成的自动任务自动清理，不会堆积到「已清空」。
        </p>
        <p>
          撤销与调整：清空、编辑或跨周移动任务均不扣回已得卡拉米；当天误点完成可在任务菜单或勾选框「撤销完成」，隔天后不可撤销。日历事项独立用于提醒，不自动计入任务或发放积分。
        </p>
      </div>
      <div className="settings-foot">
        <span className="wordmark">You Did!</span>
        <span>v0.6</span>
      </div>
    </Modal>
  );
}

export function InterviewSplitSheet({
  sync,
  update,
  notify,
  close,
  task,
  base,
}: SheetProps & {
  task: Task;
  base: Snapshot;
}) {
  const [activeTemplate, setActiveTemplate] = useState<
    "interview" | "video" | "custom"
  >(() => {
    if (task.steps && task.steps.length > 0) {
      if (task.steps.some((s) => s.title.includes("视频"))) return "video";
      if (task.kind === "interview" && task.steps.length === 11) return "interview";
      return "custom";
    }
    return task.kind === "interview" ? "interview" : "custom";
  });

  const [steps, setSteps] = useState<InterviewStep[]>(() => {
    if (task.steps && task.steps.length > 0) {
      return task.steps;
    }
    if (task.kind === "interview") {
      return buildInterviewSteps("interview");
    }
    return [];
  });

  const [newTitle, setNewTitle] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentIndex = useRef<number>(0);
  const addInputRef = useRef<HTMLInputElement>(null);

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setActiveTemplate("custom");
  };

  const handleTitleChange = (id: string, title: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
    setActiveTemplate("custom");
  };

  const handleDelete = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setActiveTemplate("custom");
  };

  const handleAdd = () => {
    if (steps.length >= MAX_INTERVIEW_STEPS) {
      notify(`单个任务最多支持拆分为 ${MAX_INTERVIEW_STEPS} 个小步哦～`);
      return;
    }
    const trimmed = newTitle.trim();
    if (!trimmed) {
      notify("请先输入小步内容再添加");
      addInputRef.current?.focus();
      return;
    }
    setSteps((prev) => [
      ...prev,
      {
        id: `custom-step-${Date.now()}-${prev.length + 1}`,
        title: trimmed,
        done: false,
      },
    ]);
    setNewTitle("");
    setActiveTemplate("custom");
    notify(`已添加「${trimmed}」`);
  };

  return (
    <Modal
      {...sync}
      title={task.steps && task.steps.length > 0 ? "调整拆解步骤" : "拆解任务"}
      close={close}
    >
      <p className="form-note">
        可选用标准模板（面试或录视频），或自由编辑、拖动与新增自定义小步（最多 {MAX_INTERVIEW_STEPS} 步）。全部完成后自动结算原任务奖励。
      </p>
      <div className="split-form">
        <div className="split-template-group">
          <button
            type="button"
            className={`template-btn ${activeTemplate === "interview" ? "active" : ""}`}
            onClick={() => {
              setSteps(buildInterviewSteps("interview"));
              setActiveTemplate("interview");
              notify("已应用面试标准模板（11步）");
            }}
          >
            {activeTemplate === "interview" && <Check size={14} />}
            面试标准模板（11步）
          </button>
          <button
            type="button"
            className={`template-btn ${activeTemplate === "video" ? "active" : ""}`}
            onClick={() => {
              setSteps(buildInterviewSteps("video"));
              setActiveTemplate("video");
              notify("已应用录视频标准模板（11步）");
            }}
          >
            {activeTemplate === "video" && <Check size={14} />}
            录视频标准模板（11步）
          </button>
        </div>

        <div className="steps-editor-list">
          <h4>
            步骤清单（{steps.length}/{MAX_INTERVIEW_STEPS}，可编辑、拖动排序或删除）：
          </h4>
          {steps.length === 0 ? (
            <p className="form-note steps-empty-hint">
              暂无步骤，可在下方输入小步并点击添加，或选用上方预设模板
            </p>
          ) : (
            steps.map((step, idx) => (
              <div
                key={step.id}
                data-step-index={idx}
                className={`step-card-row ${dragIndex === idx ? "is-dragging" : ""} ${step.done ? "is-done-step" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== idx) {
                    moveStep(dragIndex, idx);
                  }
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <div className="step-input-card">
                  {step.done && (
                    <span className="step-done-pill" title="该步已完成">
                      ✓
                    </span>
                  )}
                  <input
                    type="text"
                    value={step.title}
                    maxLength={200}
                    aria-label={`步骤 ${idx + 1}`}
                    onChange={(e) => handleTitleChange(step.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="drag-handle-btn"
                    aria-label={`拖动调整步骤 ${idx + 1} 顺序`}
                    title="按住拖动调整顺序"
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      touchStartY.current = touch.clientY;
                      touchCurrentIndex.current = idx;
                      setDragIndex(idx);
                    }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const target = document.elementFromPoint(
                        touch.clientX,
                        touch.clientY,
                      );
                      const row = target?.closest("[data-step-index]");
                      if (row) {
                        const targetIdx = Number(
                          row.getAttribute("data-step-index"),
                        );
                        if (
                          !Number.isNaN(targetIdx) &&
                          targetIdx !== touchCurrentIndex.current
                        ) {
                          moveStep(touchCurrentIndex.current, targetIdx);
                          touchCurrentIndex.current = targetIdx;
                          setDragIndex(targetIdx);
                        }
                      }
                    }}
                    onTouchEnd={() => setDragIndex(null)}
                    onTouchCancel={() => setDragIndex(null)}
                  >
                    <Menu size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  className="delete-step-btn"
                  aria-label={`删除步骤 ${idx + 1}`}
                  onClick={() => handleDelete(step.id)}
                >
                  <X size={18} />
                </button>
              </div>
            ))
          )}

          <div className="add-step-card">
            <input
              ref={addInputRef}
              type="text"
              placeholder={
                steps.length >= MAX_INTERVIEW_STEPS
                  ? `已达 ${MAX_INTERVIEW_STEPS} 步上限`
                  : "新增自定义小步..."
              }
              disabled={steps.length >= MAX_INTERVIEW_STEPS}
              value={newTitle}
              maxLength={200}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <button
              type="button"
              className="add-step-btn"
              disabled={steps.length >= MAX_INTERVIEW_STEPS}
              onClick={handleAdd}
            >
              <Plus size={16} />
              添加
            </button>
          </div>
        </div>
      </div>

      <button
        className="primary full"
        onClick={async () => {
          const validSteps = steps.filter((s) => s.title.trim() !== "");
          if (validSteps.length === 0) {
            if (task.steps && task.steps.length > 0) {
              const result = await update(
                (previous) => setInterviewSteps(previous, task.id, []),
                base,
              );
              if (!result) return;
              close();
              notify("已清除拆解步骤，恢复为普通任务。");
              return;
            }
            notify("请先添加至少一个拆解步骤。");
            return;
          }
          const date = localDate();
          const result = await update(
            (previous) =>
              setInterviewSteps(previous, task.id, validSteps, date),
            base,
          );
          if (!result) return;
          close();
          const earned =
            balance(result.snapshot.data) - balance(base.data);
          if (earned > 0) {
            notify(
              `剩余步骤均已完成，+${earned} 卡拉米 · 每一步都算数`,
            );
          } else {
            notify("已拆分成小步，每走一步都离目标更近。");
          }
        }}
      >
        <Check size={18} />
        确认采用拆分步骤
      </button>
    </Modal>
  );
}

