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
  }

  // 粒子源发射
  emitSources(dt) {
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
  }

  // 求动态文本值
  evalDynamic(text, scope) {
    return evalExpr(text, scope);
  }
}
