import {MassBuilder,axesQuaternion} from '../frames/massProperties.js';
import {buildFrame,projectedAreas,FRAME_TYPES} from '../frames/frames.js';
import {getRotor,ROTORS} from '../aero/rotors.js';
import {withDragFactor} from '../aero/rotor.js';
import {getVehicle} from './presets.js';

/**
 * Assemble a vehicle: frame + components + rotors + battery → mass properties about the CoM,
 * rotor mounts, landing feet, drag areas. Everything returned is relative to the CoM, body axes.
 * options: {frame, payload (kg, at the body centre bottom), rotorLossFactor (null = calibrated default)}
 */
export function buildVehicle(id,{frame=null,payload=0,rotorLossFactor=null}={}){
  const v=getVehicle(id),type=frame??'carbon';
  if(!FRAME_TYPES.includes(type))throw new RangeError(`Unknown frame '${type}'`);
  const misc=calibrationMass(v);
  const asm=assemble(v,type,payload,misc);
  const mp=asm.mb.compute(),com=mp.com,rel=p=>[p[0]-com[0],p[1]-com[1],p[2]-com[2]];
  let rotor=getRotor(v.rotor);if(rotorLossFactor!=null)rotor=withDragFactor(rotor,rotorLossFactor);
  const rotors=asm.frame.mounts.map((m,i)=>({index:i,rotor,hub:rel(m),axis:[0,1,0],spin:v.spins[i]}));
  const areas=projectedAreas(asm.frame);
  return Object.freeze({
    id,spec:v,frame:type,frameData:asm.frame,payload,miscMass:misc,
    mass:mp.mass,com,inertia:mp.inertia,principal:mp.principal,inertiaFrame:axesQuaternion(mp.principal.axes),
    groups:mp.groups,rotors,feet:asm.frame.feet.map(rel),comOffset:com,
    bodyBox:{center:rel([0,0,0]),size:v.layout.body},
    drag:{tubes:areas.tubes,plates:areas.plates,memberDiameter:areas.memberDiameter,
      // components and battery seen as boxes: projected faces (assumed bluff, Cd ≈ 1.05)
      boxes:boxAreas(v)},
    weightOn:g=>mp.mass*g,
  });
}

function assemble(v,type,payload,misc){
  const frame=buildFrame(type,v.layout,v.frameParams),mb=new MassBuilder().merge(frame.builder);
  for(const c of v.components){
    if(c.perMount)frame.mounts.forEach((m,i)=>mb.box(c.group,`${c.name} ${i+1}`,c.mass,[m[0],m[1]-.02,m[2]],c.size));
    else mb.box(c.group,c.name,c.mass,c.center,c.size);
  }
  const b=v.battery,cells=b.series*b.parallel,side=Math.cbrt(cells*1.7e-5)*1.2; // 18650-class volume, assumed packing
  mb.box('battery','battery',b.mass,v.batteryCenter,[side,side*.8,side]);
  for(const m of frame.mounts){
    // rotor blades + hub, treated as two thin blades: I_axis = m R²/3, I_transverse ≈ m R²/6
    const R=getRotor(v.rotor).radius,mr=v.rotorMass,ia=mr*R*R/3,it=mr*R*R/6;
    mb.add('rotors','rotor',mr,m,[[it,0,0],[0,ia,0],[0,0,it]]);
  }
  if(payload>0)mb.box('payload','added payload',payload,[0,-v.layout.body[1]/2,0],[.08,.05,.08]);
  if(misc>0)mb.box('misc','misc (calibration: wiring, fasteners, thermal)',misc,[0,0,0],v.layout.body);
  return {frame,mb};
}

/** Mass that makes the reference build (carbon frame, no payload) match the published total. */
function calibrationMass(v){
  if(!v.publishedMass)return 0;
  const m=assemble(v,'carbon',0,0).mb.compute().mass;
  return Math.max(0,v.publishedMass-m);
}
function boxAreas(v){
  const A=[0,0,0];
  for(const c of v.components){const [x,y,z]=c.size,n=c.perMount?v.spins.length:1;A[0]+=n*y*z;A[1]+=n*x*z;A[2]+=n*x*y;}
  return A;
}
