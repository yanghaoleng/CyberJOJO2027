import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
const isAssetGallery = /^\/assets\/?$/.test(window.location.pathname);
const Page = lazy(() => isAssetGallery
  ? import("./assets-gallery/AssetsGallery.jsx")
  : Promise.all([import("./App.jsx"), import("./styles.css")]).then(([app]) => app));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Suspense fallback={<p style={{ padding: 24, fontFamily: "sans-serif" }}>正在准备{isAssetGallery ? "资源陈列馆" : "叫叫"}…</p>}>
      <Page />
    </Suspense>
  </StrictMode>,
);
