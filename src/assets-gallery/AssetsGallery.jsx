import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Cube, DownloadSimple, File, Image, MagnifyingGlass, MusicNote, Pause, Play, Shapes, Sparkle, TextAa, X } from '@phosphor-icons/react';
import FoodModel from './FoodModel.jsx';
import { assetUrl, formatBytes, useInViewport } from './asset-utils.js';
import { usedIcons } from './used-icons.js';
import './assets-gallery.css';

const categoryGroups = [
  { id: 'all', name: '全部资源' }, { id: 'model', name: '3D 模型' }, { id: 'rive', name: 'Rive 动画' },
  { id: 'icons', name: '图标', categories: ['icon', 'interface'] }, { id: 'image', name: '图片' },
  { id: 'audio', name: '声音' }, { id: 'support', name: '字体与其他', categories: ['font', 'vision', 'runtime', 'other'] },
];
const sections = [
  { id: 'model', name: '把美味，变成立体的', description: '拖动转一转，滚轮或双指缩放。下载后也能用在其他 3D 场景。' },
  { id: 'rive', name: '会动的朋友们', description: '点击载入原文件，预览并切换文件中实际包含的动画。' },
  { id: 'icon', name: '品牌与应用图标', description: '应用图标、桌面图标与品牌标志，各个尺寸都在这里。' },
  { id: 'interface', name: '界面里的小帮手', description: '当前应用实际使用的 Phosphor 图标，可直接下载 SVG。' },
  { id: 'image', name: '画面与素材', description: '当前项目的图片原文件。' },
  { id: 'audio', name: '听见叫叫', description: '相机引导、语音指令和手势回应的声音素材。' },
  { id: 'font', name: '圆润的文字', description: '项目随附的本地字体文件。' },
  { id: 'vision', name: '看见世界的能力', description: '项目使用的识别与分割模型。' },
  { id: 'runtime', name: '让资源运行起来', description: '随项目部署的本地运行时与配套文件。' },
  { id: 'other', name: '其他项目资源', description: '资源说明、清单与页面原文件。' },
];
function DownloadLink({ asset, label, className = '' }) {
  return <a className={`ag-download ${className}`} href={`${assetUrl(asset.path)}?v=${asset.sha256.slice(0, 12)}`} download={asset.path.split('/').at(-1)} aria-label={`下载${asset.name}`}><DownloadSimple size={17} weight="bold" />{label || '下载原文件'}</a>;
}
function AssetDetails({ asset }) {
  return <div className="ag-details"><span>{asset.format}</span>{asset.dimensions && <span>{asset.category === 'model' ? asset.dimensions.map((n) => Number((n * 100).toFixed(1))).join(' × ') : asset.dimensions.join(' × ')}{asset.category === 'model' ? ' cm' : ' px'}</span>}{asset.bytes != null && <span>{formatBytes(asset.bytes)}</span>}</div>;
}
function ModelCard({ asset }) {
  return <article className="ag-card ag-model-card">
    <div className="ag-model-stage"><FoodModel foodId={asset.foodId} interactive autoRotate={false} /></div>
    <div className="ag-card-body"><h3>{asset.name}</h3><p>{asset.description}</p><AssetDetails asset={asset} />
      <div className="ag-model-spec"><span>{asset.triangles.toLocaleString('zh-CN')} 个三角面</span><span>{asset.materials} 种材质</span><span>可自由复用</span></div>
      <DownloadLink asset={asset} label="下载 GLB" />
    </div>
  </article>;
}
function RiveCard({ asset }) {
  const hostRef = useRef(null); const canvasRef = useRef(null); const instanceRef = useRef(null);
  const visible = useInViewport(hostRef);
  const [enabled, setEnabled] = useState(false); const [status, setStatus] = useState('idle');
  const [choices, setChoices] = useState([]); const [selection, setSelection] = useState(''); const [playing, setPlaying] = useState(true);
  const selectionRef = useRef(''); const playingRef = useRef(true);
  selectionRef.current = selection; playingRef.current = playing;
  useEffect(() => {
    if (!enabled || !visible) return undefined;
    let cancelled = false; let instance; let resize;
    setStatus('loading');
    async function load() {
      try {
        const { Rive, RuntimeLoader, Layout, Fit, Alignment } = await import('@rive-app/canvas');
        if (cancelled) return;
        RuntimeLoader.setWasmUrl(assetUrl('rive/canvas.wasm'));
        RuntimeLoader.setWasmFallbackUrl(assetUrl('rive/canvas_fallback.wasm'));
        instance = new Rive({
          src: `${assetUrl(asset.path)}?v=${asset.sha256.slice(0, 12)}`, canvas: canvasRef.current, autoplay: false, enableRiveAssetCDN: false,
          layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
          onLoad: () => {
            if (cancelled) return;
            const animations = instance.animationNames.map((name) => ({ value: `a:${name}`, name, kind: '动画' }));
            const machines = instance.stateMachineNames.map((name) => ({ value: `s:${name}`, name, kind: '状态机' }));
            const all = [...animations, ...machines]; setChoices(all);
            const selected = all.find((item) => item.value === selectionRef.current) || animations.find((item) => item.name === 'TalkingEmotion_Normal') || animations.find((item) => /idle|待机|日常/i.test(item.name)) || all[0];
            if (selected) { setSelection(selected.value); instance.play(selected.name); if (!playingRef.current) instance.pause(); }
            instance.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2)); setStatus('ready');
            resize = new ResizeObserver(() => instance.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio || 1, 2))); resize.observe(canvasRef.current);
          },
          onLoadError: () => { if (!cancelled) setStatus('error'); },
        }); instanceRef.current = instance;
      } catch { if (!cancelled) setStatus('error'); }
    }
    load();
    return () => { cancelled = true; resize?.disconnect(); instance?.cleanup(); instanceRef.current = null; };
  }, [asset.path, asset.sha256, enabled, visible]);
  function choose(value) {
    setSelection(value); instanceRef.current?.stop(); instanceRef.current?.play(value.slice(2));
    if (!playing) instanceRef.current?.pause();
  }
  function toggle() {
    if (playing) instanceRef.current?.pause(); else instanceRef.current?.play(selection.slice(2)); setPlaying(!playing);
  }
  return <article className="ag-card ag-rive-card" ref={hostRef}>
    <div className={`ag-rive-stage ${asset.name === '绿豆' ? 'ag-rive-stage--green' : ''}`}>
      {enabled && visible && <canvas ref={canvasRef} aria-label={`${asset.name} Rive 动画预览`} />}
      {!enabled && <button className="ag-rive-load" type="button" onClick={() => setEnabled(true)}><Play size={34} weight="fill" /><span>载入{asset.name}</span><small>{formatBytes(asset.bytes)} · Rive 原文件</small></button>}
      {enabled && status === 'loading' && <span className="ag-stage-message" role="status">正在唤醒{asset.name}…</span>}
      {enabled && status === 'error' && <div className="ag-stage-message" role="status"><span>暂时无法载入动画</span><button type="button" onClick={() => { setEnabled(false); setStatus('idle'); }}>重新加载</button></div>}
    </div>
    <div className="ag-card-body"><div className="ag-card-title"><h3>{asset.name}</h3><span className="ag-format-label">RIVE</span></div><AssetDetails asset={asset} />
      {status === 'ready' && choices.length > 0 && <div className="ag-rive-controls"><button type="button" onClick={toggle} aria-label={playing ? `暂停${asset.name}动画` : `播放${asset.name}动画`}>{playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}</button><select aria-label={`选择${asset.name}动画`} value={selection} onChange={(event) => choose(event.target.value)}>{choices.map((item) => <option value={item.value} key={item.value}>{item.name} · {item.kind}</option>)}</select><span>{choices.length} 项</span></div>}
      <div className="ag-card-footer"><DownloadLink asset={asset} />{asset.source && <a className="ag-source" href={asset.source} target="_blank" rel="noreferrer">{asset.sourceLabel}<ArrowUpRight size={13} /></a>}</div>
    </div>
  </article>;
}
function ImageCard({ asset }) {
  const [error, setError] = useState(false);
  return <article className={`ag-card ag-image-card ${asset.category === 'image' ? 'ag-image-card--wide' : ''}`}>
    <a className="ag-image-stage" href={assetUrl(asset.path)} target="_blank" rel="noreferrer" aria-label={`查看${asset.name}原图`}>{error ? <Image size={32} /> : <img src={assetUrl(asset.path)} alt={asset.name} loading="lazy" onError={() => setError(true)} />}</a>
    <div className="ag-card-body"><h3>{asset.name}</h3><AssetDetails asset={asset} /><DownloadLink asset={asset} label="下载" /></div>
  </article>;
}
function IconCard({ asset }) {
  const Icon = usedIcons[asset.iconName]; const iconRef = useRef(null); const [weight, setWeight] = useState(asset.weights[0]);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return undefined; const timer = setTimeout(() => setSaved(false), 1500); return () => clearTimeout(timer); }, [saved]);
  function download() {
    const svg = iconRef.current?.querySelector('svg')?.cloneNode(true); if (!svg) return;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', '256'); svg.setAttribute('height', '256'); svg.setAttribute('fill', '#26241f');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = `${asset.iconName}-${weight}.svg`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(true);
  }
  return <article className="ag-card ag-interface-card"><div className="ag-interface-stage" ref={iconRef}>{Icon && <Icon size={42} weight={weight} />}</div><div className="ag-card-body"><h3>{asset.name}</h3><p className="ag-icon-name">{asset.iconName}</p><div className="ag-icon-bottom">{asset.weights.length > 1 ? <select value={weight} aria-label={`${asset.name}线条样式`} onChange={(event) => setWeight(event.target.value)}>{asset.weights.map((value) => <option key={value}>{value}</option>)}</select> : <span>{weight}</span>}<button className="ag-icon-download" type="button" onClick={download} aria-label={`下载${asset.name}SVG`}>{saved ? <Check size={18} /> : <DownloadSimple size={18} />}</button></div></div></article>;
}
function AudioCard({ asset }) {
  return <article className="ag-card ag-audio-card"><div className="ag-audio-heading"><MusicNote size={23} /><div><h3>{asset.name}</h3><AssetDetails asset={asset} /></div></div><audio controls preload="none" src={assetUrl(asset.path)} aria-label={`${asset.name}试听`} onPlay={(event) => document.querySelectorAll('.ag-page audio').forEach((audio) => { if (audio !== event.currentTarget) audio.pause(); })} /><DownloadLink asset={asset} label="下载声音" /></article>;
}
function FileCard({ asset }) {
  return <article className={`ag-file-row ${asset.category === 'font' ? 'ag-file-row--font' : ''}`}><div className="ag-file-icon">{asset.category === 'font' ? <TextAa size={27} /> : <File size={25} />}</div><div className="ag-file-info"><h3>{asset.name}</h3><p>{asset.path}</p><AssetDetails asset={asset} /></div><DownloadLink asset={asset} label="下载" /></article>;
}
const cardComponents = { model: ModelCard, rive: RiveCard, icon: ImageCard, interface: IconCard, image: ImageCard, audio: AudioCard };

export default function AssetsGallery() {
  const [catalog, setCatalog] = useState(null); const [loadError, setLoadError] = useState(false); const [category, setCategory] = useState('all'); const [query, setQuery] = useState('');
  useEffect(() => {
    document.body.classList.add('ag-body'); const title = document.title; document.title = '资源陈列室 · 赛博叫叫 2027';
    return () => { document.body.classList.remove('ag-body'); document.title = title; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(assetUrl('asset-catalog.json'), { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); }).then(setCatalog).catch((error) => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => controller.abort();
  }, []);
  const assets = catalog?.assets || [];
  const counts = useMemo(() => Object.fromEntries(categoryGroups.map((group) => [group.id, assets.filter((asset) => group.id === 'all' || (group.categories || [group.id]).includes(asset.category)).length])), [assets]);
  const filtered = useMemo(() => {
    const group = categoryGroups.find((item) => item.id === category); const needle = query.trim().toLocaleLowerCase();
    return assets.filter((asset) => (group.id === 'all' || (group.categories || [group.id]).includes(asset.category)) && (!needle || [asset.name, asset.path, asset.format, asset.iconName, asset.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(needle)));
  }, [assets, category, query]);
  return <main className="ag-page">
    <header className="ag-header"><a href={import.meta.env.BASE_URL} className="ag-brand"><img src={assetUrl('favicon-32.png')} width="28" height="28" alt="" /><span>赛博叫叫 <b>2027</b></span></a><a className="ag-back" href={import.meta.env.BASE_URL}><ArrowLeft size={16} />回到相机</a></header>
    <div className="ag-main"><section className="ag-intro" aria-labelledby="ag-title"><div className="ag-intro-label"><Shapes size={18} weight="duotone" />叫叫的创作积木</div><h1 id="ag-title">资源陈列室<span className="ag-title-spark"><Sparkle size={38} weight="fill" /></span></h1><p>会动的朋友，立体的美味，还有每一个小细节。<br className="ag-mobile-break" />在这里看看、玩玩，带走原文件。</p><div className="ag-summary" aria-live="polite"><span><Cube size={17} />{counts.model || 0} 个 3D 模型</span><span>{counts.rive || 0} 个 Rive 文件</span><span>{assets.length} 项资源</span></div></section>
      <div className="ag-toolbar"><nav className="ag-categories" aria-label="资源分类">{categoryGroups.map((item) => <button type="button" key={item.id} aria-pressed={category === item.id} className={category === item.id ? 'is-selected' : ''} onClick={() => setCategory(item.id)}>{item.name}<span>{counts[item.id] || 0}</span></button>)}</nav><div className="ag-search"><MagnifyingGlass size={19} /><input aria-label="搜索资源名称或格式" placeholder="搜索名称、格式…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={15} /></button>}</div></div>
      {!catalog && !loadError && <div className="ag-empty" role="status"><Shapes size={38} /><h2>正在布置陈列室…</h2></div>}
      {loadError && <div className="ag-empty" role="alert"><File size={38} /><h2>资源清单暂时无法打开</h2><button type="button" onClick={() => window.location.reload()}>重新加载</button></div>}
      {catalog && filtered.length === 0 && <div className="ag-empty" role="status"><MagnifyingGlass size={38} /><h2>还没找到这个资源</h2><p>试试“苹果”“Rive”或“PNG”。</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); }}>查看全部资源</button></div>}
      {sections.map((section) => {
        const items = filtered.filter((asset) => asset.category === section.id); if (!items.length) return null;
        const Card = cardComponents[section.id] || FileCard;
        return <section className={`ag-section ag-section--${section.id}`} key={section.id} aria-labelledby={`ag-heading-${section.id}`}><div className="ag-section-heading"><h2 id={`ag-heading-${section.id}`}>{section.name}<span>{items.length}</span></h2><p>{section.description}</p></div><div className={`ag-grid ag-grid--${section.id}`}>{items.map((asset) => <Card key={asset.id} asset={asset} />)}</div></section>;
      })}
      <footer className="ag-footer"><span>赛博叫叫 2027 · 资源陈列室</span><a href={assetUrl('asset-catalog.json')} download>下载完整资源清单<ArrowUpRight size={14} /></a></footer>
    </div>
  </main>;
}
