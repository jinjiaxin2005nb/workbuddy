"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { IconChevronDown, IconExperiment, IconBook, IconUser, IconTrash, IconFolder } from "./Icons";

const MODULES = [
  { id: "next", name: "NEXT仿真", available: true },
  { id: "forcemotion", name: "动力学仿真", available: true },
  { id: "circuit", name: "电路仿真", available: false },
  { id: "optics", name: "光学仿真", available: false },
  { id: "gravity", name: "万有引力仿真", available: false },
  { id: "plate", name: "板块世界", available: false },
];

export default function TopBar({ onOpenExperiments, onOpenSchemes }: { onOpenExperiments: () => void; onOpenSchemes: () => void }) {
  const [moduleOpen, setModuleOpen] = useState(false);
  const [curModule, setCurModule] = useState("next");
  const experimentName = useStore((s) => s.experimentName);
  const setExperimentName = useStore((s) => s.setExperimentName);
  const clearAll = useStore((s) => s.clearAll);
  const objects = useStore((s) => s.objects);
  const [editing, setEditing] = useState(false);

  const cur = MODULES.find((m) => m.id === curModule)!;

  return (
    <div className="h-11 bg-iwuli-panel border-b border-iwuli-border flex items-center px-3 gap-3 relative z-30">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-iwuli-accent to-blue-600 flex items-center justify-center text-white font-bold text-sm">i</div>
        <span className="text-sm font-semibold text-iwuli-text">爱物理</span>
        <span className="text-[10px] text-iwuli-sub border-l border-iwuli-border pl-2">力与运动仿真平台</span>
      </div>

      {/* 模块选择器 */}
      <div className="relative">
        <button
          onClick={() => setModuleOpen(!moduleOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-iwuli-panel2 hover:bg-iwuli-border text-xs text-iwuli-text"
        >
          {cur.name}
          <IconChevronDown width={13} height={13} className={`transition-transform ${moduleOpen ? "rotate-180" : ""}`} />
        </button>
        {moduleOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setModuleOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-40 bg-iwuli-panel border border-iwuli-border rounded-md shadow-xl z-20 py-1">
              {MODULES.map((m) => (
                <button
                  key={m.id}
                  disabled={!m.available}
                  onClick={() => { if (m.available) { setCurModule(m.id); setModuleOpen(false); } }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                    m.id === curModule ? "bg-iwuli-panel2 text-iwuli-accent" : "text-iwuli-text"
                  } ${!m.available ? "opacity-40 cursor-not-allowed" : "hover:bg-iwuli-panel2"}`}
                >
                  {m.name}
                  {!m.available && <span className="text-[9px] text-iwuli-sub">待开发</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 仿真名称 */}
      <div className="flex-1 flex justify-center">
        {editing ? (
          <input
            autoFocus
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            className="bg-iwuli-bg border border-iwuli-accent rounded px-2 py-0.5 text-xs text-center w-64 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-iwuli-sub hover:text-iwuli-text px-2 py-0.5"
          >
            {experimentName} <span className="text-[10px] opacity-60">✎</span>
          </button>
        )}
      </div>

      {/* 右侧操作 */}
      <button
        onClick={onOpenExperiments}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-iwuli-panel2 text-xs text-iwuli-text"
      >
        <IconExperiment width={14} height={14} />
        预设实验
      </button>
      <button
        onClick={onOpenSchemes}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-iwuli-panel2 text-xs text-iwuli-text"
      >
        <IconFolder width={14} height={14} />
        我的仿真
      </button>
      <button
        onClick={() => { if (objects.length && confirm("确定清空所有对象？")) clearAll(); }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-iwuli-panel2 text-xs text-iwuli-sub"
        title="清空场景"
      >
        <IconTrash width={14} height={14} />
      </button>
      <div className="w-px h-5 bg-iwuli-border" />
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-iwuli-panel2 text-xs text-iwuli-sub">
        <IconBook width={14} height={14} />
        教程
      </button>
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-iwuli-panel2 text-xs text-iwuli-sub">
        <IconUser width={14} height={14} />
        登录
      </button>
    </div>
  );
}
