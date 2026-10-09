// 苹果: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  part("ball","#ce6654",[-.16,.5,0],[.4,.48,.4]);part("ball","#ce6654",[.16,.5,0],[.4,.48,.4]);beam([0,.85,0],[.08,1.2,0],.05,wood);part("ball","#829a61",[.22,1.05,0],[.25,.08,.13]);
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "sway", .1);
}
