export function classifyVoiceFailure(error) {
  const message = String(error?.message || '');
  const denied = /\b(?:401|403)\b|unauthori[sz]ed|forbidden|authentication|invalid.?api.?key|accessdenied/i.test(message);
  return denied ? { code: 'VOICE_AUTH_FAILED', retryable: false, message: '语音服务授权不可用，请联系维护者。' }
    : { code: 'ASR_UNAVAILABLE', retryable: true, message: '语音连接中断，正在重试。' };
}
