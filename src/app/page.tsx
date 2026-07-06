"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { EXPERIMENTS } from "@/lib/experiments";
import TopBar from "@/components/TopBar";
import Toolbar from "@/components/Toolbar";
import ParamPanel from "@/components/ParamPanel";
import SimCanvas from "@/components/SimCanvas";
import PropertyPanel from "@/components/PropertyPanel";
import BottomBar from "@/components/BottomBar";
import ChartPanel from "@/components/ChartPanel";
import ExperimentDrawer from "@/components/ExperimentDrawer";
import MySchemesDrawer from "@/components/MySchemesDrawer";

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schemesOpen, setSchemesOpen] = useState(false);
  const tool = useStore((s) => s.tool);
  const loadExperiment = useStore((s) => s.loadExperiment);
  const objects = useStore((s) => s.objects);
  const sim = useStore((s) => s.sim);

  // 首次加载默认实验
  useEffect(() => {
    if (objects.length === 0) {
      const def = EXPERIMENTS.find((e) => e.id === "horizontal-throw")!;
      loadExperiment(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hints: Record<string, string> = {
    select: "点选对象查看属性 · 拖动移动 · 中键/右键拖动平移视图 · 滚轮缩放",
    mass: "点击放置质点 · 拖动设置初速度方向与大小",
    spring: "拖动绘制弹簧 · 两端可连接质点或固定点",
    tether: "拖动绘制绳/杆 · 第一点为中心，第二点靠近质点自动连接",
    ground: "拖动绘制地面/管模型线段",
    conveyor: "拖动绘制传送带 · 摩擦带动质点",
    efield: "拖动框选电场区域 · 对带电质点施力 F=qE",
    bfield: "拖动框选磁场区域 · 洛伦兹力 F=qv×B",
    source: "点击放置粒子源 · 拖动设置发射方向",
    point: "点击放置辅助点",
    line: "拖动绘制辅助线",
    text: "点击放置文本框",
  };

  return (
    <div className="h-screen flex flex-col bg-iwuli-bg overflow-hidden">
      <TopBar onOpenExperiments={() => setDrawerOpen(true)} onOpenSchemes={() => setSchemesOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <Toolbar />
        <ParamPanel />
        <main className="flex-1 relative overflow-hidden">
          <SimCanvas />
          {/* 工具提示 */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-iwuli-panel/80 backdrop-blur border border-iwuli-border rounded-full text-[11px] text-iwuli-sub pointer-events-none">
            {hints[tool]}
          </div>
          {/* 仿真状态徽标 */}
          {sim.isSimulating && (
            <div className="absolute top-2 right-2 px-2.5 py-1 bg-iwuli-accent/90 text-white text-[11px] rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              {sim.paused ? "已暂停" : "仿真中"}
            </div>
          )}
          <ChartPanel />
        </main>
        <PropertyPanel />
      </div>
      <BottomBar />
      <ExperimentDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <MySchemesDrawer open={schemesOpen} onClose={() => setSchemesOpen(false)} />
    </div>
  );
}
