"use client";

import { useStore } from "@/lib/store";
import type { MassObj } from "@/lib/types";
import { IconClose } from "./Icons";

const PRESETS = ["x", "y", "v", "vx", "vy", "Math.hypot(vx,vy)", "0.5*m*(vx*vx+vy*vy)"];

export default function ChartPanel() {
  const chart = useStore((s) => s.chart);
  const chartData = useStore((s) => s.chartData);
  const setChart = useStore((s) => s.setChart);
  const objects = useStore((s) => s.objects);
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];

  if (!chart.visible) return null;

  // 计算曲线范围
  const w = 360, h = 160, pad = 28;
  const xs = chartData.map((d) => d.t);
  const ys = chartData.map((d) => d.value);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs, xMin + 0.001) : 1;
  const yMin = ys.length ? Math.min(...ys) : -1;
  const yMax = ys.length ? Math.max(...ys, yMin + 0.001) : 1;
  const yPad = (yMax - yMin) * 0.1 || 1;
  const lo = yMin - yPad, hi = yMax + yPad;

  const px = (t: number) => pad + ((t - xMin) / (xMax - xMin || 1)) * (w - pad * 2);
  const py = (v: number) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
  const path = chartData.map((d, i) => `${i === 0 ? "M" : "L"}${px(d.t).toFixed(1)},${py(d.value).toFixed(1)}`).join(" ");
  const zeroY = py(0);

  return (
    <div className="absolute bottom-2 right-2 w-[380px] bg-iwuli-panel/95 backdrop-blur border border-iwuli-border rounded-lg shadow-xl z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-iwuli-border">
        <span className="text-xs font-medium">函数图像</span>
        <button onClick={() => setChart({ visible: false })} className="text-iwuli-sub hover:text-iwuli-text">
          <IconClose width={14} height={14} />
        </button>
      </div>
      <div className="px-3 py-2 space-y-2">
        <div className="flex gap-2 items-center text-xs">
          <label className="text-iwuli-sub">观测</label>
          <select
            value={chart.targetId || ""}
            onChange={(e) => setChart({ targetId: e.target.value || null })}
            className="flex-1 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5"
          >
            <option value="">选择质点</option>
            {masses.map((m, i) => (
              <option key={m.id} value={m.id}>质点 {i + 1} ({m.color})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center text-xs">
          <label className="text-iwuli-sub">Y =</label>
          <input
            value={chart.yAxis}
            onChange={(e) => setChart({ yAxis: e.target.value })}
            className="flex-1 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 font-mono"
            placeholder="如 x, v, 0.5*m*vx*vx"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setChart({ yAxis: p })} className="text-[10px] px-1.5 py-0.5 bg-iwuli-bg border border-iwuli-border rounded text-iwuli-sub hover:text-iwuli-accent hover:border-iwuli-accent font-mono">
              {p}
            </button>
          ))}
        </div>
        <svg width={w} height={h} className="w-full bg-iwuli-bg rounded">
          {/* 网格 */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="rgba(255,255,255,0.06)" />
          ))}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} y1={pad} y2={h - pad} x1={pad + f * (w - pad * 2)} x2={pad + f * (w - pad * 2)} stroke="rgba(255,255,255,0.06)" />
          ))}
          {/* 轴 */}
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.25)" />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(255,255,255,0.25)" />
          {/* 零线 */}
          {lo < 0 && hi > 0 && (
            <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          )}
          {/* 曲线 */}
          {chartData.length > 1 && (
            <path d={path} fill="none" stroke="#3d8bff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {/* 标签 */}
          <text x={pad} y={pad - 6} fill="rgba(255,255,255,0.5)" fontSize={10}>{chart.yAxis}</text>
          <text x={w - pad} y={h - pad + 14} fill="rgba(255,255,255,0.5)" fontSize={10} textAnchor="end">{chart.xAxis}</text>
          <text x={pad - 4} y={pad + 4} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">{hi.toFixed(1)}</text>
          <text x={pad - 4} y={h - pad} fill="rgba(255,255,255,0.4)" fontSize={9} textAnchor="end">{lo.toFixed(1)}</text>
        </svg>
        {chartData.length === 0 && (
          <p className="text-[10px] text-iwuli-sub text-center -mt-32 relative">开始仿真后显示曲线</p>
        )}
      </div>
    </div>
  );
}
