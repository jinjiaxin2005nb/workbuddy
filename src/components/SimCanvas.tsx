"use client";

import { useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { render, s2w, w2s } from "@/lib/render";
import type { PhysicsObject, MassObj } from "@/lib/types";

export default function SimCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  // 交互状态(非响应式)
  const dragRef = useRef<{ id: string; mode: "move" | "p1" | "p2"; offX: number; offY: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const get = useStore.getState;

  // 渲染+物理循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (t: number) => {
      const dt = lastTimeRef.current ? (t - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = t;
      const s = get();
      // 物理
      if (s.sim.isSimulating && !s.sim.paused && dt > 0) {
        s.tick(Math.min(dt, 0.05));
      }
      // 渲染
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      render(ctx, get().objects, get().viewport, cw, ch, {
        showGrid: get().showGrid,
        showAxis: get().showAxis,
        selectedId: get().selectedId,
        drawing: get().drawing,
        isSimulating: get().sim.isSimulating,
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 坐标转换
  const toWorld = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const s = get();
    return s2w(e.clientX - rect.left, e.clientY - rect.top, s.viewport, rect.width, rect.height);
  }, [get]);

  // 命中检测
  const hitTest = useCallback((wx: number, wy: number): string | null => {
    const s = get();
    const vp = s.viewport;
    // 从后往前(上层优先)
    for (let i = s.objects.length - 1; i >= 0; i--) {
      const o = s.objects[i];
      if (o.type === "mass") {
        if (Math.hypot(o.x - wx, o.y - wy) <= o.radius + 0.2) return o.id;
      } else if (o.type === "point" || o.type === "source") {
        if (Math.hypot(o.x - wx, o.y - wy) <= 0.35) return o.id;
      } else if (o.type === "spring" || o.type === "ground" || o.type === "line" || o.type === "conveyor") {
        const p1 = endPoint(o, "a");
        const p2 = endPoint(o, "b", s.objects);
        if (distToSeg(wx, wy, p1.x, p1.y, p2.x, p2.y) <= 0.25) return o.id;
      } else if (o.type === "tether") {
        const tMass = o.targetId ? s.objects.find((p) => p.id === o.targetId && p.type === "mass") as MassObj | undefined : undefined;
        const ex = tMass ? tMass.x : o.cx;
        const ey = tMass ? tMass.y : o.cy;
        if (distToSeg(wx, wy, o.cx, o.cy, ex, ey) <= 0.22 || Math.hypot(o.cx - wx, o.cy - wy) <= 0.3) return o.id;
      } else if (o.type === "efield" || o.type === "bfield") {
        if (Math.abs(o.x - wx) <= o.w / 2 && Math.abs(o.y - wy) <= o.h / 2) return o.id;
      } else if (o.type === "text") {
        if (Math.abs(o.x - wx) < 2 && Math.abs(o.y - wy) < 0.5) return o.id;
      }
    }
    return null;
    void vp;
  }, [get]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const s = get();
    const [wx, wy] = toWorld(e);
    // 中键/右键 平移
    if (e.button === 1 || e.button === 2) {
      panRef.current = { x: e.clientX, y: e.clientY, ox: s.viewport.offsetX, oy: s.viewport.offsetY };
      return;
    }
    const tool = s.tool;
    if (tool === "select") {
      const id = hitTest(wx, wy);
      s.selectObject(id);
      if (id) {
        const obj = s.objects.find((o) => o.id === id)!;
        dragRef.current = { id, mode: "move", offX: wx - objCenter(obj).x, offY: wy - objCenter(obj).y };
      }
    } else {
      // 开始绘制
      s.startDrawing(tool, { x: wx, y: wy });
    }
  }, [get, toWorld, hitTest]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const s = get();
    const [wx, wy] = toWorld(e);
    if (panRef.current) {
      const dx = (e.clientX - panRef.current.x) / s.viewport.scale;
      const dy = (e.clientY - panRef.current.y) / s.viewport.scale;
      s.setViewport({ offsetX: panRef.current.ox - dx, offsetY: panRef.current.oy + dy });
      return;
    }
    if (dragRef.current) {
      const d = dragRef.current;
      const obj = s.objects.find((o) => o.id === d.id);
      if (!obj) return;
      if (obj.type === "mass") {
        s.updateObject(d.id, { x: wx - d.offX, y: wy - d.offY } as Partial<MassObj>);
      } else if (obj.type === "point" || obj.type === "text" || obj.type === "source" || obj.type === "efield" || obj.type === "bfield") {
        s.updateObject(d.id, { x: wx - d.offX, y: wy - d.offY });
      } else if (obj.type === "tether") {
        s.updateObject(d.id, { cx: wx - d.offX, cy: wy - d.offY });
      } else if (obj.type === "ground" || obj.type === "line" || obj.type === "conveyor") {
        // 整体平移
        const c = objCenter(obj);
        const dx = wx - c.x;
        const dy = wy - c.y;
        s.updateObject(d.id, { x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy });
      }
      return;
    }
    if (s.drawing) {
      // 更新第二个点
      useStore.setState({
        drawing: { type: s.drawing.type, points: [s.drawing.points[0], { x: wx, y: wy }] },
      });
    }
  }, [get, toWorld]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const s = get();
    if (panRef.current) { panRef.current = null; return; }
    if (dragRef.current) { dragRef.current = null; return; }
    if (s.drawing) {
      // 对于单点工具(point/text)，直接完成
      if (s.drawing.type === "point" || s.drawing.type === "text") {
        s.finishDrawing();
      } else {
        // 两点工具：如果移动距离够，完成；否则取消
        const pts = s.drawing.points;
        if (pts.length >= 2 && Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) > 0.2) {
          s.finishDrawing();
        } else if (s.drawing.type === "mass" || s.drawing.type === "source") {
          // 单击放置质点/粒子源(零初速或默认)
          s.finishDrawing();
        } else {
          s.cancelDrawing();
        }
      }
    }
    void e;
  }, [get]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const s = get();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    s.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
  }, [get]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    // 双击空白取消选择
    const [wx, wy] = toWorld(e);
    const id = hitTest(wx, wy);
    if (!id) get().selectObject(null);
  }, [toWorld, hitTest]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block cursor-crosshair"
      style={{ cursor: undefined }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

// 辅助
function objCenter(o: PhysicsObject): { x: number; y: number } {
  if (o.type === "mass" || o.type === "point" || o.type === "text" || o.type === "source" || o.type === "efield" || o.type === "bfield") return { x: o.x, y: o.y };
  if (o.type === "spring") return { x: (o.ax + o.bx) / 2, y: (o.ay + o.by) / 2 };
  if (o.type === "tether") return { x: o.cx, y: o.cy };
  return { x: (o.x1 + o.x2) / 2, y: (o.y1 + o.y2) / 2 };
}
function endPoint(o: PhysicsObject, side: "a" | "b", all?: PhysicsObject[]): { x: number; y: number } {
  if (o.type === "spring") {
    if (side === "a") {
      if (o.aId && all) {
        const m = all.find((p) => p.id === o.aId && p.type === "mass") as MassObj | undefined;
        if (m) return { x: m.x, y: m.y };
      }
      return { x: o.ax, y: o.ay };
    } else {
      if (o.bId && all) {
        const m = all.find((p) => p.id === o.bId && p.type === "mass") as MassObj | undefined;
        if (m) return { x: m.x, y: m.y };
      }
      return { x: o.bx, y: o.by };
    }
  }
  if ("x1" in o) return side === "a" ? { x: o.x1, y: o.y1 } : { x: o.x2, y: o.y2 };
  return { x: 0, y: 0 };
}
function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-6;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
