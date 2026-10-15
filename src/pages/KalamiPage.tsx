import { useEffect, useRef, useState } from "react";
import { balance } from "../domain.ts";
import type { AppData } from "../domain.ts";
import { shortDate } from "../components.tsx";

const JAR_SIZE = 100;
// Glass body: rounded shoulders, flatter base so the bottom row is not cut off.
const JAR_BODY =
  "M64,46 H176 A40,40 0 0 1 216,86 V262 A22,22 0 0 1 194,284 H46 A22,22 0 0 1 24,262 V86 A40,40 0 0 1 64,46 Z";
const SEEN_KEY = "you-did:jar-seen";
// Soft jelly colours from the reference art: red, green, blue.
const COLORS = [
  { light: "#ffd2cc", base: "#f39a90", edge: "#d9776c" },
  { light: "#d6f2c4", base: "#9fd67f", edge: "#78b65a" },
  { light: "#eef4fc", base: "#c9dbf2", edge: "#98b2d6" },
];
// Deterministic packing from the bottom: rows alternate 8 and 7 jellies so the
// offset rows stay inside the glass; a small stable jitter makes the pile look
// hand-dropped. 100 jellies fill 14 rows.
function slot(index: number) {
  const pair = Math.floor(index / 15);
  const inPair = index % 15;
  const odd = inPair >= 8;
  const row = pair * 2 + (odd ? 1 : 0);
  const col = odd ? inPair - 8 : inPair;
  const hash = (index * 2654435761) >>> 0;
  return {
    x: (odd ? 54 : 43) + col * 22 + ((hash % 5) - 2),
    y: 266 - row * 16 + ((hash >>> 3) % 3) - 1,
    turn: ((hash >>> 5) % 21) - 10,
    color: COLORS[(hash >>> 9) % COLORS.length],
  };
}
function readSeen(): number | null {
  try {
    const value = window.localStorage.getItem(SEEN_KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}
function writeSeen(value: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(value));
  } catch {
    // Remembering what was already seen is only a convenience.
  }
}
function Blob({ index, drop, delay }: { index: number; drop: boolean; delay: number }) {
  const { x, y, turn, color } = slot(index);
  const gradient = `jelly-${COLORS.indexOf(color)}`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <g
        className={drop ? "jelly drop" : "jelly"}
        style={drop ? { animationDelay: `${delay}ms` } : undefined}
      >
        <path
          d="M-11,2.5 C-11,-6 -6,-10 0,-10 C6,-10 11,-6 11,2.5 C11,6.5 8,8.5 0,8.5 C-8,8.5 -11,6.5 -11,2.5Z"
          fill={`url(#${gradient})`}
          stroke={color.edge}
          strokeWidth="1.2"
        />
        <ellipse cx="-4.5" cy="-5.5" rx="3.2" ry="1.7" fill="#fff" opacity="0.85" transform="rotate(-20 -4.5 -5.5)" />
        <circle cx="-3.6" cy="-0.8" r="0.95" fill="#4b4a48" />
        <circle cx="3.8" cy="-1.3" r="0.95" fill="#4b4a48" />
        <path d="M-1.7,1.3 L1.9,0.9 L0,3.3 Z" fill="#fffdf8" stroke="#4b4a48" strokeWidth="0.7" strokeLinejoin="round" />
      </g>
    </g>
  );
}
export function KalamiPage({ data }: { data: AppData }) {
  const total = balance(data);
  const fullJars = total > 0 ? Math.floor((total - 1) / JAR_SIZE) : 0;
  const inJar = total - fullJars * JAR_SIZE;
  const jarStart = fullJars * JAR_SIZE;
  // Kalami earned since this jar was last viewed drop in; first visit is calm.
  const [dropFrom, setDropFrom] = useState(() => {
    const seen = readSeen();
    return seen === null || seen >= total ? total : seen;
  });
  const previous = useRef(total);
  useEffect(() => {
    if (total > previous.current) setDropFrom(previous.current);
    previous.current = total;
    writeSeen(total);
  }, [total]);
  return (
    <section className="kalami-page">
      <div className="kalami-total">
        <strong>{total}</strong>
        <span>颗卡拉米</span>
      </div>
      <svg
        className="kalami-jar"
        viewBox="0 0 240 300"
        role="img"
        aria-label={`卡拉米罐：共${total}颗卡拉米${fullJars ? `，已装满${fullJars}罐` : ""}`}
      >
        <defs>
          {COLORS.map((color, i) => (
            <radialGradient key={i} id={`jelly-${i}`} cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor={color.light} />
              <stop offset="100%" stopColor={color.base} />
            </radialGradient>
          ))}
          <clipPath id="jar-inside">
            <path d="M64,52 H176 A34,34 0 0 1 210,86 V262 A16,16 0 0 1 194,278 H46 A16,16 0 0 1 30,262 V86 A34,34 0 0 1 64,52 Z" />
          </clipPath>
        </defs>
        <rect x="70" y="12" width="100" height="22" rx="9" className="jar-lid" />
        <rect x="80" y="32" width="80" height="18" rx="5" className="jar-neck" />
        <path d={JAR_BODY} className="jar-glass" />
        <g clipPath="url(#jar-inside)">
          {Array.from({ length: inJar }, (_, i) => {
            const drop = jarStart + i >= dropFrom;
            return (
              <Blob
                key={i}
                index={i}
                drop={drop}
                delay={Math.min(jarStart + i - dropFrom, 20) * 70}
              />
            );
          })}
        </g>
        <path d="M44,78 C40,130 40,200 46,250" className="jar-shine" />
        <path d={JAR_BODY} className="jar-rim" />
      </svg>
      {fullJars > 0 && (
        <p className="kalami-jars">
          {Array.from({ length: Math.min(fullJars, 10) }, (_, i) => (
            <span key={i} className="mini-jar" aria-hidden="true" />
          ))}
          已装满 {fullJars} 罐
        </p>
      )}
      {total === 0 && <p className="kalami-empty">完成任务后，卡拉米会落进罐子里。</p>}
      <h2 className="section-title">获得记录</h2>
      <div className="reward-history kalami-history">
        {data.rewards.length === 0 ? (
          <p>暂无记录。</p>
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
      </div>
    </section>
  );
}
