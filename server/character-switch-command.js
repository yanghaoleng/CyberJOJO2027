const CHARACTER_NAMES = Object.freeze({
  jiaojiao: "叫叫",
  lvdou: "绿豆",
});

function compactSpeech(text) {
  return String(text || "").replace(/[\s，。！？、,.!?：:；;“”"'（）()]/g, "");
}

function isSummonCommand(text, name) {
  return [
    new RegExp(`${name}(?:出来|出场|上场|登场|过来|回来|来一下|来吧|来|叫出来)`),
    new RegExp(`(?:换成|换上|切换到|切到|换|叫|请)${name}(?:吧|来)?$`),
  ].some((pattern) => pattern.test(text));
}

export function detectCharacterSwitchCommand(text) {
  const compact = compactSpeech(text);
  if (!compact) return null;
  for (const [character, name] of Object.entries(CHARACTER_NAMES)) {
    if (isSummonCommand(compact, name)) return character;
  }
  return null;
}

export const characterSwitchInternals = { CHARACTER_NAMES, compactSpeech, isSummonCommand };
