// ===== 物理世界：对象模型 + 积分器 + 碰撞 =====
import { V, clamp, uid, circleSeg, evalExpr, arcPoints } from './util.js';

export const GRAVITY_DEFAULT = { x: 0, y: -9.8 };

// 判断点是否在多边形内（射线法）
export function pointInPolygon(pt, poly) {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// 线段-线段交点（参数形式）返回 {t, u, pt} 或 null
function segIntersect(a1, a2, b1, b2) {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;
  if (t < -1e-9 || t > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
  const ct = Math.max(0, Math.min(1, t)), cu = Math.max(0, Math.min(1, u));
  return { t: ct, u: cu,
    pt: { x: a1.x + ct * dx1, y: a1.y + ct * dy1 } };
}

// 获取 splitLine 对象的所有线段
export function getSplitSegments(sl) {
  const segs = [];
  const { shape, x1, y1, x2, y2, cx, cy, r, rx, ry, rw, rh, a0, a1 } = sl;
  if (shape === 'line') {
    segs.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } });
  } else if (shape === 'arc' || shape === 'circle') {
    // 圆弧：支持 a0/a1 角度范围（弧度），默认完整圆
    const startA = a0 ?? 0;
    let endA = a1 ?? (2 * Math.PI);
    if (endA <= startA) endA += 2 * Math.PI; // 确保逆时针
    const N = Math.max(12, Math.ceil((endA - startA) / (Math.PI / 18)));
    for (let i = 0; i < N; i++) {
      const aa = startA + (endA - startA) * i / N;
      const ab = startA + (endA - startA) * (i + 1) / N;
      segs.push({
        p1: { x: cx + r * Math.cos(aa), y: cy + r * Math.sin(aa) },
        p2: { x: cx + r * Math.cos(ab), y: cy + r * Math.sin(ab) }
      });
    }
  } else if (shape === 'rect') {
    const x0 = rx, y0 = ry, x1r = rx + rw, y1r = ry + rh;
    segs.push({ p1: { x: x0, y: y0 }, p2: { x: x1r, y: y0 } });
    segs.push({ p1: { x: x1r, y: y0 }, p2: { x: x1r, y: y1r } });
    segs.push({ p1: { x: x1r, y: y1r }, p2: { x: x0, y: y1r } });
    segs.push({ p1: { x: x0, y: y1r }, p2: { x: x0, y: y0 } });
  }
  return segs;
}

// 搜索封闭多边形（简化版，适用于教学场景）
export function searchPolygons(splitLines) {
  if (!splitLines || splitLines.length === 0) return [];
  const allSegs = [];
  for (const sl of splitLines) {
    allSegs.push(...getSplitSegments(sl));
  }
  // 收集所有端点
  const verts = [];
  function addVert(pt) {
    for (const v of verts) {
      if (Math.hypot(v.x - pt.x, v.y - pt.y) < 1e-6) return v;
    }
    const v = { x: pt.x, y: pt.y };
    verts.push(v);
    return v;
  }
  for (const seg of allSegs) {
    addVert(seg.p1);
    addVert(seg.p2);
  }
  // 建立邻接表
  const adj = new Map();
  function vkey(v) { return `${v.x.toFixed(6)},${v.y.toFixed(6)}`; }
  for (const seg of allSegs) {
    const k1 = vkey(seg.p1), k2 = vkey(seg.p2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    if (!adj.get(k1).some(p => vkey(p) === k2)) adj.get(k1).push(seg.p2);
    if (!adj.get(k2).some(p => vkey(p) === k1)) adj.get(k2).push(seg.p1);
  }
  // 找环
  const visited = new Set();
  const polygons = [];
  for (const [k, neighbors] of adj) {
    for (const nb of neighbors) {
      const ek = `${k}->${vkey(nb)}`;
      if (visited.has(ek)) continue;
      const startK = k;
      let curK = k, nextPt = nb;
      const polyPts = [];
      const [sx, sy] = k.split(',').map(Number);
      polyPts.push({ x: sx, y: sy });
      let steps = 0;
      while (steps < 300) {
        const [cx, cy] = (curK === k ? k : vkey(nextPt)).split(',').map(Number);
        const ck = curK === k ? vkey(nextPt) : vkey(nextPt);
        polyPts.push({ x: cx, y: cy });
        if (ck === startK && polyPts.length > 4) {
          polygons.push({ pts: [...polyPts] });
          break;
        }
        visited.add(`${curK}->${ck}`);
        visited.add(`${ck}->${curK}`);
        const curVec = { x: cx - (curK === k ? sx : (curK.split(',')[0])), y: cy - (curK === k ? sy : (curK.split(',')[1])) };
        const nbs = adj.get(ck) || [];
        let bestPt = null, bestCross = -Infinity;
        for (const cand of nbs) {
          if (vkey(cand) === curK) continue;
          const candVec = { x: cand.x - cx, y: cand.y - cy };
          const cross = curVec.x * candVec.y - curVec.y * candVec.x;
          if (cross > bestCross - 1e-9) { bestCross = cross; bestPt = cand; }
        }
        if (!bestPt) break;
        curK = ck;
        nextPt = bestPt;
        steps++;
      }
    }
  }
  // 过滤退化多边形
  return polygons.filter(p => {
    if (p.pts.length < 4) return false;
    let area = 0;
    for (let i = 0; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1];
      area += a.x * b.y - b.x * a.y;
    }
    area /= 2;
    return Math.abs(area) > 1e-6;
  });
}

export function findPolygonContainingPoint(polygons, pt) {
  for (let i = polygons.length - 1; i >= 0; i--) {
    if (pointInPolygon(pt, polygons[i].pts)) return i;
  }
  return -1;
}

// 创建各类对象
export function make(type, opts = {}) {
  const base = { id: uid(type), type, name: opts.name, color: opts.color, visible: true };
  switch (type) {
    case 'particle':
      return Object.assign(base, {
        name: opts.name || '质点',
        x: opts.x ?? 0, y: opts.y ?? 0,
        vx: opts.vx ?? 0, vy: opts.vy ?? 0,
        ax: 0, ay: 0, mass: opts.mass ?? 1, charge: opts.charge ?? 0,
        radius: opts.radius ?? 0.3, shape: opts.shape || 'ball',
        w: opts.w ?? 0.6, h: opts.h ?? 0.6, color: opts.color || '#3b82f6',
        fixed: !!opts.fixed, restitution: opts.restitution ?? 0.6,
        friction: opts.friction ?? 0.2, showVel: true,
        trail: [], _fx: 0, _fy: 0,
        showForces: false,
        Fg: { x: 0, y: 0 }, Fe: { x: 0, y: 0 },
        Fm: { x: 0, y: 0 }, Fn: { x: 0, y: 0 },
        Ff: { x: 0, y: 0 }, Fs: { x: 0, y: 0 }, Ft: { x: 0, y: 0 },
      });
    case 'ground':
      return Object.assign(base, {
        name: opts.name || '地面', color: opts.color || '#475569',
        points: opts.points || [], friction: opts.friction ?? 0.3,
        restitution: opts.restitution ?? 0.6, thickness: 0.12,
      });
    case 'arcground':
      return Object.assign(base, {
        name: opts.name || '圆弧地面', color: opts.color || '#475569',
        cx: opts.cx ?? 0, cy: opts.cy ?? 0, r: opts.r ?? 3,
        a0: opts.a0 ?? Math.PI, a1: opts.a1 ?? 0,
        friction: opts.friction ?? 0.3, restitution: opts.restitution ?? 0.6,
        thickness: 0.12, _seg: 48,
      });
    case 'conveyor':
      return Object.assign(base, {
        name: opts.name || '传送带', color: opts.color || '#0ea5e9',
        points: opts.points || [], friction: opts.friction ?? 0.4,
        restitution: opts.restitution ?? 0.2, velocity: opts.velocity ?? 2,
        thickness: 0.18,
      });
    case 'spring':
      return Object.assign(base, {
        name: opts.name || '弹簧', color: opts.color || '#64748b',
        aId: opts.aId ?? null, a: opts.a || { x: 0, y: 0 },
        bId: opts.bId ?? null, b: opts.b || { x: 1, y: 0 },
        k: opts.k ?? 20, damping: opts.damping ?? 0.5,
        L0: opts.L0 ?? 1, coils: opts.coils ?? 8, radius: opts.radius ?? 0.18,
      });
    case 'rope':
      return Object.assign(base, {
        name: opts.name || '摆线', color: opts.color || '#64748b',
        aId: opts.aId ?? null, anchor: opts.anchor || { x: 0, y: 3 },
        length: opts.length ?? 2, damping: opts.damping ?? 0.0,
      });
    case 'emfield':
      return Object.assign(base, {
        name: opts.name || '电磁场', color: opts.color || '#a855f7',
        shape: opts.shape || 'rect',
        x: opts.x ?? -3, y: opts.y ?? -3, w: opts.w ?? 6, h: opts.h ?? 6,
        Ex: opts.Ex ?? 0, Ey: opts.Ey ?? 0, B: opts.B ?? 0,
        ac: !!opts.ac, freq: opts.freq ?? 1, phase: 0,
        colorE: opts.colorE || '#ef4444', colorB: opts.colorB || '#3b82f6',
      });
    case 'source':
      return Object.assign(base, {
        name: opts.name || '粒子源', color: opts.color || '#f97316',
        x: opts.x ?? -3, y: opts.y ?? 0, angle: opts.angle ?? 0,
        speed: opts.speed ?? 3, rate: opts.rate ?? 4, charge: opts.charge ?? 0,
        mass: opts.mass ?? 1, radius: opts.radius ?? 0.25, on: opts.on !== false,
        _acc: 0,
      });
    case 'text':
      return Object.assign(base, {
        name: opts.name || '文本', color: opts.color || '#111827',
        x: opts.x ?? 0, y: opts.y ?? 0, text: opts.text || '文本',
        expr: opts.expr || '', size: opts.size ?? 16, dynamic: !!opts.expr,
      });
    case 'graph':
      return Object.assign(base, {
        name: opts.name || '函数图像', color: opts.color || '#3b82f6',
        x: opts.x ?? 3, y: opts.y ?? 2, w: opts.w ?? 3, h: opts.h ?? 2,
        quantity: opts.quantity || 'v', targetId: opts.targetId ?? null,
        axisT: opts.axisT ?? 5, data: [],
      });
    case 'splitLine':
      return Object.assign(base, {
        name: opts.name || '场分割线', color: opts.color || '#f59e0b',
        shape: opts.shape || 'line',
        x1: opts.x1 ?? 0, y1: opts.y1 ?? 0,
        x2: opts.x2 ?? 1, y2: opts.y2 ?? 1,
        cx: opts.cx ?? 0, cy: opts.cy ?? 0, r: opts.r ?? 2,
        a0: opts.a0 ?? 0, a1: opts.a1 ?? (2 * Math.PI),
        rx: opts.rx ?? -2, ry: opts.ry ?? -2,
        rw: opts.rw ?? 4, rh: opts.rh ?? 4,
      });
    case 'fieldPoly':
      return Object.assign(base, {
        name: opts.name || '场', color: opts.color || '#a855f7',
        fieldType: opts.fieldType || 'efield',
        polygon: opts.polygon || [],
        Ex: opts.Ex ?? 0, Ey: opts.Ey ?? 0, B: opts.B ?? 0,
        ac: !!opts.ac, freq: opts.freq ?? 1, phase: 0,
        colorE: opts.colorE || '#ef4444', colorB: opts.colorB || '#3b82f6',
      });
    case 'pipe':
      return Object.assign(base, {
        name: opts.name || '圆管', color: opts.color || '#64748b',
        cx: opts.cx ?? 0, cy: opts.cy ?? 0, r: opts.r ?? 1.5,
        a0: opts.a0 ?? 0, a1: opts.a1 ?? Math.PI * 2,
        innerR: opts.innerR ?? 1.2,
        friction: opts.friction ?? 0.2, restitution: opts.restitution ?? 0.5,
        thickness: 0.10, _seg: 32,
      });
    case 'screen':
      return Object.assign(base, {
        name: opts.name || '荧光屏', color: opts.color || '#22c55e',
        x: opts.x ?? 3, y: opts.y ?? -2, w: opts.w ?? 0.15, h: opts.h ?? 4,
        hits: [], maxHits: 200, fadeTime: 3,
      });
    case 'helppoint':
      return Object.assign(base, {
        name: opts.name || '辅助点', color: opts.color || '#f59e0b',
        x: opts.x ?? 0, y: opts.y ?? 0,
        radius: opts.radius ?? 0.12, text: opts.text || '', size: opts.size ?? 11,
        shape: opts.shape || 'circle',
      });
    case 'helpline':
      return Object.assign(base, {
        name: opts.name || '辅助线', color: opts.color || '#f59e0b',
        ax: opts.ax ?? 0, ay: opts.ay ?? 0, bx: opts.bx ?? 1, by: opts.by ?? 0,
        text: opts.text || '', size: opts.size ?? 11,
        style: opts.style || 'solid', arrow: !!opts.arrow,
      });
    case 'interpsource':
      return Object.assign(base, {
        name: opts.name || '插值粒子源', color: opts.color || '#f97316',
        ax: opts.ax ?? -3, ay: opts.ay ?? 0, bx: opts.bx ?? -3, by: opts.by ?? 0,
        angle: opts.angle ?? 0, speed: opts.speed ?? 3, rate: opts.rate ?? 4,
        count: opts.count ?? 5,
        charge: opts.charge ?? 0, mass: opts.mass ?? 1, radius: opts.radius ?? 0.25,
        on: opts.on !== false, _acc: 0, _idx: 0,
      });
    case 'formulasource':
      return Object.assign(base, {
        name: opts.name || '公式粒子源', color: opts.color || '#ec4899',
        x: opts.x ?? -3, y: opts.y ?? 0,
        vxExpr: opts.vxExpr || '3*cos(t*2)',
        vyExpr: opts.vyExpr || '3*sin(t*2)',
        rate: opts.rate ?? 2, charge: opts.charge ?? 0,
        mass: opts.mass ?? 1, radius: opts.radius ?? 0.25,
        on: opts.on !== false, _acc: 0, _t: 0,
      });
    default: return base;
  }
}

export function World() {
  this.objects = [];
  this.gravity = { ...GRAVITY_DEFAULT };
  this.time = 0;
  this.steps = 0;
  this.airDrag = 0.0;
  this.substeps = 8;
  this.restitutionGlobal = 1;
  this.collideSound = false;
  this.trailMax = 400;
  this.onCollide = null;
  this.sourceParticles = [];
  // 场分割线 + 多边形场
  this.splitLines = [];
  this.polygons = [];
  this._polygonsDirty = true;
}

World.prototype.get = function(id) { return this.objects.find(o => o.id === id); };
World.prototype.add = function(o) { this.objects.push(o); return o; };
World.prototype.remove = function(id) { this.objects = this.objects.filter(o => o.id !== id); };
World.prototype.clear = function() { this.objects = []; this.time = 0; this.steps = 0; };

World.prototype.surfaces = function() {
  const out = [];
  for (const o of this.objects) {
    if (o.type === 'ground' || o.type === 'conveyor') {
      if (o.points.length >= 2) out.push({ obj: o, pts: o.points });
    } else if (o.type === 'arcground') {
      out.push({ obj: o, pts: arcPoints(o) });
    }
  }
  return out;
};

World.prototype.inField = function(p, f) {
  if (f.shape === 'rect') {
    return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
  }
  const dx = p.x - (f.x + f.w / 2), dy = p.y - (f.y + f.h / 2);
  return Math.hypot(dx, dy) <= Math.min(f.w, f.h) / 2;
};

World.prototype.fieldAt = function(f, p, v, t) {
  let Ex = f.Ex, Ey = f.Ey, B = f.B;
  if (f.ac) {
    const s = Math.sin(f.freq * t * 2 * Math.PI + f.phase);
    Ex = f.Ex * s; Ey = f.Ey * s; B = f.B * s;
  }
  return { Ex, Ey, B };
};

World.prototype._fieldPolyAt = function(f, t) {
  let Ex = f.Ex, Ey = f.Ey, B = f.B;
  if (f.ac) {
    const s = Math.sin(f.freq * t * 2 * Math.PI + (f.phase || 0));
    Ex = f.Ex * s; Ey = f.Ey * s; B = f.B * s;
  }
  return { Ex, Ey, B };
};

World.prototype.rebuildPolygons = function() {
  const splitLines = this.objects.filter(o => o.type === 'splitLine');
  this.polygons = searchPolygons(splitLines);
  this._polygonsDirty = false;
  return this.polygons;
};

// particles 作为 getter 属性，支持 world.particles.forEach 等数组操作
Object.defineProperty(World.prototype, 'particles', {
  get() { return this.objects.filter(o => o.type === 'particle'); }
});

World.prototype.step = function(dt, mode = 'step') {
  const h = dt / this.substeps;
  for (let s = 0; s < this.substeps; s++) this.substep(h, mode);
  this.time += dt;
  this.steps += this.substeps;
  for (const p of this.particles) {
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > this.trailMax) p.trail.shift();
  }
  for (const g of this.objects.filter(o => o.type === 'graph')) {
    const tg = g.targetId ? this.get(g.targetId) : this.particles[0];
    if (tg) {
      const q = g.quantity;
      let val = 0;
      if (q === 's') val = Math.hypot(tg.x, tg.y);
      else if (q === 'x') val = tg.x;
      else if (q === 'y') val = tg.y;
      else if (q === 'v') val = Math.hypot(tg.vx, tg.vy);
      else if (q === 'vx') val = tg.vx;
      else if (q === 'vy') val = tg.vy;
      else if (q === 'a') val = Math.hypot(tg.ax, tg.ay);
      g.data.push({ t: this.time, v: val });
      if (g.data.length > 1200) g.data.shift();
    }
  }
};

World.prototype.substep = function(h, mode) {
  const parts = this.particles.concat(this.sourceParticles);
  const surfs = this.surfaces();
  // 1) 清零力
  for (const p of parts) {
    p._fx = 0; p._fy = 0; p.ax = 0; p.ay = 0;
    if (p.Fg) { p.Fg.x = 0; p.Fg.y = 0; }
    if (p.Fs) { p.Fs.x = 0; p.Fs.y = 0; }
    if (p.Fe) { p.Fe.x = 0; p.Fe.y = 0; }
    if (p.Fm) { p.Fm.x = 0; p.Fm.y = 0; }
    if (p.Fn) { p.Fn.x = 0; p.Fn.y = 0; }
    if (p.Ff) { p.Ff.x = 0; p.Ff.y = 0; }
    if (p.Ft) { p.Ft.x = 0; p.Ft.y = 0; }
  }
  // 2) 重力
  for (const p of parts) {
    if (p.fixed) continue;
    const gx = this.gravity.x * p.mass, gy = this.gravity.y * p.mass;
    p._fx += gx; p._fy += gy;
    if (p.Fg) { p.Fg.x += gx; p.Fg.y += gy; }
  }
  // 3) 电磁场（矩形场 + 多边形场）
  for (const f of this.objects.filter(o => o.type === 'emfield')) {
    for (const p of parts) {
      if (p.charge === 0 || p.fixed) continue;
      if (!this.inField(p, f)) continue;
      const { Ex, Ey, B } = this.fieldAt(f, p, null, this.time + h);
      const fex = p.charge * Ex, fey = p.charge * Ey;
      const fmx = p.charge * p.vy * B, fmy = -p.charge * p.vx * B;
      p._fx += fex + fmx; p._fy += fey + fmy;
      if (p.Fe) { p.Fe.x += fex; p.Fe.y += fey; }
      if (p.Fm) { p.Fm.x += fmx; p.Fm.y += fmy; }
    }
  }
  for (const f of this.objects.filter(o => o.type === 'fieldPoly')) {
    if (!f.polygon || f.polygon.length < 3) continue;
    const { Ex, Ey, B } = this._fieldPolyAt(f, this.time + h);
    for (const p of parts) {
      if (p.charge === 0 || p.fixed) continue;
      if (!pointInPolygon(p, f.polygon)) continue;
      const fex = p.charge * Ex, fey = p.charge * Ey;
      const fmx = p.charge * p.vy * B, fmy = -p.charge * p.vx * B;
      p._fx += fex + fmx; p._fy += fey + fmy;
      if (p.Fe) { p.Fe.x += fex; p.Fe.y += fey; }
      if (p.Fm) { p.Fm.x += fmx; p.Fm.y += fmy; }
    }
  }
  // 4) 弹簧
  for (const sp of this.objects.filter(o => o.type === 'spring')) {
    const A = sp.aId ? this.get(sp.aId) : null;
    const Bp = sp.bId ? this.get(sp.bId) : null;
    const pa = A ? A : sp.a;
    const pb = Bp ? Bp : sp.b;
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const L = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / L, uy = dy / L;
    const ext = L - sp.L0;
    const va = A ? { x: A.vx, y: A.vy } : { x: 0, y: 0 };
    const vb = Bp ? { x: Bp.vx, y: Bp.vy } : { x: 0, y: 0 };
    const vrel = (vb.x - va.x) * ux + (vb.y - va.y) * uy;
    const F = sp.k * ext + sp.damping * vrel;
    const fx = F * ux, fy = F * uy;
    if (A && !A.fixed) { A._fx += fx; A._fy += fy; if (A.Fs) { A.Fs.x += fx; A.Fs.y += fy; } }
    if (Bp && !Bp.fixed) { Bp._fx -= fx; Bp._fy -= fy; if (Bp.Fs) { Bp.Fs.x -= fx; Bp.Fs.y -= fy; } }
  }
  // 5) 摆线
  for (const r of this.objects.filter(o => o.type === 'rope')) {
    const A = r.aId ? this.get(r.aId) : null;
    if (!A || A.fixed) continue;
    const dx = A.x - r.anchor.x, dy = A.y - r.anchor.y;
    const L = Math.hypot(dx, dy) || 1e-6;
    if (L > r.length) {
      const ux = dx / L, uy = dy / L;
      const over = L - r.length;
      A.x -= ux * over; A.y -= uy * over;
      const vr = A.vx * ux + A.vy * uy;
      if (vr > 0) { A.vx -= vr * ux * (1 + r.damping); A.vy -= vr * uy * (1 + r.damping); }
    }
  }
  // 6) 积分（半隐式 Euler）
  for (const p of parts) {
    if (p.fixed) { p.vx = 0; p.vy = 0; continue; }
    p.ax = p._fx / p.mass; p.ay = p._fy / p.mass;
    if (this.airDrag > 0) { p.ax -= this.airDrag * p.vx; p.ay -= this.airDrag * p.vy; }
    p.vx += p.ax * h; p.vy += p.ay * h;
    // 限制最大速度（防止数值爆炸）
    const maxV = 100;
    let spd = Math.hypot(p.vx, p.vy);
    if (spd > maxV) { p.vx *= maxV / spd; p.vy *= maxV / spd; }
    p.x += p.vx * h; p.y += p.vy * h;
  }
  // 7) 碰撞（迭代解决，防止穿透）
  for (let iter = 0; iter < 3; iter++) {
    let anyHit = false;
    for (const p of parts) {
      if (p.fixed) continue;
      for (const s of surfs) {
        const pts = s.pts;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const c = circleSeg(p, p.radius, a, b);
          if (c.hit) {
            anyHit = true;
            // 推出（沿法线推出）
            const n = c.normal;
            const push = Math.max(c.penetration, 0.0001);
            p.x += n.x * push;
            p.y += n.y * push;
            // 速度投影：法线方向分量 velNormal
            const velNormal = p.vx * n.x + p.vy * n.y;
            if (velNormal < 0) {
              const e = (s.obj.restitution ?? 0.5) * this.restitutionGlobal;
              const vnNew = -e * velNormal;
              const tx = -n.y, ty = n.x;
              let vt = p.vx * tx + p.vy * ty;
              // 摩擦力（减少切向速度）
              if (s.obj.type === 'conveyor') {
                const dir = Math.sign((b.x - a.x) * tx + (b.y - a.y) * ty);
                const target = s.obj.velocity * dir;
                const mu = s.obj.friction ?? 0.4;
                const dvt = target - vt;
                const maxD = Math.abs(velNormal) * mu * (1 + e) + 0.02;
                const fd = clamp(dvt, -maxD, maxD);
                vt += fd;
              } else {
                const mu = s.obj.friction ?? 0.3;
                const fric = clamp(vt * mu, -Math.abs(vt), Math.abs(vt));
                vt -= fric * 0.5;
              }
              p.vx = vt * tx + vnNew * n.x;
              p.vy = vt * ty + vnNew * n.y;
            }
          }
        }
      }
    }
    if (!anyHit) break;  // 没有碰撞就提前退出
  }
  // 8) 粒子-粒子碰撞
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (d < min && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        const over = (min - d) / 2;
        if (!a.fixed) { a.x -= nx * over; a.y -= ny * over; }
        if (!b.fixed) { b.x += nx * over; b.y += ny * over; }
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const velNormal = rvx * nx + rvy * ny;
        if (velNormal < 0) {
          const e = Math.min(a.restitution, b.restitution) * this.restitutionGlobal;
          const im = (-(1 + e) * velNormal) / ((a.fixed ? 0 : 1 / a.mass) + (b.fixed ? 0 : 1 / b.mass));
          const imA = a.fixed ? 0 : im / a.mass;
          const imB = b.fixed ? 0 : im / b.mass;
          if (!a.fixed) { a.vx -= imA * nx; a.vy -= imA * ny; }
          if (!b.fixed) { b.vx += imB * nx; b.vy += imB * ny; }
          if (this.onCollide) this.onCollide(a, b, { normal: { x: nx, y: ny } });
        }
      }
    }
  }
  // 9) 圆管碰撞
  for (const p of parts) {
    if (p.fixed) continue;
    for (const pipe of this.objects.filter(o => o.type === 'pipe')) {
      const dx = p.x - pipe.cx, dy = p.y - pipe.cy;
      const dist = Math.hypot(dx, dy);
      if (dist > pipe.r - p.radius && dist < pipe.r + p.radius) {
        const nx = dx / dist, ny = dy / dist;
        const pen = (pipe.r - dist) + p.radius;
        if (pen > 0) {
          p.x += nx * pen; p.y += ny * pen;
          const velNormal = -(p.vx * nx + p.vy * ny);
          if (velNormal > 0) {
            const e = (pipe.restitution ?? 0.5) * this.restitutionGlobal;
            const vnNew = -e * velNormal;
            const tx = -ny, ty = nx;
            let vt = p.vx * tx + p.vy * ty;
            const mu = pipe.friction ?? 0.2;
            const fric = clamp(vt * mu, -Math.abs(vt), Math.abs(vt));
            vt -= fric * 0.5;
            p.vx = vt * tx - vnNew * nx;
            p.vy = vt * ty - vnNew * ny;
          }
        }
      }
      if (dist < pipe.innerR + p.radius && dist > pipe.innerR - p.radius && dist > 1e-6) {
        const nx = dx / dist, ny = dy / dist;
        const pen = (dist - pipe.innerR) + p.radius;
        if (pen > 0) {
          p.x -= nx * pen; p.y -= ny * pen;
          const velNormal = p.vx * nx + p.vy * ny;
          if (velNormal > 0) {
            const e = (pipe.restitution ?? 0.5) * this.restitutionGlobal;
            const vnNew = -e * velNormal;
            const tx = -ny, ty = nx;
            let vt = p.vx * tx + p.vy * ty;
            const mu = pipe.friction ?? 0.2;
            const fric = clamp(vt * mu, -Math.abs(vt), Math.abs(vt));
            vt -= fric * 0.5;
            p.vx = vt * tx + vnNew * nx;
            p.vy = vt * ty + vnNew * ny;
          }
        }
      }
    }
  }
  // 10) 荧光屏
  for (const scr of this.objects.filter(o => o.type === 'screen')) {
    if (!scr.visible) continue;
    for (const p of parts) {
      if (p.x >= scr.x && p.x <= scr.x + scr.w && p.y >= scr.y && p.y <= scr.y + scr.h) {
        const lastHit = scr.hits[scr.hits.length - 1];
        if (!lastHit || Math.abs(p.x - lastHit.x) > 0.05 || Math.abs(p.y - lastHit.y) > 0.05 || (this.time - lastHit.t) > 0.02) {
          scr.hits.push({ x: p.x, y: p.y, t: this.time, color: p.color, radius: p.radius });
          if (scr.hits.length > scr.maxHits) scr.hits.shift();
        }
      }
    }
  }
};

World.prototype.emitSources = function(dt) {
  for (const s of this.objects.filter(o => o.type === 'source' && o.on)) {
    s._acc += dt * s.rate;
    while (s._acc >= 1) {
      s._acc -= 1;
      const p = make('particle', {
        x: s.x, y: s.y,
        vx: Math.cos(s.angle) * s.speed, vy: Math.sin(s.angle) * s.speed,
        mass: s.mass, charge: s.charge, radius: s.radius,
        color: s.color, name: '发射粒子',
      });
      this.sourceParticles.push(p);
      if (this.sourceParticles.length > 200) this.sourceParticles.shift();
    }
  }
  for (const s of this.objects.filter(o => o.type === 'interpsource' && o.on)) {
    s._acc += dt * s.rate;
    while (s._acc >= 1) {
      s._acc -= 1;
      const idx = s._idx % (s.count || 1);
      s._idx++;
      const fx = s.ax + (s.bx - s.ax) * (idx / Math.max(1, s.count - 1));
      const fy = s.ay + (s.by - s.ay) * (idx / Math.max(1, s.count - 1));
      const p = make('particle', {
        x: fx, y: fy,
        vx: Math.cos(s.angle) * s.speed, vy: Math.sin(s.angle) * s.speed,
        mass: s.mass, charge: s.charge, radius: s.radius,
        color: s.color, name: '插值发射',
      });
      this.sourceParticles.push(p);
      if (this.sourceParticles.length > 300) this.sourceParticles.shift();
    }
  }
  for (const s of this.objects.filter(o => o.type === 'formulasource' && o.on)) {
    s._acc += dt * s.rate;
    while (s._acc >= 1) {
      s._acc -= 1;
      s._t += 1 / s.rate;
      const scope = { t: s._t, pi: Math.PI };
      const vxRaw = evalExpr(s.vxExpr, scope);
      const vyRaw = evalExpr(s.vyExpr, scope);
      const vx = isFinite(vxRaw) ? vxRaw : s.speed;
      const vy = isFinite(vyRaw) ? vyRaw : 0;
      const p = make('particle', {
        x: s.x, y: s.y,
        vx: isFinite(vx) ? vx : s.speed, vy: isFinite(vy) ? vy : 0,
        mass: s.mass, charge: s.charge, radius: s.radius,
        color: s.color, name: '公式发射',
      });
      this.sourceParticles.push(p);
      if (this.sourceParticles.length > 200) this.sourceParticles.shift();
    }
  }
};

World.prototype.evalDynamic = function(text, scope) {
  return evalExpr(text, scope);
};

