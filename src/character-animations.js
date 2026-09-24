export const CHARACTER_TIMELINES = Object.freeze({
  // Explicit full-body actions; do not include chewing in the random idle loop.
  CHEW_FULL_BODY: "Chew_FullBody",
  HEART_FULL_BODY: "Reaction_Heart_FullBody",
});

// The compact ZHc export omits these dedicated reactions. Prefer the original
// animation on characters that include it; otherwise use a related expression.
const REACTION_FALLBACKS = {
  TalkingEmotion_Expectation: "TalkingEmotion_Curious",
  TalkingEmotion_Frighten: "TalkingEmotion_Surprised",
  TalkingEmotion_Sure: "TalkingEmotion_Praise",
  // Reserved for the forthcoming full-body Rive timeline. Current exports do
  // not contain it yet, so the recognition feedback remains usable today.
  [CHARACTER_TIMELINES.HEART_FULL_BODY]: "TalkingEmotion_Happy",
};

export function resolveCharacterAnimation(name, available) {
  if (available.includes(name)) return name;
  const fallback = REACTION_FALLBACKS[name];
  return fallback && available.includes(fallback) ? fallback : null;
}
