import { useEffect, useState } from "react";
import { mergeHistory } from "./history.js";
import seed from "../../deploy/release-history.seed.json";
import "./changelog.css";

const base = import.meta.env.BASE_URL;
const clock = (value) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const dayLabel = (date) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(new Date(`${date}T12:00:00+08:00`));

export default function Changelog() {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);
  const [releaseUnavailable, setReleaseUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const title = document.title;
    document.title = "更新日志 · 赛博叫叫 2027";
    document.body.classList.add("changelog-body");
    return () => { document.title = title; document.body.classList.remove("changelog-body"); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const get = async (file) => {
      const response = await fetch(`${base}${file}`, { signal: controller.signal, cache: "no-cache" });
      if (!response.ok) throw new Error("Unavailable");
      return response.json();
    };
    setFailed(false);
    Promise.all([
      get("changelog.json"),
      get("release-history.json").then((value) => {
        if (!Array.isArray(value.releases)) throw new Error("Invalid release history");
        return value;
      }).catch((error) => {
        if (error.name === "AbortError") throw error;
        return { ...seed, unavailable: !import.meta.env.DEV };
      }),
    ]).then(([code, releases]) => {
      if (!Array.isArray(code.days)) throw new Error("Invalid history");
      if (!controller.signal.aborted) {
        setHistory(mergeHistory(code.days, releases.releases));
        setReleaseUnavailable(Boolean(releases.unavailable));
      }
    }).catch((error) => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, [retry]);

  return <main className="cl-page">
    <header className="cl-header">
      <a href={base} className="cl-brand"><img src={`${base}favicon-32.png`} width="28" height="28" alt="" />赛博叫叫 <span>2027</span></a>
      <nav aria-label="页面导航"><a href={`${base}assets/`}>资源</a><a href={base}>回到封面 <span aria-hidden="true">↗</span></a></nav>
    </header>
    <div className="cl-content">
      <section className="cl-intro">
        <p className="cl-eyebrow">一点一点，变得更好</p>
        <h1>更新日志<span aria-hidden="true">.</span></h1>
        <p>新玩法、小改进，还有每一次认真打磨。</p>
        <p className="cl-rule">发布与代码更新按天合并，最近的变化在最上面。</p>
      </section>
      {releaseUnavailable && <p className="cl-release-notice" role="status">发布记录暂未刷新，当前显示已确认的历史。<button onClick={() => setRetry((value) => value + 1)}>重试</button></p>}
      {failed ? <div className="cl-status" role="alert">更新记录暂时没有加载出来。<button onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>
        : !history ? <p className="cl-status" role="status">正在整理更新记录…</p>
          : <div className="cl-timeline">{history.map((day, index) => <article className="cl-day" key={day.date} id={`day-${day.date}`}>
            <div className="cl-date"><time dateTime={day.date}>{dayLabel(day.date)}</time>{index === 0 && <span className="cl-latest">最近更新</span>}</div>
            <div className="cl-entry">
              <div className="cl-meta">{day.releases.length > 0 && <span className="cl-release-badge">已发布{day.releases.length > 1 ? ` ${day.releases.length} 次` : ""}</span>}{day.commits.length > 0 && <span>{day.commits.length} 次代码更新</span>}</div>
              <h2>{day.title}</h2>
              <ul className="cl-highlights">{day.items.map((item) => <li key={item}>{item}</li>)}</ul>
              <details className="cl-details"><summary>查看记录 <span aria-hidden="true">＋</span></summary>
                {day.releases.length > 0 && <section aria-label="发布记录"><h3>发布</h3><ul>{day.releases.map((release) => <li key={release.id}><time dateTime={release.releasedAt}>{clock(release.releasedAt)}</time><span>版本上线</span><a href={`https://github.com/yanghaoleng/CyberJOJO2027/commit/${release.commit}`} target="_blank" rel="noreferrer">{release.commit.slice(0, 7)} <span aria-hidden="true">↗</span></a></li>)}</ul></section>}
                {day.commits.length > 0 && <section aria-label="代码提交"><h3>代码提交</h3><ul>{day.commits.map((commit) => <li key={commit.sha}><time dateTime={commit.committedAt}>{clock(commit.committedAt)}</time><span>{commit.subject}</span><a href={commit.url} target="_blank" rel="noreferrer">{commit.shortSha} <span aria-hidden="true">↗</span></a></li>)}</ul></section>}
              </details>
            </div>
          </article>)}</div>}
      <footer className="cl-footer">时间均为北京时间。代码按主分支提交日期归档，上线时间以实际发布记录为准。</footer>
    </div>
  </main>;
}
