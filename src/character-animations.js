// The compact ZHc export omits these dedicated reactions. Prefer the original
// animation on characters that include it; otherwise use a related expression.
const REACTION_FALLBACKS = {
  TalkingEmotion_Expectation: "TalkingEmotion_Curious",
  TalkingEmotion_Frighten: "TalkingEmotion_Surprised",
  TalkingEmotion_Sure: "TalkingEmotion_Praise",
};

export function resolveCharacterAnimation(name, available) {
  if (available.includes(name)) return name;
  const fallback = REACTION_FALLBACKS[name];
  return fallback && available.includes(fallback) ? fallback : null;
}
