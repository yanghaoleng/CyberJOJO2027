import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FriendCard from "./FriendCard.jsx";
import { deleteFriend, imageToPortrait, loadFriends, saveFriend } from "./friend-store.js";
import { exportFriendCard } from "./export-friend.js";
import "./friends.css";

export default function FriendCollection({ friends: supplied, onChange, onReaction }) {
  const [localFriends, setLocalFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const friends = supplied || localFriends;
  useEffect(() => { if (!supplied) void loadFriends().then(setLocalFriends).catch(() => setError("朋友收藏暂时没有打开成功。")); }, [supplied]);
  async function publish() { const items = await loadFriends(); setLocalFriends(items); onChange?.(items); }
  async function save() {
    setBusy(true); setError("");
    try { const record = await saveFriend(draft, { expectedVersion: selected.version }); await publish(); setSelected(record); setDraft(null); onReaction?.("已经按你说的改好啦。", "happy"); }
    catch (cause) { setError(cause.message || "修改没有保存成功。"); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await deleteFriend(selected.id); await publish(); setSelected(null); setDeleting(false); }
    catch { setError("这次没有删除成功，请再试一次。"); } finally { setBusy(false); }
  }
  return <div className="friend-collection">
    <div className="friend-collection-heading"><strong>我的朋友们</strong><span>{friends.length} 位朋友 · 仅在本机</span></div>
    {friends.length ? <div className="friend-collection-grid">{friends.map((friend) => <button key={friend.id} type="button" className="friend-open-card" onClick={() => { setSelected(friend); setDraft(null); setDeleting(false); setError(""); }}><FriendCard friend={friend} compact /></button>)}</div>
      : <div className="friend-collection-empty"><span>✦</span><h3>第一位朋友，会是谁？</h3><p>在相机里把玩具介绍给叫叫，<br />确认后，名片就会收在这里。</p></div>}
    {error && <p className="friend-error" role="alert">{error}</p>}
    {selected && createPortal(<div className="friend-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.name}的名片`} onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") { setSelected(null); setDraft(null); } }}><div className="friend-detail-sheet">
      <header className="friend-sheet-header"><span className="friend-eyebrow">朋友名片</span><button className="friend-icon-button" type="button" aria-label="关闭朋友名片" onClick={() => { setSelected(null); setDraft(null); }}>×</button></header>
      <FriendCard friend={draft || selected} />
      {draft ? <form className="friend-edit-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <label className="friend-field">名字<input required maxLength={24} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="friend-field">是什么玩具<input maxLength={32} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })} /></label>
        <label className="friend-field">关于它的小故事<textarea rows={2} maxLength={240} value={draft.childDescription} onChange={(event) => setDraft({ ...draft, childDescription: event.target.value })} /></label>
        <label className="friend-replace-photo">替换封面照片<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const portraitBlob = await imageToPortrait(file); setDraft((current) => current ? { ...current, portraitBlob } : current); } catch (cause) { setError(cause.message); } }} /></label>
        <div className="friend-form-actions"><button type="submit" disabled={busy} className="friend-primary">保存修改</button><button type="button" disabled={busy} className="friend-secondary" onClick={() => setDraft(null)}>取消</button></div>
      </form> : deleting ? <div className="friend-delete-confirm"><p>从本机删除这张名片？</p><span>这张照片和介绍会一起移除。</span><div className="friend-form-actions"><button disabled={busy} className="friend-primary is-danger" type="button" onClick={() => void remove()}>删除名片</button><button className="friend-secondary" type="button" onClick={() => setDeleting(false)}>留着它</button></div></div>
        : <div className="friend-detail-actions"><button type="button" onClick={() => setDraft(selected)}>修改名片</button><button type="button" onClick={() => void exportFriendCard(selected).catch(() => setError("图片没有导出成功，请再试一次。"))}>保存图片</button><button type="button" className="is-danger" onClick={() => setDeleting(true)}>删除</button></div>}
      {error && <p className="friend-error" role="alert">{error}</p>}
    </div></div>, document.body)}
  </div>;
}
