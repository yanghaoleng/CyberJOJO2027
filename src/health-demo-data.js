// Fictional connector snapshot. Never mixed with local health or journal records.
export const DEMO_HEALTH = Object.freeze({
  id: "demo-health-morning-activity",
  dayKey: "2026-10-19",
  time: "08:42",
  child: "小雨",
  age: "6 岁",
  source: "智能手环 · 模拟连接",
  metrics: [
    { label: "心率", value: "148", unit: "次/分", source: "运动中 · 手环采样" },
    { label: "连续活动", value: "18", unit: "分钟", source: "跑跳 · 活动较剧烈" },
    { label: "身高", value: "118", unit: "cm", source: "家长填写 · 模拟资料" },
    { label: "体重", value: "21", unit: "kg", source: "家长填写 · 模拟资料" },
  ],
  mealStatus: "早餐记录尚未确认",
  insight: "正在剧烈活动，先确认有没有吃早餐",
  explanation: "手环记录到持续跑跳，但今天还没有早餐记录。缺少记录不等于没有吃过，先向孩子或家长确认。",
  advice: "先放慢活动，休息一下、喝几口水；如果还没吃早餐，请家长陪同补充适合孩子的早餐，再安排后续运动。",
  voice: "小雨，先慢下来，喝几口水吧！今天吃过早饭了吗？如果还没吃，和家长一起补充早餐，再接着玩。",
  audioUrl: "/demo-audio/health-morning-reminder.mp3",
  pushTitle: "小雨的活动与早餐提醒",
  pushBody: "手环记录到持续跑跳 18 分钟，早餐记录尚未确认。请先确认是否吃过早餐，提醒休息、补水；如未进食，由家长安排补充早餐。",
});
