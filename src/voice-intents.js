const HEART_INTENT = /(?:叫叫[^。！？!?]{0,8})?(?:给我|帮我|想看你|来|可以)?[^。！？!?]{0,6}(?:比个?心|比心|爱心动作)/;
const LARGE_HEART_INTENT = /(?:大爱心|双手(?:比)?心|两只手(?:比)?心|两个手(?:比)?心)/;
const WREATH_INTENT = /(?:比(?:个)?花圈|花圈|爱心花圈|心形花圈)/;
const FOOD_WORDS = ["吃东西", "饿了", "好饿", "想吃", "美食", "好吃的", "好吃吗", "吃饭", "吃面", "吃菜", "吃", "喝", "饭", "面条", "米饭", "菜", "肉", "鱼", "蛋", "水果", "苹果", "香蕉", "橘子", "橙子", "西瓜", "葡萄", "草莓", "桃", "梨", "蔬菜", "胡萝卜", "玉米", "土豆", "面包", "蛋糕", "饼干", "糖果", "糖", "巧克力", "牛奶", "酸奶", "果汁", "汤", "饺子", "包子", "馒头", "粥", "汉堡", "披萨", "薯条", "冰淇淋", "零食", "早餐", "午餐", "晚餐", "早饭", "中饭", "晚饭", "夜宵"];
const FEED_INTENT = new RegExp(`(?:${FOOD_WORDS.join("|")})`);
const COLLECTION_INTENT = /(?:收集|收藏|收录|做成(?:一张|一个)?(?:单词)?贴纸|放进(?:朋友|图鉴|收藏))/;
const INSPECTION_READY = /(?:找到了|拿来了|拿过来了|放好了|摆好了|准备好了|给你看|你看(?:看)?|看这个|再看(?:一下)?|就在(?:中间|镜头前)|放在(?:中间|框里)|认一下|识别一下|看得见吗)/;

function cleanSubject(value) {
  return String(value || "")
    .replace(/^(?:叫叫[，, ]*)?(?:请|可以|能不能|麻烦你|帮我|帮忙)?/, "")
    .replace(/^(?:把|将)/, "")
    .replace(/(?:帮我)?(?:收集|收藏|收录)(?:一下)?/, "")
    .replace(/(?:做成(?:一张|一个)?(?:单词)?贴纸|放进(?:朋友|图鉴|收藏)|起来|进去|一下)/g, "")
    .replace(/[，,。！？!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

export function parseVoiceIntent(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (WREATH_INTENT.test(text)) return { type: "wreath" };
  if (HEART_INTENT.test(text) || LARGE_HEART_INTENT.test(text)) return { type: "heart", size: LARGE_HEART_INTENT.test(text) ? "large" : "small" };
  if (FEED_INTENT.test(text)) return { type: "feed" };
  if (COLLECTION_INTENT.test(text)) {
    return { type: "collect", subject: cleanSubject(text) || "镜头里的这个东西" };
  }
  return null;
}

export function shouldInspectAfterSpeech(value, phase) {
  if (!["waiting", "framing"].includes(phase)) return false;
  return INSPECTION_READY.test(String(value || ""));
}

export function shouldTriggerSceneAnalysis(value) {
  return INSPECTION_READY.test(String(value || ""));
}

export function getCollectionFollowUp(category, name) {
  const label = String(name || "这个新朋友").trim() || "这个新朋友";
  if (category === "book") return `你想先和我看看${label}的封面，还是读一小段给我听？`;
  if (category === "plant") return `你还发现${label}身上有什么颜色或新变化？`;
  if (category === "animal") return `你觉得${label}现在正在做什么呢？`;
  if (category === "food") return `你最先注意到${label}的颜色，还是它的形状？`;
  return `你是在哪里发现${label}的？`;
}
