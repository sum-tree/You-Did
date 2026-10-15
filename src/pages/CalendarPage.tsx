import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dateObject, localDate, weekStart } from "../domain.ts";
import type { CalendarEvent } from "../domain.ts";
import { longDate } from "../components.tsx";

export function CalendarPage({
  events,
  today,
  month,
  setMonth,
  selectedDate,
  setSelectedDate,
  openDay,
}: {
  events: CalendarEvent[];
  today: string;
  month: string;
  setMonth: (month: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  openDay: (date: string) => void;
}) {
  const firstOfMonth = `${month.slice(0, 7)}-01`;
  const shiftMonth = (amount: number) => {
    const d = dateObject(firstOfMonth);
    d.setMonth(d.getMonth() + amount, 1);
    setMonth(localDate(d));
  };
  return (
    <section className="calendar-card">
      <div className="month-heading">
        <button
          className="icon-button"
          aria-label="上个月"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <h2>
          {dateObject(firstOfMonth).toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
          })}
        </h2>
        <button
          className="icon-button"
          aria-label="下个月"
          onClick={() => shiftMonth(1)}
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
          addDays(weekStart(firstOfMonth), i),
        ).map((date) => {
          const count = events.filter((event) => event.date === date).length;
          return (
            <button
              key={date}
              aria-label={`${longDate(date)}${date === today ? "，今天" : ""}，${count ? `${count}项事项` : "无事项"}`}
              aria-pressed={selectedDate === date}
              className={`${date.slice(0, 7) !== month.slice(0, 7) ? "other-month" : ""} ${date === today ? "today" : ""} ${date === selectedDate ? "selected" : ""}`}
              onClick={() => {
                setSelectedDate(date);
                openDay(date);
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
  );
}
