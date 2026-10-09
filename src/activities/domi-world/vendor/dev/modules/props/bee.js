import { details } from '../model-details.js';
export function build(k) {
const {THREE,part,moving,beam,group,shapes,materials}=k;
const {box,ball,cylinder,ring,panel,pivot}=details(k);
const bug=pivot();
ball('#efbf39',[0,.75,0],[.39,.36,.61],bug);for(const z of [-.27,0,.27]){const band=ring('#56452e',[0,.75,z],.34,bug);band.scale.y*=.92;}ball('#edbd42',[0,.85,.63],[.32,.3,.28],bug);
for(const x of [-1,1]){
const hinge=new THREE.Group();hinge.position.set(x*.15,1.02,0);bug.add(hinge);
const wing=ball('#d7e9ed',[x*.32,.04,-.12],[.49,.035,.25],hinge);wing.rotation.y=x*.35;moving(hinge,'sway',.42,14);
for(let i=0;i<3;i++){const leg=box('#655c48',[x*.37,.43,-.28+i*.24],[.035,.58,.035],bug);leg.rotation.z=x*.62;}

}
for(const x of [-.12,.12]){ball('#243d42',[x,.92,.88],[.04,.05,.025],bug);const antenna=box('#655c48',[x,1.19,.64],[.025,.26,.025],bug);antenna.rotation.z=-Math.sign(x)*.25;}
moving(bug,'bounce',.09,2.6);

}
