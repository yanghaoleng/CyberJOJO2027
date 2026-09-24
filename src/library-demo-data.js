// 相册「模拟数据体验」演示数据
// 说明：这是产品演示用的虚构数据（孩子：小雨，6 岁），与真实本地数据完全隔离。
// 打开相册面板里的「模拟数据」开关后，展示的是下面这套内容；关闭后回到本机真实数据。
// 照片为 AI 生成的真实照片风格模拟图（public/demo-photos/），仅用于演示。

const DAY = "2026";
const dayKeyOf = (createdAt) => {
  const date = new Date(Number(createdAt));
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
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
  "2026-09-18": {
    dayKey: "2026-09-18",
    source: "dialogue",
    summary: "小雨把绘本《小熊找同桌》拿给叫叫看。叫叫先听她讲小熊在课桌上留下记号，再从「刻舟求剑」聊到：同一个节奏，也可以变成自己的生活故事。",
    moments: [
      {
        id: "demo-moment-book-bear",
        event: "我想把绘本里的小熊抠出来，它一直在找未来的同桌。",
        feeling: "兴奋",
        thought: "我也想给它编一个和课桌有关的成语。",
        evidenceQuote: "小熊不是在等兔子，它是在等同桌！",
      },
    ],
  },
  "2026-09-19": {
    dayKey: "2026-09-19",
    source: "dialogue",
    summary: "叫叫把「刻舟求剑」讲成了一个生活里的小故事。小雨自己编出「刻桌求见」，还说清楚了意思：在课桌上留下记号，想和未来的同桌见面。",
    moments: [
      {
        id: "demo-moment-new-idiom",
        event: "我编的成语叫刻桌求见！",
        feeling: "得意",
        thought: "就是在课桌上做记号，想和未来的同桌见面。",
        evidenceQuote: "刻桌求见：在课桌上留下记号，想和未来的同桌见面。",
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
  "2026-09-22": {
    dayKey: "2026-09-22",
    source: "dialogue",
    summary: "傍晚楼下飘来饭菜香，小雨一下子想妈妈了。她说妈妈做的番茄炒蛋是全世界最好吃的，说着说着声音变小了。叫叫陪她把这份想念记了下来。",
    moments: [
      {
        id: "demo-moment-miss-dinner",
        event: "闻到楼下飘来的饭菜香，突然好想妈妈做的番茄炒蛋。",
        feeling: "想妈妈了，鼻子有点酸",
        thought: "妈妈做的番茄炒蛋是全世界最好吃的，等我学会了也做给她吃。",
        evidenceQuote: "妈妈，你什么时候回来呀……",
      },
    ],
  },
  "2026-09-23": {
    dayKey: "2026-09-23",
    source: "dialogue",
    summary: "吃晚饭时小雨和叫叫聊起妈妈做的饭。她说妈妈做的番茄炒蛋和红烧肉是全世界最好吃的，比谁做的都好吃。叫叫把这句话认真记了下来，说等妈妈回来要让她做一大盘。",
    moments: [
      {
        id: "demo-moment-mom-cooking",
        event: "和叫叫聊到妈妈做的饭，我觉得谁做的都没有妈妈做的好吃。",
        feeling: "开心，还有点骄傲",
        thought: "等妈妈回来，我要让妈妈做一大盘番茄炒蛋，分给叫叫一起吃。",
        evidenceQuote: "妈妈做的饭是全世界最好吃的！",
      },
    ],
  },
};

// —— 两位伙伴的语音留言（模拟；偶尔同一天都会出现）——
export const DEMO_LEAVE_NOTES = [
  {
    dayKey: "2026-08-24",
    character: "jiaojiao",
    audioUrl: "/demo-audio/leave-note-2026-08-24.mp3",
    createdAt: 1756018800000,
    durationSec: 9,
    text: "今天积木塔倒的时候你有点委屈，我都听见了。我想了很久——被人误会不是你的错，下次你愿意的话，我们一起跟老师说清楚，我陪你。",
  },
  {
    dayKey: "2026-09-02",
    character: "jiaojiao",
    audioUrl: "/demo-audio/leave-note-2026-09-02.mp3",
    createdAt: 1756036800000,
    durationSec: 8,
    text: "你的第一颗小牙，我隔着屏幕都想看看。舍不得就再留几天，牙仙子不会介意的。等你想好了，我们再一起把它放枕头底下。",
  },
  {
    dayKey: "2026-09-10",
    character: "jiaojiao",
    audioUrl: "/demo-audio/leave-note-2026-09-10.mp3",
    createdAt: 1756123200000,
    durationSec: 10,
    text: "想妈妈的时候，你画的画我看到了，画得特别好。我在这边陪着你，画里的那朵花，等妈妈回来一定一眼就能看到。",
  },
  {
    dayKey: "2026-09-20",
    character: "jiaojiao",
    audioUrl: "/demo-audio/leave-note-2026-09-20.mp3",
    createdAt: 1756209600000,
    durationSec: 9,
    text: "粉色天空是你自己发现的，这个我特别服气。明天傍晚我们再一起看，如果它换颜色了，我们就给天空也记一笔小账。",
  },
  {
    dayKey: "2026-09-20",
    character: "lvdou",
    createdAt: at(9, 20, 19, 20),
    durationSec: 6,
    text: "I noticed the sky with you today. Sky is a lovely word to remember!",
  },
  {
    dayKey: "2026-09-12",
    character: "lvdou",
    createdAt: at(9, 12, 12, 46),
    durationSec: 8,
    text: "This is a dinosaur. Say it with me: di-no-saur. A dinosaur is a very big animal from long ago.",
  },
  {
    dayKey: "2026-09-19",
    character: "jiaojiao",
    createdAt: at(9, 19, 19, 18),
    durationSec: 10,
    text: "你把刻舟求剑变成了刻桌求见。这个名字是你自己想出来的，意思也由你来决定，我把这段对话一起收进贴纸里了。",
  },
  {
    dayKey: "2026-09-22",
    character: "jiaojiao",
    audioUrl: "/demo-audio/leave-note-2026-09-22.mp3",
    createdAt: 1756263600000,
    durationSec: 10,
    text: "想妈妈的时候不用忍住，我陪你一起想。你记下的那个番茄炒蛋的味道，我也替你收好了，等妈妈回来，我们请她做一大盘，好不好？",
  },
];

// —— 小雨的收集贴纸 + 英语单词卡 + 叫叫成语卡（模拟；贴纸为抠图图像，点开可看教学内容与对话上下文）——
export const DEMO_FRIENDS = [
  {
    id: "demo-friend-daju",
    name: "大橘",
    kind: "橘猫",
    appearance: "奶奶家的橘猫，爱吃鱼干。",
    childDescription: "它不让我摸，但会蹲在门口等我。",
    english: "cat",
    learning: "Cat. A cat says meow. Can you say cat?",
    stickerUrl: "/demo-photos/sticker-cat.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 20, 18, 15),
    updatedAt: at(9, 3, 19, 10),
    version: 2,
    dialogueContext: [
      { role: "user", character: "lvdou", text: "I found a cat at Grandma's house.", createdAt: at(8, 20, 18, 8) },
      { role: "assistant", character: "lvdou", text: "Cat. A cat says meow. Can you say cat?", createdAt: at(8, 20, 18, 9) },
      { role: "user", character: "lvdou", text: "Cat! It is waiting by the door.", createdAt: at(8, 20, 18, 10) },
    ],
  },
  {
    id: "demo-friend-maomao",
    name: "毛毛",
    kind: "玩具熊",
    appearance: "黄色的毛毛熊，最喜欢被抱着睡觉。",
    childDescription: "今天我给它做了小被子。它原来叫小熊，是我改名叫毛毛的。",
    english: "bear",
    learning: "Bear. A bear can be big and soft. Say: bear.",
    stickerUrl: "/demo-photos/sticker-bear.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(8, 28, 20, 50),
    updatedAt: at(9, 5, 19, 0),
    version: 2,
    nameSource: "context-name",
  },
  {
    id: "demo-friend-apple",
    name: "红苹果",
    kind: "水果",
    appearance: "红彤彤的圆苹果，带着一片小绿叶。",
    childDescription: "咬一口脆脆的，还会滴汁水。",
    english: "apple",
    learning: "Apple. This apple is red and crunchy. Say: apple.",
    stickerUrl: "/demo-photos/sticker-apple.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 1, 17, 0),
    updatedAt: at(9, 6, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-banana",
    name: "香蕉",
    kind: "水果",
    appearance: "黄黄的弯香蕉，熟得刚刚好。",
    childDescription: "弯弯的像月亮，也像小船。",
    english: "banana",
    learning: "Banana. It is yellow and curved like a little boat.",
    stickerUrl: "/demo-photos/sticker-banana.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 1, 17, 20),
    updatedAt: at(9, 6, 19, 10),
    version: 2,
  },
  {
    id: "demo-friend-milk",
    name: "牛奶",
    kind: "饮品",
    appearance: "画着恐龙的儿童牛奶盒，红黄配色。",
    childDescription: "盒子上有恐龙，喝完我要把盒子留下来。",
    english: "milk",
    learning: "Milk. You drink milk from a cup. Say: milk.",
    stickerUrl: "/demo-photos/sticker-milk.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 12, 12, 40),
    updatedAt: at(9, 13, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-car",
    name: "小汽车",
    kind: "玩具",
    appearance: "红色的小玩具车，圆润可爱。",
    childDescription: "红色的，跑起来特别快。",
    english: "car",
    learning: "Car. A car goes beep-beep and rolls on the road.",
    stickerUrl: "/demo-photos/sticker-car.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 13, 16, 30),
    updatedAt: at(9, 14, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-ball",
    name: "皮球",
    kind: "玩具",
    appearance: "红黄蓝三色拼接的皮球。",
    childDescription: "拍一下会跳很高，小朋友都喜欢它。",
    english: "ball",
    learning: "Ball. Tap the ball and watch it bounce. Say: ball.",
    stickerUrl: "/demo-photos/sticker-ball.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 14, 15, 10),
    updatedAt: at(9, 15, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-cookie",
    name: "曲奇",
    kind: "零食",
    appearance: "撒着巧克力豆的曲奇饼干。",
    childDescription: "上面有巧克力豆，一个接一个停不下来。",
    english: "cookie",
    learning: "Cookie. It is round, crunchy, and sweet. Say: cookie.",
    stickerUrl: "/demo-photos/sticker-cookie.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 16, 19, 30),
    updatedAt: at(9, 17, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-cup",
    name: "水杯",
    kind: "水杯",
    appearance: "印着小黄鸭的儿童吸管杯。",
    childDescription: "喝水的时候会看见上面的小鸭子。",
    english: "cup",
    learning: "Cup. We use a cup to drink water. Say: cup.",
    stickerUrl: "/demo-photos/sticker-cup.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 18, 18, 20),
    updatedAt: at(9, 19, 19, 0),
    version: 2,
  },
  {
    id: "demo-friend-dinosaur",
    name: "恐龙",
    kind: "玩具",
    appearance: "绿色的小恐龙玩具，圆滚滚的。",
    childDescription: "它比房子还大，但是我一点也不怕。",
    english: "dinosaur",
    learning: "Dinosaur. A dinosaur was a huge animal from long ago.",
    stickerUrl: "/demo-photos/sticker-dinosaur.png",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    seenAt: 1,
    createdAt: at(9, 19, 11, 40),
    updatedAt: at(9, 20, 19, 0),
    version: 2,
    dialogueContext: [
      { role: "user", character: "lvdou", text: "Domi, look at the dinosaur on my milk box.", createdAt: at(9, 12, 12, 31) },
      { role: "assistant", character: "lvdou", text: "This is a dinosaur. Say it with me: di-no-saur.", createdAt: at(9, 12, 12, 32) },
      { role: "user", character: "lvdou", text: "Dinosaur. It is very big!", createdAt: at(9, 12, 12, 34) },
      { role: "assistant", character: "lvdou", text: "Yes! A dinosaur was a huge animal from long ago.", createdAt: at(9, 12, 12, 35) },
    ],
  },
  {
    id: "demo-friend-jiaojiao-bear",
    name: "刻桌求见",
    nameSource: "user-idiom",
    kind: "绘本角色 · 小熊",
    appearance: "从《小熊找同桌》里抠出来的小熊，手里还握着一支笔。",
    childDescription: "小雨给它取名「刻桌求见」：在课桌上留下记号，想和未来的同桌见面。",
    sourceIdiom: "刻舟求剑",
    sourceMeaning: "在船上刻记号找掉下去的剑，比喻不知道情况变了还用老办法。",
    idiom: "刻桌求见",
    idiomMeaning: "在课桌上留下记号，想和未来的同桌见面。",
    stickerUrl: "/demo-photos/sticker-maomao.jpg",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    character: "jiaojiao",
    seenAt: 1,
    createdAt: at(9, 19, 19, 12),
    updatedAt: at(9, 19, 19, 18),
    version: 3,
    dialogueContext: [
      { role: "user", character: "jiaojiao", text: "我想把绘本里的小熊抠出来，它一直在找未来的同桌。", createdAt: at(9, 18, 18, 30) },
      { role: "assistant", character: "jiaojiao", text: "小熊在找同桌，我们先看看它做了什么。", createdAt: at(9, 18, 18, 31) },
      { role: "user", character: "jiaojiao", text: "它在课桌上画了一条线，想记住这里。", createdAt: at(9, 18, 18, 33) },
      { role: "assistant", character: "jiaojiao", text: "这让我想到“刻舟求剑”，你想不想改一个自己的版本？", createdAt: at(9, 18, 18, 34) },
      { role: "user", character: "jiaojiao", text: "我编的成语叫刻桌求见。", createdAt: at(9, 19, 19, 14) },
      { role: "assistant", character: "jiaojiao", text: "刻桌求见：在课桌上留下记号，想和未来的同桌见面。", createdAt: at(9, 19, 19, 15) },
    ],
  },
  {
    id: "demo-friend-jiaojiao-cat",
    name: "守页待友",
    nameSource: "user-idiom",
    kind: "绘本角色 · 小猫",
    appearance: "从绘本里跳出来的小猫，陪小雨一页一页找朋友。",
    childDescription: "小雨把「守株待兔」改成「守页待友」：守着绘本一页页读，等故事里的朋友来找我。",
    sourceIdiom: "守株待兔",
    sourceMeaning: "守着树桩等兔子，比喻不主动努力，只想等运气。",
    idiom: "守页待友",
    idiomMeaning: "守着绘本一页页读，等故事里的朋友来找我。",
    stickerUrl: "/demo-photos/sticker-daju.jpg",
    stickerBlob: null,
    originalBlob: null,
    status: "ready",
    character: "jiaojiao",
    seenAt: 1,
    createdAt: at(9, 21, 18, 28),
    updatedAt: at(9, 21, 18, 36),
    version: 3,
    dialogueContext: [
      { role: "user", character: "jiaojiao", text: "这只小猫一直守在书旁边，它是不是在等朋友？", createdAt: at(9, 21, 18, 28) },
      { role: "assistant", character: "jiaojiao", text: "它让我想到“守株待兔”，我们可以先说说这个成语的意思。", createdAt: at(9, 21, 18, 29) },
      { role: "user", character: "jiaojiao", text: "那我把它改成守页待友，守着一页一页的书等朋友。", createdAt: at(9, 21, 18, 34) },
      { role: "assistant", character: "jiaojiao", text: "守页待友，是你给这只小猫取的新说法。", createdAt: at(9, 21, 18, 35) },
    ],
  },
].map((friend) => ({ ...friend, character: friend.character || "lvdou" }));

// —— 相册时间线（按天分组，与 useDailyJournal 输出结构一致）——
// 有照片的日子按照片分组；2026-09-10 只有对话小记没有照片（体现「不拍照也能留下小记」）
// 贴纸按收集日期（createdAt）归入当天，不置顶；只有「收集」筛选视图才是宫格。
// 照片日 + 对话日 + 贴纸日合并，按日期升序（与相册浏览顺序一致）。
export const DEMO_TIMELINE = (() => {
  const days = new Map();
  const ensure = (dayKey) => {
    if (!days.has(dayKey)) days.set(dayKey, { dayKey, items: [], friends: [] });
    return days.get(dayKey);
  };
  for (const capture of DEMO_CAPTURES) {
    const day = ensure(capture.day);
    if (!day.items.includes(capture)) day.items.push(capture);
  }
  ensure("2026-09-10");
  for (const record of Object.values(DEMO_RECORDS)) if (record.summary || record.moments?.length) ensure(record.dayKey);
  for (const friend of DEMO_FRIENDS) ensure(dayKeyOf(friend.createdAt)).friends.push(friend);
  return [...days.values()]
    .map((day) => ({ ...day, items: [...day.items].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)) }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
})();
