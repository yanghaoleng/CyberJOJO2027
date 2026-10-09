// 玩具机器人: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  part("box",color,[0,.65,0],[.65,.7,.4]);part("box",cream,[0,1.2,0],[.7,.4,.5]);for(const x of [-.2,.2]){part("box",ink,[x,.15,0],[.24,.3,.45]);part("ball",ink,[x,1.25,.26],[.06,.06,.03]);}for(const x of [-.5,.5])part("box",color,[x,.7,0],[.2,.6,.3]);
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "sway", .1);
}
