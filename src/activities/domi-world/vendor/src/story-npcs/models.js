/**
 * Three source-reviewed NPCs, modelled as independent solids for this project.
 * Visual revision: supplied three-dimensional turnarounds, 2026-09-06.
 * Original source pictures / private document URLs are intentionally not assets.
 * No legacy species substitution, bitmap billboard, skeleton or external model.
 */
import * as THREE from 'three';

const IDS = new Set(['jiaojiao', 'lingdang', 'zhuxiaodi']);
const ACTIONS = new Set(['idle', 'talk', 'wave', 'hop', 'listen', 'walk', 'run', 'sprint', 'jump', 'float', 'sleep', 'roll', 'dance', 'cheer', 'fall']);
const EXPRESSIONS = new Set(['happy', 'curious', 'sad', 'surprised']);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;

function shapedSphere(pear = 0, cheek = 0) {
  const primitive = new THREE.SphereGeometry(1, 28, 20);
  const geometry = new THREE.BufferGeometry().copy(primitive);
  primitive.dispose();
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const taper = 1 - pear * y;
    position.setXYZ(i, x * taper * (1 + cheek * (1 - y * y)), y, z * taper);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// A genuinely thick curved sheet, including side walls. All edited vertices
// live in BufferGeometry so ObjectLoader preserves the actual model exactly.
function thickSheet(fn, columns = 28, rows = 8, thickness = .016) {
  const positions = [], uvs = [], indices = [], layerSize = (columns + 1) * (rows + 1);
  const sample = (u, v) => new THREE.Vector3(...fn(clamp(u, 0, 1), clamp(v, 0, 1)));
  for (const side of [-1, 1]) {
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
      const u = x / columns, v = y / rows, p = sample(u, v);
      const tangent = sample(u + .001, v).sub(sample(u - .001, v));
      const bitangent = sample(u, v + .001).sub(sample(u, v - .001));
      p.addScaledVector(tangent.cross(bitangent).normalize(), thickness * side / 2);
      positions.push(...p.toArray()); uvs.push(u, v);
    }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * (columns + 1) + x, b = a + columns + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
    indices.push(a + layerSize, b + layerSize, a + 1 + layerSize, b + layerSize, b + 1 + layerSize, a + 1 + layerSize);
  }
  const boundary = [];
  for (let x = 0; x <= columns; x++) boundary.push(x);
  for (let y = 1; y <= rows; y++) boundary.push(y * (columns + 1) + columns);
  for (let x = columns - 1; x >= 0; x--) boundary.push(rows * (columns + 1) + x);
  for (let y = rows - 1; y > 0; y--) boundary.push(y * (columns + 1));
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length];
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Shared construction toolkit; family NPCs can share craftsmanship, not IDs. */
export function createNPCToolkit(characterId, skinColor, { scale = 1, species = characterId } = {}) {
  const geometrySet = new Set(), materialSet = new Set(), skinMaterials = new Set();
  const group = new THREE.Group(), fit = new THREE.Group(), rig = new THREE.Group();
  group.name = `document-npc-${characterId}`; group.add(fit); fit.add(rig);
  group.userData = { characterId, role: 'npc', species, source: 'source-reviewed-npc-model', modelVersion: 1, usesSkeleton: false };
  const own = geometry => { geometrySet.add(geometry); return geometry; };
  const mat = (color, surface = 'paper', extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: surface === 'ink' ? .3 : .8, metalness: 0, ...extra });
    value.userData.handcraftedSurface = surface; materialSet.add(value); return value;
  };
  const skin = mat(skinColor); skinMaterials.add(skin);
  const white = mat('#fff5e9'), eyeWhite = mat('#fff9ef', 'ink', { roughness: .24 });
  const ink = mat('#3d211c', 'ink'), iris = mat('#88502b', 'ink', { roughness: .23 });
  const pupil = mat('#171414', 'ink', { roughness: .15 });
  const glint = mat('#fffefa', 'ink', { emissive: '#fff8e8', emissiveIntensity: .15, roughness: .2 });
  const mouthMat = mat('#421516', 'ink'), tongue = mat('#e9858a', 'ink');
  const sphere = own(new THREE.SphereGeometry(1, 24, 16));
  const detailSphere = own(new THREE.SphereGeometry(1, 16, 10));
  const lidGeometry = own(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2));
  const eyes = [], arms = [], legs = [], brows = [];
  const pivot = (parent, name, position = [0, 0, 0]) => {
    const value = new THREE.Group(); value.name = name; value.position.set(...position); parent.add(value); return value;
  };
  const mesh = (parent, name, geometry, material, position = [0, 0, 0], size = [1, 1, 1]) => {
    own(geometry); const value = new THREE.Mesh(geometry, material); value.name = name;
    value.position.set(...position); value.scale.set(...size); value.castShadow = value.receiveShadow = true; parent.add(value); return value;
  };
  const ball = (parent, name, material, position, size, detail = false) => mesh(parent, name, detail ? detailSphere : sphere, material, position, size);
  const line = (parent, name, material, points, radius = .012, segments = 18) => mesh(parent, name,
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false), material);
  const sheet = (parent, name, material, fn, columns, rows, thickness) => mesh(parent, name, thickSheet(fn, columns, rows, thickness), material);
  const patch = (parent, name, material, points, depth = .07, bevel = .035) => {
    const shape = new THREE.Shape(); shape.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) shape.lineTo(...points[i]); shape.closePath();
    return mesh(parent, name, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 8 }), material);
  };
  const eye = (parent, side, position, width = .14, height = .16, lidMaterial = skin, lashes = false) => {
    const root = pivot(parent, side < 0 ? 'left-expressive-eye' : 'right-expressive-eye', position);
    ball(root, 'soft-eye-outline', ink, [0, 0, -.004], [width * 1.04, height * 1.04, .048]);
    ball(root, 'clean-eye-white', eyeWhite, [0, 0, .005], [width, height, .052]);
    const gaze = pivot(root, 'movable-iris');
    ball(gaze, 'brown-iris-rim', ink, [side * -.006, -.008, .048], [width * .69, height * .73, .023]);
    ball(gaze, 'warm-brown-iris', iris, [side * -.006, -.008, .059], [width * .63, height * .67, .018]);
    ball(gaze, 'deep-eye-pupil', pupil, [side * -.006, -.002, .072], [width * .405, height * .47, .013]);
    ball(gaze, 'large-eye-catchlight', glint, [-width * .25, height * .34, .082], [width * .20, height * .18, .009], true);
    ball(gaze, 'small-eye-catchlight', glint, [width * .25, -height * .23, .080], [width * .07, height * .065, .005], true);
    const upper = mesh(root, 'independent-upper-eyelid', lidGeometry, lidMaterial, [0, height, .043], [width * 1.065, .001, .061]);
    const lower = mesh(root, 'independent-lower-eyelid', lidGeometry, lidMaterial, [0, -height, .043], [width * 1.065, .001, .061]); lower.rotation.z = Math.PI;
    upper.visible = lower.visible = false;
    if (lashes) line(root, 'outer-eyelash', ink, [[side * width * .80, height * .50, .02], [side * width * 1.10, height * .48, .03], [side * width * 1.25, height * .70, .04]], .010, 10);
    eyes.push({ root, gaze, upper, lower, width, height, side }); return root;
  };
  const brow = (parent, side, position, width = .12) => {
    const root = pivot(parent, `expressive-brow-${side}`, position);
    line(root, 'rounded-eyebrow', mat('#79503b', 'ink'), [[-width / 2, 0, 0], [0, .024, .005], [width / 2, 0, 0]], .012, 12);
    brows.push({ root, side }); return root;
  };
  const mouth = (parent, position, width = .105, height = .085, { fangs = false, tooth = false } = {}) => {
    const root = pivot(parent, 'articulated-mouth', position), opening = pivot(root, 'mouth-opening');
    ball(opening, 'mouth-cavity', mouthMat, [0, -.014, 0], [width, height, .022]);
    ball(opening, 'little-tongue', tongue, [0, -height * .55, .017], [width * .68, height * .34, .009], true);
    if (tooth) ball(opening, 'upper-front-tooth', eyeWhite, [0, height * .57, .018], [width * .73, height * .12, .008], true);
    if (fangs) for (const side of [-1, 1]) {
      const fang = mesh(opening, 'tiny-cat-canine', new THREE.ConeGeometry(.018, .042, 12), eyeWhite, [side * width * .63, height * .44, .021]); fang.rotation.z = Math.PI;
    }
    const smile = line(root, 'closed-soft-smile', ink, [[-width * .87, 0, .005], [0, -height * .20, .013], [width * .87, 0, .005]], .008, 18);
    opening.scale.y = .03; opening.visible = false;
    const value = { root, opening, smile, width, height }; b.mouth = value; return value;
  };
  const bow = (parent, position, color, size = 1) => {
    const material = mat(color, 'fabric'), root = pivot(parent, 'three-dimensional-bow-tie', position); root.scale.setScalar(size);
    const left = ball(root, 'left-folded-bow-loop', material, [-.088, 0, 0], [.101, .070, .051]); left.rotation.z = -.17;
    const right = ball(root, 'right-folded-bow-loop', material, [.088, 0, 0], [.101, .070, .051]); right.rotation.z = .17;
    ball(root, 'bow-centre-knot', material, [0, 0, .032], [.045, .060, .038]);
    line(root, 'left-bow-crease', mat(color, 'fabric'), [[-.15, .014, .036], [-.095, 0, .05], [-.035, -.012, .04]], .007, 12);
    return root;
  };
  const b = { group, fit, rig, own, mat, mesh, ball, pivot, line, sheet, patch, eye, brow, mouth, bow, skin, white, eyeWhite, ink, iris, pupil, glint, eyes, arms, legs, brows, skinMaterials, head: null, tail: null, cape: null };
  b.finish = () => {
    // Measure at unit scale, before parenting under a scaled placement group.
    rig.updateWorldMatrix(true, true); const bounds = new THREE.Box3().setFromObject(rig);
    const normalization = 2.2 / (bounds.max.y - bounds.min.y);
    fit.scale.setScalar(normalization); fit.position.y = -bounds.min.y * normalization;
    group.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
    group.userData.restHeight = 2.2; group.userData.meshes = 0; group.userData.triangles = 0;
    group.traverse(node => { if (node.isMesh) { group.userData.meshes++; group.userData.triangles += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3; } });
    let action = 'idle', expression = 'happy', disposed = false, airborneHeight = 0;
    const weights = Object.fromEntries([...ACTIONS].map(key => [key, key === 'idle' ? 1 : 0]));
    const phase = [...characterId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 17 * .17;
    const setAction = next => { if (!ACTIONS.has(next)) return false; action = next; group.userData.action = next; return true; };
    const setExpression = next => { if (!EXPRESSIONS.has(next)) return false; expression = next; group.userData.expression = next; return true; };
    const update = (time = 0, dt = 1 / 60) => {
      if (disposed) return;
      time = Number.isFinite(time) ? time : 0; dt = clamp(Number.isFinite(dt) ? dt : 1 / 60, 0, .1);
      const blend = 1 - Math.exp(-dt * 9);
      for (const key of ACTIONS) weights[key] = THREE.MathUtils.lerp(weights[key], key === action ? 1 : 0, blend);
      const jump = Math.max(0, Math.sin(time * 4.3)), jumpHi = Math.max(0, Math.sin(time * 6.1)), talk = weights.talk;
      const gait = Math.sin(time * (weights.sprint ? 13.5 : weights.run ? 10 : 7.8));
      const floatY = .82 + Math.sin(time * 2.1) * .06;
      const sleepTilt = weights.sleep * (Math.PI / 2);
      const rollSpin = weights.roll * (time % 6.283);
      const cheerPhase = Math.max(0, Math.sin(time * 7));
      airborneHeight = weights.hop * jump * .16 * fit.scale.y + weights.jump * jumpHi * .5 * fit.scale.y + weights.float * floatY * fit.scale.y;
      rig.position.y = weights.hop * jump * .16 + weights.jump * jumpHi * .5 + weights.float * floatY + weights.walk * Math.abs(gait) * .018 + weights.sleep * -.4 + weights.fall * .15;
      rig.rotation.z = sleepTilt + rollSpin + weights.fall * .85 + Math.sin(time * 1.7 + phase) * .010 + weights.walk * gait * .025 + weights.dance * Math.sin(time * 3) * .08;
      rig.rotation.x = weights.fall * .45;
      rig.scale.set(1 - weights.hop * jump * .025 + weights.cheer * cheerPhase * .04, 1 + Math.sin(time * 1.9 + phase) * .006 + weights.hop * jump * .035 + weights.jump * jumpHi * .07 + weights.cheer * cheerPhase * .1, 1);
      if (b.head) {
        b.head.rotation.z = THREE.MathUtils.lerp(b.head.rotation.z, (expression === 'curious' ? -.085 : 0) - weights.listen * .035 + talk * Math.sin(time * 4) * .014, blend);
        b.head.rotation.x = THREE.MathUtils.lerp(b.head.rotation.x, (expression === 'sad' ? .055 : 0) + talk * Math.sin(time * 3.7) * .02, blend);
      }
      const armSwing = (weights.walk + weights.run + weights.sprint) * gait;
      arms.forEach((arm, index) => { const side = index ? 1 : -1; arm.rotation.z = side * (.02 + weights.hop * .32) + (index ? weights.wave * (1.9 + Math.sin(time * 7) * .20) : 0) + weights.cheer * (index ? -1.9 : 1.9) + weights.dance * side * .3; arm.rotation.x = armSwing * side * .35 + talk * Math.sin(time * 4 + index) * .045 + weights.dance * Math.sin(time * 3 + index) * .2; });
      const legGait = (weights.walk + weights.run + weights.sprint) * gait;
      legs.forEach((leg, index) => { leg.rotation.x = legGait * (index ? 1 : -1) * .31; });
      if (b.tail) b.tail.rotation.y = Math.sin(time * 2.5 + phase) * .08 + weights.wave * Math.sin(time * 6) * .14;
      if (b.cape) b.cape.rotation.x = Math.sin(time * 2.1 + phase) * .018 + weights.hop * jump * .08;
      const blink = Math.max(0, 1 - Math.abs((time + phase) % 4.9 - 4.68) / .12);
      eyes.forEach(({ gaze, upper, lower, height, side }) => {
        const close = Math.max(blink, expression === 'sad' ? .21 : 0);
        upper.visible = lower.visible = close > .012;
        upper.scale.y = lower.scale.y = Math.max(.001, height * close);
        upper.position.y = height * (1 - close); lower.position.y = -height * (1 - close);
        gaze.position.x = Math.sin(time * .7 + phase) * .005 + (expression === 'curious' ? side * -.006 : 0);
        gaze.scale.setScalar(expression === 'surprised' ? .86 : 1);
      });
      brows.forEach(({ root, side }) => { root.rotation.z = expression === 'sad' ? side * -.28 : expression === 'curious' ? side * .12 : 0; });
      if (b.mouth) {
        const amount = Math.max(expression === 'surprised' ? .8 : 0, talk * (.22 + .68 * Math.abs(Math.sin(time * 10.5))));
        b.mouth.opening.visible = amount > .06; b.mouth.smile.visible = amount < .20;
        b.mouth.opening.scale.y = Math.max(.03, amount); b.mouth.opening.scale.x = expression === 'surprised' ? .75 : 1;
        if (b.lowerBeak) b.lowerBeak.position.y = b.lowerBeak.userData.restY - amount * .038;
      }
    };
    const setColor = color => { if (typeof color !== 'string' && typeof color !== 'number') return; for (const material of skinMaterials) material.color.set(color); group.userData.color = `#${skin.color.getHexString()}`; };
    const dispose = () => { if (disposed) return; disposed = true; for (const geometry of geometrySet) geometry.dispose(); for (const material of materialSet) material.dispose(); };
    setAction('idle'); setExpression('happy');
    return { group, update, setAction, setExpression, setColor, dispose, grounding: { getAirborneHeight: () => airborneHeight } };
  };
  return b;
}

export function buildBirdNPC(b, { cape = true, bow = true, bodyColor = '#f5d168' } = {}) {
  const body = b.pivot(b.rig, 'mango-shaped-chick', [0, .98, 0]);
  b.mesh(body, 'single-rounded-mango-body', shapedSphere(.13), b.skin, [0, 0, 0], [.645, .80, .45]);
  b.head = b.pivot(b.rig, 'chick-face-pivot', [0, 1.37, .374]);
  for (const side of [-1, 1]) {
    b.eye(b.head, side, [side * .218, .035, 0], .132, .154, b.skin);
    b.brow(b.head, side, [side * .215, .270, -.160], .105);
    const wing = b.pivot(b.rig, `soft-wing-${side}`, [side * .53, .94, .03]);
    const palm = b.ball(wing, 'rounded-wing-hand', b.skin, [side * .030, -.18, .036], [.119, .25, .105]); palm.rotation.z = side * .08;
    for (let finger = 0; finger < 3; finger++) b.ball(wing, 'three-feather-finger', b.skin, [side * (.005 + finger * .054), -.34 + finger * .020, .05], [.041, .083, .047], true);
    b.arms.push(wing);
    const foot = b.pivot(b.rig, `short-orange-leg-${side}`, [side * .22, .22, .01]);
    const orange = b.mat('#de812e', 'paint');
    b.ball(foot, 'short-chick-leg', orange, [0, -.035, 0], [.067, .17, .072]);
    b.ball(foot, 'rounded-orange-foot', orange, [0, -.17, .055], [.105, .072, .145]); b.legs.push(foot);
  }
  const crest = b.pivot(b.rig, 'two-part-chick-cowlick', [0, 1.78, -.02]);
  const first = b.ball(crest, 'tall-cowlick', b.skin, [-.045, .068, 0], [.078, .136, .085]); first.rotation.z = -.31;
  const second = b.ball(crest, 'small-cowlick', b.skin, [.07, .031, -.008], [.086, .083, .074]); second.rotation.z = -.5;
  const beak = b.mat('#ed932e', 'paint');
  b.mesh(b.head, 'soft-upper-orange-beak', shapedSphere(.36), beak, [0, -.048, .143], [.084, .068, .103]);
  b.mouth(b.head, [0, -.165, .129], .071, .086);
  b.lowerBeak = b.ball(b.head, 'articulated-lower-beak', beak, [0, -.176, .115], [.073, .022, .077]); b.lowerBeak.userData.restY = -.176;
  if (cape) {
    const red = b.mat('#ba3934', 'fabric');
    b.cape = b.pivot(b.rig, 'separate-thick-red-cape');
    b.sheet(b.cape, 'back-and-side-cloth-cape', red, (u, v) => {
      const angle = .46 * Math.PI + u * 1.08 * Math.PI;
      const length = .30 + .56 * Math.pow(Math.sin(u * Math.PI), .7);
      return [Math.sin(angle) * (.690 + v * .020), 1.08 - v * length, Math.cos(angle) * (.493 + v * .015)];
    }, 36, 10, .025);
    b.sheet(b.rig, 'gathered-front-cape-band', red, (u, v) => {
      const angle = (u - .5) * .92 * Math.PI;
      const x = Math.sin(angle) * .688, gather = Math.abs(Math.sin(angle));
      return [x, 1.055 + .036 * gather - v * (.058 + .102 * gather), Math.cos(angle) * .493 + .010 + Math.sin(u * TAU * 3) * .006 * v];
    }, 28, 5, .018);
  }
  if (bow) b.bow(b.rig, [0, 1.035, .530], '#b52f30', .90);
  return b;
}

export function buildCatNPC(b, { shirtColor = '#f4f1e8', pantsColor = '#8c74bd', emblem = true } = {}) {
  const shirt = b.mat(shirtColor, 'fabric'), purple = b.mat(pantsColor, 'fabric'), pink = b.mat('#e7a1ad', 'paint');
  b.head = b.pivot(b.rig, 'lemon-shaped-cat-head', [0, 1.61, .005]);
  b.mesh(b.head, 'wide-pink-lemon-head', shapedSphere(-.015, .065), b.skin, [0, 0, 0], [.57, .437, .375]);
  b.ball(b.head, 'sculpted-white-face-mask', b.white, [0, -.058, .294], [.474, .332, .125]);
  const forehead = b.patch(b.head, 'white-pointed-forehead-tuft', b.white, [[-.075, .14], [0, .29], [.07, .14]], .014, .018); forehead.position.z = .347;
  for (const side of [-1, 1]) {
    const ear = b.pivot(b.head, `tall-pointed-cat-ear-${side}`, [side * .38, .245, -.025]); ear.rotation.z = side * -.22;
    const outer = b.patch(ear, 'solid-rounded-pink-ear', b.skin, [[-.18, 0], [0, .53], [.18, .025]], .145, .045); outer.position.z = -.075;
    const inner = b.patch(ear, 'recessed-peach-inner-ear', pink, [[-.111, .065], [0, .46], [.113, .065]], .010, .024); inner.position.z = .085;
    b.ball(b.head, 'outward-cheek-tuft', b.skin, [side * .526, -.115, -.006], [.078, .093, .181]);
    b.eye(b.head, side, [side * .202, -.022, .400], .137, .145, b.white, true);
    b.brow(b.head, side, [side * .192, .205, .376], .077);
    const arm = b.pivot(b.rig, `cat-arm-${side}`, [side * .256, 1.035, 0]);
    const sleeve = b.ball(arm, 'white-short-tshirt-sleeve', shirt, [side * .035, -.065, 0], [.124, .158, .123]); sleeve.rotation.z = side * .3;
    b.ball(arm, 'pink-cat-forearm', b.skin, [side * .061, -.265, .013], [.065, .172, .066]);
    b.ball(arm, 'white-cat-paw', b.white, [side * .066, -.400, .027], [.078, .088, .072]);
    for (let toe = -1; toe <= 1; toe++) b.ball(arm, 'soft-paw-finger', b.white, [side * .066 + toe * .043, -.45, .046], [.028, .052, .031], true);
    b.ball(arm, 'cat-paw-thumb', b.white, [side * .121, -.395, .065], [.034, .06, .034], true); b.arms.push(arm);
    const leg = b.pivot(b.rig, `cat-leg-${side}`, [side * .151, .414, 0]);
    b.ball(leg, 'long-pink-cat-leg', b.skin, [0, -.136, .006], [.075, .205, .082]);
    b.ball(leg, 'white-ankle-sock', b.white, [0, -.291, .023], [.079, .11, .084]);
    b.ball(leg, 'white-rounded-cat-foot', b.white, [0, -.349, .054], [.109, .066, .128]);
    for (const toe of [-1, 1]) b.line(leg, 'white-toe-seam', pink, [[toe * .03, -.342, .166], [toe * .03, -.372, .162]], .004, 5);
    b.legs.push(leg);
    b.mesh(b.rig, 'purple-short-trouser-leg', new THREE.CylinderGeometry(.148, .154, .239, 24), purple, [side * .15, .565, 0], [1, 1, .86]);
    b.line(b.rig, 'shorts-front-pressed-seam', b.mat('#746097', 'fabric'), [[side * .151, .453, .131], [side * .151, .63, .137]], .005, 7);
  }
  b.ball(b.rig, 'cat-neck', b.skin, [0, 1.17, 0], [.084, .11, .09]);
  const shirtProfile = [[0, -.221], [.286, -.221], [.302, -.18], [.255, .10], [.196, .213], [0, .215]].map(p => new THREE.Vector2(...p));
  b.mesh(b.rig, 'flared-white-tshirt', new THREE.LatheGeometry(shirtProfile, 32), shirt, [0, .95, 0], [1, 1, .74]);
  b.ball(b.rig, 'purple-shorts-waist', purple, [0, .69, 0], [.301, .137, .210]);
  b.ball(b.head, 'small-pink-cat-nose', b.mat('#c56183', 'ink'), [0, -.14, .444], [.047, .029, .029], true);
  b.line(b.head, 'nose-to-mouth-philtrum', b.ink, [[0, -.157, .451], [0, -.208, .452]], .005, 8);
  b.mouth(b.head, [0, -.230, .402], .091, .078, { fangs: true });
  b.tail = b.pivot(b.rig, 'long-sweeping-cat-tail', [0, .565, -.132]);
  b.line(b.tail, 'long-pink-tail', b.skin, [[0, 0, -.05], [.30, -.08, -.18], [.58, -.04, -.23], [.72, .20, -.23], [.69, .44, -.22]], .057, 32);
  b.line(b.tail, 'pale-tail-tip', b.white, [[.69, .44, -.22], [.655, .565, -.225], [.617, .627, -.22]], .059, 14);
  b.ball(b.tail, 'rounded-pale-tail-tip', b.white, [.617, .627, -.22], [.058, .061, .056], true);
  if (emblem) {
    const emblemGroup = b.pivot(b.rig, 'raised-bell-shirt-emblem', [0, .976, .200]);
    b.ball(emblemGroup, 'purple-round-bell-badge', purple, [0, 0, 0], [.136, .136, .014]);
    b.line(emblemGroup, 'cream-bell-dome-symbol', b.eyeWhite, [[-.097, .016, .020], [-.054, .057, .021], [0, .069, .021], [.054, .057, .021], [.097, .016, .020]], .010, 24);
    b.ball(emblemGroup, 'bell-symbol-clapper', b.eyeWhite, [0, -.018, .022], [.027, .029, .007], true);
    b.line(emblemGroup, 'bell-symbol-stem', b.eyeWhite, [[0, -.032, .022], [0, -.116, .019]], .009, 10);
  }
  return b;
}

export function buildPigNPC(b, { shirtColor = '#f4f0e7', pantsColor = '#4385ad', bowColor = '#4c98bf', suspenders = true } = {}) {
  const shirt = b.mat(shirtColor, 'fabric'), blue = b.mat(pantsColor, 'fabric'), snout = b.mat('#e9988b', 'paint');
  b.head = b.pivot(b.rig, 'round-steamed-bun-pig-head', [0, 1.54, 0]);
  b.mesh(b.head, 'wide-soft-bun-shaped-head', shapedSphere(.035, .055), b.skin, [0, 0, 0], [.729, .629, .507]);
  b.ball(b.rig, 'round-white-shirt-body', shirt, [0, .674, -.004], [.638, .48, .447]);
  b.mesh(b.rig, 'blue-trousers-rounded-bottom', new THREE.SphereGeometry(1, 32, 16, 0, TAU, Math.PI / 2, Math.PI / 2), blue, [0, .555, 0], [.64, .377, .455]);
  for (const side of [-1, 1]) {
    const ear = b.pivot(b.head, `folded-pig-ear-${side}`, [side * .494, .507, .154]); ear.rotation.z = side * .61; ear.rotation.x = .10;
    b.ball(ear, 'soft-flopping-pig-ear', b.skin, [0, -.10, .008], [.105, .192, .049]);
    b.ball(ear, 'warm-inner-pig-ear', snout, [0, -.12, .049], [.060, .129, .012]);
    b.eye(b.head, side, [side * .238, .039, .463], .134, .148, b.skin);
    b.brow(b.head, side, [side * .247, .331, .420], .139);
    b.ball(b.head, 'soft-rosy-cheek', b.mat('#eeb0a0', 'paint'), [side * .424, -.126, .414], [.114, .069, .013], true);
    const arm = b.pivot(b.rig, `pig-arm-${side}`, [side * .559, .94, -.004]);
    const sleeve = b.ball(arm, 'white-short-shirt-sleeve', shirt, [side * .037, -.077, .005], [.133, .183, .151]); sleeve.rotation.z = side * .29;
    b.ball(arm, 'short-pink-pig-arm', b.skin, [side * .071, -.254, .018], [.083, .164, .09]);
    b.ball(arm, 'soft-pig-palm', b.skin, [side * .075, -.366, .038], [.092, .095, .083]);
    for (let finger = -1; finger <= 1; finger++) b.ball(arm, 'pig-finger', b.skin, [side * .075 + finger * .042, -.421 + Math.abs(finger) * .012, .05], [.028, .060, .033], true);
    b.arms.push(arm);
    const leg = b.pivot(b.rig, `short-pig-leg-${side}`, [side * .253, .241, .006]);
    b.ball(leg, 'short-pig-leg', b.skin, [0, -.087, .011], [.132, .143, .137]);
    b.ball(leg, 'rounded-pig-foot', b.skin, [0, -.184, .042], [.135, .067, .149]);
    const hoof = b.mat('#bd8068', 'paint');
    for (const toe of [-1, 1]) b.ball(leg, 'paired-tiny-hoof-tip', hoof, [toe * .056, -.211, .151], [.042, .032, .029], true);
    b.legs.push(leg);
    if (suspenders) b.sheet(b.rig, 'fitted-blue-front-suspender', blue, (u, v) => {
      const x = side * .350 + (u - .5) * .051, y = .452 + v * .587;
      const z = .447 * Math.sqrt(Math.max(.02, 1 - (x / .638) ** 2 - ((y - .674) / .48) ** 2));
      return [x, y, z + .014];
    }, 3, 16, .012);
    const collar = b.ball(b.rig, 'white-rounded-polo-collar', shirt, [side * .269, 1.045, .415], [.265, .071, .067]); collar.rotation.z = side * .16;
  }
  const snoutRoot = b.pivot(b.head, 'protruding-pig-snout', [0, -.063, .515]);
  b.ball(snoutRoot, 'oval-rounded-snout', snout, [0, 0, .038], [.182, .129, .094]);
  const nostril = b.mat('#a24e40', 'ink');
  for (const side of [-1, 1]) b.ball(snoutRoot, 'recessed-vertical-nostril', nostril, [side * .066, .004, .125], [.024, .046, .010], true);
  b.mouth(b.head, [0, -.273, .458], .143, .109, { tooth: true });
  if (bowColor) b.bow(b.rig, [0, 1.008, .497], bowColor, 1.09);
  const hair = b.mat('#665148', 'paper');
  const hairRoot = b.pivot(b.head, 'small-combed-brown-hair-tuft', [0, .592, -.018]);
  for (const side of [-1, 1]) { const tuft = b.ball(hairRoot, 'combed-brown-hair-lock', hair, [side * .067, .036, .008], [.098, .088, .073]); tuft.rotation.z = side * .42; }
  b.line(hairRoot, 'hair-centre-part', b.mat('#8e7568', 'paper'), [[0, .085, .064], [0, .02, .076]], .005, 8);
  b.tail = b.pivot(b.rig, 'curly-pig-tail', [0, .350, -.395]);
  const curl = Array.from({ length: 31 }, (_, i) => { const t = i / 30 * TAU * 1.15; return [.034 + Math.sin(t) * .065, .032 + (1 - Math.cos(t)) * .059, -.017 - i / 30 * .055]; });
  b.line(b.tail, 'small-spiral-tail', snout, [[0, 0, 0], ...curl], .016, 38);
  if (suspenders) for (const side of [-1, 1]) b.line(b.rig, 'back-Y-suspender', blue, [[side * .445, 1.011, -.315], [side * .253, .805, -.414], [0, .59, -.457], [0, .445, -.460]], .028, 18);
  return b;
}

export function supportsDocumentCharacter(id) { return IDS.has(id); }

export function createDocumentCharacter({ characterId, scale = 1 } = {}) {
  if (!supportsDocumentCharacter(characterId)) throw new RangeError(`Unsupported document character: ${String(characterId)}`);
  const config = {
    jiaojiao: { skin: '#f5d168', species: 'chick', builder: buildBirdNPC },
    lingdang: { skin: '#e594a9', species: 'cat', builder: buildCatNPC },
    zhuxiaodi: { skin: '#edb8a4', species: 'pig', builder: buildPigNPC },
  }[characterId];
  const builder = createNPCToolkit(characterId, config.skin, { scale, species: config.species });
  config.builder(builder); return builder.finish();
}
