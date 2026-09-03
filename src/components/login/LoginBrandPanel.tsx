import { useEffect, useState, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Sparkles, TrendingUp, ShieldCheck, Users, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/collectrix-logo.png";

const chartData = [
  { v: 58 },
  { v: 64 },
  { v: 61 },
  { v: 70 },
  { v: 76 },
  { v: 74 },
  { v: 86 },
  { v: 94 },
];

const activity = [
  { icon: CheckCircle2, text: "Case #48213 marked recovered", meta: "2m ago" },
  { icon: Users, text: "New case batch assigned to Sarah Chen", meta: "14m ago" },
  { icon: ShieldCheck, text: "Compliance audit passed", meta: "1h ago" },
];

function CountUp({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const target = useMotionValue(0);
  const spring = useSpring(target, { stiffness: 60, damping: 18, mass: 0.6 });
  const [text, setText] = useState(`0${suffix}`);

  useEffect(() => {
    target.set(value);
  }, [value, target]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setText(`${v.toFixed(decimals)}${suffix}`);
    });
    return unsubscribe;
  }, [spring, decimals, suffix]);

  return <span>{text}</span>;
}

function FloatingChip({
  icon: Icon,
  label,
  className,
  delay = 0,
}: {
  icon: typeof Sparkles;
  label: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={cn(
        "absolute z-20 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md",
        className,
      )}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: [0, -7, 0], scale: 1 }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 },
      }}
    >
      <Icon className="h-3.5 w-3.5 text-cyan-200" />
      {label}
    </motion.div>
  );
}

function TiltCard({
  mouseX,
  mouseY,
}: {
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}) {
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), {
    stiffness: 150,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), {
    stiffness: 150,
    damping: 22,
  });

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 1200 }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
      className="relative w-full max-w-[380px]"
    >
      <div className="absolute inset-4 -z-10 rounded-[2rem] bg-cyan-400/15 blur-3xl" />

      <FloatingChip
        icon={TrendingUp}
        label="+18% this quarter"
        className="-top-5 -right-3"
        delay={0.9}
      />
      <FloatingChip
        icon={ShieldCheck}
        label="Audit-ready"
        className="-bottom-4 -left-5"
        delay={1.2}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-white/90">
              Recovery Overview
            </span>
          </div>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
            <ArrowUpRight className="h-3 w-3" /> Live
          </span>
        </div>

        <div className="mt-3 h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="brandChartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a5f3fc" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#a5f3fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#e0f2fe"
                strokeWidth={2}
                fill="url(#brandChartFill)"
                isAnimationActive
                animationDuration={1400}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          <div>
            <div className="font-display text-lg font-bold text-white">
              <CountUp value={94.2} decimals={1} suffix="%" />
            </div>
            <div className="text-[11px] text-white/60">Recovery rate</div>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white">
              <CountUp value={1284} />
            </div>
            <div className="text-[11px] text-white/60">Active cases</div>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white">
              <CountUp value={100} suffix="%" />
            </div>
            <div className="text-[11px] text-white/60">Compliance</div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
          {activity.map((item, i) => (
            <motion.div
              key={item.text}
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.15 }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                <item.icon className="h-3.5 w-3.5 text-cyan-200" />
              </span>
              <span className="flex-1 truncate text-xs text-white/80">{item.text}</span>
              <span className="shrink-0 text-[10px] text-white/45">{item.meta}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function LoginBrandPanel() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative hidden lg:flex flex-col overflow-hidden bg-[oklch(0.13_0.035_262)] text-white p-10"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(160deg, oklch(0.16 0.045 262) 0%, oklch(0.11 0.03 264) 55%, oklch(0.09 0.025 264) 100%)",
        }}
      />
      <motion.div
        className="absolute -top-24 -right-16 h-[26rem] w-[26rem] rounded-full blur-[110px] bg-cyan-400/[0.16]"
        animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-24 -left-16 h-[22rem] w-[22rem] rounded-full blur-[110px] bg-indigo-500/[0.14]"
        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay pointer-events-none">
        <filter id="brandGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#brandGrain)" />
      </svg>

      <div className="relative z-10">
        <img
          src={logo}
          alt="Collectrix Ai"
          className="h-12 w-auto select-none"
          style={{ filter: "brightness(0) invert(1)" }}
          draggable={false}
        />
      </div>

      <motion.div
        className="relative z-10 mt-10 max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.06] text-[11px] font-semibold tracking-wide text-cyan-100">
          <Sparkles className="h-3 w-3" /> Tenant Admin Workspace
        </span>
        <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #bae6fd, #38bdf8)" }}
          >
            Recover smarter,
          </span>
          <br />
          <span className="text-white">stay compliant.</span>
        </h2>
        <p className="mt-4 text-white/65 max-w-sm leading-relaxed">
          Manage your team, roles and customer operations from one secure, AI-assisted control
          center.
        </p>
      </motion.div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-8">
        <TiltCard mouseX={mouseX} mouseY={mouseY} />
      </div>

      <div className="relative z-10 text-xs text-white/60">
        © {new Date().getFullYear()} Collectrix Ai. All rights reserved.
      </div>
    </div>
  );
}
