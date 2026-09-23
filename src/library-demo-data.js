// 相册「模拟数据体验」演示数据
// 说明：这是产品演示用的虚构数据（孩子：小雨，6 岁），与真实本地数据完全隔离。
// 打开相册面板里的「模拟数据」开关后，展示的是下面这套内容；关闭后回到本机真实数据。
// 照片为 SVG 占位图（不引入外部资源、不依赖本地存储），贴纸为同款 SVG Blob。

const DAY = "2026";
// 相对固定日期构造时间戳（本地时区，均为傍晚拍摄时间）
const at = (month, date, hour = 17, minute = 40) => new Date(DAY, month - 1, date, hour, minute).getTime();

function svgPhoto({ gradient = ["#FFD9A0", "#FF9FB2"], emoji, label, sub }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${gradient[0]}"/><stop offset="1" stop-color="${gradient[1]}"/>
  </linearGradient></defs>
  <rect width="480" height="360" rx="24" fill="url(#g)"/>
  <circle cx="240" cy="148" r="74" fill="rgba(255,255,255,0.38)"/>
  <text x="240" y="192" font-size="92" text-anchor="middle">${emoji}</text>
  <text x="240" y="288" font-size="34" font-family="PingFang SC, Hiragino Sans GB, sans-serif" font-weight="bold" fill="rgba(255,255,255,0.98)" text-anchor="middle">${label}</text>
  ${sub ? `<text x="240" y="326" font-size="20" font-family="PingFang SC, Hiragino Sans GB, sans-serif" fill="rgba(255,255,255,0.85)" text-anchor="middle">${sub}</text>` : ""}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function svgSticker({ gradient = ["#C9B8FF", "#8FD8FF"], emoji, label }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
  <defs><radialGradient id="r" cx="0.5" cy="0.42" r="0.62">
    <stop offset="0" stop-color="${gradient[0]}"/><stop offset="1" stop-color="${gradient[1]}"/>
  </radialGradient></defs>
  <circle cx="180" cy="180" r="168" fill="url(#r)"/>
  <circle cx="180" cy="150" r="72" fill="rgba(255,255,255,0.4)"/>
  <text x="180" y="192" font-size="88" text-anchor="middle">${emoji}</text>
  <text x="180" y="300" font-size="32" font-family="PingFang SC, Hiragino Sans GB, sans-serif" font-weight="bold" fill="rgba(255,255,255,0.98)" text-anchor="middle">${label}</text>
</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

// —— 小雨的模拟照片流（由旧到新，含故事）——
export const DEMO_CAPTURES = [
  {
    id: "demo-photo-cat",
    type: "photo",
    url: svgPhoto({ gradient: ["#FFC98B", "#E8A87C"], emoji: "🐈", label: "大橘", sub: "奶奶家的橘猫" }),
    createdAt: at(8, 20, 17, 52),
    day: "2026-08-20",
    captionText: "奶奶家的橘猫，它叫大橘，它不让我摸。",
  },
  {
    id: "demo-photo-tower",
    type: "photo",
    url: svgPhoto({ gradient: ["#FFE0A3", "#FFB37A"], emoji: "🧱", label: "最高的积木塔", sub: "今天搭的" }),
    createdAt: at(8, 24, 18, 5),
    day: "2026-08-24",
    captionText: "今天搭了一座最高的积木塔。",
  },
  {
    id: "demo-photo-bear",
    type: "photo",
    url: svgPhoto({ gradient: ["#F3D9B1", "#D9A87E"], emoji: "🧸", label: "小熊", sub: "后来我给它改名毛毛" }),
    createdAt: at(8, 28, 17, 48),
    day: "2026-08-28",
    captionText: "它是小熊，后来我给它改名毛毛。",
  },
  {
    id: "demo-photo-tooth",
    type: "photo",
    url: svgPhoto({ gradient: ["#E8F6FF", "#B9D9FF"], emoji: "🦷", label: "第一颗掉的牙", sub: "妈妈说牙仙子会来" }),
    createdAt: at(9, 2, 17, 30),
    day: "2026-09-02",
    captionText: "我的第一颗牙掉了，妈妈说牙仙子会来。",
  },
  {
    id: "demo-photo-leaf",
    type: "photo",
    url: svgPhoto({ gradient: ["#FCE1A8", "#F4B66B"], emoji: "🍂", label: "秋天的银杏叶", sub: "像一把小扇子" }),
    createdAt: at(9, 8, 17, 22),
    day: "2026-09-08",
    captionText: "捡到一片像扇子的银杏叶。",
  },
  {
    id: "demo-photo-milk",
    type: "photo",
    url: svgPhoto({ gradient: ["#D9E8FF", "#A8C0FF"], emoji: "🥛", label: "恐龙牛奶盒", sub: "喝完牛奶把它收集起来" }),
    createdAt: at(9, 12, 18, 12),
    day: "2026-09-12",
    captionText: "牛奶盒上的恐龙，我收集起来了。",
  },
  {
    id: "demo-photo-drawing",
    type: "photo",
    url: svgPhoto({ gradient: ["#FFD3E0", "#FF9FB2"], emoji: "🎨", label: "给妈妈的画", sub: "想妈妈的时候画的" }),
    createdAt: at(9, 15, 17, 40),
    day: "2026-09-15",
    captionText: "想妈妈的时候，给妈妈画了一幅画。",
  },
  {
    id: "demo-photo-sky",
    type: "photo",
    url: svgPhoto({ gradient: ["#C9B8FF", "#FF9FB2"], emoji: "🌇", label: "傍晚的天空", sub: "是粉色的！" }),
    createdAt: at(9, 20, 18, 30),
    day: "2026-09-20",
    captionText: "我发现傍晚的天空是粉色的，因为太阳要睡觉了！",
  },
];

export const DEMO_COUNT = DEMO_CAPTURES.length;

// —— 相册时间线（按天分组，与 useDailyJournal 输出结构一致）——
export const DEMO_TIMELINE = DEMO_CAPTURES.map((item) => ({ dayKey: item.day, items: [item] }));

// —— 小雨的当天小记（模拟）——
export const DEMO_RECORDS = {
  "2026-08-24": {
    dayKey: "2026-08-24",
    source: "dialogue",
    summary: "小雨搭了一座最高的积木塔，却被误会是碰倒塔的人。她说不清自己的委屈，但把这件事认真记了下来。",
    moments: [
      {
        id: "demo-moment-tower",
        event: "今天积木塔倒了，小美说是我碰倒的……我没有碰。",
        feeling: "",
        thought: "想再跟老师说一次，可又有点不敢。",
        evidenceQuote: "我没有碰。",
      },
    ],
  },
  "2026-09-10": {
    dayKey: "2026-09-10",
    source: "dialogue",
    summary: "小雨想妈妈了。叫叫陪她给妈妈画了一幅画，她说画着画着，心里好了一点。",
    moments: [
      {
        id: "demo-moment-miss",
        event: "想妈妈了。",
        feeling: "有点难过",
        thought: "给妈妈画一幅画，等她回来送给她。",
        evidenceQuote: "想妈妈了。",
      },
    ],
  },
  "2026-09-15": {
    dayKey: "2026-09-15",
    source: "dialogue",
    summary: "给妈妈的画画好了。小雨说，妈妈看到一定会很开心。",
    moments: [
      {
        id: "demo-moment-drawing",
        event: "给妈妈的画画好了，是一朵花和一个小人。",
        feeling: "开心",
        thought: "妈妈看到一定会喜欢。",
      },
    ],
  },
  "2026-09-20": {
    dayKey: "2026-09-20",
    source: "dialogue",
    summary: "小雨连着两天观察傍晚的天空，发现它变成粉色了。这是她自己看到的答案。",
    moments: [
      {
        id: "demo-moment-sky",
        event: "我发现傍晚的天空是粉色的，因为太阳要睡觉了！",
        feeling: "",
        thought: "这是我自己发现的。",
        evidenceQuote: "我发现傍晚的天空是粉色的！",
      },
    ],
  },
};

// —— 小雨的玩具朋友（模拟）——
const maomaoSticker = svgSticker({ gradient: ["#F3D9B1", "#E0A87E"], emoji: "🧸", label: "毛毛" });
const dajuSticker = svgSticker({ gradient: ["#FFC98B", "#F29E6B"], emoji: "🐈", label: "大橘" });

export const DEMO_FRIENDS = [
  {
    id: "demo-friend-maomao",
    name: "毛毛",
    kind: "玩具熊",
    appearance: "黄色的毛毛熊，最喜欢被抱着睡觉。",
    childDescription: "今天我给它做了小被子。它原来叫小熊，是我改名叫毛毛的。",
    english: "bear",
    learning: "bear 就是熊的意思。",
    stickerBlob: maomaoSticker,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 28, 18, 0),
    updatedAt: at(9, 5, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-daju",
    name: "大橘",
    kind: "橘猫",
    appearance: "奶奶家的橘猫，爱吃鱼干。",
    childDescription: "它不让我摸，但会蹲在门口等我。",
    english: "cat",
    learning: "cat 就是猫的意思。",
    stickerBlob: dajuSticker,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 20, 18, 2),
    updatedAt: at(9, 3, 19, 10),
    version: 2,
  },
];
