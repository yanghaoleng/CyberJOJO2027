export function startSocketHeartbeat(socket, { intervalMs = 15000, onTimeout } = {}) {
  let awaitingPong = false;
  const onPong = () => { awaitingPong = false; };
  socket.on("pong", onPong);
  const timer = setInterval(() => {
    if (socket.readyState !== 1) return;
    if (awaitingPong) { onTimeout?.(); socket.terminate(); return; }
    awaitingPong = true;
    socket.ping();
  }, intervalMs);
  timer.unref?.();
  return () => { clearInterval(timer); socket.off("pong", onPong); };
}
