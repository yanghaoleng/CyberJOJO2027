import { useEffect, useRef, useState } from "react";
import { createDomiSpeechPlayback } from "../domi-speech.js";
export function usePortraitUrl(source) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!source) { setUrl(""); return undefined; }
    if (typeof source === "string") { setUrl(source); return undefined; }
    const next = URL.createObjectURL(source); setUrl(next); return () => URL.revokeObjectURL(next);
  }, [source]);
  return url;
}
function DetailWords({ friend, word }) {
  const playerRef = useRef(null);
  const [voiceError, setVoiceError] = useState(false);
  useEffect(() => () => playerRef.current?.stop(), []);
  const speakWord = () => {
    setVoiceError(false);
    playerRef.current?.stop();
    playerRef.current = createDomiSpeechPlayback({ onError: () => setVoiceError(true) });
    void playerRef.current.play(word);
  };
  if (friend.character === "jiaojiao") return <>
    <p className="friend-card-kind">绘本角色贴纸</p>
    {friend.sourceIdiom && <div className="friend-card-idiom"><strong>{friend.sourceIdiom}</strong><span>原成语</span></div>}
    {friend.sourceMeaning && <p className="friend-card-story">原意：{friend.sourceMeaning}</p>}
    {friend.idiom ? <div className="friend-card-idiom"><strong>{friend.idiom}</strong><span>孩子创作的新说法</span></div> : <p className="friend-card-story">聊聊它在绘本里做过什么，再一起编一句新成语。</p>}
    {friend.idiomMeaning && <p className="friend-card-story">意思是：{friend.idiomMeaning}</p>}
    <div className="friend-card-date">收录于 {new Date(friend.createdAt || Date.now()).toLocaleDateString("zh-CN")}<span>✦</span></div>
  </>;
  return (
    <>
      <div className="friend-card-word-row">
        <p className="friend-card-word-big">{word || friend.kind || "一个特别的发现"}</p>
        {word ? <button type="button" className="friend-speak-button" aria-label="读单词" onClick={(e) => { e.stopPropagation(); speakWord(); }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg></button> : null}
      </div>
      {voiceError && <small role="status">声音暂时没准备好，再点一下试试</small>}
      <p className="friend-card-kind">{friend.kind || "一个特别的发现"}</p>
      <p className="friend-card-story">{friend.learning || friend.childDescription || "我们刚刚在镜头里认识它。"}</p>
      <div className="friend-card-date">收录于 {new Date(friend.createdAt || Date.now()).toLocaleDateString("zh-CN")}<span>✦</span></div>
    </>
  );
}

function DialogueContext({ friend }) {
  const entries = Array.isArray(friend?.dialogueContext) ? friend.dialogueContext : [];
  if (!entries.length) return null;
  return <div className="friend-card-context">
    <span>当时聊到</span>
    <p>{entries.map((entry) => {
      const speaker = entry.role === "user" ? "你" : entry.character === "lvdou" ? "Domi" : "叫叫";
      return `${speaker}：${entry.text}`;
    }).join(" · ")}</p>
  </div>;
}

export default function FriendCard({ friend, compact = false }) {
  const url = usePortraitUrl(friend?.stickerUrl || friend?.stickerBlob || friend?.originalBlob || friend?.portraitBlob);
  const pending = friend.status && friend.status !== "ready";
  const word = friend?.english || "";
  return <article className={`friend-card ${compact ? "is-compact" : ""}`}>
    <div className={`friend-card-photo ${pending ? "is-original" : ""}`}>{url && <img src={url} alt={`${friend.name || "收集"}的${pending ? "原图" : "贴纸"}`} />}<span className="friend-card-stamp">{pending ? friend.status === "failed" ? "原图已保存" : "正在制作贴纸" : "已收集"}</span></div>
    <div className="friend-card-info"><div className="friend-card-kicker">{friend.character === "jiaojiao" ? "叫叫 · 绘本角色" : friend.character === "lvdou" ? "Domi · Word card" : "以前的收集"}</div><h3>{friend.name || "新发现"}</h3>
      {compact ? (friend.character === "jiaojiao" ? <p className="friend-card-word">{friend.idiom || "我的创意成语"}</p> : word ? <p className="friend-card-word">{word}</p> : null) : <><DetailWords friend={friend} word={word} /><DialogueContext friend={friend} /></>}
    </div>
  </article>;
}
