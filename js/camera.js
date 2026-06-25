// ===== 相机：世界坐标 ↔ 屏幕坐标（y 轴翻转，物理约定 +y 向上）=====
export class Camera {
  constructor() {
    // 缩放：1 米 = scale 像素
    this.scale = 60;
    // 视图中心对应的世界坐标
    this.cx = 0;
    this.cy = 0;
  }

  resize(w, h) { this.vw = w; this.vh = h; }

  // 世界 → 屏幕
  sx(wx) { return this.vw / 2 + (wx - this.cx) * this.scale; }
  sy(wy) { return this.vh / 2 - (wy - this.cy) * this.scale; }
  s(wx, wy) { return { x: this.sx(wx), y: this.sy(wy) }; }

  // 屏幕 → 世界
  wx(sx) { return this.cx + (sx - this.vw / 2) / this.scale; }
  wy(sy) { return this.cy - (sy - this.vh / 2) / this.scale; }
  w(sx, sy) { return { x: this.wx(sx), y: this.wy(sy) }; }

  zoom(factor, sx, sy) {
    const before = this.w(sx, sy);
    this.scale = Math.max(6, Math.min(600, this.scale * factor));
    const after = this.w(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
  }

  pan(dxScreen, dyScreen) {
    this.cx -= dxScreen / this.scale;
    this.cy += dyScreen / this.scale;
  }

  fit() { this.scale = 60; this.cx = 0; this.cy = 0; }

  // 网格步长（米），自适应缩放
  gridStep() {
    const target = 60; // 期望每格像素
    let step = 1;
    const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 50, 100];
    for (const c of candidates) { if (c * this.scale >= target - 1) { step = c; break; } step = c; }
    return step;
  }
}
