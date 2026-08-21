import React from 'react'; import ReactDOM from 'react-dom/client'; import App from './App'; import './index.css'; import { initFxSettings } from './lib/fxSettings'; import { initBattleSound } from './lib/battleSound'; import { installChunkReloadGuard } from './lib/chunkReload'; import { Analytics } from '@vercel/analytics/react'; installChunkReloadGuard(); initFxSettings(); initBattleSound();
// PWA：production 註冊 service worker（快取 app shell 與靜態素材，訪客冒險可離線玩）
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 註冊失敗不阻擋主流程 */ });
  });
}
const root = ReactDOM.createRoot(document.getElementById('root'));
// Analytics 只在 Vercel 上實際送資料（本機 npm start 不會有流量），數據看 Vercel → Analytics 分頁
root.render(<><App /><Analytics /></>);
