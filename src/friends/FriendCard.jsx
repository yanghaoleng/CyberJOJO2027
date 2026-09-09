import { useEffect, useState } from "react";
export function usePortraitUrl(blob) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!blob) { setUrl(""); return undefined; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}
export default function FriendCard({ friend, compact = false }) {
  const url = usePortraitUrl(friend?.portraitBlob);
  return <article className={`friend-card ${compact ? "is-compact" : ""}`}>
    <div className="friend-card-photo">{url && <img src={url} alt={friend.name ? `${friend.name}的照片` : "新朋友的照片"} />}<span className="friend-card-stamp">叫叫的朋友</span></div>
    <div className="friend-card-info"><div className="friend-card-kicker">HELLO, MY FRIEND</div><h3>{friend.name || "等你取一个名字"}</h3>
      <p className="friend-card-kind">{friend.kind || "一个特别的朋友"}</p>
      {!compact && <><p className="friend-card-story">{friend.childDescription || "我们的小故事，从今天开始。"}</p><div className="friend-card-date">认识于 {new Date(friend.createdAt || Date.now()).toLocaleDateString("zh-CN")}<span>✦</span></div></>}
    </div>
  </article>;
}
