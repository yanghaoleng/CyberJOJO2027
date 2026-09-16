import { useEffect, useState } from "react";
import { usePortraitUrl } from "./FriendCard.jsx";
import "./friends.css";
import "./collection-flight.css";

const PARTICLES = Array.from({ length: 18 }, (_, index) => index);

export default function CollectionFlight({ collection }) {
  const imageUrl = usePortraitUrl(collection?.stickerBlob || collection?.portraitBlob);
  const [visible, setVisible] = useState(Boolean(collection));

  useEffect(() => {
    if (!collection) return undefined;
    setVisible(true);
    if (collection.phase !== "ready") return undefined;
    const timer = window.setTimeout(() => setVisible(false), 3_700);
    return () => window.clearTimeout(timer);
  }, [collection]);

  if (!collection || !visible) return null;
  return <div className={`collection-flight is-${collection.phase || "matting"}`} aria-live="polite" aria-label={`正在收藏${collection.name || "新发现"}`}>
    <div className="collection-flight-veil" />
    <div className="collection-flight-particles" aria-hidden="true">{PARTICLES.map((index) => <i key={index} style={{ "--particle-index": index }} />)}</div>
    <div className="collection-flight-copy"><span>{collection.phase === "model" ? "图鉴正在准备精细抠图" : collection.phase === "matting" ? "把它变成一张贴纸" : "发现新朋友"}</span>{collection.explanation && <p>{collection.explanation}</p>}</div>
    <div className="collection-flight-sticker" key={`${collection.id}-${collection.phase}`}>
      {imageUrl && <img src={imageUrl} alt="" />}
      <strong>{collection.name || "新发现"}</strong>
      {collection.english && <small>{collection.english}</small>}
    </div>
    <div className="collection-flight-album" aria-hidden="true" />
  </div>;
}
