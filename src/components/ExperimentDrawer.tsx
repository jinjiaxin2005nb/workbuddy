"use client";

import { useStore } from "@/lib/store";
import { EXPERIMENTS } from "@/lib/experiments";
import { IconClose, IconArrowRight } from "./Icons";

export default function ExperimentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loadExperiment = useStore((s) => s.loadExperiment);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 bg-iwuli-panel border-l border-iwuli-border h-full overflow-y-auto animate-[slidein_0.2s_ease]">
        <style>{`@keyframes slidein{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <div className="sticky top-0 bg-iwuli-panel border-b border-iwuli-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium">预设力学实验</span>
          <button onClick={onClose} className="text-iwuli-sub hover:text-iwuli-text">
            <IconClose width={16} height={16} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {EXPERIMENTS.map((e) => (
            <button
              key={e.id}
              onClick={() => { loadExperiment(e); onClose(); }}
              className="w-full text-left p-3 rounded-lg bg-iwuli-panel2 hover:bg-iwuli-border border border-transparent hover:border-iwuli-accent transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-xs font-medium text-iwuli-text">{e.name}</div>
                  <div className="text-[11px] text-iwuli-sub mt-1 leading-relaxed">{e.description}</div>
                </div>
                <IconArrowRight width={14} height={14} className="text-iwuli-sub group-hover:text-iwuli-accent mt-0.5 flex-shrink-0" />
              </div>
              <div className="flex gap-1 mt-2">
                {e.objects.filter((o) => o.type === "mass").length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-iwuli-bg rounded text-iwuli-sub">
                    {e.objects.filter((o) => o.type === "mass").length} 质点
                  </span>
                )}
                {e.objects.filter((o) => o.type === "spring").length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-iwuli-bg rounded text-iwuli-sub">
                    {e.objects.filter((o) => o.type === "spring").length} 弹簧
                  </span>
                )}
                {e.objects.filter((o) => o.type === "ground").length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-iwuli-bg rounded text-iwuli-sub">
                    {e.objects.filter((o) => o.type === "ground").length} 地面
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 text-[10px] text-iwuli-sub leading-relaxed border-t border-iwuli-border mt-2">
          <p className="mb-1 text-iwuli-text font-medium">使用提示</p>
          加载实验后点击底部「进入仿真环境」开始仿真。可在函数图像中观测位移、速度、能量等物理量随时间的变化。
        </div>
      </div>
    </div>
  );
}
