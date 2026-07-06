import type {
  PhysicsObject, MassObj, SpringObj, GroundObj, ConveyorObj,
  TetherObj, EFieldObj, BFieldObj, SourceObj, GlobalConfig,
} from "./types";

let particleIdCounter = 1;

const RESTITUTION = 0.65; // 默认恢复系数
const SUBSTEPS = 4; // 子步数，提高稳定性

/** 重置对象到初始状态(清空轨迹) */
export function resetObjects(objects: PhysicsObject[]): PhysicsObject[] {
  return objects.map((o) => {
    if (o.type === "mass") {
      return { ...o, trail: [], vx: (o as MassObj).vx, vy: (o as MassObj).vy };
    }
    return o;
  });
}

/** 主步进函数 */
export function stepPhysics(
  objects: PhysicsObject[],
  config: GlobalConfig,
  dt: number,
  time: number
): { newObjects: PhysicsObject[]; newTime: number } {
  if (dt <= 0) return { newObjects: objects, newTime: time };
  const h = dt / SUBSTEPS;

  // 粒子源发射
  let working = objects.map((o) => ({ ...o }));
  working = emitParticles(working, dt);

  // 粒子生命衰减并移除死亡粒子
  working = working
    .map((o) => {
      if (o.type === "mass" && o.isParticle) {
        return { ...o, life: (o.life ?? 0) - dt };
      }
      return o;
    })
    .filter((o) => !(o.type === "mass" && o.isParticle && (o.life ?? 0) <= 0)) as PhysicsObject[];

  let result = working;
  for (let i = 0; i < SUBSTEPS; i++) {
    result = substep(result, config, h);
  }
  // 绳/杆约束(位置投影)
  result = resolveTethers(result);
  // 记录轨迹(粒子不记轨迹)
  result = result.map((o) => {
    if (o.type === "mass" && !o.isParticle) {
      const m = o as MassObj;
      const trail = m.trail.length > 300 ? m.trail.slice(-299) : m.trail;
      return { ...m, trail: [...trail, { x: m.x, y: m.y }] };
    }
    return o;
  });
  return { newObjects: result, newTime: time + dt };
}

/** 粒子源发射 */
function emitParticles(objects: PhysicsObject[], dt: number): PhysicsObject[] {
  const sources = objects.filter((o) => o.type === "source") as SourceObj[];
  if (sources.length === 0) return objects;
  const emitted: MassObj[] = [];
  const updatedSources = objects.map((o) => {
    if (o.type !== "source") return o;
    const s = o as SourceObj;
    if (s.enabled === false) return o;
    const ns = { ...s, accum: (s.accum ?? 0) + dt * s.rate };
    const n = Math.floor(ns.accum);
    if (n > 0) {
      ns.accum -= n;
      for (let i = 0; i < n; i++) {
        emitted.push({
          id: `prt_${Date.now().toString(36)}_${particleIdCounter++}`,
          type: "mass",
          x: s.x,
          y: s.y,
          vx: s.vx,
          vy: s.vy,
          mass: s.mass,
          radius: s.radius,
          color: s.color,
          charge: s.charge,
          showVelocity: false,
          showLabel: false,
          fixed: false,
          trail: [],
          life: s.life,
          maxLife: s.life,
          isParticle: true,
        });
      }
    }
    return ns;
  });
  return [...updatedSources, ...emitted] as PhysicsObject[];
}

/** 绳/杆约束: 位置投影使质点距中心 = length */
function resolveTethers(objects: PhysicsObject[]): PhysicsObject[] {
  const tethers = objects.filter((o) => o.type === "tether") as TetherObj[];
  if (tethers.length === 0) return objects;
  return objects.map((o) => {
    if (o.type !== "mass" || o.fixed) return o;
    const m = o as MassObj;
    for (const t of tethers) {
      if (t.targetId !== m.id) continue;
      const dx = m.x - t.cx;
      const dy = m.y - t.cy;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (t.rigid) {
        // 杆: 恒定距离, 投影到圆周上, 切向速度保持
        const nx = dx / d;
        const ny = dy / d;
        const newX = t.cx + nx * t.length;
        const newY = t.cy + ny * t.length;
        // 移除径向速度分量(只保留切向)
        const vr = m.vx * nx + m.vy * ny;
        const newVx = m.vx - vr * nx;
        const newVy = m.vy - vr * ny;
        return { ...m, x: newX, y: newY, vx: newVx, vy: newVy };
      } else {
        // 绳: 只在距离>length时拉回
        if (d > t.length) {
          const nx = dx / d;
          const ny = dy / d;
          const newX = t.cx + nx * t.length;
          const newY = t.cy + ny * t.length;
          const vr = m.vx * nx + m.vy * ny;
          const newVx = vr > 0 ? m.vx - vr * nx : m.vx;
          const newVy = vr > 0 ? m.vy - vr * ny : m.vy;
          return { ...m, x: newX, y: newY, vx: newVx, vy: newVy };
        }
      }
    }
    return o;
  });
}

function substep(objects: PhysicsObject[], config: GlobalConfig, dt: number): PhysicsObject[] {
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];
  const springs = objects.filter((o) => o.type === "spring") as SpringObj[];
  const grounds = objects.filter((o) => o.type === "ground") as GroundObj[];
  const conveyors = objects.filter((o) => o.type === "conveyor") as ConveyorObj[];
  const efields = objects.filter((o) => o.type === "efield") as EFieldObj[];
  const bfields = objects.filter((o) => o.type === "bfield") as BFieldObj[];

  // 加速度累加器: id -> {ax, ay}
  const acc = new Map<string, { ax: number; ay: number }>();
  masses.forEach((m) => acc.set(m.id, { ax: 0, ay: 0 }));

  // 1. 重力
  if (config.gravityOn) {
    masses.forEach((m) => {
      if (m.fixed) return;
      const a = acc.get(m.id)!;
      a.ay -= config.gravity;
    });
  }

  // 2. 空气阻力
  if (config.airResistance > 0) {
    masses.forEach((m) => {
      if (m.fixed) return;
      const a = acc.get(m.id)!;
      a.ax -= config.airResistance * m.vx / m.mass;
      a.ay -= config.airResistance * m.vy / m.mass;
    });
  }

  // 3. 弹簧力
  springs.forEach((sp) => {
    const posA = sp.aId ? getMassPos(objects, sp.aId) : { x: sp.ax, y: sp.ay };
    const posB = sp.bId ? getMassPos(objects, sp.bId) : { x: sp.bx, y: sp.by };
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const L = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / L;
    const uy = dy / L;
    const stretch = L - sp.naturalLength;
    // 胡克力
    let force = sp.k * stretch;
    // 阻尼(沿弹簧方向的相对速度)
    const vA = sp.aId ? getMassVel(objects, sp.aId) : { vx: 0, vy: 0 };
    const vB = sp.bId ? getMassVel(objects, sp.bId) : { vx: 0, vy: 0 };
    const relV = (vB.vx - vA.vx) * ux + (vB.vy - vA.vy) * uy;
    force += sp.damping * relV;
    const fx = force * ux;
    const fy = force * uy;
    // 对 B 施力 -f(收缩/排斥), 对 A 施力 +f(牛顿第三定律)
    if (sp.bId && acc.has(sp.bId)) {
      const a = acc.get(sp.bId)!;
      a.ax -= fx / getMass(objects, sp.bId)!.mass;
      a.ay -= fy / getMass(objects, sp.bId)!.mass;
    }
    if (sp.aId && acc.has(sp.aId)) {
      const a = acc.get(sp.aId)!;
      a.ax += fx / getMass(objects, sp.aId)!.mass;
      a.ay += fy / getMass(objects, sp.aId)!.mass;
    }
  });

  // 4. 电场力 F = qE (质点在电场矩形区域内)
  if (efields.length) {
    efields.forEach((f) => {
      masses.forEach((m) => {
        if (m.fixed || m.charge === 0) return;
        if (Math.abs(m.x - f.x) <= f.w / 2 && Math.abs(m.y - f.y) <= f.h / 2) {
          const a = acc.get(m.id)!;
          a.ax += (m.charge * f.ex) / m.mass;
          a.ay += (m.charge * f.ey) / m.mass;
        }
      });
    });
  }

  // 5. 洛伦兹力 F = qv×B (Bz垂直纸面)
  if (bfields.length) {
    bfields.forEach((f) => {
      masses.forEach((m) => {
        if (m.fixed || m.charge === 0) return;
        if (Math.abs(m.x - f.x) <= f.w / 2 && Math.abs(m.y - f.y) <= f.h / 2) {
          const a = acc.get(m.id)!;
          // F = q(v×B), B=(0,0,Bz): Fx=q*vy*Bz, Fy=-q*vx*Bz
          a.ax += (m.charge * m.vy * f.bz) / m.mass;
          a.ay -= (m.charge * m.vx * f.bz) / m.mass;
        }
      });
    });
  }

  // 6. 积分(半隐式欧拉)
  const newMasses = masses.map((m) => {
    if (m.fixed) return m;
    const a = acc.get(m.id)!;
    const nvx = m.vx + a.ax * dt;
    const nvy = m.vy + a.ay * dt;
    const nx = m.x + nvx * dt;
    const ny = m.y + nvy * dt;
    return { ...m, vx: nvx, vy: nvy, x: nx, y: ny };
  });

  // 7. 碰撞(地面+传送带)
  let result: PhysicsObject[] = objects.map((o) => {
    const nm = newMasses.find((m) => m.id === o.id);
    return nm ? (nm as PhysicsObject) : o;
  });

  if (config.collisionOn) {
    result = resolveGroundCollisions(result, grounds);
    result = resolveConveyorCollisions(result, conveyors);
    result = resolveMassCollisions(result);
  }

  return result;
}

function resolveGroundCollisions(objects: PhysicsObject[], grounds: GroundObj[]): PhysicsObject[] {
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];
  const updated = new Map<string, MassObj>();
  masses.forEach((m) => updated.set(m.id, m));

  grounds.forEach((g) => {
    masses.forEach((m) => {
      if (m.fixed) return;
      const cur = updated.get(m.id)!;
      // 点到线段最近点
      const res = closestPointOnSegment(cur.x, cur.y, g.x1, g.y1, g.x2, g.y2);
      const dx = cur.x - res.px;
      const dy = cur.y - res.py;
      const d = Math.hypot(dx, dy);
      if (d < cur.radius && d > 1e-6) {
        // 法向量(从地面指向质点)
        const nx = dx / d;
        const ny = dy / d;
        // 位置修正
        const overlap = cur.radius - d;
        const nx2 = cur.x + nx * overlap;
        const ny2 = cur.y + ny * overlap;
        // 速度反射
        const vn = cur.vx * nx + cur.vy * ny;
        if (vn < 0) {
          const e = RESTITUTION;
          // 法向反射
          let newVx = cur.vx - (1 + e) * vn * nx;
          let newVy = cur.vy - (1 + e) * vn * ny;
          // 摩擦(切向衰减)
          const tx = -ny;
          const ty = nx;
          const vt = newVx * tx + newVy * ty;
          const fric = g.friction;
          const newVt = vt * Math.max(0, 1 - fric * 0.3);
          newVx = newVt * tx;
          newVy = newVt * ty;
          updated.set(m.id, { ...cur, x: nx2, y: ny2, vx: newVx, vy: newVy });
        } else {
          updated.set(m.id, { ...cur, x: nx2, y: ny2 });
        }
      }
    });
  });

  return objects.map((o) => (o.type === "mass" ? (updated.get(o.id) as PhysicsObject) ?? o : o));
}

/** 传送带碰撞: 摩擦带动质点切向速度趋向传送带速度 */
function resolveConveyorCollisions(objects: PhysicsObject[], conveyors: ConveyorObj[]): PhysicsObject[] {
  if (conveyors.length === 0) return objects;
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];
  const updated = new Map<string, MassObj>();
  masses.forEach((m) => updated.set(m.id, m));

  conveyors.forEach((c) => {
    const cdx = c.x2 - c.x1, cdy = c.y2 - c.y1;
    const clen = Math.hypot(cdx, cdy) || 1e-6;
    const ux = cdx / clen, uy = cdy / clen; // 传送带方向
    const vbeltx = c.velocity * ux, vbelty = c.velocity * uy;
    masses.forEach((m) => {
      if (m.fixed) return;
      const cur = updated.get(m.id)!;
      const res = closestPointOnSegment(cur.x, cur.y, c.x1, c.y1, c.x2, c.y2);
      const dx = cur.x - res.px, dy = cur.y - res.py;
      const d = Math.hypot(dx, dy);
      if (d < cur.radius && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        const overlap = cur.radius - d;
        const nx2 = cur.x + nx * overlap, ny2 = cur.y + ny * overlap;
        const vn = cur.vx * nx + cur.vy * ny;
        if (vn < 0) {
          const e = RESTITUTION;
          const tx = -ny, ty = nx;
          const vt = cur.vx * tx + cur.vy * ty;
          const vtBelt = vbeltx * tx + vbelty * ty;
          const vnAfter = -e * vn;
          const vtAfter = vt + (vtBelt - vt) * Math.min(1, c.friction * 0.6);
          updated.set(m.id, {
            ...cur,
            x: nx2, y: ny2,
            vx: vnAfter * nx + vtAfter * tx,
            vy: vnAfter * ny + vtAfter * ty,
          });
        } else {
          updated.set(m.id, { ...cur, x: nx2, y: ny2 });
        }
      }
    });
  });
  return objects.map((o) => (o.type === "mass" ? (updated.get(o.id) as PhysicsObject) ?? o : o));
}

function resolveMassCollisions(objects: PhysicsObject[]): PhysicsObject[] {
  const masses = objects.filter((o) => o.type === "mass") as MassObj[];
  const updated = masses.map((m) => ({ ...m }));
  for (let i = 0; i < updated.length; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      const a = updated[i];
      const b = updated[j];
      if (a.fixed && b.fixed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = a.radius + b.radius;
      if (d < minD && d > 1e-6) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = minD - d;
        // 位置分离
        const totalM = a.mass + b.mass;
        if (!a.fixed && !b.fixed) {
          a.x -= nx * overlap * (b.mass / totalM);
          a.y -= ny * overlap * (b.mass / totalM);
          b.x += nx * overlap * (a.mass / totalM);
          b.y += ny * overlap * (a.mass / totalM);
        } else if (!a.fixed) {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
        } else if (!b.fixed) {
          b.x += nx * overlap;
          b.y += ny * overlap;
        }
        // 速度交换(弹性碰撞)
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const e = RESTITUTION;
          const jImp = (-(1 + e) * vn) / (1 / a.mass + 1 / b.mass);
          const ix = jImp * nx;
          const iy = jImp * ny;
          if (!a.fixed) {
            a.vx -= ix / a.mass;
            a.vy -= iy / a.mass;
          }
          if (!b.fixed) {
            b.vx += ix / b.mass;
            b.vy += iy / b.mass;
          }
        }
      }
    }
  }
  return objects.map((o) => {
    const nm = updated.find((m) => m.id === o.id);
    return nm ? (nm as PhysicsObject) : o;
  });
}

function getMassPos(objects: PhysicsObject[], id: string): { x: number; y: number } {
  const m = objects.find((o) => o.id === id && o.type === "mass") as MassObj | undefined;
  return m ? { x: m.x, y: m.y } : { x: 0, y: 0 };
}
function getMassVel(objects: PhysicsObject[], id: string): { vx: number; vy: number } {
  const m = objects.find((o) => o.id === id && o.type === "mass") as MassObj | undefined;
  return m ? { vx: m.vx, vy: m.vy } : { vx: 0, vy: 0 };
}
function getMass(objects: PhysicsObject[], id: string): MassObj | undefined {
  return objects.find((o) => o.id === id && o.type === "mass") as MassObj | undefined;
}

function closestPointOnSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): { px: number; py: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-6;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { px: x1 + t * dx, py: y1 + t * dy, t };
}
