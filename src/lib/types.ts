// 爱物理 - 力与运动仿真平台 核心类型定义

/** 对象类型枚举 */
export type ObjType =
  | "mass" // 质点(粒子M)
  | "spring" // 弹簧(T)
  | "ground" // 地面/管模型
  | "conveyor" // 传送带模型
  | "tether" // 绳/杆约束(圆周运动/单摆)
  | "efield" // 电场(E)
  | "bfield" // 磁场(B)
  | "source" // 粒子源
  | "point" // 辅助点(P)
  | "line" // 辅助线
  | "text" // 文本框
  | "arc"; // 圆弧

/** 绘图工具 */
export type Tool =
  | "select"
  | "mass"
  | "spring"
  | "ground"
  | "conveyor"
  | "tether"
  | "efield"
  | "bfield"
  | "source"
  | "point"
  | "line"
  | "text";

/** 质点 */
export interface MassObj {
  id: string;
  type: "mass";
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  radius: number;
  color: string;
  charge: number; // 电荷量
  showVelocity: boolean; // 显示速度箭头
  showLabel: boolean; // 显示m标识
  fixed: boolean; // 固定
  /** 仿真轨迹 */
  trail: { x: number; y: number }[];
  life?: number; // 剩余生命(秒)，用于粒子源发射的粒子
  maxLife?: number; // 最大生命
  isParticle?: boolean; // 是否为粒子源发射的粒子
}

/** 弹簧 */
export interface SpringObj {
  id: string;
  type: "spring";
  aId: string | null; // 端点A(质点id)，null表示固定点
  bId: string | null; // 端点B
  ax: number; // 固定点A坐标(当aId为null)
  ay: number;
  bx: number; // 固定点B坐标
  by: number;
  k: number; // 劲度系数
  naturalLength: number; // 自然长度
  coils: number; // 圈数(视觉)
  width: number; // 弹簧宽
  damping: number; // 阻尼
}

/** 地面/管模型(线段) */
export interface GroundObj {
  id: string;
  type: "ground";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  friction: number; // 动摩擦因数
  isTube: boolean; // 管模型(质点可穿过)
}

/** 传送带 */
export interface ConveyorObj {
  id: string;
  type: "conveyor";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  velocity: number; // 传送带速度
  friction: number;
}

/** 辅助点 */
export interface PointObj {
  id: string;
  type: "point";
  x: number;
  y: number;
}

/** 辅助线 */
export interface LineObj {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 文本框 */
export interface TextObj {
  id: string;
  type: "text";
  x: number;
  y: number;
  content: string;
  fontSize: number;
}

/** 绳/杆约束(刚性距离约束) */
export interface TetherObj {
  id: string;
  type: "tether";
  targetId: string | null; // 约束的质点
  cx: number; // 固定中心坐标
  cy: number;
  length: number; // 绳长(约束距离)
  rigid: boolean; // true=杆(恒定距离), false=绳(只拉不推)
}

/** 均匀电场(矩形区域) */
export interface EFieldObj {
  id: string;
  type: "efield";
  x: number; // 矩形中心
  y: number;
  w: number; // 宽(世界单位)
  h: number; // 高
  ex: number; // 电场分量Ex
  ey: number; // 电场分量Ey
}

/** 均匀磁场(矩形区域, B垂直纸面) */
export interface BFieldObj {
  id: string;
  type: "bfield";
  x: number;
  y: number;
  w: number;
  h: number;
  bz: number; // 磁场Bz(正值穿出纸面, 负值穿入)
}

/** 粒子源 */
export interface SourceObj {
  id: string;
  type: "source";
  x: number;
  y: number;
  vx: number; // 发射初速度
  vy: number;
  rate: number; // 发射频率(个/秒)
  mass: number; // 粒子质量
  radius: number; // 粒子半径
  color: string;
  charge: number;
  life: number; // 粒子生命(秒)
  /** 运行时累积器 */
  accum?: number;
  enabled?: boolean;
}

export type PhysicsObject =
  | MassObj
  | SpringObj
  | GroundObj
  | ConveyorObj
  | TetherObj
  | EFieldObj
  | BFieldObj
  | SourceObj
  | PointObj
  | LineObj
  | TextObj;

/** 全局参数 */
export interface Param {
  name: string;
  value: number;
}

/** 滑动条 */
export interface Slider {
  id: string;
  param: string; // 关联参数名
  min: number;
  max: number;
  value: number;
  step: number;
}

/** 全局配置 */
export interface GlobalConfig {
  gravityOn: boolean;
  gravity: number; // g
  collisionOn: boolean;
  airResistance: number; // 空气阻力系数
  params: Param[];
  sliders: Slider[];
}

/** 函数图像配置 */
export interface ChartConfig {
  visible: boolean;
  xAxis: string; // 横轴变量，默认 t
  yAxis: string; // 纵轴变量表达式，如 x, v, a
  targetId: string | null; // 观测的质点id
  maxTime: number; // 显示时间窗口
}

/** 仿真状态 */
export interface SimState {
  isSimulating: boolean;
  time: number;
  speed: number; // 播放速度
  paused: boolean;
}

/** 预设实验 */
export interface Experiment {
  id: string;
  name: string;
  category: string;
  description: string;
  objects: PhysicsObject[];
  config: GlobalConfig;
}
