// A suspended browser AudioContext must not leave connection setup pending forever.
export function resumeVoiceCapture(context, { signal, timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = error => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(Object.assign(new Error('capture setup canceled'), { name: 'AbortError' }));
    const timer = setTimeout(() => finish(Object.assign(new Error('capture resume needs interaction'), { name: 'NotAllowedError' })), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    Promise.resolve().then(() => { if (!settled) return context.resume(); }).then(() => finish(), finish);
  });
}
