import { createTextMotion } from './calligraph-bubble.jsx';

/** Shared presentation only: callers keep ownership of microphone/ASR/TTS. */
export const VOICE_INPUT_VERSION = '20260910-lyric-motion';
const aliases = { off: 'setup', idle: 'setup', recording: 'listening', processing: 'transcribing', streaming: 'thinking' };
const states = {
  setup: { visual: 'permission', label: '开始对话', description: '允许麦克风并开始对话' },
  requesting: { visual: 'thinking', label: '正在打开麦克风', busy: true },
  listening: { visual: 'wave', label: '暂停收音', description: '我在听，点一下暂停', pressed: true },
  receiving: { visual: 'wave', label: '暂停收音', description: '正在接收声音，点一下暂停', pressed: true },
  transcribing: { visual: 'thinking', label: '正在转写', description: '声音已收到，正在转成文字', busy: true },
  thinking: { visual: 'thinking', label: '正在想', description: '伙伴正在理解你的话', busy: true },
  speaking: { visual: 'thinking', label: '伙伴正在说话', busy: true },
  paused: { visual: 'permission', label: '继续对话', description: '麦克风已暂停，点一下继续' },
  quiet: { visual: 'wave', label: '暂停收音', description: '还没有听到声音，可以靠近一点慢慢说', pressed: true },
  short: { visual: 'wave', label: '暂停收音', description: '刚才的声音有点短，可以再说一次', pressed: true },
  empty: { visual: 'wave', label: '暂停收音', description: '收到声音了，但还没有听清文字，可以再说一次', pressed: true },
  error: { visual: 'permission', label: '再试一次', description: '语音暂时没有连上，点一下重试' },
  complete: { visual: 'permission', label: '对话已结束', disabled: true },
};
const normalize = state => Object.hasOwn(states, aliases[state] || state) ? aliases[state] || state : 'setup';
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const bars = '<i></i>'.repeat(8);
const markup = `<span class="voice-input-control__start"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg><span class="voice-input-control__label">开始对话</span></span><span class="voice-input-control__wave" aria-hidden="true">${bars}</span><span class="voice-input-control__thinking" aria-hidden="true">${bars}</span>`;
const mounts = new WeakMap();
const inputs = new WeakMap();

export function mountVoiceInputControl(button, waveDots = 8) {
  if (!button || mounts.has(button)) return button;
  button.classList.add('voice-input-control');
  button.innerHTML = markup;
  if(waveDots===6){button.dataset.waveDots='6';button.querySelector('.voice-input-control__wave').innerHTML='<i></i>'.repeat(6);}
  button.dataset.voiceControlMounted = 'true';
  button.dataset.voiceControlVersion = VOICE_INPUT_VERSION;
  const wave = [...button.querySelectorAll('.voice-input-control__wave i')];
  wave.forEach((bar, index) => bar.style.setProperty('--voice-activity-scale', String([.3, .45, .65, .85, .9, .7, .5, .35][index])));
  button.querySelectorAll('.voice-input-control__thinking i').forEach((dot, index) => {
    dot.style.setProperty('--voice-dot-turn', `${index * 45}deg`);
    dot.style.setProperty('--voice-dot-delay', `${index * 150}ms`);
  });
  mounts.set(button, { wave, label: button.querySelector('.voice-input-control__label') });
  setVoiceInputControlLevel(button, 0);
  return button;
}

// Compatibility entry points for existing callers. They do not change business
// disabled/pressed state or create/close a microphone stream.
export function setVoiceInputControlState(button, state = 'setup') {
  if (!button) return;
  mountVoiceInputControl(button);
  const kind = normalize(state), spec = states[kind];
  button.dataset.state = state;
  button.dataset.voiceVisual = spec.visual;
  mounts.get(button).label.textContent = spec.label;
  if (spec.visual !== 'wave') setVoiceInputControlLevel(button, 0);
}

export function setVoiceInputControlLevel(button, level) {
  if (!button) return;
  mountVoiceInputControl(button);
  const value = clamp(level), profiles = [.42, .58, .78, .94, 1, .84, .62, .46];
  button.dataset.levelSource = 'measured';
  button.dataset.voiceActive = String(value > .02);
  button.style.setProperty('--voice-level', value.toFixed(3));
  // A quiet microphone is still. Only the measured level changes these bars.
  mounts.get(button).wave.forEach((bar, index) => {
    if(button.dataset.waveDots==='6')bar.style.setProperty('--voice-dot-scale',(1+value*3*profiles[index]).toFixed(3));
    bar.style.setProperty('--voice-bar-scale', ((button.dataset.waveDots==='6'?.25:.16) + value * (button.dataset.waveDots==='6'?.75:.84) * profiles[index]).toFixed(3));
  });
}

export function createVoiceInput({ button, transcript, status, sanitize = text => text, waveDots = 8 } = {}) {
  if (!button) throw new TypeError('Voice input needs a button');
  if (inputs.has(button)) return inputs.get(button);
  mountVoiceInputControl(button,waveDots);
  const clean = value => String(sanitize(String(value ?? '')) ?? '').trim();
  let current = { state: 'setup', transcript: '', interim: false, message: '', level: 0, levelSource: 'measured', activity: false };
  let textNode, textMotion;
  if (transcript) {
    transcript.classList.add('voice-input-transcript');
    transcript.setAttribute('role', 'status');
    transcript.setAttribute('aria-live', 'polite');
    transcript.setAttribute('aria-atomic', 'true');
    transcript.removeAttribute('data-bubble-shell');
    transcript.removeAttribute('data-bubble-key');
    transcript.removeAttribute('data-bubble-max-chars');
    textNode = document.createElement('span');
    textNode.className = 'voice-input-transcript__text';
    transcript.replaceChildren(textNode);
    textNode.setAttribute('aria-hidden', 'true');
    textMotion = createTextMotion(textNode);
    transcript.hidden = true;
    transcript.dataset.voiceControlVersion = VOICE_INPUT_VERSION;
  }
  if (status) {
    status.classList.add('voice-input-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.hidden = true;
  }
  function setState(state = 'setup', options = {}) {
    const kind = normalize(state), spec = states[kind];
    current.state = state;
    current.message = clean(options.message ?? '');
    setVoiceInputControlState(button, state);
    button.disabled = options.disabled ?? Boolean(spec.busy || spec.disabled);
    button.setAttribute('aria-pressed', String(options.pressed ?? Boolean(spec.pressed)));
    button.setAttribute('aria-busy', String(Boolean(spec.busy)));
    button.setAttribute('aria-label', options.label || spec.description || spec.label);
    button.title = options.label || spec.description || spec.label;
    if (status) {
      const message = current.message || (['error', 'quiet', 'short', 'empty'].includes(kind) ? spec.description : '');
      if (status.textContent !== message) status.textContent = message;
      status.hidden = !message;
      status.dataset.state = state;
    }
    if (spec.visual !== 'wave') { current.level = 0; current.activity = false; }
    return api;
  }
  function setLevel(level) {
    current.level = clamp(level);
    current.levelSource = 'measured';
    current.activity = current.level > .02;
    setVoiceInputControlLevel(button, current.level);
    return api;
  }
  function setActivity(active) {
    // Web Speech hides its audio stream. Report its real speech activity with
    // a steady indicator; do not invent microphone amplitude or another stream.
    current.activity = Boolean(active);
    current.levelSource = 'activity';
    current.level = 0;
    setVoiceInputControlLevel(button, 0);
    button.dataset.levelSource = 'activity';
    button.dataset.voiceActive = String(current.activity);
    return api;
  }
  function setTranscript(value, { interim = false } = {}) {
    const text = clean(value), previousText = current.transcript, finalizing = current.interim && !interim;
    current.transcript = text;
    current.interim = Boolean(interim);
    if (!transcript) return api;
    const entering = transcript.hidden && Boolean(text);
    transcript.setAttribute('aria-live', interim ? 'off' : 'polite');
    transcript.dataset.interim = String(Boolean(interim));
    transcript.hidden = !text;
    transcript.setAttribute('aria-label', text);
    if (previousText !== text || finalizing) {
      textMotion.setText(text);
      // Keep the current spoken end in view as an interim phrase grows.
      textNode.scrollTop = textNode.scrollHeight;
    }
    if (entering) transcript.classList.add('voice-input-transcript--entering');
    else if (!text) transcript.classList.remove('voice-input-transcript--entering');
    return api;
  }
  function clearTranscript() { return setTranscript(''); }
  function reset(state = 'setup') {
    clearTranscript(); setLevel(0); return setState(state);
  }
  function dispose() { textMotion?.destroy(); inputs.delete(button); }
  const api = { setState, setLevel, setActivity, setTranscript, clearTranscript, reset, dispose, getState: () => ({ ...current }) };
  inputs.set(button, api);
  setState('setup');
  return api;
}
