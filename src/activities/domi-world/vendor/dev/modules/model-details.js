// Small modelling vocabulary for individually authored silhouettes.
export function details(k) {
  const {THREE,part,group,shapes} = k;
  const box=(c,p,s,parent=group)=>part('box',c,p,s,parent);
  const ball=(c,p,s,parent=group)=>part('ball',c,p,s,parent);
  const cylinder=(c,p,s,parent=group)=>part('cylinder',c,p,s,parent);
  const ring=(c,p,r,parent=group)=>part('ring',c,p,[r,r,r],parent);
  function panel(points,depth,color,position=[0,0,0],parent=group) {
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:12});
    geometry.translate(0,0,-depth/2);shapes.set('detail-'+shapes.size,geometry);
    const mesh=box(color,position,[1,1,1],parent);mesh.geometry=geometry;return mesh;
  }
  function pivot(position=[0,0,0]) {const g=new THREE.Group();g.position.set(...position);group.add(g);return g;}
  const bolt=(x,y,z,parent=group)=>ball(k.gold,[x,y,z],[.035,.035,.025],parent);
  return {box,ball,cylinder,ring,panel,pivot,bolt};
}
