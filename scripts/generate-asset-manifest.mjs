import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const labels = {
  'media/jiaojiao.riv': '叫叫', 'media/lvdou.riv': '绿豆',
  'favicon.svg': '应用图标 · 矢量版', 'favicon.ico': '浏览器标签图标',
  'apple-touch-icon.png': 'iOS 主屏幕图标', 'intro/assets/intro-logo.webp': '叫叫品牌标志',
  'intro/assets/intro-hero.webp': '介绍页主视觉',
  'mediapipe/deeplab_v3.tflite': '场景分割模型', 'mediapipe/face_landmarker.task': '面部关键点模型',
  'mediapipe/gesture_recognizer.task': '手势识别模型', 'mediapipe/selfie_segmenter.tflite': '人像分割模型',
};
const audioNames = { curious: '好奇', frighten: '害怕', happy: '开心', praise: '表扬', surprised: '惊讶', think: '思考', heart: '比心', ok: 'OK 手势', encourage: '鼓励', enter: '进入相机', smile: '微笑', surprise: '惊喜' };
const iconNames = { ArrowClockwise: '重新开始', ArrowCounterClockwise: '复位', ArrowsLeftRight: '切换镜头', CaretDown: '展开', ChatCircleText: '聊天', Check: '确认', DownloadSimple: '下载', ImagesSquare: '相册', LockSimple: '锁定', MagnifyingGlass: '搜索', PaperPlaneRight: '发送', PictureInPicture: '画中画', PlayCircle: '播放', Sparkle: '灵感', X: '关闭' };
async function walk(dir) {
  const files = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full)); else if (entry.isFile()) files.push(full);
  }
  return files;
}
function imageDimensions(buffer, extension) {
  if (extension === 'png' && buffer.length >= 24) return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  if (extension === 'ico' && buffer.length >= 8) {
    const sizes = Array.from({ length: buffer.readUInt16LE(4) }, (_, index) => [buffer[6 + index * 16] || 256, buffer[7 + index * 16] || 256]);
    return sizes.sort((a, b) => b[0] * b[1] - a[0] * a[1])[0];
  }
  if (extension === 'svg') {
    const svg = buffer.toString(); const box = svg.match(/viewBox=["']([^"']+)["']/)?.[1]?.trim().split(/[ ,]+/).map(Number);
    if (box?.length === 4) return [box[2], box[3]];
    return [Number(svg.match(/width=["']([\d.]+)/)?.[1]), Number(svg.match(/height=["']([\d.]+)/)?.[1])];
  }
  if (extension === 'webp') {
    for (let offset = 12; offset + 8 < buffer.length;) {
      const chunk = buffer.toString('ascii', offset, offset + 4); const length = buffer.readUInt32LE(offset + 4); const p = offset + 8;
      if (chunk === 'VP8X') return [buffer.readUIntLE(p + 4, 3) + 1, buffer.readUIntLE(p + 7, 3) + 1];
      if (chunk === 'VP8 ') return [buffer.readUInt16LE(p + 6) & 0x3fff, buffer.readUInt16LE(p + 8) & 0x3fff];
      if (chunk === 'VP8L') { const bits = buffer.readUInt32LE(p + 1); return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]; }
      offset = p + length + (length % 2);
    }
  }
  return undefined;
}
const modelManifest = JSON.parse(await readFile(path.join(publicRoot, 'models/food/manifest.json'), 'utf8'));
const modelMap = new Map(modelManifest.models.map((model) => [model.path, model]));
const assets = [];
for (const file of await walk(publicRoot)) {
  const relative = path.relative(publicRoot, file).split(path.sep).join('/');
  if (['asset-catalog.json', 'changelog.json', 'release-history.json'].includes(relative)) continue;
  const extension = path.extname(file).slice(1).toLowerCase();
  const buffer = await readFile(file); const info = await stat(file);
  const model = modelMap.get(relative);
  let category = 'other'; let name = labels[relative] || path.basename(file);
  if (extension === 'riv') category = 'rive';
  else if (['png', 'webp', 'svg', 'ico', 'jpg', 'jpeg'].includes(extension)) {
    category = relative.includes('hero') ? 'image' : 'icon';
    if (relative.startsWith('favicon-')) name = `应用图标 · ${relative.match(/favicon-(\d+)/)?.[1]} 像素`;
  } else if (extension === 'glb') { category = 'model'; name = model?.name || name; }
  else if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension)) {
    category = 'audio'; name = `${relative.includes('/commands/') ? '语音指令' : relative.includes('/gestures/') ? '手势回应' : '相机引导'} · ${audioNames[path.basename(file, `.${extension}`)] || name}`;
  } else if (['ttf', 'woff', 'woff2', 'otf'].includes(extension)) category = 'font';
  else if (['task', 'tflite', 'onnx'].includes(extension)) category = 'vision';
  else if (extension === 'wasm' || relative.includes('/wasm/')) category = 'runtime';
  assets.push({
    id: relative, path: relative, name, category, format: extension.toUpperCase(), bytes: info.size,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    ...(imageDimensions(buffer, extension) ? { dimensions: imageDimensions(buffer, extension) } : {}),
    ...(model ? { foodId: model.id, description: model.description, triangles: model.triangles, meshes: model.meshes, materials: model.materials, dimensions: model.dimensions, license: model.license } : {}),
    ...(relative === 'media/lvdou.riv' ? { source: 'https://rive.mikeywa.site/4KM', sourceLabel: '绿豆 · 黑版原文件' } : {}),
    ...(relative === 'media/jiaojiao.riv' ? { source: 'https://rive.mikeywa.site/ZHc', sourceLabel: '叫叫 · 黑版原文件' } : {}),
  });
}
// Only imports in the actual application count as functional icons, not the full package.
const iconUsage = new Map();
for (const file of await walk(path.join(root, 'src'))) {
  if (!/\.[jt]sx?$/.test(file) || file.includes(`${path.sep}assets-gallery${path.sep}`)) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@phosphor-icons\/react['"]/g)) {
    for (const raw of match[1].split(',')) {
      const [name, alias] = raw.trim().split(/\s+as\s+/); if (!name) continue;
      const local = alias || name;
      const usages = [...source.matchAll(new RegExp(`<${local}\\b([^>]*)`, 'g'))];
      if (!usages.length) continue;
      const current = iconUsage.get(name) || { name, weights: new Set(), usedIn: new Set() };
      current.usedIn.add(path.relative(root, file).split(path.sep).join('/'));
      for (const usage of usages) current.weights.add(usage[1].match(/weight=["']([^"']+)["']/)?.[1] || 'regular');
      iconUsage.set(name, current);
    }
  }
}
const icons = [...iconUsage.values()].sort((a, b) => a.name.localeCompare(b.name)).map((icon) => ({ ...icon, weights: [...icon.weights].sort(), usedIn: [...icon.usedIn].sort() }));
for (const icon of icons) assets.push({ id: `phosphor:${icon.name}`, name: iconNames[icon.name] || icon.name, iconName: icon.name, category: 'interface', format: 'SVG', weights: icon.weights, usedIn: icon.usedIn, license: 'MIT' });
const componentFile = `// Generated by scripts/generate-asset-manifest.mjs from actual application imports.\nimport { ${icons.map((icon) => icon.name).join(', ')} } from '@phosphor-icons/react';\nexport const usedIcons = { ${icons.map((icon) => icon.name).join(', ')} };\n`;
await mkdir(path.join(root, 'src/assets-gallery'), { recursive: true });
await writeFile(path.join(root, 'src/assets-gallery/used-icons.js'), componentFile);
const catalog = { version: 1, generatedAt: new Date().toISOString(), publicFileCount: assets.filter((asset) => asset.path).length, totalBytes: assets.reduce((sum, asset) => sum + (asset.bytes || 0), 0), assets };
// Rebuilding an unchanged asset collection should not create a spurious code update.
try {
  const previous = JSON.parse(await readFile(path.join(publicRoot, 'asset-catalog.json'), 'utf8'));
  if (JSON.stringify(previous.assets) === JSON.stringify(catalog.assets)) catalog.generatedAt = previous.generatedAt;
} catch { /* A new or invalid catalog is regenerated below. */ }
await writeFile(path.join(publicRoot, 'asset-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Catalog: ${catalog.publicFileCount} public files + ${icons.length} used interface icons; ${(catalog.totalBytes / 1024 / 1024).toFixed(1)} MB`);
