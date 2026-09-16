import { useEffect, useState } from "react";
export function usePortraitUrl(blob) {
  const [url, setUrl] = useState("");
  useEffect(() => { if (!blob) { setUrl(""); return undefined; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}
export default function FriendCard({ friend, compact = false }) {
  const url = usePortraitUrl(friend?.stickerBlob || friend?.originalBlob || friend?.portraitBlob);
  const pending = friend.status && friend.status !== "ready";
  return <article className={`friend-card ${compact ? "is-compact" : ""}`}>
    <div className={`friend-card-photo ${pending ? "is-original" : ""}`}>{url && <img src={url} alt={`${friend.name || "收集"}的${pending ? "原图" : "贴纸"}`} />}<span className="friend-card-stamp">{pending ? friend.status === "failed" ? "原图已保存" : "正在制作贴纸" : "已收集"}</span></div>
    <div className="friend-card-info"><div className="friend-card-kicker">我的收集</div><h3>{friend.name || "新发现"}</h3>
      {!compact && <><p className="friend-card-kind">{friend.english || friend.kind || "一个特别的发现"}</p><p className="friend-card-story">{friend.learning || friend.childDescription || "我们刚刚在镜头里认识它。"}</p><div className="friend-card-date">收录于 {new Date(friend.createdAt || Date.now()).toLocaleDateString("zh-CN")}<span>✦</span></div></>}
    </div>
  </article>;
}
