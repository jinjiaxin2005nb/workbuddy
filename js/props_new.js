// ===== Property panel for splitLine and fieldPoly =====
// Add these methods to PropsPanel class:

splitLineFields(o, b) {
  const title = document.createElement('div');
  title.className = 'sect-title';
  title.textContent = '场分割线属性';
  b.appendChild(title);
  
  // Shape selector
  const shapeMap = { line: '直线', circle: '圆形', rect: '矩形' };
  b.appendChild(this.field('形状', 'select', o.shape || 'line',
    v => { o.shape = v; this.render(); },
    { options: [{ v: 'line', t: '直线' }, { v: 'circle', t: '圆形' }, { v: 'rect', t: '矩形' }] }));
    
  if ((o.shape || 'line') === 'line') {
    b.appendChild(this.field('起点 X', 'number', o.x1 || 0, v => { o.x1 = v; }, { step: 0.1 }));
    b.appendChild(this.field('起点 Y', 'number', o.y1 || 0, v => { o.y1 = v; }, { step: 0.1 }));
    b.appendChild(this.field('终点 X', 'number', o.x2 || 1, v => { o.x2 = v; }, { step: 0.1 }));
    b.appendChild(this.field('终点 Y', 'number', o.y2 || 1, v => { o.y2 = v; }, { step: 0.1 }));
  } else if (o.shape === 'circle') {
    b.appendChild(this.field('圆心 X', 'number', o.cx || 0, v => { o.cx = v; }, { step: 0.1 }));
    b.appendChild(this.field('圆心 Y', 'number', o.cy || 0, v => { o.cy = v; }, { step: 0.1 }));
    b.appendChild(this.field('半径', 'number', o.r || 2, v => { o.r = Math.max(0.1, v); }, { step: 0.1 }));
  } else if (o.shape === 'rect') {
    b.appendChild(this.field('左上 X', 'number', o.rx || -2, v => { o.rx = v; }, { step: 0.1 }));
    b.appendChild(this.field('左上 Y', 'number', o.ry || -2, v => { o.ry = v; }, { step: 0.1 }));
    b.appendChild(this.field('宽度', 'number', o.rw || 4, v => { o.rw = v; }, { step: 0.1 }));
    b.appendChild(this.field('高度', 'number', o.rh || 4, v => { o.rh = v; }, { step: 0.1 }));
  }
  b.appendChild(this.colorField(o));
}

fieldPolyFields(o, b) {
  const title = document.createElement('div');
  title.className = 'sect-title';
  title.textContent = '多边形场属性';
  b.appendChild(title);
  
  const typeMap = { efield: '电场 E', bfield: '磁场 B', acefield: '交变电场', acbfield: '交变磁场' };
  b.appendChild(this.field('场类型', 'select', o.fieldType || 'efield',
    v => { o.fieldType = v; },
    { options: [{ v: 'efield', t: '电场 E' }, { v: 'bfield', t: '磁场 B' },
      { v: 'acefield', t: '交变电场' }, { v: 'acbfield', t: '交变磁场' }] }));
      
  b.appendChild(this.field('Ex', 'number', o.Ex || 0, v => { o.Ex = v; }, { step: 0.5 }));
  b.appendChild(this.field('Ey', 'number', o.Ey || 0, v => { o.Ey = v; }, { step: 0.5 }));
  b.appendChild(this.field('B', 'number', o.B || 0, v => { o.B = v; }, { step: 0.1 }));
  b.appendChild(this.field('交变', 'check', !!o.ac, v => { o.ac = v; this.render(); }, { text: 'AC' }));
  if (o.ac) {
    b.appendChild(this.field('频率', 'number', o.freq || 1, v => { o.freq = v; }, { step: 0.1 }));
  }
  // Show polygon vertices
  if (o.polygon && o.polygon.length >= 3) {
    const div = document.createElement('div');
    div.className = 'sect-title';
    div.textContent = `多边形 (${o.polygon.length}顶点)`;
    b.appendChild(div);
  }
}
