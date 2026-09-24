// A short-lived, silent cover connection. No media permission or audio context.
export function createVoicePrewarm(url, character, {
  Socket = globalThis.WebSocket,
  ttlMs = 25_000,
} = {}) {
  const socket = new Socket(url);
  let readyMessage = null;
  let startSent = false;
  let released = false;
  const onOpen = () => {
    startSent = true;
    socket.send(JSON.stringify({ type: "start", inputMode: "voice", character, deferGreeting: true }));
  };
  const onMessage = ({ data }) => {
    try {
      const message = JSON.parse(data);
      if (message.type === "ready") readyMessage = message;
      if (message.type === "error") dispose();
    } catch { /* Ignore non-protocol frames during warmup. */ }
  };
  const detach = () => {
    clearTimeout(timer);
    socket.removeEventListener("open", onOpen);
    socket.removeEventListener("message", onMessage);
    socket.removeEventListener("error", dispose);
    socket.removeEventListener("close", dispose);
  };
  function dispose() {
    if (released) return;
    released = true;
    detach();
    if (socket.readyState < 2) socket.close(1000, "cover warmup ended");
  }
  const timer = setTimeout(dispose, ttlMs);
  socket.addEventListener("open", onOpen);
  socket.addEventListener("message", onMessage);
  socket.addEventListener("error", dispose);
  socket.addEventListener("close", dispose);
  return {
    dispose,
    take() {
      if (released || socket.readyState >= 2) { dispose(); return null; }
      released = true;
      detach();
      return { socket, readyMessage, startSent };
    },
  };
}
