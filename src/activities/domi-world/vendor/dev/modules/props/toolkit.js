import * as THREE from 'three';

// Each instance owns its geometry, materials and animation state.
export function createPropToolkit(group, color) {
  const shapes = new Map(),
    materials = new Map(),
    movers = [];
  const cream = "#f1e3c4",
    wood = "#a98c69",
    gold = "#e8c56e",
    ink = "#51636b";
  function flagStarGeometry() {
    const outline = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 0.4 : 1;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) outline.moveTo(x, y); else outline.lineTo(x, y);
    }
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: 1, bevelEnabled: false });
    geometry.translate(0, 0, -0.5);
    return geometry;
  }
  function part(type, tint, p, s, parent = group) {
    if (!shapes.has(type))
      shapes.set(
        type,
        type === "flag-star"
          ? flagStarGeometry()
          : type === "box"
          ? new THREE.BoxGeometry(1, 1, 1)
          : type === "ring"
            ? new THREE.TorusGeometry(1, 0.09, 8, 32)
            : type === "cone"
              ? new THREE.ConeGeometry(1, 1, 12)
              : type === "cylinder"
                ? new THREE.CylinderGeometry(1, 1, 1, 16)
                : type === "star"
                  ? new THREE.OctahedronGeometry(1)
                  : new THREE.SphereGeometry(1, 16, 12),
      );
    if (!materials.has(tint))
      materials.set(
        tint,
        new THREE.MeshStandardMaterial({
          color: tint,
          roughness: 0.86,
          userData: { handcraftedSurface: "paint" },
        }),
      );
    const mesh = new THREE.Mesh(shapes.get(type), materials.get(tint));
    mesh.position.set(...p);
    mesh.scale.set(...s);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function moving(object, mode, amount = 0.25, rate = 2) {
    movers.push({
      object,
      mode,
      amount,
      rate,
      rest: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone(),
    });
    return object;
  }
  const pedestal = () =>
    part("cylinder", cream, [0, 0.1, 0], [1.05, 0.2, 0.85]);
  const star = (p, s = 0.14) =>
    moving(part("star", gold, p, [s, s, s]), "bounce", 0.15);
  const beam = (a, b, radius, tint = wood) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const mesh = part(
      "cylinder",
      tint,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      [radius, start.distanceTo(end), radius],
    );
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.sub(start).normalize(),
    );
    return mesh;
  };
  const table = () => {
    part("box", wood, [0, 0.8, 0], [1.7, 0.13, 1]);
    for (const x of [-0.65, 0.65])
      for (const z of [-0.35, 0.35])
        part("box", wood, [x, 0.4, z], [0.1, 0.8, 0.1]);
  };
  return {
    THREE,
    group,
    color,
    cream,
    wood,
    gold,
    ink,
    shapes,
    materials,
    movers,
    part,
    moving,
    pedestal,
    star,
    beam,
    table,
  };
}
