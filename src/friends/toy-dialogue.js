export function parseToyDialogue(value, stage = "details") {
  const text = String(value || "").replace(/[。！？!?]+$/g, "").trim();
  if (!text) return null;
  if (/^(?:取消|算了|不玩了|不介绍了|先不保存|不要保存|退出|不想玩了)$/.test(text)) return { type: "cancel" };
  if (/^(?:确认|确认收藏|收藏|保存|保存吧|对|对的|是的|没错|就是它|对就是它|好|好的)$/.test(text)) return stage === "review" ? { type: "confirm" } : null;
  const existing = text.match(/(?:这是|就是)(?:之前的|以前的|原来的)([^，,。！？!?]{1,24})/);
  if (existing) return { type: "existing", name: existing[1].trim() };
  const name = text.match(/(?:名字改成|名字改为|改名为|改成|改叫|名字是|名字叫|叫做|它叫|他叫|她叫|应该叫|是叫|不叫.+?叫)([^，,。！？!?]{1,24})/);
  if (name) return { type: "name", name: name[1].trim().replace(/(?:吧|呢)$/, "") };
  const kind = text.match(/不是[^，,。]+[，,]?是(?:一个|一只|一辆|一架)?([^，,。！？!?]{1,32})/);
  if (kind) return { type: "kind", kind: kind[1].trim() };
  if (/^(?:它|他|她)(?:每天|总是|一直)?(?:喜欢|最爱|会|是我的|陪我)/.test(text)) return { type: "description", text: text.slice(0, 240) };
  if (stage === "details" && text.length <= 16 && !/[，,。？?！!]/.test(text) && !/(?:介绍|朋友|你好|不知道|还没想|什么)/.test(text)) return { type: "name", name: text };
  return null;
}
