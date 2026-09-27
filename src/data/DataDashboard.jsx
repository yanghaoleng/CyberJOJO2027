import { useEffect, useMemo, useRef, useState } from "react";
import { loadConversationEntries, loadConversationSummaries } from "../conversation-journal.js";
import { loadMediaCaptures } from "../media-library.js";
import { loadFriends } from "../friends/friend-store.js";
import { summarizeLocalData } from "./data-insights.js";
import "./data-dashboard.css";

const ACCESS_CODE = "997118";
const SESSION_KEY = "jocam-data-unlocked";
const fmt = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });

function AccessGate({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const add = (digit) => {
    if (Date.now() < lockedUntil) return;
    setError("");
    setPin((current) => (current + digit).slice(0, 6));
  };
  useEffect(() => {
    if (pin.length !== 6) return;
    if (pin === ACCESS_CODE) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
      return;
    }
    const nextFailures = failures + 1;
    setFailures(nextFailures);
    if (nextFailures >= 3) setLockedUntil(Date.now() + 15_000);
    setError(nextFailures >= 3 ? "尝试较多，请稍后再试" : "密码不对，请重试");
    setPin("");
  }, [pin, failures, onUnlock]);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  useEffect(() => {
    const onKey = (event) => {
      if (/^\d$/.test(event.key)) add(event.key);
      if (event.key === "Backspace") setPin((value) => value.slice(0, -1));
      if (event.key === "Escape") setPin("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return <main className="data-gate">
    <section aria-labelledby="gate-title">
      <p className="eyebrow">赛博叫叫 2027</p>
      <h1 id="gate-title">数据概览</h1>
      <p>输入 6 位密码查看这台设备上的匿名汇总。</p>
      <div className="pin-dots" aria-label={`已输入 ${pin.length} 位`}>
        {Array.from({ length: 6 }, (_, index) => <i className={index < pin.length ? "filled" : ""} key={index} />)}
      </div>
      <p className="gate-error" role="status">{remaining ? `${remaining} 秒后可重试` : error}</p>
      <div className="keypad" aria-label="数字键盘">
        {[1,2,3,4,5,6,7,8,9].map((number) => <button key={number} onClick={() => add(String(number))} disabled={remaining > 0}>{number}</button>)}
        <button className="key-action" onClick={() => setPin("")} disabled={remaining > 0}>清除</button>
        <button onClick={() => add("0")} disabled={remaining > 0}>0</button>
        <button className="key-action" onClick={() => setPin((value) => value.slice(0, -1))} disabled={remaining > 0}>删除</button>
      </div>
      <small>仅在当前浏览器会话内解锁。这里不显示对话原文、照片或真实身份。</small>
    </section>
  </main>;
}

function Trend({ days, metric }) {
  const values = days.map((day) => metric === "conversation" ? day.conversations : day.captures);
  const max = Math.max(1, ...values);
  const chart = { width: 1000, height: 320, left: 24, right: 18, top: 26, bottom: 42 };
  const plotWidth = chart.width - chart.left - chart.right;
  const baseline = chart.height - chart.bottom;
  const plotHeight = baseline - chart.top;
  const coordinates = values.map((value, index) => ({
    x: chart.left + (index / (values.length - 1)) * plotWidth,
    y: baseline - (value / max) * plotHeight,
    value,
  }));
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `${chart.left},${baseline} ${points} ${chart.width - chart.right},${baseline}`;
  const hasData = values.some(Boolean);
  return <div className="trend-wrap">
    <svg className="trend" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" role="img" aria-label={`近 30 天${metric === "conversation" ? "对话轮次" : "作品"}趋势`}>
      {[0, .5, 1].map((ratio) => <line className="trend-grid" key={ratio} x1={chart.left} y1={chart.top + plotHeight * ratio} x2={chart.width - chart.right} y2={chart.top + plotHeight * ratio} />)}
      {hasData && <>
        <polygon className="trend-area" points={area} />
        <polyline className="trend-line" points={points} />
        {coordinates.map(({ x, y, value }, index) => <circle tabIndex="0" aria-label={`${days[index].key}：${value}`} key={days[index].key} cx={x} cy={y} r="5"><title>{days[index].key}：{value}</title></circle>)}
      </>}
      {!hasData && <text className="trend-empty" x="500" y="160" textAnchor="middle">开始互动后，这里会出现趋势</text>}
    </svg>
    <div className="trend-labels"><span>{fmt.format(new Date(`${days[0].key}T00:00:00`))}</span><span>今天</span></div>
  </div>;
}

function Dashboard() {
  const [state, setState] = useState({ status: "loading", data: null });
  const [metric, setMetric] = useState("conversation");
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState("summary");
  const sectionRefs = useRef({});
  useEffect(() => {
    Promise.all([loadConversationEntries(), loadMediaCaptures(), loadConversationSummaries(), loadFriends()])
      .then(([entries, captures, summaries, friends]) => setState({ status: "ready", data: summarizeLocalData({ entries, captures, summaries, friends }) }))
      .catch(() => setState({ status: "error", data: null }));
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver((items) => {
      const current = items.filter((item) => item.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActive(current.target.id);
    }, { rootMargin: "-25% 0px -60%", threshold: [0.1, 0.5] });
    Object.values(sectionRefs.current).forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [state.status]);
  const data = state.data;
  const rows = useMemo(() => data?.days.filter((day) => day.total || day.summaries).reverse() || [], [data]);
  if (state.status === "loading") return <main className="data-status" aria-busy="true"><p>正在读取这台设备上的汇总…</p></main>;
  if (state.status === "error") return <main className="data-status"><h1>数据暂时读不到</h1><p>本机存储可能被浏览器关闭。没有任何内容被上传。</p><button onClick={() => location.reload()}>重新读取</button></main>;
  const empty = data.activeDays === 0;
  const comparison = data.change === null ? "暂时没有足够的前一周数据可比较。" : `近 7 天的互动量比此前 7 天${data.change >= 0 ? "增加" : "减少"} ${Math.abs(data.change * 100).toFixed(0)}%。`;
  return <main className="data-page">
    <header>
      <div><p className="eyebrow">本机数据 · 近 30 天</p><h1>赛博叫叫数据概览</h1></div>
      <a href="/">回到叫叫</a>
    </header>
    <nav className="section-nav" aria-label="页面章节">
      {[['summary','概览'],['trend','趋势'],['days','活跃日'],['contract','口径']].map(([id,label]) => <a key={id} className={active === id ? "active" : ""} href={`#${id}`}>{label}</a>)}
    </nav>
    <section id="summary" ref={(node) => { sectionRefs.current.summary = node; }} className="readout reveal">
      <p>{empty ? "这台设备近 30 天还没有形成可汇总的互动记录。" : `近 30 天有 ${data.activeDays} 天使用过叫叫，共留下 ${data.conversations} 次孩子主动表达和 ${data.captures} 份作品。`}</p>
      <p>{comparison}</p>
      <p>{data.latestAt ? `最近一次活动发生在 ${new Date(data.latestAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}。` : "开始一次对话或保存作品后，这里会出现趋势。"}</p>
    </section>
    <section className="metric-strip" aria-label="当前状态">
      <div><strong>{data.activeDays}</strong><span>活跃天</span></div><div><strong>{data.sessions}</strong><span>对话会话</span></div><div><strong>{data.summaries}</strong><span>当天小记</span></div><div><strong>{data.friends}</strong><span>认识的朋友</span></div>
    </section>
    <section id="trend" ref={(node) => { sectionRefs.current.trend = node; }} className="analysis-section reveal">
      <div className="section-heading"><div><h2>{metric === "conversation" ? "表达频率" : "作品积累"}</h2><p>{metric === "conversation" ? "每天孩子主动说出的对话轮次，不含叫叫回复。" : "每天保存到本机相册的作品数量。"}</p></div>
        <div className="tabs" role="tablist" aria-label="趋势指标"><button role="tab" aria-selected={metric === "conversation"} onClick={() => setMetric("conversation")}>对话</button><button role="tab" aria-selected={metric === "capture"} onClick={() => setMetric("capture")}>作品</button></div></div>
      <div className="chart-panel" role="tabpanel"><Trend days={data.days} metric={metric} /><p className="touch-values">近 7 天合计：{data.days.slice(-7).reduce((sum, day) => sum + (metric === "conversation" ? day.conversations : day.captures), 0)}</p></div>
    </section>
    <section id="days" ref={(node) => { sectionRefs.current.days = node; }} className="analysis-section reveal">
      <div className="section-heading"><div><h2>活跃日明细</h2><p>只列出发生过对话、保存作品或生成小记的日期。</p></div><span>{rows.length} 天</span></div>
      {rows.length ? <div className={`table-panel ${expanded ? "expanded" : ""}`}><table><thead><tr><th>日期</th><th>对话</th><th>作品</th><th>会话</th><th>小记</th></tr></thead><tbody>{rows.slice(0, expanded ? rows.length : 8).map((day) => <tr key={day.key}><td>{day.key}</td><td>{day.conversations}</td><td>{day.captures}</td><td>{day.sessions}</td><td>{day.summaries}</td></tr>)}</tbody></table>{rows.length > 8 && <button className="table-toggle" onClick={() => setExpanded((value) => !value)}>{expanded ? "收起" : `展开全部 ${rows.length} 天`}</button>}</div> : <p className="empty-state">还没有活跃日。数据会在使用叫叫后保存在这台设备上。</p>}
    </section>
    <section id="contract" ref={(node) => { sectionRefs.current.contract = node; }} className="data-contract reveal">
      <h2>数据口径</h2><dl><div><dt>来源</dt><dd>当前浏览器 IndexedDB，本页不会上传这些汇总。</dd></div><div><dt>范围</dt><dd>近 30 个自然日，按设备所在时区计算。</dd></div><div><dt>身份</dt><dd>仅限这台设备；无法识别真实用户，也不能跨设备合并。</dd></div><div><dt>隐私</dt><dd>不展示对话原文、照片、姓名、位置、IP 或设备指纹。</dd></div><div><dt>限制</dt><dd>清理浏览器数据、无痕模式或更换设备都会让记录缺失。</dd></div></dl>
    </section>
    <footer>读取时间：{new Date().toLocaleString("zh-CN")} · 页面密码只是本机隐私遮罩，不是账号认证。</footer>
  </main>;
}

export default function DataDashboard() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  return unlocked ? <Dashboard /> : <AccessGate onUnlock={() => setUnlocked(true)} />;
}
