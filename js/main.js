// ===== 主入口：装配 / 仿真循环 / UI 交互 =====
import { Camera } from './camera.js';
import { World, make, GRAVITY_DEFAULT } from './world.js';
import { Renderer } from './renderer.js';
import { Tools } from './tools.js';
import { PropsPanel } from './props.js';
import { evalExpr, TAU } from './util.js';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const cam = new Camera();
const world = new World();
const renderer = new Renderer(ctx, cam);
renderer._world = world;
renderer._eval = evalExpr;

const tools = new Tools(canvas, cam, world, renderer);
const props = new PropsPanel(world, renderer, {
  onSelect: o => select(o), onCommit: () => saveSnapshot(), onRefresh: () => {}, onToast: t => toast(t),
});

// —— 视图状态
const view = { grid: true, axis: true, ruler: true, trail: true, vel: true };
Object.assign(renderer.view, view);

// —— 运行状态
let running = false;
let simMode = 'step';        // step | realtime
let speedMul = 1;
let snapshot = null;         // 初始状态快照（用于重置）
let lastT = 0;
let acc = 0;
let fpsT = 0, fpsN = 0, fps = 0;

tools.onSelect = o => select(o);
tools.onCommit = () => { saveSnapshot(); props.refreshTargetList(); };
tools.onRefresh = () => {};
tools.onToast = t => toast(t);

// ========== 尺寸 ==========
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cam.resize(r.width, r.height);
}
window.addEventListener('resize', resize);

// ========== 选择 ==========
function select(o) {
  renderer.selected = o ? o.id : null;
  if (o) props.setSelected(o);
  else props.clear();
}

// ========== 快照 / 重置 ==========
function kinematicState() {
  return world.objects.map(o => {
    const s = { id: o.id, type: o.type };
    if (o.type === 'particle') { s.x = o.x; s.y = o.y; s.vx = o.vx; s.vy = o.vy; }
    if (o.type === 'source') s._acc = 0;
    if (o.type === 'graph') s.data = [];
    return s;
  });
}
function saveSnapshot() {
  snapshot = {
    objects: JSON.parse(JSON.stringify(world.objects.map(o => {
      const c = { ...o };
      if (o.type === 'particle') c.trail = [];
      if (o.type === 'graph') c.data = [];
      return c;
    }))),
    time: 0, steps: 0,
  };
}
function reset() {
  if (!snapshot) return;
  world.objects = JSON.parse(JSON.stringify(snapshot.objects));
  world.sourceParticles = [];
  world.time = 0; world.steps = 0;
  for (const o of world.objects) { if (o.type === 'particle') o.trail = []; if (o.type === 'graph') o.data = []; if (o.type === 'source') o._acc = 0; }
  setRunning(false);
  select(null);
  updateSimStats();
}

// ========== 仿真循环 ==========
function setRunning(r) {
  running = r;
  const icon = $('#play-icon');
  const lbl = $('#play-label');
  const tag = $('#mode-tag');
  if (r) {
    if (!snapshot) saveSnapshot();
    icon.setAttribute('d', 'M6 5h4v14H6zM14 5h4v14h-4z');
    lbl.textContent = '暂停';
    tag.textContent = '仿真环境'; tag.classList.add('sim');
  } else {
    icon.setAttribute('d', 'M8 5v14l11-7z');
    lbl.textContent = '仿真';
    tag.textContent = '编辑环境'; tag.classList.remove('sim');
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  // fps
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; $('#sim-fps').textContent = fps + ' fps'; }

  if (running) {
    const stepDt = simMode === 'realtime' ? dt * speedMul : 1 / 60 * speedMul;
    if (simMode === 'realtime') {
      acc += stepDt;
      while (acc >= 1 / 240) { world.step(Math.min(1 / 240, acc), 'realtime'); acc -= 1 / 240; }
      world.emitSources(stepDt);
    } else {
      // 步进模式：固定 1/60 一帧
      world.step(stepDt, 'step');
      world.emitSources(stepDt);
    }
    updateSimStats();
    if (running) checkAutoStop();
  }

  // 动态文本作用域
  renderer._t = world.time;
  renderer._scope = buildScope();

  renderer.render(world);
  drawGraphWin();
  requestAnimationFrame(tick);
}

function buildScope() {
  const s = { t: world.time, pi: Math.PI, e: Math.E, g: Math.abs(world.gravity.y) };
  world.particles.forEach((p, i) => {
    const key = 'p' + (i + 1);
    s[key] = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, v: Math.hypot(p.vx, p.vy), m: p.mass, q: p.charge };
  });
  return s;
}

let autoStop = false;
function checkAutoStop() {
  // 简单自动停止：所有质点几乎静止
  if (!autoStop) return;
  let moving = false;
  for (const p of world.particles) {
    if (p.fixed) continue;
    if (Math.hypot(p.vx, p.vy) > 0.02) { moving = true; break; }
  }
  if (!moving && world.time > 0.5) setRunning(false);
}

function updateSimStats() {
  $('#sim-time').textContent = world.time.toFixed(2);
  $('#sim-steps').textContent = world.steps;
}

// ========== UI 绑定 ==========
// 工具栏
$$('.tool').forEach(btn => btn.addEventListener('click', () => {
  $$('.tool').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const t = btn.dataset.tool;
  tools.setTool(t);
  showHint(t);
}));

function showHint(t) {
  const hints = {
    select: '选择构件，拖动移动，Shift 框选，滚轮缩放',
    pan: '按住拖动平移画布',
    particle: '点击画布添加质点',
    ground: '依次点击添加顶点，双击或回车完成',
    arcground: '点击圆心，再点击确定半径',
    conveyor: '依次点击添加顶点，双击或回车完成',
    spring: '点击两端：可吸附质点或自由锚点',
    rope: '先点击锚点，再点击悬挂的质点',
    emfield: '拖拽绘制矩形电磁场区域（恒定场）',
    source: '点击放置，再点击设定发射方向',
    text: '点击添加文本（可在右侧编辑动态表达式）',
    graph: '拖拽绘制函数图像区域，选择跟踪量',
    // V2 新增
    efield: '拖拽绘制电场区域（恒定电场 E）',
    bfield: '拖拽绘制磁场区域（恒定磁场 B）',
    acefield: '拖拽绘制交变电场区域',
    acbfield: '拖拽绘制交变磁场区域',
    pipe: '点击圆心，拖动设定半径',
    screen: '拖拽绘制荧光屏检测区',
    helppoint: '点击放置辅助标注点',
    helpline: '点击两端绘制辅助线',
    interpsource: '点击两端设定插值范围，再点击设发射角度',
    formulasource: '点击放置，再点击设定发射方向（可用公式定义速度）',
  };
  const h = $('#hint'); h.textContent = hints[t] || ''; h.classList.add('show');
  clearTimeout(showHint._t); showHint._t = setTimeout(() => h.classList.remove('show'), 2600);
}

// 视图控制
const vcMap = { 'vc-grid': 'grid', 'vc-axis': 'axis', 'vc-ruler': 'ruler', 'vc-trail': 'trail', 'vc-vel': 'vel' };
Object.entries(vcMap).forEach(([id, key]) => {
  $('#' + id).addEventListener('click', () => {
    renderer.view[key] = !renderer.view[key];
    $('#' + id).classList.toggle('active', renderer.view[key]);
  });
});
$('#vc-zoomin').addEventListener('click', () => { cam.zoom(1.2, cam.vw / 2, cam.vh / 2); });
$('#vc-zoomout').addEventListener('click', () => { cam.zoom(1 / 1.2, cam.vw / 2, cam.vh / 2); });
$('#vc-fit').addEventListener('click', () => { cam.fit(); });

// 仿真控制
$('#sim-play').addEventListener('click', () => { if (!running && !snapshot) saveSnapshot(); setRunning(!running); });
$('#sim-step').addEventListener('click', () => {
  if (!snapshot) saveSnapshot();
  if (running) setRunning(false);
  world.step(1 / 60 * speedMul, 'step'); world.emitSources(1 / 60 * speedMul);
  updateSimStats();
});
$('#sim-reset').addEventListener('click', () => reset());
$('#sim-speed').addEventListener('input', e => { speedMul = parseFloat(e.target.value); $('#sim-speed-val').textContent = speedMul.toFixed(1) + '×'; });
$('#sim-mode').addEventListener('change', e => { simMode = e.target.value; });
$('#sim-settings').addEventListener('click', () => openSettings());

// 属性面板操作
$('#prop-delete').addEventListener('click', () => {
  const id = renderer.selected;
  if (!id) return;
  // 同时清理引用该对象的弹簧/绳
  world.remove(id);
  world.objects.forEach(o => {
    if (o.aId === id) o.aId = null;
    if (o.bId === id) o.bId = null;
    if (o.targetId === id) o.targetId = null;
  });
  select(null); props.clear(); saveSnapshot(); toast('已删除');
});
$('#prop-duplicate').addEventListener('click', () => {
  const o = world.get(renderer.selected);
  if (!o) return;
  const c = JSON.parse(JSON.stringify(o));
  c.id = o.type + '_' + Math.random().toString(36).slice(2, 8);
  if (c.x != null) c.x += 1;
  if (c.cx != null) c.cx += 1;
  world.add(c); select(c); props.refreshTargetList(); saveSnapshot(); toast('已复制');
});

// 顶部操作
$('#btn-new').addEventListener('click', () => {
  if (world.objects.length && !confirm('清空当前画布？')) return;
  world.clear(); world.sourceParticles = []; select(null); snapshot = null; updateSimStats(); toast('已新建');
});
$('#btn-save').addEventListener('click', () => {
  const name = prompt('方案名称：', '我的方案 ' + new Date().toLocaleString('zh-CN'));
  if (!name) return;
  const list = JSON.parse(localStorage.getItem('iwuli_schemes') || '[]');
  list.unshift({ id: 'sch_' + Date.now(), name, time: Date.now(), data: serialize() });
  localStorage.setItem('iwuli_schemes', JSON.stringify(list.slice(0, 50)));
  toast('方案已保存');
});
$('#btn-mine').addEventListener('click', () => openMine());
$('#btn-share').addEventListener('click', () => openShare());
// GIF 导出（提示功能）
$('#btn-export-gif').addEventListener('click', () => toast('GIF 导出功能开发中，可通过截图工具保存动画帧'));

// 模块切换（仅力与运动可用）
$$('.module').forEach(m => m.addEventListener('click', () => {
  if (m.dataset.mod !== 'forcemotion') { toast('该模块为演示占位，当前仅「力与运动」可用'); return; }
  $$('.module').forEach(x => x.classList.remove('active')); m.classList.add('active');
}));

// 键盘
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  // 工具快捷键（R 保留给重置，摆线改用 O）
  const map = { v: 'select', h: 'pan', p: 'particle', g: 'ground', a: 'arcground', c: 'conveyor', s: 'spring', o: 'rope', e: 'emfield', n: 'source', t: 'text', f: 'graph',
    // V2 新增快捷键
    I: 'interpsource', // 插值粒子源
    D: 'formulasource', // 公式粒子源
    k: 'pipe', // 圆管
    X: 'screen', // 荧光屏
    P: 'helppoint', // 辅助点
    U: 'helpline', // 辅助线
    E: 'efield', // 电场
    B: 'bfield', // 磁场
  };
  if (map[k]) { const btn = document.querySelector(`.tool[data-tool="${map[k]}"]`); if (btn) btn.click(); }
  if (k === ' ') { e.preventDefault(); $('#sim-play').click(); }
  if (k === '.') { e.preventDefault(); $('#sim-step').click(); }
  if (k === 'r') { e.preventDefault(); $('#sim-reset').click(); }
  if (k === 'enter' && tools.drawing) tools.finishDrawing();
  if (k === 'escape') { tools.cancelDrawing(); select(null); }
  if (k === 'delete' || k === 'backspace') { if (renderer.selected) $('#prop-delete').click(); }
  if (e.ctrlKey && k === 'z') { toast('撤销（演示版）'); }
});

// ========== 弹窗 ==========
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal-mask').hidden = true));
$$('.modal-mask').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));

function openMine() {
  const list = JSON.parse(localStorage.getItem('iwuli_schemes') || '[]');
  const box = $('#mine-list');
  if (!list.length) { box.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">暂无保存的方案</p>'; }
  else {
    box.innerHTML = '';
    list.forEach(s => {
      const d = document.createElement('div'); d.className = 'mine-item';
      d.innerHTML = `<div><div class="nm">${s.name}</div><div class="tm">${new Date(s.time).toLocaleString('zh-CN')}</div></div><div class="acts"><button class="sim-btn">加载</button><button class="sim-btn danger">删除</button></div>`;
      d.querySelector('.sim-btn').addEventListener('click', () => { load(s.data); $('#modal-mine').hidden = true; toast('已加载方案'); });
      d.querySelector('.sim-btn.danger').addEventListener('click', () => {
        const left = list.filter(x => x.id !== s.id);
        localStorage.setItem('iwuli_schemes', JSON.stringify(left));
        openMine();
      });
      box.appendChild(d);
    });
  }
  $('#modal-mine').hidden = false;
}

function openShare() {
  const url = location.origin + location.pathname + '#s=' + btoa(encodeURIComponent(serialize()));
  $('#share-url').value = url;
  $('#modal-share').hidden = false;
}
$('#share-copy').addEventListener('click', () => {
  const inp = $('#share-url'); inp.select(); navigator.clipboard?.writeText(inp.value).catch(() => {});
  toast('链接已复制');
});

function openSettings() {
  const box = $('#settings-body');
  box.innerHTML = '';
  const add = (label, type, val, on, step) => {
    const d = document.createElement('div'); d.className = 'fld';
    d.innerHTML = `<label>${label}</label>`;
    const w = document.createElement('div'); w.className = 'row';
    const i = document.createElement('input'); i.type = type; i.value = val; if (step) i.step = step;
    i.addEventListener('change', () => on(type === 'checkbox' ? i.checked : parseFloat(i.value)));
    if (type === 'checkbox') { i.checked = val; const l = document.createElement('label'); l.className = 'chk'; l.appendChild(i); l.appendChild(document.createTextNode('启用')); w.appendChild(l); }
    else w.appendChild(i);
    d.appendChild(w); box.appendChild(d);
  };
  add('重力加速度 g (m/s²)', 'number', Math.abs(world.gravity.y), v => world.gravity.y = -Math.abs(v), 0.1);
  add('积分子步数', 'number', world.substeps, v => world.substeps = Math.max(1, v | 0), 1);
  add('空气阻力系数', 'number', world.airDrag, v => world.airDrag = Math.max(0, v), 0.01);
  add('全局弹性系数', 'number', world.restitutionGlobal, v => world.restitutionGlobal = v, 0.1);
  add('轨迹最大点数', 'number', world.trailMax, v => world.trailMax = v | 0, 50);
  add('静止自动停止', 'checkbox', autoStop, v => autoStop = v);
  $('#modal-settings').hidden = false;
}

// ========== 序列化 ==========
function serialize() {
  return JSON.stringify({
    v: 1,
    gravity: world.gravity,
    settings: { substeps: world.substeps, airDrag: world.airDrag, restitutionGlobal: world.restitutionGlobal, trailMax: world.trailMax },
    objects: world.objects,
    cam: { scale: cam.scale, cx: cam.cx, cy: cam.cy },
  });
}
function load(str) {
  try {
    const d = JSON.parse(str);
    world.objects = (d.objects || []).map(o => Object.assign(make(o.type), o));
    if (d.gravity) world.gravity = d.gravity;
    if (d.settings) { world.substeps = d.settings.substeps ?? 4; world.airDrag = d.settings.airDrag ?? 0; world.restitutionGlobal = d.settings.restitutionGlobal ?? 1; world.trailMax = d.settings.trailMax ?? 400; }
    if (d.cam) { cam.scale = d.cam.scale; cam.cx = d.cam.cx; cam.cy = d.cam.cy; }
    world.sourceParticles = []; world.time = 0; world.steps = 0;
    select(null); saveSnapshot(); props.refreshTargetList();
  } catch (e) { toast('加载失败：' + e.message); }
}

// URL 分享加载
if (location.hash.startsWith('#s=')) {
  try { load(decodeURIComponent(atob(location.hash.slice(3)))); } catch (e) {}
}

// ========== Toast ==========
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ========== 模式切换（编辑/仿真）==========
let isSimMode = false;
$('#btn-mode-edit').addEventListener('click', () => {
  isSimMode = false;
  document.getElementById('app').classList.remove('sim-mode');
  $('#btn-mode-edit').classList.add('active'); $('#btn-mode-sim').classList.remove('active');
  if (running) setRunning(false);
});
$('#btn-mode-sim').addEventListener('click', () => {
  isSimMode = true;
  document.getElementById('app').classList.add('sim-mode');
  $('#btn-mode-sim').classList.add('active'); $('#btn-mode-edit').classList.remove('active');
});

// ========== 函数图像弹窗 ==========
const gwCanvas = document.getElementById('graph-canvas');
let gwCtx = null; let gwOpen = false; let gwQty = 'v'; let gwTgtId = null;

$('#btn-graph-win').addEventListener('click', () => {
  const m = document.getElementById('modal-graph');
  m.hidden = !m.hidden;
  if (!m.hidden) {
    if (!gwOpen) { initGraphWin(); gwOpen = true; }
    refreshGwTargets(); // 每次打开都刷新目标列表
  }
});

function initGraphWin() {
  gwCtx = gwCanvas.getContext('2d');
  // 填充目标选择器
  refreshGwTargets();
  $('#gw-qty').addEventListener('change', e => { gwQty = e.target.value; });
  $('#gw-target').addEventListener('change', e => { gwTgtId = e.target.value || null; });
  $('#gw-clear').addEventListener('click', () => {
    world.objects.filter(o => o.type === 'graph').forEach(g => g.data = []);
    toast('图像数据已清空');
  });
}

function refreshGwTargets() {
  const s = $('#gw-target');
  s.innerHTML = '<option value="">第一个质点</option>' + world.particles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

// 在渲染循环中绘制函数图像
function drawGraphWin() {
  if (!gwCtx || document.getElementById('modal-graph').hidden) return;
  const W = gwCanvas.clientWidth, H = gwCanvas.clientHeight;
  gwCanvas.width = W * (window.devicePixelRatio || 1);
  gwCanvas.height = H * (window.devicePixelRatio || 1);
  const ctx = gwCtx; ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const tgt = gwTgtId ? world.get(gwTgtId) : world.particles[0];
  if (!tgt) { ctx.fillStyle='#94a3b8';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('无质点数据',W/2,H/2);return }

  // 收集所有 graph 对象的数据 + 实时数据
  let allData = [];
  for (const g of world.objects.filter(o => o.type === 'graph')) {
    if ((!g.targetId || g.targetId === tgt.id) && g.quantity === gwQty) allData = allData.concat(g.data);
  }
  // 如果没有专用 graph，从实时数据生成
  if (!allData.length) {
    allData.push({ t: 0, v: getVal(tgt, gwQty) });
    for (const p of tgt.trail) {
      // approximate from trail
    }
    allData.push({ t: world.time, v: getVal(tgt, gwQty) });
  } else if (allData.length < 2) return;

  const tMax = Math.max(...allData.map(d => d.t), 1);
  let vMin = Infinity, vMax = -Infinity;
  allData.forEach(d => { vMin = Math.min(vMin, d.v); vMax = Math.max(vMax, d.v); });
  if (!isFinite(vMin)) { vMin = -1; vMax = 1; }
  if (vMax - vMin < 1e-6) { vMax += 1; vMin -= 1; }

  const pad = 40;
  const pw = W - pad * 2, ph = H - pad * 2;

  // 背景和网格
  ctx.fillStyle = '#fafbfc'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
  for (let i = 1; i <= 5; i++) { const y = pad + ph * (i / 5); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }
  for (let i = 1; i <= 10; i++) { const x = pad + pw * (i / 10); ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); }

  // 零线
  if (vMin < 0 && vMax > 0) {
    const zy = H - pad - ((0 - vMin) / (vMax - vMin)) * ph;
    ctx.strokeStyle = '#cbd5e1'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad, zy); ctx.lineTo(W - pad, zy); ctx.stroke(); ctx.setLineDash([]);
  }

  // 曲线
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath();
  allData.forEach((d, i) => {
    const px = pad + (d.t / tMax) * pw;
    const py = H - pad - ((d.v - vMin) / (vMax - vMin)) * ph;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();

  // 当前点
  const lastV = getVal(tgt, gwQty);
  const cpx = pad + (world.time / tMax) * pw;
  const cpy = H - pad - ((lastV - vMin) / (vMax - vMin)) * ph;
  ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(cpx, cpy, 4, 0, TAU); ctx.fill();

  // 坐标轴标签
  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('t (s)', W / 2, H - 8);
  const qtyLabel = { v: '速度 v', s: '位移 s', a: '加速度 a', x: 'x', y: 'y' }[gwQty] || gwQty;
  ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(qtyLabel, 0, 0); ctx.restore();

  // 数值
  ctx.textAlign = 'left';
  ctx.fillText(fmt(lastV, 2), cpx + 8, cpy - 4);
  ctx.fillText(world.time.toFixed(2) + 's', cpx + 8, cpy + 12);
}
function getVal(p, q) {
  if (q === 's') return Math.hypot(p.x, p.y);
  else if (q === 'v') return Math.hypot(p.vx, p.vy);
  else if (q === 'a') return Math.hypot(p.ax, p.ay);
  else if (q === 'x') return p.x;
  else if (q === 'y') return p.y;
  else if (q === 'vx') return p.vx;
  else if (q === 'vy') return p.vy;
  return 0;
}

// ========== 初始演示场景 ==========
function demoScene() {
  if (world.objects.length) return;
  // 地面
  world.add(make('ground', { points: [{ x: -8, y: -3 }, { x: 8, y: -3 }], friction: 0.3, restitution: 0.6 }));
  // 斜坡
  world.add(make('ground', { points: [{ x: -8, y: 1.5 }, { x: -3, y: -3 }], friction: 0.2, restitution: 0.4, color: '#64748b' }));
  // 自由落体/平抛质点
  world.add(make('particle', { x: 0, y: 4, vx: 1.8, vy: 0, mass: 1, radius: 0.35, color: '#3b82f6', name: '小球A' }));
  // 弹簧悬挂振子
  world.add(make('spring', { a: { x: 4, y: 5 }, bId: null, b: { x: 4, y: 2 }, L0: 1.8, k: 25, damping: 0.25 }));
  const bob = make('particle', { x: 4, y: 2, mass: 0.5, radius: 0.32, color: '#ef4444', name: '弹簧振子' });
  world.add(bob);
  // 把弹簧 B 端绑定到弹簧振子
  const sp = world.objects.find(o => o.type === 'spring');
  if (sp) sp.bId = bob.id;
  // 文本标注
  world.add(make('text', { x: -7.5, y: 4.5, text: '爱物理 · 力与运动仿真平台', size: 18, color: '#1f2937' }));
  world.add(make('text', { x: -7.5, y: 3.9, text: '时间 t = ', expr: 't', size: 14, color: '#3b82f6' }));
  // 函数图像（跟踪小球A 的速度）
  world.add(make('graph', { x: 4.5, y: -0.5, w: 3.5, h: 2.2, quantity: 'v', targetId: null, axisT: 6 }));
  saveSnapshot();
}

// ========== 启动 ==========
resize();
demoScene();
props.refreshTargetList();
select(null);
lastT = performance.now();
requestAnimationFrame(tick);
toast('爱物理已就绪 · 按空格开始仿真');
