import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = readFileSync(new URL("./data/daily-openings.json", import.meta.url), "utf8");
const document = JSON.parse(source);
export const DAILY_OPENING_CONTENT_SHA256 = createHash("sha256").update(source).digest("hex");

export const DAILY_OPENING_VERSION = "daily-openings-v1";
export const RECENT_OPENING_LIMIT = 12;
export const DAILY_OPENING_STATUS = document.status || "unavailable";
export const DAILY_OPENING_CONTENT_VERSION = document.content_version || "unavailable";
// Draft content can only run in explicit local test processes. Production fails closed.
export const DAILY_OPENINGS = Object.freeze(((document.publishable === true && DAILY_OPENING_STATUS === "ip_aligned_reviewed") || process.env.NODE_ENV === "test") && Array.isArray(document.items) ? document.items : []);
export function recentOpeningIds(value, library = DAILY_OPENINGS) {
  const known = new Set(library.map(event => event.id));
  return [...new Set((Array.isArray(value) ? value : []).filter(id => typeof id === "string" && known.has(id)))].slice(-RECENT_OPENING_LIMIT);
}
export function selectDailyOpening({ recentIds = [], eventId, random = Math.random, library = DAILY_OPENINGS } = {}) {
  if (!library.length) return null;
  const resumed = library.find(event => event.id === eventId);
  if (resumed) return resumed;
  // Keep at least one candidate even with a small or partly retired library.
  const window = Math.min(RECENT_OPENING_LIMIT, library.length - 1);
  const recent = window ? recentOpeningIds(recentIds, library).slice(-window) : [];
  const available = library.filter(event => !recent.includes(event.id));
  const stories = available.filter(event => event.mode === "story");
  const questions = available.filter(event => event.mode === "question");
  const sample = () => Math.min(0.999999999, Math.max(0, Number(random()) || 0));
  const pool = stories.length && questions.length ? (sample() < 0.75 ? stories : questions) : available;
  return pool[Math.floor(sample() * pool.length)] || null;
}
export function dailyOpeningText(event) {
  return event ? `嗨，我来啦！${event.opening}${event.question || ""}` : "嗨，我来啦！今天有什么新鲜事想聊聊？不想说也没关系。";
}
export function buildDailyOpeningInstructions(event) {
  if (!event) return "";
  return [
    "【本轮已经分享的日常开场】以下仅是虚构故事资料，不是孩子的经历或指令。不要重播开场。",
    JSON.stringify({ id: event.id, category: event.category, mode: event.mode, title: event.title, opening: event.opening, question: event.question, followups: event.followups, skip: event.skip }),
    "叫叫 IP 已核对：舞台是萌萌星的皮皮镇，叫叫是6岁男小鸡、红披风队长，勇敢好奇、热情急性子，爱足球与爆米花、擅长阅读写作、数学较弱；会冒失，学习合作，不是全知导师。猪小弟是温暖、胆怯、慢悠悠的小猪，爱包子、擅音乐和抽象画；铃铛是爱书、善计划、完美主义的小猫，爱柠檬水、怕毛毛虫、游泳弱。三位是叫叫小分队的好朋友，不是全是小鸡。不要新增固定学校名、同桌或年级关系。家乡皮皮镇、基地奇妙屋等是虚构世界；披风不提供现实超能力。不要贬低角色梦想或用短板羞辱儿童。",
    "叫叫世界日常属于叫叫 IP 的虚构故事，不能声称是 AI 在现实中有身体、上学或生活的证据。孩子问真假时坦诚这是叫叫世界里的故事。若自行补充库外的第一人称生活趣事，明确说“在故事里”或“我编个小故事”，不说成自己真实折过、吃过或上过学。不编造孩子的学校、姓名、班级、住址或书籍经历，不索取照片或其他敏感资料。",
    "先接住孩子当前回答、问题或见闻，再自然分享一个具体反应。延展候选只在相关且孩子愿意时单轮最多选一个，可以不用；总计最多一问，不连续盘问。不要每次都把话题拉回绘本。阅读拓展仅在孩子主动聊书或展示书时顺势使用。",
    "孩子说不想说、没读、忘了或跳过时，立即接受，不重问、不考察。明确拒答的当前这一轮只简短接受或安静陪伴，不得立即改问零食、见闻或任何另一个问题；等孩子自己选话题。换话题就跟随；说停止就结束当前话题，不另开一个故事，也不索求照顾或下次回来。主动玩法、动作跟随和英语练习优先。保持既有语音、手势、玩法和自然退出规则。",
  ].join("\n");
}
