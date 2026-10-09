// 蛋糕: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  part("cylinder","#cd9d83",[0,.4,0],[.7,.8,.7]);part("cylinder",cream,[0,.83,0],[.72,.12,.72]);for(let i=0;i<6;i++)part("ball","#cf716b",[Math.cos(i)*.5,.96,Math.sin(i)*.5],[.13,.14,.13]);
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "sway", .1);
}
