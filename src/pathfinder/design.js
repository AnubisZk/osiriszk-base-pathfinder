import {VEHICLES,registerVehicle,getVehicle} from '../vehicles/presets.js';
import {ROTORS,registerRotor,getRotor} from '../aero/rotors.js';
import {defineRotor} from '../aero/rotor.js';
import {defineBattery} from '../power/battery.js';
import {FRAME_TYPES,FRAME_LABELS} from '../frames/frames.js';

/**
 * The scout drone the player designs, and the mission budget.
 *
 * Base: the OsirisZk Mars quad concept (presets.js; every value there is a design assumption).
 * The player picks the rotor radius, the battery (energy system), the camera and the frame;
 * `deriveVehicle` turns the choice into a real vehicle definition that the existing flight
 * physics builds and flies (mass, inertia, thrust, power all follow from it).
 *
 * MONEY: every cost here is a REPRESENTATIVE GAME VALUE in million USD, not an estimate of a real
 * mission. Starting budget 100 M; drone 25 + camera 10 + standard energy system 15 + mission
 * infrastructure 20 = 70 M, leaving 30 M for upgrades (brief).
 */
export const BUDGET=Object.freeze({total:100,currency:'M USD',representative:true});
export const BASE_COSTS=Object.freeze([
  {id:'drone',cost:25,label:{en:'Mars scout drone (airframe, motors, avionics)',tr:'Mars keşif dronu (gövde, motorlar, aviyonik)'}},
  {id:'camera',cost:10,label:{en:'Camera (standard)',tr:'Kamera (standart)'}},
  {id:'energy',cost:15,label:{en:'Energy system (standard battery + solar panel)',tr:'Enerji sistemi (standart batarya + güneş paneli)'}},
  {id:'infrastructure',cost:20,label:{en:'Mission infrastructure (landing platform share, relay, operations)',tr:'Görev altyapısı (iniş platformu payı, röle, operasyon)'}},
]);

const BASE_ID='osiris-mars-quad',BASE_ROTOR='osiris-mars',BASE_RADIUS=.5;
export const ROTOR_OPTIONS=Object.freeze([
  {id:'r45',radius:.45,cost:0,label:{en:'0.45 m rotors (lighter, less thrust)',tr:'0,45 m rotor (hafif, daha az itki)'}},
  {id:'r50',radius:.50,cost:0,label:{en:'0.50 m rotors (standard)',tr:'0,50 m rotor (standart)'}},
  {id:'r55',radius:.55,cost:3,label:{en:'0.55 m rotors',tr:'0,55 m rotor'}},
  {id:'r60',radius:.60,cost:6,label:{en:'0.60 m rotors (most thrust, heaviest)',tr:'0,60 m rotor (en çok itki, en ağır)'}},
]);
export const BATTERY_OPTIONS=Object.freeze([
  {id:'b2',parallel:2,cost:0,label:{en:'Standard: 6S2P Li-ion (12 cells)',tr:'Standart: 6S2P Li-iyon (12 hücre)'}},
  {id:'b3',parallel:3,cost:5,label:{en:'Extended: 6S3P (18 cells)',tr:'Uzatılmış: 6S3P (18 hücre)'}},
  {id:'b4',parallel:4,cost:9,label:{en:'Long range: 6S4P (24 cells)',tr:'Uzun menzil: 6S4P (24 hücre)'}},
]);
/**
 * Cameras. Pixel count of the standard camera follows Ingenuity's 13 MP colour camera
 * (JPL press kit); pixel pitch, focal length, mass, power and the matching precision σpx are
 * ASSUMED typical values for each sensor class.
 */
export const CAMERA_OPTIONS=Object.freeze([
  {id:'standard',cost:0,mass:.20,power:3,px:[4208,3120],pitch:1.12e-6,focal:3.4e-3,shutter:'rolling',sigmaPx:.5,
    label:{en:'Standard 13 MP colour (Ingenuity class)',tr:'Standart 13 MP renkli (Ingenuity sınıfı)'}},
  {id:'highres',cost:4,mass:.45,power:6,px:[5472,3648],pitch:2.4e-6,focal:16e-3,shutter:'rolling',sigmaPx:.4,
    label:{en:'High resolution 20 MP, 1-inch sensor',tr:'Yüksek çözünürlük 20 MP, 1 inç sensör'}},
  {id:'mapping',cost:7,mass:.55,power:8,px:[4096,3000],pitch:3.45e-6,focal:12e-3,shutter:'global',sigmaPx:.3,
    label:{en:'Mapping camera 12 MP, global shutter',tr:'Haritalama kamerası 12 MP, global deklanşör'}},
]);
export const FRAME_COSTS=Object.freeze({carbon:0,hexcell:1,fullerene:2});
export const DEFAULT_DESIGN=Object.freeze({rotor:'r50',battery:'b2',camera:'standard',frame:'carbon'});

const pick=(list,id,what)=>{const o=list.find(x=>x.id===id);if(!o)throw new RangeError(`Unknown ${what} '${id}'`);return o;};
export const cameraOf=d=>pick(CAMERA_OPTIONS,d.camera,'camera');

/** Cost breakdown and remaining budget for a design. */
export function budget(design){
  const r=pick(ROTOR_OPTIONS,design.rotor,'rotor'),b=pick(BATTERY_OPTIONS,design.battery,'battery'),c=cameraOf(design);
  if(!FRAME_TYPES.includes(design.frame))throw new RangeError(`Unknown frame '${design.frame}'`);
  const items=[...BASE_COSTS.map(x=>({...x,kind:'base'})),
    {id:'rotorUpgrade',cost:r.cost,label:{en:`Rotor option: ${r.label.en}`,tr:`Rotor seçeneği: ${r.label.tr}`},kind:'upgrade'},
    {id:'batteryUpgrade',cost:b.cost,label:{en:`Battery option: ${b.label.en}`,tr:`Batarya seçeneği: ${b.label.tr}`},kind:'upgrade'},
    {id:'cameraUpgrade',cost:c.cost,label:{en:`Camera option: ${c.label.en}`,tr:`Kamera seçeneği: ${c.label.tr}`},kind:'upgrade'},
    {id:'frameUpgrade',cost:FRAME_COSTS[design.frame],label:{en:`Frame: ${FRAME_LABELS[design.frame]?.en??design.frame}`,tr:`Gövde: ${FRAME_LABELS[design.frame]?.tr??design.frame}`},kind:'upgrade'}];
  const base=BASE_COSTS.reduce((s,x)=>s+x.cost,0),total=items.reduce((s,x)=>s+x.cost,0);
  return {items,base,total,remaining:BUDGET.total-total,within:total<=BUDGET.total,currency:BUDGET.currency,representative:true};
}

const quadArms=r=>[[-r/Math.SQRT2,-r/Math.SQRT2],[r/Math.SQRT2,-r/Math.SQRT2],[-r/Math.SQRT2,r/Math.SQRT2],[r/Math.SQRT2,r/Math.SQRT2]];
const exists=(get,id)=>{try{get(id);return true;}catch{return false;}};

/**
 * Register (once) and return the vehicle id for a design. Scaling rules (assumed, stated):
 *  - rotor: the concept rotor's chord and twist distributions (c/R) at the new radius;
 *    blade mass ∝ R², rotor inertia ∝ R⁴
 *  - arms lengthen so neighbouring rotors keep ≥ 5 % tip clearance: arm ≥ 1.485 R
 *  - battery: same cells, more in parallel (capacity and mass scale with the cell count)
 *  - camera: replaces the concept's 0.20 kg science camera; its power adds to the avionics load
 */
export function deriveVehicle(design){
  const r=pick(ROTOR_OPTIONS,design.rotor,'rotor'),b=pick(BATTERY_OPTIONS,design.battery,'battery'),cam=cameraOf(design);
  const id=`pf-${r.id}-${b.id}-${cam.id}`;
  if(exists(getVehicle,id))return id;
  const base=VEHICLES[BASE_ID],br=ROTORS[BASE_ROTOR],k=r.radius/BASE_RADIUS;
  let rotorId=BASE_ROTOR;
  if(r.radius!==BASE_RADIUS){
    rotorId=`${BASE_ROTOR}-${r.id}`;
    if(!exists(getRotor,rotorId))registerRotor(defineRotor({id:rotorId,label:{en:`OsirisZk Mars rotor, R ${r.radius} m (scaled)`,tr:`OsirisZk Mars rotoru, R ${r.radius} m (ölçekli)`},
      radius:r.radius,blades:br.blades,root:br.root,airfoil:br.airfoil,stations:br.stations.length,chord:br.chord,twist:br.twist,
      inertia:br.inertia*k**4,pitchOffset:br.pitchOffset,notes:{all:`concept rotor scaled ×${k.toFixed(2)} (assumed)`},source:null}));
  }
  const arm=Math.max(.75,1.485*r.radius);
  const components=base.components.map(c=>c.name==='science camera'?{...c,name:`science camera (${cam.id})`,mass:cam.mass}:c);
  registerVehicle({...base,id,rotor:rotorId,
    label:{en:`Base Pathfinder scout (R ${r.radius} m, ${b.parallel}P battery, ${cam.id} camera)`,tr:`Base Pathfinder keşif dronu (R ${r.radius} m, ${b.parallel}P batarya, ${cam.id} kamera)`},
    layout:{...base.layout,arms:quadArms(arm)},
    rotorMass:base.rotorMass*k*k,components,
    battery:defineBattery({...base.battery,id:`osiris-battery-${b.parallel}p`,parallel:b.parallel}),
    avionicsPower:base.avionicsPower+cam.power,
    notes:{...base.notes,derived:'Base Pathfinder design from the OsirisZk Mars quad concept: rotor, battery and camera scaled as stated in design.js (assumed rules)'},
    camera:cam,design:{...design}});
  return id;
}

/** Ground sample distance (m/pixel) at height H (m): GSD = H · pixel pitch / focal length. */
export const gsd=(cam,H)=>H*cam.pitch/cam.focal;
/** Field of view (rad) across and along track (the long side of the sensor across the track). */
export const fov=cam=>({across:2*Math.atan(cam.px[0]*cam.pitch/2/cam.focal),along:2*Math.atan(cam.px[1]*cam.pitch/2/cam.focal)});
/** Ground footprint (m) of one photo at height H: width across track, length along track. */
export function footprint(cam,H){const f=fov(cam);return {across:2*H*Math.tan(f.across/2),along:2*H*Math.tan(f.along/2)};}
