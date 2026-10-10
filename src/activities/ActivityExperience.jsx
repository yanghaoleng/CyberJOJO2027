import { Sparks } from 'iconoir-react';
import { ACTIVITIES } from './activity-contract.js';
import './activities.css';
export function ActivityReports({ records, onDelete }) {
  return <div className="activity-reports">{!records.length && <p className="activity-empty">跟绿豆说“我想要开口造世界”或“跟读练习”，把小世界变成成长记录。</p>}{records.map(record => <article className="activity-report" key={record.id}>
    <header className="activity-report-heading"><span><Sparks aria-hidden="true"/> {ACTIVITIES[record.activityId]?.title || '互动玩法'}<small>{new Date(record.createdAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></span><b>{record.report.status === 'completed' ? '已完成' : '练习记录'}</b></header>
    <p>{record.report.chapter || '我的英语小世界'}</p>
    <div className="activity-metrics"><span><b>{record.report.completedLessons} / {record.report.totalLessons}</b>目标词完成</span><span><b>{record.report.voiceAttempts}</b>开口次数</span><span><b>{record.report.words.length}</b>用到的词</span></div>
    {record.report.wordGroupsVersion === 1 ? <>
      <section className="activity-word-group" aria-label="自主念出的词"><h4>自主念出的词 <small>当轮默认题干里没有</small></h4><p>{record.report.independentWords.join(' · ') || '这次还没有自主念出的新词'}</p></section>
      <section className="activity-word-group" aria-label="跟着引导念出的词"><h4>跟着引导念出的词</h4><p>{record.report.guidedWords.join(' · ') || '这次还没有跟着引导念出的词'}</p></section>
    </> : <section className="activity-word-group"><h4>已记录的词 · 未分组</h4><p>{record.report.words.join(' · ') || '这次还没有用到英语单词'}</p><small>这条记录未保留逐题词汇来源，新练习会分组记录。</small></section>}
    {record.report.spokenPhrases?.length>0&&<section className="activity-word-group" aria-label="念出的词组"><h4>念出的词组</h4><p>{record.report.spokenPhrases.slice(0,20).join(' · ')}</p>{record.report.spokenPhrases.length>20&&<small>共记录 {record.report.spokenPhrases.length} 个词组</small>}</section>}
    <small>{Math.floor(record.report.durationSeconds / 60)} 分 {record.report.durationSeconds % 60} 秒 · 换词 {record.report.menuAttempts} 次 · {record.report.status === 'completed' ? '完成体验' : '提前退出'} · 目标词完成记录</small>
    <button className="activity-delete" type="button" onClick={() => onDelete(record.id)}>删除这条记录</button>
  </article>)}</div>;
}
