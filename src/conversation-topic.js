const TOPIC_RULES = [
  [/城堡/, "设计城堡"],
  [/(?:积木|乐高)/, "搭积木"],
  [/恐龙/, "聊恐龙"],
  [/(?:画画|绘画|画一画)/, "画画"],
  [/(?:故事|绘本|故事书)/, "讲故事"],
  [/(?:火箭|太空|星球|宇宙)/, "去太空探险"],
  [/(?:小猫|猫咪|小狗|狗狗|动物)/, "认识小动物"],
  [/(?:游戏|玩具)/, "一起玩游戏"],
];

export function getRecentConversationTopic(entries = []) {
  const recentChildSpeech = entries
    .filter((entry) => entry?.role === "user" && String(entry.text || "").trim().length >= 2)
    .slice(-6)
    .reverse()
    .map((entry) => String(entry.text).replace(/\s+/g, ""));

  for (const text of recentChildSpeech) {
    const rule = TOPIC_RULES.find(([pattern]) => pattern.test(text));
    if (rule) return rule[1];
  }
  return "";
}

export const conversationTopicInternals = { TOPIC_RULES };
