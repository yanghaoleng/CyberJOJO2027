import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./health-demo-card.css";

export function HealthDemoCard({ record }) {
  const audioRef = useRef(null);
  const generation = useRef(0);
  const [voiceState, setVoiceState] = useState("idle");
  const [pushOpen, setPushOpen] = useState(false);
  const [pushShown, setPushShown] = useState(false);
  useEffect(() => { const audio = audioRef.current; return () => { generation.current++; audio?.pause(); }; }, []);
  useEffect(() => {
    if (!pushOpen) return undefined;
    const timer = window.setTimeout(() => setPushOpen(false), 14000);
    return () => window.clearTimeout(timer);
  }, [pushOpen]);
  const previewPush = () => { setPushShown(true); setPushOpen(true); };
  const playReminder = () => {
    previewPush();
    const audio = audioRef.current;
    if (!audio) return;
    const run = ++generation.current;
    audio.currentTime = 0;
    setVoiceState("loading");
    audio.play().catch(() => { if (run === generation.current) setVoiceState("error"); });
  };
  const stop = () => { generation.current++; audioRef.current?.pause(); setVoiceState("idle"); };

  return <article className="health-demo-card" aria-label="健康监护模拟指标卡">
    <header className="health-demo-heading"><span className="health-demo-symbol" aria-hidden="true">♡</span><div><span className="health-demo-eyebrow">HEALTH COMPANION · 健康监护</span><h3>运动前，也照顾好小身体</h3></div><span className="health-demo-badge">模拟</span></header>
    <p className="health-demo-source">{record.child} · {record.age}<span>{record.time} · {record.source}</span></p>
    <dl className="health-demo-metrics">{record.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}<small>{metric.unit}</small></dd><span>{metric.source}</span></div>)}</dl>
    <div className="health-demo-insight"><span className="health-demo-meal">{record.mealStatus}</span><h4>{record.insight}</h4><p>{record.explanation}</p></div>
    <div className="health-demo-advice"><span>这一刻的照顾</span><p>{record.advice}</p></div>
    <div className="health-demo-channels">
      <div><span>◖)) 叫叫语音</span><strong>{voiceState === "playing" ? "正在播放" : voiceState === "loading" ? "正在准备" : voiceState === "ended" ? "已播放" : voiceState === "error" ? "暂时无法播放" : "可试听"}</strong></div>
      <div><span>↗ 家长端 Push</span><strong>{pushShown ? "已展示预览" : "可预览"}</strong></div>
    </div>
    <blockquote className="health-demo-voice">“{record.voice}”</blockquote>
    <div className="health-demo-actions"><button type="button" onClick={voiceState === "playing" || voiceState === "loading" ? stop : playReminder}>{voiceState === "playing" || voiceState === "loading" ? "停止语音" : voiceState === "ended" || voiceState === "error" ? "重新体验语音 + Push" : "体验语音 + Push 提醒"}</button><button type="button" onClick={previewPush}>查看 Push</button></div>
    {voiceState === "error" && <p role="status" className="health-demo-error">语音暂时无法播放，可以先看文字提醒，再点一次重试。</p>}
    <p className="health-demo-footnote">虚构数据与提醒演示，尚未接入真实设备或向家长发送消息。日常生活提示，不用于判断疾病或替代医生建议。</p>
    <audio ref={audioRef} src={record.audioUrl} preload="none" data-character="jiaojiao" data-speech-text={record.voice} onPlaying={() => setVoiceState("playing")} onEnded={() => setVoiceState("ended")} onError={() => setVoiceState("error")} />
    {pushOpen && createPortal(<aside className="health-demo-push" role="status" aria-label="家长端 Push 提醒预览"><header><span className="health-demo-symbol" aria-hidden="true">♡</span><span>健康监护 · Push 演示<small>家长端预览，未真实发送</small></span><button type="button" onClick={() => setPushOpen(false)} aria-label="关闭健康提醒预览">×</button></header><strong>{record.pushTitle}</strong><p>{record.pushBody}</p></aside>, document.body)}
  </article>;
}
