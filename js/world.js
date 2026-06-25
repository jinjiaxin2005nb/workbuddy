// ===== 物理世界：对象模型 + 积分器 + 碰撞 =====
import { V, clamp, uid, circleSeg, evalExpr, arcPoints } from './util.js';

export const GRAVITY_DEFAULT = { x: 0, y: -9.8 };

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
        // 受力分析分量
        Fg: { x: 0, y: 0 },  // 重力
        Fs: { x: 0, y: 0 },  // 弹力
        Fe: { x: 0, y: 0 },  // 电场力
        Fm: { x: 0, y: 0 },  // 磁场力(洛伦兹)
        Fn: { x: 0, y: 0 },  // 支持力/法向
        Ff: { x: 0, y: 0 },  // 摩擦力
        Ft: { x: 0, y: 0 },  // 张力(绳)
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
        a0: opts.a0 ?? Math.PI, a1: opts.a1 ?? 0, // 弧起止角
        friction: opts.friction ?? 0.3, restitution: opts.restitution ?? 0.6,
        thickness: 0.12, _seg: 24,
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
    // ===== V2 新增对象类型 =====
    case 'pipe':
      // 圆管：圆形管道，粒子可从内部穿过，碰撞时法向指向圆心
      return Object.assign(base, {
        name: opts.name || '圆管', color: opts.color || '#64748b',
        cx: opts.cx ?? 0, cy: opts.cy ?? 0, r: opts.r ?? 1.5,
        a0: opts.a0 ?? 0, a1: opts.a1 ?? Math.PI * 2, // 圆管起止角（默认整圆）
        innerR: opts.innerR ?? 1.2, // 内半径（管壁厚度）
        friction: opts.friction ?? 0.2, restitution: opts.restitution ?? 0.5,
        thickness: 0.10, _seg: 32,
      });
    case 'screen':
      // 荧光屏：检测粒子穿过位置并显示亮点
      return Object.assign(base, {
        name: opts.name || '荧光屏', color: opts.color || '#22c55e',
        x: opts.x ?? 3, y: opts.y ?? -2, w: opts.w ?? 0.15, h: opts.h ?? 4,
        hits: [], // 粒子击中记录 [{x,y,t,color,radius},...]
        maxHits: 200,
        fadeTime: 3, // 淡出时间(秒)
      });
    case 'helppoint':
      // 辅助点：标注用点，不参与物理计算
      return Object.assign(base, {
        name: opts.name || '辅助点', color: opts.color || '#f59e0b',
        x: opts.x ?? 0, y: opts.y ?? 0,
        radius: opts.radius ?? 0.12,
        text: opts.text || '', size: opts.size ?? 11,
        shape: opts.shape || 'circle', // circle / cross / diamond
      });
    case 'helpline':
      // 场分割线：用于定义场区域的边界线段（不参与物理计算，仅用于填充场检测）
      return Object.assign(base, {
        name: opts.name || '场分割线', color: opts.color || '#94a3b8',
        segments: opts.segments || [], // [{x1,y1,x2,y2},...] 分割线段数组
        closed: !!opts.closed, // 是否封闭
        fieldType: opts.fieldType || null, // 'E' | 'B' | 'ACE' | 'ACB' 待填充的场类型
        Ex: opts.Ex ?? 0, Ey: opts.Ey ?? 0, B: opts.B ?? 0,
        colorE: opts.colorE || '#ef4444', colorB: opts.colorB || '#3b82f6',
      });
    case 'helpline':
      // 辅助线：标注用线段，不参与物理计算
      return Object.assign(base, {
        name: opts.name || '辅助线', color: opts.color || '#f59e0b',
        ax: opts.ax ?? 0, ay: opts.ay ?? 0, bx: opts.bx ?? 1, by: opts.by ?? 0,
        text: opts.text || '', size: opts.size ?? 11,
        style: opts.style || 'solid', // solid / dashed / dotted
        arrow: !!opts.arrow, // 是否带箭头
      });
    case 'interpsource':
      // 插值粒子源：在两个端点之间插值发射粒子
      return Object.assign(base, {
        name: opts.name || '插值粒子源', color: opts.color || '#f97316',
        ax: opts.ax ?? -3, ay: opts.ay ?? 0, bx: opts.bx ?? -3, by: opts.by ?? 0,
        angle: opts.angle ?? 0, speed: opts.speed ?? 3, rate: opts.rate ?? 4,
        count: opts.count ?? 5, // 插值发射数量
        charge: opts.charge ?? 0, mass: opts.mass ?? 1, radius: opts.radius ?? 0.25,
        on: opts.on !== false, _acc: 0, _idx: 0,
      });
    case 'formulasource':
      // 公式粒子源：用公式定义粒子的初速度/位置
      return Object.assign(base, {
        name: opts.name || '公式粒子源', color: opts.color || '#ec4899',
        x: opts.x ?? -3, y: opts.y ?? 0,
        vxExpr: opts.vxExpr || '3*cos(t*2)', // 速度x公式（t为时间）
        vyExpr: opts.vyExpr || '3*sin(t*2)', // 速度y公式
        rate: opts.rate ?? 2, charge: opts.charge ?? 0,
        mass: opts.mass ?? 1, radius: opts.radius ?? 0.25,
        on: opts.on !== false, _acc: 0, _t: 0,
      });
    default: return base;
  }
}

export class World {
  constructor() {
    this.objects = [];
    this.gravity = { ...GRAVITY_DEFAULT };
    this.time = 0;
    this.steps = 0;
    this.airDrag = 0.0;
    this.substeps = 4;
    this.restitutionGlobal = 1;
    this.collideSound = false;
    this.trailMax = 400;
    this.onCollide = null;
    this.sourceParticles = []; // 粒子源产生的临时质点
  }

  get particles() { return this.objects.filter(o => o.type === 'particle'); }
  get(id) { return this.objects.find(o => o.id === id); }
  add(o) { this.objects.push(o); return o; }
  remove(id) { this.objects = this.objects.filter(o => o.id !== id); }
  clear() { this.objects = []; this.time = 0; this.steps = 0; }

  // 收集所有“地面类”折线（地面/圆弧/传送带）
  surfaces() {
    const out = [];
    for (const o of this.objects) {
      if (o.type === 'ground' || o.type === 'conveyor') {
        if (o.points.length >= 2) out.push({ obj: o, pts: o.points });
      } else if (o.type === 'arcground') {
        out.push({ obj: o, pts: arcPoints(o) });
      }
    }
    return out;
  }

  inField(p, f) {
    if (f.shape === 'rect') {
      return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
    }
    const dx = p.x - (f.x + f.w / 2), dy = p.y - (f.y + f.h / 2);
    return Math.hypot(dx, dy) <= Math.min(f.w, f.h) / 2;
  }

  fieldAt(f, p, v, t) {
    let Ex = f.Ex, Ey = f.Ey, B = f.B;
    if (f.ac) {
      const s = Math.sin(f.freq * t * 2 * Math.PI + f.phase);
      Ex = f.Ex * s; Ey = f.Ey * s; B = f.B * s;
    }
    return { Ex, Ey, B };
  }

  step(dt, mode = 'step') {
    const h = dt / this.substeps;
    for (let s = 0; s < this.substeps; s++) this.substep(h, mode);
    this.time += dt;
    this.steps += this.substeps;
    // 采样轨迹
    for (const p of this.particles) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > this.trailMax) p.trail.shift();
    }
    // 记录图像数据
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
  }

  substep(h, mode) {
    const parts = this.particles.concat(this.sourceParticles);
    const surfs = this.surfaces();

    // 1) 清零力 / 累加力
    for (const p of parts) {
      p._fx = 0; p._fy = 0; p.ax = 0; p.ay = 0;
      // 清零受力分析分量
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

    // 3) 电磁场（带电粒子）
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
      // 相对速度沿弹簧方向
      const va = A ? { x: A.vx, y: A.vy } : { x: 0, y: 0 };
      const vb = Bp ? { x: Bp.vx, y: Bp.vy } : { x: 0, y: 0 };
      const vrel = (vb.x - va.x) * ux + (vb.y - va.y) * uy;
      const F = sp.k * ext + sp.damping * vrel;
      const fx = F * ux, fy = F * uy;
      if (A && !A.fixed) {
        A._fx += fx; A._fy += fy;
        if (A.Fs) { A.Fs.x += fx; A.Fs.y += fy; }
      }
      if (Bp && !Bp.fixed) {
        Bp._fx -= fx; Bp._fy -= fy;
        if (Bp.Fs) { Bp.Fs.x -= fx; Bp.Fs.y -= fy; }
      }
    }

    // 5) 摆线/绳（约束力，柔性：仅在拉伸时起作用）
    for (const r of this.objects.filter(o => o.type === 'rope')) {
      const A = r.aId ? this.get(r.aId) : null;
      if (!A || A.fixed) continue;
      const dx = A.x - r.anchor.x, dy = A.y - r.anchor.y;
      const L = Math.hypot(dx, dy) || 1e-6;
      if (L > r.length) {
        const ux = dx / L, uy = dy / L;
        // 位置修正
        const over = L - r.length;
        A.x -= ux * over; A.y -= uy * over;
        // 消除径向速度（向外）
        const vr = A.vx * ux + A.vy * uy;
        if (vr > 0) {
          A.vx -= vr * ux * (1 + r.damping);
          A.vy -= vr * uy * (1 + r.damping);
        }
      }
    }

    // 6) 积分（半隐式 Euler）
    for (const p of parts) {
      if (p.fixed) { p.vx = 0; p.vy = 0; continue; }
      p.ax = p._fx / p.mass;
      p.ay = p._fy / p.mass;
      // 空气阻力
      if (this.airDrag > 0) {
        p.ax -= this.airDrag * p.vx;
        p.ay -= this.airDrag * p.vy;
      }
      p.vx += p.ax * h;
      p.vy += p.ay * h;
      p.x += p.vx * h;
      p.y += p.vy * h;
    }

    // 7) 碰撞：粒子-地面/传送带
    for (const p of parts) {
      if (p.fixed) continue;
      for (const s of surfs) {
        const pts = s.pts;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const c = circleSeg(p, p.radius, a, b);
          if (c.hit) {
            // 位置修正
            p.x += c.normal.x * c.penetration;
            p.y += c.normal.y * c.penetration;
            const vn = p.vx * c.normal.x + p.vy * c.normal.y;
            if (vn < 0) {
              const e = (s.obj.restitution ?? 0.5) * this.restitutionGlobal;
              // 法向冲量（= 支持力大小方向）
              const jn = -(1 + e) * vn; // 冲量
              // 反弹：应用弹性系数到法向速度
              const vnNew = -e * vn;
              // 切向摩擦
              const tx = -c.normal.y, ty = c.normal.x;
              let vt = p.vx * tx + p.vy * ty;
              let fricX = 0, fricY = 0;
              if (p.Ff) { p.Ff.x = 0; p.Ff.y = 0; } // reset
              // 传送带：目标切向速度
              if (s.obj.type === 'conveyor') {
                const dir = Math.sign((b.x - a.x) * tx + (b.y - a.y) * ty);
                const target = s.obj.velocity * dir;
                const mu = s.obj.friction ?? 0.4;
                const dvt = target - vt;
                const maxD = Math.abs(vn) * mu * (1 + e) + 0.02; // 摩擦冲量上限
                const fd = clamp(dvt, -maxD, maxD);
                vt += fd;
                fricX = (fd - dvt) * tx; fricY = (fd - dvt) * ty;
                if (p.Ff) { p.Ff.x += fricX; p.Ff.y += fricY; }
                // 用反弹后的法向速度重组（避免顺序错误）
                p.vx = vt * tx + vnNew * c.normal.x;
                p.vy = vt * ty + vnNew * c.normal.y;
              } else {
                const mu = s.obj.friction ?? 0.3;
                const fric = clamp(vt * mu, -Math.abs(vt), Math.abs(vt));
                const fdt = fric * 0.5;
                vt -= fdt;
                fricX = -fdt * tx; fricY = -fdt * ty;
                if (p.Ff) { p.Ff.x += fricX; p.Ff.y += fricY; }
                // 用反弹后的法向速度重组（避免顺序错误）
                p.vx = vt * tx + vnNew * c.normal.x;
                p.vy = vt * ty + vnNew * c.normal.y;
              }
              // 记录法向力
              if (p.Fn) { p.Fn.x += jn * c.normal.x; p.Fn.y += jn * c.normal.y; }
              if (this.onCollide) this.onCollide(p, s.obj, c);
            }
          }
        }
      }
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
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const e = Math.min(a.restitution, b.restitution) * this.restitutionGlobal;
            const im = (-(1 + e) * vn) / ((a.fixed ? 0 : 1 / a.mass) + (b.fixed ? 0 : 1 / b.mass));
            const imA = a.fixed ? 0 : im / a.mass;
            const imB = b.fixed ? 0 : im / b.mass;
            if (!a.fixed) { a.vx -= imA * nx; a.vy -= imA * ny; }
            if (!b.fixed) { b.vx += imB * nx; b.vy += imB * ny; }
            if (this.onCollide) this.onCollide(a, b, { normal: { x: nx, y: ny } });
          }
        }
      }
    }

    // 9) 圆管碰撞（粒子-管壁碰撞，法向指向/背离圆心）
    for (const p of parts) {
      if (p.fixed) continue;
      for (const pipe of this.objects.filter(o => o.type === 'pipe')) {
        const dx = p.x - pipe.cx, dy = p.y - pipe.cy;
        const dist = Math.hypot(dx, dy);
        // 粒子在管外且接近外壁
        if (dist > pipe.r - p.radius && dist < pipe.r + p.radius) {
          const nx = dx / dist || 1, ny = dy / dist; // 法向指向圆心（向内为正）
          const pen = (pipe.r - dist) + p.radius;
          if (pen > 0) {
            p.x += nx * pen; p.y += ny * pen;
            const vn = -(p.vx * nx + p.vy * ny); // 向外的速度分量
            if (vn > 0) { // 正在向外运动
              const e = (pipe.restitution ?? 0.5) * this.restitutionGlobal;
              const vnNew = -e * vn;
              // 切向摩擦
              const tx = -ny, ty = nx;
              let vt = p.vx * tx + p.vy * ty;
              const mu = pipe.friction ?? 0.2;
              const fric = clamp(vt * mu, -Math.abs(vt), Math.abs(vt));
              vt -= fric * 0.5;
              // 重组速度
              p.vx = vt * tx - vnNew * nx;
              p.vy = vt * ty - vnNew * ny;
            }
          }
        }
        // 粒子在管内且接近内壁
        if (dist < pipe.innerR + p.radius && dist > pipe.innerR - p.radius && dist > 1e-6) {
          const nx = dx / dist, ny = dy / dist; // 法向向外
          const pen = (dist - pipe.innerR) + p.radius;
          if (pen > 0) {
            p.x -= nx * pen; p.y -= ny * pen;
            const vn = p.vx * nx + p.vy * ny; // 向内的速度分量
            if (vn > 0) { // 正在向内运动
              const e = (pipe.restitution ?? 0.5) * this.restitutionGlobal;
              const vnNew = -e * vn;
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

    // 10) 荧光屏检测：记录粒子穿过屏幕的位置
    for (const scr of this.objects.filter(o => o.type === 'screen')) {
      if (!scr.visible) continue;
      for (const p of parts) {
        // 检查粒子是否在屏幕矩形区域内
        if (p.x >= scr.x && p.x <= scr.x + scr.w &&
            p.y >= scr.y && p.y <= scr.y + scr.h) {
          // 记录击中点（避免重复记录同一位置）
          const lastHit = scr.hits[scr.hits.length - 1];
          if (!lastHit ||
              Math.abs(p.x - lastHit.x) > 0.05 ||
              Math.abs(p.y - lastHit.y) > 0.05 ||
              (this.time - lastHit.t) > 0.02) {
            scr.hits.push({ x: p.x, y: p.y, t: this.time, color: p.color, radius: p.radius });
            if (scr.hits.length > scr.maxHits) scr.hits.shift();
          }
        }
      }
    }
  }

  // 粒子源发射
  emitSources(dt) {
    // 普通粒子源
    for (const s of this.objects.filter(o => o.type === 'source' && o.on)) {
      s._acc += dt * s.rate;
      while (s._acc >= 1) {
        s._acc -= 1;
        const p = make('particle', {
          x: s.x, y: s.y,
          vx: Math.cos(s.angle) * s.speed,
          vy: Math.sin(s.angle) * s.speed,
          mass: s.mass, charge: s.charge, radius: s.radius,
          color: s.color, name: '发射粒子',
        });
        this.sourceParticles.push(p);
        if (this.sourceParticles.length > 200) this.sourceParticles.shift();
      }
    }
    // 插值粒子源：在两个端点之间均匀发射
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
          vx: Math.cos(s.angle) * s.speed,
          vy: Math.sin(s.angle) * s.speed,
          mass: s.mass, charge: s.charge, radius: s.radius,
          color: s.color, name: '插值发射',
        });
        this.sourceParticles.push(p);
        if (this.sourceParticles.length > 300) this.sourceParticles.shift();
      }
    }
    // 公式粒子源：用公式定义初速度
    for (const s of this.objects.filter(o => o.type === 'formulasource' && o.on)) {
      s._acc += dt * s.rate;
      while (s._acc >= 1) {
        s._acc -= 1;
        s._t += 1 / s.rate; // 累加时间用于公式计算
        const scope = { t: s._t, pi: Math.PI };
        const vx = evalExpr(s.vxExpr, scope) || s.speed;
        const vy = evalExpr(s.vyExpr, scope) || 0;
        const p = make('particle', {
          x: s.x, y: s.y,
          vx: isFinite(vx) ? vx : s.speed,
          vy: isFinite(vy) ? vy : 0,
          mass: s.mass, charge: s.charge, radius: s.radius,
          color: s.color, name: '公式发射',
        });
        this.sourceParticles.push(p);
        if (this.sourceParticles.length > 200) this.sourceParticles.shift();
      }
    }
  }

  // 求动态文本值
  evalDynamic(text, scope) {
    return evalExpr(text, scope);
  }
}
