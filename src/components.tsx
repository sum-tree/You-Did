import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { BookOpen, BriefcaseBusiness, Mic, Plus, X } from "lucide-react";
import {
  CATEGORY,
  dateObject,
  inferContribution,
  KIND,
  weekStart,
} from "./domain.ts";
import type { CalendarEvent, Category, Task } from "./domain.ts";

export const shortDate = (date: string) =>
  dateObject(date).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
export const dateLabel = (date: string, today: string) =>
  !date
    ? "无截止日期"
    : date === today
      ? "今天截止"
      : date < today
        ? `已逾期 · ${shortDate(date)}`
        : `${shortDate(date)}截止`;
export const categoryIcon = (category: Category, size = 20) =>
  category === "job" ? (
    <BriefcaseBusiness size={size} />
  ) : category === "speech" ? (
    <Mic size={size} />
  ) : (
    <BookOpen size={size} />
  );
export function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Progress({ value, label }: { value: number; label: string }) {
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
export function Modal({
  title,
  children,
  close,
  notice,
  exportPending,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  notice?: string;
  exportPending?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {notice && (
          <p className="form-note" role="alert">
            {notice}
          </p>
        )}
        {exportPending && (
          <button className="outline-button full" onClick={exportPending}>
            导出待保存备份
          </button>
        )}
        {children}
      </div>
    </dialog>
  );
}
export function TaskForm({
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
  const [title, setTitle] = useState(existing?.title ?? "");
  const detected = inferContribution(title.trim(), category);
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
        // New tasks start in this week; use "移至下周" to plan ahead.
        plannedWeek: existing?.plannedWeek ?? weekStart(today),
        ...inferContribution(title, category),
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
          aria-describedby="task-goal"
          required
          maxLength={200}
          placeholder="例如：投递3份心仪的岗位"
          value={title}
          onChange={(e) => {
            e.currentTarget.setCustomValidity("");
            setTitle(e.target.value);
          }}
          autoFocus
        />
        <small className="field-hint" id="task-goal">
          计入：
          {detected.kind === "none"
            ? "不计目标量"
            : `${KIND[detected.kind].label.split("（")[0]} · ${detected.amount}${KIND[detected.kind].unit}`}
        </small>
      </label>
      <label>
        任务类型
        <select
          aria-label="任务类型"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {Object.entries(CATEGORY).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          优先级
          <select name="priority" defaultValue={existing?.priority ?? 1}>
            <option value="0">P0</option>
            <option value="1">P1</option>
            <option value="2">P2</option>
          </select>
        </label>
        <label>
          截止日期（选填）
          <input
            name="dueDate"
            type="date"
            defaultValue={existing?.dueDate ?? ""}
            min="1900-01-01"
            max="2100-12-31"
          />
        </label>
      </div>
      {!existing && (
        <label className="checkbox-label">
          <input name="today" type="checkbox" />
          加入今日核心任务
        </label>
      )}
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
export function EventForm({
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
