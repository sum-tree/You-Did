import { useEffect, useRef, useState } from "react";
import { balance } from "../domain.ts";
import type { AppData } from "../domain.ts";
import { KalamiIcon, shortDate } from "../components.tsx";

const JAR_SIZE = 100;
const SEEN_KEY = "you-did:jar-seen";

// Precise jelly colors from reference image: Red, Green, Blue
const COLORS = [
  {
    name: "red",
    light: "#fce5e2",
    base: "#f79389",
    deep: "#e87b70",
    beak: "#a6746f",
  },
  {
    name: "green",
    light: "#eaf8e6",
    base: "#a1e590",
    deep: "#88d675",
    beak: "#7da773",
  },
  {
    name: "blue",
    light: "#f6f9fc",
    base: "#dee9f6",
    deep: "#c3d6eb",
    beak: "#a9bed5",
  },
];

// Balanced color permutation: guarantees exactly 1 Red, 1 Green, 1 Blue in every 3 jellies
const PERMUTATIONS = [
  [0, 1, 2], // Red, Green, Blue
  [1, 0, 2], // Green, Red, Blue
  [2, 0, 1], // Blue, Red, Green
  [0, 2, 1], // Red, Blue, Green
  [1, 2, 0], // Green, Blue, Red
  [2, 1, 0], // Blue, Green, Red
];

function getBalancedColor(index: number) {
  const group = Math.floor(index / 3);
  const inGroup = index % 3;
  const permIndex = (group * 7 + 11) % PERMUTATIONS.length;
  const colorIndex = PERMUTATIONS[permIndex][inGroup];
  return COLORS[colorIndex];
}

// Seamless unified glass jar outline: lip collar -> neck -> shoulders -> body -> base -> neck -> lip
const JAR_OUTLINE =
  "M 82,36 H 178 A 6,6 0 0 1 184,42 V 46 A 4,4 0 0 1 180,50 H 172 V 62 C 200,64 230,76 230,98 V 276 C 230,296 214,306 194,306 H 66 C 46,306 30,296 30,276 V 98 C 30,76 60,64 88,62 V 50 H 80 A 4,4 0 0 1 76,46 V 42 A 6,6 0 0 1 82,36 Z";

const JAR_INSIDE =
  "M 88,52 V 64 C 60,66 32,78 32,98 V 276 C 32,295 48,304 68,304 H 192 C 212,304 228,295 228,276 V 98 C 228,78 200,66 172,64 V 52 Z";

// Physical packing configuration: 16 rows totaling exactly 100 jellies.
// Arranged naturally like soft candies in an apothecary jar.
const ROW_CONFIG: { count: number; y: number; startX: number; stepX: number }[] = [
  { count: 7, y: 280, startX: 58, stepX: 24 },
  { count: 7, y: 266, startX: 53, stepX: 25.6 },
  { count: 7, y: 252, startX: 58, stepX: 24 },
  { count: 7, y: 238, startX: 53, stepX: 25.6 },
  { count: 7, y: 224, startX: 58, stepX: 24 },
  { count: 7, y: 210, startX: 53, stepX: 25.6 },
  { count: 7, y: 196, startX: 58, stepX: 24 },
  { count: 7, y: 182, startX: 53, stepX: 25.6 },
  { count: 7, y: 168, startX: 58, stepX: 24 },
  { count: 7, y: 154, startX: 53, stepX: 25.6 },
  { count: 7, y: 140, startX: 58, stepX: 24 },
  { count: 7, y: 126, startX: 53, stepX: 25.6 },
  { count: 6, y: 112, startX: 68, stepX: 24.8 },
  { count: 5, y: 98, startX: 78, stepX: 26 },
  { count: 4, y: 84, startX: 91, stepX: 26 },
  { count: 1, y: 72, startX: 130, stepX: 0 },
];

function slot(index: number) {
  let remaining = index % JAR_SIZE;
  let cfg = ROW_CONFIG[0];
  let col = 0;
  for (let r = 0; r < ROW_CONFIG.length; r++) {
    const row = ROW_CONFIG[r];
    if (remaining < row.count) {
      cfg = row;
      col = remaining;
      break;
    }
    remaining -= row.count;
  }
  const hash = (index * 2654435761) >>> 0;
  const color = getBalancedColor(index);
  // Stable micro-jitter for organic hand-dropped feel
  const jitterX = ((hash % 7) - 3) * 0.6;
  const jitterY = (((hash >>> 3) % 5) - 2) * 0.5;
  const turn = (((hash >>> 6) % 19) - 9) * 0.8;

  return {
    x: cfg.startX + col * cfg.stepX + jitterX,
    y: cfg.y + jitterY,
    turn,
    color,
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

function Blob({
  index,
  drop,
  delay,
  wobble,
}: {
  index: number;
  drop: boolean;
  delay: number;
  wobble: boolean;
}) {
  const { x, y, turn, color } = slot(index);
  const gradId = `jelly-grad-${color.name}`;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${turn.toFixed(1)})`}>
      <g
        className={drop ? "jelly drop" : wobble ? "jelly wobble" : "jelly"}
        style={
          drop
            ? { animationDelay: `${delay}ms` }
            : wobble
            ? { animationDelay: `${(index % 7) * 40}ms` }
            : undefined
        }
      >
        {/* Soft bottom shadow under the jelly */}
        <ellipse cx="0" cy="8.5" rx="8" ry="1.8" fill={color.deep} opacity="0.25" />

        {/* Jelly plump body with delicate fine graphite outline matching reference */}
        <path
          d="M -12, 1 C -12, -7, -7, -10.5, 0, -10.5 C 7, -10.5, 12, -7, 12, 1 C 12, 6.5, 8, 9.5, 0, 9.5 C -8, 9.5, -12, 6.5, -12, 1 Z"
          fill={`url(#${gradId})`}
          stroke="#5e5f5f"
          strokeWidth="0.85"
          strokeLinejoin="round"
        />

        {/* Translucent glossy highlight crescent on top-left crest */}
        <path
          d="M -8, -2.5 C -8, -6.5 -4.5, -8.5 -0.5, -8.5 C 0.5, -8.5 0.8, -7.5 -0.2, -7.5 C -3.5, -7.5 -6.2, -5.2 -6.5, -2 C -6.7, -1.2 -8, -1.5 -8, -2.5 Z"
          fill="#ffffff"
          opacity="0.75"
        />
        {/* Secondary micro gloss dot */}
        <circle cx="2.2" cy="-6" r="0.65" fill="#ffffff" opacity="0.75" />

        {/* Two dark graphite eyes (delicate size matching reference) */}
        <circle cx="-4.2" cy="-1" r="0.85" fill="#5e5f5f" />
        <circle cx="4.2" cy="-1.4" r="0.85" fill="#5e5f5f" />

        {/* Downward-pointing triangular beak with fine outline & tinted body tone */}
        <path
          d="M -2.2, 1.1 L 2.2, 0.7 L 0, 3.8 Z"
          fill={color.beak}
          stroke="#5e5f5f"
          strokeWidth="0.65"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
  const [jarWobble, setJarWobble] = useState(false);
  const wobbleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (total > previous.current) setDropFrom(previous.current);
    previous.current = total;
    writeSeen(total);
  }, [total]);

  const handleJarClick = () => {
    if (jarWobble) return;
    setJarWobble(true);
    if (wobbleTimer.current) window.clearTimeout(wobbleTimer.current);
    wobbleTimer.current = window.setTimeout(() => setJarWobble(false), 700);
  };

  return (
    <section className="kalami-page">
      <div className="kalami-total">
        <KalamiIcon size={28} />
        <strong>{total}</strong>
        <span>颗卡拉米</span>
      </div>
      <svg
        className={`kalami-jar ${jarWobble ? "wobbling" : ""}`}
        viewBox="0 0 260 330"
        role="img"
        aria-label={`卡拉米罐：共${total}颗卡拉米${fullJars ? `，已装满${fullJars}罐` : ""}`}
        onClick={handleJarClick}
      >
        <defs>
          {COLORS.map((color) => (
            <radialGradient
              key={color.name}
              id={`jelly-grad-${color.name}`}
              cx="32%"
              cy="28%"
              r="75%"
            >
              <stop offset="0%" stopColor={color.light} />
              <stop offset="65%" stopColor={color.base} />
              <stop offset="100%" stopColor={color.deep} />
            </radialGradient>
          ))}
          <linearGradient id="glass-back-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3f9fa" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#eaf4f7" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d9ecf2" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="glass-shine-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="15%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="cork-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c9955d" />
            <stop offset="25%" stopColor="#e1b886" />
            <stop offset="70%" stopColor="#d4a770" />
            <stop offset="100%" stopColor="#b68249" />
          </linearGradient>
          <clipPath id="jar-inside">
            <path d={JAR_INSIDE} />
          </clipPath>
        </defs>

        {/* 1. Cork stopper & lid */}
        <g className="jar-cork-group">
          <path
            d="M 87,32 L 91,54 H 169 L 173,32 Z"
            fill="url(#cork-grad)"
            stroke="#9c6d3b"
            strokeWidth="1.2"
          />
          <rect
            x="76"
            y="12"
            width="108"
            height="22"
            rx="9"
            fill="url(#cork-grad)"
            stroke="#9c6d3b"
            strokeWidth="1.2"
          />
          <line
            x1="86"
            y1="16"
            x2="174"
            y2="16"
            stroke="#ffffff"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* 2. Glass back wall (unified seamless shape) */}
        <path d={JAR_OUTLINE} fill="url(#glass-back-grad)" />

        {/* 3. Karami jellies inside jar */}
        <g clipPath="url(#jar-inside)">
          {Array.from({ length: inJar }, (_, i) => {
            const drop = jarStart + i >= dropFrom;
            return (
              <Blob
                key={i}
                index={i}
                drop={drop}
                delay={Math.min(jarStart + i - dropFrom, 20) * 65}
                wobble={jarWobble}
              />
            );
          })}
        </g>

        {/* 4. Thick solid glass bottom */}
        <path
          d="M 32,282 C 32,298 48,304 68,304 H 192 C 212,304 228,298 228,282 C 200,289 60,289 32,282 Z"
          fill="#cce7ee"
          fillOpacity="0.45"
        />
        <path
          d="M 52,298 H 208"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.65"
        />

        {/* 5. Front glass reflections & specular shine (layered over jellies) */}
        <path
          d="M 50,86 C 40,110 38,150 40,265"
          stroke="url(#glass-shine-grad)"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 88,52 V 62 C 65,65 44,78 40,94"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
          fill="none"
        />
        <path
          d="M 172,52 V 62 C 195,65 216,78 220,94"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.4"
          fill="none"
        />
        <path
          d="M 84,38 H 176"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />
        <path
          d="M 222,106 V 256"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.35"
          fill="none"
        />

        {/* 6. Front glass perimeter rim (single continuous contour) */}
        <path
          d={JAR_OUTLINE}
          fill="none"
          stroke="#a3c7cf"
          strokeWidth="2.5"
        />
      </svg>

      {fullJars > 0 && (
        <p className="kalami-jars">
          {Array.from({ length: Math.min(fullJars, 10) }, (_, i) => (
            <span key={i} className="mini-jar" aria-hidden="true" />
          ))}
          已装满 {fullJars} 罐
        </p>
      )}

      {total === 0 ? (
        <p className="kalami-empty">完成任务后，圆滚滚的果冻卡拉米会掉进罐子里哦。</p>
      ) : (
        <p className="kalami-hint">点击玻璃罐可以戳戳它们～</p>
      )}

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
