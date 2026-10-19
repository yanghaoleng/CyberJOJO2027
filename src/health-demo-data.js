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
  insight: "运动中出现不适，请家长立即关注",
  symptoms: "孩子主动说：有点头晕、没力气",
  explanation: "持续跑跳时孩子自述头晕、乏力，早餐记录仍待确认。缺少记录不等于没有吃过；仅凭这些信息不能确诊低血糖，需要成年人立即确认身体状况。",
  advice: "先停止运动，在安全处休息，请身边成年人立即陪同评估。不适持续或加重时及时就医；意识、呼吸异常时立即呼叫急救。",
  voice: "小雨，先停下来，到安全的地方坐一会儿。别继续跑了，马上请身边的大人过来陪你。",
  audioUrl: "/demo-audio/health-emergency-reminder.mp3",
  pushStatus: "已向家长发送紧急通知",
});
