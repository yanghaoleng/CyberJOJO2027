import { details } from '../model-details.js';
export function build(k){
  const {ball,pivot}=details(k),body=pivot();
  const points=[];
  for(let i=0;i<=120;i++){const t=i/120,a=t*Math.PI*5,r=.53*(1-t);points.push(new k.THREE.Vector3(Math.cos(a)*r,.18+t*.96,Math.sin(a)*r));}
  const geo=new k.THREE.TubeGeometry(new k.THREE.CatmullRomCurve3(points),120,.19,10,false);k.shapes.set('poop-coil',geo);
  const coil=ball('#936443',[0,0,0],[1,1,1],body);coil.geometry=geo;
  for(const x of [-.19,.19]){ball(k.cream,[x,.55,.52],[.12,.14,.055],body);ball(k.ink,[x,.56,.57],[.047,.065,.027],body);}
  ball('#cf957e',[0,.32,.59],[.11,.045,.04],body);k.moving(body,'sway',.16);
}
