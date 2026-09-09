import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, Pause, Play } from '@phosphor-icons/react';
import { assetUrl, useInViewport } from './asset-utils.js';
import './food-model.css';

const foodNames = { apple: '红苹果', cake: '草莓奶油蛋糕', noodles: '暖暖面条', drink: '果汁饮料', candy: '彩色糖果' };
function disposeObject(object) {
  const geometries = new Set(); const materials = new Set(); const textures = new Set();
  object?.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) {
      materials.add(material);
      Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
    }
  });
  geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose()); textures.forEach((item) => item.dispose());
}

/** Genuine GLB viewer. Noninteractive mode never consumes pointer events from feeding cards. */
export default function FoodModel({ foodId = 'apple', className = '', interactive = false, autoRotate = true, transparent = false }) {
  const containerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const actionsRef = useRef(null);
  const visible = useInViewport(containerRef);
  const [status, setStatus] = useState('loading');
  const [rotating, setRotating] = useState(autoRotate);
  const [retry, setRetry] = useState(0);
  const rotatingRef = useRef(rotating);
  rotatingRef.current = interactive ? rotating : autoRotate;

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false; let renderer; let controls; let scene; let environment; let frame = 0; let resize;
    const request = new AbortController();
    setStatus('loading');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    async function initialize() {
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
          import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/controls/OrbitControls.js'), import('three/addons/environments/RoomEnvironment.js'),
        ]);
        if (cancelled) return;
        const response = await fetch(assetUrl(`models/food/${foodId}.glb`), { signal: request.signal });
        if (!response.ok) throw new Error('Model unavailable');
        const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
        if (cancelled) { disposeObject(gltf.scene); return; }
        scene = new THREE.Scene();
        const object = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(object); const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3());
        const scale = 1.8 / Math.max(size.x, size.y, size.z);
        object.position.copy(center).multiplyScalar(-scale); object.scale.setScalar(scale);
        const pivot = new THREE.Group(); pivot.add(object); scene.add(pivot);
        const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
        camera.position.set(2.9, foodId === 'noodles' ? 2.65 : 1.8, 3.45);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setClearColor('#f5f4ef', transparent ? 0 : 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
        renderer.shadowMap.enabled = !transparent; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const pmrem = new THREE.PMREMGenerator(renderer); const room = new RoomEnvironment();
        environment = pmrem.fromScene(room, 0.04); scene.environment = environment.texture; scene.environmentIntensity = 0.72;
        room.dispose(); pmrem.dispose();
        scene.add(new THREE.HemisphereLight('#ffffff', '#b9a697', 0.85));
        const sun = new THREE.DirectionalLight('#fff8ea', 2.0); sun.position.set(-3, 5, 4); sun.castShadow = !transparent; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.025; sun.shadow.camera.left = -3; sun.shadow.camera.right = 3; sun.shadow.camera.top = 3; sun.shadow.camera.bottom = -3; scene.add(sun);
        const fill = new THREE.DirectionalLight('#e5efff', 0.9); fill.position.set(4, 2, -2); scene.add(fill);
        object.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        if (!transparent) {
          const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#f5f4ef', roughness: 1 }));
          ground.rotation.x = -Math.PI / 2; ground.position.y = -size.y * scale / 2 - 0.015; ground.receiveShadow = true; scene.add(ground);
        }
        const canvas = renderer.domElement; canvas.setAttribute('aria-label', `${foodNames[foodId] || '食物'}3D 模型${interactive ? '，拖动旋转，滚轮缩放，方向键旋转，加减键缩放' : ''}`); canvas.setAttribute('role', 'img');
        canvasHostRef.current?.appendChild(canvas);
        controls = new OrbitControls(camera, canvas); controls.target.set(0, 0.02, 0); controls.enableDamping = true; controls.enablePan = false;
        controls.enabled = interactive; controls.enableZoom = interactive; controls.minDistance = 2.5; controls.maxDistance = 8;
        controls.maxPolarAngle = Math.PI * 0.64; controls.autoRotateSpeed = 1.1; controls.update(); controls.saveState();
        if (interactive) {
          canvas.tabIndex = 0;
          canvas.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); pivot.rotation.y += event.key === 'ArrowLeft' ? -0.18 : 0.18; }
            if (event.key === '+' || event.key === '=') { event.preventDefault(); camera.position.multiplyScalar(0.92); }
            if (event.key === '-') { event.preventDefault(); camera.position.multiplyScalar(1.08); }
          });
        }
        actionsRef.current = { reset: () => { pivot.rotation.set(0, 0, 0); controls.reset(); } };
        const measure = () => {
          if (!canvasHostRef.current) return;
          const { width, height } = canvasHostRef.current.getBoundingClientRect();
          if (!width || !height) return;
          camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
        };
        resize = new ResizeObserver(measure); resize.observe(canvasHostRef.current); measure();
        let last = 0;
        function animate(time) {
          if (cancelled) return;
          frame = requestAnimationFrame(animate);
          if (time - last < 32 || document.hidden) return;
          const delta = Math.min((time - last) / 1000, 0.1); last = time;
          if (!interactive && rotatingRef.current && !reducedMotion) pivot.rotation.y += delta * 0.22;
          controls.autoRotate = interactive && rotatingRef.current && !reducedMotion; controls.update(delta); renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(animate); setStatus('ready');
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') setStatus('error');
      }
    }
    initialize();
    return () => {
      cancelled = true; request.abort(); cancelAnimationFrame(frame); resize?.disconnect(); controls?.dispose(); actionsRef.current = null;
      disposeObject(scene); environment?.dispose(); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove();
    };
  }, [foodId, interactive, transparent, visible, retry]);

  return <div ref={containerRef} className={`food-model ${transparent ? 'food-model--transparent' : ''} ${interactive ? 'food-model--interactive' : ''} ${className}`} data-food-id={foodId} data-model-status={visible ? status : 'offscreen'}>
    <div ref={canvasHostRef} className="food-model__canvas" />
    {visible && status === 'loading' && <span className="food-model__status" role="status">正在端上来…</span>}
    {visible && status === 'error' && <div className="food-model__status" role="status">模型暂时无法显示{interactive && <button type="button" onClick={() => setRetry((n) => n + 1)}>重新加载</button>}</div>}
    {interactive && status === 'ready' && <div className="food-model__tools">
      <button type="button" title="复位视角" aria-label="复位视角" onClick={() => actionsRef.current?.reset()}><ArrowCounterClockwise size={18} /></button>
      <button type="button" title={rotating ? '暂停旋转' : '自动旋转'} aria-label={rotating ? '暂停旋转' : '自动旋转'} aria-pressed={rotating} onClick={() => setRotating((value) => !value)}>{rotating ? <Pause size={18} /> : <Play size={18} />}</button>
    </div>}
  </div>;
}
