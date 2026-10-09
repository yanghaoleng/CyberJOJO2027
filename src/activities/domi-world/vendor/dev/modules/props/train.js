// 小火车: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  part("box",color,[0,.6,0],[2,.45,.8]);part("cylinder",color,[-.4,1,0],[.4,1,.4]).rotation.z=Math.PI/2;part("box",cream,[.6,1.1,0],[.6,.9,.8]);part("cylinder",ink,[-.7,1.5,0],[.14,.4,.14]);wheels();
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "slide", .18);
}
