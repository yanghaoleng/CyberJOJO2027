export function parseCollectionDialogue(value) {
  const text = String(value || "").replace(/[。！？!?]+$/g, "").trim();
  if (!text) return null;
  const match = text.match(/(?:它叫|这个叫|给它叫|名字叫|名字是|就叫)([^，,。！？!?]{1,24})/);
  if (match) return { type: "name", name: match[1].trim().replace(/(?:吧|呀|呢)$/, "") };
  return null;
}
