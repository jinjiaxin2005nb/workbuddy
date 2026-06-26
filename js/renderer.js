// ===== 渲染器：网格 / 坐标轴 / 对象绘制 =====
import { V, TAU, fmt, shade, rgba, arcPoints } from './util.js';
import { getSplitSegments } from './world.js';

export class Renderer {
  constructor(ctx, camera) {
    this.ctx = ctx; this.cam = camera;
    this.view = { grid: true, axis: true, ruler: true, trail: true, vel: true };
    this.preview = null;
    this.selected = null;
    this.hover = null;
    this.running = false;
    this._eval = null;
    this._world = null;
  }

  clear() {
    const { ctx, cam } = this;
    ctx.clearRect(0, 0, cam.vw, cam.vh);
    ctx.fillStyle = '#fbfcfe'; ctx.fillRect(0, 0, cam.vw, cam.vh);
  }

  drawGrid() {
    if (!this.view.grid) return;
    const { ctx, cam } = this;
    const step = cam.gridStep();
    const left = cam.wx(0), right = cam.wx(cam.vw);
    const bottom = cam.wy(cam.vh), top = cam.wy(0);
    const minor = step, major = step * 5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#eef2f7'; ctx.beginPath();
    for (let x = Math.floor(left / minor) * minor; x <= right; x += minor) {
      const sx = cam.sx(x); ctx.moveTo(sx, 0); ctx.lineTo(sx, cam.vh);
    }
    for (let y = Math.floor(bottom / minor) * minor; y <= top; y += minor) {
      const sy = cam.sy(y); ctx.moveTo(0, sy); ctx.lineTo(cam.vw, sy);
    }
    ctx.stroke();
    ctx.strokeStyle = '#dde4ed'; ctx.beginPath();
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
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(cam.vw, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, cam.vh); ctx.stroke();
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px sans-serif';
    ctx.fillText('x', cam.vw - 14, oy - 6); ctx.fillText('y', ox + 6, 14);
    const step = cam.gridStep() * 5;
    // 计算视图边界（世界坐标）
    const left = cam.wx(0), right = cam.wx(cam.vw);
    const bottom = cam.wy(cam.vh), top = cam.wy(0);
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      const sx = cam.sx(x);
      ctx.beginPath(); ctx.moveTo(sx, oy - 3); ctx.lineTo(sx, oy + 3); ctx.stroke();
      ctx.fillText(fmt(x, 0), sx, oy + 14);
    }
    ctx.textAlign = 'right';
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
    const step = cam.gridStep() * (cam.gridStep() < 1 ? 5 : 1);
    const px = step * cam.scale;
    const x = 24, y = cam.vh - 64;
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + px, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.moveTo(x + px, y - 4); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fmt(step, step < 1 ? 2 : 0) + ' m', x + px / 2, y + 16);
    ctx.textAlign = 'left';
  }

  drawParticle(p) {
    const { ctx, cam } = this;
    const s = cam.s(p.x, p.y);
    const r = p.radius * cam.scale;
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
    if (p.charge !== 0) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(10, r)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.charge > 0 ? '+' : '−', s.x, s.y + 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif';
    ctx.fillText(p.name, s.x + r + 4, s.y - r - 2);
    if (this.view.vel && (Math.abs(p.vx) > 0.01 || Math.abs(p.vy) > 0.01)) {
      this.arrow(s.x, s.y, s.x + p.vx * cam.scale * 0.35, s.y - p.vy * cam.scale * 0.35, '#ef4444', 2);
    }
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
    for (const p of pts) { const s = cam.s(p.x, p.y); ctx.lineTo(s.x, s.y); }
    ctx.stroke(); ctx.setLineDash([]);
    return pts;
  }

  drawGround(g) {
    const { ctx, cam } = this;
    if (g.type === 'arcground') return this.drawArcGround(g);
    if (g.points.length < 2) return;
    this.drawPolyline(g.points, g.color, g.thickness);
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
    this.drawPolyline(c.points, c.color, c.thickness);
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
    for (const p of [c.points[0], c.points[c.points.length - 1]]) {
      const s = cam.s(p.x, p.y);
      ctx.fillStyle = shade(c.color, -30);
      ctx.beginPath(); ctx.arc(s.x, s.y, c.thickness * cam.scale * 0.7, 0, TAU); ctx.fill();
    }
    const mid = c.points[Math.floor(c.points.length / 2)];
    const sm = cam.s(mid.x, mid.y);
    ctx.fillStyle = c.color; ctx.font = '11px sans-serif';
    ctx.fillText('v=' + fmt(c.velocity) + ' m/s', sm.x + 8, sm.y - 8);
  }

  drawSpring(sp) {
    const { ctx, cam } = this;
    const A = sp.aId ? this._objById(sp.aId) : null;
    const Bp = sp.bId ? this._objById(sp.bId) : null;
    const pa = A ? { x: A.x, y: A.y } : (sp.a || { x: 0, y: 0 });
    const pb = Bp ? { x: Bp.x, y: Bp.y } : (sp.b || { x: 1, y: 0 });
    const sa = cam.s(pa.x, pa.y), sb = cam.s(pb.x, pb.y);
    const dx = sb.x - sa.x, dy = sb.y - sa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const coils = sp.coils;
    const amp = sp.radius * cam.scale;
    ctx.strokeStyle = sp.color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y);
    const pad = 8; ctx.lineTo(sa.x + ux * pad, sa.y + uy * pad);
    const inner = len - pad * 2;
    for (let i = 0; i <= coils * 2; i++) {
      const f = pad + (inner * i) / (coils * 2);
      const side = (i % 2 === 0 ? 1 : -1);
      ctx.lineTo(sa.x + ux * f + nx * amp * side, sa.y + uy * f + ny * amp * side);
    }
    ctx.lineTo(sb.x - ux * pad, sb.y - uy * pad); ctx.lineTo(sb.x, sb.y); ctx.stroke();
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
    ctx.fillStyle = rgba(f.color, 0.08);
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = rgba(f.color, 0.5); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    // 交变场：动态计算场强
    const Ex = f.ac ? f.Ex * Math.sin(f.freq * (this._t || 0) * 2 * Math.PI) : f.Ex;
    const Ey = f.ac ? f.Ey * Math.sin(f.freq * (this._t || 0) * 2 * Math.PI) : f.Ey;
    const B = f.ac ? f.B * Math.sin(f.freq * (this._t || 0) * 2 * Math.PI) : f.B;
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

  drawForceArrows(p, s) {
    const { ctx, cam } = this;
    if (!p.Fg && !p.Fs && !p.Fe && !p.Fm) return;
    const sc = cam.scale * 0.08;
    let ox = s.x + p.radius * cam.scale + 6;
    const forces = [];
    if (p.Fg && (Math.abs(p.Fg.x) > 1e-8 || Math.abs(p.Fg.y) > 1e-8))
      forces.push({ c: '#22c55e', label: 'G', f: p.Fg });
    if (p.Fn && (Math.abs(p.Fn.x) > 1e-8 || Math.abs(p.Fn.y) > 1e-8))
      forces.push({ c: '#06b6d4', label: 'N', f: p.Fn });
    if (p.Ff && (Math.abs(p.Ff.x) > 1e-8 || Math.abs(p.Ff.y) > 1e-8))
      forces.push({ c: '#f97316', label: 'f', f: p.Ff });
    if (p.Fs && (Math.abs(p.Fs.x) > 1e-8 || Math.abs(p.Fs.y) > 1e-8))
      forces.push({ c: '#3b82f6', label: 'F弹', f: p.Fs });
    if (p.Fe && (Math.abs(p.Fe.x) > 1e-8 || Math.abs(p.Fe.y) > 1e-8))
      forces.push({ c: '#ef4444', label: 'Fe', f: p.Fe });
    if (p.Fm && (Math.abs(p.Fm.x) > 1e-8 || Math.abs(p.Fm.y) > 1e-8))
      forces.push({ c: '#a855f7', label: 'Fm', f: p.Fm });
    if (p.Ft && (Math.abs(p.Ft.x) > 1e-8 || Math.abs(p.Ft.y) > 1e-8))
      forces.push({ c: '#ec4899', label: 'T', f: p.Ft });
    for (const { c, label, f } of forces) {
      const fx = f.x * sc, fy = -f.y * sc;
      this.arrow(s.x, s.y, s.x + fx, s.y + fy, c, 2.2);
      ctx.fillStyle = c; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      const mx = s.x + fx * 0.5, my = s.y + fy * 0.5;
      ctx.fillText(label, mx, my - 6);
      ctx.textAlign = 'left';
    }
  }

  // ===== 场分割线绘制 =====
  drawSplitLine(o) {
    const { ctx, cam } = this;
    const segs = getSplitSegments(o);
    ctx.strokeStyle = o.color || '#f59e0b'; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath();
    for (const s of segs) {
      const a = cam.s(s.p1.x, s.p1.y), b = cam.s(s.p2.x, s.p2.y);
      if (s === segs[0]) ctx.moveTo(a.x, a.y); else ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    const mid = segs[Math.floor(segs.length / 2)];
    if (mid) {
      const mpt = cam.s((mid.p1.x + mid.p2.x) / 2, (mid.p1.y + mid.p2.y) / 2);
      ctx.fillStyle = '#f59e0b'; ctx.font = '10px sans-serif';
      ctx.fillText('分割线', mpt.x + 4, mpt.y - 4);
    }
  }

  // ===== 多边形场绘制 =====
  drawFieldPoly(o) {
    const { ctx, cam } = this;
    if (!o.polygon || o.polygon.length < 3) return;
    const pts = o.polygon;
    const fillColor = (o.fieldType === 'bfield' || o.fieldType === 'acbfield')
      ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)';
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    const a0 = cam.s(pts[0].x, pts[0].y);
    ctx.moveTo(a0.x, a0.y);
    for (let i = 1; i < pts.length; i++) {
      const sp = cam.s(pts[i].x, pts[i].y); ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath(); ctx.fill();
    const strokeColor = (o.fieldType === 'bfield' || o.fieldType === 'acbfield')
      ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)';
    ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5;
    ctx.setLineDash(o.ac ? [5, 3] : []);
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    for (let i = 1; i < pts.length; i++) { const sp = cam.s(pts[i].x, pts[i].y); ctx.lineTo(sp.x, sp.y); }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    this._drawFieldArrows(o);
  }

  _drawFieldArrows(o) {
    const { ctx, cam } = this;
    if (!o.polygon || o.polygon.length < 3) return;
    const pts = o.polygon;
    const center = { x: 0, y: 0 };
    for (const p of pts) { center.x += p.x; center.y += p.y; }
    center.x /= pts.length; center.y /= pts.length;
    const sx = cam.sx(center.x), sy = cam.sy(center.y);
    if (o.fieldType === 'efield' || o.fieldType === 'acefield') {
      if (Math.abs(o.Ex) > 1e-6 || Math.abs(o.Ey) > 1e-6) {
        this.arrow(sx, sy, sx + o.Ex * 8, sy - o.Ey * 8,
          o.fieldType === 'acefield' ? 'rgba(239,68,68,0.5)' : '#ef4444', 1.5);
      }
    }
    if (o.fieldType === 'bfield' || o.fieldType === 'acbfield') {
      if (Math.abs(o.B) > 1e-6) {
        ctx.strokeStyle = o.fieldType === 'acbfield' ? 'rgba(59,130,246,0.5)' : '#3b82f6';
        ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 2 * Math.PI); ctx.stroke();
        ctx.fillStyle = o.fieldType === 'acbfield' ? 'rgba(59,130,246,0.5)' : '#3b82f6';
        ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(o.B > 0 ? '·' : '×', sx, sy + 1);
      }
    }
    const label = { efield: 'E场', bfield: 'B场', acefield: 'E~场', acbfield: 'B~场' }[o.fieldType] || '场';
    ctx.fillStyle = '#64748b'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, sx, sy - 14);
    ctx.textAlign = 'left';
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
    } else if (o.type === 'source' || o.type === 'text' || o.type === 'helppoint' || o.type === 'formulasource') {
      const s = cam.s(o.x, o.y);
      ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, TAU); ctx.stroke();
    } else if (o.type === 'pipe') {
      const pts = arcPoints(o); ctx.beginPath();
      const a = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a.x, a.y);
      for (const p of pts) { const s2 = cam.s(p.x, p.y); ctx.lineTo(s2.x, s2.y); }
      ctx.lineWidth = (o.thickness || 0.10) * cam.scale + 4; ctx.stroke();
      if (o.innerR > 0.1) {
        const innerPts = arcPoints({ cx: o.cx, cy: o.cy, r: o.innerR, a0: o.a0, a1: o.a1, _seg: o._seg || 32 });
        ctx.beginPath();
        const ia = cam.s(innerPts[0].x, innerPts[0].y); ctx.moveTo(ia.x, ia.y);
        for (const p of innerPts) { const s3 = cam.s(p.x, p.y); ctx.lineTo(s3.x, s3.y); }
        ctx.stroke();
      }
    } else if (o.type === 'screen') {
      const a = cam.s(o.x, o.y + o.h), b = cam.s(o.x + o.w, o.y);
      ctx.strokeRect(a.x - 2, a.y - 2, b.x - a.x + 4, b.y - a.y + 4);
    } else if (o.type === 'helpline' || o.type === 'interpsource') {
      const sa = cam.s(o.ax || o.x, o.ay || o.y), sb = cam.s(o.bx || o.x, o.by || o.y);
      ctx.beginPath(); ctx.moveTo(sa.x - 6, sa.y - 6); ctx.lineTo(sa.x + 6, sa.y + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sb.x - 6, sb.y - 6); ctx.lineTo(sb.x + 6, sb.y + 6); ctx.stroke();
    } else if (o.type === 'splitLine') {
      const segs = getSplitSegments(o);
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = (o.thickness || 0.12) * cam.scale + 4;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      for (const s of segs) {
        const a = cam.s(s.p1.x, s.p1.y), b = cam.s(s.p2.x, s.p2.y);
        if (s === segs[0]) ctx.moveTo(a.x, a.y); else ctx.lineTo(b.x, b.y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    } else if (o.type === 'fieldPoly') {
      if (o.polygon && o.polygon.length >= 3) {
        ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        ctx.beginPath();
        const a0 = cam.s(o.polygon[0].x, o.polygon[0].y);
        ctx.moveTo(a0.x, a0.y);
        for (let i = 1; i < o.polygon.length; i++) {
          const sp = cam.s(o.polygon[i].x, o.polygon[i].y); ctx.lineTo(sp.x, sp.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      }
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
    } else if (p.type === 'splitLine') {
      const shape = p.shape || 'line';
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.7;
      if (shape === 'line') {
        if (!p.x2 && !p.y2) return;
        const a = cam.s(p.x1 || 0, p.y1 || 0), b = cam.s(p.x2 || 1, p.y2 || 1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else if (shape === 'circle') {
        if (!p.r && p.r !== 0) return;
        const c = cam.s(p.cx || 0, p.cy || 0);
        const rr = (p.r || 1) * cam.scale;
        ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, 2 * Math.PI); ctx.stroke();
      } else if (shape === 'rect') {
        if (typeof p.rw !== 'number' || typeof p.rh !== 'number') return;
        const x0 = cam.sx(p.rx || 0), y0 = cam.sy(p.ry || 0);
        const w = (p.rw || 2) * cam.scale, h = (p.rh || 2) * cam.scale;
        ctx.strokeRect(x0, y0 - h, w, h);
      }
      ctx.globalAlpha = 1;
    } else if (p.type === 'fillfield') {
      const wld = this._world;
      const polys = wld && wld._polygons || [];
      if (polys.length > 0) {
        ctx.fillStyle = 'rgba(59,130,246,0.08)';
        ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        for (const poly of polys) {
          if (!poly.pts || poly.pts.length < 3) continue;
          ctx.beginPath();
          const a0 = cam.s(poly.pts[0].x, poly.pts[0].y);
          ctx.moveTo(a0.x, a0.y);
          for (let i = 1; i < poly.pts.length; i++) {
            const sp = cam.s(poly.pts[i].x, poly.pts[i].y); ctx.lineTo(sp.x, sp.y);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if (p._previewPoly) {
        ctx.fillStyle = 'rgba(59,130,246,0.18)';
        ctx.beginPath();
        const a0 = cam.s(p._previewPoly[0].x, p._previewPoly[0].y);
        ctx.moveTo(a0.x, a0.y);
        for (let i = 1; i < p._previewPoly.length; i++) {
          const sp = cam.s(p._previewPoly[i].x, p._previewPoly[i].y); ctx.lineTo(sp.x, sp.y);
        }
        ctx.closePath(); ctx.fill();
      }
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
    } else if (p.type === 'pipe') {
      if (!p.r) return;
      const pts = arcPoints({ cx: p.cx || 0, cy: p.cy || 0, r: p.r, a0: Math.PI, a1: 0, _seg: 24 });
      ctx.beginPath(); const a = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a.x, a.y);
      for (const pt of pts) { const s = cam.s(pt.x, pt.y); ctx.lineTo(s.x, s.y); }
      ctx.stroke();
    } else if (p.type === 'screen' || p.type === 'emfield' || p.type === 'graph') {
      if (typeof p.w === 'undefined' || typeof p.h === 'undefined') return;
      const a = cam.s(p.x, p.y + p.h), b = cam.s(p.x + p.w, p.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (p.type === 'helppoint' || p.type === 'formulasource' || p.type === 'source') {
      const s = cam.s(p.x || 0, p.y || 0);
      ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, TAU); ctx.stroke();
    } else if (p.type === 'helpline' || p.type === 'interpsource') {
      if (!p.a) return;
      const a = cam.s(p.ax || p.a.x, p.ay || p.a.y), b = cam.s(p.bx || p.b?.x, p.by || p.b?.y || p.ay || p.a.y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  render(world) {
    this.clear();
    this.drawGrid();
    this.drawAxes();
    for (const o of world.objects) if (o.type === 'emfield' && o.visible !== false) this.drawEmField(o);
    for (const o of world.objects) if ((o.type === 'ground' || o.type === 'conveyor' || o.type === 'arcground') && o.visible !== false) this.drawGround(o);
    for (const o of world.objects) if (o.type === 'spring' && o.visible !== false) this.drawSpring(o);
    for (const o of world.objects) if (o.type === 'rope' && o.visible !== false) this.drawRope(o);
    for (const o of world.objects) if (o.type === 'source' && o.visible !== false) this.drawSource(o);
    for (const p of world.particles) if (p.visible !== false) this.drawParticle(p);
    for (const p of world.sourceParticles) this.drawParticle(p);
    for (const o of world.objects) if (o.type === 'text' && o.visible !== false) this.drawText(o);
    for (const o of world.objects) if (o.type === 'graph' && o.visible !== false) this.drawGraph(o);
    this.drawPreview();
    const sel = world.get(this.selected);
    if (sel) this.drawSelection(sel);
    // V2 新增对象
    for (const o of world.objects) if (o.type === 'pipe' && o.visible !== false) this.drawPipe(o);
    for (const o of world.objects) if (o.type === 'screen' && o.visible !== false) this.drawScreen(o);
    for (const o of world.objects) if (o.type === 'helppoint' && o.visible !== false) this.drawHelpPoint(o);
    for (const o of world.objects) if (o.type === 'helpline' && o.visible !== false) this.drawHelpLine(o);
    for (const o of world.objects) if (o.type === 'interpsource' && o.visible !== false) this.drawInterpSource(o);
    for (const o of world.objects) if (o.type === 'formulasource' && o.visible !== false) this.drawFormulaSource(o);
    // 场分割线 + 多边形场
    for (const o of world.objects) if (o.type === 'splitLine' && o.visible !== false) this.drawSplitLine(o);
    for (const o of world.objects) if (o.type === 'fieldPoly' && o.visible !== false) this.drawFieldPoly(o);
    this.drawRuler();
  }

  // ===== V2 新增绘制函数 =====
  drawPipe(pipe) {
    const { ctx, cam } = this;
    const pts = arcPoints({ cx: pipe.cx, cy: pipe.cy, r: pipe.r, a0: pipe.a0, a1: pipe.a1, _seg: pipe._seg || 32 });
    ctx.strokeStyle = pipe.color; ctx.lineWidth = (pipe.thickness || 0.10) * cam.scale;
    ctx.lineCap = 'round'; ctx.beginPath();
    const a0 = cam.s(pts[0].x, pts[0].y); ctx.moveTo(a0.x, a0.y);
    for (let i = 1; i < pts.length; i++) { const s = cam.s(pts[i].x, pts[i].y); ctx.lineTo(s.x, s.y); }
    ctx.stroke();
    if (pipe.innerR > 0.1) {
      const innerPts = arcPoints({ cx: pipe.cx, cy: pipe.cy, r: pipe.innerR, a0: pipe.a0, a1: pipe.a1, _seg: pipe._seg || 32 });
      ctx.strokeStyle = rgba(pipe.color, 0.4); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      const ia0 = cam.s(innerPts[0].x, innerPts[0].y); ctx.moveTo(ia0.x, ia0.y);
      for (let i = 1; i < innerPts.length; i++) { const s = cam.s(innerPts[i].x, innerPts[i].y); ctx.lineTo(s.x, s.y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    const mc = cam.s(pipe.cx, pipe.cy);
    ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('圆管 r=' + fmt(pipe.r), mc.x, mc.y - pipe.r * cam.scale - 8);
  }

  drawScreen(scr) {
    const { ctx, cam } = this;
    const a = cam.s(scr.x, scr.y + scr.h), b = cam.s(scr.x + scr.w, scr.y);
    ctx.fillStyle = rgba('#22c55e', 0.08); ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.setLineDash([]);
    for (const h of scr.hits) {
      const age = this._t ? (this._t - h.t) : 0;
      const alpha = Math.max(0.15, 1 - age / (scr.fadeTime || 3));
      const hs = cam.s(h.x, h.y);
      const hr = (h.radius || 0.15) * cam.scale * (1 - age / (scr.fadeTime * 2));
      if (hr > 1) {
        ctx.fillStyle = rgba(h.color || '#22c55e', alpha);
        ctx.beginPath(); ctx.arc(hs.x, hs.y, Math.max(1, hr), 0, TAU); ctx.fill();
      }
    }
    const mc = cam.s(scr.x + scr.w / 2, scr.y + scr.h / 2);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('荧光屏', mc.x, mc.y - 5);
  }

  drawHelpPoint(pt) {
    const { ctx, cam } = this;
    const s = cam.s(pt.x, pt.y);
    const r = (pt.radius || 0.12) * cam.scale;
    ctx.fillStyle = rgba(pt.color, 0.7); ctx.strokeStyle = pt.color; ctx.lineWidth = 1.5;
    if (pt.shape === 'cross') {
      ctx.beginPath(); ctx.moveTo(s.x - r, s.y); ctx.lineTo(s.x + r, s.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x, s.y + r); ctx.stroke();
    } else if (pt.shape === 'diamond') {
      ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    }
    if (pt.text) {
      ctx.fillStyle = pt.color; ctx.font = `${pt.size || 11}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(pt.text, s.x + r + 3, s.y - r - 2);
    }
  }

  drawHelpLine(ln) {
    const { ctx, cam } = this;
    const sa = cam.s(ln.ax, ln.ay), sb = cam.s(ln.bx, ln.by);
    ctx.strokeStyle = ln.color || '#f59e0b'; ctx.lineWidth = 1.5;
    if (ln.style === 'dashed') ctx.setLineDash([6, 4]);
    else if (ln.style === 'dotted') ctx.setLineDash([2, 3]);
    else ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke(); ctx.setLineDash([]);
    if (ln.arrow) { this.arrow(sa.x, sa.y, sb.x, sb.y, ln.color || '#f59e0b', 1.5); }
    if (ln.text) {
      const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
      ctx.fillStyle = ln.color || '#f59e0b'; ctx.font = `${ln.size || 11}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(ln.text, mx + 5, my - 5);
    }
  }

  drawInterpSource(src) {
    const { ctx, cam } = this;
    const sa = cam.s(src.ax, src.ay), sb = cam.s(src.bx, src.by);
    ctx.strokeStyle = rgba(src.color, 0.35); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < (src.count || 5); i++) {
      const fx = src.ax + (src.bx - src.ax) * (i / Math.max(1, (src.count || 5) - 1));
      const fy = src.ay + (src.by - src.ay) * (i / Math.max(1, (src.count || 5) - 1));
      const fs = cam.s(fx, fy);
      ctx.fillStyle = src.color; ctx.beginPath(); ctx.arc(fs.x, fs.y, 4, 0, TAU); ctx.fill();
    }
    this.drawSource({
      x: (src.ax + src.bx) / 2, y: (src.ay + src.by) / 2,
      angle: src.angle, name: src.name || '插值粒子源', color: src.color, on: src.on,
    });
  }

  drawFormulaSource(src) {
    const { ctx, cam } = this;
    const sp = cam.s(src.x, src.y);
    ctx.fillStyle = src.color; ctx.beginPath(); ctx.arc(sp.x, sp.y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(src.color, -40); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, 9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('f', sp.x, sp.y + 1);
    this.arrow(sp.x, sp.y, sp.x + Math.cos(src.angle) * 22, sp.y - Math.sin(src.angle) * 22, src.color, 2);
    ctx.fillStyle = '#334155'; ctx.font = '11px sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(src.name + (src.on ? '' : ' (关)'), sp.x + 12, sp.y - 10);
    ctx.fillStyle = '#ec4899'; ctx.font = '9px monospace';
    ctx.fillText(`vx=${src.vxExpr}`, sp.x + 12, sp.y + 2);
  }

  _objById(id) {
    const w = this._world;
    return w ? w.get(id) : null;
  }
}
