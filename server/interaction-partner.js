// Describe only visible accessories/clothing, never identity or demographics.
export const INTERACTION_PARTNERS = Object.freeze({
  glasses: "戴眼镜的朋友", hat: "戴帽子的朋友",
  red_clothes: "穿红衣的朋友", blue_clothes: "穿蓝衣的朋友",
  white_clothes: "穿白衣的朋友", yellow_clothes: "穿黄衣的朋友",
  green_clothes: "穿绿衣的朋友", black_clothes: "穿黑衣的朋友",
});

export function normalizeInteractionPartner(value) {
  const confidence = typeof value?.confidence === "number" ? value.confidence : 0;
  const personCount = typeof value?.personCount === "number" ? value.personCount : 0;
  const kind = personCount === 1 && confidence >= .9 && confidence <= 1
    && Object.hasOwn(INTERACTION_PARTNERS, value?.kind) ? value.kind : "unknown";
  return { kind, confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0, personCount: Number.isFinite(personCount) ? personCount : 0 };
}

export function getInteractionPartnerLabel(value) {
  return INTERACTION_PARTNERS[normalizeInteractionPartner(value).kind] || "新用户";
}
