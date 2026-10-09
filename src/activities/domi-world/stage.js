import * as THREE from 'three';
import { createExtendedCharacter } from './vendor/src/story-npcs/extended-models.js';
import { createDocumentCharacter } from './vendor/src/story-npcs/models.js';
import { createPropToolkit } from './vendor/dev/modules/props/toolkit.js';
import { buildRlineModel } from './vendor/dev/modules/rline-models.js';
import {build as apple} from './vendor/dev/modules/props/apple.js';
import {build as banana} from './vendor/dev/modules/props/banana.js';
export function createStage(host){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#eff3df');
 const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(0,3.5,8.2);camera.lookAt(0,1,0);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth,host.clientHeight);host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','DOMI 立体互动舞台');
 scene.add(new THREE.HemisphereLight('#fff7e3','#879b6a',2.8));const light=new THREE.DirectionalLight('#fff1d4',3);light.position.set(-3,7,5);scene.add(light);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(4.3,4.5,.18,64),new THREE.MeshStandardMaterial({color:'#d8e3b6',roughness:1}));floor.position.y=-.1;scene.add(floor);
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
  renderer.render(scene,camera);frame=requestAnimationFrame(tick);
 }
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);});resize.observe(host);frame=requestAnimationFrame(tick);
 return {play,dispose(){dead=true;cancelAnimationFrame(frame);resize.disconnect();clear();domi.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.domElement.remove();}};
}
