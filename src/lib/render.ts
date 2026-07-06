import type {
  PhysicsObject, MassObj, SpringObj, GroundObj, ConveyorObj,
  TetherObj, EFieldObj, BFieldObj, SourceObj,
} from "./types";

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface RenderOpts {
  showGrid: boolean;
  showAxis: boolean;
  selectedId: string | null;
  drawing: { type: string; points: { x: number; y: number }[] } | null;
  isSimulating: boolean;
}

/** 世界坐标 -> 屏幕坐标 */
export function w2s(
  wx: number,
  wy: number,
  vp: Viewport,
  cw: number,
  ch: number
): [number, number] {
  return [cw / 2 + (wx - vp.offsetX) * vp.scale, ch / 2 - (wy - vp.offsetY) * vp.scale];
}
/** 屏幕坐标 -> 世界坐标 */
export function s2w(
  sx: number,
  sy: number,
  vp: Viewport,
  cw: number,
  ch: number
): [number, number] {
  return [(sx - cw / 2) / vp.scale + vp.offsetX, (ch / 2 - sy) / vp.scale + vp.offsetY];
}

export function render(
  ctx: CanvasRenderingContext2D,
  objects: PhysicsObject[],
  vp: Viewport,
  cw: number,
  ch: number,
  opts: RenderOpts
) {
  ctx.clearRect(0, 0, cw, ch);
  // 背景
  ctx.fillStyle = "#1a1f26";
  ctx.fillRect(0, 0, cw, ch);

  if (opts.showGrid) drawGrid(ctx, vp, cw, ch);
  if (opts.showAxis) drawAxis(ctx, vp, cw, ch);

  // 绘制对象(场最底，质点最上)
  const drawList: PhysicsObject[] = [
    ...objects.filter((o) => o.type === "efield" || o.type === "bfield"),
    ...objects.filter((o) => o.type === "ground" || o.type === "conveyor" || o.type === "line"),
    ...objects.filter((o) => o.type === "spring" || o.type === "tether"),
    ...objects.filter((o) => o.type === "point" || o.type === "text" || o.type === "source"),
    ...objects.filter((o) => o.type === "mass"),
  ];
  drawList.forEach((o) => drawObject(ctx, o, vp, cw, ch, opts, objects));

  // 绘制预览
  if (opts.drawing) drawPreview(ctx, opts.drawing, vp, cw, ch);
}

function drawGrid(ctx: CanvasRenderingContext2D, vp: Viewport, cw: number, ch: number) {
  const step = 1; // 世界单位1米
  const [w0] = s2w(0, 0, vp, cw, ch);
  const [w1] = s2w(cw, 0, vp, cw, ch);
  const [, h0] = s2w(0, ch, vp, cw, ch);
  const [, h1] = s2w(0, 0, vp, cw, ch);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.floor(w0); x <= w1; x += step) {
    const [sx] = w2s(x, 0, vp, cw, ch);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, ch);
  }
  for (let y = Math.floor(h0); y <= h1; y += step) {
    const [, sy] = w2s(0, y, vp, cw, ch);
    ctx.moveTo(0, sy);
    ctx.lineTo(cw, sy);
  }
  ctx.stroke();

  // 主网格(每5米)
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  for (let x = Math.floor(w0 / 5) * 5; x <= w1; x += 5) {
    const [sx] = w2s(x, 0, vp, cw, ch);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, ch);
  }
  for (let y = Math.floor(h0 / 5) * 5; y <= h1; y += 5) {
    const [, sy] = w2s(0, y, vp, cw, ch);
    ctx.moveTo(0, sy);
    ctx.lineTo(cw, sy);
  }
  ctx.stroke();
}

function drawAxis(ctx: CanvasRenderingContext2D, vp: Viewport, cw: number, ch: number) {
  const [ox, oy] = w2s(0, 0, vp, cw, ch);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(cw, oy);
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, ch);
  ctx.stroke();
  // 箭头
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo(cw - 10, oy);
  ctx.lineTo(cw - 16, oy - 4);
  ctx.lineTo(cw - 16, oy + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ox, 10);
  ctx.lineTo(ox - 4, 16);
  ctx.lineTo(ox + 4, 16);
  ctx.fill();
  // 标签
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "12px sans-serif";
  ctx.fillText("x", cw - 14, oy - 6);
  ctx.fillText("y", ox + 6, 14);

  // 刻度数字(自适应步长)
  const step = vp.scale > 35 ? 1 : vp.scale > 18 ? 2 : vp.scale > 8 ? 5 : 10;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const [w0] = s2w(0, 0, vp, cw, ch);
  const [w1] = s2w(cw, 0, vp, cw, ch);
  for (let x = Math.ceil(w0 / step) * step; x <= w1; x += step) {
    if (Math.abs(x) < 0.01) continue;
    const [sx] = w2s(x, 0, vp, cw, ch);
    if (sx < 14 || sx > cw - 14) continue;
    ctx.beginPath();
    ctx.moveTo(sx, oy - 3);
    ctx.lineTo(sx, oy + 3);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.fillText(String(Math.round(x)), sx, oy + 4);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const [, h0] = s2w(0, ch, vp, cw, ch);
  const [, h1] = s2w(0, 0, vp, cw, ch);
  for (let y = Math.ceil(h0 / step) * step; y <= h1; y += step) {
    if (Math.abs(y) < 0.01) continue;
    const [, sy] = w2s(0, y, vp, cw, ch);
    if (sy < 10 || sy > ch - 10) continue;
    ctx.beginPath();
    ctx.moveTo(ox - 3, sy);
    ctx.lineTo(ox + 3, sy);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.stroke();
    ctx.fillText(String(Math.round(y)), ox - 5, sy);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // 原点 O
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("O", ox + 4, oy + 12);
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  o: PhysicsObject,
  vp: Viewport,
  cw: number,
  ch: number,
  opts: RenderOpts,
  allObjects: PhysicsObject[]
) {
  const selected = opts.selectedId === o.id;
  switch (o.type) {
    case "mass":
      drawMass(ctx, o, vp, cw, ch, selected, opts.isSimulating);
      break;
    case "spring":
      drawSpring(ctx, o, vp, cw, ch, selected, allObjects);
      break;
    case "ground":
      drawGround(ctx, o, vp, cw, ch, selected);
      break;
    case "conveyor":
      drawConveyor(ctx, o, vp, cw, ch, selected);
      break;
    case "tether":
      drawTether(ctx, o, vp, cw, ch, selected, allObjects);
      break;
    case "efield":
      drawEField(ctx, o, vp, cw, ch, selected);
      break;
    case "bfield":
      drawBField(ctx, o, vp, cw, ch, selected);
      break;
    case "source":
      drawSource(ctx, o, vp, cw, ch, selected);
      break;
    case "point":
      drawPoint(ctx, o, vp, cw, ch, selected);
      break;
    case "line":
      drawLine(ctx, o, vp, cw, ch, selected);
      break;
    case "text":
      drawText(ctx, o, vp, cw, ch, selected);
      break;
  }
}

function drawMass(
  ctx: CanvasRenderingContext2D,
  m: MassObj,
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean,
  isSim: boolean
) {
  const [sx, sy] = w2s(m.x, m.y, vp, cw, ch);
  const r = m.radius * vp.scale;
  // 轨迹
  if (isSim && m.trail.length > 1) {
    ctx.strokeStyle = m.color + "66";
    ctx.lineWidth = 2;
    ctx.beginPath();
    m.trail.forEach((p, i) => {
      const [tx, ty] = w2s(p.x, p.y, vp, cw, ch);
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    });
    ctx.stroke();
  }
  // 阴影
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.arc(sx + 2, sy + 2, r, 0, Math.PI * 2);
  ctx.fill();
  // 主体
  const grad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
  grad.addColorStop(0, lighten(m.color, 0.4));
  grad.addColorStop(1, m.color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  // 边框
  ctx.strokeStyle = selected ? "#fff" : "rgba(0,0,0,0.4)";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.stroke();
  // m标识
  if (m.showLabel) {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(10, r * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", sx, sy);
  }
  // 速度箭头
  if (m.showVelocity && (Math.abs(m.vx) > 0.01 || Math.abs(m.vy) > 0.01)) {
    drawArrow(ctx, sx, sy, sx + m.vx * vp.scale * 0.3, sy - m.vy * vp.scale * 0.3, "#f59e0b", 2);
  }
}

function drawSpring(
  ctx: CanvasRenderingContext2D,
  sp: SpringObj,
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean,
  allObjects: PhysicsObject[]
) {
  // 端点位置(实时跟随质点)
  let ax = sp.ax, ay = sp.ay, bx = sp.bx, by = sp.by;
  if (sp.aId) {
    const m = allObjects.find((o) => o.id === sp.aId && o.type === "mass") as MassObj | undefined;
    if (m) { ax = m.x; ay = m.y; }
  }
  if (sp.bId) {
    const m = allObjects.find((o) => o.id === sp.bId && o.type === "mass") as MassObj | undefined;
    if (m) { bx = m.x; by = m.y; }
  }
  const [sx1, sy1] = w2s(ax, ay, vp, cw, ch);
  const [sx2, sy2] = w2s(bx, by, vp, cw, ch);
  ctx.strokeStyle = selected ? "#fff" : "#9ca3af";
  ctx.lineWidth = selected ? 2.5 : 1.8;
  drawSpringLine(ctx, sx1, sy1, sx2, sy2, sp.coils, sp.width * vp.scale);
  // 端点固定标记
  if (!sp.aId) drawAnchor(ctx, sx1, sy1);
  if (!sp.bId) drawAnchor(ctx, sx2, sy2);
}

function drawSpringLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  coils: number,
  amp: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // 垂直方向
  const py = ux;
  const headLen = Math.min(12, len * 0.15);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * headLen, y1 + uy * headLen);
  const segs = coils * 8;
  const coilLen = len - headLen * 2;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const cx = x1 + ux * (headLen + coilLen * t);
    const cy = y1 + uy * (headLen + coilLen * t);
    const off = Math.sin(t * Math.PI * 2 * coils) * amp;
    ctx.lineTo(cx + px * off, cy + py * off);
  }
  ctx.lineTo(x2 - ux * headLen, y2 - uy * headLen);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#6b7280";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 6);
  ctx.lineTo(x + 6, y - 6);
  ctx.moveTo(x + 6, y + 6);
  ctx.lineTo(x - 6, y - 6);
  ctx.stroke();
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  g: GroundObj,
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean
) {
  const [sx1, sy1] = w2s(g.x1, g.y1, vp, cw, ch);
  const [sx2, sy2] = w2s(g.x2, g.y2, vp, cw, ch);
  ctx.strokeStyle = selected ? "#fff" : "#d1d5db";
  ctx.lineWidth = selected ? 3 : 2.5;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();
  // 斜线纹理(地面下方)
  const dx = sx2 - sx1;
  const dy = sy2 - sy1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy; // 法向(指向地面下方,屏幕坐标)
  const ny = ux;
  ctx.strokeStyle = "rgba(209,213,219,0.6)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const step = 10;
  for (let t = 0; t <= len; t += step) {
    const cx = sx1 + ux * t;
    const cy = sy1 + uy * t;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + nx * 8, cy + ny * 8);
  }
  ctx.stroke();
  // 摩擦系数标注
  if (g.friction !== 0 && vp.scale > 20) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`μ=${g.friction.toFixed(2)}`, (sx1 + sx2) / 2 + nx * 16, (sy1 + sy2) / 2 + ny * 16);
  }
}

function drawConveyor(
  ctx: CanvasRenderingContext2D, c: ConveyorObj, vp: Viewport, cw: number, ch: number, selected: boolean
) {
  const [sx1, sy1] = w2s(c.x1, c.y1, vp, cw, ch);
  const [sx2, sy2] = w2s(c.x2, c.y2, vp, cw, ch);
  ctx.strokeStyle = selected ? "#fff" : "#6b7280";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
  const dx = sx2 - sx1, dy = sy2 - sy1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const steps = Math.max(1, Math.floor(len / 40));
  ctx.fillStyle = selected ? "#fff" : "#9ca3af";
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const cx = sx1 + dx * t, cy = sy1 + dy * t;
    ctx.beginPath();
    ctx.moveTo(cx + ux * 6, cy + uy * 6);
    ctx.lineTo(cx - ux * 4 - uy * 4, cy - uy * 4 + ux * 4);
    ctx.lineTo(cx - ux * 4 + uy * 4, cy - uy * 4 - ux * 4);
    ctx.fill();
  }
  if (vp.scale > 20) {
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`v=${c.velocity.toFixed(1)}`, (sx1 + sx2) / 2, (sy1 + sy2) / 2 - 8);
  }
}

function drawTether(
  ctx: CanvasRenderingContext2D, t: TetherObj, vp: Viewport, cw: number, ch: number, selected: boolean, allObjects: PhysicsObject[]
) {
  const [cx, cy] = w2s(t.cx, t.cy, vp, cw, ch);
  drawAnchor(ctx, cx, cy);
  let ex = t.cx, ey = t.cy;
  if (t.targetId) {
    const m = allObjects.find((o) => o.id === t.targetId && o.type === "mass") as MassObj | undefined;
    if (m) { ex = m.x; ey = m.y; }
  }
  const [sx, sy] = w2s(ex, ey, vp, cw, ch);
  ctx.strokeStyle = selected ? "#fff" : "#a8a29e";
  ctx.lineWidth = 1.8;
  if (!t.rigid) ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(168,162,158,0.22)";
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.arc(cx, cy, t.length * vp.scale, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawEField(
  ctx: CanvasRenderingContext2D, f: EFieldObj, vp: Viewport, cw: number, ch: number, selected: boolean
) {
  const [cx, cy] = w2s(f.x, f.y, vp, cw, ch);
  const w = f.w * vp.scale, h = f.h * vp.scale;
  ctx.fillStyle = "rgba(245,158,11,0.06)";
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = selected ? "#fff" : "rgba(245,158,11,0.5)";
  ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h); ctx.setLineDash([]);
  const mag = Math.hypot(f.ex, f.ey);
  if (mag > 1e-6) {
    const ux = f.ex / mag, uy = -f.ey / mag;
    const cols = Math.max(2, Math.floor(w / 55)), rows = Math.max(2, Math.floor(h / 55));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const px = cx - w / 2 + (i + 0.5) * w / cols, py = cy - h / 2 + (j + 0.5) * h / rows;
      drawArrow(ctx, px - ux * 9, py - uy * 9, px + ux * 9, py + uy * 9, "rgba(245,158,11,0.75)", 1.5);
    }
  }
  ctx.fillStyle = "rgba(245,158,11,0.95)"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("E", cx - w / 2 + 4, cy - h / 2 + 14);
}

function drawBField(
  ctx: CanvasRenderingContext2D, f: BFieldObj, vp: Viewport, cw: number, ch: number, selected: boolean
) {
  const [cx, cy] = w2s(f.x, f.y, vp, cw, ch);
  const w = f.w * vp.scale, h = f.h * vp.scale;
  const out = f.bz > 0;
  ctx.fillStyle = out ? "rgba(34,197,94,0.06)" : "rgba(59,130,246,0.06)";
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = selected ? "#fff" : "rgba(168,162,158,0.4)";
  ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h); ctx.setLineDash([]);
  const col = out ? "rgba(34,197,94,0.8)" : "rgba(59,130,246,0.8)";
  const cols = Math.max(2, Math.floor(w / 55)), rows = Math.max(2, Math.floor(h / 55));
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.3;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = cx - w / 2 + (i + 0.5) * w / cols, py = cy - h / 2 + (j + 0.5) * h / rows;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
    if (out) { ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.moveTo(px + 4, py - 4); ctx.lineTo(px - 4, py + 4); ctx.stroke(); }
  }
  ctx.fillStyle = col; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("B", cx - w / 2 + 4, cy - h / 2 + 14);
}

function drawSource(
  ctx: CanvasRenderingContext2D, s: SourceObj, vp: Viewport, cw: number, ch: number, selected: boolean
) {
  const [sx, sy] = w2s(s.x, s.y, vp, cw, ch);
  ctx.fillStyle = selected ? "#fff" : s.color;
  ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke();
  if (Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01) {
    drawArrow(ctx, sx, sy, sx + s.vx * vp.scale * 0.3, sy - s.vy * vp.scale * 0.3, s.color, 2);
  }
  ctx.strokeStyle = s.enabled === false ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}

function drawPoint(
  ctx: CanvasRenderingContext2D,
  o: { x: number; y: number },
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean
) {
  const [sx, sy] = w2s(o.x, o.y, vp, cw, ch);
  ctx.fillStyle = selected ? "#fff" : "#22c55e";
  ctx.beginPath();
  ctx.arc(sx, sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  o: { x1: number; y1: number; x2: number; y2: number },
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean
) {
  const [sx1, sy1] = w2s(o.x1, o.y1, vp, cw, ch);
  const [sx2, sy2] = w2s(o.x2, o.y2, vp, cw, ch);
  ctx.strokeStyle = selected ? "#fff" : "#22c55e";
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  o: { x: number; y: number; content: string; fontSize: number },
  vp: Viewport,
  cw: number,
  ch: number,
  selected: boolean
) {
  const [sx, sy] = w2s(o.x, o.y, vp, cw, ch);
  ctx.fillStyle = selected ? "#fff" : "#e6ebf2";
  ctx.font = `${o.fontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(o.content, sx, sy);
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  width: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // 箭头头部
  const ang = Math.atan2(dy, dx);
  const ah = 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ah * Math.cos(ang - 0.4), y2 - ah * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - ah * Math.cos(ang + 0.4), y2 - ah * Math.sin(ang + 0.4));
  ctx.fill();
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  drawing: { type: string; points: { x: number; y: number }[] },
  vp: Viewport,
  cw: number,
  ch: number
) {
  const pts = drawing.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = "rgba(61,139,255,0.7)";
  ctx.fillStyle = "rgba(61,139,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  if (drawing.type === "mass") {
    const [sx, sy] = w2s(pts[0].x, pts[0].y, vp, cw, ch);
    ctx.beginPath();
    ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.fill();
    if (pts.length > 1) {
      const [sx2, sy2] = w2s(pts[1].x, pts[1].y, vp, cw, ch);
      drawArrow(ctx, sx, sy, sx2, sy2, "#f59e0b", 2);
    }
  } else if (pts.length >= 2) {
    const [sx1, sy1] = w2s(pts[0].x, pts[0].y, vp, cw, ch);
    const [sx2, sy2] = w2s(pts[1].x, pts[1].y, vp, cw, ch);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  } else if (pts.length === 1) {
    const [sx, sy] = w2s(pts[0].x, pts[0].y, vp, cw, ch);
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.setLineDash([]);
}

function lighten(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + Math.round(255 * amt));
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + Math.round(255 * amt));
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + Math.round(255 * amt));
  return `rgb(${r},${g},${b})`;
}
