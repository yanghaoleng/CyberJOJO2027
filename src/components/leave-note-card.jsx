import { useEffect, useRef, useState } from "react";

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
  const audioElementRef = useRef(null);
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);

  const audioUrl = note?.audioUrl || "";
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
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      audio.play().catch(() => {
        stop();
        onFinished?.();
      });
      timerRef.current = window.setInterval(() => {
        if (audio.ended) {
          stop();
          onFinished?.();
          return;
        }
        const current = audio.currentTime || 0;
        if (current >= durationSec) {
          stop();
          onFinished?.();
          return;
        }
        setElapsed(current);
      }, 200);
      audio.addEventListener("ended", () => {
        stop();
        onFinished?.();
      }, { once: true });
      return;
    }

    // 降级：浏览器语音合成朗读。
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
      utterance.lang = "zh-CN";
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
          <span className="leave-note-pause" aria-hidden="true">❚❚</span>
        ) : (
          <span className="leave-note-play-icon" aria-hidden="true">▶</span>
        )}
      </button>
      <div className="leave-note-body">
        <div className="leave-note-meta"><span className="leave-note-badge">叫叫留言</span><span className="leave-note-time">{formatDuration(progress * durationSec)}</span></div>
        <div className="leave-note-wave" aria-hidden="true">
          {Array.from({ length: 24 }, (_, index) => {
            const height = 30 + ((index * 17) % 70);
            const active = progress > 0 && index / 24 <= progress;
            return <i key={index} style={{ height: `${height}%` }} className={active ? "is-active" : ""} />;
          })}
        </div>
        <p className="leave-note-text">{note?.text}</p>
      </div>
    </div>
  );
}
