import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ACTIVITIES, ACTIVITY_PROTOCOL, activityUrl, readActivityMessage } from './activity-contract.js';
import './activities.css';
export default function ActivityExperience({ session, onFinish }) {
  const frame = useRef(null), latest = useRef(null), closing = useRef(false), finish = useRef(onFinish), exitTimer = useRef(null);
  const [ready, setReady] = useState(false), [slow, setSlow] = useState(false), [retry, setRetry] = useState(0);
  finish.current = onFinish;
  const activity = ACTIVITIES[session.activityId];
  const done = (report) => {
    if (closing.current === 'done') return;
    closing.current = 'done'; clearTimeout(exitTimer.current);
    finish.current({ id: session.id, activityId: session.activityId, createdAt: session.createdAt, report });
  };
  const exit = () => {
    if (closing.current) return;
    closing.current = true;
    frame.current?.contentWindow?.postMessage({ protocol: ACTIVITY_PROTOCOL, type: 'exit', sessionId: session.id, activityId: session.activityId }, activity.origin);
    exitTimer.current = setTimeout(() => done(latest.current ? { ...latest.current, status: latest.current.status === 'completed' ? 'completed' : 'exited' } : { status: 'exited', voiceAttempts: 0, menuAttempts: 0, completedLessons: 0, totalLessons: 0, words: [], chapter: '', durationSeconds: Math.min(86400, Math.floor((Date.now() - session.createdAt) / 1000)) }), 1500);
  };
  useEffect(() => {
    const focus = document.activeElement, oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const message = event => {
      const data = readActivityMessage(event, frame.current?.contentWindow, session.id, session.activityId);
      if (!data) return;
      setReady(true); setSlow(false);
      if (data.report) latest.current = data.report;
      if (data.type === 'result') done(data.report);
    };
    const key = event => { if (event.key === 'Escape') { event.preventDefault(); exit(); } if(event.key === 'Tab' && event.shiftKey && document.activeElement?.className === 'activity-exit') event.preventDefault(); };
    window.addEventListener('message', message); window.addEventListener('keydown', key);
    document.querySelector('.activity-exit')?.focus();
    return () => { clearTimeout(exitTimer.current); window.removeEventListener('message', message); window.removeEventListener('keydown', key); document.body.style.overflow = oldOverflow; focus?.focus?.(); };
  }, [session.id]);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 20000); return () => clearTimeout(timer); }, [retry]);
  return createPortal(<section className="activity-experience" role="dialog" aria-modal="true" aria-label={activity.title}>
    <header><button type="button" className="activity-exit" onClick={exit}>‹ 退出</button><strong>{activity.title}</strong><span>和绿豆一起玩</span></header>
    {!ready && <div className="activity-loading" role="status">{slow ? <>世界还没打开 <button onClick={() => { setSlow(false); setRetry(n => n + 1); }}>重新加载</button></> : '正在打开你的小世界…'}</div>}
    <iframe key={retry} ref={frame} src={activityUrl(session.activityId, session.id)} title={activity.title} allow="microphone https://jma.mikeywa.site; autoplay" sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="strict-origin-when-cross-origin" />
  </section>, document.body);
}
export function ActivityReports({ records, onDelete }) {
  return <div className="activity-reports">{!records.length && <p className="activity-empty">跟绿豆说“我想要开口造世界”或“跟读练习”，把小世界变成成长记录。</p>}{records.map(record => <details className="activity-report" key={record.id}>
    <summary><span>✦ {ACTIVITIES[record.activityId]?.title || '互动玩法'}<small>{new Date(record.createdAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></span><b>{record.report.status === 'completed' ? '已完成' : '练习记录'}</b></summary>
    <p>{record.report.chapter || '我的英语小世界'}</p>
    <div className="activity-metrics"><span><b>{record.report.completedLessons} / {record.report.totalLessons}</b>目标词完成</span><span><b>{record.report.voiceAttempts}</b>开口次数</span><span><b>{record.report.words.length}</b>用到的词</span></div>
    <p className="activity-words">{record.report.words.join(' · ') || '这次还没有用到英语单词'}</p>
    <small>{Math.floor(record.report.durationSeconds / 60)} 分 {record.report.durationSeconds % 60} 秒 · 点词 {record.report.menuAttempts} 次 · {record.report.status === 'completed' ? '完成体验' : '提前退出'} · 目标词完成记录</small>
    <button className="activity-delete" type="button" onClick={() => onDelete(record.id)}>删除这条记录</button>
  </details>)}</div>;
}
