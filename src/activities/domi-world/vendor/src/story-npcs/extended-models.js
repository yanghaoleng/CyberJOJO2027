import * as THREE from 'three';

// Volumetric story adaptations of the document's remaining character entries.
// Shared primitives are sculpting tools, not identity aliases or image billboards.
const DEFINITIONS = {
  lvdou: ['bean', '#a6cf69', { eyes: 1, width: .62 }],
  douya: ['bean', '#edab57', { pony: true, long: true }],
  fendou: ['bean', '#df90af', { eyes: 1, tuft: true, tall: true }],
  landou: ['bean', '#79bfda', { eyes: 1, spiky: true, long: true }],
  dahongdou: ['bean', '#cb645f', { eyes: 1, strong: true, brow: true }],
  donggaofen: ['graphic', '#efd071', { shape: 'star', shoes: '#a19ebc' }],
  qinlianxi: ['graphic', '#e89db6', { shape: 'cloud', shoes: '#baca75' }],
  aigaicuo: ['graphic', '#6db8c9', { shape: 'block', shoes: '#edcd68' }],
  wulala: ['sprite', '#ad85c2', {}],
  mili: ['human', '#f2cba9', { shirt: '#e6b95c', shorts: '#719bb9', hair: '#745035', braids: true, shoes: '#c58b44', teeth: true }],
  yuanbao: ['human', '#edbf9f', { shirt: '#f8ecd5', shorts: '#d18b80', hair: '#714b37', buns: true, round: true }],
  duziteng: ['human', '#e1b18d', { shirt: '#b76451', shorts: '#635048', hair: '#503d3e', curls: true, bandage: true }],
  wanneng: ['human', '#e5bb9a', { shirt: '#6684a6', shorts: '#688597', hair: '#3e3632', adult: true, vest: true, glassesTop: true, wand: true }],
  baozai: ['human', '#efd1b5', { shirt: '#f5f1e6', shorts: '#53738a', hair: '#453327', tuft: true }],
  danzai: ['robot', '#edf0ea', {}],
  maoge: ['frame', '#85b4dc', {}],
  sunwukong: ['monkey', '#a4774e', {}],
  rusheng: ['human', '#e7bd9f', { shirt: '#8ebeb8', shorts: '#776e6d', hair: '#343332', adult: true, notebook: true }],
  lanbitou: ['human', '#d9b296', { shirt: '#e5d7ca', shorts: '#6c625e', hair: '#55473e', adult: true, round: true, glasses: true, pencil: true }],
  dengdeng: ['lamp', '#d87b58', {}],
  domi: ['bean', '#98c66c', { eyes: 1, width: .59 }],
  hatty: ['hat', '#9274dc', { pointed: true }],
  elfie: ['human', '#efcdb1', { shirt: '#c56771', shorts: '#a94f62', hair: '#c85160', pepper: true, satchel: true }],
  hackett: ['hat', '#5e5670', { crown: true }],
  allie: ['human', '#f0c9aa', { shirt: '#de86a4', shorts: '#934b60', hair: '#9272d4', pony: true, notebook: true }],
  sage: ['human', '#eac4a6', { shirt: '#9571c4', shorts: '#66527b', hair: '#ebe6d9', adult: true, beard: true, glasses: true, wizard: true, wand: true }],
  gulu: ['ship', '#95c4ce', {}],
  'prank-doctor': ['human', '#d7b59d', { shirt: '#d7d4bf', shorts: '#6e647d', hair: '#e5dfd0', adult: true, doctor: true, glasses: true, gadget: true }],
};
export const EXTENDED_CHARACTER_IDS = Object.freeze(Object.keys(DEFINITIONS));
export const supportsExtendedCharacter = id => Object.hasOwn(DEFINITIONS, id);

export function createExtendedCharacter({ characterId, scale = 1 } = {}) {
  if (!supportsExtendedCharacter(characterId)) throw new Error(`Unknown document character: ${characterId}`);
  const [kind, baseColor, config] = DEFINITIONS[characterId];
  const group = new THREE.Group();
  group.name = `story-npc-${characterId}`;
  group.userData = { characterId, role: 'npc', source: 'authored-document-adaptation', modelVersion: 1, usesSkeleton: false };
  const fit = new THREE.Group(), body = new THREE.Group(); group.add(fit); fit.add(body);
  const geometries = new Set(), materials = new Set(), limbs = [], eyeGroups = [], mouthGroups = [];
  const geometry = g => { geometries.add(g); return g; };
  const mat = (color, surface = 'paper', extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, ...extra });
    m.userData.handcraftedSurface = surface; materials.add(m); return m;
  };
  const skin = mat(baseColor), cream = mat('#f7edda'), hair = mat(config.hair || '#6b4837', 'fabric');
  const ink = mat('#302c32', 'ink', { roughness: .26 });
  const white = mat('#fffaf0', 'ink', { roughness: .38 });
  const iris = mat('#79513c', 'ink', { roughness: .3 });
  const tongue = mat('#d88781', 'ink');
  const blush = mat('#d8918c', 'paint');
  const gold = mat('#e4bf6a', 'paint');
  const purple = mat('#886bbb', 'fabric');
  const shirt = mat(config.shirt || baseColor, 'fabric');
  const shorts = mat(config.shorts || '#88735c', 'fabric');
  const shoes = mat(config.shoes || '#7b777a', 'fabric');
  const sphere = geometry(new THREE.SphereGeometry(1, 24, 18));
  function ellipsoid(parent, m, pos, size, name = '') {
    const mesh = new THREE.Mesh(sphere, m); mesh.position.set(...pos); mesh.scale.set(...size);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function solid(parent, geom, m, pos, name = '') {
    const mesh = new THREE.Mesh(geometry(geom), m); mesh.position.set(...pos); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function line(parent, points, radius, material, name = '') {
    return solid(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 20, radius, 8, false), material, [0, 0, 0], name);
  }
  function rounded(parent, m, pos, size, r = .14) {
    const [w, h, d] = size, shape = new THREE.Shape();
    r = Math.min(r, w / 2, h / 2);
    shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .035, bevelThickness: .035, curveSegments: 10 });
    g.translate(0, 0, -d / 2); return solid(parent, g, m, pos);
  }
  function eye(parent, x, y, z, s = 1) {
    const e = new THREE.Group(); parent.add(e); e.position.set(x, y, z); eyeGroups.push(e);
    ellipsoid(e, white, [0, 0, 0], [.145 * s, .19 * s, .066 * s]);
    ellipsoid(e, iris, [0, -.008 * s, .057 * s], [.084 * s, .108 * s, .035 * s]);
    ellipsoid(e, ink, [0, -.008 * s, .085 * s], [.053 * s, .077 * s, .02 * s]);
    ellipsoid(e, white, [-.027 * s, .045 * s, .105 * s], [.026 * s, .029 * s, .013 * s]);
    return e;
  }
  function face(parent, y, z, width = .22, eyeScale = 1, eyes = 2) {
    if (eyes === 1) eye(parent, 0, y, z, eyeScale * 1.5);
    else [-1, 1].forEach(sign => eye(parent, sign * width, y, z, eyeScale));
    const mouth = new THREE.Group(); parent.add(mouth); mouth.position.set(0, y - .27 * eyeScale, z + .015);
    ellipsoid(mouth, ink, [0, 0, 0], [.115 * eyeScale, .09 * eyeScale, .032]);
    ellipsoid(mouth, tongue, [0, -.04 * eyeScale, .026], [.078 * eyeScale, .034 * eyeScale, .016]);
    if (config.teeth) [-.045, .045].forEach(x => rounded(mouth, white, [x, .038, .035], [.029, .044, .02], .009));
    mouthGroups.push(mouth);
    [-1, 1].forEach(s => ellipsoid(parent, blush, [s * (width + .13), y - .19 * eyeScale, z - .025], [.082, .043, .017]));
  }
  function limb(parent, anchor, end, radius, m, side, isArm = true) {
    const pivot = new THREE.Group(); pivot.position.set(...anchor); parent.add(pivot);
    const midpoint = end.map(v => v / 2);
    line(pivot, [[0, 0, 0], midpoint, end], radius, m);
    ellipsoid(pivot, m, end, isArm ? [radius * 1.5, radius * 1.6, radius * 1.2] : [radius * 1.7, radius, radius * 2.2]);
    limbs.push({ pivot, side, isArm }); return pivot;
  }
  function eyebrow(parent, x, y, z, s = 1) {
    return line(parent, [[x - .07 * s, y, z], [x, y + .028 * s, z + .015], [x + .07 * s, y, z]], .017 * s, hair);
  }
  function book(parent, pos, color = '#729584') {
    const b = new THREE.Group(); parent.add(b); b.position.set(...pos); b.rotation.set(-.1, -.15, -.14);
    const cover = mat(color, 'fabric'); rounded(b, cover, [0, 0, 0], [.34, .43, .09], .028);
    rounded(b, cream, [.019, 0, .057], [.278, .371, .025], .013);
    for (const y of [-.08, -.02, .04]) line(b, [[-.07,y,.077],[.1,y,.077]],.004, hair);
    return b;
  }
  function wizardHat(parent, pos, size = 1, colorMat = purple, hand = false) {
    const h = new THREE.Group(); parent.add(h); h.position.set(...pos); h.scale.setScalar(size);
    ellipsoid(h, colorMat, [0, 0, 0], [.66, .074, .43]);
    const cone = new THREE.ConeGeometry(.4, .8, 32); cone.translate(0, .4, 0);
    solid(h, cone, colorMat, [0, .02, 0]).rotation.z = -.18;
    line(h, [[.04,.57,0],[.08,.78,0],[-.03,.93,0],[-.2,.92,0]],.105,colorMat);
    const band = solid(h, new THREE.CylinderGeometry(.37,.405,.08,32,1,true),gold,[0,.13,0]);
    band.rotation.z = -.06;
    if (hand) { ellipsoid(h,white,[-.23,.99,0],[.08,.1,.045]); for(let i=0;i<3;i++)ellipsoid(h,white,[-.29+i*.05,1.08+(i===1?.025:0),0],[.027,.09,.029]); }
    return h;
  }
  function wand(parent, pos, tall = false) {
    const y = tall ? 1.8 : 1.05;
    line(parent, [[pos[0],pos[1],pos[2]],[pos[0]-.02,pos[1]+y*.55,pos[2]],[pos[0]+.05,pos[1]+y,pos[2]]],.027, mat('#74513b','wood'));
    ellipsoid(parent,gold,[pos[0]+.05,pos[1]+y,pos[2]],[.12,.12,.09]);
    ellipsoid(parent,mat('#acd9c2','ink',{emissive:'#a7cfae',emissiveIntensity:.3}),[pos[0]+.05,pos[1]+y+.03,pos[2]+.065],[.075,.075,.06]);
  }

  if (kind === 'bean') {
    const long = config.long, strong = config.strong, w = strong ? .87 : config.width || .48;
    const center = long ? 1.25 : 1.03, h = strong ? .72 : config.tall ? .9 : .73;
    ellipsoid(body,skin,[0,center,0],[w,h,.4]);
    if (!config.pony) face(body,center+.12,.374,long?.18:.21,strong?.74:.9,config.eyes||2);
    const length = long ? .65 : .22;
    for (const s of [-1,1]) {
      limb(body,[s*w*.83,center+.1,0],[s*.08,-(long?.77:.47),.075],strong?.115:.052,skin,s);
      limb(body,[s*w*.4,center-h+.03,0],[0,-length,.09],strong?.115:.065,skin,s,false);
    }
    if (config.pony) { ellipsoid(body,hair,[0,center+.46,-.04],[.49,.43,.4]); ellipsoid(body,skin,[0,center+.22,.13],[.46,.46,.33]); face(body,center+.2,.449,.18,.86); ellipsoid(body,hair,[-.32,center+1.03,-.03],[.32,.31,.22]); }
    if (config.tuft) for(let i=0;i<3;i++)ellipsoid(body,gold,[(i-1)*.07,center+h-.01,0],[.085,.13,.07]);
    if (config.spiky) for(let i=0;i<3;i++) { const spike=solid(body,new THREE.ConeGeometry(.14,.35,20),skin,[(i-1)*.23,center+h-.02,0]);spike.rotation.z=(i-1)*-.3; }
    if (config.brow) [-1,1].forEach(s=>{const b=ellipsoid(body,mat('#753532'),[s*.18,center+.49,.27],[.18,.26,.08]); b.rotation.z=-s*.45;});
    if(characterId === 'domi') {
      const boxMaterial = mat('#9a78bf','fabric');
      rounded(body,boxMaterial,[.56,.78,.05],[.36,.34,.28],.035);
      rounded(body,gold,[.56,.83,.204],[.045,.31,.015],.006);
      rounded(body,gold,[.56,.86,.204],[.33,.045,.015],.006);
      ellipsoid(body,gold,[.56,.85,.23],[.04,.04,.02]);
    }
  } else if (kind === 'graphic') {
    const block=config.shape==='block', center=block?1.16:1.62;
    if (config.shape==='star') {
      const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.33:.6;const x=Math.cos(a)*r,y=Math.sin(a)*r;if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
      const g=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelThickness:.05,bevelSize:.045,bevelSegments:4});g.translate(0,0,-.14);solid(body,g,skin,[0,center,0]);
    } else if(block) rounded(body,skin,[0,center,0],[1.04,1.55,.42],.17);
    else {ellipsoid(body,skin,[0,center,0],[.54,.4,.25]);for(let i=0;i<6;i++){const a=i*Math.PI/3;ellipsoid(body,skin,[Math.cos(a)*.36,center+Math.sin(a)*.28,0],[.25,.24,.24]);}}
    if(!block) rounded(body,skin,[0,.84,0],[.26,.63,.19],.08);
    face(body,block?center+.33:center,.25,.15,.68);
    [-1,1].forEach(s=>{limb(body,[s*(block?.56:.13),block?1.7:1.02,0],[s*(block?.15:.26),block?-1.1:-.36,.02],.045,skin,s);limb(body,[s*.09,.51,0],[0,-.35,.04],.054,skin,s,false);ellipsoid(body,shoes,[s*.12,.1,.075],[.135,.08,.14]);});
  } else if (kind === 'human' || kind === 'monkey') {
    const adult=config.adult, round=config.round, monkey=kind==='monkey';
    const headY=adult?1.73:1.57, headS=adult?.42:round?.54:.47, bodyW=round?.36:.28;
    const head=new THREE.Group();body.add(head); head.position.y=headY;
    ellipsoid(head,skin,[0,0,0],[headS,headS*.99,headS*.79]);
    [-1,1].forEach(s=>ellipsoid(head,skin,[s*headS,.005,-.005],[.09,.14,.07]));
    if(monkey){ellipsoid(head,cream,[0,-.055,.265],[.36,.33,.12]);[-1,1].forEach(s=>ellipsoid(head,cream,[s*.2,.1,.3],[.19,.2,.09]));}
    face(head,.018,headS*.74,.18,adult?.78:.94);
    ellipsoid(head,skin,[0,-.09,headS*.81],[.064,.078,.075]);
    [-1,1].forEach(s=>eyebrow(head,s*.18,.28,headS*.62));
    if(!monkey) {
      ellipsoid(head,hair,[0,.17,-.075],[headS*1.03,headS*.78,headS*.73]);
      const bangs=config.curls?7:5;
      for(let i=0;i<bangs;i++) {const x=(i-(bangs-1)/2)*headS*.34;ellipsoid(head,hair,[x,.28-Math.abs(x)*.12,.21],[headS*.25,config.curls?.16:.18,.15]);}
      if(config.braids) for(const s of [-1,1]) for(let i=0;i<4;i++)ellipsoid(head,hair,[s*(headS+.08+i*.008),.08-i*.18,-.015],[.12-i*.01,.13,.11]);
      if(config.buns) [-1,1].forEach(s=>ellipsoid(head,hair,[s*(headS+.1),.21,-.03],[.2,.2,.17]));
      if(config.pony) {ellipsoid(head,hair,[.32,.49,-.15],[.21,.22,.18]);line(head,[[.4,.4,-.18],[.57,.12,-.23],[.55,-.42,-.24],[.68,-.36,-.2]],.14,hair);}
      if(config.pepper){ellipsoid(head,hair,[0,.3,-.02],[.45,.27,.31]);line(head,[[0,.51,0],[.04,.65,0],[.12,.68,0]],.044,mat('#629a77','foliage'));}
      if(config.tuft)ellipsoid(head,hair,[-.1,.45,0],[.1,.17,.09]);
      if(config.doctor)for(const s of [-1,1])for(let i=0;i<3;i++)ellipsoid(head,hair,[s*(.32+i*.035),.2+i*.055,-.04],[.14,.08,.13]);
      if(config.glasses||config.glassesTop){const y=config.glassesTop?.4:.025,z=config.glassesTop?.29:headS*.8;[-1,1].forEach(s=>solid(head,new THREE.TorusGeometry(.135,.014,8,32),config.glassesTop?gold:ink,[s*.17,y,z]));line(head,[[-.035,y,z],[0,y+.015,z],[.035,y,z]],.012,ink);}
      if(config.beard){ellipsoid(head,cream,[0,-.34,.25],[.29,.33,.17]);[-1,1].forEach(s=>{const moustache=ellipsoid(head,cream,[s*.12,-.16,.39],[.15,.065,.07]);moustache.rotation.z=s*.3;});}
      if(config.bandage){const patch=rounded(head,cream,[-.34,-.19,.28],[.19,.055,.018],.02);patch.rotation.z=-.4;}
    }
    if(config.beard||monkey){const robe=solid(body,new THREE.CylinderGeometry(bodyW*.78,bodyW*1.3,.7,32),monkey?mat('#b66248','fabric'):shirt,[0,.82,0]);if(monkey)for(let y=.55;y<1.1;y+=.13)line(body,[[-.28,y,.28],[0,y,.33],[.28,y,.28]],.013,gold);}
    else ellipsoid(body,shirt,[0,.95,0],[bodyW,adult?.36:.32,.21]);
    ellipsoid(body,shorts,[0,.57,0],[bodyW*.95,.2,.2]);
    if(config.vest){ellipsoid(body,cream,[0,1.14,.19],[.075,.12,.035]);for(const x of [-.15,.13])ellipsoid(body,cream,[x,.91,.17],[.095,.055,.028]);}
    if(config.shorts&&['mili','yuanbao'].includes(characterId))for(const s of [-1,1])line(body,[[s*.15,.56,.2],[s*.15,1.15,.17]],.026,shorts);
    if(monkey){
      line(head,[[-.38,.26,.16],[-.2,.31,.35],[0,.3,.4],[.2,.31,.35],[.38,.26,.16]],.031,gold);
      for(const s of [-1,1]){line(head,[[s*.02,.31,.42],[s*.08,.43,.41],[s*.15,.39,.39],[s*.13,.34,.4]],.024,gold);line(head,[[s*.22,.36,-.03],[s*.3,.63,-.05],[s*.25,.81,-.08]],.029,mat('#b65d4c','fabric'));}
      line(body,[[-.27,1.23,.1],[0,1.12,.26],[.27,1.23,.1]],.062,mat('#748fae','fabric'));
      line(body,[[.58,.1,0],[.58,1.87,0]],.034,gold);
      for(const y of [.25,1.72])solid(body,new THREE.CylinderGeometry(.048,.048,.22,16),mat('#a45c42','paint'),[.58,y,0]);
      line(body,[[.18,.61,-.14],[.6,.55,-.27],[.67,.89,-.15]],.045,skin);
    }
    for(const s of [-1,1]) {
      const a=limb(body,[s*bodyW*.94,1.14,0],[s*.14,-.48,.025],.062,skin,s);
      ellipsoid(a,shirt,[s*.025,-.09,0],[.093,.15,.09]);
      limb(body,[s*.13,.47,0],[0,-.31,.055],.073,skin,s,false);
      ellipsoid(body,shoes,[s*.14,.095,.095],[.125,.09,.2]);
      line(body,[[s*.14-.07,.14,.25],[s*.14+.07,.14,.25]],.008,cream);
    }
    if(config.wizard)wizardHat(head,[0,.38,-.045],.8);
    if(config.wand)wand(body,[-.61,.18,0],config.beard);
    if(config.notebook)book(body,[-.43,.76,.08]);
    if(config.pencil){line(body,[[.45,.56,.07],[.5,1.2,.06]],.025,gold);solid(body,new THREE.ConeGeometry(.029,.12,12),ink,[.507,1.24,.06]);}
    if(config.satchel)book(body,[.39,.76,.015],'#669b73');
    if(config.gadget){rounded(body,purple,[.48,.8,.06],[.23,.27,.18],.05);for(const y of [.76,.85])ellipsoid(body,gold,[.47,y,.165],[.04,.04,.025]);}
  } else if(kind==='sprite') {
    ellipsoid(body,purple,[0,1.29,-.06],[.67,.79,.47]);ellipsoid(body,skin,[0,1.33,.17],[.48,.51,.34]);
    face(body,1.43,.475,.22,1.04);
    ellipsoid(body,purple,[0,.54,0],[.37,.35,.28]);
    line(body,[[0,1.95,0],[.1,2.25,0],[.32,2.3,0]],.028,purple);ellipsoid(body,skin,[.34,2.28,0],[.12,.13,.1]);
    [-1,1].forEach(s=>{limb(body,[s*.3,.77,0],[s*.18,-.12,.08],.076,skin,s);ellipsoid(body,purple,[s*.35,.4,0],[.22,.19,.26]);});
  } else if(kind==='robot') {
    ellipsoid(body,skin,[0,1.09,0],[.65,.88,.47]); rounded(body,ink,[0,1.4,.407],[.93,.38,.12],.13);
    for(const s of [-1,1])solid(body,new THREE.TorusGeometry(.088,.018,8,24),gold,[s*.2,1.42,.487]);
    ellipsoid(body,gold,[0,1.04,.457],[.06,.06,.033]);
    const m=new THREE.Group();body.add(m);m.position.set(0,1.25,.493);rounded(m,gold,[0,0,0],[.2,.02,.02],.008);mouthGroups.push(m);
    [-1,1].forEach(s=>limb(body,[s*.59,1.06,0],[s*.08,-.24,.06],.055,skin,s));
    ellipsoid(body,mat('#779ba2','paint'),[0,.25,0],[.34,.11,.25]);
  } else if(kind==='frame') {
    rounded(body,skin,[0,1.43,0],[.98,1.2,.3],.16);rounded(body,cream,[0,1.42,.185],[.74,.87,.05],.065);
    face(body,1.54,.23,.18,.89);rounded(body,skin,[0,.74,0],[.29,.28,.2],.08);
    const hat=solid(body,new THREE.ConeGeometry(.64,.25,4),skin,[0,2.08,0]);hat.rotation.y=Math.PI/4;
    line(body,[[-.4,1.9,.2],[.4,1.9,.2]],.037,gold);
    [-1,1].forEach(s=>{limb(body,[s*.48,1.1,0],[s*.18,-.21,.02],.045,skin,s);limb(body,[s*.1,.65,0],[s*.08,-.49,.05],.055,skin,s,false);});
    line(body,[[.65,.7,0],[.65,1.77,0]],.025,gold);
  } else if(kind==='lamp') {
    ellipsoid(body,skin,[0,.12,0],[.5,.12,.33]);
    for(const s of [-1,1])line(body,[[s*.11,.22,0],[s*.19,.8,-.08],[s*.11,1.37,.015]],.035,skin);
    for(const y of [.4,.93])solid(body,new THREE.CylinderGeometry(.055,.055,.48,20),gold,[0,y,0]).rotation.z=Math.PI/2;
    const head=new THREE.Group();body.add(head);head.position.set(0,1.65,0);
    solid(head,new THREE.CylinderGeometry(.46,.4,.21,40),gold,[0,0,0]).rotation.x=Math.PI/2;
    ellipsoid(head,mat('#f9e6b1','paper',{emissive:'#f8df9a',emissiveIntensity:.16}),[0,0,.12],[.42,.42,.037]);
    face(head,.04,.16,.15,.68);line(head,[[-.13,.43,0],[0,.49,0],[.13,.43,0]],.035,gold);
  } else if(kind==='hat') {
    ellipsoid(body,skin,[0,.49,0],[.82,.13,.53]);
    if(config.pointed)wizardHat(body,[0,.5,0],.9,skin,true);
    else {solid(body,new THREE.CylinderGeometry(.48,.38,.85,32),skin,[0,.91,0]);
      const crown=mat('#e8bf67','paint');for(let i=0;i<3;i++)solid(body,new THREE.ConeGeometry(.095,.21,12),crown,[(i-1)*.115,1.51,0]);
      rounded(body,crown,[0,1.39,0],[.38,.12,.13],.015);
    }
    face(body,.88,.374,.19,.91);[-1,1].forEach(s=>eyebrow(body,s*.19,1.13,.375,1.25));
  } else if(kind==='ship') {
    ellipsoid(body,skin,[0,.82,0],[.93,.28,.66]);
    ellipsoid(body,mat('#dce8d6','paint'),[0,1.09,0],[.51,.43,.4]);face(body,1.16,.358,.19,.83);
    const fin=mat('#8795bf','fabric');[-1,1].forEach(s=>{const f=ellipsoid(body,fin,[s*.78,.87,-.17],[.25,.16,.47]);f.rotation.y=s*.38;ellipsoid(body,gold,[s*.72,.71,.23],[.08,.08,.045]);});
    for(let i=0;i<3;i++)ellipsoid(body,gold,[(i-1)*.23,.82,.619],[.055,.055,.026]);
    line(body,[[0,1.43,0],[.025,1.66,0]],.02,skin);ellipsoid(body,gold,[.025,1.69,0],[.065,.065,.065]);
    for(const s of [-1,1])solid(body,new THREE.CylinderGeometry(.1,.13,.19,20),fin,[s*.46,.42,0]);
  }

  // Fit each sculpt by its true geometry. The outer group stays a placement API.
  body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(body), size = bounds.getSize(new THREE.Vector3());
  const factor = 2.2 / Math.max(size.y, .001), center = bounds.getCenter(new THREE.Vector3());
  fit.scale.setScalar(factor); body.position.set(-center.x, -bounds.min.y, -center.z);
  group.scale.setScalar(Number.isFinite(scale) && scale > 0 ? scale : 1);
  const restY = body.position.y, restX = body.position.x;
  let action = 'idle', expression = 'happy', disposed = false, blendTalk = 0, airborneHeight = 0;
  const actions = new Set(['idle','talk','wave','hop','listen','walk','drive','handshake']);
  const expressions = new Set(['happy','curious','sad','surprised']);
  return {
    group,
    grounding: { getAirborneHeight: () => airborneHeight },
    setAction(value) { action = actions.has(value) ? value : 'idle'; },
    setExpression(value) { expression = expressions.has(value) ? value : 'happy'; },
    setColor(value) { if (/^#[0-9a-f]{6}$/i.test(value || '')) skin.color.set(value); },
    update(time = 0, dt = .016) {
      if(disposed)return;
      const t=Number.isFinite(time)?time:0, delta=Math.max(0,Math.min(Number.isFinite(dt)?dt:.016,.1));
      blendTalk = THREE.MathUtils.lerp(blendTalk,action==='talk'?1:0,1-Math.exp(-delta*13));
      airborneHeight = (action==='hop'?Math.abs(Math.sin(t*4.8))*.13:0)*fit.scale.y;
      body.position.y=restY+(action==='hop'?Math.abs(Math.sin(t*4.8))*.13:Math.sin(t*1.9)*.008);
      body.position.x=restX;
      body.rotation.y=action==='talk'?Math.sin(t*3)*.025:Math.sin(t*.8)*.018;
      body.rotation.z=expression==='curious'?.055:expression==='sad'?-.028:0;
      for(const {pivot,side,isArm} of limbs){pivot.rotation.x=action==='walk'?Math.sin(t*5+side*Math.PI/2)*(isArm?.2:.32):0;if(isArm&&action==='drive')pivot.rotation.x=-1.2;if(isArm&&action==='handshake'&&side===1)pivot.rotation.x=-1.2+Math.sin(t*5)*.1;pivot.rotation.z=isArm&&action==='wave'&&side===1?.72+Math.sin(t*5)*.19:isArm?side*.025:0;}
      const blink=Math.sin(t*.93+1.1)>.998?.13:1;
      for(const e of eyeGroups)e.scale.y=blink*(expression==='sad'?.8:1);
      for(const mouth of mouthGroups)mouth.scale.y=expression==='surprised'?1.3:.32+blendTalk*(.3+Math.abs(Math.sin(t*13))*.8);
    },
    dispose() { if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.removeFromParent(); },
  };
}
