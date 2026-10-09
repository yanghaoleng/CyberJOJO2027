import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createPropToolkit} from '../src/activities/domi-world/vendor/dev/modules/props/toolkit.js';
import {build as banana} from '../src/activities/domi-world/vendor/dev/modules/props/banana.js';
import {build as bread} from '../src/activities/domi-world/vendor/dev/modules/props/bread.js';
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.()})}readAsDataURL(b){b.arrayBuffer().then(r=>{this.result=`data:${b.type};base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.()})}};
const manifestURL=new URL('../public/models/food/manifest.json',import.meta.url),manifest=JSON.parse(await readFile(manifestURL,'utf8'));
for(const word of ['banana','bread','orange','strawberry','milk']){
 const group=new THREE.Group(),k=createPropToolkit(group,'#eee6d1');group.name=word;
 if(word==='banana')banana(k);else if(word==='bread')bread(k);
 else if(word==='orange'){k.part('ball','#f3a338',[0,.5,0],[.48,.48,.48]);k.part('cylinder','#876340',[0,1,0],[.04,.16,.04]);k.part('ball','#7fbc69',[.13,1,0],[.18,.045,.09]);}
 else if(word==='strawberry'){const berry=k.part('cone','#e65c72',[0,.5,0],[.43,.9,.43]);berry.rotation.z=Math.PI;for(let i=0;i<6;i++){const a=i*Math.PI/3;const leaf=k.part('ball','#70a660',[Math.sin(a)*.13,.94,Math.cos(a)*.13],[.22,.05,.08]);leaf.rotation.y=-a;}for(let i=0;i<28;i++){const y=.16+i/28*.66,r=.06+y*.35,a=i*2.399;k.part('ball','#f7d288',[Math.sin(a)*r,y,Math.cos(a)*r],[.018,.035,.015]);}}
 else{k.part('cylinder','#c8deed',[0,.48,0],[.3,.85,.3]);k.part('cylinder','#fff6dc',[0,.64,0],[.277,.48,.277]);k.part('cylinder','#e49d82',[0,.95,0],[.3,.08,.3]);k.part('box','#ebf4f6',[0,.43,.3],[.26,.29,.025]);}
 const binary=await new GLTFExporter().parseAsync(group,{binary:true});await writeFile(new URL(`../public/models/food/${word}.glb`,import.meta.url),Buffer.from(binary));let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});const bounds=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());const record={id:word,name:({banana:'香蕉',bread:'面包',orange:'橙子',strawberry:'草莓',milk:'牛奶'})[word],description:'单词泡泡里的独立食物模型',path:`models/food/${word}.glb`,bytes:binary.byteLength,triangles,meshes,materials:k.materials.size,dimensions:bounds.toArray(),format:'GLB',license:['banana','bread'].includes(word)?'Source owner authorized migration; PolyForm Noncommercial':'CC0-1.0'};manifest.models=manifest.models.filter(m=>m.id!==word);manifest.models.push(record);console.log(word,binary.byteLength);
}

await writeFile(manifestURL,JSON.stringify(manifest,null,2)+'\n');
