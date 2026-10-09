// 飞机: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  part("ball",cream,[0,.6,0],[1.2,.28,.28]);part("box",color,[0,.62,0],[.5,.08,2.4]);part("box",color,[-.85,.68,0],[.35,.06,1]);part("cone",color,[-.9,.92,0],[.25,.6,.08]);
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "slide", .18);
}
