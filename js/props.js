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
    this._settingSel = false;
    this.targetSel.addEventListener('change', () => {
      if (this._settingSel) return;
      const id = this.targetSel.value;
      const o = id ? this.world.get(id) : null;
      if (o) this.cb.onSelect(o);
      else { this.selected = null; this.render(); }
    });
  }

  onDirty() { this.cb.onRefresh(); this.cb.onCommit(); }

  setSelected(o) {
    this.selected = o || null;
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
      case 'pipe': this.pipeFields(o, b); break;
      case 'screen': this.screenFields(o, b); break;
      case 'helppoint': this.helpPointFields(o, b); break;
      case 'helpline': this.helpLineFields(o, b); break;
      case 'interpsource': this.interpSourceFields(o, b); break;
      case 'formulasource': this.formulaSourceFields(o, b); break;
      // V2 场分割线 + 多边形场
      case 'splitLine': this.splitLineFields(o, b); break;
      case 'fieldPoly': this.fieldPolyFields(o, b); break;
    }
    b.appendChild(this.visibleField(o));
  }

  // 通用字段生成器
  field(label, type, val, onInput, opts = {}) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>${label}</label>`;
    const wrap = document.createElement('div'); wrap.className = 'row';
    if (type === 'select') {
      const selEl = document.createElement('select');
      (opts.options || []).forEach(op => {
        const x = document.createElement('option');
        x.value = op.v; x.textContent = op.t;
        if (op.v === val || String(op.v) === String(val)) x.selected = true;
        selEl.appendChild(x);
      });
      selEl.addEventListener('change', () => onInput(selEl.value));
      wrap.appendChild(selEl);
    } else if (type === 'check') {
      const lbl = document.createElement('label'); lbl.className = 'chk';
      const cbx = document.createElement('input'); cbx.type = 'checkbox'; cbx.checked = !!val;
      cbx.addEventListener('change', () => onInput(cbx.checked));
      lbl.appendChild(cbx); lbl.appendChild(document.createTextNode(opts.text || label));
      wrap.appendChild(lbl);
    } else if (type === 'textarea') {
      const ta = document.createElement('textarea'); ta.value = val; ta.rows = 3;
      ta.addEventListener('input', () => onInput(ta.value));
      wrap.appendChild(ta);
    } else if (type === 'slider') {
      // 滑块控件：显示滑块 + 数值输入
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = opts.min ?? 0; slider.max = opts.max ?? 1;
      slider.step = opts.step ?? 0.05; slider.value = val;
      const numInp = document.createElement('input');
      numInp.type = 'number'; numInp.value = val;
      numInp.step = opts.step ?? 0.05;
      numInp.style.cssText = 'width:55px;font-size:12px;padding:2px 4px;';
      slider.style.cssText = 'flex:1;max-width:120px;';
      const update = (v) => {
        if (opts.min !== undefined) v = Math.max(opts.min, v);
        if (opts.max !== undefined) v = Math.min(opts.max, v);
        slider.value = v; numInp.value = Number(v).toFixed(2);
        onInput(v);
      };
      slider.addEventListener('input', () => update(parseFloat(slider.value)));
      numInp.addEventListener('change', () => update(parseFloat(numInp.value) || 0));
      wrap.appendChild(slider); wrap.appendChild(numInp);
    } else if (type === 'switch') {
      // 开关控件：类似 check 但样式不同
      const lbl = document.createElement('label'); lbl.className = 'chk';
      const sw = document.createElement('input'); sw.type = 'checkbox'; sw.checked = !!val;
      sw.addEventListener('change', () => onInput(sw.checked));
      lbl.appendChild(sw); lbl.appendChild(document.createTextNode(opts.text || label));
      wrap.appendChild(lbl);
    } else {
      const inp = document.createElement('input');
      inp.type = type; inp.value = val;
      if (opts.step) inp.step = opts.step;
      const commit = () => {
        const v = type === 'number' ? parseFloat(inp.value) : inp.value;
        if (type === 'number' && isNaN(v)) return;
        onInput(v);
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('input', commit);
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
      const s = document.createElement('div');
      s.className = 'swatch' + (c === o.color ? ' active' : '');
      s.style.background = c;
      s.addEventListener('click', () => { o.color = c; this.render(); this.cb.onRefresh(); this.cb.onCommit(); });
      row.appendChild(s);
    });
    return d;
  }

  visibleField(o) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>显示:</label>`;
    const lbl = document.createElement('label'); lbl.className = 'chk';
    const cbx = document.createElement('input'); cbx.type = 'checkbox';
    cbx.checked = o.visible !== false;
    cbx.addEventListener('change', () => { o.visible = cbx.checked; this.cb.onRefresh(); this.cb.onCommit(); });
    lbl.appendChild(cbx); lbl.appendChild(document.createTextNode('可见')); d.appendChild(lbl);
    return d;
  }

  particleFields(o, b) {
    b.appendChild(this.makeTitle('初始状态'));
    b.appendChild(this.field('x 坐标 (m)', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y 坐标 (m)', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('初速度 vx (m/s)', 'number', fmt(o.vx), v => { o.vx = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('初速度 vy (m/s)', 'number', fmt(o.vy), v => { o.vy = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.makeTitle('物理属性'));
    b.appendChild(this.field('质量 m (kg)', 'number', o.mass, v => { o.mass = Math.max(0.001, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('电荷量 q (C)', 'number', o.charge, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('半径 r (m)', 'number', o.radius, v => { o.radius = Math.max(0.05, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('形状', 'select', o.shape, v => { o.shape = v; this.cb.onRefresh(); this.cb.onCommit(); }, { options: [{ v: 'ball', t: '圆形' }, { v: 'block', t: '方块' }] }));
    b.appendChild(this.field('弹性系数', 'slider', o.restitution, v => { o.restitution = Math.max(0, Math.min(1, v)); this.cb.onCommit(); }, { min: 0, max: 1, step: 0.05 }));
    b.appendChild(this.field('摩擦系数', 'number', o.friction ?? 0.2, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('固定', 'check', o.fixed, v => { o.fixed = v; this.cb.onCommit(); }, { text: '固定此质点（不动）' }));
    b.appendChild(this.field('显示受力', 'check', !!o.showForces, v => { o.showForces = v; this.cb.onRefresh(); }, { text: '在质点上显示受力箭头' }));
  }

  surfaceFields(o, b) {
    b.appendChild(this.makeTitle('地面属性'));
    b.appendChild(this.field('动摩擦系数 μ', 'number', o.friction, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('弹性系数 e', 'slider', o.restitution, v => { o.restitution = Math.max(0, Math.min(1, v)); this.cb.onCommit(); }, { min: 0, max: 1, step: 0.05 }));
    if (o.type === 'conveyor') {
      b.appendChild(this.field('传送带速度 (m/s)', 'number', o.velocity, v => { o.velocity = v; this.cb.onCommit(); }, { step: 0.1 }));
    }
    b.appendChild(this.field('厚度 (m)', 'number', o.thickness, v => { o.thickness = Math.max(0.02, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.02 }));
    const n = document.createElement('div'); n.className = 'fld';
    n.innerHTML = `<label>顶点数</label><div style="color:var(--muted);font-size:12px">${o.points.length} 个顶点</div>`;
    b.appendChild(n);
  }

  arcFields(o, b) {
    b.appendChild(this.field('圆心 x', 'number', fmt(o.cx), v => { o.cx = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('圆心 y', 'number', fmt(o.cy), v => { o.cy = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('半径 r (m)', 'number', o.r, v => { o.r = Math.max(0.2, v); this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('起始角 (°)', 'number', (o.a0 * 180 / Math.PI).toFixed(0), v => { o.a0 = v * Math.PI / 180; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 5 }));
    b.appendChild(this.field('终止角 (°)', 'number', (o.a1 * 180 / Math.PI).toFixed(0), v => { o.a1 = v * Math.PI / 180; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 5 }));
    b.appendChild(this.field('动摩擦系数', 'number', o.friction, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('弹性系数', 'slider', o.restitution, v => { o.restitution = Math.max(0, Math.min(1, v)); this.cb.onCommit(); }, { min: 0, max: 1, step: 0.05 }));
  }

  springFields(o, b) {
    b.appendChild(this.field('劲度系数 k (N/m)', 'number', o.k, v => { o.k = Math.max(0, v); this.cb.onCommit(); }, { step: 1 }));
    b.appendChild(this.field('阻尼', 'number', o.damping, v => { o.damping = Math.max(0, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('原长 L0 (m)', 'number', o.L0, v => { o.L0 = Math.max(0.01, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('线圈数', 'number', o.coils, v => { o.coils = Math.max(2, v | 0); this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.attachSelect('A 端连接', 'aId', o, '质点'));
    b.appendChild(this.attachSelect('B 端连接', 'bId', o, '质点'));
  }

  ropeFields(o, b) {
    b.appendChild(this.field('原长 (m)', 'number', o.length, v => { o.length = Math.max(0.1, v); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('阻尼', 'number', o.damping, v => { o.damping = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.attachSelect('固定点/质点', 'aId', o, '锚点或质点'));
  }

  attachSelect(label, idKey, o, placeholder) {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>${label}</label>`;
    const wrap = document.createElement('div'); wrap.className = 'row';
    const selEl = document.createElement('select');
    let html = `<option value="">${placeholder || '选择...'}</option>`;
    this.world.particles.forEach(p => {
      html += `<option value="${p.id}" ${o[idKey] === p.id ? 'selected' : ''}>${p.name}</option>`;
    });
    selEl.innerHTML = html;
    selEl.addEventListener('change', () => {
      o[idKey] = selEl.value || null;
      this.cb.onRefresh(); this.cb.onCommit();
    });
    wrap.appendChild(selEl); d.appendChild(wrap);
    return d;
  }

  emFields(o, b) {
    b.appendChild(this.makeTitle('电场 E (V/m)'));
    b.appendChild(this.field('Ex', 'number', o.Ex, v => { o.Ex = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('Ey', 'number', o.Ey, v => { o.Ey = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.makeTitle('磁场 B (T, z方向)'));
    b.appendChild(this.field('B', 'number', o.B, v => { o.B = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('交变', 'check', o.ac, v => { o.ac = v; this.render(); this.cb.onCommit(); }, { text: '启用交变场 (AC)' }));
    if (o.ac) b.appendChild(this.field('频率 (Hz)', 'number', o.freq, v => { o.freq = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.makeTitle('位置与大小'));
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('宽 w', 'number', o.w, v => { o.w = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('高 h', 'number', o.h, v => { o.h = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
  }

  sourceFields(o, b) {
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('发射角 (°)', 'number', (o.angle * 180 / Math.PI).toFixed(0), v => { o.angle = v * Math.PI / 180; this.cb.onRefresh(); }, { step: 5 }));
    b.appendChild(this.field('初速度 (m/s)', 'number', o.speed, v => { o.speed = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('发射频率 (个/s)', 'number', o.rate, v => { o.rate = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('电荷量 q', 'number', o.charge, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('质量 m', 'number', o.mass, v => { o.mass = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('开启', 'check', o.on, v => { o.on = v; this.cb.onCommit(); }, { text: '持续发射粒子' }));
  }

  textFields(o, b) {
    b.appendChild(this.field('文字', 'text', o.text, v => { o.text = v; this.cb.onRefresh(); this.cb.onCommit(); }));
    b.appendChild(this.field('动态表达式', 'text', o.expr || '', v => { o.expr = v; o.dynamic = !!v; this.cb.onRefresh(); }, { hint: '可用变量: t, pi, g 及选中质点的属性 (如 p1.x)' }));
    b.appendChild(this.field('字号', 'number', o.size, v => { o.size = v; this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
  }

  graphFields(o, b) {
    b.appendChild(this.field('物理量', 'select', o.quantity, v => { o.quantity = v; o.data = []; this.cb.onRefresh(); }, { options: [
      { v: 's', t: '位移大小 s' }, { v: 'v', t: '速度大小 v' }, { v: 'a', t: '加速度大小 a' },
      { v: 'x', t: 'x 坐标' }, { v: 'y', t: 'y 坐标' }, { v: 'vx', t: 'vx' }, { v: 'vy', t: 'vy' }
    ] }));
    b.appendChild(this.field('目标质点', 'select', o.targetId || '', v => { o.targetId = v || null; o.data = []; this.cb.onCommit(); }, { options: [
      { v: '', t: '自动第一个质点' }, ...this.world.particles.map(p => ({ v: p.id, t: p.name }))
    ] }));
    b.appendChild(this.field('时间轴长度 (s)', 'number', o.axisT, v => { o.axisT = v; this.cb.onRefresh(); }, { step: 1 }));
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('宽', 'number', o.w, v => { o.w = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('高', 'number', o.h, v => { o.h = v; this.cb.onRefresh(); }, { step: 0.1 }));
  }

  pipeFields(o, b) {
    b.appendChild(this.makeTitle('圆管属性'));
    b.appendChild(this.field('圆心 x', 'number', fmt(o.cx), v => { o.cx = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('圆心 y', 'number', fmt(o.cy), v => { o.cy = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('外半径 r (m)', 'number', fmt(o.r), v => { o.r = Math.max(0.2, v); o.innerR = Math.min(o.innerR || v * 0.8, v - 0.1); this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('内半径 (m)', 'number', fmt(o.innerR), v => { o.innerR = Math.max(0.05, Math.min(v, o.r - 0.1)); this.cb.onRefresh(); }, { step: 0.05 }));
    b.appendChild(this.field('动摩擦系数', 'number', o.friction ?? 0.2, v => { o.friction = Math.max(0, v); this.cb.onCommit(); }, { step: 0.05 }));
    b.appendChild(this.field('弹性系数', 'number', o.restitution ?? 0.5, v => { o.restitution = Math.max(0, Math.min(1, v)); this.cb.onCommit(); }, { min: 0, max: 1, step: 0.05 }));
  }

  screenFields(o, b) {
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('宽度 (m)', 'number', fmt(o.w), v => { o.w = Math.max(0.05, v); this.cb.onRefresh(); }, { step: 0.05 }));
    b.appendChild(this.field('高度 (m)', 'number', fmt(o.h), v => { o.h = Math.max(0.2, v); this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('点迹 fading 时间 (s)', 'number', o.fadeTime ?? 3, v => { o.fadeTime = Math.max(0.5, v); }, { step: 0.5 }));
    b.appendChild(this.field('最大点迹数', 'number', o.maxHits ?? 200, v => { o.maxHits = Math.max(10, v | 0); }, { step: 20 }));
  }

  helpPointFields(o, b) {
    b.appendChild(this.field('x 坐标 (m)', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y 坐标 (m)', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('形状', 'select', o.shape || 'arc', v => { o.shape = v; this.cb.onRefresh(); }, { options: [{ v: 'arc', t: '圆形' }, { v: 'cross', t: '十字' }, { v: 'diamond', t: '菱形' }] }));
    b.appendChild(this.field('标注文字', 'text', o.text || '', v => { o.text = v; this.cb.onRefresh(); this.cb.onCommit(); }));
    b.appendChild(this.field('字号', 'number', o.size ?? 11, v => { o.size = v; this.cb.onRefresh(); }, { step: 1 }));
  }

  helpLineFields(o, b) {
    b.appendChild(this.field('端点A x', 'number', fmt(o.ax), v => { o.ax = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('端点A y', 'number', fmt(o.ay), v => { o.ay = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('端点B x', 'number', fmt(o.bx), v => { o.bx = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('端点B y', 'number', fmt(o.by), v => { o.by = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('线型', 'select', o.style || 'solid', v => { o.style = v; this.cb.onRefresh(); }, { options: [{ v: 'solid', t: '实线' }, { v: 'dashed', t: '虚线' }, { v: 'dotted', t: '点线' }] }));
    b.appendChild(this.field('箭头', 'check', !!o.arrow, v => { o.arrow = v; this.cb.onRefresh(); }, { text: '显示方向箭头' }));
    b.appendChild(this.field('标注文字', 'text', o.text || '', v => { o.text = v; this.cb.onRefresh(); this.cb.onCommit(); }));
  }

  interpSourceFields(o, b) {
    b.appendChild(this.field('点A x', 'number', fmt(o.ax), v => { o.ax = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('点A y', 'number', fmt(o.ay), v => { o.ay = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('点B x', 'number', fmt(o.bx), v => { o.bx = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('点B y', 'number', fmt(o.by), v => { o.by = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('发射角 (°)', 'number', (o.angle * 180 / Math.PI).toFixed(0), v => { o.angle = v * Math.PI / 180; this.cb.onRefresh(); }, { step: 5 }));
    b.appendChild(this.field('初速度 (m/s)', 'number', o.speed ?? 3, v => { o.speed = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('发射频率 (个/s)', 'number', o.rate ?? 4, v => { o.rate = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('每组粒子数', 'number', o.count ?? 5, v => { o.count = Math.max(1, v | 0); }, { step: 1 }));
    b.appendChild(this.field('电荷量 q', 'number', o.charge ?? 0, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('质量 m', 'number', o.mass ?? 1, v => { o.mass = v; this.cb.onCommit(); }, { step: 0.1 }));
  }

  formulaSourceFields(o, b) {
    b.appendChild(this.field('x', 'number', fmt(o.x), v => { o.x = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('y', 'number', fmt(o.y), v => { o.y = v; this.cb.onRefresh(); }, { step: 0.1 }));
    b.appendChild(this.field('发射角 (°)', 'number', (o.angle * 180 / Math.PI).toFixed(0), v => { o.angle = v * Math.PI / 180; this.cb.onRefresh(); }, { step: 5 }));
    b.appendChild(this.field('发射频率 (个/s)', 'number', o.rate ?? 2, v => { o.rate = v; this.cb.onCommit(); }, { step: 0.5 }));
    b.appendChild(this.field('vx 表达式', 'textarea', o.vxExpr || '', v => { o.vxExpr = v; this.cb.onCommit(); }, { hint: '可用变量: t(时间), pi, sin/cos 例如: 3*cos(t*2)' }));
    b.appendChild(this.field('vy 表达式', 'textarea', o.vyExpr || '', v => { o.vyExpr = v; this.cb.onCommit(); }, { hint: '可用变量: t(时间), pi, sin/cos 例如: 3*sin(t*2)' }));
    b.appendChild(this.field('电荷量 q', 'number', o.charge ?? 0, v => { o.charge = v; this.cb.onCommit(); }, { step: 0.1 }));
    b.appendChild(this.field('质量 m', 'number', o.mass ?? 1, v => { o.mass = v; this.cb.onCommit(); }, { step: 0.1 }));
  }

  // ===== 场分割线属性面板 =====
  splitLineFields(o, b) {
    b.appendChild(this.makeTitle('场分割线'));
    const shapeMap = { line: '直线', circle: '圆形', rect: '矩形' };
    const shapeOpts = Object.entries(shapeMap).map(([v, t]) => ({ v, t }));
    b.appendChild(this.field('形状', 'select', o.shape || 'line', v => {
      o.shape = v; this.render(); this.onDirty();
    }, { options: shapeOpts }));

    const shape = o.shape || 'line';
    if (shape === 'line') {
      b.appendChild(this.field('起点 X', 'number', o.x1 || 0, v => { o.x1 = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('起点 Y', 'number', o.y1 || 0, v => { o.y1 = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('终点 X', 'number', o.x2 || 1, v => { o.x2 = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('终点 Y', 'number', o.y2 || 1, v => { o.y2 = v; this.onDirty(); }, { step: 0.1 }));
    } else if (shape === 'arc') {
      b.appendChild(this.field('圆心 X', 'number', o.cx || 0, v => { o.cx = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('圆心 Y', 'number', o.cy || 0, v => { o.cy = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('半径', 'number', o.r || 2, v => { o.r = Math.max(0.1, v); this.onDirty(); }, { step: 0.1 }));
    } else if (shape === 'rect') {
      b.appendChild(this.field('左上 X', 'number', o.rx || -2, v => { o.rx = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('左上 Y', 'number', o.ry || -2, v => { o.ry = v; this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('宽度', 'number', o.rw || 4, v => { o.rw = Math.max(0.1, v); this.onDirty(); }, { step: 0.1 }));
      b.appendChild(this.field('高度', 'number', o.rh || 4, v => { o.rh = Math.max(0.1, v); this.onDirty(); }, { step: 0.1 }));
    }
  }

  // ===== 多边形场属性面板 =====
  fieldPolyFields(o, b) {
    b.appendChild(this.makeTitle('多边形场'));
    const typeOpts = [
      { v: 'efield', t: '电场 E' },
      { v: 'bfield', t: '磁场 B' },
      { v: 'acefield', t: '交变电场' },
      { v: 'acbfield', t: '交变磁场' }
    ];
    b.appendChild(this.field('场类型', 'select', o.fieldType || 'efield', v => {
      o.fieldType = v; this.render(); this.onDirty();
    }, { options: typeOpts }));

    b.appendChild(this.field('Ex (x方向场强)', 'number', o.Ex || 0, v => { o.Ex = v; this.onDirty(); }, { step: 0.5 }));
    b.appendChild(this.field('Ey (y方向场强)', 'number', o.Ey || 0, v => { o.Ey = v; this.onDirty(); }, { step: 0.5 }));
    b.appendChild(this.field('B (磁感应强度)', 'number', o.B || 0, v => { o.B = v; this.onDirty(); }, { step: 0.1 }));
    b.appendChild(this.field('交变', 'check', !!o.ac, v => { o.ac = v; this.render(); this.onDirty(); }, { text: '启用交变' }));
    if (o.ac) {
      b.appendChild(this.field('频率 (Hz)', 'number', o.freq || 1, v => { o.freq = v; this.onDirty(); }, { step: 0.1 }));
    }
    // 多边形顶点显示
    if (o.polygon && o.polygon.length >= 3) {
      const div = document.createElement('div');
      div.className = 'sect-title';
      div.textContent = `多边形（${o.polygon.length} 顶点）`;
      b.appendChild(div);
      const pre = document.createElement('pre');
      pre.style.cssText = 'font-size:10px;max-height:80px;overflow:auto;background:#f8fafc;padding:4px;border-radius:4px;';
      pre.textContent = o.polygon.map((p, i) => `${i}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join('\n');
      b.appendChild(pre);
    }
  }

  makeTitle(text) {
    const t = document.createElement('div');
    t.className = 'sect-title';
    t.textContent = text;
    return t;
  }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
