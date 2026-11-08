import * as THREE from 'three';
import {lookup} from '../../src/aero/rotor.js';

/**
 * Procedural vehicle model from the assembled vehicle (same members that produced the mass
 * properties): frame tubes (instanced cylinders), C60 nodes, honeycomb panels, components,
 * rotors with blades that spin at the simulated rotor speed. Origin = centre of mass.
 * Blades are lofted from the rotor definition the aerodynamics uses (chord and twist along the
 * span, or a fixed-pitch propeller's helix angle), with a thin cambered section for shading.
 */
const UP=new THREE.Vector3(0,1,0),RAD=Math.PI/180;
/** Blade surface: spanwise sections from root to tip, chord c(r) and pitch θ(r) about the quarter chord. */
export function bladeGeometry(r,spin=1,collectiveDeg=4){
  const R=r.radius,xs=[r.root];for(let k=1;k<=20;k++)xs.push(r.root+(1-r.root)*k/20);
  const chord=x=>typeof r.chord==='number'?r.chord:lookup(r.chord,x)*R;
  const pitch=x=>r.pitch!=null?Math.atan(r.pitch/(2*Math.PI*x*R)):(lookup(r.twist,x)+collectiveDeg)*RAD;
  const U=[0,.03,.1,.25,.45,.7,1],nu=U.length,t=.06,cam=.05; // 6 % thick, 5 % camber (thin low-Re section, visual)
  const yt=u=>5*t*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u**3-.1036*u**4),yc=u=>cam*4*u*(1-u);
  const pos=[],idx=[];
  for(const x of xs){
    const c=Math.max(.002,chord(x)),th=pitch(x),cs=Math.cos(th),sn=Math.sin(th);
    for(const side of [1,-1])for(const u of U){
      const z=(u-.25)*c,y=(yc(u)+side*yt(u))*c,zr=z*cs+y*sn,yr=y*cs-z*sn; // nose-up rotation about the quarter chord
      pos.push(x*R,yr,spin*zr);
    }
  }
  const per=2*nu;
  for(let i=0;i<xs.length-1;i++)for(const side of [0,1])for(let j=0;j<nu-1;j++){
    const a=i*per+side*nu+j,b=a+1,c=a+per,d=c+1;
    if(side===0)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function createVehicleModel(built){
  const group=new THREE.Group(),inner=new THREE.Group(),c=built.comOffset;inner.position.set(-c[0],-c[1],-c[2]);group.add(inner);
  const carbon=new THREE.MeshStandardMaterial({color:'#2b2f36',roughness:.45,metalness:.3});
  const gold=new THREE.MeshStandardMaterial({color:'#c9a24a',roughness:.35,metalness:.8});
  const panelMat=new THREE.MeshStandardMaterial({color:'#d8d4c8',roughness:.7});
  const f=built.frameData,m4=new THREE.Matrix4(),q=new THREE.Quaternion(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
  if(f.tubes.length){
    const cyl=new THREE.CylinderGeometry(.5,.5,1,8),mesh=new THREE.InstancedMesh(cyl,carbon,f.tubes.length);
    f.tubes.forEach((t,i)=>{a.fromArray(t.a);b.fromArray(t.b);d.subVectors(b,a);const L=d.length();q.setFromUnitVectors(UP,d.normalize());
      m4.compose(a.clone().add(b).multiplyScalar(.5),q,new THREE.Vector3(t.od,L,t.od));mesh.setMatrixAt(i,m4);});
    mesh.castShadow=true;inner.add(mesh);
  }
  if(f.nodes.length){
    const sph=new THREE.SphereGeometry(1,8,6),mesh=new THREE.InstancedMesh(sph,gold,f.nodes.length);
    f.nodes.forEach((n,i)=>{m4.compose(new THREE.Vector3(...n.p),new THREE.Quaternion(),new THREE.Vector3(n.r,n.r,n.r));mesh.setMatrixAt(i,m4);});inner.add(mesh);
  }
  for(const p of f.panels){
    let geo;
    if(p.hexCap){geo=new THREE.CylinderGeometry(p.radius,p.radius,.006,6);}
    else{geo=new THREE.BoxGeometry(p.w,p.hex?p.h:p.t??.004,p.hex?.006:p.h);}
    const m=new THREE.Mesh(geo,p.hex||p.hexCap?panelMat:carbon);m.position.fromArray(p.center);
    if(p.hex){const n=new THREE.Vector3(...p.n);m.lookAt(n.add(m.position));}
    m.castShadow=true;inner.add(m);
  }
  for(const comp of built.spec.components){
    const mat=comp.group==='solar'?new THREE.MeshStandardMaterial({color:'#1c2a4a',roughness:.3,metalness:.5}):gold;
    const places=comp.perMount?f.mounts.map(p=>[p[0],p[1]-.02,p[2]]):[comp.center];
    for(const pos of places){const m=new THREE.Mesh(new THREE.BoxGeometry(...comp.size),mat);m.position.fromArray(pos);m.castShadow=true;inner.add(m);}
  }
  // rotors: blades + a faint disc that becomes visible at speed
  const rotors=f.mounts.map((mnt,i)=>{
    const r=built.rotors[i].rotor,hub=new THREE.Group();hub.position.fromArray(mnt);
    const bladeMat=new THREE.MeshStandardMaterial({color:'#d9dde3',roughness:.5,metalness:.2,side:THREE.DoubleSide});
    const spin=built.rotors[i].spin,blade=bladeGeometry(r,spin);
    for(let k=0;k<r.blades;k++){
      const bl=new THREE.Mesh(blade,bladeMat),arm=new THREE.Group();arm.rotation.y=k*2*Math.PI/r.blades;arm.add(bl);hub.add(arm);bl.castShadow=true;
    }
    const hubCap=new THREE.Mesh(new THREE.CylinderGeometry(r.radius*r.root*.9,r.radius*r.root*.9,Math.max(.006,r.radius*.04),16),carbon);hubCap.castShadow=true;hub.add(hubCap);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(r.radius,48),new THREE.MeshBasicMaterial({color:'#cfd8e0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    disc.rotation.x=-Math.PI/2;hub.add(disc);inner.add(hub);
    return {hub,disc,spin:built.rotors[i].spin};
  });
  return {group,rotors,
    update(vehicle,dt){rotors.forEach((r,i)=>{const w=vehicle.rotors[i].motor.omega;r.hub.rotation.y+=r.spin*Math.min(w*dt,.9);r.disc.material.opacity=Math.min(.22,w/2000);});},
    dispose(){group.traverse(o=>{o.geometry?.dispose();});}};
}
