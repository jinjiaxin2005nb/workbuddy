"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { IconPlus, IconTrash, IconWrench, IconGrid, IconAxis } from "./Icons";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <div className={`iwuli-switch ${on ? "on" : ""}`} onClick={onClick} />;
}

function Group({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-iwuli-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-iwuli-text hover:bg-iwuli-panel2"
      >
        <span>{title}</span>
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5">{children}</div>}
    </div>
  );
}

function NumInput({
  value, onChange, step = 0.1, disabled,
}: { value: number; onChange: (v: number) => void; step?: number; disabled?: boolean }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : 0}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-16 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs text-iwuli-text focus:outline-none focus:border-iwuli-accent disabled:opacity-50"
    />
  );
}

export default function ParamPanel() {
  const config = useStore((s) => s.config);
  const setConfig = useStore((s) => s.setConfig);
  const addParam = useStore((s) => s.addParam);
  const updateParam = useStore((s) => s.updateParam);
  const removeParam = useStore((s) => s.removeParam);
  const addSlider = useStore((s) => s.addSlider);
  const updateSlider = useStore((s) => s.updateSlider);
  const removeSlider = useStore((s) => s.removeSlider);
  const showGrid = useStore((s) => s.showGrid);
  const showAxis = useStore((s) => s.showAxis);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const toggleAxis = useStore((s) => s.toggleAxis);
  const objects = useStore((s) => s.objects);
  const [newParam, setNewParam] = useState("");
  const [newVal, setNewVal] = useState("0");

  return (
    <div className="w-60 bg-iwuli-panel overflow-y-auto text-iwuli-text">
      <Group title="环境设置">
        <div className="flex items-center justify-between">
          <span className="text-xs">全局重力</span>
          <div className="flex items-center gap-2">
            <NumInput value={config.gravity} onChange={(v) => setConfig({ gravity: v })} step={1} disabled={!config.gravityOn} />
            <Switch on={config.gravityOn} onClick={() => setConfig({ gravityOn: !config.gravityOn })} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">考虑碰撞</span>
          <Switch on={config.collisionOn} onClick={() => setConfig({ collisionOn: !config.collisionOn })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">空气阻力</span>
          <NumInput value={config.airResistance} onChange={(v) => setConfig({ airResistance: Math.max(0, v) })} step={0.05} />
        </div>
      </Group>

      <Group title="滑动条" defaultOpen={false}>
        <p className="text-[10px] text-iwuli-sub leading-relaxed">
          关联参数后，仿真中可拖动滑动条实时调节该参数。
        </p>
        {config.sliders.map((sl) => (
          <div key={sl.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-iwuli-accent">{sl.param}</span>
              <button onClick={() => removeSlider(sl.id)} className="text-iwuli-sub hover:text-red-400">
                <IconTrash width={12} height={12} />
              </button>
            </div>
            <input
              type="range"
              min={sl.min} max={sl.max} step={sl.step} value={sl.value}
              onChange={(e) => updateSlider(sl.id, parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-iwuli-sub">
              <span>{sl.min}</span>
              <span>{sl.value.toFixed(2)}</span>
              <span>{sl.max}</span>
            </div>
          </div>
        ))}
        <AddSlider onAdd={(param, min, max) => addSlider({ param, min, max, value: config.params.find((p) => p.name === param)?.value ?? min, step: (max - min) / 100 })} params={config.params.map((p) => p.name)} />
      </Group>

      <Group title="参数">
        <p className="text-[10px] text-iwuli-sub">可在表达式(速度/图表)中引用这些参数名。</p>
        {config.params.map((p) => (
          <div key={p.name} className="flex items-center justify-between">
            <span className="text-xs text-iwuli-accent font-mono">{p.name}</span>
            <div className="flex items-center gap-1.5">
              <NumInput value={p.value} onChange={(v) => updateParam(p.name, v)} step={0.1} />
              <button onClick={() => removeParam(p.name)} className="text-iwuli-sub hover:text-red-400">
                <IconTrash width={12} height={12} />
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-1 pt-1">
          <input
            value={newParam}
            onChange={(e) => setNewParam(e.target.value)}
            placeholder="名称"
            className="flex-1 min-w-0 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-iwuli-accent"
          />
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            placeholder="值"
            className="w-12 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-iwuli-accent"
          />
          <button
            onClick={() => {
              if (newParam.trim()) {
                addParam(newParam.trim(), parseFloat(newVal) || 0);
                setNewParam(""); setNewVal("0");
              }
            }}
            className="tool-btn w-7 h-7 rounded flex items-center justify-center text-iwuli-sub"
          >
            <IconPlus width={14} height={14} />
          </button>
        </div>
      </Group>

      <Group title="视图配置" defaultOpen={false}>
        <button onClick={toggleGrid} className="w-full flex items-center justify-between text-xs py-1 hover:text-iwuli-accent">
          <span className="flex items-center gap-2"><IconGrid width={14} height={14} /> 背景网格</span>
          <Switch on={showGrid} onClick={toggleGrid} />
        </button>
        <button onClick={toggleAxis} className="w-full flex items-center justify-between text-xs py-1 hover:text-iwuli-accent">
          <span className="flex items-center gap-2"><IconAxis width={14} height={14} /> 坐标轴</span>
          <Switch on={showAxis} onClick={toggleAxis} />
        </button>
      </Group>

      <Group title="场景统计" defaultOpen={false}>
        <div className="text-[11px] text-iwuli-sub space-y-0.5">
          <div>对象总数：{objects.length}</div>
          <div>质点：{objects.filter((o) => o.type === "mass").length}</div>
          <div>弹簧：{objects.filter((o) => o.type === "spring").length}</div>
          <div>地面：{objects.filter((o) => o.type === "ground").length}</div>
        </div>
      </Group>
    </div>
  );
}

function AddSlider({ onAdd, params }: { onAdd: (param: string, min: number, max: number) => void; params: string[] }) {
  const [param, setParam] = useState(params[0] || "");
  const [min, setMin] = useState("0");
  const [max, setMax] = useState("10");
  return (
    <div className="space-y-1 pt-1 border-t border-iwuli-border">
      <div className="flex items-center gap-1 text-[10px] text-iwuli-sub">
        <IconWrench width={12} height={12} /> 新建滑动条
      </div>
      <select
        value={param} onChange={(e) => setParam(e.target.value)}
        className="w-full bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs"
      >
        {params.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <div className="flex gap-1">
        <input value={min} onChange={(e) => setMin(e.target.value)} placeholder="min" className="w-12 bg-iwuli-bg border border-iwuli-border rounded px-1 py-0.5 text-xs" />
        <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="max" className="w-12 bg-iwuli-bg border border-iwuli-border rounded px-1 py-0.5 text-xs" />
        <button onClick={() => param && onAdd(param, parseFloat(min) || 0, parseFloat(max) || 10)} className="flex-1 tool-btn rounded px-1 py-0.5 text-xs text-iwuli-sub">添加</button>
      </div>
    </div>
  );
}
