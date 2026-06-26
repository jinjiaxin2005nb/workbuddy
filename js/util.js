// ===== 数学工具 / 向量 / 表达式求值 =====
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
export function uid(p = 'id') { return p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

export function fmt(n, d = 2) {
  if (!isFinite(n)) return '∞';
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(2);
  return Number(n.toFixed(d)).toString();
}

// 2D 向量（用 {x,y} 普通对象避免类开销，提供函数式操作）
export const V = {
  of: (x = 0, y = 0) => ({ x, y }),
  clone: a => ({ x: a.x, y: a.y }),
  set: (a, x, y) => { a.x = x; a.y = y; return a; },
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  cross: (a, b) => a.x * b.y - a.y * b.x,
  len: a => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  ang: a => Math.atan2(a.y, a.x),
  norm: a => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  rot: (a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }; },
  perp: a => ({ x: -a.y, y: a.x }),
};

// 点到线段最近点 & 距离
export function pointSeg(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const ab2 = abx * abx + aby * aby || 1e-9;
  let t = (apx * abx + apy * aby) / ab2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t, cy = a.y + aby * t;
  return { point: { x: cx, y: cy }, t, dist: Math.hypot(p.x - cx, p.y - cy) };
}

// 圆与线段碰撞
export function circleSeg(c, r, a, b) {
  const res = pointSeg(c, a, b);
  if (res.dist <= r) {
    // 法线：从碰撞点指向圆心（即质点所在方向）
    let n = V.norm(V.sub(c, res.point));
    if (res.dist < 1e-6) n = V.norm(V.perp(V.sub(b, a)));
    const pen = Math.min(r - res.dist, r * 0.5);
    return { hit: true, point: res.point, normal: n, penetration: pen, t: res.t };
  }
  return { hit: false };
}

// 安全表达式求值（支持四则运算、幂、函数、变量、@对象.属性）
const FN = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10 || (x => Math.log(x) / Math.LN10),
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, pow: Math.pow, min: Math.min, max: Math.max,
  hypot: Math.hypot, deg: x => x * DEG, rad: x => x / DEG,
};
const CONSTS = { pi: Math.PI, e: Math.E, g: 9.8, true: 1, false: 0 };

export function evalExpr(expr, scope = {}) {
  if (expr == null || expr === '') return 0;
  const s = String(expr);
  // 仅允许安全字符
  if (/[;{}\[\]]|=>|new |function |return /.test(s)) return NaN;
  try {
    const names = Object.keys(scope);
    const vals = names.map(k => scope[k]);
    const body = 'with(FN){with(C){with(S){return (' + s + ');}}}';
    // eslint-disable-next-line no-new-func
    const fn = new Function('FN', 'C', 'S', ...names, body);
    const r = fn(FN, CONSTS, scope, ...vals);
    return typeof r === 'number' ? r : (r ? 1 : 0);
  } catch (e) {
    return NaN;
  }
}

// 圆弧地面采样为折线
export function arcPoints(g) {
  let a0 = g.a0, a1 = g.a1;
  // 确保圆弧方向是逆时针（质点站在圆弧上面）
  if (a1 <= a0) a1 += 2 * Math.PI;
  const pts = [];
  for (let i = 0; i <= (g._seg || 24); i++) {
    const a = a0 + (a1 - a0) * (i / (g._seg || 24));
    pts.push({ x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) });
  }
  return pts;
}

// 颜色调色板
export const PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#111827'];

// 颜色变亮/变暗
export function shade(hex, amt) {
  const c = hex.replace('#', '');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  r = clamp(Math.round(r + amt), 0, 255); g = clamp(Math.round(g + amt), 0, 255); b = clamp(Math.round(b + amt), 0, 255);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function rgba(hex, a) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
