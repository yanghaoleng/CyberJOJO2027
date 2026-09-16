import { createPortal } from "react-dom";
import { usePortraitUrl } from "./FriendCard.jsx";
import "./collection-flight.css";

export default function CollectionFlight({ collection }) {
  const imageUrl = usePortraitUrl(collection?.stickerBlob || collection?.originalBlob);
  if (!collection) return null;
  const ready = collection.phase === "ready";
  const target = collection.target;
  return createPortal(<div className={`collection-feedback ${ready ? "is-ready" : "is-working"}`} role="status" aria-label={ready ? `${collection.name}已收集` : "原图先保存，贴纸正在制作"}>
    {ready ? <div className="collection-result" style={{
      "--flight-x": `${(target?.x ?? 48) - window.innerWidth / 2}px`,
      "--flight-y": `${(target?.y ?? window.innerHeight - 64) - window.innerHeight * .48}px`,
    }}>
      {imageUrl && <img src={imageUrl} alt="" />}
      <strong>{collection.name}</strong>
      {collection.english && <small>{collection.english}</small>}
    </div> : <div className="collection-progress-pill">
      {imageUrl && <img src={imageUrl} alt="" />}
      <span>{collection.phase === "capturing" ? "正在保存这一刻" : "原图已保存 · 贴纸正在制作"}<small>可以继续拍照、聊天或打开相册</small></span>
    </div>}
  </div>, document.body);
}
