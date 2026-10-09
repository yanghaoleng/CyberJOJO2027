import * as THREE from 'three';
import { createExtendedCharacter } from './vendor/src/story-npcs/extended-models.js';
import { createDocumentCharacter } from './vendor/src/story-npcs/models.js';
import { createPropToolkit } from './vendor/dev/modules/props/toolkit.js';
import { buildRlineModel } from './vendor/dev/modules/rline-models.js';
import {build as apple} from './vendor/dev/modules/props/apple.js';
import {build as banana} from './vendor/dev/modules/props/banana.js';
export function createStage(host){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#101d2b');
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,3.5,8.2);camera.lookAt(0,1,0);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth,host.clientHeight);host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','DOMI 立体互动舞台');
 scene.add(new THREE.HemisphereLight('#b9d8ec','#1b2937',1.7));const light=new THREE.DirectionalLight('#e5f1ff',2.4);light.position.set(-3,7,5);scene.add(light);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.5,.18,64),new THREE.MeshStandardMaterial({color:'#385951',roughness:1}));floor.position.y=-.1;scene.add(floor);
 const starsGeometry=new THREE.BufferGeometry(),points=[];for(let i=0;i<160;i++){const a=i*2.39996,r=9+(i%7);points.push(Math.cos(a)*r,3+(i%17)*.5,Math.sin(a)*r-6);}starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const stars=new THREE.Points(starsGeometry,new THREE.PointsMaterial({color:'#aacdde',size:.035,transparent:true,opacity:.7}));scene.add(stars);
 // The world stays colourful under a night sky; scenery leaves the central play area open.
 const terrain=new THREE.Group();terrain.name='domi-planet-landscape';scene.add(terrain);
 const landscape=createPropToolkit(terrain,'#8aaf86');
 for(const [x,z,r,color] of [[-2,-1.4,1.15,'#497d71'],[2,-1.5,1.2,'#706a94'],[-2.7,1,.8,'#5a8292'],[2.6,.6,.7,'#ad9260']]){
  const mesh=new THREE.Mesh(new THREE.CircleGeometry(r,48),new THREE.MeshStandardMaterial({color,roughness:1}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.004,z);terrain.add(mesh);landscape.shapes.set('patch-'+x,mesh.geometry);landscape.materials.set('patch-'+x,mesh.material);
 }
 for(const [x,z,color,h] of [[-2.4,-1.9,'#71927e',.45],[2.5,-2,'#86799d',.55],[.5,-3.1,'#7b9478',.35]])landscape.part('ball',color,[x,h*.25,z],[.95,h,.75]);
 const tree=new THREE.Group();terrain.add(tree);tree.position.set(-1.65,0,-1.4);tree.scale.setScalar(.75);const treeKit=createPropToolkit(tree,'#91ae7f');buildRlineModel(treeKit,'tree');
 for(const [x,z,scale] of [[1.55,-.8,.6],[1.9,-.5,.38],[-1.45,1.4,.32]]){landscape.part('cylinder','#b9b89a',[x,.2*scale,z],[.13*scale,.5*scale,.13*scale]);landscape.part('ball','#cc947e',[x,.46*scale,z],[.45*scale,.22*scale,.4*scale]);for(const dx of [-.15,.12])landscape.part('ball','#f1d7b4',[x+dx*scale,.62*scale,z+.1*scale],[.045*scale,.025*scale,.045*scale]);}
 for(const [x,z,color] of [[-1.55,-.2,'#7dcac2'],[1.55,1.25,'#bc9cce'],[1.2,-3,'#efc47b']]){const crystal=landscape.part('cone',color,[x,.27,z],[.18,.54,.18]);crystal.material.emissive.set(color);crystal.material.emissiveIntensity=.28;crystal.rotation.z=.12;}
 const windmill=new THREE.Group();terrain.add(windmill);windmill.position.set(1.5,0,-2.1);landscape.part('cone','#c1b4a2',[0,.45,0],[.22,.9,.22],windmill);const blades=new THREE.Group();blades.position.set(0,1, .18);windmill.add(blades);landscape.part('ball','#e2c489',[0,0,.03],[.085,.085,.085],blades);for(let i=0;i<4;i++){const wing=new THREE.Group();wing.rotation.z=i*Math.PI/2;blades.add(wing);landscape.part('box',i%2?'#9bbeb0':'#d7b783',[0,.25,0],[.1,.45,.045],wing);}
 const domi=createExtendedCharacter({characterId:'domi',scale:1});scene.add(domi.group);
 let prop=null,friend=null,command=null,at=0,frame,dead=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function clear(){if(prop){scene.remove(prop.group);for(const g of prop.k.shapes.values())g.dispose();for(const m of prop.k.materials.values())m.dispose();prop=null;}if(friend){scene.remove(friend.group);friend.dispose();friend=null;}domi.group.position.set(0,0,0);domi.group.rotation.set(0,0,0);domi.group.scale.setScalar(1);}
 function play(cmd){clear();command=cmd;at=performance.now();host.dataset.action=cmd.action;host.dataset.word=cmd.word;
  if(cmd.action==='dance'||cmd.action==='handshake'){friend=createDocumentCharacter({characterId:{jojo:'jiaojiao',cat:'lingdang',pig:'zhuxiaodi'}[cmd.word],scale:.85});scene.add(friend.group);friend.group.position.x=1.35;domi.group.position.x=-1.15;friend.setAction(cmd.action==='dance'?'dance':'wave');domi.setAction(cmd.action==='handshake'?'handshake':'wave');}
  else {const group=new THREE.Group(),k=createPropToolkit(group,'#d78d65');if(cmd.word==='apple')apple(k);else if(cmd.word==='banana')banana(k);else buildRlineModel(k,cmd.word==='airplane'?'jet':cmd.word);prop={group,k};scene.add(group);group.position.set(1.5,0,.3);group.scale.setScalar(cmd.action==='eat'?.75:1);domi.setAction(cmd.action==='eat'?'talk':'drive');}
 }
 function tick(now){if(dead)return;const t=now/1000,u=(now-at)/1000;domi.update(t,.016);friend?.update(t,.016);
  if(command?.action==='eat'&&prop){const f=Math.min(1,u/1.6);prop.group.position.set(1.5*(1-f),1.2*f,.8*f);prop.group.scale.setScalar(.75*(1-Math.min(1,Math.max(0,u-1.8)/1.2)));if(u>3.2)domi.setAction('idle');}
  if(command?.action==='drive'&&prop){const x=reduced.matches?0:Math.sin(u*.9)*1.65;prop.group.position.set(x,0,0);domi.group.position.set(x,.82,.06);domi.group.scale.setScalar(.8);domi.group.rotation.z=reduced.matches?0:Math.sin(u*4)*.035;}
  if(command?.action==='dance'&&!reduced.matches){domi.group.position.y=Math.abs(Math.sin(u*3))*.22;domi.group.rotation.z=Math.sin(u*3)*.12;}
  if(command?.action==='handshake'&&friend){domi.group.position.x=-.65;friend.group.position.x=.65;domi.group.rotation.y=.8;friend.group.rotation.y=-.8;const hand=friend.group.getObjectByName('pig-arm--1');if(hand){hand.rotation.x=-1.3+Math.sin(u*5)*.1;hand.rotation.z=.5;}domi.group.position.y=reduced.matches?0:Math.sin(u*5)*.035;}
  if(!reduced.matches)blades.rotation.z=t*.35;renderer.render(scene,camera);frame=requestAnimationFrame(tick);
 }
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.position.z=Math.max(8.2,5.6/camera.aspect);camera.lookAt(0,1,0);camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(host);frame=requestAnimationFrame(tick);
 return {play,dispose(){dead=true;cancelAnimationFrame(frame);resize.disconnect();clear();domi.dispose();for(const kit of [landscape,treeKit]){for(const g of kit.shapes.values())g.dispose();for(const m of kit.materials.values())m.dispose();}stars.geometry.dispose();stars.material.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.domElement.remove();}};
}
