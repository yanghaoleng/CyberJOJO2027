import { useEffect, useRef } from 'react';
import { Xmark } from 'iconoir-react';
import './motion-follow.css';

const CONNECTIONS = [[11,12],[11,13],[13,15],[15,17],[15,19],[12,14],[14,16],[16,18],[16,20],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[7,8]];
const seen = p => p && (p.visibility ?? 1) >= .55 && (p.presence ?? 1) >= .55;
export default function MotionFollowOverlay({ status, landmarksRef, capabilitiesRef, videoRef, mirrored, onClose }) {
  const canvasRef = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    let frame;
    const canvas = canvasRef.current;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
      const landmarks = landmarksRef.current, video = videoRef.current;
      if (!landmarks || !video?.videoWidth) return;
      const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      const point = p => ({ x: (mirrored ? 1 - p.x : p.x) * dw + (width - dw) / 2, y: p.y * dh + (height - dh) / 2 });
      ctx.strokeStyle = 'rgba(255,240,156,.5)'; ctx.fillStyle = '#fff5ba'; ctx.lineWidth = 2;
      for (const [from, to] of CONNECTIONS) {
        if (!seen(landmarks[from]) || !seen(landmarks[to])) continue;
        const a = point(landmarks[from]), b = point(landmarks[to]);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
      for (const index of [0,11,12,13,14,15,16]) {
        if (!seen(landmarks[index])) continue;
        const p = point(landmarks[index]); ctx.beginPath(); ctx.arc(p.x,p.y,index >= 15 ? 5 : 3,0,Math.PI*2); ctx.fill();
      }
    };
    draw();
    const keydown = e => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown',keydown);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown',keydown); };
  }, [landmarksRef, videoRef, mirrored]);
  const hint = status === 'loading' ? '正在准备跟随，先让我看见你的头和两只手' : status === 'error' ? '这次没准备好，退出后再说“你跟我学”试试' : status === 'tracking' ? '挥挥手、抬抬手、歪歪头，我跟着你' : '往后站一点，让我看见你的肩膀和两只手';
  return <section className="motion-follow-overlay" aria-label="动作跟随" data-motion-status={status} data-motion-bindings={capabilitiesRef.current.join(',')}>
    <canvas ref={canvasRef} className="motion-follow-skeleton" aria-hidden="true" />
    <header><h2>动作跟随</h2><button type="button" aria-label="结束动作跟随" onClick={onClose}><Xmark width={22} height={22} /></button></header>
    <p role="status">{hint}<small>说“结束跟随”就回到聊天</small></p>
  </section>;
}
