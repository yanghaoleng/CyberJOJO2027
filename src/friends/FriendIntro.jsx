import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FriendCard from "./FriendCard.jsx";
import { blobToDataUrl, imageToPortrait, loadFriends, saveFriend } from "./friend-store.js";
import { parseToyDialogue } from "./toy-dialogue.js";
import "./friends.css";

export default function FriendIntro({ captureFrame, analyzeToy, transcript, onClose, onSaved, onReaction }) {
  const [stage, setStage] = useState("scanning");
  const [draft, setDraft] = useState({ name: "", kind: "", appearance: "", childDescription: "", createdAt: Date.now() });
  const [message, setMessage] = useState("让新朋友看一眼镜头，我们来认识一下。");
  const [error, setError] = useState("");
  const [friends, setFriends] = useState([]);
  const [existingId, setExistingId] = useState("");
  const [saved, setSaved] = useState(false);
  const seenTranscript = useRef(transcript?.id || transcript?.text);
  const controllerRef = useRef(null);
  const generation = useRef(0);
  const callbacks = useRef({ captureFrame, analyzeToy, onClose, onSaved, onReaction });
  callbacks.current = { captureFrame, analyzeToy, onClose, onSaved, onReaction };
  const busy = stage === "scanning" || stage === "saving";

  async function takePortrait() {
    const requestId = ++generation.current;
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setStage("scanning"); setError(""); setMessage("把新朋友放稳一点，让叫叫看看。");
    try {
      const frame = await callbacks.current.captureFrame();
      const portraitBlob = await imageToPortrait(frame);
      if (requestId !== generation.current) return;
      setDraft((current) => ({ ...current, portraitBlob }));
      let result;
      try {
        const image = typeof frame === "string" ? frame : frame.image || await blobToDataUrl(portraitBlob);
        result = await callbacks.current.analyzeToy?.(image, { signal: controller.signal });
      } catch (cause) { if (cause.name === "AbortError") return; }
      if (requestId !== generation.current || controller.signal.aborted) return;
      if (result?.evaluable) {
        setDraft((current) => ({ ...current, kind: result.kind || "", appearance: result.appearance || "" }));
        setMessage(`${result.appearance || "我看到这位新朋友啦"}。它叫什么名字？`);
        callbacks.current.onReaction?.("新朋友你好！它叫什么名字？", "curious");
      } else {
        setMessage("还没看清它是什么玩具，你可以重新拍，也可以告诉我。");
        callbacks.current.onReaction?.("还没看清楚，你来介绍一下它吧。", "curious");
      }
      setStage("details");
    } catch (cause) {
      if (requestId !== generation.current) return;
      setError(cause.message || "照片没有准备好，再试一次吧。"); setStage("details");
    }
  }

  useEffect(() => {
    void loadFriends().then(setFriends).catch(() => {});
    void takePortrait();
    return () => { generation.current += 1; controllerRef.current?.abort(); };
  }, []);

  function chooseExisting(id) {
    setExistingId(id);
    const previous = friends.find((friend) => friend.id === id);
    if (previous) {
      setDraft((current) => ({ ...current, name: previous.name, kind: previous.kind, childDescription: previous.childDescription }));
      setMessage(`原来是${previous.name}！确认后会更新它的名片照片。`);
    }
  }
  function preview() {
    if (!draft.portraitBlob) { setError("先拍下新朋友的照片吧。"); return; }
    if (!draft.name.trim()) { setError("还不知道新朋友的名字呢。"); return; }
    setError(""); setStage("review");
    callbacks.current.onReaction?.(`它叫${draft.name}，对吗？确认后我会把名片收藏起来。`, "happy");
  }
  async function collect() {
    if (stage !== "review" || saved) return;
    setStage("saving"); setError("");
    try {
      const previous = friends.find((friend) => friend.id === existingId);
      const record = await saveFriend({ ...draft, ...(previous ? { id: previous.id } : {}) }, previous ? { expectedVersion: previous.version } : {});
      setSaved(true); setStage("done"); setDraft(record);
      callbacks.current.onSaved?.(record);
      callbacks.current.onReaction?.(`${record.name}的名片收好啦，下次可以去相册看它。`, "happy");
    } catch (cause) { setError(cause.message || "名片没有保存成功，请再试一次。"); setStage("review"); }
  }

  useEffect(() => {
    if (!transcript?.text || transcript.final === false || busy || saved) return;
    const key = transcript.id || transcript.text;
    if (key === seenTranscript.current) return;
    seenTranscript.current = key;
    const command = parseToyDialogue(transcript.text, stage);
    if (!command) return;
    if (command.type === "cancel") { callbacks.current.onClose?.(); return; }
    if (command.type === "confirm") { void collect(); return; }
    if (command.type === "existing") {
      const found = friends.find((friend) => friend.name === command.name);
      if (found) chooseExisting(found.id);
      else setMessage("还没有找到这个名字的名片，可以先作为新朋友收藏。");
      return;
    }
    setError("");
    if (command.type === "name") {
      setDraft((current) => ({ ...current, name: command.name })); setStage("review");
      setMessage(`它叫「${command.name}」，听对了吗？可以直接改，也可以说“确认收藏”。`);
      callbacks.current.onReaction?.(`它叫${command.name}，对吗？`, "curious");
    }
    if (command.type === "kind") { setDraft((current) => ({ ...current, kind: command.kind, appearance: "" })); setMessage(`记住啦，它是${command.kind}。`); }
    if (command.type === "description") { setDraft((current) => ({ ...current, childDescription: command.text })); setMessage("这个小故事也记在名片上啦。确认后才会收藏。"); }
  }, [transcript, stage, busy, saved, friends]);

  return createPortal(<div className="friend-intro-backdrop" role="dialog" aria-modal="true" aria-label="介绍新朋友" onKeyDown={(event) => { if (event.key === "Escape") onClose?.(); }}>
    <div className={`friend-intro-sheet is-${stage}`}>
      <header className="friend-sheet-header"><div><span className="friend-eyebrow">一起认识世界</span><h2>{stage === "done" ? "新朋友，收好啦" : "给叫叫介绍新朋友"}</h2></div><button className="friend-icon-button" onClick={onClose} type="button" aria-label="关闭新朋友介绍">×</button></header>
      <div className="friend-progress" aria-label={stage === "scanning" ? "拍下朋友" : stage === "details" ? "介绍朋友" : "确认名片"}><span className="is-active">01 看见</span><i /><span className={stage !== "scanning" ? "is-active" : ""}>02 认识</span><i /><span className={["review", "saving", "done"].includes(stage) ? "is-active" : ""}>03 收藏</span></div>
      <div className="friend-intro-content">
        <div className="friend-intro-preview"><FriendCard friend={draft} />{!saved && <button className="friend-text-button" type="button" disabled={busy} onClick={() => void takePortrait()}>重新拍一张</button>}</div>
        <div className="friend-intro-form"><p className="friend-prompt" role="status">{stage === "done" ? "这张名片只保存在本机。去相册的“朋友”里，还可以继续修改和收藏。" : message}</p>
          {!saved && stage === "details" && <>
            {friends.length > 0 && <label className="friend-field">是已经认识的朋友吗？<select value={existingId} onChange={(event) => chooseExisting(event.target.value)}><option value="">这是新朋友</option>{friends.map((friend) => <option value={friend.id} key={friend.id}>{friend.name} · 已有名片</option>)}</select></label>}
            <label className="friend-field">它叫什么名字<input autoComplete="off" maxLength={24} value={draft.name} placeholder="说出名字，也可以在这里输入" onChange={(event) => { setDraft({ ...draft, name: event.target.value }); if (stage === "review") setStage("details"); }} /></label>
            <label className="friend-field">它是什么玩具<input maxLength={32} value={draft.kind} placeholder="例如：小熊玩偶，不确定可以留空" onChange={(event) => setDraft({ ...draft, kind: event.target.value, appearance: "" })} /></label>
            <label className="friend-field">告诉叫叫一个关于它的小故事<span>想说就说，可以留空</span><textarea rows={2} maxLength={240} value={draft.childDescription} placeholder="例如：它每天陪我一起睡觉" onChange={(event) => setDraft({ ...draft, childDescription: event.target.value })} /></label>
          </>}
          {error && <p className="friend-error" role="alert">{error}</p>}
          <div className="friend-form-actions">{stage === "done" ? <button className="friend-primary" onClick={onClose} type="button">回去继续玩</button> : stage === "review" ? <><button className="friend-primary" onClick={() => void collect()} type="button">{existingId ? "确认更新名片" : "确认收藏"}</button><button className="friend-secondary" onClick={() => setStage("details")} type="button">再改一下</button></> : <button className="friend-primary" disabled={busy || !draft.portraitBlob || !draft.name.trim()} onClick={preview} type="button">{stage === "scanning" ? "正在看新朋友…" : stage === "saving" ? "正在收好…" : "看看它的名片"}</button>}</div>
          {!saved && <small className="friend-local-note">确认前不会保存 · 可以随时取消</small>}
        </div>
      </div>
    </div>
  </div>, document.body);
}
