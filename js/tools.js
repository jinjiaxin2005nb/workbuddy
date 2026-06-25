// ===== 工具交互：绘制 / 选择 / 拖动 / 平移 =====
import { V, clamp, uid, pointSeg, arcPoints } from './util.js';
import { make } from './world.js';

const SNAP = 0.3; // 吸附阈值(米)

export class Tools {
  constructor(canvas, camera, world, renderer) {
    this.cv = canvas; this.cam = camera; this.world = world; this.r = renderer;
    this.tool = 'select';
    this.drawing = null;      // 正在绘制的临时状态
    this.drag = null;         // 拖动状态
    this.pan = null;
    this.boxSel = null;
    this.onSelect = () => {};
    this.onCommit = () => {};
    this.onToast = () => {};
    this.onRefresh = () => {};
    this.onDirty = () => {};
    this._bind();
  }

  setTool(t) {
    this.tool = t;
    this.drawing = null;
    this.cv.style.cursor = t === 'select' ? 'default' : (t === 'pan' ? 'grab' : 'crosshair');
    this.onRefresh();
  }

  _bind() {
    const c = this.cv;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    c.addEventListener('pointerup', e => this.up(e));
    c.addEventListener('pointerleave', e => this.up(e));
    c.addEventListener('dblclick', e => this.dblclick(e));
    c.addEventListener('wheel', e => { e.preventDefault(); const f = e.deltaY > 0 ? 0.9 : 1.1; this.cam.zoom(f, e.offsetX, e.offsetY); this.onRefresh(); }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  _pos(e) {
    const rect = this.cv.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }
  _world(e) { const { sx, sy } = this._pos(e); return this.cam.w(sx, sy); }

  // 吸附：网格 + 粒子中心
  _snap(w) {
    const g = this.cam.gridStep();
    let x = Math.round(w.x / g) * g;
    let y = Math.round(w.y / g) * g;
    // 粒子吸附
    for (const p of this.world.particles) {
      if (V.dist(w, p) < SNAP) { x = p.x; y = p.y; break; }
    }
    return { x, y };
  }

  hitTest(w) {
    // 质点优先
    for (const p of [...this.world.particles].reverse()) {
      if (V.dist(w, p) <= p.radius + 0.15) return p;
    }
    for (const o of [...this.world.objects].reverse()) {
      if (o.type === 'ground' || o.type === 'conveyor' || o.type === 'arcground') {
        const pts = o.type === 'arcground' ? arcPoints(o) : o.points;
        for (let i = 0; i < pts.length - 1; i++) {
          if (pointSeg(w, pts[i], pts[i + 1]).dist <= (o.thickness || 0.12) + 0.15) return o;
        }
      } else if (o.type === 'spring' || o.type === 'rope') {
        const A = o.aId ? this.world.get(o.aId) : null;
        const a = A ? { x: A.x, y: A.y } : (o.a || o.anchor);
        const b = o.bId ? this.world.get(o.bId) : (o.b || (o.anchor ? null : null));
        const bb = o.type === 'spring' ? (o.bId ? this.world.get(o.bId) : o.b) : (o.aId ? this.world.get(o.aId) : null);
        if (o.type === 'spring') {
          if (pointSeg(w, a, bb).dist <= 0.25) return o;
        } else {
          if (pointSeg(w, o.anchor, A || { x: 0, y: 0 }).dist <= 0.25) return o;
        }
      } else if (o.type === 'emfield' || o.type === 'graph') {
        if (w.x >= o.x && w.x <= o.x + o.w && w.y >= o.y && w.y <= o.y + o.h) return o;
      } else if (o.type === 'source' || o.type === 'text') {
        if (V.dist(w, o) <= 0.4) return o;
      }
    }
    return null;
  }

  down(e) {
    const w = this._world(e);
    const sw = this._snap(w);
    if (e.button === 1 || this.tool === 'pan' || (e.button === 0 && (e.altKey || e.button === 1))) {
      this.pan = { x: e.clientX, y: e.clientY }; this.cv.style.cursor = 'grabbing'; return;
    }
    if (e.button === 2) return;

    if (this.tool === 'select') {
      if (e.shiftKey) { this.boxSel = { x0: w.x, y0: w.y, x1: w.x, y1: w.y }; return; }
      const hit = this.hitTest(w);
      this.onSelect(hit);
      if (hit) this.drag = { obj: hit, ox: hit.x, oy: hit.y, wx: w.x, wy: w.y, moved: false };
      return;
    }

    // 绘制工具
    switch (this.tool) {
      case 'particle': {
        const p = make('particle', { x: sw.x, y: sw.y });
        this.world.add(p); this.onSelect(p); this.onCommit(); this.onToast('已添加质点'); break;
      }
      case 'ground': case 'conveyor': {
        if (!this.drawing) {
          this.drawing = { type: this.tool, points: [sw] };
        } else {
          this.drawing.points.push(sw);
        }
        break;
      }
      case 'arcground': {
        if (!this.drawing) { this.drawing = { type: 'arcground', cx: sw.x, cy: sw.y, r: 0, a0: Math.PI, a1: 0, dragging: true }; }
        else { this.drawing.dragging = false; this._finishArc(); }
        break;
      }
      case 'spring': case 'rope': {
        if (!this.drawing) {
          // 第一端点：吸附粒子或自由锚点
          const hit = this.hitTest(w);
          if (hit && hit.type === 'particle') this.drawing = { type: this.tool, aId: hit.id, a: { x: hit.x, y: hit.y }, b: sw };
          else this.drawing = { type: this.tool, a: sw, b: sw };
        } else {
          const hit = this.hitTest(w);
          if (this.drawing.type === 'rope') {
            // 摆线：第二次点击设置悬挂质点（aId）
            if (hit && hit.type === 'particle') this.drawing.aId = hit.id;
            this.drawing.b = sw;
          } else {
            // 弹簧：第二次点击设置B端
            if (hit && hit.type === 'particle') this.drawing.bId = hit.id;
            this.drawing.b = sw;
          }
          this._finishSpring();
        }
        break;
      }
      case 'emfield': case 'graph': {
        this.drawing = { type: this.tool, x: sw.x, y: sw.y, w: 0, h: 0, _sx: sw.x, _sy: sw.y };
        break;
      }
      case 'source': {
        if (!this.drawing) { this.drawing = { type: 'source', x: sw.x, y: sw.y, angle: 0, _setAngle: false }; }
        else if (!this.drawing._setAngle) {
          this.drawing.angle = Math.atan2(sw.y - this.drawing.y, sw.x - this.drawing.x);
          this.drawing._setAngle = true;
          this._finishSource();
        }
        break;
      }
      case 'text': {
        const t = make('text', { x: sw.x, y: sw.y, text: '文本' });
        this.world.add(t); this.onSelect(t); this.onCommit(); this.onToast('已添加文本，可在右侧编辑'); break;
      }
    }
    this.onRefresh();
  }

  move(e) {
    if (this.pan) {
      const dx = e.clientX - this.pan.x, dy = e.clientY - this.pan.y;
      this.cam.pan(dx, dy); this.pan = { x: e.clientX, y: e.clientY }; this.onRefresh(); return;
    }
    const w = this._world(e); const sw = this._snap(w);
    if (this.drag) {
      const o = this.drag.obj;
      const dx = w.x - this.drag.wx, dy = w.y - this.drag.wy;
      if (o.type === 'particle' || o.type === 'source' || o.type === 'text') {
        o.x = this.drag.ox + dx; o.y = this.drag.oy + dy; this.drag.moved = true;
      } else if (o.type === 'emfield' || o.type === 'graph') {
        o.x = this.drag.ox + dx; o.y = this.drag.oy + dy;
      } else if (o.type === 'arcground') {
        o.cx = this.drag.ox + dx; o.cy = this.drag.oy + dy;
      } else if (o.type === 'ground' || o.type === 'conveyor') {
        for (const p of o.points) { p.x += dx; p.y += dy; }
        this.drag.wx = w.x; this.drag.wy = w.y; this.drag.moved = true; this.onRefresh(); return;
      } else if (o.type === 'spring') {
        if (!o.aId) { o.a.x = this.drag.ox + dx; o.a.y = this.drag.oy + dy; }
        if (!o.bId) { o.b.x = this.drag.ox + dx; o.b.y = this.drag.oy + dy; }
      } else if (o.type === 'rope') {
        if (!o.aId) { o.anchor.x = this.drag.ox + dx; o.anchor.y = this.drag.oy + dy; }
      }
      this.onRefresh(); return;
    }
    if (this.boxSel) { this.boxSel.x1 = w.x; this.boxSel.y1 = w.y; this.onRefresh(); return; }
    if (!this.drawing) return;
    const d = this.drawing;
    if (d.type === 'ground' || d.type === 'conveyor') {
      d._preview = sw; // 预览下一段
    } else if (d.type === 'arcground' && d.dragging) {
      d.r = V.dist({ x: d.cx, y: d.cy }, sw);
    } else if (d.type === 'emfield' || d.type === 'graph') {
      d.x = Math.min(d._sx, sw.x); d.y = Math.min(d._sy, sw.y);
      d.w = Math.abs(sw.x - d._sx); d.h = Math.abs(sw.y - d._sy);
    } else if (d.type === 'spring' || d.type === 'rope') {
      d.b = sw;
    } else if (d.type === 'source' && !d._setAngle) {
      d.angle = Math.atan2(sw.y - d.y, sw.x - d.x);
    }
    this._syncPreview();
    this.onRefresh();
  }

  up(e) {
    if (this.pan) { this.pan = null; this.cv.style.cursor = this.tool === 'pan' ? 'grab' : 'default'; return; }
    if (this.drag) {
      if (this.drag.moved) this.onCommit();
      this.drag = null; return;
    }
    if (this.boxSel) {
      const b = this.boxSel; this.boxSel = null;
      const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
      const inBox = this.world.objects.filter(o => {
        if (o.type === 'particle' || o.type === 'source' || o.type === 'text') return o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1;
        if (o.type === 'emfield' || o.type === 'graph') return o.x >= x0 && o.x + o.w <= x1 && o.y >= y0 && o.y + o.h <= y1;
        return false;
      });
      if (inBox.length) this.onSelect(inBox[0]);
      this.onRefresh(); return;
    }
    if (this.drawing && (this.drawing.type === 'emfield' || this.drawing.type === 'graph')) {
      if (this.drawing.w > 0.4 && this.drawing.h > 0.4) this._finishRect();
      else this.drawing = null;
      this.onRefresh();
    }
  }

  dblclick(e) {
    if (this.drawing && (this.drawing.type === 'ground' || this.drawing.type === 'conveyor')) {
      this.drawing.points.pop(); // 去掉双击产生的重复点
      this._finishPoly();
    }
  }

  finishDrawing() {
    if (!this.drawing) return;
    const t = this.drawing.type;
    if (t === 'ground' || t === 'conveyor') this._finishPoly();
    else if (t === 'arcground') this._finishArc();
    else if (t === 'spring' || t === 'rope') this._finishSpring();
    else this.drawing = null;
    this.onRefresh();
  }
  cancelDrawing() { this.drawing = null; this.onRefresh(); }

  _syncPreview() {
    if (!this.drawing) { this.r.preview = null; return; }
    this.r.preview = this.drawing;
  }

  _finishPoly() {
    const d = this.drawing;
    if (!d || d.points.length < 2) { this.drawing = null; this.r.preview = null; return; }
    const o = make(d.type, { points: d.points });
    this.world.add(o); this.drawing = null; this.r.preview = null;
    this.onSelect(o); this.onCommit(); this.onToast(`已添加${d.type === 'ground' ? '地面' : '传送带'}`);
  }
  _finishArc() {
    const d = this.drawing;
    if (!d || d.r < 0.3) { this.drawing = null; this.r.preview = null; return; }
    const o = make('arcground', { cx: d.cx, cy: d.cy, r: d.r, a0: d.a0, a1: d.a1 });
    this.world.add(o); this.drawing = null; this.r.preview = null;
    this.onSelect(o); this.onCommit(); this.onToast('已添加圆弧地面');
  }
  _finishRect() {
    const d = this.drawing;
    const o = make(d.type, { x: d.x, y: d.y, w: d.w, h: d.h });
    this.world.add(o); this.drawing = null; this.r.preview = null;
    this.onSelect(o); this.onCommit(); this.onToast(`已添加${d.type === 'emfield' ? '电磁场' : '函数图像'}`);
  }
  _finishSpring() {
    const d = this.drawing;
    const a = d.aId ? null : d.a;
    const b = d.bId ? null : d.b;
    const L0 = V.dist(a || this.world.get(d.aId), b || this.world.get(d.bId)) || 1;
    const o = make(d.type, d.type === 'spring'
      ? { aId: d.aId, a: d.a, bId: d.bId, b: d.b, L0 }
      : { aId: d.aId, anchor: d.a, length: L0 });
    this.world.add(o); this.drawing = null; this.r.preview = null;
    this.onSelect(o); this.onCommit(); this.onToast(`已添加${d.type === 'spring' ? '弹簧' : '摆线'}`);
  }
  _finishSource() {
    const d = this.drawing;
    const o = make('source', { x: d.x, y: d.y, angle: d.angle });
    this.world.add(o); this.drawing = null; this.r.preview = null;
    this.onSelect(o); this.onCommit(); this.onToast('已添加粒子源');
  }
}
