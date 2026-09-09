import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Reproducible, texture-free PBR assets. Units are metres; no external files needed.
globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((result) => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }); }
};
const output = fileURLToPath(new URL('../public/models/food/', import.meta.url));
await mkdir(output, { recursive: true });
const material = (name, color, roughness = 0.36, extra = {}) => new THREE.MeshStandardMaterial({ name, color, roughness, metalness: 0, ...extra });
const mats = {
  red: material('Apple skin · cherry red', '#eb4439', 0.25, { vertexColors: true }),
  stem: material('Warm wooden stem', '#825638', 0.72),
  green: material('Leaf green', '#5ea14a', 0.5),
  lightGreen: material('Fresh leaf green', '#8bb755', 0.52),
  cream: material('Vanilla cream', '#fff7e4', 0.42),
  sponge: material('Soft golden sponge', '#ecc784', 0.78),
  strawberry: material('Strawberry red', '#eb5160', 0.34),
  seed: material('Strawberry seeds', '#ffd585', 0.6),
  pink: material('Strawberry filling', '#f59caa', 0.62),
  bowl: material('Butter yellow glazed ceramic', '#efc768', 0.23),
  rim: material('Cream ceramic rim', '#fff1cd', 0.23),
  soup: material('Golden broth', '#bd7936', 0.22),
  noodle: material('Soft egg noodles', '#f9d998', 0.45),
  egg: material('Egg white', '#fff8e9', 0.45),
  yolk: material('Golden egg yolk', '#ffb52b', 0.42),
};
function mesh(parent, name, geometry, mat, position = [0, 0, 0], scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, mat);
  object.name = name;
  object.position.set(...position); object.scale.set(...scale); parent.add(object);
  return object;
}
function tube(parent, name, points, radius, mat, segments = 32, radial = 8) {
  return mesh(parent, name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, radial, false), mat);
}
function leaf(parent, name, mat, position, scale = 1, rotation = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.bezierCurveTo(-0.18, 0.22, -0.16, 0.53, 0, 0.7); shape.bezierCurveTo(0.2, 0.43, 0.15, 0.15, 0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.027, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.018, bevelThickness: 0.012, curveSegments: 12 });
  const object = mesh(parent, name, geometry, mat, position, [scale, scale, scale]);
  object.rotation.set(-0.45, rotation, -0.9); return object;
}
function apple() {
  const group = new THREE.Group(); group.name = 'Apple';
  const geometry = new THREE.SphereGeometry(0.76, 48, 32);
  const positions = geometry.attributes.position;
  const colors = [];
  const topColor = new THREE.Color('#fff1da'); const lowColor = new THREE.Color('#c9655f');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i); const y = positions.getY(i); const z = positions.getZ(i);
    const angle = Math.atan2(z, x); const t = y / 0.76; const radial = Math.hypot(x, z);
    const lobe = 1 + 0.035 * Math.cos(angle * 5) * (0.55 + t * t);
    const shoulder = 1 + 0.08 * t;
    const topIndent = 0.17 * Math.exp(-radial * radial / 0.045) * Math.max(0, t);
    const bottomIndent = 0.07 * Math.exp(-radial * radial / 0.035) * Math.max(0, -t);
    positions.setXYZ(i, x * lobe * shoulder, y * 0.96 - topIndent + bottomIndent, z * lobe * shoulder);
    const color = lowColor.clone().lerp(topColor, THREE.MathUtils.clamp(0.55 + t * 0.3 + x * 0.08, 0, 1));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  mesh(group, 'Five-lobed apple', geometry, mats.red, [0, 0.74, 0]);
  tube(group, 'Curved stem', [[0, 1.31, 0], [0.015, 1.51, 0], [0.11, 1.69, 0.025]], 0.046, mats.stem, 12);
  leaf(group, 'Apple leaf', mats.green, [0.04, 1.51, 0.01], 0.72, 0.4);
  tube(group, 'Leaf vein', [[0.05, 1.54, 0.045], [0.23, 1.7, -0.02], [0.4, 1.78, -0.06]], 0.009, mats.lightGreen, 12, 6);
  return group;
}
function wedge(parent, name, y, height, mat, radius = 1.15) {
  const shape = new THREE.Shape(); const angle = 0.72;
  shape.moveTo(0, 0.5); shape.lineTo(-Math.sin(angle) * radius, 0.5 - Math.cos(angle) * radius);
  shape.absarc(0, 0.5, radius, -Math.PI / 2 - angle, -Math.PI / 2 + angle, false); shape.lineTo(0, 0.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.028, bevelSegments: 3, curveSegments: 24, steps: 1 });
  const object = mesh(parent, name, geometry, mat, [0, y, 0]); object.rotation.x = -Math.PI / 2; return object;
}
function strawberry(parent, position, size = 1, turn = 0) {
  const group = new THREE.Group(); group.position.set(...position); group.scale.setScalar(size); group.rotation.y = turn; parent.add(group);
  const geometry = new THREE.SphereGeometry(1, 24, 18);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); const taper = 0.65 + y * 0.25;
    p.setXYZ(i, p.getX(i) * 0.28 * taper, y * 0.28, p.getZ(i) * 0.28 * taper);
  }
  geometry.computeVertexNormals(); mesh(group, 'Strawberry', geometry, mats.strawberry, [0, 0.2, 0]);
  for (let row = 0; row < 4; row++) {
    const y = -0.55 + row * 0.38; const r = Math.sqrt(1 - y * y) * 0.28 * (0.65 + y * 0.25);
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4 + row * 0.22;
      const seed = mesh(group, 'Seed', new THREE.SphereGeometry(1, 6, 4), mats.seed, [Math.cos(a) * (r + 0.006), 0.2 + y * 0.28, Math.sin(a) * (r + 0.006)], [0.014, 0.025, 0.013]); seed.rotation.y = -a;
    }
  }
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const l = mesh(group, 'Strawberry crown', new THREE.SphereGeometry(1, 10, 6), mats.green, [Math.cos(angle) * 0.07, 0.46, Math.sin(angle) * 0.07], [0.075, 0.022, 0.033]); l.rotation.y = -angle;
  }
}
function cake() {
  const group = new THREE.Group(); group.name = 'Strawberry cream cake';
  wedge(group, 'Bottom sponge', 0.06, 0.23, mats.sponge);
  wedge(group, 'Berry cream filling', 0.32, 0.13, mats.pink);
  wedge(group, 'Top sponge', 0.48, 0.23, mats.sponge);
  wedge(group, 'Vanilla frosting', 0.74, 0.11, mats.cream, 1.18);
  for (let i = 0; i < 12; i++) {
    const a = -0.67 + (i / 11) * 1.34;
    const x = Math.sin(a) * 1.16; const z = Math.cos(a) * 1.16 - 0.5;
    mesh(group, 'Scalloped frosting edge', new THREE.SphereGeometry(1, 12, 8), mats.cream, [x, 0.74, z], [0.096, i % 2 ? 0.1 : 0.14, 0.074]);
  }
  strawberry(group, [-0.17, 0.92, 0.27], 1.13, 0.3);
  strawberry(group, [0.27, 0.91, 0.48], 0.84, 1.2);
  for (let j = 0; j < 3; j++) {
    const x = -0.27 + j * 0.24; const z = 0.62;
    for (let k = 0; k < 3; k++) mesh(group, 'Piped whipped cream', new THREE.SphereGeometry(1, 14, 10), mats.cream, [x + k * 0.012, 0.93 + k * 0.064, z], [0.105 - k * 0.027, 0.083 - k * 0.014, 0.105 - k * 0.027]);
  }
  return group;
}
function noodles() {
  const group = new THREE.Group(); group.name = 'Noodle bowl';
  const profile = [[0.33, 0.05], [0.39, 0.03], [0.44, 0.075], [0.48, 0.13], [0.58, 0.2], [0.73, 0.32], [0.85, 0.49], [0.93, 0.68], [0.95, 0.79], [0.92, 0.83], [0.87, 0.78], [0.84, 0.64], [0.75, 0.48], [0.58, 0.29], [0.38, 0.19], [0, 0.19]];
  mesh(group, 'Ceramic bowl', new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64), mats.bowl);
  const rim = mesh(group, 'Rounded cream rim', new THREE.TorusGeometry(0.916, 0.046, 12, 64), mats.rim, [0, 0.8, 0]); rim.rotation.x = Math.PI / 2;
  mesh(group, 'Broth surface', new THREE.CylinderGeometry(0.85, 0.84, 0.045, 48), mats.soup, [0, 0.728, 0]);
  for (let i = 0; i < 11; i++) {
    const points = [];
    for (let j = 0; j <= 44; j++) {
      const t = j / 44; const angle = t * Math.PI * 2.8 + i * 0.57;
      const radius = 0.11 + t * (0.47 + (i % 3) * 0.055);
      points.push([Math.cos(angle) * radius + Math.sin(i * 2.7) * 0.12, 0.786 + Math.sin(t * Math.PI * 5 + i) * 0.026 + (i % 3) * 0.018, Math.sin(angle) * radius]);
    }
    tube(group, `Curled noodle ${i + 1}`, points, 0.026, mats.noodle, 74, 7);
  }
  const egg = new THREE.Group(); egg.position.set(0.28, 0.84, -0.25); egg.rotation.set(-0.12, 0.3, -0.22); group.add(egg);
  mesh(egg, 'Half boiled egg', new THREE.SphereGeometry(1, 28, 18), mats.egg, [0, 0, 0], [0.28, 0.095, 0.36]);
  mesh(egg, 'Rounded yolk', new THREE.SphereGeometry(1, 24, 16), mats.yolk, [0, 0.077, 0.015], [0.17, 0.038, 0.185]);
  for (let i = 0; i < 3; i++) {
    const object = mesh(group, 'Bok choy leaf', new THREE.SphereGeometry(1, 20, 12), i % 2 ? mats.lightGreen : mats.green, [-0.39 + i * 0.09, 0.87 + i * 0.025, -0.3 + i * 0.02], [0.13, 0.035, 0.29]); object.rotation.y = -0.45 + i * 0.3;
    tube(group, 'Bok choy stalk', [[-0.3 + i * 0.08, 0.85, -0.08], [-0.35 + i * 0.08, 0.91, -0.32]], 0.021, mats.lightGreen, 8, 6);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39; const r = 0.24 + (i % 3) * 0.15;
    const onion = mesh(group, 'Scallion ring', new THREE.TorusGeometry(0.045, 0.011, 6, 12), mats.green, [Math.cos(a) * r, 0.9, Math.sin(a) * r], [1, 1.2, 1]); onion.rotation.x = Math.PI / 2 - 0.25;
  }
  return group;
}
function drink() {
  const group = new THREE.Group(); group.name = 'Orange juice carton';
  const carton = material('Apricot orange paper carton', '#ff9b42', 0.54);
  const paper = material('Warm white carton and straw', '#fff8e6', 0.46);
  const orange = material('Juicy orange segments', '#ffaf30', 0.38);
  const peel = material('Tangerine orange peel', '#f36e28', 0.43);
  const strawInside = material('Inside of drinking straw', '#91633b', 0.74);
  mesh(group, 'Rounded juice carton', new RoundedBoxGeometry(0.66, 1.06, 0.46, 4, 0.035), carton, [0, 0.53, 0]);
  // A folded triangular gable runs across the top of the carton.
  const roofShape = new THREE.Shape(); roofShape.moveTo(-0.23, 0); roofShape.lineTo(0.23, 0); roofShape.lineTo(0, 0.22); roofShape.closePath();
  const roof = mesh(group, 'Folded paper gable', new THREE.ExtrudeGeometry(roofShape, { depth: 0.61, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.013, bevelThickness: 0.013, steps: 1 }), paper, [-0.305, 1.035, 0]); roof.rotation.y = Math.PI / 2;
  mesh(group, 'Sealed top fold', new RoundedBoxGeometry(0.65, 0.055, 0.038, 3, 0.012), carton, [0, 1.276, 0]);
  mesh(group, 'Front cream label', new RoundedBoxGeometry(0.48, 0.64, 0.026, 4, 0.012), paper, [0, 0.56, 0.232]);
  // The label is embossed geometry, with no brand, lettering, or texture file.
  const slice = mesh(group, 'Orange peel emblem', new THREE.CylinderGeometry(0.171, 0.171, 0.024, 40), peel, [0, 0.55, 0.257]); slice.rotation.x = Math.PI / 2;
  const pith = mesh(group, 'Orange pith emblem', new THREE.CylinderGeometry(0.15, 0.15, 0.028, 40), paper, [0, 0.55, 0.268]); pith.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.055; const end = (i + 1) * Math.PI / 4 - 0.055;
    const segment = new THREE.Shape(); segment.moveTo(Math.cos(a) * 0.025, Math.sin(a) * 0.025); segment.lineTo(Math.cos(a) * 0.134, Math.sin(a) * 0.134); segment.absarc(0, 0, 0.134, a, end, false); segment.lineTo(Math.cos(end) * 0.025, Math.sin(end) * 0.025); segment.closePath();
    mesh(group, 'Orange segment', new THREE.ExtrudeGeometry(segment, { depth: 0.008, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.003, bevelThickness: 0.002, curveSegments: 6, steps: 1 }), orange, [0, 0.55, 0.283]);
  }
  const emblemLeaf = mesh(group, 'Small green label leaf', new THREE.SphereGeometry(1, 16, 10), mats.green, [0.075, 0.758, 0.257], [0.095, 0.036, 0.015]); emblemLeaf.rotation.z = 0.4;
  mesh(group, 'Label lower accent', new RoundedBoxGeometry(0.21, 0.027, 0.014, 3, 0.006), carton, [0, 0.315, 0.257]);
  tube(group, 'Bent paper straw', [[0.18, 1.15, 0.085], [0.18, 1.4, 0.085], [0.2, 1.51, 0.085], [0.33, 1.59, 0.085]], 0.021, paper, 28, 12);
  for (let i = 0; i < 4; i++) {
    mesh(group, 'Straw orange stripe', new THREE.CylinderGeometry(0.022, 0.022, 0.028, 12), peel, [0.18, 1.19 + i * 0.055, 0.085]);
  }
  const tip = mesh(group, 'Open straw tip', new THREE.CircleGeometry(0.016, 16), strawInside, [0.331, 1.591, 0.085]);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.13, 0.08, 0).normalize());
  return group;
}
function candy() {
  const group = new THREE.Group(); group.name = 'Twist-wrapped striped candy';
  const wrapper = material('Butter yellow candy wrapper', '#ffe07a', 0.3);
  const stripe = material('Raspberry candy stripes', '#ef6588', 0.3);
  const ends = material('Turquoise twisted wrapper', '#57c5c2', 0.32);
  const ties = material('Soft mint wrapper neck', '#a4e6d8', 0.34);
  mesh(group, 'Plump wrapped candy', new THREE.SphereGeometry(1, 48, 28), wrapper, [0, 0.34, 0], [0.55, 0.32, 0.32]);
  // Raised diagonal ribbons follow the ellipsoid rather than floating above it.
  for (const offset of [-0.29, 0, 0.29]) {
    const positions = []; const indices = []; const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      for (let edge = 0; edge < 2; edge++) {
        const x = offset + Math.sin(angle) * 0.09 + (edge - 0.5) * 0.09;
        const radius = Math.sqrt(1 - (x / 0.55) ** 2) * 0.33;
        positions.push(x, 0.34 + Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      if (i < segments) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(group, 'Diagonal raspberry ribbon', geometry, stripe);
  }
  for (const direction of [-1, 1]) {
    // A thick folded sheet narrows into a twist and opens into a scalloped fan.
    const positions = []; const indices = []; const rings = 16; const radial = 48;
    for (let layer = 0; layer < 2; layer++) {
      for (let ring = 0; ring <= rings; ring++) {
        const t = ring / rings;
        const radius = t < 0.3 ? THREE.MathUtils.lerp(0.21, 0.086, t / 0.3) : THREE.MathUtils.lerp(0.086, 0.3, ((t - 0.3) / 0.7) ** 0.8);
        for (let i = 0; i <= radial; i++) {
          const angle = i / radial * Math.PI * 2; const turn = angle + direction * t * 1.2;
          const fold = 1 + 0.12 * Math.cos(angle * 8) * (0.4 + t * 0.6);
          const r = radius * fold - layer * 0.014;
          positions.push(direction * (0.44 + t * 0.61 + Math.cos(angle * 8) * 0.024 * t ** 3), 0.34 + Math.cos(turn) * r, Math.sin(turn) * r * 0.8);
        }
      }
    }
    const stride = radial + 1; const surface = (rings + 1) * stride;
    for (let layer = 0; layer < 2; layer++) {
      for (let ring = 0; ring < rings; ring++) {
        for (let i = 0; i < radial; i++) {
          const a = layer * surface + ring * stride + i; const b = a + stride;
          const face = [a, a + 1, b, a + 1, b + 1, b];
          if ((direction === -1) !== (layer === 1)) face.reverse();
          indices.push(...face);
        }
      }
    }
    for (const ring of [0, rings]) {
      for (let i = 0; i < radial; i++) {
        const a = ring * stride + i; const b = a + surface; const face = [a, b, a + 1, a + 1, b, b + 1];
        if ((direction === -1) !== (ring === 0)) face.reverse(); indices.push(...face);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(group, 'Folded twist wrapper', geometry, ends);
    const tie = mesh(group, 'Twisted wrapper neck', new THREE.TorusGeometry(0.091, 0.018, 8, 24), ties, [direction * 0.628, 0.34, 0], [1, 0.86, 1]); tie.rotation.y = Math.PI / 2;
  }
  return group;
}
function optimize(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  group.traverse((object) => {
    if (!object.isMesh) return;
    let geo = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (geo.index) { const flat = geo.toNonIndexed(); geo.dispose(); geo = flat; }
    const key = object.material.uuid;
    if (!batches.has(key)) batches.set(key, { geometries: [], material: object.material });
    batches.get(key).geometries.push(geo);
  });
  const result = new THREE.Group(); result.name = group.name;
  for (const { geometries, material: mat } of batches.values()) {
    const merged = mergeGeometries(geometries); const indexed = mergeVertices(merged); merged.dispose(); mesh(result, mat.name, indexed, mat); geometries.forEach((g) => g.dispose());
  }
  return result;
}
const definitions = [
  { id: 'apple', name: '红苹果', description: '饱满果身、弯曲果梗和立体绿叶。', make: apple, metreScale: 0.055 },
  { id: 'cake', name: '草莓奶油蛋糕', description: '松软双层蛋糕，配草莓夹心、奶油和新鲜草莓。', make: cake, metreScale: 0.09 },
  { id: 'noodles', name: '暖暖面条', description: '圆润陶碗、卷曲面条、溏心蛋和小青菜。', make: noodles, metreScale: 0.115 },
  { id: 'drink', name: '果汁饮料', description: '圆润果汁纸盒，配弯曲吸管和立体橙片图案。', make: drink, metreScale: 0.1 },
  { id: 'candy', name: '彩色糖果', description: '明亮条纹的单颗糖果，包着两端扭结的青绿色糖纸。', make: candy, metreScale: 0.045 },
];
const models = [];
for (const { make, metreScale, ...definition } of definitions) {
  const source = make(); source.scale.setScalar(metreScale);
  const object = optimize(source);
  object.userData = { assetId: definition.id, license: 'CC0-1.0', generator: 'CyberJOJO2027 food model generator', units: 'metres' };
  const binary = await new GLTFExporter().parseAsync(object, { binary: true, onlyVisible: true });
  const filename = `${definition.id}.glb`;
  await writeFile(`${output}/${filename}`, Buffer.from(binary));
  const box = new THREE.Box3().setFromObject(object); const size = box.getSize(new THREE.Vector3());
  let triangles = 0; let meshes = 0; const materials = new Set();
  object.traverse((child) => { if (child.isMesh) { meshes++; triangles += (child.geometry.index?.count || child.geometry.attributes.position.count) / 3; materials.add(child.material.uuid); } });
  models.push({ ...definition, path: `models/food/${filename}`, bytes: binary.byteLength, triangles, meshes, materials: materials.size, dimensions: size.toArray().map((n) => Number(n.toFixed(3))), format: 'GLB', license: 'CC0-1.0' });
}
await writeFile(`${output}/manifest.json`, `${JSON.stringify({ version: 1, units: 'metres', models }, null, 2)}\n`);
await writeFile(`${output}/LICENSE.txt`, 'CC0 1.0 Universal\n\nThese original procedural food models were created for CyberJOJO2027.\nTo the extent possible under law, the authors waive all copyright and related rights to these models under CC0 1.0 Universal.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n');
console.log(JSON.stringify(models, null, 2));
