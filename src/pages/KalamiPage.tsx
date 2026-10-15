import { useEffect, useRef, useState } from "react";
import { balance } from "../domain.ts";
import type { AppData } from "../domain.ts";
import { KalamiIcon, shortDate } from "../components.tsx";

const JAR_SIZE = 100;
const SEEN_KEY = "you-did:jar-seen";

// Precise low-saturation colors sampled from reference illustration
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

// Seamless unified glass jar outline
const JAR_OUTLINE =
  "M 82,36 H 178 A 6,6 0 0 1 184,42 V 46 A 4,4 0 0 1 180,50 H 172 V 62 C 200,64 230,76 230,98 V 276 C 230,296 214,306 194,306 H 66 C 46,306 30,296 30,276 V 98 C 30,76 60,64 88,62 V 50 H 80 A 4,4 0 0 1 76,46 V 42 A 6,6 0 0 1 82,36 Z";

const JAR_INSIDE =
  "M 88,52 V 64 C 60,66 32,78 32,98 V 276 C 32,295 48,304 68,304 H 192 C 212,304 228,295 228,276 V 98 C 228,78 200,66 172,64 V 52 Z";

const D = 22.0;
const R = D / 2;
const FLOOR = 270.0;
const H = Math.sqrt(D * D - R * R); // 19.05256

// Pure hexagonal staggered pocket rows: non-overlapping and mechanically stable in gravity
const ROW_DEFS: { count: number; x0: number; y: number }[] = [
  { count: 7, x0: 64,  y: 270.0 },
  { count: 8, x0: 53,  y: 270.0 - 1 * H },
  { count: 7, x0: 64,  y: 270.0 - 2 * H },
  { count: 8, x0: 53,  y: 270.0 - 3 * H },
  { count: 7, x0: 64,  y: 270.0 - 4 * H },
  { count: 8, x0: 53,  y: 270.0 - 5 * H },
  { count: 7, x0: 64,  y: 270.0 - 6 * H },
  { count: 8, x0: 53,  y: 270.0 - 7 * H },
  { count: 7, x0: 64,  y: 270.0 - 8 * H },
  { count: 8, x0: 53,  y: 270.0 - 9 * H },
  { count: 7, x0: 64,  y: 270.0 - 10 * H },
  { count: 6, x0: 75,  y: 270.0 - 11 * H },
  { count: 5, x0: 86,  y: 270.0 - 12 * H },
  { count: 4, x0: 97,  y: 270.0 - 13 * H },
  { count: 3, x0: 108, y: 270.0 - 14 * H },
  { count: 2, x0: 119, y: 270.0 - 15 * H },
  { count: 1, x0: 130, y: 270.0 - 16 * H },
];

function restingSlot(index: number) {
  let remaining = index % JAR_SIZE;
  let rDef = ROW_DEFS[0];
  let col = 0;
  for (let r = 0; r < ROW_DEFS.length; r++) {
    const row = ROW_DEFS[r];
    if (remaining < row.count) {
      rDef = row;
      col = remaining;
      break;
    }
    remaining -= row.count;
  }
  const hash = (index * 2654435761) >>> 0;
  const turn = (((hash >>> 6) % 25) - 12) * 1.5;

  return {
    x: rDef.x0 + col * D,
    y: rDef.y,
    turn,
    color: getBalancedColor(index),
  };
}

interface BallPhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  omega: number;
  deform: number;      // Squash (<0) / Stretch (>0) deformation amplitude
  vDeform: number;     // Elastic spring deformation velocity
  deformAngle: number; // Deformation axis in world degrees (e.g. 90 = vertical squash)
  maxImpact: number;   // Single strongest collision in current frame
  impactAngle: number; // Direction of strongest collision in current frame
  color: (typeof COLORS)[number];
  active: boolean;
  spawnTime: number;
}

function constrainJarPhysics(p: BallPhysics) {
  const e = 0.28; // Soft jelly restitution

  // 1. Top Ceiling / Cork Stopper constraint
  // Jar mouth begins at y=42, cork plug at y=32..54. Jellies bouncing in jar cannot pop out above CEILING
  const CEILING = 56.0;
  if (p.y <= CEILING && p.vy < 0) {
    p.y = CEILING;
    p.vy = -p.vy * e;
    p.omega *= 0.85;
    if (Math.abs(p.vy) > 0.3 && Math.abs(p.deform) < 0.18) {
      p.vDeform -= 0.15;
      p.deformAngle = 90;
    }
  }

  // 2. Floor
  if (p.y >= FLOOR) {
    p.y = FLOOR;
    if (p.vy > 0) {
      const impactSpeed = p.vy;
      if (p.vy < 0.35) {
        p.vy = 0;
        p.vx *= 0.94; // Smooth rolling contact friction
      } else {
        p.vy = -p.vy * e;
        p.vx *= 0.78; // Impact damping
      }
      p.omega *= 0.88;
      if (Math.abs(p.vx) > 0.08) {
        p.omega += (p.vx / R) * 1.5;
      }
      if (impactSpeed > 0.45 && Math.abs(p.deform) < 0.18) {
        const impact = Math.min(1.0, (impactSpeed - 0.35) / 3.8);
        p.vDeform -= impact * 0.32;
        p.deformAngle = 90;
      }
    }
  }

  // 3. Bottom Corners and Vertical Walls
  if (p.y >= 98) {
    if (p.y > 252 && p.x < 61) {
      const dx = p.x - 61;
      const dy = p.y - 252;
      const d = Math.hypot(dx, dy);
      if (d > 18 && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        p.x = 61 + nx * 18;
        p.y = 252 + ny * 18;
        const vn = p.vx * nx + p.vy * ny;
        if (vn > 0) {
          p.vx -= (1 + e) * vn * nx;
          p.vy -= (1 + e) * vn * ny;
          p.omega *= 0.85;
          if (vn > 0.45 && Math.abs(p.deform) < 0.18) {
            p.vDeform -= Math.min(1.0, (vn - 0.35) / 3.8) * 0.28;
            p.deformAngle = Math.atan2(ny, nx) * (180 / Math.PI);
          }
        }
      }
    } else if (p.y > 252 && p.x > 199) {
      const dx = p.x - 199;
      const dy = p.y - 252;
      const d = Math.hypot(dx, dy);
      if (d > 18 && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        p.x = 199 + nx * 18;
        p.y = 252 + ny * 18;
        const vn = p.vx * nx + p.vy * ny;
        if (vn > 0) {
          p.vx -= (1 + e) * vn * nx;
          p.vy -= (1 + e) * vn * ny;
          p.omega *= 0.85;
          if (vn > 0.45 && Math.abs(p.deform) < 0.18) {
            p.vDeform -= Math.min(1.0, (vn - 0.35) / 3.8) * 0.28;
            p.deformAngle = Math.atan2(ny, nx) * (180 / Math.PI);
          }
        }
      }
    } else {
      if (p.x < 43) {
        p.x = 43;
        if (p.vx < 0) {
          const impactSpeed = -p.vx;
          p.vx = -p.vx * e;
          p.omega *= 0.85;
          if (Math.abs(p.vy) > 0.1) {
            p.omega -= (p.vy / R) * 1.5;
          }
          if (impactSpeed > 0.45 && Math.abs(p.deform) < 0.18) {
            p.vDeform -= Math.min(1.0, (impactSpeed - 0.35) / 3.8) * 0.28;
            p.deformAngle = 0;
          }
        }
      }
      if (p.x > 217) {
        p.x = 217;
        if (p.vx > 0) {
          const impactSpeed = p.vx;
          p.vx = -p.vx * e;
          p.omega *= 0.85;
          if (Math.abs(p.vy) > 0.1) {
            p.omega -= (p.vy / R) * 1.5;
          }
          if (impactSpeed > 0.45 && Math.abs(p.deform) < 0.18) {
            p.vDeform -= Math.min(1.0, (impactSpeed - 0.35) / 3.8) * 0.28;
            p.deformAngle = 0;
          }
        }
      }
    }
  } else if (p.y >= 64) {
    // 4. Shoulders slope (seamless between x=99 at y=64 and x=43 at y=98)
    // Left shoulder connects (43, 98) to (99, 64); inward normal points (0.519, 0.855)
    // Right shoulder connects (161, 64) to (217, 98); inward normal points (-0.519, 0.855)
    const snx = 0.519;
    const sny = 0.855;
    const leftDist = snx * (p.x - 99.0) + sny * (p.y - 64.0);
    if (leftDist < 0) {
      p.x -= leftDist * snx;
      p.y -= leftDist * sny;
      const vn = p.vx * snx + p.vy * sny;
      if (vn < 0) {
        const impactSpeed = -vn;
        p.vx -= (1 + e) * vn * snx;
        p.vy -= (1 + e) * vn * sny;
        p.omega *= 0.85;
        if (impactSpeed > 0.45 && Math.abs(p.deform) < 0.18) {
          p.vDeform -= Math.min(1.0, (impactSpeed - 0.35) / 3.8) * 0.26;
          p.deformAngle = 32;
        }
      }
    }
    const rightDist = -snx * (p.x - 161.0) + sny * (p.y - 64.0);
    if (rightDist < 0) {
      p.x -= rightDist * (-snx);
      p.y -= rightDist * sny;
      const vn = p.vx * (-snx) + p.vy * sny;
      if (vn < 0) {
        const impactSpeed = -vn;
        p.vx -= (1 + e) * vn * (-snx);
        p.vy -= (1 + e) * vn * sny;
        p.omega *= 0.85;
        if (impactSpeed > 0.45 && Math.abs(p.deform) < 0.18) {
          p.vDeform -= Math.min(1.0, (impactSpeed - 0.35) / 3.8) * 0.26;
          p.deformAngle = -32;
        }
      }
    }
  } else {
    // 5. Neck slot
    if (p.x < 99.0) {
      p.x = 99.0;
      if (p.vx < 0) {
        p.vx = -p.vx * e;
        p.omega *= 0.85;
      }
    }
    if (p.x > 161.0) {
      p.x = 161.0;
      if (p.vx > 0) {
        p.vx = -p.vx * e;
        p.omega *= 0.85;
      }
    }
  }
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
    // Convenience only
  }
}

// Module-level session memory: once granted during current browser session,
// keep it active across all tab navigations without re-prompting!
let sessionGyroGranted = false;

export function KalamiPage({ data }: { data: AppData }) {
  const total = balance(data);
  const fullJars = total > 0 ? Math.floor((total - 1) / JAR_SIZE) : 0;
  const inJar = total - fullJars * JAR_SIZE;
  const jarStart = fullJars * JAR_SIZE;

  // Determine newly earned kalami since last viewed
  const [dropFrom, setDropFrom] = useState(() => {
    const seen = readSeen();
    return seen === null || seen >= total ? total : seen;
  });
  const [replaySeed, setReplaySeed] = useState(0);

  const hasNew = jarStart + inJar > dropFrom && dropFrom < total;
  const newStartIndex = Math.max(0, dropFrom - jarStart);

  const [corkState, setCorkState] = useState<"closed" | "popped" | "closing">("closed");
  const [jarThump, setJarThump] = useState(false);
  const [jarWobble, setJarWobble] = useState(false);

  const ballsRef = useRef<BallPhysics[]>([]);
  const blobGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const rafId = useRef<number | null>(null);
  const isSimulatingRef = useRef(false);
  const corkHandledRef = useRef(false);
  const ceremonyDeadlineRef = useRef(0);
  const hasNewRef = useRef(hasNew);
  const newStartIndexRef = useRef(newStartIndex);
  const totalRef = useRef(total);
  hasNewRef.current = hasNew;
  newStartIndexRef.current = newStartIndex;
  totalRef.current = total;

  const closeCorkCeremony = () => {
    if (corkHandledRef.current) return;
    corkHandledRef.current = true;
    setCorkState("closing");
    setTimeout(() => {
      setCorkState("closed");
      setJarThump(true);
      setTimeout(() => setJarThump(false), 350);
      writeSeen(totalRef.current);
      setDropFrom(totalRef.current);
    }, 650);
  };

  // Gravity vectors (dynamic from phone gyro tilt, reduced for floaty relaxed fall)
  const tiltGx = useRef(0);
  const tiltGy = useRef(0.113);
  const lastWakeTime = useRef(0);

  const wakeUp = () => {
    lastWakeTime.current = Date.now();
    if (isSimulatingRef.current) return;
    isSimulatingRef.current = true;

    let calmFrames = 0;

    const tick = () => {
      const now = Date.now();
      const balls = ballsRef.current;
      let totalMotion = 0;

      // 1. Spawning check (sequential relaxed drop)
      balls.forEach((b, i) => {
        if (!b.active && now >= b.spawnTime) {
          b.active = true;
          const el = blobGroupRefs.current[i];
          if (el) el.style.opacity = "1";
        }
      });

      // 2. Integration
      const gx = tiltGx.current;
      const gy = tiltGy.current;

      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (!b.active) continue;

        b.vx += gx;
        b.vy += gy;
        // Cap max downward and upward falling velocity so motion stays silky, stable and cannot tunnel
        if (b.vy > 1.94) b.vy = 1.94;
        if (b.vy < -4.2) b.vy = -4.2;
        if (b.vx > 3.2) b.vx = 3.2;
        if (b.vx < -3.2) b.vx = -3.2;
        b.vx *= 0.982;
        b.vy *= 0.982;
        b.omega *= 0.94;

        const speed = Math.hypot(b.vx, b.vy);

        // Flight elongation: when falling fast, gently pull stretch along trajectory
        let targetDeform = 0;
        if (speed > 1.4 && Math.abs(b.deform) < 0.12) {
          const flightAngle = Math.atan2(b.vy, b.vx) * (180 / Math.PI);
          targetDeform = Math.min(0.12, (speed - 1.4) * 0.025);
          b.deformAngle = flightAngle;
        }

        // Jelly harmonic damped spring: pulls deform toward targetDeform with juicy elasticity
        const k = 0.24; // spring tension
        const damping = 0.78; // jelly damping
        b.vDeform += -k * (b.deform - targetDeform);
        b.vDeform *= damping;
        b.deform += b.vDeform;

        // Bounded deformation for cartoon appeal
        b.deform = Math.max(-0.25, Math.min(0.20, b.deform));
        if (speed < 0.2 && Math.abs(b.deform) < 0.015 && Math.abs(b.vDeform) * 10 < 0.1) {
          b.deform = 0;
          b.vDeform = 0;
        }

        // Low speed damping for position & rotation
        if (speed < 0.25) {
          b.omega *= 0.82;
          if (Math.abs(b.omega) < 0.05) b.omega = 0;
        }
        // Only bring to complete rest when tilt force is negligible and velocity is near zero
        if (speed < 0.02 && Math.abs(gx) < 0.015) {
          b.vx = 0;
          b.vy = 0;
        }

        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.omega;

        constrainJarPhysics(b);
        totalMotion += speed + Math.abs(b.vDeform) * 2;
      }

      // 3. Circle-to-Circle Collision (3 relaxation iterations with Coulomb friction and jelly squish)
      balls.forEach((b) => {
        b.maxImpact = 0;
        b.impactAngle = 0;
      });

      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < balls.length; i++) {
          const b1 = balls[i];
          if (!b1.active) continue;

          for (let j = i + 1; j < balls.length; j++) {
            const b2 = balls[j];
            if (!b2.active) continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const d2 = dx * dx + dy * dy;

            if (d2 < D * D && d2 > 0.0001) {
              const d = Math.sqrt(d2);
              const nx = dx / d;
              const ny = dy / d;
              const overlap = D - d;

              // Soft relaxation factor (0.4) and displacement limit prevents jitter and popcorn explosion
              const push = Math.min(overlap * 0.4, 2.0);
              b1.x -= nx * push * 0.5;
              b1.y -= ny * push * 0.5;
              b2.x += nx * push * 0.5;
              b2.y += ny * push * 0.5;

              const vrelN = (b2.vx - b1.vx) * nx + (b2.vy - b1.vy) * ny;
              if (vrelN < 0) {
                const impactSpeed = -vrelN;
                const restitution = impactSpeed < 0.35 ? 0 : 0.24;
                const impulseN = -(1 + restitution) * vrelN * 0.5;
                const clampedImpulse = Math.min(impulseN, 2.0);
                b1.vx -= nx * clampedImpulse;
                b1.vy -= ny * clampedImpulse;
                b2.vx += nx * clampedImpulse;
                b2.vy += ny * clampedImpulse;

                // Track strongest impact for jelly deformation (evaluated once per frame to prevent twitching)
                if (impactSpeed > 0.38) {
                  const impact = Math.min(0.65, (impactSpeed - 0.3) / 3.6);
                  const colAngle = Math.atan2(ny, nx) * (180 / Math.PI);
                  if (impact > b1.maxImpact) {
                    b1.maxImpact = impact;
                    b1.impactAngle = colAngle;
                  }
                  if (impact > b2.maxImpact) {
                    b2.maxImpact = impact;
                    b2.impactAngle = colAngle;
                  }
                }

                // Tangential rolling friction with Coulomb clamp
                const tx = -ny;
                const ty = nx;
                const vrelT = (b2.vx - b1.vx) * tx + (b2.vy - b1.vy) * ty;
                if (Math.abs(vrelT) > 0.04) {
                  const maxFriction = clampedImpulse * 0.25;
                  const impulseT = Math.max(-maxFriction, Math.min(maxFriction, -vrelT * 0.15));
                  b1.vx -= tx * impulseT * 0.5;
                  b1.vy -= ty * impulseT * 0.5;
                  b2.vx += tx * impulseT * 0.5;
                  b2.vy += ty * impulseT * 0.5;

                  const dOmega = (impulseT / R) * (180 / Math.PI) * 0.25;
                  b1.omega -= dOmega;
                  b2.omega += dOmega;
                } else {
                  b1.omega *= 0.94;
                  b2.omega *= 0.94;
                }
              }
            }
          }
        }
      }

      // Constrain all balls against jar walls, floor and ceiling after collision resolution
      balls.forEach((b) => {
        if (b.active) constrainJarPhysics(b);
      });

      // Apply single strongest jelly squash deformation once per frame
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        if (!b.active) continue;
        if (b.maxImpact > 0.12 && Math.abs(b.deform) < 0.16) {
          b.vDeform -= b.maxImpact * 0.24;
          b.deformAngle = b.impactAngle;
        }
      }

      // 4. Update SVG DOM directly with organic jelly squash & stretch
      balls.forEach((b, i) => {
        if (!b.active) return;
        const el = blobGroupRefs.current[i];
        if (el) {
          if (Math.abs(b.deform) > 0.008) {
            const sx = (1 + b.deform).toFixed(3);
            const sy = (1 - b.deform * 0.82).toFixed(3);
            const da = b.deformAngle.toFixed(1);
            const innerRot = (b.rot - b.deformAngle).toFixed(1);
            el.setAttribute(
              "transform",
              `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${da}) scale(${sx} ${sy}) rotate(${innerRot})`
            );
          } else {
            el.setAttribute(
              "transform",
              `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(1)})`
            );
          }
        }
      });

      // 5. Ceremony & Cork Closure check
      const currentHasNew = hasNewRef.current;
      const currentStartIndex = newStartIndexRef.current;
      const allActive = balls.every((b) => b.active);
      const newBalls = currentHasNew ? balls.slice(currentStartIndex) : [];

      // Newly dropped balls must have descended past the neck entrance (y > 58) into the jar
      const newBallsInJar =
        newBalls.length > 0 &&
        newBalls.every((b) => b.active && b.y > 58);
      // New balls have largely settled (low impact speed)
      const newBallsCalm =
        newBallsInJar &&
        newBalls.every((b) => Math.hypot(b.vx, b.vy) < 0.65);

      if (newBallsCalm) {
        calmFrames++;
      } else {
        calmFrames = Math.max(0, calmFrames - 1);
      }

      // Reliable cork closure when all new balls are in and settled, or on deadline
      if (currentHasNew && !corkHandledRef.current && allActive) {
        const canClose =
          (calmFrames >= 8 && newBallsInJar) ||
          now >= ceremonyDeadlineRef.current;
        if (canClose) {
          closeCorkCeremony();
        }
      }

      // Settle physics loop to sleep if calm for 25 frames
      if (calmFrames > 25 && now - lastWakeTime.current > 700) {
        isSimulatingRef.current = false;
        return; // Physics loop sleeps
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  };

  // Initialize or re-initialize balls
  useEffect(() => {
    // If balls are already simulated in the jar and there are no new drops, preserve their exact positions!
    if (ballsRef.current.length === inJar && !hasNew) {
      corkHandledRef.current = true;
      writeSeen(total);
      // Ensure any remaining motion finishes smoothly and doesn't freeze in mid-air
      const isStillMoving = ballsRef.current.some(
        (b) => Math.hypot(b.vx, b.vy) > 0.05 || Math.abs(b.vDeform) > 0.02
      );
      if (isStillMoving) {
        wakeUp();
      }
      return;
    }

    const balls: BallPhysics[] = [];
    const now = Date.now();

    for (let i = 0; i < inJar; i++) {
      const initial = restingSlot(i);
      const isNew = hasNew && i >= newStartIndex;

      if (!isNew) {
        // Reuse existing physical coordinates if already simulated; otherwise use restingSlot
        const existing = ballsRef.current[i];
        if (existing) {
          balls.push({
            ...existing,
            vx: 0,
            vy: 0,
            omega: 0,
            deform: 0,
            vDeform: 0,
            maxImpact: 0,
            impactAngle: 0,
            active: true,
          });
        } else {
          balls.push({
            x: initial.x,
            y: initial.y,
            vx: 0,
            vy: 0,
            rot: initial.turn,
            omega: 0,
            deform: 0,
            vDeform: 0,
            deformAngle: 0,
            maxImpact: 0,
            impactAngle: 0,
            color: initial.color,
            active: true,
            spawnTime: 0,
          });
        }
      } else {
        // Option C ceremony: slow sequential entry
        const delayMs = 1200 + (i - newStartIndex) * 600;
        const hash = (i * 2654435761) >>> 0;
        balls.push({
          x: 130 + (((hash >>> 3) % 9) - 4) * 1.5,
          y: 30,
          vx: (((hash >>> 7) % 7) - 3) * 0.25,
          vy: 0.36,
          rot: (((hash >>> 11) % 25) - 12) * 2,
          omega: (((hash >>> 15) % 11) - 5) * 1.2,
          deform: 0.10,
          vDeform: 0,
          deformAngle: 90,
          maxImpact: 0,
          impactAngle: 0,
          color: getBalancedColor(i),
          active: false,
          spawnTime: now + delayMs,
        });
      }
    }

    ballsRef.current = balls;

    // Apply immediate transform to DOM refs
    balls.forEach((b, i) => {
      const el = blobGroupRefs.current[i];
      if (el) {
        el.setAttribute(
          "transform",
          `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(1)})`
        );
        el.style.opacity = b.active ? "1" : "0";
      }
    });

    if (hasNew) {
      corkHandledRef.current = false;
      const newCount = Math.max(1, inJar - newStartIndex);
      // Deadline: 1200ms initial pop + stagger entry delay + 2200ms settling
      ceremonyDeadlineRef.current = now + 1200 + newCount * 600 + 2200;

      // Reset any previous physics frame so new drop starts clean
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      isSimulatingRef.current = false;

      // Ensure cork begins closed and smoothly pops open after mounting paint
      setCorkState("closed");
      const openTimer = window.setTimeout(() => {
        setCorkState("popped");
      }, 120);

      // Independent safety fallback: cork is guaranteed to close even under continuous gyro shaking
      const safetyCloseTimer = window.setTimeout(() => {
        closeCorkCeremony();
      }, 1200 + newCount * 600 + 3200);

      wakeUp();

      return () => {
        clearTimeout(openTimer);
        clearTimeout(safetyCloseTimer);
        if (rafId.current) cancelAnimationFrame(rafId.current);
        isSimulatingRef.current = false;
        if (hasNewRef.current) {
          writeSeen(totalRef.current);
        }
      };
    } else {
      corkHandledRef.current = true;
      isSimulatingRef.current = false;
      writeSeen(total);
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      isSimulatingRef.current = false;
      if (hasNewRef.current) {
        writeSeen(totalRef.current);
      }
    };
  }, [inJar, total, dropFrom, jarStart, hasNew, newStartIndex, replaySeed]);

  // iOS DeviceOrientation permission handling
  const isIOS =
    typeof window !== "undefined" &&
    typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })?.requestPermission === "function";

  const [gyroPermState, setGyroPermState] = useState<"idle" | "granted" | "denied">(() => {
    if (typeof window === "undefined") return "idle";
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DOE?.requestPermission !== "function") return "granted";
    return sessionGyroGranted ? "granted" : "idle";
  });

  const requestGyroPermission = async () => {
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DOE?.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        if (res === "granted") {
          sessionGyroGranted = true;
          setGyroPermState("granted");
          wakeUp();
        } else {
          sessionGyroGranted = false;
          setGyroPermState("denied");
        }
      } catch (err) {
        console.warn("Device orientation permission error", err);
        setGyroPermState("denied");
      }
    } else {
      sessionGyroGranted = true;
      setGyroPermState("granted");
      wakeUp();
    }
  };

  const toggleGyroOff = () => {
    sessionGyroGranted = false;
    setGyroPermState("idle");
    tiltGx.current = 0;
    tiltGy.current = 0.130;
    wakeUp();
  };

  // Mobile Device Orientation (Gyro tilt response) & Motion Shake
  useEffect(() => {
    if (gyroPermState === "denied") return;

    let lastGamma = 0;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        // Left-right tilt angle (-50 to +50 deg)
        const gamma = Math.max(-50, Math.min(50, e.gamma));
        const delta = Math.abs(gamma - lastGamma);
        const isTilted = Math.abs(gamma) > 2.5;

        if (delta > 0.8 || (isTilted && Date.now() - lastWakeTime.current > 300)) {
          // If starting to tilt from resting posture, give a tiny agitation to break hexagonal interlocking
          if (Math.abs(lastGamma) < 2.0 && isTilted) {
            ballsRef.current.forEach((b) => {
              if (b.active && Math.hypot(b.vx, b.vy) < 0.08) {
                b.vy -= Math.random() * 0.22 + 0.08;
                b.vx += (gamma > 0 ? 0.12 : -0.12) * Math.random();
              }
            });
          }

          lastGamma = gamma;
          const rad = (gamma * Math.PI) / 180;
          // Responsive horizontal gravity vector with adaptive base vertical gravity
          tiltGx.current = Math.sin(rad) * 0.32;
          tiltGy.current = Math.max(0.08, Math.cos(rad) * 0.130);
          wakeUp();
        }
      }
    };

    let lastShake = 0;
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const delta = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
        if (delta > 22 && Date.now() - lastShake > 600) {
          lastShake = Date.now();
          ballsRef.current.forEach((b) => {
            const heightFactor = Math.max(0.45, Math.min(1.0, (b.y - 50) / 220));
            b.vy -= (Math.random() * 1.5 + 2.0) * heightFactor;
            b.vx += (Math.random() - 0.5) * 2.5;
            b.omega += (Math.random() - 0.5) * 12;
            b.vDeform += (Math.random() - 0.5) * 0.25;
            b.deformAngle = (Math.random() - 0.5) * 180;
          });
          wakeUp();
        }
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [gyroPermState]);

  // Tap / Click Interaction: Jumble & bounce the jellies
  const handleJarTap = () => {
    if (jarWobble || hasNew || corkState !== "closed") return;
    setJarWobble(true);
    setTimeout(() => setJarWobble(false), 650);

    // Natural shockwave bounce: bottom balls receive direct impulse, transmitting smoothly up
    ballsRef.current.forEach((b) => {
      if (!b.active) return;
      const heightFactor = Math.max(0.45, Math.min(1.0, (b.y - 50) / 220));
      b.vy -= (Math.random() * 1.5 + 2.2) * heightFactor;
      b.vx += (Math.random() - 0.5) * 2.2;
      b.omega += (Math.random() - 0.5) * 12;
      b.vDeform += (Math.random() - 0.5) * 0.25;
      b.deformAngle = (Math.random() - 0.5) * 180;
    });

    // Cork gives a playful pop & snaps back
    if (corkState === "closed") {
      setCorkState("popped");
      setTimeout(() => {
        setCorkState("closing");
        setTimeout(() => setCorkState("closed"), 500);
      }, 500);
    }

    wakeUp();
  };

  const handleReplay = () => {
    if (hasNew || corkState !== "closed") return;
    const lastReward = data.rewards[data.rewards.length - 1];
    const lastBatchCount = lastReward
      ? Math.max(1, Math.min(inJar, lastReward.amount))
      : Math.min(inJar, 1);
    const replayFrom = Math.max(jarStart, total - lastBatchCount);

    // Keep existing balls up to replayFrom - jarStart, recreate only the last batch
    const keepCount = Math.max(0, replayFrom - jarStart);
    ballsRef.current = ballsRef.current.slice(0, keepCount);

    // Reset simulation & cork flag so replay drop starts fresh
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    isSimulatingRef.current = false;
    corkHandledRef.current = false;

    setDropFrom(replayFrom);
    setReplaySeed((s) => s + 1);
  };

  return (
    <section className="kalami-page">
      <div className="kalami-total">
        <KalamiIcon size={28} />
        <strong>{total}</strong>
        <span>颗卡拉米</span>
      </div>

      <svg
        className={`kalami-jar ${jarWobble ? "wobbling" : ""} ${jarThump ? "thump" : ""}`}
        viewBox="0 0 260 330"
        role="img"
        aria-label={`卡拉米罐：共${total}颗卡拉米${fullJars ? `，已装满${fullJars}罐` : ""}`}
        onClick={handleJarTap}
        style={{ cursor: hasNew || corkState !== "closed" ? "default" : "pointer" }}
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

        {/* 1. Cork Stopper & Lid with Option C Ceremony */}
        <g className={`jar-cork-group ${corkState}`}>
          {/* Cork plug entering mouth */}
          <path
            d="M 87,32 L 91,54 H 169 L 173,32 Z"
            fill="url(#cork-grad)"
            stroke="#9c6d3b"
            strokeWidth="1.2"
          />
          {/* Cork wooden lid cap */}
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

        {/* Option C: Floating golden sparkles at jar mouth when cork is open */}
        {corkState === "popped" && (
          <g className="jar-sparkles" aria-hidden="true">
            <path
              d="M 105,32 Q 108,35 111,32 Q 108,29 105,32 Z"
              fill="#ffdd77"
              className="mouth-sparkle"
              style={{ animationDelay: "0ms" }}
            />
            <path
              d="M 148,28 Q 152,32 156,28 Q 152,24 148,28 Z"
              fill="#ffe899"
              className="mouth-sparkle"
              style={{ animationDelay: "220ms" }}
            />
            <path
              d="M 125,22 Q 128,26 131,22 Q 128,18 125,22 Z"
              fill="#ffea88"
              className="mouth-sparkle"
              style={{ animationDelay: "450ms" }}
            />
          </g>
        )}

        {/* 2. Glass back wall (unified seamless shape) */}
        <path d={JAR_OUTLINE} fill="url(#glass-back-grad)" />

        {/* 3. Karami Jellies (Option B Dynamic 2D Physics Rigidbody Stack) */}
        <g clipPath="url(#jar-inside)">
          {Array.from({ length: inJar }, (_, i) => {
            const initial = restingSlot(i);
            const gradId = `jelly-grad-${initial.color.name}`;
            return (
              <g
                key={i}
                ref={(el) => {
                  blobGroupRefs.current[i] = el;
                }}
                transform={`translate(${initial.x.toFixed(1)} ${initial.y.toFixed(1)}) rotate(${initial.turn.toFixed(1)})`}
                style={{
                  opacity: hasNew && i >= newStartIndex ? 0 : 1,
                  willChange: "transform",
                }}
              >
                {/* Soft bottom shadow under jelly */}
                <ellipse cx="0" cy="8.5" rx="8" ry="1.8" fill={initial.color.deep} opacity="0.25" />

                {/* Jelly plump body with delicate fine graphite outline */}
                <path
                  d="M -11, 1 C -11, -6.5, -6.5, -10, 0, -10 C 6.5, -10, 11, -6.5, 11, 1 C 11, 6, 7.5, 9, 0, 9 C -7.5, 9, -11, 6, -11, 1 Z"
                  fill={`url(#${gradId})`}
                  stroke="#5e5f5f"
                  strokeWidth="0.85"
                  strokeLinejoin="round"
                />

                {/* Translucent glossy highlight crescent on top-left crest */}
                <path
                  d="M -7.5, -2.5 C -7.5, -6 -4, -8 -0.5, -8 C 0.5, -8 0.8, -7 -0.2, -7 C -3.2, -7 -5.8, -4.8 -6, -2 C -6.2, -1.2 -7.5, -1.5 -7.5, -2.5 Z"
                  fill="#ffffff"
                  opacity="0.75"
                />
                <circle cx="2" cy="-5.5" r="0.6" fill="#ffffff" opacity="0.75" />

                {/* Two dark graphite eyes */}
                <circle cx="-3.8" cy="-1" r="0.85" fill="#5e5f5f" />
                <circle cx="3.8" cy="-1.4" r="0.85" fill="#5e5f5f" />

                {/* Inverted triangular beak with fine outline & tinted body tone */}
                <path
                  d="M -2, 1 L 2, 0.7 L 0, 3.5 Z"
                  fill={initial.color.beak}
                  stroke="#5e5f5f"
                  strokeWidth="0.65"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Subtle soft jelly translucent inner rim reflection */}
                <path
                  d="M -7, 6 C -3, 8.2, 3, 8.2, 7, 6"
                  stroke="#ffffff"
                  strokeWidth="0.85"
                  strokeLinecap="round"
                  opacity="0.32"
                  fill="none"
                />
              </g>
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

        {/* 5. Front glass reflections & specular shine */}
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
        <p className="kalami-hint">
          点击玻璃罐可以颠球，倾斜手机可滚动它们哦～
          {gyroPermState === "idle" && isIOS && (
            <button
              type="button"
              className="kalami-gyro-btn"
              onClick={requestGyroPermission}
              title="开启手机陀螺仪感应，体验倾斜滚动"
            >
              📱 启用重力感应
            </button>
          )}
          {gyroPermState === "granted" && isIOS && (
            <button
              type="button"
              className="kalami-gyro-btn active"
              onClick={toggleGyroOff}
              title="重力感应已开启，点击可关闭"
            >
              ✨ 重力感应开启中
            </button>
          )}
          {gyroPermState === "denied" && isIOS && (
            <span className="kalami-gyro-denied">⚠️ 陀螺仪未授权（可刷新并在弹窗中允许）</span>
          )}
          {inJar > 0 && (
            <button
              type="button"
              className="kalami-replay-btn"
              disabled={hasNew || corkState !== "closed"}
              onClick={handleReplay}
              title="重播最后一轮获得的卡拉米掉落动画"
            >
              重播掉落
            </button>
          )}
        </p>
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
