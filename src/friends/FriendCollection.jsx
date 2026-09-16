import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import FriendCard from "./FriendCard.jsx";
import { isUnreadCollection, loadFriends } from "./friend-store.js";
import "./friends.css";

function CollectionEntry({ record, index, onOpen, onSeen }) {
  const node = useRef(null);
  const [arriving, setArriving] = useState(false);
  const unread = isUnreadCollection(record);
  useEffect(() => {
    if (!unread) return undefined;
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setArriving(true);
      timer = window.setTimeout(() => { void onSeen?.([record.id])?.catch(() => {}); }, 1100 + Math.min(index, 8) * 70);
    }, { threshold: .35 });
    observer.observe(node.current);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [unread, record.id, index, onSeen]);
  return <button ref={node} type="button" className={`friend-open-card ${arriving ? "is-new-arrival" : ""}`} style={{ "--stamp-delay": `${Math.min(index, 8) * 70}ms` }} onClick={() => onOpen(record)} aria-label={`打开${record.name}的收集`}>
    <FriendCard friend={record} compact />
    {unread && <span className="collection-new-label">新收集</span>}
  </button>;
}

export default function FriendCollection({ friends: supplied, onSeen, onRetry }) {
  const [localFriends, setLocalFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const friends = supplied || localFriends;

  useEffect(() => {
    if (supplied) return undefined;
    let alive = true;
    loadFriends().then((items) => alive && setLocalFriends(items)).catch(() => alive && setError("收集暂时没有打开成功。"));
    return () => { alive = false; };
  }, [supplied]);

  const selectedRecord = friends.find((record) => record.id === selected?.id) || selected;
  return <section className="friend-collection" aria-label="收集">
    <header className="friend-collection-heading">
      <div><strong>收集</strong><span>把镜头里的发现，收成一张张贴纸</span></div>
      <b>{friends.length}</b>
    </header>
    {friends.length ? <div className="friend-collection-grid">
      {friends.map((friend, index) => <CollectionEntry key={friend.id} record={friend} index={index} onOpen={setSelected} onSeen={onSeen} />)}
    </div> : <div className="friend-collection-empty"><span aria-hidden="true">✦</span><h3>第一张贴纸，等你发现</h3><p>把物品拿给叫叫看，<br />说“帮我收集这个”。</p></div>}
    {error && <p className="friend-error" role="alert">{error}</p>}
    {selected && createPortal(<div className="friend-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${selectedRecord.name}的收集`} onClick={() => setSelected(null)}>
      <article className="friend-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <button className="friend-icon-button" type="button" aria-label="关闭收集" onClick={() => setSelected(null)}><X size={20} weight="bold" /></button>
        <FriendCard friend={selectedRecord} />
        {selectedRecord.status === "failed" && <button className="collection-retry" type="button" onClick={() => void onRetry?.(selectedRecord)?.catch(() => setError("暂时没能重试，原图仍保存在这里"))}>用这张原图重新制作贴纸</button>}
        {["pending", "processing"].includes(selectedRecord.status) && <p className="friend-dialogue-note">原图已保存，贴纸会在做好后自动出现。你可以先去做别的事。</p>}
        <p className="friend-dialogue-note">想给它换个名字，直接对叫叫说“它叫……”就好。</p>
      </article>
    </div>, document.body)}
  </section>;
}
