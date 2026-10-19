import { useEffect, useRef, useState } from "react";
import "./health-demo-card.css";

export function HealthDemoCard({ record }) {
  const audioRef = useRef(null);
  const generation = useRef(0);
  const [voiceState, setVoiceState] = useState("idle");
  useEffect(() => { const audio = audioRef.current; return () => { generation.current++; audio?.pause(); }; }, []);
  const playReminder = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const run = ++generation.current;
    audio.currentTime = 0;
    setVoiceState("loading");
    audio.play().catch(() => { if (run === generation.current) setVoiceState("error"); });
  };
  const stop = () => { generation.current++; audioRef.current?.pause(); setVoiceState("idle"); };

  return <article className="health-demo-card" aria-label="健康监护模拟指标卡">
    <header className="health-demo-heading"><span className="health-demo-app-icon" aria-hidden="true"><img src="/intro/assets/health-icons/a.png" alt="" /></span><div><span className="health-demo-eyebrow">HEALTH COMPANION · 健康监护</span><h3>特殊场景 · 及时照顾身体不适</h3></div><span className="health-demo-badge">模拟</span></header>
    <p className="health-demo-source">{record.child} · {record.age}<span>{record.time} · {record.source}</span></p>
    <dl className="health-demo-metrics">{record.metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}<small>{metric.unit}</small></dd><span>{metric.source}</span></div>)}</dl>
    <div className="health-demo-insight"><span className="health-demo-meal">{record.mealStatus}</span><h4>{record.insight}</h4><strong className="health-demo-symptoms">{record.symptoms}</strong><p>{record.explanation}</p></div>
    <div className="health-demo-advice"><span>这一刻的照顾</span><p>{record.advice}</p></div>
    <div className="health-demo-channels">
      <div><span>◖)) 叫叫语音</span><strong>{voiceState === "playing" ? "正在播放" : voiceState === "loading" ? "正在准备" : voiceState === "ended" ? "已播放" : voiceState === "error" ? "暂时无法播放" : "可试听"}</strong></div>
    </div>
    <div className="health-demo-parent-sent" role="status"><span aria-hidden="true">✓</span><div><strong>{record.pushStatus}</strong><small>模拟状态 · 家长端 Push</small></div></div>
    <blockquote className="health-demo-voice">“{record.voice}”</blockquote>
    <div className="health-demo-actions"><button type="button" onClick={voiceState === "playing" || voiceState === "loading" ? stop : playReminder}>{voiceState === "playing" || voiceState === "loading" ? "停止语音" : voiceState === "ended" || voiceState === "error" ? "重新试听紧急提醒" : "试听紧急语音提醒"}</button></div>
    {voiceState === "error" && <p role="status" className="health-demo-error">语音暂时无法播放，可以先看文字提醒，再点一次重试。</p>}
    <p className="health-demo-footnote">虚构数据与提醒演示，尚未接入真实设备或向家长发送消息。日常生活提示，不用于判断疾病或替代医生建议。</p>
    <audio ref={audioRef} src={record.audioUrl} preload="none" data-character="jiaojiao" data-speech-text={record.voice} onPlaying={() => setVoiceState("playing")} onEnded={() => setVoiceState("ended")} onError={() => setVoiceState("error")} />
  </article>;
}
