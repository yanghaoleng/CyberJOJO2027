// 相册「模拟数据体验」演示数据
// 说明：这是产品演示用的虚构数据（孩子：小雨，6 岁），与真实本地数据完全隔离。
// 打开相册面板里的「模拟数据」开关后，展示的是下面这套内容；关闭后回到本机真实数据。
// 照片为 AI 生成的真实照片风格模拟图（public/demo-photos/），仅用于演示。

const DAY = "2026";
// 相对固定日期构造时间戳（本地时区，均为傍晚拍摄时间）
const at = (month, date, hour = 17, minute = 40) => new Date(DAY, month - 1, date, hour, minute).getTime();

const photo = (file) => `/demo-photos/${file}`;

// —— 小雨的模拟照片流（由旧到新，含故事；每天多张，部分照片里有叫叫）——
export const DEMO_CAPTURES = [
  // 2026-08-20 · 奶奶家的橘猫「大橘」
  {
    id: "demo-photo-cat-porch",
    type: "photo",
    url: photo("demo-2026-08-20-cat-porch.jpg"),
    createdAt: at(8, 20, 17, 52),
    day: "2026-08-20",
    captionText: "奶奶家门口的大橘，它每天都趴在石阶上等我。",
  },
  {
    id: "demo-photo-cat-fish",
    type: "photo",
    url: photo("demo-2026-08-20-cat-fish.jpg"),
    createdAt: at(8, 20, 18, 6),
    day: "2026-08-20",
    captionText: "大橘在吃小鱼干，我想摸它，但它不让。",
  },
  // 2026-08-24 · 最高的积木塔
  {
    id: "demo-photo-tower",
    type: "photo",
    url: photo("demo-2026-08-24-tower.jpg"),
    createdAt: at(8, 24, 15, 10),
    day: "2026-08-24",
    captionText: "今天搭了一座最高的积木塔，比我还高。",
  },
  {
    id: "demo-photo-tower-jiaojiao",
    type: "photo",
    url: photo("demo-2026-08-24-tower-jiaojiao.jpg"),
    createdAt: at(8, 24, 15, 24),
    day: "2026-08-24",
    captionText: "叫叫飞到塔顶，说它是塔顶的小小守卫。",
  },
  // 2026-08-28 · 玩具熊「毛毛」
  {
    id: "demo-photo-bear-bed",
    type: "photo",
    url: photo("demo-2026-08-28-bear-bed.jpg"),
    createdAt: at(8, 28, 20, 15),
    day: "2026-08-28",
    captionText: "小熊坐在我的床上，它原来叫小熊，我给它改名毛毛。",
  },
  {
    id: "demo-photo-bear-blanket",
    type: "photo",
    url: photo("demo-2026-08-28-bear-blanket.jpg"),
    createdAt: at(8, 28, 20, 40),
    day: "2026-08-28",
    captionText: "今天给毛毛做了小被子，它睡得很香。",
  },
  // 2026-09-02 · 第一颗掉的牙
  {
    id: "demo-photo-tooth",
    type: "photo",
    url: photo("demo-2026-09-02-tooth.jpg"),
    createdAt: at(9, 2, 19, 5),
    day: "2026-09-02",
    captionText: "我的第一颗牙掉了，妈妈说牙仙子会来。",
  },
  {
    id: "demo-photo-tooth-jiaojiao",
    type: "photo",
    url: photo("demo-2026-09-02-tooth-jiaojiao.jpg"),
    createdAt: at(9, 2, 19, 12),
    day: "2026-09-02",
    captionText: "叫叫说它也想看看我的牙，说它像一颗小珍珠。",
  },
  // 2026-09-08 · 秋天的银杏叶
  {
    id: "demo-photo-ginkgo-desk",
    type: "photo",
    url: photo("demo-2026-09-08-ginkgo-desk.jpg"),
    createdAt: at(9, 8, 17, 22),
    day: "2026-09-08",
    captionText: "捡到几片银杏叶，像一把把小扇子。",
  },
  {
    id: "demo-photo-ginkgo-sky",
    type: "photo",
    url: photo("demo-2026-09-08-ginkgo-sky.jpg"),
    createdAt: at(9, 8, 17, 48),
    day: "2026-09-08",
    captionText: "举着叶子看天空，叶子变透明了。",
  },
  // 2026-09-12 · 恐龙牛奶盒
  {
    id: "demo-photo-milk",
    type: "photo",
    url: photo("demo-2026-09-12-milk.jpg"),
    createdAt: at(9, 12, 12, 30),
    day: "2026-09-12",
    captionText: "牛奶盒上的恐龙，我喝完牛奶把它收集起来。",
  },
  // 2026-09-15 · 给妈妈的画
  {
    id: "demo-photo-drawing-fridge",
    type: "photo",
    url: photo("demo-2026-09-15-drawing-fridge.jpg"),
    createdAt: at(9, 15, 18, 40),
    day: "2026-09-15",
    captionText: "给妈妈画的画，是一朵花和一个小人，贴在冰箱上等她回来看。",
  },
  {
    id: "demo-photo-drawing-jiaojiao",
    type: "photo",
    url: photo("demo-2026-09-15-drawing-jiaojiao.jpg"),
    createdAt: at(9, 15, 18, 48),
    day: "2026-09-15",
    captionText: "叫叫说它最喜欢画上的那朵花。",
  },
  // 2026-09-20 · 傍晚的粉色天空
  {
    id: "demo-photo-sky-window",
    type: "photo",
    url: photo("demo-2026-09-20-sky-window.jpg"),
    createdAt: at(9, 20, 18, 30),
    day: "2026-09-20",
    captionText: "我发现傍晚的天空是粉色的！",
  },
  {
    id: "demo-photo-sky-jiaojiao",
    type: "photo",
    url: photo("demo-2026-09-20-sky-jiaojiao.jpg"),
    createdAt: at(9, 20, 18, 36),
    day: "2026-09-20",
    captionText: "叫叫和我一起看晚霞，它说这是太阳在和我们说晚安。",
  },
  {
    id: "demo-photo-jiaojiao-hands",
    type: "photo",
    url: photo("demo-2026-09-20-jiaojiao-hands.jpg"),
    createdAt: at(9, 20, 18, 42),
    day: "2026-09-20",
    captionText: "叫叫站在我的手心里，暖暖的。",
  },
];

export const DEMO_COUNT = DEMO_CAPTURES.length;

// —— 相册时间线（按天分组，与 useDailyJournal 输出结构一致）——
// 有照片的日子按照片分组；2026-09-10 只有对话小记没有照片（体现「不拍照也能留下小记」）
export const DEMO_TIMELINE = [
  { dayKey: "2026-08-20", items: DEMO_CAPTURES.filter((item) => item.day === "2026-08-20") },
  { dayKey: "2026-08-24", items: DEMO_CAPTURES.filter((item) => item.day === "2026-08-24") },
  { dayKey: "2026-08-28", items: DEMO_CAPTURES.filter((item) => item.day === "2026-08-28") },
  { dayKey: "2026-09-02", items: DEMO_CAPTURES.filter((item) => item.day === "2026-09-02") },
  { dayKey: "2026-09-08", items: DEMO_CAPTURES.filter((item) => item.day === "2026-09-08") },
  { dayKey: "2026-09-10", items: [] },
  { dayKey: "2026-09-12", items: DEMO_CAPTURES.filter((item) => item.day === "2026-09-12") },
  { dayKey: "2026-09-15", items: DEMO_CAPTURES.filter((item) => item.day === "2026-09-15") },
  { dayKey: "2026-09-20", items: DEMO_CAPTURES.filter((item) => item.day === "2026-09-20") },
];

// —— 小雨的当天小记（模拟；每一天都有 AI 总结风格的生动小记）——
export const DEMO_RECORDS = {
  "2026-08-20": {
    dayKey: "2026-08-20",
    source: "dialogue",
    summary: "小雨在奶奶家门口遇见了大橘。她说大橘是「凶凶的，但其实很温柔」的猫，想摸又不敢，最后决定下次带小鱼干来和它交朋友。",
    moments: [
      {
        id: "demo-moment-cat",
        event: "在奶奶家门口看见大橘了，它趴在石阶上晒太阳。",
        feeling: "开心，又有一点怕",
        thought: "下次带小鱼干给它吃，它就不凶了。",
        evidenceQuote: "大橘凶凶的，但其实很温柔。",
      },
    ],
  },
  "2026-08-24": {
    dayKey: "2026-08-24",
    source: "dialogue",
    summary: "小雨搭了一座比她还高的积木塔，却被误会是碰倒塔的人。她说不清自己的委屈，但把这件事认真记了下来。",
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
  "2026-08-28": {
    dayKey: "2026-08-28",
    source: "dialogue",
    summary: "小雨把玩具熊改名叫毛毛，还亲手给它做了一条小被子。她说毛毛是「全世界最软的熊」，睡觉也要抱着。",
    moments: [
      {
        id: "demo-moment-bear",
        event: "我给小熊改名叫毛毛了，还给它做了一条小被子。",
        feeling: "骄傲",
        thought: "毛毛是全世界最软的熊，谁都比不上。",
        evidenceQuote: "以后它就叫毛毛啦。",
      },
    ],
  },
  "2026-09-02": {
    dayKey: "2026-09-02",
    source: "dialogue",
    summary: "小雨掉了第一颗牙。她一边盼着牙仙子来，一边又舍不得，想把牙先自己留几天。",
    moments: [
      {
        id: "demo-moment-tooth",
        event: "我的第一颗牙掉了，好小好小一颗。",
        feeling: "又紧张又开心",
        thought: "牙仙子真的会来吗？我想先自己留几天。",
        evidenceQuote: "妈妈说要等牙仙子，可是我也想留着它。",
      },
    ],
  },
  "2026-09-08": {
    dayKey: "2026-09-08",
    source: "dialogue",
    summary: "小雨捡到几片银杏叶，说它们「像一把把小扇子」。她还发现，把叶子举起来对着天空看，叶子会变得透明。",
    moments: [
      {
        id: "demo-moment-ginkgo",
        event: "捡到几片银杏叶，像小扇子。",
        feeling: "惊喜",
        thought: "叶子对着天空看会变透明，是它自己在发光吗？",
        evidenceQuote: "快看，叶子变成透明的了！",
      },
    ],
  },
  "2026-09-10": {
    dayKey: "2026-09-10",
    source: "dialogue",
    summary: "小雨想妈妈了，说着说着眼睛有点红。叫叫陪她给妈妈画了一幅画，她说画着画着，心里好了一点。",
    moments: [
      {
        id: "demo-moment-miss",
        event: "想妈妈了。",
        feeling: "有点难过",
        thought: "给妈妈画一幅画，等她回来送给她。",
        evidenceQuote: "妈妈什么时候回来呀……",
      },
    ],
  },
  "2026-09-12": {
    dayKey: "2026-09-12",
    source: "dialogue",
    summary: "小雨把喝完的恐龙牛奶盒收集起来。她说恐龙是「最大最大的动物」，这么厉害的家伙，要放进自己的百宝箱。",
    moments: [
      {
        id: "demo-moment-milk",
        event: "喝完牛奶，把恐龙牛奶盒留下来。",
        feeling: "得意",
        thought: "恐龙是最大最大的动物，我要好好保存它。",
        evidenceQuote: "这个恐龙好厉害，比房子还大！",
      },
    ],
  },
  "2026-09-15": {
    dayKey: "2026-09-15",
    source: "dialogue",
    summary: "给妈妈的画画好了，是一朵花和一个小人。小雨说，等妈妈回来看到画，一定会很开心。",
    moments: [
      {
        id: "demo-moment-drawing",
        event: "给妈妈的画画好了，是一朵花和一个小人。",
        feeling: "开心",
        thought: "妈妈看到一定会喜欢。",
        evidenceQuote: "妈妈，你看，这是我画的花！",
      },
    ],
  },
  "2026-09-20": {
    dayKey: "2026-09-20",
    source: "dialogue",
    summary: "小雨连着两天观察傍晚的天空，发现它是粉色的。这是她自己看到的答案，叫叫说这个发现真了不起。",
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

// —— 小雨的玩具朋友（模拟；贴纸为 AI 生成的真实照片风圆形贴纸）——
export const DEMO_FRIENDS = [
  {
    id: "demo-friend-maomao",
    name: "毛毛",
    kind: "玩具熊",
    appearance: "黄色的毛毛熊，最喜欢被抱着睡觉。",
    childDescription: "今天我给它做了小被子。它原来叫小熊，是我改名叫毛毛的。",
    english: "bear",
    learning: "bear 就是熊的意思。",
    stickerUrl: "/demo-photos/sticker-maomao.jpg",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 28, 20, 50),
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
    stickerUrl: "/demo-photos/sticker-daju.jpg",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 20, 18, 15),
    updatedAt: at(9, 3, 19, 10),
    version: 2,
  },
];
