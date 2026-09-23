import { useEffect, useState } from "react";
export function usePortraitUrl(source) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!source) { setUrl(""); return undefined; }
    if (typeof source === "string") { setUrl(source); return undefined; }
    const next = URL.createObjectURL(source); setUrl(next); return () => URL.revokeObjectURL(next);
  }, [source]);
  return url;
}
function speakWord(english) {
  if (!english || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const u = new SpeechSynthesisUtterance(english);
  u.lang = "en-US";
  u.rate = 0.8;
  const pickEnglishVoice = () => {
    const voices = synthesis.getVoices();
    const preferred = voices.find((voice) => /en-US/i.test(voice.lang) && /Samantha|Google US|Zira|Aria|Jenny|Daniel/i.test(voice.name))
      || voices.find((voice) => /^en(-|_)/i.test(voice.lang));
    if (preferred) u.voice = preferred;
    else u.lang = "en-US";
  };
  pickEnglishVoice();
  // macOS 上语音列表可能尚未加载，监听 voiceschanged 后再发声。
  if (!synthesis.getVoices().length) {
    synthesis.addEventListener("voiceschanged", pickEnglishVoice, { once: true });
  }
  synthesis.speak(u);
  // 部分浏览器 speak 后处于 paused 状态，主动 resume 确保出声。
  if (synthesis.paused) synthesis.resume();
}
function DetailWords({ friend, word }) {
  return (
    <>
      <div className="friend-card-word-row">
        <p className="friend-card-word-big">{word || friend.kind || "一个特别的发现"}</p>
        {word ? <button type="button" className="friend-speak-button" aria-label="读单词" onClick={(e) => { e.stopPropagation(); speakWord(word); }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg></button> : null}
      </div>
      <p className="friend-card-kind">{friend.kind || "一个特别的发现"}</p>
      <p className="friend-card-story">{friend.learning || friend.childDescription || "我们刚刚在镜头里认识它。"}</p>
      <div className="friend-card-date">收录于 {new Date(friend.createdAt || Date.now()).toLocaleDateString("zh-CN")}<span>✦</span></div>
    </>
  );
}
export default function FriendCard({ friend, compact = false }) {
  const url = usePortraitUrl(friend?.stickerUrl || friend?.stickerBlob || friend?.originalBlob || friend?.portraitBlob);
  const pending = friend.status && friend.status !== "ready";
  const word = friend?.english || "";
  return <article className={`friend-card ${compact ? "is-compact" : ""}`}>
    <div className={`friend-card-photo ${pending ? "is-original" : ""}`}>{url && <img src={url} alt={`${friend.name || "收集"}的${pending ? "原图" : "贴纸"}`} />}<span className="friend-card-stamp">{pending ? friend.status === "failed" ? "原图已保存" : "正在制作贴纸" : "已收集"}</span></div>
    <div className="friend-card-info"><div className="friend-card-kicker">我的收集</div><h3>{friend.name || "新发现"}</h3>
      {compact ? (word ? <p className="friend-card-word">{word}</p> : null) : <DetailWords friend={friend} word={word} />}
    </div>
  </article>;
}
