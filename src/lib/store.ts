"use client";

import { create } from "zustand";
import type {
  PhysicsObject,
  Tool,
  GlobalConfig,
  SimState,
  ChartConfig,
  MassObj,
  Experiment,
} from "./types";
import { stepPhysics, resetObjects } from "./physics";

let idCounter = 1;
export const genId = (prefix = "obj") => `${prefix}_${Date.now().toString(36)}_${idCounter++}`;

interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Scheme {
  id: string;
  name: string;
  objects: PhysicsObject[];
  config: GlobalConfig;
  createdAt: number;
}

const SCHEME_KEY = "iwuli_saved_schemes";

function loadSchemes(): Scheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCHEME_KEY);
    return raw ? (JSON.parse(raw) as Scheme[]) : [];
  } catch {
    return [];
  }
}
function persistSchemes(list: Scheme[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCHEME_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

interface Store {
  objects: PhysicsObject[];
  selectedId: string | null;
  tool: Tool;
  config: GlobalConfig;
  sim: SimState;
  chart: ChartConfig;
  chartData: { t: number; value: number }[];
  viewport: Viewport;
  experimentName: string;
  showGrid: boolean;
  showAxis: boolean;
  /** 仿真前的初始对象快照，用于重置 */
  initialSnapshot: PhysicsObject[] | null;
  /** 正在绘制的临时状态 */
  drawing: { type: Tool; points: { x: number; y: number }[] } | null;

  // 选择与工具
  setTool: (t: Tool) => void;
  selectObject: (id: string | null) => void;
  addObject: (o: PhysicsObject) => void;
  updateObject: (id: string, patch: Partial<PhysicsObject>) => void;
  removeObject: (id: string) => void;
  clearAll: () => void;

  // 绘制
  startDrawing: (type: Tool, p: { x: number; y: number }) => void;
  updateDrawing: (p: { x: number; y: number }) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;

  // 全局配置
  setConfig: (patch: Partial<GlobalConfig>) => void;
  addParam: (name: string, value: number) => void;
  updateParam: (name: string, value: number) => void;
  removeParam: (name: string) => void;
  addSlider: (s: { param: string; min: number; max: number; value: number; step: number }) => void;
  updateSlider: (id: string, value: number) => void;
  removeSlider: (id: string) => void;

  // 仿真控制
  startSim: () => void;
  pauseSim: () => void;
  resetSim: () => void;
  setSpeed: (s: number) => void;
  tick: (dt: number) => void;

  // 图表
  setChart: (patch: Partial<ChartConfig>) => void;
  clearChart: () => void;

  // 视口
  setViewport: (v: Partial<Viewport>) => void;
  zoomAt: (cx: number, cy: number, delta: number) => void;

  // 预设
  loadExperiment: (e: Experiment) => void;
  setExperimentName: (n: string) => void;

  // UI
  toggleGrid: () => void;
  toggleAxis: () => void;

  // 方案保存
  savedSchemes: Scheme[];
  saveScheme: (name: string) => void;
  loadScheme: (id: string) => void;
  deleteScheme: (id: string) => void;
}

const defaultConfig: GlobalConfig = {
  gravityOn: true,
  gravity: 10,
  collisionOn: true,
  airResistance: 0,
  params: [
    { name: "g", value: 10 },
    { name: "pi", value: 3.14159265 },
  ],
  sliders: [],
};

const defaultChart: ChartConfig = {
  visible: false,
  xAxis: "t",
  yAxis: "x",
  targetId: null,
  maxTime: 10,
};

export const useStore = create<Store>((set, get) => ({
  objects: [],
  selectedId: null,
  tool: "select",
  config: defaultConfig,
  sim: { isSimulating: false, time: 0, speed: 1, paused: false },
  chart: defaultChart,
  chartData: [],
  viewport: { scale: 40, offsetX: 0, offsetY: 0 },
  experimentName: "单击输入仿真名称",
  showGrid: true,
  showAxis: true,
  initialSnapshot: null,
  drawing: null,
  savedSchemes: loadSchemes(),

  setTool: (t) => set({ tool: t, selectedId: t === "select" ? get().selectedId : null }),
  selectObject: (id) => set({ selectedId: id }),
  addObject: (o) => set((s) => ({ objects: [...s.objects, o] })),
  updateObject: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? ({ ...o, ...patch } as PhysicsObject) : o
      ),
    })),
  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  clearAll: () => set({ objects: [], selectedId: null, chartData: [] }),

  startDrawing: (type, p) => set({ drawing: { type, points: [p] } }),
  updateDrawing: (p) =>
    set((s) => (s.drawing ? { drawing: { ...s.drawing, points: [...s.drawing.points, p] } } : {})),
  finishDrawing: () => {
    const { drawing, addObject } = get();
    if (!drawing) return;
    const pts = drawing.points;
    const id = genId();
    if (drawing.type === "mass" && pts.length >= 1) {
      addObject({
        id,
        type: "mass",
        x: pts[0].x,
        y: pts[0].y,
        vx: pts.length > 1 ? pts[1].x - pts[0].x : 0,
        vy: pts.length > 1 ? pts[1].y - pts[0].y : 0,
        mass: 1,
        radius: 0.4,
        color: "#3d8bff",
        charge: 0,
        showVelocity: true,
        showLabel: true,
        fixed: false,
        trail: [],
      });
    } else if (drawing.type === "ground" && pts.length >= 2) {
      addObject({
        id,
        type: "ground",
        x1: pts[0].x,
        y1: pts[0].y,
        x2: pts[1].x,
        y2: pts[1].y,
        friction: 0.2,
        isTube: false,
      });
    } else if (drawing.type === "spring" && pts.length >= 2) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      // 端点靠近质点则自动连接
      const objs = get().objects;
      const aMass = objs.find(
        (o) => o.type === "mass" && Math.hypot(o.x - pts[0].x, o.y - pts[0].y) < 0.7
      ) as MassObj | undefined;
      const bMass = objs.find(
        (o) => o.type === "mass" && Math.hypot(o.x - pts[1].x, o.y - pts[1].y) < 0.7
      ) as MassObj | undefined;
      addObject({
        id,
        type: "spring",
        aId: aMass ? aMass.id : null,
        bId: bMass ? bMass.id : null,
        ax: pts[0].x,
        ay: pts[0].y,
        bx: pts[1].x,
        by: pts[1].y,
        k: 50,
        naturalLength: Math.hypot(dx, dy),
        coils: 8,
        width: 0.3,
        damping: 0.1,
      });
    } else if (drawing.type === "point" && pts.length >= 1) {
      addObject({ id, type: "point", x: pts[0].x, y: pts[0].y });
    } else if (drawing.type === "line" && pts.length >= 2) {
      addObject({
        id,
        type: "line",
        x1: pts[0].x,
        y1: pts[0].y,
        x2: pts[1].x,
        y2: pts[1].y,
      });
    } else if (drawing.type === "text" && pts.length >= 1) {
      addObject({
        id,
        type: "text",
        x: pts[0].x,
        y: pts[0].y,
        content: "文本",
        fontSize: 16,
      });
    } else if (drawing.type === "conveyor" && pts.length >= 2) {
      addObject({
        id, type: "conveyor",
        x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y,
        velocity: 2, friction: 0.5,
      });
    } else if (drawing.type === "tether" && pts.length >= 2) {
      const objs = get().objects;
      const tMass = objs.find(
        (o) => o.type === "mass" && Math.hypot(o.x - pts[1].x, o.y - pts[1].y) < 0.9
      ) as MassObj | undefined;
      addObject({
        id, type: "tether",
        targetId: tMass ? tMass.id : null,
        cx: pts[0].x, cy: pts[0].y,
        length: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
        rigid: true,
      });
    } else if (drawing.type === "efield" && pts.length >= 2) {
      addObject({
        id, type: "efield",
        x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2,
        w: Math.max(1, Math.abs(pts[1].x - pts[0].x)),
        h: Math.max(1, Math.abs(pts[1].y - pts[0].y)),
        ex: 5, ey: 0,
      });
    } else if (drawing.type === "bfield" && pts.length >= 2) {
      addObject({
        id, type: "bfield",
        x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2,
        w: Math.max(1, Math.abs(pts[1].x - pts[0].x)),
        h: Math.max(1, Math.abs(pts[1].y - pts[0].y)),
        bz: 1,
      });
    } else if (drawing.type === "source" && pts.length >= 1) {
      addObject({
        id, type: "source",
        x: pts[0].x, y: pts[0].y,
        vx: pts.length > 1 ? pts[1].x - pts[0].x : 2,
        vy: pts.length > 1 ? pts[1].y - pts[0].y : 0,
        rate: 5, mass: 0.5, radius: 0.2, color: "#22c55e", charge: 0, life: 3,
        accum: 0, enabled: true,
      });
    }
    set({ drawing: null });
  },
  cancelDrawing: () => set({ drawing: null }),

  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  addParam: (name, value) =>
    set((s) => ({
      config: { ...s.config, params: [...s.config.params, { name, value }] },
    })),
  updateParam: (name, value) =>
    set((s) => ({
      config: {
        ...s.config,
        params: s.config.params.map((p) => (p.name === name ? { ...p, value } : p)),
        sliders: s.config.sliders.map((sl) =>
          sl.param === name ? { ...sl, value } : sl
        ),
      },
    })),
  removeParam: (name) =>
    set((s) => ({
      config: {
        ...s.config,
        params: s.config.params.filter((p) => p.name !== name),
        sliders: s.config.sliders.filter((sl) => sl.param !== name),
      },
    })),
  addSlider: (sl) =>
    set((s) => ({
      config: { ...s.config, sliders: [...s.config.sliders, { ...sl, id: genId("sl") }] },
    })),
  updateSlider: (id, value) =>
    set((s) => {
      const slider = s.config.sliders.find((sl) => sl.id === id);
      if (!slider) return {};
      const newSliders = s.config.sliders.map((sl) =>
        sl.id === id ? { ...sl, value } : sl
      );
      const newParams = s.config.params.map((p) =>
        p.name === slider.param ? { ...p, value } : p
      );
      return { config: { ...s.config, sliders: newSliders, params: newParams } };
    }),
  removeSlider: (id) =>
    set((s) => ({
      config: { ...s.config, sliders: s.config.sliders.filter((sl) => sl.id !== id) },
    })),

  startSim: () => {
    const { objects, sim } = get();
    if (!sim.isSimulating) {
      // 首次开始：保存快照
      set({
        initialSnapshot: JSON.parse(JSON.stringify(objects)),
        sim: { ...sim, isSimulating: true, paused: false, time: 0 },
        chartData: [],
      });
    } else {
      set({ sim: { ...sim, paused: false } });
    }
  },
  pauseSim: () => set((s) => ({ sim: { ...s.sim, paused: true } })),
  resetSim: () => {
    const { initialSnapshot } = get();
    set({
      objects: initialSnapshot
        ? JSON.parse(JSON.stringify(initialSnapshot))
        : get().objects,
      sim: { isSimulating: false, time: 0, speed: get().sim.speed, paused: false },
      chartData: [],
    });
  },
  setSpeed: (sp) => set((s) => ({ sim: { ...s.sim, speed: sp } })),

  tick: (dt) => {
    const { objects, config, sim, chart, updateObject } = get();
    if (!sim.isSimulating || sim.paused) return;
    const realDt = Math.min(dt, 1 / 30) * sim.speed;
    const { newObjects, newTime } = stepPhysics(objects, config, realDt, sim.time);
    // 批量更新
    set({ objects: newObjects, sim: { ...sim, time: newTime } });
    // 图表数据
    if (chart.visible && chart.targetId) {
      const target = newObjects.find(
        (o) => o.id === chart.targetId && o.type === "mass"
      ) as MassObj | undefined;
      if (target) {
        const val = evalChartValue(chart.yAxis, target, newTime, config);
        set((s) => ({
          chartData:
            s.chartData.length > 500
              ? [...s.chartData.slice(-499), { t: newTime, value: val }]
              : [...s.chartData, { t: newTime, value: val }],
        }));
      }
    }
  },

  setChart: (patch) => set((s) => ({ chart: { ...s.chart, ...patch } })),
  clearChart: () => set({ chartData: [] }),

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),
  zoomAt: (cx, cy, delta) =>
    set((s) => {
      const vp = s.viewport;
      const newScale = Math.max(8, Math.min(200, vp.scale * (1 - delta * 0.001)));
      return { viewport: { ...vp, scale: newScale } };
    }),

  loadExperiment: (e) => {
    const objs = JSON.parse(JSON.stringify(e.objects)) as PhysicsObject[];
    set({
      objects: objs,
      config: JSON.parse(JSON.stringify(e.config)),
      selectedId: null,
      sim: { isSimulating: false, time: 0, speed: 1, paused: false },
      chartData: [],
      initialSnapshot: null,
      experimentName: e.name,
    });
  },
  setExperimentName: (n) => set({ experimentName: n }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAxis: () => set((s) => ({ showAxis: !s.showAxis })),

  saveScheme: (name) => {
    const { objects, config, savedSchemes } = get();
    const scheme: Scheme = {
      id: genId("sch"),
      name: name || `方案 ${savedSchemes.length + 1}`,
      objects: JSON.parse(JSON.stringify(objects)) as PhysicsObject[],
      config: JSON.parse(JSON.stringify(config)),
      createdAt: Date.now(),
    };
    const next = [scheme, ...savedSchemes];
    persistSchemes(next);
    set({ savedSchemes: next });
  },
  loadScheme: (id) => {
    const scheme = get().savedSchemes.find((s) => s.id === id);
    if (!scheme) return;
    set({
      objects: JSON.parse(JSON.stringify(scheme.objects)) as PhysicsObject[],
      config: JSON.parse(JSON.stringify(scheme.config)),
      selectedId: null,
      sim: { isSimulating: false, time: 0, speed: 1, paused: false },
      chartData: [],
      initialSnapshot: null,
      experimentName: scheme.name,
    });
  },
  deleteScheme: (id) => {
    const next = get().savedSchemes.filter((s) => s.id !== id);
    persistSchemes(next);
    set({ savedSchemes: next });
  },
}));

/** 计算图表 Y 值 */
function evalChartValue(
  expr: string,
  mass: MassObj,
  t: number,
  config: GlobalConfig
): number {
  const ctx: Record<string, number> = { t, x: mass.x, y: mass.y, v: Math.hypot(mass.vx, mass.vy), vx: mass.vx, vy: mass.vy };
  config.params.forEach((p) => (ctx[p.name] = p.value));
  try {
    // 简单表达式求值(受限)
    const fn = new Function(...Object.keys(ctx), `return ${expr}`);
    return fn(...Object.values(ctx));
  } catch {
    return 0;
  }
}
