// Model instances share geometry/materials and one canvas, even for five foods.
export function foodInstanceLayout(count=1) {
 const n=Math.max(1,Math.min(5,Math.floor(Number(count)||1)));
 if(n===1)return [{x:0,y:0,scale:1}];
 if(n===2)return [-.65,.65].map(x=>({x,y:0,scale:.64}));
 if(n===3)return [-.85,0,.85].map(x=>({x,y:0,scale:.44}));
 return Array.from({length:n},(_,i)=>({x:n===4?(i%2-.5)*1.05:((i<3?i:i-3)-(i<3?1:.5))*.84,y:i<(n===4?2:3)?.55:-.55,scale:.43}));
}
const primaryColors={banana:'e8c56e',orange:'f3a338',strawberry:'e65c72',bread:'c99760',milk:'c8deed'};
const primaryNames={apple:/Apple skin/,cake:/Vanilla cream/,noodles:/Soft egg noodles/,drink:/Apricot orange paper carton/,candy:/Butter yellow candy wrapper/};
export function tintFoodMaterial(material,foodId,color) {
 if(!color||!material?.color)return false;
 const primary=primaryNames[foodId]?.test(material.name)||primaryColors[foodId]===material.color.getHexString();
 if(!primary)return false;
 material.color.set(color);material.vertexColors=false;material.needsUpdate=true;return true;
}
