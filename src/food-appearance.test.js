import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {foodInstanceLayout,tintFoodMaterial} from './assets-gallery/food-appearance.js';
test('all ten real food assets have tintable edible surfaces while stems and accessories stay original',async()=>{
 globalThis.ProgressEvent??=class{};
 for(const id of ['apple','banana','orange','strawberry','bread','cake','noodles','candy','drink','milk']){
  const bytes=await readFile(new URL(`../public/models/food/${id}.glb`,import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const materials=new Set();gltf.scene.traverse(mesh=>{if(mesh.material)materials.add(mesh.material)});
  let tinted=0;
  for(const material of materials){const original=material.color.getHexString();if(tintFoodMaterial(material,id,'#74b8ee')){tinted++;assert.equal(material.color.getHexString(),'74b8ee')}else assert.equal(material.color.getHexString(),original);}
  assert.ok(tinted>0,`${id} visibly changes color`);
  if(['apple','orange','strawberry'].includes(id))assert.ok(tinted<materials.size,`${id} keeps leaf/stem colors`);
 }
});
test('food quantities stay distinct and bounded in one viewer',()=>{
 for(let count=1;count<=5;count++){const layout=foodInstanceLayout(count);assert.equal(layout.length,count);assert.equal(new Set(layout.map(p=>`${p.x},${p.y}`)).size,count);assert.ok(layout.every(p=>p.scale>0&&p.scale<=1));}
 assert.equal(foodInstanceLayout(Infinity).length,5);assert.equal(foodInstanceLayout(-1).length,1);
});
