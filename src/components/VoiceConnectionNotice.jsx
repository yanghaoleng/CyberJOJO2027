import { useEffect, useState } from 'react';
import { voiceConnectionMessage } from '../voice-reconnect.js';
export function VoiceConnectionNotice({ state, issue, onRetry, onClose }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (state.phase !== 'retrying') return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [state.phase, state.nextAt]);
  const message = voiceConnectionMessage(state, now) || issue;
  if (!message) return null;
  const blockedAuth = state.code === 'voice_auth_failed';
  return <div className="voice-health-hint" data-connection-phase={state.phase}>
    <span role="status" aria-live="polite">{message}</span>
    {!blockedAuth && <button type="button" onClick={onRetry} aria-label="恢复语音">{state.phase === 'blocked' ? '恢复' : '立即重试'}</button>}
    <button type="button" onClick={onClose} aria-label="关闭语音">关闭</button>
  </div>;
}
