import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import FriendCard from "./FriendCard.jsx";
import { loadFriends } from "./friend-store.js";
import "./friends.css";

export default function FriendCollection({ friends: supplied }) {
  const [localFriends, setLocalFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const friends = supplied || localFriends;

  useEffect(() => {
    if (supplied) return undefined;
    let alive = true;
    loadFriends().then((items) => alive && setLocalFriends(items)).catch(() => alive && setError("朋友图鉴暂时没有打开成功。"));
    return () => { alive = false; };
  }, [supplied]);

  return <section className="friend-collection" aria-label="朋友图鉴">
    <header className="friend-collection-heading">
      <div><strong>朋友图鉴</strong><span>把镜头里的发现，收成一张张贴纸</span></div>
      <b>{friends.length}</b>
    </header>
    {friends.length ? <div className="friend-collection-grid">
      {friends.map((friend, index) => <button key={friend.id} type="button" className="friend-open-card" style={{ "--stamp-delay": `${Math.min(index, 12) * 72}ms` }} onClick={() => setSelected(friend)} aria-label={`打开${friend.name}的图鉴`}>
        <FriendCard friend={friend} compact />
      </button>)}
    </div> : <div className="friend-collection-empty"><span aria-hidden="true">✦</span><h3>第一张贴纸，等你发现</h3><p>把绘本、植物或好奇的小东西<br />拿给叫叫看一看。</p></div>}
    {error && <p className="friend-error" role="alert">{error}</p>}
    {selected && createPortal(<div className="friend-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.name}的图鉴`} onClick={() => setSelected(null)}>
      <article className="friend-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="friend-icon-button" type="button" aria-label="关闭图鉴" onClick={() => setSelected(null)}><X size={20} weight="bold" /></button>
        <FriendCard friend={selected} />
        <p className="friend-dialogue-note">想给它换个名字，直接对叫叫说“它叫……”就好。</p>
      </article>
    </div>, document.body)}
  </section>;
}
