"use client";

import { useStore } from "@/lib/store";
import type { Tool } from "@/lib/types";
import {
  IconSelect, IconMass, IconSpring, IconGround, IconPoint, IconLine, IconText,
  IconConveyor, IconTether, IconEField, IconBField, IconSource,
} from "./Icons";

const TOOLS: { tool: Tool; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>>; hint: string }[] = [
  { tool: "select", label: "选择", Icon: IconSelect, hint: "选择/移动对象" },
  { tool: "mass", label: "质点", Icon: IconMass, hint: "粒子(M)：拖动设置初速度" },
  { tool: "spring", label: "弹簧", Icon: IconSpring, hint: "弹簧(T)：端点靠近质点自动连接" },
  { tool: "tether", label: "绳/杆", Icon: IconTether, hint: "绳/杆约束：圆周运动/单摆，端点靠近质点自动连接" },
  { tool: "ground", label: "地面", Icon: IconGround, hint: "地面/管模型" },
  { tool: "conveyor", label: "传送带", Icon: IconConveyor, hint: "传送带模型：摩擦带动质点" },
  { tool: "efield", label: "电场", Icon: IconEField, hint: "电场(E)：拖动框选区域，F=qE" },
  { tool: "bfield", label: "磁场", Icon: IconBField, hint: "磁场(B)：拖动框选区域，洛伦兹力F=qv×B" },
  { tool: "source", label: "粒子源", Icon: IconSource, hint: "粒子源：持续发射带寿命的粒子" },
  { tool: "point", label: "辅助点", Icon: IconPoint, hint: "辅助点(P)" },
  { tool: "line", label: "辅助线", Icon: IconLine, hint: "辅助线" },
  { tool: "text", label: "文本", Icon: IconText, hint: "文本框" },
];

export default function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <div className="w-14 bg-iwuli-panel border-r border-iwuli-border flex flex-col items-center py-2 gap-1">
      {TOOLS.map(({ tool: t, label, Icon, hint }) => (
        <button
          key={t}
          onClick={() => setTool(t)}
          title={`${label} — ${hint}`}
          className={`tool-btn w-10 h-10 rounded-md flex flex-col items-center justify-center gap-0.5 text-iwuli-sub ${
            tool === t ? "active" : ""
          }`}
        >
          <Icon width={18} height={18} />
          <span className="text-[9px] leading-none">{label}</span>
        </button>
      ))}
    </div>
  );
}
