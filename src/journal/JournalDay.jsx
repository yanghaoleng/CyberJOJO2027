import { useState } from "react";
import "./journal.css";

export default function JournalDay({ record, state = "idle", onChange, onForget, onRetry }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const moments = record?.moments || [];
  async function save(moment, remove = false) {
    setBusy(true); setError("");
    try {
      if (remove) await onForget?.(record.dayKey, moment.id);
      else await onChange?.(record.dayKey, moment.id, draft);
      setEditing(null);
    } catch { setError("这次没有保存成功，请再试一次。"); }
    finally { setBusy(false); }
  }
  return <div className="journal-day">
    <div className="journal-day-heading"><span>✦ 当天小记</span>{moments.length > 0 && <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "收起" : "看看 / 修改"}</button>}</div>
    <p className="journal-day-copy">{record?.summary || (state === "loading" ? "叫叫正在整理今天的小故事…" : record?.suppressedEntryIds?.length ? "这件事已经忘记了。" : "聊聊今天的小事，回忆会留在这里。")}</p>
    {state === "error" && <button className="journal-retry" type="button" onClick={onRetry}>这次没整理好，点此重试</button>}
    {expanded && <div className="journal-moments">{moments.map((moment) => <article key={moment.id} className="journal-moment">
      {editing === moment.id ? <form onSubmit={(event) => { event.preventDefault(); void save(moment); }}>
        <label>发生了什么<textarea required maxLength={240} value={draft.event || ""} onChange={(event) => setDraft({ ...draft, event: event.target.value })} /></label>
        <label>当时的感受<input maxLength={240} placeholder="没有提到，可以留空" value={draft.feeling || ""} onChange={(event) => setDraft({ ...draft, feeling: event.target.value })} /></label>
        <label>自己的想法<input maxLength={240} placeholder="没有提到，可以留空" value={draft.thought || ""} onChange={(event) => setDraft({ ...draft, thought: event.target.value })} /></label>
        <div className="journal-actions"><button disabled={busy} type="submit">保存修改</button><button disabled={busy} type="button" onClick={() => setEditing(null)}>取消</button></div>
      </form> : <><p>{moment.event}</p>{moment.feeling && <p className="journal-detail">感受 · {moment.feeling}</p>}{moment.thought && <p className="journal-detail">想法 · {moment.thought}</p>}
        {moment.evidenceQuote && <blockquote>“{moment.evidenceQuote}”</blockquote>}
        {moment.userEdited && <small>已按你的修改记下</small>}
        <div className="journal-actions"><button type="button" disabled={busy} onClick={() => { setEditing(moment.id); setDraft(moment); }}>改一下</button><button className="journal-forget" type="button" disabled={busy} onClick={() => void save(moment, true)}>不记这件事</button></div>
      </>}
    </article>)}</div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
