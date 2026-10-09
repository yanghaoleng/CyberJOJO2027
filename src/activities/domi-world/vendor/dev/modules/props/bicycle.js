// 自行车: independent prefab using the shared material and geometry toolkit.
export function build({THREE,group,part,moving,beam,color,cream,wood,gold,ink}) {
  const wheels = () => { for(const x of [-.7,.7])for(const z of [-.46,.46])part("cylinder",ink,[x,.25,z],[.24,.14,.24]).rotation.x=Math.PI/2; };
  for(const x of [-.65,.65])part("ring",ink,[x,.45,0],[.42,.42,.12]);beam([-.65,.45,0],[0,1,0],.05,color);beam([0,1,0],[.65,.45,0],.05,color);beam([-.65,.45,0],[.65,.45,0],.05,color);beam([.65,.45,0],[.55,1.35,0],.05,ink);part("box",wood,[-.1,1.08,0],[.4,.1,.25]);
  // Each prop has a visible activation response on a child pivot, leaving landing independent.
  const pivot = new THREE.Group();
  for(const child of [...group.children]) pivot.add(child);
  group.add(pivot);
  moving(pivot, "slide", .18);
}
