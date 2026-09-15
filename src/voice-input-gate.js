export const CHARACTER_ECHO_TAIL_MS = 720;

export function startCharacterEchoGate() {
  return Number.POSITIVE_INFINITY;
}

export function endCharacterEchoGate(now, tailMs = CHARACTER_ECHO_TAIL_MS) {
  return now + tailMs;
}

export function isCharacterEchoGateActive(until, now) {
  return until === Number.POSITIVE_INFINITY || now < until;
}
