// A self-contained prefab: no story or DOM dependency.
export function build({
  THREE,
  group,
  part,
  moving,
  pedestal,
  star,
  beam,
  table,
  cream,
  wood,
  gold,
  ink,
  color,
}) {
  part("cylinder", wood, [0, 0.65, 0], [0.16, 1.3, 0.16]);
  part("ball", "#abc094", [0, 0.05, 0], [0.75, 0.1, 0.6]);
  const crown = new THREE.Group();
  crown.position.y = 1.25;
  group.add(crown);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4,
      x = Math.cos(a) * 0.45,
      z = Math.sin(a) * 0.35;
    part(
      "ball",
      color,
      [x, 0.15 + (i % 2) * 0.28, z],
      [0.48, 0.48, 0.42],
      crown,
    );
    moving(
      part("star", gold, [x, 0.1, z + 0.35], [0.13, 0.16, 0.13], crown),
      "bounce",
      0.1,
      2 + i * 0.3,
    );
  }
  moving(crown, "sway", 0.08, 1.5);
}
