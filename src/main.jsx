import { Component, lazy, StrictMode, Suspense, useEffect, useState } from "react";
import "./safe-area.css";
import { createRoot } from "react-dom/client";
const isAssetGallery = /^\/assets\/?$/.test(window.location.pathname);
const isChangelog = /^\/changelog\/?$/.test(window.location.pathname);
if (isAssetGallery || isChangelog) document.getElementById("startup-cover")?.remove();
const Page = lazy(() => isAssetGallery
  ? import("./assets-gallery/AssetsGallery.jsx")
  : isChangelog ? import("./changelog/Changelog.jsx")
    : Promise.all([import("./App.jsx"), import("./styles.css")]).then(([app]) => app));

class StartupBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    document.getElementById("startup-cover")?.remove();
  }
  render() {
    return this.state.failed ? <div role="alert" className="page-loading">加载没有完成，请检查网络。<button onClick={() => location.reload()}>重新加载</button></div> : this.props.children;
  }
}
function Boot() {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    let second;
    let task;
    // The HTML cover gets a paint before importing Rive / vision / camera code.
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => { task = setTimeout(() => setPainted(true), 16); }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); clearTimeout(task); };
  }, []);
  if (!painted) return null;
  return <Suspense fallback={isAssetGallery || isChangelog ? <p className="page-loading">正在准备{isAssetGallery ? "资源陈列馆" : "更新日志"}…</p> : null}><Page /></Suspense>;
}
createRoot(document.getElementById("root")).render(<StrictMode><StartupBoundary><Boot /></StartupBoundary></StrictMode>);
