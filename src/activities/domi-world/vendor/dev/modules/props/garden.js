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
  part("cylinder", "#aab98c", [0, 0.1, 0], [1, 0.2, 0.75]);
  for (let i = 0; i < 5; i++) {
    const x = Math.sin(i * 2.4) * 0.7,
      z = Math.cos(i * 2.4) * 0.45,
      y = 0.6 + (i % 2) * 0.3;
    beam([x, 0.1, z], [x, y, z], 0.035, "#78946c");
    const flower = new THREE.Group();
    flower.position.set(x, y, z);
    group.add(flower);
    for (let j = 0; j < 5; j++)
      part(
        "ball",
        i % 2 ? color : "#e4b7ae",
        [Math.cos(j * 1.256) * 0.19, 0, Math.sin(j * 1.256) * 0.19],
        [0.16, 0.09, 0.16],
        flower,
      );
    part("star", gold, [0, 0.06, 0], [0.09, 0.1, 0.09], flower);
    moving(flower, "bounce", 0.18, 2 + i * 0.2);
  }
}
