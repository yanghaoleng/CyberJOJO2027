export function parseCollectionDialogue(value, { expectCreativeIdiom = false } = {}) {
  const text = String(value || "").replace(/[。！？!?]+$/g, "").trim();
  if (!text) return null;
  const match = text.match(/(?:它叫|这个叫|给它叫|名字叫|名字是|就叫|给它取名(?:叫|是)?|我想叫它|我给它取名(?:叫|是)?)([^，,。！？!?]{1,24})/);
  if (match) return { type: "name", name: match[1].trim().replace(/(?:吧|呀|呢)$/, "") };
  const idiom = text.match(/(?:我(?:刚刚)?编(?:了|的)?(?:一个)?(?:新的?)?(?:成语|词)|这个(?:新)?(?:成语|词)|新成语|成语)[^\u3400-\u9fff]{0,6}(?:(?:叫|是|叫做|叫作)[^\u3400-\u9fff]{0,3})?([\u3400-\u9fff]{4,8})/);
  if (idiom) return { type: "idiom", idiom: idiom[1] };
  if (expectCreativeIdiom && /^[\u3400-\u9fff]{4}$/.test(text) && !/^(?:我不知道|我想你了|再说一次|什么意思)$/.test(text)) {
    return { type: "idiom", idiom: text };
  }
  const meaning = text.match(/(?:意思是|意思就是|它的意思是)([^，,。！？!?]{3,80})/);
  if (meaning) return { type: "idiomMeaning", idiomMeaning: meaning[1].trim() };
  return null;
}

export function parseRealIdiomSuggestion(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (/我编的|我造的|新编|新成语|改成/.test(text)) return null;
  const match = text.match(/(?:这个)?成语[“「]?([\u3400-\u9fff]{4})[”」]?[^。！？]{0,12}?(?:意思是|原意是)([^。！？]{3,70})/);
  return match ? { sourceIdiom: match[1], sourceMeaning: match[2].replace(/[，,]$/, "").trim() } : null;
}
