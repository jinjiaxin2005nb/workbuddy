"use client";

import { useStore } from "@/lib/store";
import { IconPlay, IconPause, IconReset, IconChart, IconArrowRight } from "./Icons";

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export default function BottomBar() {
  const sim = useStore((s) => s.sim);
  const startSim = useStore((s) => s.startSim);
  const pauseSim = useStore((s) => s.pauseSim);
  const resetSim = useStore((s) => s.resetSim);
  const setSpeed = useStore((s) => s.setSpeed);
  const chart = useStore((s) => s.chart);
  const setChart = useStore((s) => s.setChart);
  const objects = useStore((s) => s.objects);
  const hasMass = objects.some((o) => o.type === "mass");

  return (
    <div className="h-12 bg-iwuli-panel border-t border-iwuli-border flex items-center px-4 gap-4">
      {/* 播放控制 */}
      <div className="flex items-center gap-2">
        {!sim.isSimulating ? (
          <button
            onClick={startSim}
            disabled={!hasMass}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-iwuli-accent text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <IconPlay width={14} height={14} />
            进入仿真环境
            <IconArrowRight width={14} height={14} />
          </button>
        ) : (
          <>
            {sim.paused ? (
              <button onClick={startSim} className="tool-btn w-8 h-8 rounded-md flex items-center justify-center text-iwuli-text">
                <IconPlay width={16} height={16} />
              </button>
            ) : (
              <button onClick={pauseSim} className="tool-btn w-8 h-8 rounded-md flex items-center justify-center text-iwuli-text">
                <IconPause width={16} height={16} />
              </button>
            )}
            <button onClick={resetSim} title="返回编辑环境" className="tool-btn w-8 h-8 rounded-md flex items-center justify-center text-iwuli-text">
              <IconReset width={16} height={16} />
            </button>
          </>
        )}
      </div>

      {/* 时间显示 */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-iwuli-sub">t =</span>
        <span className="font-mono text-iwuli-text tabular-nums w-16 text-right">{sim.time.toFixed(2)} s</span>
      </div>

      {/* 时间进度条(可视化) */}
      <div className="flex-1 h-1.5 bg-iwuli-bg rounded-full overflow-hidden max-w-md">
        <div
          className="h-full bg-iwuli-accent transition-[width] duration-100"
          style={{ width: `${Math.min(100, (sim.time % 20) * 5)}%` }}
        />
      </div>

      {/* 速度 */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-iwuli-sub">速度</span>
        <div className="flex bg-iwuli-bg rounded-md overflow-hidden">
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              className={`px-2 py-1 text-[11px] tabular-nums ${sim.speed === sp ? "bg-iwuli-accent text-white" : "text-iwuli-sub hover:text-iwuli-text"}`}
            >
              {sp}×
            </button>
          ))}
        </div>
      </div>

      {/* 函数图像 */}
      <button
        onClick={() => setChart({ visible: !chart.visible })}
        className={`tool-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${chart.visible ? "active text-white" : "text-iwuli-sub"}`}
      >
        <IconChart width={15} height={15} />
        函数图像
      </button>
    </div>
  );
}
