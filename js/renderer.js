// ===== 渲染器：网格 / 坐标轴 / 对象绘制 =====
import { V, TAU, fmt, shade, rgba, arcPoints } from './util.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx;
    this.cam = camera;
    this.view = { grid: true, axis: true, ruler: true, trail: true, vel: true };
    this.preview = null;     // {type, ...} 绘制预览
    this.selected = null;    // 选中对象 id
    this.hover = null;
    this.running = false;
  }

  clear() {
    const { ctx, cam } = this;
    ctx.clearRect(0, 0, cam.vw, cam.vh);
    ctx.fillStyle = '#fbfcfe';
    ctx.fillRect(0, 0, cam.vw, cam.vh);
  }

  drawGrid() {
    if (!this.view.grid) return;
    const { ctx, cam } = this;
    const step = cam.gridStep();
    const left = cam.wx(0), right = cam.wx(cam.vw);
    const bottom = cam.wy(cam.vh), top = cam.wy(0);
    const minor = step, major = step * 5;
    ctx.lineWidth = 1;
    // 次网格
    ctx.strokeStyle = '#eef2f7';
    ctx.beginPath();
    for (let x = Math.floor(left / minor) * minor; x <= right; x += minor) {
      const sx = cam.sx(x); ctx.moveTo(sx, 0); ctx.lineTo(sx, cam.vh);
    }
    for (let y = Math.floor(bottom / minor) * minor; y <= top; y += minor) {
      const sy = cam.sy(y); ctx.moveTo(0, sy); ctx.lineTo(cam.vw, sy);
    }
    ctx.stroke();
    // 主网格
    ctx.strokeStyle = '#dde4ed';
    ctx.beginPath();
    for (let x = Math.floor(left / major) * major; x <= right; x += major) {
      const sx = cam.sx(x); ctx.moveTo(sx, 0); ctx.lineTo(sx, cam.vh);
    }
    for (let y = Math.floor(bottom / major) * major; y <= top; y += major) {
      const sy = cam.sy(y); ctx.moveTo(0, sy); ctx.lineTo(cam.vw, sy);
    }
    ctx.stroke();
  }

  drawAxes() {
    if (!this.view.axis) return;
    const { ctx, cam } = this;
    const ox = cam.sx(0), oy = cam.sy(0);
    // 轴
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(cam.vw, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, cam.vh); ctx.stroke();
    // 箭头
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.moveTo(cam.vw - 2, oy); ctx.lineTo(cam.vw - 10, oy - 4); ctx.lineTo(cam.vw - 10, oy + 4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ox, 2); ctx.lineTo(ox - 4, 10); ctx.lineTo(ox + 4, 10); ctx.fill();
    // 标签
    ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif';
    ctx.fillText('x', cam.vw - 14, oy - 6);
    ctx.fillText('y', ox + 6, 14);
    // 刻度
    const step = cam.gridStep() * 5;
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    const left = cam.wx(0), right = cam.wx(cam.vw);
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      const sx = cam.sx(x);
      ctx.beginPath(); ctx.moveTo(sx, oy - 3); ctx.lineTo(sx, oy + 3); ctx.stroke();
      ctx.fillText(fmt(x, 0), sx, oy + 14);
    }
    ctx.textAlign = 'right';
    const bottom = cam.wy(cam.vh), top = cam.wy(0);
    for (let y = Math.floor(bottom / step) * step; y <= top; y += step) {
      if (Math.abs(y) < 1e-9) continue;
      const sy = cam.sy(y);
      ctx.beginPath(); ctx.moveTo(ox - 3, sy); ctx.lineTo(ox + 3, sy); ctx.stroke();
      ctx.fillText(fmt(y, 0), ox - 6, sy + 3);
    }
    ctx.textAlign = 'left';
  }

  drawRuler() {
    if (!this.view.ruler) return;
    const { ctx, cam } = this;
    // 左下角比例尺
    const step = cam.gridStep() * (cam.gridStep() < 1 ? 5 : 1);
    const px = step * cam.scale;
    const x = 24, y = cam.vh - 64;
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + px, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.moveTo(x + px, y - 4); ctx.lineTo(x + px, y + 4); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fmt(step, step < 1 ? 2 : 0) + ' m', x + px / 2, y + 16);
    ctx.textAlign = 'left';
  }

  drawParticle(p) {
    const { ctx, cam } = this;
    const s = cam.s(p.x, p.y);
    const r = p.radius * cam.scale;
    // 轨迹
    if (this.view.trail && p.trail.length > 1) {
      ctx.strokeStyle = rgba(p.color, 0.45); ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < p.trail.length; i++) {
        const sp = cam.s(p.trail[i].x, p.trail[i].y);
        i ? ctx.lineTo(sp.x, sp.y) : ctx.moveTo(sp.x, sp.y);
      }
      ctx.stroke();
    }
    if (p.shape === 'ball') {
      const g = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.35, r * 0.1, s.x, s.y, r);
      g.addColorStop(0, shade(p.color, 60)); g.addColorStop(1, p.color);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = shade(p.color, -40); ctx.lineWidth = 1.2; ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
      ctx.strokeStyle = shade(p.color, -40); ctx.lineWidth = 1.2; ctx.strokeRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    // 电荷标记
    if (p.charge !== 0) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(10, r)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.charge > 0 ? '+' : '−', s.x, s.y + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    // 名称
    ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif';
    ctx.fillText(p.name, s.x + r + 4, s.y - r - 2);
    // 速度箭头
    if (this.view.vel && (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01)) {
      this.arrow(s.x, s.y, s.x + p.vx * cam.scale * 0.35, s.y - p.vy * cam.scale * 0.35, '#ef4444', 2);
    }
    // 受力分析箭头
    if (p.showForces) this.drawForceArrows(p, s);
    if (p.fixed) {
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, r + 3, 0, TAU); ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  drawPolyline(pts, color, thick, dash) {
    const { ctx, cam } = this;
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = thick * cam.scale;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    const a = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a.x, a.y);
    for (let i = 1; i < pts.length; i++) { const b = cam.s(pts[i].x, pts[i].y); ctx.lineTo(b.x, b.y); }
    ctx.stroke(); ctx.setLineDash([]);
    // 阴影面（地面下方斜线）
    return pts;
  }

  drawGround(g) {
    const { ctx, cam } = this;
    if (g.type === 'arcground') return this.drawArcGround(g);
    if (g.points.length < 2) return;
    this.drawPolyline(g.points, g.color, g.thickness);
    // 地面阴影区
    ctx.fillStyle = rgba(g.color, 0.12);
    ctx.beginPath();
    const a = cam.s(g.points[0].x, g.points[0].y); ctx.moveTo(a.x, a.y);
    for (const p of g.points) { const s = cam.s(p.x, p.y); ctx.lineTo(s.x, s.y); }
    const last = g.points[g.points.length - 1], first = g.points[0];
    ctx.lineTo(cam.sx(last.x), cam.vh); ctx.lineTo(cam.sx(first.x), cam.vh); ctx.closePath(); ctx.fill();
  }

  drawArcGround(g) {
    const pts = arcPoints(g);
    this.drawPolyline(pts, g.color, g.thickness);
  }

  drawConveyor(c) {
    const { ctx, cam } = this;
    if (c.points.length < 2) return;
    // 皮带主体
    this.drawPolyline(c.points, c.color, c.thickness);
    // 运动方向条纹
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 2;
    const t = (this.running ? performance.now() / 1000 : 0) * c.velocity;
    for (let i = 0; i < c.points.length - 1; i++) {
      const a = c.points[i], b = c.points[i + 1];
      const len = V.len(V.sub(b, a));
      const seg = Math.max(2, len);
      for (let k = 0; k < seg; k += 0.5) {
        const f = ((k + t) % 0.5) / 0.5;
        if (f < 0.5) continue;
        const px = a.x + (b.x - a.x) * (k / seg);
        const py = a.y + (b.y - a.y) * (k / seg);
        const sp = cam.s(px, py);
        ctx.beginPath(); ctx.moveTo(sp.x - 3, sp.y); ctx.lineTo(sp.x + 3, sp.y); ctx.stroke();
      }
    }
    // 端点滚筒
    for (const p of [c.points[0], c.points[c.points.length - 1]]) {
      const s = cam.s(p.x, p.y);
      ctx.fillStyle = shade(c.color, -30);
      ctx.beginPath(); ctx.arc(s.x, s.y, c.thickness * cam.scale * 0.7, 0, TAU); ctx.fill();
    }
    // 速度标注
    const mid = c.points[Math.floor(c.points.length / 2)];
    const sm = cam.s(mid.x, mid.y);
    ctx.fillStyle = c.color; ctx.font = '11px sans-serif';
    ctx.fillText('v=' + fmt(c.velocity) + ' m/s', sm.x + 8, sm.y - 8);
  }

  drawSpring(sp) {
    const { ctx, cam } = this;
    const A = sp.aId ? this._objById(sp.aId) : null;
    const B = sp.bId ? this._objById(sp.bId) : null;
    const pa = A ? { x: A.x, y: A.y } : (sp.a || { x: 0, y: 0 });
    const pb = B ? { x: B.x, y: B.y } : (sp.b || { x: 1, y: 0 });
    const sa = cam.s(pa.x, pa.y), sb = cam.s(pb.x, pb.y);
    const dx = sb.x - sa.x, dy = sb.y - sa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const coils = sp.coils;
    const amp = sp.radius * cam.scale;
    ctx.strokeStyle = sp.color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    const pad = 8;
    ctx.lineTo(sa.x + ux * pad, sa.y + uy * pad);
    const inner = len - pad * 2;
    for (let i = 0; i <= coils * 2; i++) {
      const f = pad + (inner * i) / (coils * 2);
      const side = (i % 2 === 0 ? 1 : -1);
      ctx.lineTo(sa.x + ux * f + nx * amp * side, sa.y + uy * f + ny * amp * side);
    }
    ctx.lineTo(sb.x - ux * pad, sb.y - uy * pad);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    // 端点
    ctx.fillStyle = sp.color;
    for (const s of [sa, sb]) { ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill(); }
  }

  drawRope(r) {
    const { ctx, cam } = this;
    const A = r.aId ? this._objById(r.aId) : null;
    if (!A) return;
    const sa = cam.s(r.anchor.x, r.anchor.y), sb = cam.s(A.x, A.y);
    ctx.strokeStyle = r.color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = r.color; ctx.beginPath(); ctx.arc(sa.x, sa.y, 4, 0, TAU); ctx.fill();
  }

  drawEmField(f) {
    const { ctx, cam } = this;
    let x0, y0, w, h;
    if (f.shape === 'rect') { x0 = f.x; y0 = f.y; w = f.w; h = f.h; }
    else { x0 = f.x; y0 = f.y; w = f.w; h = f.h; }
    const a = cam.s(x0, y0 + h), b = cam.s(x0 + w, y0);
    // 区域填充
    ctx.fillStyle = rgba(f.color, 0.08);
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = rgba(f.color, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    // 电场线箭头
    const { Ex, Ey, B } = (f.ac ? { Ex: f.Ex * Math.sin(f.freq * (this._t || 0) * TAU), Ey: f.Ey * Math.sin(f.freq * (this._t || 0) * TAU), B: f.B * Math.sin(f.freq * (this._t || 0) * TAU) } : f);
    const cols = 4, rows = 4;
    for (let i = 1; i <= cols; i++) {
      for (let j = 1; j <= rows; j++) {
        const wx = x0 + (w * i) / (cols + 1);
        const wy = y0 + (h * j) / (rows + 1);
        const s = cam.s(wx, wy);
        if (Math.abs(Ex) > 1e-6 || Math.abs(Ey) > 1e-6) {
          this.arrow(s.x, s.y, s.x + Ex * 8, s.y - Ey * 8, f.colorE, 1.5);
        }
        if (Math.abs(B) > 1e-6) {
          ctx.strokeStyle = f.colorB; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.stroke();
          ctx.fillStyle = f.colorB; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(B > 0 ? '·' : '×', s.x, s.y + 1);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      }
    }
    ctx.fillStyle = f.color; ctx.font = 'bold 11px sans-serif';
    const lbl = `E=(${fmt(Ex)},${fmt(Ey)}) B=${fmt(B)}` + (f.ac ? ' (AC)' : '');
    ctx.fillText(lbl, a.x + 4, a.y + 13);
  }

  drawSource(s) {
    const { ctx, cam } = this;
    const sp = cam.s(s.x, s.y);
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(s.color, -40); ctx.lineWidth = 1.5; ctx.stroke();
    // 发射方向
    this.arrow(sp.x, sp.y, sp.x + Math.cos(s.angle) * 22, sp.y - Math.sin(s.angle) * 22, s.color, 2);
    ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif';
    ctx.fillText(s.name + (s.on ? '' : ' (关)'), sp.x + 12, sp.y - 10);
  }

  drawText(t) {
    const { ctx, cam } = this;
    const s = cam.s(t.x, t.y);
    let str = t.text;
    if (t.dynamic && t.expr) {
      const scope = this._scope || {};
      const v = this._eval ? this._eval(t.expr, scope) : NaN;
      str = `${t.text}${isFinite(v) ? ' = ' + fmt(v, 3) : ''}`;
    }
    ctx.fillStyle = t.color; ctx.font = `${t.size}px sans-serif`;
    ctx.fillText(str, s.x, s.y);
  }

  drawGraph(g) {
    const { ctx, cam } = this;
    const a = cam.s(g.x, g.y + g.h), b = cam.s(g.x + g.w, g.y);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    const qtyName = { s: '位移 s', v: '速度 v', a: '加速度 a', x: 'x', y: 'y', vx: 'vx', vy: 'vy' }[g.quantity] || g.quantity;
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(qtyName + '-t', (a.x + b.x) / 2, a.y + 12); ctx.textAlign = 'left';
    if (g.data.length < 2) return;
    const tMax = Math.max(g.axisT, this._t || 1);
    let vMin = Infinity, vMax = -Infinity;
    for (const d of g.data) { vMin = Math.min(vMin, d.v); vMax = Math.max(vMax, d.v); }
    if (!isFinite(vMin)) return;
    if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1; }
    const W = b.x - a.x, H = b.y - a.y;
    ctx.strokeStyle = g.color; ctx.lineWidth = 1.6; ctx.beginPath();
    g.data.forEach((d, i) => {
      const px = a.x + (d.t / tMax) * W;
      const py = b.y - ((d.v - vMin) / (vMax - vMin)) * H;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
    // 零线
    if (vMin < 0 && vMax > 0) {
      const zy = b.y - ((0 - vMin) / (vMax - vMin)) * H;
      ctx.strokeStyle = '#e2e8f0'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a.x, zy); ctx.lineTo(b.x, zy); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  arrow(x1, y1, x2, y2, color, w = 1.6) {
    const { ctx } = this;
    const a = Math.atan2(y2 - y1, x2 - x1);
    const head = 7;
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4)); ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4)); ctx.fill();
  }

  // 受力分析箭头
  drawForceArrows(p, s) {
    const { ctx, cam } = this;
    if (!p.Fg && !p.Fs && !p.Fe && !p.Fm) return;
    const sc = cam.scale * 0.08; // 力的显示比例 (N → px)
    let ox = s.x + p.radius * cam.scale + 6; // 偏移起点，避免和速度箭头重叠

    // 力的定义: [颜色, 标签, 力向量]
    const forces = [];
    if (p.Fg && (Math.abs(p.Fg.x) > 1e-8 || Math.abs(p.Fg.y) > 1e-8))
      forces.push({ c: '#22c55e', label: 'G', f: p.Fg });  // 绿色 - 重力
    if (p.Fn && (Math.abs(p.Fn.x) > 1e-8 || Math.abs(p.Fn.y) > 1e-8))
      forces.push({ c: '#06b6d4', label: 'N', f: p.Fn });   // 青色 - 支持力/法向
    if (p.Ff && (Math.abs(p.Ff.x) > 1e-8 || Math.abs(p.Ff.y) > 1e-8))
      forces.push({ c: '#f97316', label: 'f', f: p.Ff });  // 橙色 - 摩擦力
    if (p.Fs && (Math.abs(p.Fs.x) > 1e-8 || Math.abs(p.Fs.y) > 1e-8))
      forces.push({ c: '#3b82f6', label: 'F弹', f: p.Fs }); // 蓝色 - 弹力
    if (p.Fe && (Math.abs(p.Fe.x) > 1e-8 || Math.abs(p.Fe.y) > 1e-8))
      forces.push({ c: '#ef4444', label: 'Fe', f: p.Fe }); // 红色 - 电场力
    if (p.Fm && (Math.abs(p.Fm.x) > 1e-8 || Math.abs(p.Fm.y) > 1e-8))
      forces.push({ c: '#a855f7', label: 'Fm', f: p.Fm }); // 紫色 - 磁场力
    if (p.Ft && (Math.abs(p.Ft.x) > 1e-8 || Math.abs(p.Ft.y) > 1e-8))
      forces.push({ c: '#ec4899', label: 'T', f: p.Ft });  // 粉色 - 张力

    for (const { c, label, f } of forces) {
      const fx = f.x * sc, fy = -f.y * sc; // y 翻转
      this.arrow(s.x, s.y, s.x + fx, s.y + fy, c, 2.2);
      // 力标签
      ctx.fillStyle = c; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      const mx = s.x + fx * 0.5, my = s.y + fy * 0.5;
      ctx.fillText(label, mx, my - 6);
      ctx.textAlign = 'left';
    }
  }

  drawSelection(o) {
    if (!o) return;
    const { ctx, cam } = this;
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    if (o.type === 'particle') {
      const s = cam.s(o.x, o.y); const r = o.radius * cam.scale + 6;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.stroke();
    } else if (o.type === 'ground' || o.type === 'conveyor') {
      ctx.beginPath();
      const a = cam.s(o.points[0].x, o.points[0].y); ctx.moveTo(a.x, a.y);
      for (const p of o.points) { const s = cam.s(p.x, p.y); ctx.lineTo(s.x, s.y); }
      ctx.lineWidth = (o.thickness + 0.06) * cam.scale; ctx.stroke();
    } else if (o.type === 'arcground') {
      const pts = arcPoints(o); ctx.beginPath();
      const a = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a.x, a.y);
      for (const p of pts) { const s = cam.s(p.x, p.y); ctx.lineTo(s.x, s.y); }
      ctx.lineWidth = (o.thickness + 0.06) * cam.scale; ctx.stroke();
    } else if (o.type === 'spring' || o.type === 'rope') {
      const pa = o.aId ? this._objById(o.aId) : null;
      const pb = o.bId ? this._objById(o.bId) : null;
      const a = pa ? cam.s(pa.x, pa.y) : (o.a ? cam.s(o.a.x, o.a.y) : null);
      const b = pb ? cam.s(pb.x, pb.y) : (o.b ? cam.s(o.b.x, o.b.y) : (o.anchor ? cam.s(o.anchor.x, o.anchor.y) : null));
      if (!a || !b) return;
      ctx.beginPath(); ctx.moveTo(a.x - 6, a.y - 6); ctx.lineTo(a.x + 6, a.y + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x - 6, b.y - 6); ctx.lineTo(b.x + 6, b.y + 6); ctx.stroke();
    } else if (o.type === 'emfield' || o.type === 'graph') {
      const a = cam.s(o.x, o.y + o.h), b = cam.s(o.x + o.w, o.y);
      ctx.strokeRect(a.x - 2, a.y - 2, b.x - a.x + 4, b.y - a.y + 4);
    } else if (o.type === 'source' || o.type === 'text') {
      const s = cam.s(o.x, o.y);
      ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  drawPreview() {
    if (!this.preview) return;
    const { ctx, cam } = this;
    const p = this.preview;
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.globalAlpha = 0.8;
    if (p.type === 'ground' || p.type === 'conveyor') {
      ctx.beginPath();
      const a = cam.s(p.points[0].x, p.points[0].y); ctx.moveTo(a.x, a.y);
      for (const pt of p.points) { const s = cam.s(pt.x, pt.y); ctx.lineTo(s.x, s.y); }
      ctx.stroke();
    } else if (p.type === 'arcground') {
      const pts = arcPoints({ cx: p.cx, cy: p.cy, r: p.r, a0: p.a0, a1: p.a1, _seg: 24 });
      ctx.beginPath(); const a = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a.x, a.y);
      for (const pt of pts) { const s = cam.s(pt.x, pt.y); ctx.lineTo(s.x, s.y); }
      ctx.stroke();
    } else if (p.type === 'emfield' || p.type === 'graph') {
      const a = cam.s(p.x, p.y + p.h), b = cam.s(p.x + p.w, p.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (p.type === 'spring' || p.type === 'rope') {
      if (!p.a || !p.b) return;
      const a = cam.s(p.a.x, p.a.y), b = cam.s(p.b.x, p.b.y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  render(world) {
    this.clear();
    this.drawGrid();
    this.drawAxes();
    // 电磁场在底层
    for (const o of world.objects) if (o.type === 'emfield' && o.visible !== false) this.drawEmField(o);
    // 地面/传送带/圆弧
    for (const o of world.objects) if ((o.type === 'ground' || o.type === 'conveyor' || o.type === 'arcground') && o.visible !== false) this.drawGround(o);
    // 弹簧/绳
    for (const o of world.objects) if (o.type === 'spring' && o.visible !== false) this.drawSpring(o);
    for (const o of world.objects) if (o.type === 'rope' && o.visible !== false) this.drawRope(o);
    // 粒子源
    for (const o of world.objects) if (o.type === 'source' && o.visible !== false) this.drawSource(o);
    // 质点（含粒子源产生）
    for (const p of world.particles) if (p.visible !== false) this.drawParticle(p);
    for (const p of world.sourceParticles) this.drawParticle(p);
    // 文本/图像
    for (const o of world.objects) if (o.type === 'text' && o.visible !== false) this.drawText(o);
    for (const o of world.objects) if (o.type === 'graph' && o.visible !== false) this.drawGraph(o);
    // 预览 & 选中
    this.drawPreview();
    const sel = world.get(this.selected);
    if (sel) this.drawSelection(sel);
    this.drawRuler();
  }

  _objById(id) { return this._world ? this._world.get(id) : null; }
}
