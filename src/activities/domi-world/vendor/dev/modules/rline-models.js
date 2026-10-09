// Authored, recognizable R-line vocabulary miniatures. Geometry belongs to each toolkit.
// Abstract words deliberately use the documented scene symbol from rline-nouns.js.
import { details } from './model-details.js';
import { build as car } from './props/car.js';
import { build as ball } from './props/ball.js';
import { build as robot } from './props/robot-toy.js';
import { build as tree } from './props/tree.js';
import { build as kite } from './props/kite.js';
import { build as bread } from './props/bread.js';
import { build as duck } from './props/duck.js';
import { build as train } from './props/train.js';
import { build as bee } from './props/bee.js';
import { build as garden } from './props/garden.js';
import { build as bike } from './props/bicycle.js';
import { build as top } from './props/top.js';
import { build as cake } from './props/cake.js';
import { build as poop } from './props/poop.js';
import { build as jet } from './props/airplane.js';
const existing = {car,ball,robot,tree,kite,bread,duck,train,bee,garden,bike,top,cake,poop,jet};
export function buildRlineModel(k, word) {
  k.group.userData.rlineWord=word;
  if(existing[word]) return existing[word](k);
  const d=details(k), g=d.pivot();
  const C='#e8a278', B='#7baac1', P='#cd889f', G='#88ab75', Y='#ebc969', W=k.cream, I=k.ink, T=k.wood;
  const sphere=(c,p,s)=>d.ball(c,p,s,g), box=(c,p,s)=>d.box(c,p,s,g), cyl=(c,p,s)=>d.cylinder(c,p,s,g);
  const ring=(c,p,r)=>d.ring(c,p,r,g), panel=(points,c,p=[0,0,0],depth=.1)=>d.panel(points,depth,c,p,g);
  const cone=(c,p,s)=>k.part('cone',c,p,s,g);
  const rod=(a,b,r=.035,c=T)=>{const m=k.beam(a,b,r,c);g.attach(m);return m;};
  const eyes=(x,y,z,size=.045)=>{for(const dx of [-.13,.13])sphere(I,[x+dx,y,z],[size,size,.035]);};
  const curve=(points,c,r=.025)=>{const geo=new k.THREE.TubeGeometry(new k.THREE.CatmullRomCurve3(points.map(p=>new k.THREE.Vector3(...p))),32,r,8,false);k.shapes.set('rline-curve-'+k.shapes.size,geo);const m=sphere(c,[0,0,0],[1,1,1]);m.geometry=geo;return m;};
  const smile=(x,y,z)=>curve([[-.1+x,y+.025,z],[-.055+x,y-.035,z],[x,y-.05,z],[.055+x,y-.035,z],[.1+x,y+.025,z]],I,.012);
  const leaf=(x,y,z,s=1)=>{const l=sphere(G,[x,y,z],[.25*s,.055*s,.13*s]);l.rotation.z=.45;return l;};
  const flower=(x=0,y=.95,z=0)=>{rod([x,.05,z],[x,y,z],.045,G);leaf(x+.18,y*.4,z);for(let n=0;n<6;n++){const a=n*Math.PI/3;sphere(P,[x+Math.cos(a)*.23,y+Math.sin(a)*.23,z],[.17,.17,.09]);}sphere(Y,[x,y,z+.1],[.13,.13,.08]);};
  const book=(x=0,y=.12,z=0)=>{const start=g.children.length;box(P,[x,y,z],[1.05,.15,.75]);box(W,[x,y+.1,z],[.94,.08,.67]);box(I,[x,y+.15,z],[.025,.025,.65]);for(let n=0;n<3;n++)for(const dx of [-.25,.25])box(T,[x+dx,y+.15,z-.2+n*.18],[.28,.015,.022]);const root=new k.THREE.Group();for(const child of g.children.slice(start))root.add(child);g.add(root);return root;};
  const note=(x,y,z)=>{sphere(I,[x,y,z],[.14,.095,.06]);rod([x+.1,y,z],[x+.1,y+.55,z],.035,I);box(I,[x+.22,y+.5,z],[.25,.1,.07]).rotation.z=-.3;};
  const plate=(y=.1)=>{cyl(W,[0,y,0],[.65,.09,.65]);const r=ring(P,[0,y+.055,0],.57);r.rotation.x=Math.PI/2;};
  const wheels=(len=1.4)=>{for(const x of [-len/2,len/2])for(const z of [-.4,.4]){const w=cyl(I,[x,.23,z],[.23,.13,.23]);w.rotation.x=Math.PI/2;sphere(W,[x,.23,z+Math.sign(z)*.08],[.095,.095,.03]);}};
  function person(x=0,scale=1,kind='kid') {
    const start=g.children.length;
    const baby=kind==='baby';const y=baby?.67:1.1;
    sphere(C,[0,y,0],[.28,.31,.25]);eyes(0,y+.02,.23,.035);smile(0,y-.11,.24);
    sphere(kind==='cop'?B:kind==='vet'?W:kind==='mum'||kind==='grandma'?P:G,[0,baby?.33:.6,0],[.28,baby?.22:.32,.2]);
    for(const dx of [-.12,.12]){box(B,[dx,.2,0],[.14,.36,.14]);sphere(I,[dx,.06,.08],[.12,.065,.19]);rod([dx*2,.75,0],[dx*3,.43,.04],.07,C);}
    if(kind==='baby'){sphere(W,[0,.56,.25],[.11,.1,.07]);sphere(Y,[0,.56,.31],[.065,.06,.035]);}
    else if(kind==='grandpa'||kind==='grandma') {for(const dx of [-.13,.13])ring(I,[dx,y+.03,.265],.09);rod([-.04,y+.03,.265],[.04,y+.03,.265],.017,I);sphere(W,[0,y+.2,-.08],[.29,.15,.24]);if(kind==='grandma')sphere(W,[.23,y+.23,-.08],[.14,.14,.13]);else rod([.38,.6,.12],[.38,.07,.12],.032,T);}
    else {sphere(kind==='sid'?'#ba734c':T,[0,y+.2,-.045],[.28,.15,.25]);if(['mum','sister','doll'].includes(kind))for(const dx of [-.27,.27])sphere(T,[dx,y-.08,-.05],[.12,.24,.13]);}
    if(kind==='cop'){cyl(B,[0,y+.3,0],[.3,.12,.29]);box(I,[0,y+.25,.22],[.42,.05,.24]);sphere(Y,[0,.7,.2],[.065,.07,.03]);}
    if(kind==='vet'){box(P,[0,.68,.2],[.055,.19,.04]);box(P,[0,.68,.2],[.18,.055,.04]);}
    if(kind==='ben'){cone(Y,[0,y+.42,0],[.23,.26,.23]);}
    if(kind==='doll'){panel([[-.38,.26],[.38,.26],[.2,.7],[-.2,.7]],P,[0,0,0],.3);}
    const p=new k.THREE.Group();for(const m of g.children.slice(start))p.add(m);g.add(p);p.scale.setScalar(scale);p.position.x=x;return p;
  }
  function animal(kind) {
    const bearLike=['bear','teddy','ted','cub'].includes(kind), rabbit=['rabbit','bunny'].includes(kind), birdLike=['bird','hen'].includes(kind), pig=kind==='pig', frog=kind==='frog', fox=kind==='fox', rat=kind==='rat';
    const color=pig?P:frog?G:fox?'#d48c57':rabbit?W:bearLike?T:birdLike?Y:rat?'#969baa':B;
    const short=['cub','pup','bunny'].includes(kind);
    sphere(color,[0,.44,0],[.35,.38,.46]);sphere(color,[0,.91,.17],[.32,.32,.29]);if(!frog)eyes(0,.98,.435);
    if(rabbit){for(const x of [-.17,.17]){sphere(color,[x,1.4,.13],[.12,.4,.1]);sphere(P,[x,1.43,.215],[.055,.26,.03]);}sphere(W,[0,.47,-.46],[.18,.18,.18]);}
    else if(birdLike){cone(C,[0,.89,.52],[.14,.26,.14]).rotation.x=Math.PI/2;for(const side of [-1,1]){const wing=new k.THREE.Group();wing.name=`wing-${side}`;wing.position.set(side*.28,.66,0);g.add(wing);const mesh=sphere(color,[0,0,0],[.14,.27,.39]);wing.add(mesh);mesh.position.set(side*.08,-.12,0);k.moving(wing,'flap',side*.5,4);}for(const x of [-.14,.14]){rod([x,.22,0],[x,.05,.15],.04,C);for(const dx of [-.08,.08])rod([x,.05,.15],[x+dx,.045,.28],.025,C);}if(kind==='hen')for(let n=0;n<3;n++)sphere(P,[0,1.23,.02+n*.12],[.08,.13,.09]);}
    else if(frog){for(const x of [-.22,.22]){sphere(G,[x,1.13,.18],[.16,.19,.15]);sphere(W,[x,1.18,.29],[.095,.1,.035]);sphere(I,[x,1.18,.32],[.04,.05,.02]);sphere(G,[x*1.7,.18,0],[.25,.2,.32]);}box(P,[0,.81,.43],[.27,.035,.03]);}
    else {for(const x of [-.23,.23]){if(fox||kind==='cat')cone(color,[x,1.23,.1],[.15,.3,.13]);else if(pig)cone(color,[x,1.21,.1],[.14,.25,.11]);else if(['dog','pup','pet'].includes(kind))sphere(color,[x*1.3,1.02,.07],[.13,.29,.13]);else sphere(color,[x,1.18,.1],[bearLike||rat?.16:.13,bearLike||rat?.16:.24,.12]);}for(const x of [-.23,.23])for(const z of [-.24,.24])sphere(color,[x,.12,z],[.11,.17,.15]);sphere(pig?P:W,[0,.81,.45],[pig?.21:.17,.12,.14]);if(pig){for(const x of [-.07,.07])sphere(I,[x,.82,.58],[.03,.04,.02]);}else sphere(I,[0,.85,.58],[.06,.045,.035]);
      if(fox||kind==='cat'||rat){const t=sphere(color,[.18,.43,-.58],[fox?.18:.065,fox?.19:.07,.41]);t.rotation.x=.65;if(fox)sphere(W,[.18,.64,-.84],[.12,.14,.17]);}
      if(['dog','pup','pet'].includes(kind)){const collar=ring(P,[0,.65,.11],.26);collar.rotation.x=Math.PI/2;sphere(Y,[0,.62,.38],[.055,.07,.03]);}
      if(['ted','teddy'].includes(kind)){box(P,[0,.67,.35],[.29,.08,.05]);sphere(W,[0,.4,.4],[.2,.22,.045]);}
    }
    if(short)g.scale.setScalar(.72);
  }
  if(['dad','mum','baby','grandpa','grandma','sister','cousin','doll','ben','vet','kid','sid','cop'].includes(word)) person(0,({dad:1.08,mum:1.04,sister:.78,cousin:.83,kid:.75,ben:.82,sid:.84,doll:.7})[word]||1,word);
  else if(word==='family'){person(-.45,.85,'dad');person(.45,.85,'mum');person(0,.5,'kid');}
  else if(['bear','cat','bird','dog','bunny','rabbit','rat','teddy','ted','pet','hen','pig','frog','fox','pup','cub'].includes(word))animal(word);
  else if(['ant','bug'].includes(word)){
    for(let i=0;i<3;i++)sphere(word==='ant'?T:P,[0,.38,i*.26-.26],[.2-i*.025,.18,.24]);eyes(0,.45,.45,.03);
    for(let i=0;i<3;i++)for(const s of [-1,1]){rod([s*.1,.38,i*.2-.2],[s*.4,.18,i*.2-.25],.03,I);rod([s*.4,.18,i*.2-.25],[s*.5,.02,i*.2-.16],.025,I);}
    for(const s of [-1,1])rod([s*.08,.51,.34],[s*.18,.76,.43],.024,I);
    if(word==='bug'){sphere(P,[0,.47,-.12],[.28,.15,.37]);for(const s of [-1,1])for(const z of [-.25,0])sphere(I,[s*.15,.59,z],[.06,.025,.06]);}
  }
  else if(word==='alligator'){
    sphere(G,[0,.35,0],[.38,.27,.7]);sphere(G,[0,.48,.64],[.27,.19,.5]);box(W,[0,.43,.85],[.48,.07,.58]);eyes(0,.64,.63,.06);cone(G,[0,.22,-.95],[.3,.8,.2]).rotation.x=-Math.PI/2;
    for(const x of [-.4,.4])for(const z of [-.4,.3])sphere(G,[x,.12,z],[.23,.1,.2]);for(let i=0;i<4;i++)cone(Y,[0,.65,-.5+i*.25],[.1,.17,.1]);
  }
  else if(word==='monster'){sphere(G,[0,.55,0],[.52,.5,.38]);for(const x of [-.3,.3]){sphere(W,[x,.9,.27],[.18,.21,.08]);sphere(I,[x,.92,.35],[.065,.09,.025]);cone(P,[x,1.15,0],[.12,.32,.12]);sphere(G,[x*1.8,.5,0],[.17,.14,.17]);sphere(Y,[x,.1,.12],[.2,.11,.25]);}box(W,[0,.45,.37],[.27,.14,.07]);}
  else if(['head','face','hair','belly','body'].includes(word)){
    // Body is a headless, limbless torso base: chapters attach head/hand/foot separately.
    if(word==='body'){sphere(G,[0,.5,0],[.3,.5,.235]);sphere(W,[0,.44,.22],[.17,.22,.035]);sphere(P,[0,.43,.256],[.028,.028,.012]);}
    else if(word==='belly'){sphere(C,[0,.5,0],[.48,.5,.28]);sphere(P,[0,.5,.265],[.24,.3,.045]);sphere(T,[0,.44,.315],[.035,.035,.02]);}
    // Independent hair tufts form a shallow cap, with no face or head underneath.
    else if(word==='hair'){for(let i=0;i<7;i++)sphere(T,[(i-3)*.115,.26-Math.abs(i-3)*.02,0],[.115,.19,.34]);}
    else {sphere(C,[0,.55,0],[.43,.5,word==='face'?.12:.35]);eyes(0,.65,word==='face'?.13:.34,.055);smile(0,.39,word==='face'?.14:.35);}
  }
  else if(word==='hand'){sphere(C,[0,.42,0],[.25,.32,.11]);for(let i=0;i<4;i++)sphere(C,[(i-1.5)*.13,.87-Math.abs(i-1.5)*.06,0],[.056,.28,.08]);sphere(C,[-.31,.51,0],[.13,.07,.08]).rotation.z=.55;}
  else if(['foot','feet','leg'].includes(word)){
    for(const x of word==='feet'?[-.26,.26]:[0]){sphere(C,[x,.13,.13],[.18,.14,.39]);cyl(C,[x,word==='leg'?.61:.33,-.1],[.13,word==='leg'?.9:.35,.13]);for(let i=0;i<5;i++)sphere(C,[x+(i-2)*.07,.12,.43-Math.abs(i-2)*.025],[.04,.06,.065]);}
  }
  else if(word==='eye'){sphere(W,[0,.52,0],[.5,.37,.23]);sphere(B,[0,.52,.22],[.23,.25,.09]);sphere(I,[0,.52,.31],[.11,.15,.04]);sphere(W,[-.07,.6,.35],[.055,.06,.02]);}
  else if(word==='ear'){sphere(C,[0,.57,0],[.3,.48,.13]);sphere(P,[0,.6,.13],[.17,.31,.05]);sphere(C,[-.06,.42,.2],[.11,.14,.055]);}
  else if(word==='nose'){panel([[-.26,.2],[.27,.2],[.09,.9],[-.05,.95]],C,[0,0,0],.3);for(const x of [-.13,.13])sphere(I,[x,.25,.17],[.055,.04,.035]);}
  else if(word==='mouth'||word==='lip'){sphere(P,[0,.47,0],[.5,.21,.13]);sphere(I,[0,.47,.12],[.38,.12,.03]);if(word==='mouth'){box(W,[0,.54,.15],[.54,.07,.04]);sphere(C,[0,.39,.16],[.17,.055,.03]);}}
  else if(word==='tail'){const points=[];for(let i=0;i<32;i++){const t=i/31;points.push(new k.THREE.Vector3(Math.sin(t*4)*.35,.08+t,0));}const geo=new k.THREE.TubeGeometry(new k.THREE.CatmullRomCurve3(points),32,.11,8,false);k.shapes.set('rline-tail',geo);const m=sphere(C,[0,0,0],[1,1,1]);m.geometry=geo;}
  else if(word==='lap'){person();for(const x of [-.17,.17]){box(Y,[x,.45,.3],[.22,.18,.55]);box(B,[x,.23,.5],[.14,.4,.15]);}box(T,[0,.36,-.05],[.64,.08,.5]);}
  else if(word==='fin'){panel([[-.45,.12],[.45,.12],[.1,.95]],B,[0,0,0],.15);for(let i=0;i<4;i++)rod([-.35+i*.2,.15,.09],[.1,.85-i*.1,.09],.018,W);}
  else if(word==='mane'){for(let i=0;i<12;i++){const a=i*Math.PI/6;sphere(T,[Math.cos(a)*.4,.65+Math.sin(a)*.4,0],[.21,.23,.15]);}sphere(Y,[0,.65,.12],[.31,.33,.13]);eyes(0,.73,.25);sphere(W,[0,.52,.26],[.16,.11,.05]);}
  else if(word==='flower')flower();
  else if(word==='shell'){const pts=[[0,.1]];for(let i=0;i<=16;i++){const a=i*Math.PI/16;pts.push([Math.cos(a)*.55,.2+Math.sin(a)*.6]);}panel(pts,P,[0,0,0],.16);for(let i=0;i<7;i++){const a=(i+1)*Math.PI/8;rod([0,.13,.11],[Math.cos(a)*.5,.2+Math.sin(a)*.54,.11],.018,W);}}
  else if(word==='water'||word==='wave'||word==='bay'){
    cyl(B,[0,.07,0],[.8,.1,.65]);for(let i=0;i<3;i++){const r=ring(W,[(i-1)*.35,.16,i%2*.18],.25);r.rotation.x=Math.PI/2;r.scale.z*=.5;}
    if(word==='wave'){panel([[-.6,.12],[.57,.12],[.4,.28],[.18,.31],[.16,.5],[.35,.63],[.2,.82],[-.1,.84],[-.34,.65],[-.46,.34]],B,[0,0,0],.26);curve([[-.3,.68,.16],[-.12,.8,.16],[.11,.79,.16],[.25,.68,.16]],W,.045);}
    if(word==='bay'){const r=ring(Y,[0,.08,-.08],.72);r.rotation.x=Math.PI/2;box(B,[0,.15,.52],[1.7,.14,.55]);flower(-.57,.65,-.26);}
  }
  else if(word==='yarn'){sphere(P,[0,.4,0],[.39,.38,.38]);for(let n=0;n<6;n++){const r=ring(W,[0,.4,0],.405);r.rotation.y=n*.5;}rod([.2,.13,.1],[.62,.08,.35],.035,P);}
  else if(word==='log'){const l=cyl(T,[0,.35,0],[.34,1.3,.34]);l.rotation.z=Math.PI/2;for(const x of [-.66,.66]){const r=ring(W,[x,.35,0],.23);r.rotation.y=Math.PI/2;const r2=ring(Y,[x,.35,0],.13);r2.rotation.y=Math.PI/2;}}
  else if(word==='mud'){sphere(T,[0,.1,0],[.7,.12,.53]);for(let n=0;n<5;n++)sphere(T,[(n-2)*.23,.16,Math.sin(n)*.25],[.19,.1,.17]);}
  else if(word==='grass'){for(let n=0;n<15;n++){const x=(n%5-2)*.15,z=(Math.floor(n/5)-1)*.2;const a=cone(G,[x,.3+Math.sin(n)*.09,z],[.06,.6,.04]);a.rotation.z=Math.sin(n)*.35;}}
  else if(word==='hay'){box(Y,[0,.27,0],[1,.46,.57]);for(let n=0;n<15;n++)rod([-.55,.1+(n%5)*.085,(Math.floor(n/5)-1)*.23],[.55,.1+(n%5)*.085,(Math.floor(n/5)-1)*.23],.025,W);for(const x of [-.25,.25]){rod([x,.51,-.31],[x,.51,.31],.023,T);rod([x,.02,-.31],[x,.02,.31],.023,T);for(const z of [-.31,.31])rod([x,.02,z],[x,.51,z],.023,T);}}
  else if(word==='seed'){sphere(T,[0,.2,0],[.23,.18,.32]);box(W,[0,.35,0],[.035,.025,.28]);rod([0,.3,0],[0,.62,0],.025,G);leaf(.12,.6,0,.6);}
  else if(word==='sun'){sphere(Y,[0,.65,0],[.39,.39,.12]);for(let n=0;n<10;n++){const a=n*Math.PI/5;rod([Math.cos(a)*.5,.65+Math.sin(a)*.5,0],[Math.cos(a)*.65,.65+Math.sin(a)*.65,0],.04,Y);}eyes(0,.69,.13);}
  else if(word==='rain'){for(const x of [-.3,0,.3])sphere(W,[x,1,0],[.29,.2,.17]);for(let n=0;n<6;n++)sphere(B,[(n%3-1)*.3,.28+Math.floor(n/3)*.3,0],[.04,.12,.04]);}
  else if(word==='pit'){const r=ring(T,[0,.15,0],.61);r.rotation.x=Math.PI/2;cyl(I,[0,.09,0],[.54,.07,.54]);for(const x of [-.6,.6])sphere(T,[x,.12,.1],[.15,.13,.2]);}
  else if(word==='cave'){sphere(T,[0,.48,0],[.78,.55,.36]);sphere(I,[0,.32,.34],[.43,.36,.06]);for(const x of [-.59,.59])sphere(T,[x,.22,.4],[.2,.22,.23]);}
  else if(word==='snail'){sphere(G,[0,.16,0],[.62,.16,.23]);sphere(Y,[-.1,.52,0],[.39,.39,.22]);for(const r of [.27,.16,.06])ring(T,[-.1,.52,.23],r);for(const z of [-.12,.12]){rod([.45,.22,z],[.55,.57,z],.035,G);sphere(W,[.55,.58,z],[.085,.09,.085]);sphere(I,[.6,.6,z+.05],[.03,.035,.03]);}}
  else if(word==='van'||word==='jeep'){wheels();box(word==='van'?W:G,[0,.65,0],[1.7,.68,.73]);box(B,[.63,.8,.375],[.32,.3,.03]);for(const x of [-.1,-.55])box(B,[x,.86,.375],[.29,.26,.035]);if(word==='jeep'){box(I,[.2,1.03,0],[.9,.08,.8]);ring(I,[-.87,.62,0],.27).rotation.y=Math.PI/2;}}
  else if(word==='ship'){sphere(B,[0,.27,0],[.85,.25,.38]);box(W,[0,.59,0],[.8,.46,.48]);for(const x of [-.27,0,.27])sphere(I,[x,.61,.25],[.075,.075,.025]);cyl(I,[-.2,.96,0],[.12,.35,.12]);rod([.24,.75,0],[.24,1.28,0],.025);panel([[0,0],[.32,-.1],[0,-.2]],P,[.24,1.25,0]);}
  else if(word==='sled'){for(const x of [-.42,.42]){rod([x,.09,-.6],[x,.09,.5],.055,I);rod([x,.09,.5],[x,.3,.7],.055,I);}for(let n=0;n<5;n++)box(T,[0,.3,(n-2)*.22],[.9,.1,.16]);for(const x of [-.35,.35])rod([x,.1,-.4],[x,.3,-.4],.04,I);}
  else if(word==='food'||word==='snack'){plate();if(word==='food'){sphere(Y,[-.19,.29,0],[.28,.16,.3]);leaf(.3,.25,.1);sphere(P,[.3,.22,-.15],[.18,.15,.16]);}else for(let n=0;n<3;n++){cyl(Y,[(n-1)*.3,.21+Math.abs(n-1)*.03,0],[.19,.1,.19]);for(let j=0;j<3;j++)sphere(T,[(n-1)*.3+Math.cos(j*2.1)*.1,.29,Math.sin(j*2.1)*.1],[.025,.02,.025]);}}
  else if(word==='drink'){cyl(B,[0,.44,0],[.29,.75,.29]);cyl(P,[0,.82,0],[.24,.03,.24]);rod([.12,.65,0],[.2,1.2,0],.03,Y);}
  else if(word==='candy'){sphere(P,[0,.4,0],[.32,.18,.18]);for(const x of [-.42,.42]){const c=cone(Y,[x,.4,0],[.23,.27,.23]);c.rotation.z=Math.PI/2;}}
  else if(word==='ham'||word==='meat'||word==='rib'){sphere(P,[0,.34,0],[.48,.27,.3]);if(word==='ham'){cyl(W,[.4,.35,0],[.21,.03,.21]).rotation.z=Math.PI/2;rod([.4,.35,0],[.76,.35,0],.055,W);for(const z of [-.06,.06])sphere(W,[.78,.35,z],[.09,.08,.08]);}else if(word==='rib'){for(const x of [-.3,-.1,.1,.3])rod([x,.43,-.2],[x,.44,.34],.055,W);}else{const r=ring(W,[0,.36,.28],.12);r.scale.y*=.6;}}
  else if(word==='jam'||word==='honey'){cyl(word==='jam'?P:Y,[0,.37,0],[.31,.6,.31]);cyl(T,[0,.71,0],[.34,.09,.34]);box(W,[0,.4,.31],[.4,.24,.02]);if(word==='jam'){sphere(P,[0,.42,.34],[.11,.1,.025]);leaf(0,.54,.34,.4);}else for(let n=0;n<3;n++)box(T,[(n-1)*.055,.42,.34],[.025,.12,.025]);}
  else if(word==='fig'){sphere(P,[0,.38,0],[.3,.35,.28]);cone(P,[0,.69,0],[.14,.27,.13]);sphere('#dc9999',[0,.38,.25],[.21,.25,.05]);for(let n=0;n<7;n++)sphere(Y,[Math.sin(n*2)*.13,.36+Math.cos(n*2)*.18,.3],[.025,.025,.01]);}
  else if(word==='nut'){sphere(T,[0,.36,0],[.3,.34,.26]);rod([0,.05,.25],[0,.67,.16],.025,Y);for(const x of [-.14,.14]){const r=ring(Y,[x,.36,.235],.09);r.scale.y*=2;}}
  else if(word==='cut'){sphere(P,[0,.32,0],[.34,.3,.3]);box(W,[0,.33,.16],[.035,.61,.42]);box(I,[0,.36,.31],[.035,.35,.025]);leaf(.1,.65,0,.6);}
  else if(word==='toy'){box(P,[-.3,.22,0],[.4,.4,.4]);box(Y,[.08,.62,0],[.38,.38,.38]);sphere(B,[.42,.24,.1],[.23,.23,.23]);}
  else if(['hat','cap'].includes(word)){cyl(Y,[0,.15,0],[.6,.09,.49]);if(word==='hat'){cyl(P,[0,.42,0],[.34,.48,.34]);cyl(I,[0,.24,0],[.35,.12,.35]);}else{sphere(B,[0,.29,-.05],[.4,.27,.37]);box(B,[0,.17,.4],[.6,.07,.5]);}}
  else if(word==='glasses'){for(const x of [-.28,.28]){ring(I,[x,.43,0],.25);rod([x*1.8,.43,0],[x*1.8,.43,-.55],.035,I);}rod([-.06,.43,0],[.06,.43,0],.035,I);}
  else if(word==='bow'){for(const x of [-.26,.26]){const c=cone(P,[x,.38,0],[.28,.4,.13]);c.rotation.z=x<0?-Math.PI/2:Math.PI/2;}sphere(Y,[0,.38,.04],[.1,.12,.1]);for(const x of [-.12,.12])box(P,[x,.16,0],[.15,.32,.07]).rotation.z=x*2;}
  else if(word==='wig'){for(let n=0;n<7;n++){const a=n*Math.PI/6;sphere(P,[Math.cos(a)*.35,.55+Math.sin(a)*.32,0],[.15,.28,.25]);}for(const x of [-.36,.36])sphere(P,[x,.3,0],[.17,.3,.21]);}
  else if(['skirt','dress','coat','cape'].includes(word)){
    if(word==='skirt')panel([[-.55,.08],[.55,.08],[.26,.75],[-.26,.75]],P,[0,0,0],.25);
    else if(word==='cape'){panel([[-.6,.08],[.6,.08],[.16,1.12],[-.16,1.12]],P,[0,0,0],.13);sphere(Y,[0,1.05,.1],[.08,.07,.04]);}
    else {panel([[-.47,.1],[.47,.1],[.28,.65],[.3,1],[-.3,1],[-.28,.65]],word==='coat'?B:P,[0,0,0],.23);for(const x of [-.4,.4])box(word==='coat'?B:P,[x,.77,0],[.23,.47,.22]).rotation.z=-x;if(word==='coat')for(let n=0;n<4;n++)sphere(Y,[0,.3+n*.16,.13],[.035,.035,.02]);}
  }
  else if(word==='bat'){cyl(T,[0,.69,0],[.14,1,.14]);cyl(I,[0,.18,0],[.065,.35,.065]);}
  else if(word==='tool'){rod([0,.06,0],[0,.9,0],.065,T);box(I,[0,1,0],[.65,.22,.23]);box(I,[.37,1,0],[.18,.16,.23]).rotation.z=.3;}
  else if(word==='box'||word==='bin'){const c=word==='box'?Y:B;box(c,[0,.055,0],[.85,.08,.65]);box(I,[0,.102,0],[.72,.018,.52]);for(const x of [-.395,.395])box(c,[x,.34,0],[.06,.56,.65]);for(const z of [-.295,.295])box(c,[0,.34,z],[.73,.56,.06]);for(const x of [-.43,.43])box(word==='box'?Y:B,[x,.7,0],[.32,.035,.65]).rotation.z=x<0?-.6:.6;if(word==='bin')box(W,[0,.35,.34],[.3,.09,.02]);}
  else if(word==='book'||word==='story'){book();if(word==='story'){cone(B,[-.24,.48,-.05],[.18,.5,.18]);sphere(Y,[.22,.55,0],[.16,.16,.12]);}}
  else if(['blanket','rag','mat','rug'].includes(word)){box(word==='rag'?W:P,[0,.05,0],[word==='rag'?.7:1.3,.08,word==='blanket'?1.05:.75]);for(let n=0;n<5;n++)box(word==='rag'?B:Y,[(n-2)*(word==='rag'?.12:.24),.095,0],[.04,.015,word==='blanket'?1.04:.72]);if(word==='rug')for(let n=0;n<7;n++)for(const z of [-.44,.44])rod([(n-3)*.18,.06,z-.07],[(n-3)*.18,.06,z+.07],.018,W);}
  else if(word==='bell'){cone(Y,[0,.5,0],[.45,.62,.45]);cyl(Y,[0,.2,0],[.48,.09,.48]);sphere(I,[0,.14,0],[.1,.13,.1]);ring(T,[0,.9,0],.14);}
  else if(word==='bottle'){cyl(G,[0,.4,0],[.25,.6,.25]);sphere(G,[0,.69,0],[.24,.18,.24]);cyl(G,[0,.86,0],[.11,.25,.11]);cyl(Y,[0,1.01,0],[.13,.09,.13]);box(W,[0,.42,.25],[.27,.23,.03]);}
  else if(word==='pot'||word==='pan'){cyl(I,[0,.26,0],[.49,word==='pot'?.43:.15,.49]);cyl(T,[0,word==='pot'?.485:.345,0],[.43,.025,.43]);if(word==='pot')for(const x of [-.56,.56])ring(I,[x,.35,0],.13).rotation.y=Math.PI/2;else box(T,[.78,.28,0],[.65,.09,.12]);}
  else if(word==='band'){cyl(P,[-.35,.3,0],[.28,.48,.28]);cyl(W,[-.35,.55,0],[.28,.025,.28]);sphere(Y,[.38,.37,0],[.22,.28,.09]);box(T,[.38,.88,0],[.08,.72,.06]);rod([0,.02,-.28],[0,1.1,-.28],.03,I);sphere(I,[0,1.12,-.28],[.08,.15,.08]);}
  else if(word==='music'||word==='pop'){if(word==='music'){for(let i=0;i<7;i++)box(W,[(i-3)*.15,.14,.12],[.13,.19,.55]);for(let i=0;i<5;i++)box(I,[(i-2)*.15,.26,-.06],[.07,.06,.22]);}else{cyl(I,[0,.12,0],[.6,.07,.6]);cyl(P,[0,.16,0],[.2,.02,.2]);}note(-.22,.65,0);note(.35,.9,0);}
  else if(['card','pad','map','mail','name','day'].includes(word)){
    box(word==='card'?P:W,[0,.46,0],[.88,.64,.065]);
    if(word==='map'){rod([-.3,.25,.05],[.1,.62,.05],.025,B);rod([.1,.62,.05],[.3,.4,.05],.025,B);for(const x of [-.27,.28])cone(G,[x,.56,.055],[.1,.17,.025]);}
    else if(word==='mail'){rod([-.4,.73,.05],[0,.42,.05],.02,T);rod([.4,.73,.05],[0,.42,.05],.02,T);box(P,[.29,.67,.05],[.13,.12,.02]);}
    else if(word==='day'){box(P,[0,.78,0],[.88,.12,.09]);for(const x of [-.25,.25])ring(I,[x,.87,0],.08);box(I,[0,.45,.05],[.06,.27,.02]);sphere(Y,[.28,1.08,0],[.15,.15,.05]);}
    else if(word==='name'){sphere(B,[-.24,.46,.05],[.12,.14,.025]);for(let i=0;i<2;i++)box(I,[.14,.55-i*.14,.05],[.3,.035,.02]);rod([-.32,.8,0],[0,1.1,0],.02,P);rod([0,1.1,0],[.32,.8,0],.02,P);}
    else {for(let i=0;i<3;i++)box(T,[0,.62-i*.15,.05],[.58,.025,.02]);if(word==='pad')for(let i=0;i<5;i++)ring(I,[(i-2)*.16,.78,0],.055);else sphere(Y,[.26,.67,.07],[.08,.08,.025]);}
  }
  else if(word==='can'){cyl(B,[0,.44,0],[.3,.76,.3]);cyl(W,[0,.83,0],[.3,.045,.3]);ring(I,[0,.86,0],.09).rotation.x=Math.PI/2;box(Y,[0,.46,.3],[.29,.3,.03]);}
  else if(word==='bag'){box(P,[0,.4,0],[.75,.66,.28]);ring(T,[0,.82,0],.21);box(Y,[0,.39,.16],[.23,.16,.025]);}
  else if(word==='bed'||word==='cot'){box(T,[0,.3,0],[.85,.2,1.35]);box(W,[0,.44,0],[.79,.14,1.26]);box(B,[0,.54,.24],[.79,.08,.75]);sphere(W,[0,.58,-.46],[.33,.12,.19]);for(const x of [-.38,.38])for(const z of [-.62,.62])box(T,[x,.25,z],[.08,.5,.08]);box(T,[0,.68,-.67],[.85,.6,.08]);if(word==='cot')for(const x of [-.45,.45]){for(let n=0;n<6;n++)box(T,[x,.75,(n-2.5)*.23],[.045,.72,.04]);box(T,[x,1.12,0],[.07,.07,1.4]);}}
  else if(word==='net'){rod([0,.08,0],[0,.72,0],.045,T);ring(B,[0,1,0],.35);for(let n=-2;n<=2;n++){const x=n*.11,h=Math.sqrt(.11-x*x);rod([x,1-h,0],[x,1+h,0],.012,W);rod([-h,1+x,0],[h,1+x,0],.012,W);}}
  else if(word==='pen'||word==='tip'){cyl(B,[0,.55,0],[.065,.75,.065]);cone(T,[0,1.03,0],[.067,.22,.067]);cone(I,[0,1.16,0],[.026,.065,.026]);if(word==='tip'){ring(Y,[0,1.16,0],.19);rod([.2,1.15,0],[.5,1.15,0],.03,Y);}}
  else if(word==='desk'||word==='seat'){box(T,[0,word==='desk'?.7:.45,0],[word==='desk'?1.2:.65,.12,.72]);for(const x of word==='desk'?[-.5,.5]:[-.25,.25])for(const z of [-.28,.28])box(T,[x,word==='desk'?.35:.22,z],[.08,word==='desk'?.7:.44,.08]);if(word==='desk'){const b=book();b.scale.setScalar(.62);b.position.y=.78;}else{box(B,[0,.85,-.33],[.64,.68,.1]);}}
  else if(word==='lid'){cyl(Y,[0,.18,0],[.55,.08,.55]);sphere(Y,[0,.2,0],[.5,.12,.5]);sphere(I,[0,.4,0],[.12,.08,.12]);}
  else if(word==='bib'){panel([[-.28,.13],[.28,.13],[.34,.58],[.17,.91],[-.17,.91],[-.34,.58]],B,[0,0,0],.07);ring(W,[0,.79,.05],.13);sphere(Y,[0,.4,.055],[.15,.14,.025]);}
  else if(word==='dot'){cyl(W,[0,.12,0],[.56,.08,.56]);sphere(P,[0,.19,0],[.27,.08,.27]);}
  else if(word==='mop'){rod([0,.15,0],[.1,1.25,0],.04,T);for(let n=0;n<9;n++)rod([0,.2,0],[Math.cos(n)*.32,.025,Math.sin(n)*.3],.035,W);}
  else if(word==='shop'||word==='fort'){box(word==='shop'?W:T,[0,.45,0],[1.2,.85,.7]);box(I,[0,.31,.36],[.35,.58,.03]);if(word==='shop'){for(let n=0;n<6;n++)box(n%2?P:W,[(n-2.5)*.22,.97,.19],[.22,.13,1]);box(B,[-.41,.51,.37],[.3,.3,.025]);}else {for(const x of [-.5,.5]){cyl(T,[x,.65,0],[.25,1.3,.25]);for(let n=0;n<4;n++)box(T,[x+Math.cos(n*Math.PI/2)*.19,1.38,Math.sin(n*Math.PI/2)*.19],[.14,.23,.14]);}}}
  else if(word==='tub'){sphere(B,[0,.27,0],[.7,.3,.47]);sphere(W,[0,.44,0],[.6,.16,.4]);sphere(B,[0,.48,0],[.5,.08,.32]);rod([.57,.31,0],[.57,.72,0],.04,I);rod([.57,.72,0],[.35,.72,0],.04,I);}
  else if(word==='tape'){const r=ring(Y,[0,.38,0],.3);const geo=new k.THREE.TorusGeometry(.3,.09,12,32);k.shapes.set('rline-tape-roll',geo);r.geometry=geo;r.scale.set(1,1,1.2);box(Y,[.44,.09,0],[.52,.045,.2]);}
  else if(word==='cane'){rod([-.2,.06,0],[-.2,.9,0],.045,T);const pts=[];for(let i=0;i<=16;i++){const a=Math.PI-i*Math.PI/16;pts.push([Math.cos(a)*.2,.9+Math.sin(a)*.2,0]);}curve(pts,T,.045);}
  else if(word==='plate')plate();
  else if(word==='gate'){for(const x of [-.57,.57])box(T,[x,.57,0],[.14,1.14,.14]);for(let n=0;n<5;n++)box(G,[(n-2)*.19,.55,0],[.08,.8,.08]);for(const y of [.27,.81])box(G,[0,y,.03],[1.06,.07,.1]);}
  else if(word==='key'){ring(Y,[0,.85,0],.23);rod([0,.63,0],[0,.08,0],.065,Y);for(const y of [.14,.3])box(Y,[.11,y,0],[.24,.08,.08]);}
  else if(word==='dream'||word==='nap'){sphere(B,[0,.18,0],[.62,.18,.42]);if(word==='nap'){sphere(C,[0,.4,0],[.3,.25,.26]);for(const x of [-.13,.13])box(I,[x,.43,.24],[.12,.025,.025]);}else{for(const x of [-.23,0,.23])sphere(W,[x,.82,0],[.22,.17,.1]);k.part('flag-star',Y,[.3,1.15,0],[.15,.15,.06],g);}}
  else if(word==='run'){const track=ring(P,[0,.07,0],.6);track.rotation.x=Math.PI/2;track.scale.y*=1.3;const p=person(0,.6);p.rotation.z=-.15;p.position.y=.09;for(let n=0;n<3;n++)box(Y,[-.54,.45+n*.12,0],[.28,.025,.025]);}
  else throw new Error('No authored R-line model for '+word);
  // The standard activate/working states drive this child pivot, not world placement.
  k.moving(g,'sway',.09,2.5);
}
