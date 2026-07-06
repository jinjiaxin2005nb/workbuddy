"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { PhysicsObject, GlobalConfig } from "@/lib/types";
import { IconClose, IconSave, IconDownload, IconTrash } from "./Icons";

export default function MySchemesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const savedSchemes = useStore((s) => s.savedSchemes);
  const saveScheme = useStore((s) => s.saveScheme);
  const loadScheme = useStore((s) => s.loadScheme);
  const deleteScheme = useStore((s) => s.deleteScheme);
  const objects = useStore((s) => s.objects);
  const config = useStore((s) => s.config);
  const experimentName = useStore((s) => s.experimentName);
  const [name, setName] = useState("");

  if (!open) return null;

  const doExportJSON = () => {
    const data = JSON.stringify({ name: experimentName, objects, config, version: 1 }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${experimentName || "iwuli-scene"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doExportPNG = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${experimentName || "iwuli-scene"}.png`;
    a.click();
  };

  const doExportGIF = async () => {
    // 录制 2 秒 webm 视频(浏览器原生不支持 gif 编码, 用 webm 替代)
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    try {
      const stream = (canvas as HTMLCanvasElement).captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${experimentName || "iwuli-sim"}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      rec.start();
      setTimeout(() => rec.stop(), 3000);
    } catch {
      alert("当前浏览器不支持视频录制，已改用 PNG 截图");
      doExportPNG();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 bg-iwuli-panel border-l border-iwuli-border h-full overflow-y-auto">
        <div className="sticky top-0 bg-iwuli-panel border-b border-iwuli-border px-4 py-3 flex items-center justify-between z-10">
          <span className="text-sm font-medium">我的仿真</span>
          <button onClick={onClose} className="text-iwuli-sub hover:text-iwuli-text">
            <IconClose width={16} height={16} />
          </button>
        </div>
        <div className="p-3 space-y-3">
          {/* 保存当前 */}
          <div className="p-3 rounded-lg bg-iwuli-panel2">
            <div className="text-xs font-medium mb-2">保存当前场景</div>
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={experimentName}
                className="flex-1 min-w-0 bg-iwuli-bg border border-iwuli-border rounded px-2 py-1 text-xs focus:outline-none focus:border-iwuli-accent"
              />
              <button
                onClick={() => { saveScheme(name || experimentName); setName(""); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-iwuli-accent text-white text-xs hover:bg-blue-500"
              >
                <IconSave width={13} height={13} /> 保存
              </button>
            </div>
          </div>

          {/* 导出 */}
          <div className="p-3 rounded-lg bg-iwuli-panel2">
            <div className="text-xs font-medium mb-2">导出</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={doExportJSON} className="flex flex-col items-center gap-1 py-2 rounded bg-iwuli-bg hover:bg-iwuli-border text-[11px] text-iwuli-sub">
                <IconDownload width={15} height={15} /> JSON
              </button>
              <button onClick={doExportPNG} className="flex flex-col items-center gap-1 py-2 rounded bg-iwuli-bg hover:bg-iwuli-border text-[11px] text-iwuli-sub">
                <IconDownload width={15} height={15} /> PNG
              </button>
              <button onClick={doExportGIF} className="flex flex-col items-center gap-1 py-2 rounded bg-iwuli-bg hover:bg-iwuli-border text-[11px] text-iwuli-sub">
                <IconDownload width={15} height={15} /> 视频
              </button>
            </div>
            <p className="text-[10px] text-iwuli-sub mt-1.5 leading-relaxed">JSON 可重新导入；视频录制当前画面 3 秒(webm)。</p>
          </div>

          {/* 方案列表 */}
          <div>
            <div className="text-xs font-medium mb-2">已保存方案 ({savedSchemes.length})</div>
            {savedSchemes.length === 0 ? (
              <div className="text-[11px] text-iwuli-sub text-center py-6">暂无保存的方案</div>
            ) : (
              <div className="space-y-1.5">
                {savedSchemes.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-iwuli-panel2 hover:bg-iwuli-border group">
                    <button onClick={() => { loadScheme(s.id); onClose(); }} className="flex-1 text-left min-w-0">
                      <div className="text-xs text-iwuli-text truncate">{s.name}</div>
                      <div className="text-[10px] text-iwuli-sub">
                        {s.objects.length} 对象 · {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => { if (confirm(`删除方案"${s.name}"？`)) deleteScheme(s.id); }}
                      className="text-iwuli-sub hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
