import { useEffect, useRef, useState } from "react";
import { PauseSolid, PlaySolid } from "iconoir-react";

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

/**
 * 叫叫语音留言卡片：独立于「当天小记」展示的语音消息。
 * 优先播放真实音频资源（note.audioUrl，由 TTS 生成的叫叫音色 mp3）；
 * 无音频资源时降级用浏览器 speechSynthesis 朗读留言文本。
 */
export function LeaveNoteCard({ note, onFinished }) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gone, setGone] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const audioElementRef = useRef(null);
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!(note?.audioBlob instanceof Blob)) { setBlobUrl(""); return undefined; }
    const url = URL.createObjectURL(note.audioBlob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [note?.audioBlob]);
  const audioUrl = blobUrl || note?.audioUrl || "";
  const durationSec = Math.max(1, Number(note?.durationSec) || 8);

  const clearTimers = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const stop = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    clearTimers();
    setPlaying(false);
    setElapsed(0);
  };

  useEffect(() => stop, []);

  const toggle = () => {
    if (playing) {
      stop();
      return;
    }
    const text = String(note?.text || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    setPlaying(true);
    setElapsed(0);

    if (audioUrl) {
      // 真实音频资源：用 <audio> 播放叫叫音色，进度跟随真实播放时长。
      // 若资源缺失/加载失败（如 TTS 配额不足未生成），自动降级为浏览器语音合成。
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      const fallbackToSpeech = () => {
        audioElementRef.current = null;
        clearTimers();
        speakViaBrowser(text);
      };
      audio.addEventListener("error", fallbackToSpeech, { once: true });
      audio.play().catch(fallbackToSpeech);
      timerRef.current = window.setInterval(() => {
        if (audio.ended) {
          stop();
          onFinished?.();
          return;
        }
        const current = audio.currentTime || 0;
        setElapsed(current);
      }, 200);
      audio.addEventListener("ended", () => {
        stop();
        onFinished?.();
      }, { once: true });
      return;
    }

    speakViaBrowser(text);
  };

  const speakViaBrowser = (text) => {
    const start = performance.now();
    timerRef.current = window.setInterval(() => {
      const progress = (performance.now() - start) / 1000;
      if (progress >= durationSec) {
        stop();
        onFinished?.();
        return;
      }
      setElapsed(progress);
    }, 200);
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = note?.character === "lvdou" ? "en-US" : "zh-CN";
      utterance.rate = 1;
      utterance.onend = () => {
        stop();
        onFinished?.();
      };
      utterance.onerror = () => {
        stop();
        onFinished?.();
      };
      window.speechSynthesis.cancel();
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      const fallbackTimer = window.setTimeout(() => {
        stop();
        onFinished?.();
      }, durationSec * 1000);
      timerRef.current = fallbackTimer;
    }
  };

  if (gone) return null;
  const progress = durationSec > 0 ? Math.min(1, elapsed / durationSec) : 0;

  return (
    <div className={`leave-note-card${playing ? " is-playing" : ""}`}>
      <button type="button" className="leave-note-play" onClick={toggle} aria-label={playing ? "暂停留言" : "播放留言"}>
        {playing ? (
          <span className="leave-note-pause" aria-hidden="true"><PauseSolid width={20} height={20} /></span>
        ) : (
          <span className="leave-note-play-icon" aria-hidden="true"><PlaySolid width={20} height={20} /></span>
        )}
      </button>
      <div className="leave-note-body">
        <div className="leave-note-meta"><span className="leave-note-badge">{note?.character === "lvdou" ? "Domi 录音" : "叫叫录音"}</span><span className="leave-note-time">{formatDuration(elapsed)}</span></div>
        <div className="leave-note-wave" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => {
            const height = 30 + ((index * 17) % 70);
            const active = progress > 0 && index / 24 <= progress;
            return <i key={index} style={{ height: `${height}%` }} className={active ? "is-active" : ""} />;
          })}
        </div>
      </div>
    </div>
  );
}
