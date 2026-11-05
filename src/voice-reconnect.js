// One reconnect owner per mounted camera. Never captures or requests media.
export class VoiceReconnect {
  constructor({ restart, onChange = () => {}, eligible = () => true, now = Date.now, random = Math.random, setTimer = (fn, delay) => globalThis.setTimeout(fn, delay), clearTimer = id => globalThis.clearTimeout(id) } = {}) {
    Object.assign(this, { restart, onChange, eligible, now, random, setTimer, clearTimer });
    this.active = false; this.online = true; this.visible = true; this.attempt = 0; this.epoch = 0;
    this.state = { phase: 'idle', attempt: 0, nextAt: 0, code: '' };
  }
  publish(phase, code = '', nextAt = 0) { this.state = { phase, code, nextAt, attempt: this.attempt }; this.onChange(this.state); }
  cancel() { this.clearTimer(this.timer); this.clearTimer(this.stable); this.timer = this.stable = null; }
  connecting() { this.cancel(); this.active = true; this.publish('connecting'); }
  ready() {
    if (!this.active || this.state.phase === 'blocked') return;
    this.cancel(); this.publish('connected');
    this.stable = this.setTimer(() => { if (this.active && this.state.phase === 'connected') this.attempt = 0; }, 30000);
  }
  stop() { this.active = false; this.epoch++; this.cancel(); this.attempt = 0; this.publish('idle'); }
  block(code) { if (!this.active) return; this.cancel(); this.publish('blocked', code); }
  environment({ online = this.online, visible = this.visible } = {}) {
    this.online = online; this.visible = visible;
    if (!this.active || this.state.phase === 'blocked') return;
    if (!online) { this.cancel(); this.publish('offline', this.state.code); return; }
    if (!visible && this.state.phase !== 'connected') { this.cancel(); this.publish('hidden', this.state.code); return; }
    if (visible && ['offline', 'hidden'].includes(this.state.phase)) this.schedule(true);
  }
  failed(code = 'connection_closed') {
    if (!this.active || ['retrying', 'offline', 'hidden', 'blocked'].includes(this.state.phase)) return;
    this.schedule(false, code);
  }
  schedule(immediate = false, code = this.state.code) {
    if (!this.active) return;
    this.cancel();
    if (!this.eligible()) { this.block('microphone_interrupted'); return; }
    if (!this.online) { this.publish('offline', code); return; }
    if (!this.visible) { this.publish('hidden', code); return; }
    if (!immediate) this.attempt++;
    const base = Math.min(30000, 750 * 2 ** Math.min(6, Math.max(0, this.attempt - 1)));
    const delay = immediate ? 0 : Math.round(base * (0.8 + this.random() * .4));
    this.publish('retrying', code, this.now() + delay);
    const epoch = this.epoch;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (!this.active || epoch !== this.epoch) return;
      if (!this.online || !this.visible) { this.environment(); return; }
      if (!this.eligible()) { this.block('microphone_interrupted'); return; }
      this.publish('connecting'); this.restart?.();
    }, delay);
  }
}
export function voiceConnectionMessage(state, now = Date.now()) {
  if (state.phase === 'connecting') return '正在连接语音…';
  if (state.phase === 'offline') return '网络已断开，等待网络恢复后重试';
  if (state.phase === 'hidden') return '语音已断开，回到页面后继续重试';
  if (state.phase === 'retrying') return `语音已断开，正在重试 · ${Math.max(1, Math.ceil((state.nextAt - now) / 1000))} 秒后重连`;
  if (state.phase === 'blocked') return ({ microphone_permission: '麦克风权限未开启，请在浏览器设置中允许后点恢复', microphone_missing: '未找到麦克风，请连接设备后点恢复', microphone_unsupported: '当前浏览器不支持语音，请更换支持的浏览器', microphone_interrupted: '麦克风已中断，请检查设备后点恢复', microphone_paused: '浏览器暂停收音，点恢复继续', voice_auth_failed: '语音服务授权不可用，请联系维护者', session_limit: '本次语音已结束，点恢复重新开始' })[state.code] || '语音暂不可用，请检查设置后点恢复';
  return '';
}
