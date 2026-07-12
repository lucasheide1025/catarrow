// src/components/shared/ErrorBoundary.jsx
// 頂層錯誤邊界：接住 render/lifecycle 途中拋出的錯誤，避免整棵樹卸載變全白畫面。
// 手機上看不到 CRA 紅色覆蓋層，所以這裡把錯誤訊息＋堆疊「直接顯示在畫面上」，
// 使用者可以截圖回報，開發者就能定位是哪個元件、哪一行 crash。
// ChunkLoadError（部署後舊 chunk 404）沿用既有 chunkReload 的自動重載，不當成錯誤顯示。
import React from "react";
import { isChunkError, reloadOnceForStaleChunk } from "../../lib/chunkReload";

const overlay = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  padding: 16, background: "#0f172a", color: "#e2e8f0", boxSizing: "border-box",
  fontFamily: "system-ui, -apple-system, 'Noto Sans TC', sans-serif",
};
const card = { width: "100%", maxWidth: 560, textAlign: "center" };
const btn = {
  display: "inline-block", margin: "4px", padding: "10px 18px", borderRadius: 12,
  border: "none", background: "#f59e0b", color: "#111", fontWeight: 800, fontSize: 14,
  cursor: "pointer",
};
const pre = {
  marginTop: 14, textAlign: "left", background: "#1e293b", color: "#fca5a5",
  padding: 12, borderRadius: 10, fontSize: 11, lineHeight: 1.5,
  whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "45vh", overflow: "auto",
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 部署後舊 chunk 404 → 自動重載一次拿新版（跟 chunkReload guard 同一套防迴圈）
    if (isChunkError(error)) { reloadOnceForStaleChunk(); return; }
    this.setState({ info });
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    if (isChunkError(error)) {
      return <div style={overlay}><div style={{ opacity: 0.8 }}>載入新版本中…</div></div>;
    }

    const stack = String(error?.stack || "").split("\n").slice(0, 8).join("\n");
    const comp = info?.componentStack
      ? "\n\n--- 元件堆疊 ---" + info.componentStack.split("\n").slice(0, 10).join("\n")
      : "";

    return (
      <div style={overlay}>
        <div style={card}>
          <div style={{ fontSize: 34 }}>😿</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: "8px 0" }}>畫面出錯了</h1>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
            把下面的紅字截圖傳給開發者就能修。多數情況按「重新載入」可以繼續。
          </p>
          <div>
            <button onClick={() => window.location.reload()} style={btn}>🔄 重新載入</button>
            <button onClick={() => { window.location.href = "/"; }} style={{ ...btn, background: "#334155", color: "#e2e8f0" }}>🏠 回首頁</button>
          </div>
          <pre style={pre}>{String(error?.message || error) + "\n\n" + stack + comp}</pre>
        </div>
      </div>
    );
  }
}
