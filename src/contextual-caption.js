const BOOK_SUBJECT_PATTERN = /(?:绘本|图画书|故事书|漫画|课本|书本|书籍|读物|图册|一本书|本书)/;
const TOY_SUBJECT_PATTERN = /(?:玩具|积木|玩偶|公仔|小汽车|机器人|拼图|毛绒)/;

function cleanSubject(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[，。！？,.!?]+$/g, "").slice(0, 10);
}

function createDayCaption(mode, day) {
  const paddedDay = String(day).padStart(2, "0");
  if (mode === "streak") {
    return {
      kind: "day",
      mode: "streak",
      firstLine: "坚持连续学习叫叫阅读",
      dayPrefix: "第",
      day: paddedDay,
      suffix: "天",
      text: `坚持连续学习叫叫阅读第 ${paddedDay} 天`,
    };
  }
  return {
    kind: "day",
    mode: "together",
    firstLine: "我和叫叫一起阅读的",
    dayPrefix: "第",
    day: paddedDay,
    suffix: "天",
    text: `我和叫叫一起阅读的第 ${paddedDay} 天`,
  };
}

export function getContextualCaption({
  gesture,
  sceneReaction,
  characterLabel = "叫叫",
  fallbackMode = "together",
  day,
} = {}) {
  if (gesture === "thumbs_up") return createDayCaption("streak", day);

  const subject = cleanSubject(sceneReaction?.subject);
  const category = String(sceneReaction?.category || "");
  if (category === "book" || BOOK_SUBJECT_PATTERN.test(subject)) return createDayCaption("together", day);
  if (!subject) return createDayCaption(fallbackMode, day);

  let action = "发现";
  if (["food", "dessert"].includes(category)) action = "打卡";
  else if (category === "toy" || TOY_SUBJECT_PATTERN.test(subject)) action = "玩";
  else if (["cat", "dog", "animal"].includes(category)) action = "遇见";

  const firstLine = `我和${characterLabel}一起`;
  const secondLine = `${action}${subject}`;
  return {
    kind: "subject",
    mode: "contextual",
    firstLine,
    secondLine,
    text: `${firstLine}${secondLine}`,
  };
}

export const contextualCaptionInternals = { BOOK_SUBJECT_PATTERN, TOY_SUBJECT_PATTERN, cleanSubject };
