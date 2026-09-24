const CHARACTER_NAMES = Object.freeze({
  jiaojiao: "叫叫",
  lvdou: "绿豆",
});
const DOMI = /domi/i;
const JIAOJIAO = /jiaojiao/i;

function compactSpeech(text) {
  return String(text || "").replace(/[\s，。！？、,.!?：:；;“”"'（）()]/g, "");
}

function isSummonCommand(text, name) {
  return [
    new RegExp(`${name}(?:出来|出场|上场|登场|过来|回来|来一下|来吧|来|叫出来)`),
    new RegExp(`(?:换成|换上|切换到|切到|换|叫|请|想|想见|想要见|想和|找)${name}(?:吧|来|聊聊|说话)?$`),
    new RegExp(`(?:我想|我想要|我想见|我想要见|好想|想念)${name}`),
  ].some((pattern) => pattern.test(text));
}

export function detectCharacterSwitchCommand(text) {
  const compact = compactSpeech(text);
  if (!compact) return null;
  if (JIAOJIAO.test(compact) && (/(?:想|见|找|换|切|叫|请|聊|来|要)/.test(compact) || /\b(?:want|see|talk|switch|call|miss)\b/i.test(String(text)))) return "jiaojiao";
  if (DOMI.test(compact) && (/(?:想|见|找|换|切|叫|请|聊|来|要)/.test(compact) || /\b(?:want|see|talk|switch|call|miss)\b/i.test(String(text)))) return "lvdou";
  for (const [character, name] of Object.entries(CHARACTER_NAMES)) {
    if (isSummonCommand(compact, name)) return character;
  }
  return null;
}

export const characterSwitchInternals = { CHARACTER_NAMES, compactSpeech, isSummonCommand };
