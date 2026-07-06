"use client";

import { useStore } from "@/lib/store";
import type {
  PhysicsObject, MassObj, SpringObj, GroundObj, ConveyorObj,
  TetherObj, EFieldObj, BFieldObj, SourceObj,
} from "@/lib/types";
import { IconTrash } from "./Icons";

const COLORS = ["#3d8bff", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-iwuli-sub flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Num({ value, onChange, step = 0.1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={Math.round(value * 1e4) / 1e4}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="w-20 bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs text-right focus:outline-none focus:border-iwuli-accent"
    />
  );
}

export default function PropertyPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const objects = useStore((s) => s.objects);
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const obj = objects.find((o) => o.id === selectedId);

  if (!obj) {
    return (
      <div className="w-64 bg-iwuli-panel border-l border-iwuli-border p-4 text-xs text-iwuli-sub">
        <div className="text-center mt-8 space-y-2">
          <div className="text-3xl opacity-30">⚙</div>
          <p>未选中对象</p>
          <p className="text-[11px] leading-relaxed">在画布中点选对象查看与编辑其外观属性和物理属性。</p>
        </div>
      </div>
    );
  }

  const typeLabel: Record<string, string> = {
    mass: "质点", spring: "弹簧", ground: "地面", conveyor: "传送带",
    tether: "绳/杆约束", efield: "电场", bfield: "磁场", source: "粒子源",
    point: "辅助点", line: "辅助线", text: "文本框",
  };

  return (
    <div className="w-64 bg-iwuli-panel border-l border-iwuli-border overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-iwuli-border flex items-center justify-between">
        <span className="text-sm font-medium">{typeLabel[obj.type]} 属性</span>
        <button onClick={() => removeObject(obj.id)} title="删除对象" className="text-iwuli-sub hover:text-red-400 p-1">
          <IconTrash width={15} height={15} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {obj.type === "mass" && <MassProps obj={obj as MassObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "spring" && <SpringProps obj={obj as SpringObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "ground" && <GroundProps obj={obj as GroundObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "conveyor" && <ConveyorProps obj={obj as ConveyorObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "tether" && <TetherProps obj={obj as TetherObj} objects={objects} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "efield" && <EFieldProps obj={obj as EFieldObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "bfield" && <BFieldProps obj={obj as BFieldObj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "source" && <SourceProps obj={obj as SourceObj} update={(p) => updateObject(obj.id, p)} />}
        {(obj.type === "point") && <PosProps obj={obj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "line" && <LineProps obj={obj} update={(p) => updateObject(obj.id, p)} />}
        {obj.type === "text" && <TextProps obj={obj} update={(p) => updateObject(obj.id, p)} />}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-iwuli-accent mb-1.5 uppercase tracking-wide">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MassProps({ obj, update }: { obj: MassObj; update: (p: Partial<MassObj>) => void }) {
  return (
    <>
      <Section title="物理属性">
        <Field label="质量 m"><Num value={obj.mass} onChange={(v) => update({ mass: Math.max(0.01, v) })} step={0.5} /></Field>
        <Field label="位置 x"><Num value={obj.x} onChange={(v) => update({ x: v })} /></Field>
        <Field label="位置 y"><Num value={obj.y} onChange={(v) => update({ y: v })} /></Field>
        <Field label="初速度 vx"><Num value={obj.vx} onChange={(v) => update({ vx: v })} step={0.5} /></Field>
        <Field label="初速度 vy"><Num value={obj.vy} onChange={(v) => update({ vy: v })} step={0.5} /></Field>
        <Field label="电荷量 q"><Num value={obj.charge} onChange={(v) => update({ charge: v })} step={0.5} /></Field>
      </Section>
      <Section title="外观属性">
        <Field label="半径"><Num value={obj.radius} onChange={(v) => update({ radius: Math.max(0.05, v) })} step={0.1} /></Field>
        <div>
          <div className="text-xs text-iwuli-sub mb-1">颜色</div>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button key={c} onClick={() => update({ color: c })} className={`w-5 h-5 rounded-full border-2 ${obj.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
            ))}
          </div>
        </div>
        <Toggle label="显示速度箭头" on={obj.showVelocity} onClick={() => update({ showVelocity: !obj.showVelocity })} />
        <Toggle label="显示 m 标识" on={obj.showLabel} onClick={() => update({ showLabel: !obj.showLabel })} />
        <Toggle label="固定(不动)" on={obj.fixed} onClick={() => update({ fixed: !obj.fixed })} />
      </Section>
    </>
  );
}

function SpringProps({ obj, update }: { obj: SpringObj; update: (p: Partial<SpringObj>) => void }) {
  return (
    <Section title="物理属性">
      <Field label="劲度系数 k"><Num value={obj.k} onChange={(v) => update({ k: Math.max(0, v) })} step={5} /></Field>
      <Field label="自然长度"><Num value={obj.naturalLength} onChange={(v) => update({ naturalLength: Math.max(0.1, v) })} step={0.5} /></Field>
      <Field label="阻尼"><Num value={obj.damping} onChange={(v) => update({ damping: Math.max(0, v) })} step={0.05} /></Field>
      <Field label="圈数"><Num value={obj.coils} onChange={(v) => update({ coils: Math.max(1, Math.round(v)) })} step={1} /></Field>
      <p className="text-[10px] text-iwuli-sub leading-relaxed pt-1">
        弹簧两端可连接质点或固定。绘制后选中质点时，可在画布上拖动质点到弹簧端点吸附（将端点坐标设为质点位置）。
      </p>
    </Section>
  );
}

function GroundProps({ obj, update }: { obj: GroundObj; update: (p: Partial<GroundObj>) => void }) {
  return (
    <Section title="物理属性">
      <Field label="起点 x1"><Num value={obj.x1} onChange={(v) => update({ x1: v })} /></Field>
      <Field label="起点 y1"><Num value={obj.y1} onChange={(v) => update({ y1: v })} /></Field>
      <Field label="终点 x2"><Num value={obj.x2} onChange={(v) => update({ x2: v })} /></Field>
      <Field label="终点 y2"><Num value={obj.y2} onChange={(v) => update({ y2: v })} /></Field>
      <Field label="动摩擦因数 μ"><Num value={obj.friction} onChange={(v) => update({ friction: Math.max(0, v) })} step={0.05} /></Field>
    </Section>
  );
}

function PosProps({ obj, update }: { obj: { x: number; y: number }; update: (p: Partial<PhysicsObject>) => void }) {
  return (
    <Section title="位置">
      <Field label="x"><Num value={obj.x} onChange={(v) => update({ x: v })} /></Field>
      <Field label="y"><Num value={obj.y} onChange={(v) => update({ y: v })} /></Field>
    </Section>
  );
}

function LineProps({ obj, update }: { obj: { x1: number; y1: number; x2: number; y2: number }; update: (p: Partial<PhysicsObject>) => void }) {
  return (
    <Section title="端点">
      <Field label="x1"><Num value={obj.x1} onChange={(v) => update({ x1: v })} /></Field>
      <Field label="y1"><Num value={obj.y1} onChange={(v) => update({ y1: v })} /></Field>
      <Field label="x2"><Num value={obj.x2} onChange={(v) => update({ x2: v })} /></Field>
      <Field label="y2"><Num value={obj.y2} onChange={(v) => update({ y2: v })} /></Field>
    </Section>
  );
}

function TextProps({ obj, update }: { obj: { x: number; y: number; content: string; fontSize: number }; update: (p: Partial<PhysicsObject>) => void }) {
  return (
    <Section title="文本">
      <Field label="x"><Num value={obj.x} onChange={(v) => update({ x: v })} /></Field>
      <Field label="y"><Num value={obj.y} onChange={(v) => update({ y: v })} /></Field>
      <div>
        <div className="text-xs text-iwuli-sub mb-1">内容</div>
        <input value={obj.content} onChange={(e) => update({ content: e.target.value })} className="w-full bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-iwuli-accent" />
      </div>
      <Field label="字号"><Num value={obj.fontSize} onChange={(v) => update({ fontSize: Math.max(8, v) })} step={1} /></Field>
    </Section>
  );
}

function ConveyorProps({ obj, update }: { obj: ConveyorObj; update: (p: Partial<ConveyorObj>) => void }) {
  return (
    <Section title="物理属性">
      <Field label="速度 v"><Num value={obj.velocity} onChange={(v) => update({ velocity: v })} step={0.5} /></Field>
      <Field label="摩擦 μ"><Num value={obj.friction} onChange={(v) => update({ friction: Math.max(0, v) })} step={0.05} /></Field>
      <Field label="x1"><Num value={obj.x1} onChange={(v) => update({ x1: v })} /></Field>
      <Field label="y1"><Num value={obj.y1} onChange={(v) => update({ y1: v })} /></Field>
      <Field label="x2"><Num value={obj.x2} onChange={(v) => update({ x2: v })} /></Field>
      <Field label="y2"><Num value={obj.y2} onChange={(v) => update({ y2: v })} /></Field>
    </Section>
  );
}

function TetherProps({ obj, objects, update }: { obj: TetherObj; objects: PhysicsObject[]; update: (p: Partial<TetherObj>) => void }) {
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];
  return (
    <Section title="约束属性">
      <Field label="绳/杆长"><Num value={obj.length} onChange={(v) => update({ length: Math.max(0.1, v) })} step={0.5} /></Field>
      <div className="text-xs text-iwuli-sub">类型</div>
      <div className="flex gap-1">
        <button onClick={() => update({ rigid: true })} className={`flex-1 text-[11px] py-1 rounded ${obj.rigid ? "bg-iwuli-accent text-white" : "bg-iwuli-bg text-iwuli-sub"}`}>杆(圆周)</button>
        <button onClick={() => update({ rigid: false })} className={`flex-1 text-[11px] py-1 rounded ${!obj.rigid ? "bg-iwuli-accent text-white" : "bg-iwuli-bg text-iwuli-sub"}`}>绳(单摆)</button>
      </div>
      <div className="text-xs text-iwuli-sub mt-1">连接质点</div>
      <select value={obj.targetId || ""} onChange={(e) => update({ targetId: e.target.value || null })} className="w-full bg-iwuli-bg border border-iwuli-border rounded px-1.5 py-0.5 text-xs">
        <option value="">未连接</option>
        {masses.map((m, i) => <option key={m.id} value={m.id}>质点 {i + 1}</option>)}
      </select>
      <Field label="中心 cx"><Num value={obj.cx} onChange={(v) => update({ cx: v })} /></Field>
      <Field label="中心 cy"><Num value={obj.cy} onChange={(v) => update({ cy: v })} /></Field>
    </Section>
  );
}

function EFieldProps({ obj, update }: { obj: EFieldObj; update: (p: Partial<EFieldObj>) => void }) {
  return (
    <Section title="电场属性">
      <Field label="Ex"><Num value={obj.ex} onChange={(v) => update({ ex: v })} step={1} /></Field>
      <Field label="Ey"><Num value={obj.ey} onChange={(v) => update({ ey: v })} step={1} /></Field>
      <Field label="中心 x"><Num value={obj.x} onChange={(v) => update({ x: v })} /></Field>
      <Field label="中心 y"><Num value={obj.y} onChange={(v) => update({ y: v })} /></Field>
      <Field label="宽 w"><Num value={obj.w} onChange={(v) => update({ w: Math.max(0.5, v) })} step={0.5} /></Field>
      <Field label="高 h"><Num value={obj.h} onChange={(v) => update({ h: Math.max(0.5, v) })} step={0.5} /></Field>
      <p className="text-[10px] text-iwuli-sub">对区域内带电质点施力 F=qE</p>
    </Section>
  );
}

function BFieldProps({ obj, update }: { obj: BFieldObj; update: (p: Partial<BFieldObj>) => void }) {
  return (
    <Section title="磁场属性">
      <Field label="Bz"><Num value={obj.bz} onChange={(v) => update({ bz: v })} step={0.5} /></Field>
      <div className="text-[10px] text-iwuli-sub">正值穿出纸面⊙, 负值穿入⊗</div>
      <Field label="中心 x"><Num value={obj.x} onChange={(v) => update({ x: v })} /></Field>
      <Field label="中心 y"><Num value={obj.y} onChange={(v) => update({ y: v })} /></Field>
      <Field label="宽 w"><Num value={obj.w} onChange={(v) => update({ w: Math.max(0.5, v) })} step={0.5} /></Field>
      <Field label="高 h"><Num value={obj.h} onChange={(v) => update({ h: Math.max(0.5, v) })} step={0.5} /></Field>
      <p className="text-[10px] text-iwuli-sub">洛伦兹力 F=qv×B</p>
    </Section>
  );
}

function SourceProps({ obj, update }: { obj: SourceObj; update: (p: Partial<SourceObj>) => void }) {
  const colors = ["#22c55e", "#3d8bff", "#f59e0b", "#ef4444", "#a855f7"];
  return (
    <Section title="粒子源属性">
      <Toggle label="启用发射" on={obj.enabled !== false} onClick={() => update({ enabled: obj.enabled === false })} />
      <Field label="发射率(个/秒)"><Num value={obj.rate} onChange={(v) => update({ rate: Math.max(0, v) })} step={1} /></Field>
      <Field label="初速度 vx"><Num value={obj.vx} onChange={(v) => update({ vx: v })} step={0.5} /></Field>
      <Field label="初速度 vy"><Num value={obj.vy} onChange={(v) => update({ vy: v })} step={0.5} /></Field>
      <Field label="粒子质量"><Num value={obj.mass} onChange={(v) => update({ mass: Math.max(0.01, v) })} step={0.1} /></Field>
      <Field label="粒子半径"><Num value={obj.radius} onChange={(v) => update({ radius: Math.max(0.05, v) })} step={0.05} /></Field>
      <Field label="电荷量"><Num value={obj.charge} onChange={(v) => update({ charge: v })} step={0.5} /></Field>
      <Field label="生命(秒)"><Num value={obj.life} onChange={(v) => update({ life: Math.max(0.5, v) })} step={0.5} /></Field>
      <div className="text-xs text-iwuli-sub">颜色</div>
      <div className="flex gap-1.5 flex-wrap">
        {colors.map((c) => (
          <button key={c} onClick={() => update({ color: c })} className={`w-5 h-5 rounded-full border-2 ${obj.color === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />
        ))}
      </div>
    </Section>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between text-xs py-0.5">
      <span className="text-iwuli-sub">{label}</span>
      <div className={`iwuli-switch ${on ? "on" : ""}`} />
    </button>
  );
}
