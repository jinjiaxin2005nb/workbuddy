import type { Experiment, PhysicsObject } from "./types";

const m = (o: Partial<PhysicsObject> & { id: string }): PhysicsObject =>
  ({ trail: [], ...o } as PhysicsObject);

export const EXPERIMENTS: Experiment[] = [
  {
    id: "freefall",
    name: "自由落体运动",
    category: "力学",
    description: "质点从高处由静止释放，仅在重力作用下做匀加速直线运动。",
    objects: [
      m({ id: "g1", type: "ground", x1: -10, y1: 0, x2: 10, y2: 0, friction: 0, isTube: false }),
      m({
        id: "m1", type: "mass", x: 0, y: 6, vx: 0, vy: 0, mass: 1, radius: 0.4,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "horizontal-throw",
    name: "平抛运动",
    category: "力学",
    description: "质点从高处以水平初速度抛出，在重力作用下做平抛运动，轨迹为抛物线。",
    objects: [
      m({ id: "g1", type: "ground", x1: -10, y1: 0, x2: 12, y2: 0, friction: 0, isTube: false }),
      m({
        id: "m1", type: "mass", x: -8, y: 6, vx: 5, vy: 0, mass: 1, radius: 0.35,
        color: "#22c55e", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "oblique-throw",
    name: "斜抛运动",
    category: "力学",
    description: "质点以斜向初速度抛出，运动可分解为水平匀速与竖直匀变速，轨迹为抛物线。",
    objects: [
      m({ id: "g1", type: "ground", x1: -10, y1: 0, x2: 14, y2: 0, friction: 0, isTube: false }),
      m({
        id: "m1", type: "mass", x: -6, y: 0.4, vx: 7, vy: 9, mass: 1, radius: 0.35,
        color: "#f59e0b", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "vertical-spring",
    name: "竖直弹簧振动(简谐运动)",
    category: "力学",
    description: "质点悬挂在竖直弹簧下方，在重力与弹簧弹力共同作用下做简谐振动。",
    objects: [
      m({
        id: "s1", type: "spring", aId: null, bId: "m1", ax: 0, ay: 6, bx: 0, by: 3,
        k: 25, naturalLength: 2.5, coils: 8, width: 0.3, damping: 0.05,
      }),
      m({
        id: "m1", type: "mass", x: 0, y: 2, vx: 0, vy: 0, mass: 1, radius: 0.4,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({ id: "g1", type: "ground", x1: -6, y1: -2, x2: 6, y2: -2, friction: 0, isTube: false }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "horizontal-spring",
    name: "水平弹簧振动",
    category: "力学",
    description: "质点连接水平弹簧，偏离平衡位置后释放，在弹力作用下做简谐运动。",
    objects: [
      m({
        id: "s1", type: "spring", aId: null, bId: "m1", ax: -5, ay: 0.4, bx: 0, by: 0.4,
        k: 35, naturalLength: 5, coils: 10, width: 0.3, damping: 0.02,
      }),
      m({
        id: "m1", type: "mass", x: 2, y: 0.4, vx: 0, vy: 0, mass: 1, radius: 0.4,
        color: "#a855f7", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({ id: "g1", type: "ground", x1: -6, y1: 0, x2: 7, y2: 0, friction: 0, isTube: false }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "double-mass-spring",
    name: "弹簧双阵子",
    category: "力学",
    description: "两个质点由弹簧连接，研究耦合振动的能量传递与动量守恒。",
    objects: [
      m({
        id: "s1", type: "spring", aId: "m1", bId: "m2", ax: -2, ay: 2, bx: 2, by: 2,
        k: 40, naturalLength: 4, coils: 10, width: 0.3, damping: 0.01,
      }),
      m({
        id: "m1", type: "mass", x: -2, y: 2, vx: 0, vy: 0, mass: 1, radius: 0.4,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({
        id: "m2", type: "mass", x: 2, y: 2, vx: 3, vy: 0, mass: 1, radius: 0.4,
        color: "#ef4444", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({ id: "g1", type: "ground", x1: -7, y1: 0, x2: 7, y2: 0, friction: 0, isTube: false }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "collision",
    name: "两球正碰",
    category: "力学",
    description: "两个质点在同一直线上运动并发生碰撞，演示动量守恒与能量转化。",
    objects: [
      m({
        id: "m1", type: "mass", x: -5, y: 0.4, vx: 5, vy: 0, mass: 1, radius: 0.4,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({
        id: "m2", type: "mass", x: 3, y: 0.4, vx: 0, vy: 0, mass: 2, radius: 0.5,
        color: "#ef4444", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({ id: "g1", type: "ground", x1: -8, y1: 0, x2: 8, y2: 0, friction: 0, isTube: false }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "projectile-compare",
    name: "抛体运动对比",
    category: "力学",
    description: "三个质点以不同初速度水平抛出，对比不同初速度下的抛物线轨迹。",
    objects: [
      m({ id: "g1", type: "ground", x1: -4, y1: 0, x2: 16, y2: 0, friction: 0, isTube: false }),
      m({
        id: "m1", type: "mass", x: -3, y: 6, vx: 3, vy: 0, mass: 1, radius: 0.3,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({
        id: "m2", type: "mass", x: -3, y: 6, vx: 5, vy: 0, mass: 1, radius: 0.3,
        color: "#22c55e", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
      m({
        id: "m3", type: "mass", x: -3, y: 6, vx: 7, vy: 0, mass: 1, radius: 0.3,
        color: "#f59e0b", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: false, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "circular-motion",
    name: "匀速圆周运动",
    category: "力学",
    description: "质点被刚性杆约束在圆周上，给定切向初速度后做匀速圆周运动，杆提供向心力。",
    objects: [
      m({
        id: "t1", type: "tether", targetId: "m1", cx: 0, cy: 4, length: 3, rigid: true,
      }),
      m({
        id: "m1", type: "mass", x: 3, y: 4, vx: 0, vy: 3, mass: 1, radius: 0.35,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: false, gravity: 10, collisionOn: false, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "pendulum",
    name: "单摆运动",
    category: "力学",
    description: "质点由绳约束悬挂，偏离平衡位置释放后在重力作用下做单摆运动。",
    objects: [
      m({
        id: "t1", type: "tether", targetId: "m1", cx: 0, cy: 6, length: 4, rigid: false,
      }),
      m({
        id: "m1", type: "mass", x: 4, y: 6, vx: 0, vy: 0, mass: 1, radius: 0.35,
        color: "#a855f7", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: false, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "efield-accel",
    name: "电场加速",
    category: "电磁",
    description: "带电质点在均匀电场中受恒定电场力 F=qE 作用做匀加速直线运动。",
    objects: [
      m({
        id: "f1", type: "efield", x: 0, y: 3, w: 10, h: 5, ex: 6, ey: 0,
      }),
      m({
        id: "m1", type: "mass", x: -4, y: 3, vx: 0, vy: 0, mass: 1, radius: 0.35,
        color: "#f59e0b", charge: 1, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: false, gravity: 10, collisionOn: false, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "bfield-cyclotron",
    name: "磁场中的圆周运动(回旋)",
    category: "电磁",
    description: "带电粒子在垂直纸面的均匀磁场中受洛伦兹力 F=qv×B 作用做圆周运动，半径 r=mv/(qB)。",
    objects: [
      m({
        id: "f1", type: "bfield", x: 0, y: 0, w: 14, h: 12, bz: 2,
      }),
      m({
        id: "m1", type: "mass", x: -3, y: 0, vx: 0, vy: 4, mass: 1, radius: 0.3,
        color: "#22c55e", charge: 1, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: false, gravity: 10, collisionOn: false, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "conveyor-belt",
    name: "传送带带动",
    category: "力学",
    description: "质点落在水平传送带上，在摩擦力作用下逐渐加速至与传送带同速。",
    objects: [
      m({
        id: "c1", type: "conveyor", x1: -6, y1: 0, x2: 6, y2: 0, velocity: 3, friction: 1.0,
      }),
      m({
        id: "m1", type: "mass", x: -4, y: 1.6, vx: 0, vy: 0, mass: 1, radius: 0.4,
        color: "#3d8bff", charge: 0, showVelocity: true, showLabel: true, fixed: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
  {
    id: "particle-source",
    name: "粒子源抛射",
    category: "综合",
    description: "粒子源持续发射带初速度的粒子，粒子在重力作用下做斜抛运动，形成抛物线流。",
    objects: [
      m({
        id: "s1", type: "source", x: -6, y: 2, vx: 5, vy: 8, rate: 4, mass: 0.3, radius: 0.18,
        color: "#22c55e", charge: 0, life: 4, accum: 0, enabled: true,
      }),
      m({
        id: "g1", type: "ground", x1: -8, y1: 0, x2: 12, y2: 0, friction: 0.3, isTube: false,
      }),
    ],
    config: {
      gravityOn: true, gravity: 10, collisionOn: true, airResistance: 0,
      params: [{ name: "g", value: 10 }, { name: "pi", value: 3.14159265 }], sliders: [],
    },
  },
];
