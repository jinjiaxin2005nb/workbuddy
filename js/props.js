// ===== 属性面板：根据选中对象动态渲染编辑表单 =====
import { PALETTE, fmt, evalExpr } from './util.js';

export class PropsPanel {
  constructor(world, renderer, callbacks) {
    this.world = world;
    this.r = renderer;
    this.cb = callbacks; // onSelect, onCommit, onRefresh, onToast
    this.body = document.getElementById('props-body');
    this.targetSel = document.getElementById('props-target');
    this.selected = null;
    // 下拉框切换对象（防循环：设置值时不触发 change）
    this._settingSel = false;
    this.targetSel.addEventListener('change', () => {
      if (this._settingSel) return;
      const id = this.targetSel.value;
      const o = id ? this.world.get(id) : null;
      if (o) this.cb.onSelect(o);
      else { this.selected = null; this.render(); }
    });
  }

  setSelected(o) {
    this.selected = o || null;
    // 更新对象切换下拉（防触发 change）
    const objs = this.world.objects;
    this._settingSel = true;
    this.targetSel.innerHTML = objs.map(x => `<option value="${x.id}">${x.name} · ${x.type}</option>`).join('');
    if (o && this.world.get(o.id)) this.targetSel.value = o.id;
    else if (!o) this.targetSel.value = '';
    requestAnimationFrame(() => { this._settingSel = false; });
    this.render();
  }

  refreshTargetList() {
    const objs = this.world.objects;
    const cur = this.selected ? this.selected.id : '';
    this._settingSel = true;
    this.targetSel.innerHTML = objs.map(x => `<option value="${x.id}">${x.name} · ${x.type}</option>`).join('');
    if (cur && this.world.get(cur)) this.targetSel.value = cur;
    else if (this.selected) { this.selected = null; this.render(); }
    requestAnimationFrame(() => { this._settingSel = false; });
  }

  clear() {
    this.selected = null;
    this.body.innerHTML = `<div class="props-empty"><p>未选中对象</p><small>点击「选择」工具，再点画布中的构件</small></div>`;
    this._settingSel = true;
    this.targetSel.innerHTML = this.world.objects.map(x => `<option value="${x.id}">${x.name} · ${x.type}</option>`).join('');
    this.targetSel.value = '';
    requestAnimationFrame(() => { this._settingSel = false; });
  }

  render() {
    const o = this.selected;
    if (!o) {
      this.body.innerHTML = `<div class="props-empty"><p>未选中对象</p><small>点击「选择」工具，再点画布中的构件</small></div>`;
      return;
    }
    const b = this.body;
    b.innerHTML = '';
    b.appendChild(this.field('名称', 'text', o.name, v => { o.name = v; this.refreshTargetList(); this.cb.onRefresh(); }));
    b.appendChild(this.colorField(o));

    switch (o.type) {
      case 'particle': this.particleFields(o, b); break;
      case 'ground': case 'conveyor': this.surfaceFields(o, b); break;
      case 'arcground': this.arcFields(o, b); break;
      case 'spring': this.springFields(o, b); break;
      case 'rope': this.ropeFields(o, b); break;
      case 'emfield': this.emFields(o, b); break;
      case 'source': this.sourceFields(o, b); break;
      case 'text': this.textFields(o, b); break;
      case 'graph': this.graphFields(o, b); break;
    }
    b.appendChild(this.visibleField(o));
  }

  // 通用字段构造器
  field(label, type, val, onInput, opts = {}) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>${label}</label>`;
    const wrap = document.createElement('div'); wrap.className = 'row';
    if (type === 'select') {
      const selEl = document.createElement('select');
      opts.options.forEach(op => { const x = document.createElement('option'); x.value = op.v; x.textContent = op.t; if (op.v == val) x.selected = true; selEl.appendChild(x); });
      selEl.addEventListener('change', () => onInput(selEl.value));
      wrap.appendChild(selEl);
    } else if (type === 'check') {
      const lbl = document.createElement('label'); lbl.className = 'chk';
      const cbx = document.createElement('input'); cbx.type = 'checkbox'; cbx.checked = !!val; cbx.addEventListener('change', () => onInput(cbx.checked));
      lbl.appendChild(cbx); lbl.appendChild(document.createTextNode(opts.text || label)); wrap.appendChild(lbl);
    } else if (type === 'textarea') {
      const ta = document.createElement('textarea'); ta.value = val; ta.rows = 3;
      ta.addEventListener('input', () => onInput(ta.value)); wrap.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = type; inp.value = val; if (opts.step) inp.step = opts.step;
      inp.addEventListener('change', () => { const v = type === 'number' ? parseFloat(inp.value) : inp.value; onInput(v); });
      inp.addEventListener('input', () => { const v = type === 'number' ? parseFloat(inp.value) : inp.value; if (!isNaN(v)) onInput(v); });
      wrap.appendChild(inp);
    }
    d.appendChild(wrap);
    if (opts.hint) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = opts.hint; d.appendChild(h); }
    return d;
  }

  colorField(o) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>颜色</label><div class="color-row"></div>`;
    const row = d.querySelector('.color-row');
    PALETTE.forEach(c => {
      const s = document.createElement('div'); s.className = 'swatch' + (c === o.color ? ' active' : ''); s.style.background = c;
      s.addEventListener('click', () => { o.color = c; this.render(); this.cb.onRefresh(); this.cb.onCommit(); });
      row.appendChild(s);
    });
    return d;
  }

  visibleField(o) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>显示</label>`;
    const lbl = document.createElement('label'); lbl.className = 'chk';
    const cbx = document.createElement('input'); cbx.type = 'checkbox'; cbx.checked = o.visible !== false;
    cbx.addEventListener('change', () => { o.visible = cbx.checked; this.cb.onRefresh(); this.cb.onCommit(); });
    lbl.appendChild(cbx); lbl.appendChild(document.createTextNode('可见')); d.appendChild(lbl);
    return d;
  }

  particleFields(o, b) {
    const title1 = document.createElement('div'); title1.className = 'sect-title'; title1.textContent = '运动学'; b.appendChild(title1);
    b.appendChild(this.field('x 坐标 (m)', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('y 坐标 (m)', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('初速度 vx (m/s)', 'number', fmt(o.vx), v => { o.vx = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('初速度 vy (m/s)', 'number', fmt(o.vy), v => { o.vy = v; this.cb.onCommit(); }, { step: 0.1 }));
    const title2 = document.createElement('div'); title2.className = 'sect-title'; title2.textContent = '物理属性'; b.appendChild(title2);
    b.appendChild(this.field('质量 m (kg)', 'number', o.mass, v => { o.mass = Math.max(0.001, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('电荷量 q (C)', 'number', o.charge, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('半径 r (m)', 'number', o.radius, v => { o.radius = Math.max(0.05, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('形状', 'select', o.shape, v => { o.shape = v; this.cb.onRefresh(); this.cb.onCommit(); }, { options: [{ v: 'ball', t: '小球' }, { v: 'block', t: '物块' }] }));
    b.appendChild(this.field('弹性系数', 'number', o.restitution, v => { o.restitution = clamp01(v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('摩擦因数', 'number', o.friction ?? 0.2, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('固定', 'check', o.fixed, v => { o.fixed = v; this.cb.onCommit(); }, { text: '固定不动（锚点）' }));
    // 受力分析开关
    b.appendChild(this.field('受力分析', 'check', !!o.showForces, v => { o.showForces = v; this.cb.onRefresh(); }, { text: '画布上显示受力箭头' }));
  }

  surfaceFields(o, b) {
    const title = document.createElement('div'); title.className = 'sect-title'; title.textContent = '表面属性'; b.appendChild(title);
    b.appendChild(this.field('摩擦系数 μ', 'number', o.friction, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('弹性系数 e', 'number', o.restitution, v => { o.restitution = clamp01(v); this.cb.onCommit(); }, { step: 0.05 }));
    if (o.type === 'conveyor') {
      b.appendChild(this.field('皮带速度 (m/s)', 'number', o.velocity, v => { o.velocity = v; this.cb.onCommit(); }, { step: 0.1 }));
    }
    b.appendChild(this.field('厚度 (m)', 'number', o.thickness, v => { o.thickness = Math.max(0.02, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.02 }));
    const n = document.createElement('div'); n.className = 'fld'; n.innerHTML = `<label>顶点数</label><div style="color:var(--muted);font-size:12px">${o.points.length} 个节点</div>`;
    b.appendChild(n);
  }

  arcFields(o, b) {
    b.appendChild(this.field('圆心 x', 'number', fmt(o.cx), v => { o.cx = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('圆心 y', 'number', fmt(o.cy), v => { o.cy = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('半径 r (m)', 'number', o.r, v => { o.r = Math.max(0.2, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('起始角 (°)', 'number', (o.a0 * 180 / Math.PI).toFixed(0), v => { o.a0 = v * Math.PI / 180; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 5 }));
    b.appendChild(this.field('终止角 (°)', 'number', (o.a1 * 180 / Math.PI).toFixed(0), v => { o.a1 = v * Math.PI / 180; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 5 }));
    b.appendChild(this.field('摩擦系数 μ', 'number', o.friction, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('弹性系数 e', 'number', o.restitution, v => { o.restitution = clamp01(v); this.cb.onCommit(); }, { step: 0.05 }));
  }

  springFields(o, b) {
    b.appendChild(this.field('劲度系数 k (N/m)', 'number', o.k, v => { o.k = Math.max(0, v); this.cb.onCommit(); }, { step: 1 }));
    b.appendChild(this.field('阻尼', 'number', o.damping, v => { o.damping = Math.max(0, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('原长 L0 (m)', 'number', o.L0, v => { o.L0 = Math.max(0.01, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('圈数', 'number', o.coils, v => { o.coils = Math.max(2, v | 0); this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.attachField('A 端', 'aId', 'a', o));
    b.appendChild(this.attachField('B 端', 'bId', 'b', o));
  }

  ropeFields(o, b) {
    b.appendChild(this.field('绳长 (m)', 'number', o.length, v => { o.length = Math.max(0.1, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('阻尼', 'number', o.damping, v => { o.damping = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.attachField('悬挂端', 'aId', 'anchor', o));
  }

  attachField(label, idKey, posKey, o) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>${label}</label>`;
    const wrap = document.createElement('div'); wrap.className = 'row';
    const selEl = document.createElement('select');
    selEl.innerHTML = `<option value="">自由锚点</option>` + this.world.particles.map(p =>
      `<option value="${p.id}" ${o[idKey] === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    selEl.addEventListener('change', () => {
      o[idKey] = selEl.value || null;
      this.cb.onRefresh(); this.cb.onCommit();
    });
    wrap.appendChild(selEl); d.appendChild(wrap);
    return d;
  }

  emFields(o, b) {
    const t = document.createElement('div'); t.className = 'sect-title'; t.textContent = '电场 E (V/m)'; b.appendChild(t);
    b.appendChild(this.field('Ex', 'number', o.Ex, v => { o.Ex = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('Ey', 'number', o.Ey, v => { o.Ey = v; this.cb.onCommit(); }, { step: 0.5 }));
    const t2 = document.createElement('div'); t2.className = 'sect-title'; t2.textContent = '磁场 B (T, z 向)'; b.appendChild(t2);
    b.appendChild(this.field('B', 'number', o.B, v => { o.B = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('交变场', 'check', o.ac, v => { o.ac = v; this.cb.onCommit(); }, { text: '启用交变 (AC)' }));
    if (o.ac) b.appendChild(this.field('频率 (Hz)', 'number', o.freq, v => { o.freq = v; this.cb.onCommit(); }, { step: 0.1 }));
    const t3 = document.createElement('div'); t3.className = 'sect-title'; t3.textContent = '区域'; b.appendChild(t3);
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('宽 w', 'number', o.w, v => { o.w = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('高 h', 'number', o.h, v => { o.h = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
  }

  sourceFields(o, b) {
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('角度 (°)', 'number', (o.angle * 180 / Math.PI).toFixed(0), v => { o.angle = v * Math.PI / 180; this.cb.onRefresh(); }, { step: 5 }));
    b.appendChild(this.field('初速 (m/s)', 'number', o.speed, v => { o.speed = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('发射率 (个/s)', 'number', o.rate, v => { o.rate = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('电荷量 q', 'number', o.charge, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('质量 m', 'number', o.mass, v => { o.mass = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('开关', 'check', o.on, v => { o.on = v; this.cb.onCommit(); }, { text: '开启发射' }));
  }

  textFields(o, b) {
    b.appendChild(this.field('内容', 'text', o.text, v => { o.text = v; this.cb.onRefresh(); this.cb.onCommit(); }));
    b.appendChild(this.field('动态表达式', 'text', o.expr || '', v => { o.expr = v; o.dynamic = !!v; this.cb.onRefresh(); }, { hint: '可用变量: t, pi, g 及质点属性(如 p1.x)' }));
    b.appendChild(this.field('字号', 'number', o.size, v => { o.size = v; this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
  }

  graphFields(o, b) {
    b.appendChild(this.field('物理量', 'select', o.quantity, v => { o.quantity = v; o.data = []; this.cb.onRefresh(); }, { options: [
      { v: 's', t: '位移大小 s' }, { v: 'v', t: '速度大小 v' }, { v: 'a', t: '加速度大小 a' },
      { v: 'x', t: 'x 坐标' }, { v: 'y', t: 'y 坐标' }, { v: 'vx', t: 'vx' }, { v: 'vy', t: 'vy' }
    ] }));
    b.appendChild(this.field('跟踪对象', 'select', o.targetId || '', v => { o.targetId = v || null; o.data = []; this.cb.onCommit(); }, { options: [
      { v: '', t: '第一个质点' }, ...this.world.particles.map(p => ({ v: p.id, t: p.name }))
    ] }));
    b.appendChild(this.field('时间范围 (s)', 'number', o.axisT, v => { o.axisT = v; this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('宽', 'number', o.w, v => { o.w = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('高', 'number', o.h, v => { o.h = v; this.cb.onRefresh(); }, { step: 0.1 }));
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
