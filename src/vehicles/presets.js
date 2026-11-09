import {defineMotor} from '../power/motor.js';
import {defineBattery} from '../power/battery.js';

/**
 * Vehicle definitions. Published values carry a source; everything else is marked assumed in
 * `notes`. A vehicle with a published total mass gets a 'misc (calibration)' mass so that the
 * reference frame reproduces it; changing the frame then changes the total by the frame difference.
 */
export const VEHICLE_SOURCES=Object.freeze({
  jplPressKit:{title:'NASA/JPL Ingenuity landing press kit – spacecraft',url:'https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft'},
  nasaMarsHeliCapabilities:{title:'NASA Ames, Mars helicopter capabilities (Ingenuity and Mars Science Helicopter), Tables 2–6',url:'https://rotorcraft.arc.nasa.gov/Publications/files/MarsHeliCapabilities_Final_Update.pdf'},
  nasaGeometry:{title:'Koning et al., Ingenuity rotor geometry, NASA TM 2024',url:'https://ntrs.nasa.gov/api/citations/20240001510/downloads/1699_Koning_TM_082124.pdf'},
  grip2021:{title:'H. Grip (JPL), Flying on Mars Is Getting Harder and Harder, NASA 2021',url:'https://science.nasa.gov/missions/mars-2020-perseverance/ingenuity-helicopter/flying-on-mars-is-getting-harder-and-harder/'},
  zskCore:{title:'ZSK flight core, freestyle5 airframe',url:null},
});
const RPM=2*Math.PI/60;
const quadArms=r=>[[-r/Math.SQRT2,-r/Math.SQRT2],[r/Math.SQRT2,-r/Math.SQRT2],[-r/Math.SQRT2,r/Math.SQRT2],[r/Math.SQRT2,r/Math.SQRT2]];
const hexArms=r=>Array.from({length:6},(_,k)=>{const a=(30+60*k)*Math.PI/180;return [r*Math.cos(a),r*Math.sin(a)];});
const feet=(r,y,n=4)=>Array.from({length:n},(_,k)=>{const a=(45+360/n*k)*Math.PI/180;return [r*Math.cos(a),y,r*Math.sin(a)];});

export const VEHICLES=Object.freeze({
  'ingenuity-like':Object.freeze({
    id:'ingenuity-like',kind:'coax',label:{en:'Ingenuity-like coaxial helicopter',tr:'Ingenuity benzeri eş eksenli helikopter'},
    rotor:'ingenuity',spins:[1,-1], // upper counter-clockwise seen from above, lower clockwise
    rpm:{nominal:2537,max:2800,min:2400},publishedMass:1.8,
    layout:{kind:'coax',body:[.136,.163,.195],mast:{top:.29,hubs:[.2405,.1415]},feet:feet(.29,-.2115)},
    frameParams:{tubeOD:.008,tubeID:.006,mastOD:.022,mastID:.019,legOD:.010,legID:.008,cageRadius:.16,strutOD:.005,strutID:.003,nodeMass:.0015,hexRadius:.12,hexHeight:.17},
    components:[
      {group:'avionics',name:'avionics, cameras, sensors',mass:.30,center:[0,0,0],size:[.12,.12,.16]},
      {group:'motors',name:'upper motor',mass:.12,center:[0,.215,0],size:[.06,.04,.06]},
      {group:'motors',name:'lower motor',mass:.12,center:[0,.115,0],size:[.06,.04,.06]},
      {group:'swashplates',name:'swashplates and servos',mass:.10,center:[0,.18,0],size:[.08,.12,.08]},
      {group:'solar',name:'solar panel',mass:.05,center:[0,.29,0],size:[.20,.005,.14]},
    ],
    rotorMass:.10,motor:defineMotor({id:'ing-motor',kv:200,resistance:.15,noLoadCurrent:.3,maxCurrent:20,escEfficiency:.95}),
    battery:defineBattery({id:'ing-battery',series:6,parallel:1,cellCapacityAh:2.0,cellResistance:.02,cellMass:.045,reserve:.55}),
    batteryCenter:[0,-.03,0],avionicsPower:20,
    // panel 425 × 165 mm (JPL); cell efficiency, packing and charge efficiency assumed
    solar:{area:.0701,efficiency:.28,packing:.9,chargeEfficiency:.9},
    // night survival: battery kept at −15 °C (setpoints −15…−25 °C reported); conductance and sleep power
    // assumed so a spring night costs ≈ 20 Wh (most electronics off at night)
    thermal:{conductance:.016,setpoint:258.15,sleepPower:.25},
    flapping:{tau:.03,hubStiffness:2,maxTiltDeg:8},
    control:{maxTiltDeg:12,maxClimb:2,maxDescent:1.5,maxSpeed:6,yawRateDeg:60},
    notes:{
      mass:'sourced 1.8 kg (JPL)',body:'sourced 13.6 × 19.5 × 16.3 cm (JPL)',legs:'sourced 0.384 m, clearance 0.13 m (JPL)',
      rpm:'2537 rpm flown, 2800 rpm maximum (Grip 2021); 2575 rpm design (NASA Ames)',power:'≈ 350 W in flight (JPL)',
      battery:'six Li-ion cells (JPL); 2.0 Ah cell, 45 g, 0.02 Ω and 55 % reserve are assumed',
      hubs:'rotor spacing 0.099 m sourced; hub heights assumed',components:'component masses assumed',motor:'assumed',
    },
    sources:['jplPressKit','nasaGeometry','nasaMarsHeliCapabilities','grip2021'],
  }),
  fpv5:Object.freeze({
    id:'fpv5',kind:'multirotor',label:{en:'Standard 5" FPV quad',tr:'Standart 5" FPV dron'},
    rotor:'fpv5',spins:[1,-1,-1,1],rpm:{max:46000,min:2000},publishedMass:.65,
    layout:{kind:'multirotor',body:[.09,.035,.09],arms:quadArms(.1125),armHeight:0,feet:feet(.05,-.03)},
    frameParams:{plate:.004,armOD:.012,armID:.008,legOD:.004,legID:.002,cageRadius:.05,strutOD:.003,strutID:.0018,nodeMass:.0004,hexRadius:.045,hexHeight:.035},
    components:[
      {group:'avionics',name:'flight controller, VTX, camera',mass:.06,center:[0,.005,-.02],size:[.04,.03,.04]},
      {group:'motors',name:'motors',mass:.032,perMount:true,size:[.028,.02,.028]},
    ],
    rotorMass:.005,motor:defineMotor({id:'fpv-motor',kv:1950,resistance:.07,noLoadCurrent:1.2,maxCurrent:45,escEfficiency:.95,speedGain:6,speedIntegral:40}),
    battery:defineBattery({id:'fpv-battery',series:6,parallel:1,cellCapacityAh:1.3,cellResistance:.006,cellMass:.035,reserve:.2}),
    batteryCenter:[0,.03,0],avionicsPower:5,
    solar:{area:0,efficiency:0,packing:1,chargeEfficiency:1},thermal:{conductance:.02,setpoint:258.15,sleepPower:.5},
    control:{maxTiltDeg:30,maxClimb:5,maxDescent:3,maxSpeed:15,yawRateDeg:180},
    notes:{mass:'0.65 kg and 225 mm diagonal from the ZSK core freestyle5',all:'motor, battery and component values assumed typical'},
    sources:['zskCore'],
  }),
  'osiris-mars-quad':Object.freeze({
    id:'osiris-mars-quad',kind:'multirotor',label:{en:'OsirisZk Mars quad (concept)',tr:'OsirisZk Mars dörtlüsü (kavram)'},
    rotor:'osiris-mars',spins:[1,-1,-1,1],rpm:{max:3000,min:800},publishedMass:null,
    layout:{kind:'multirotor',body:[.22,.12,.22],arms:quadArms(.75),armHeight:.08,feet:feet(.3,-.30)},
    frameParams:{plate:.003,armOD:.022,armID:.020,legOD:.010,legID:.008,cageRadius:.17,strutOD:.006,strutID:.0045,nodeMass:.002,hexRadius:.15,hexHeight:.12},
    components:[
      {group:'avionics',name:'avionics and navigation camera',mass:.30,center:[0,0,0],size:[.14,.08,.14]},
      {group:'payload',name:'science camera',mass:.20,center:[0,-.08,-.08],size:[.08,.06,.08]},
      {group:'motors',name:'motors',mass:.15,perMount:true,size:[.06,.04,.06]},
    ],
    rotorMass:.12,motor:defineMotor({id:'osiris-motor',kv:200,resistance:.15,noLoadCurrent:.4,maxCurrent:30,escEfficiency:.95}),
    battery:defineBattery({id:'osiris-battery',series:6,parallel:2,cellCapacityAh:3.0,cellResistance:.03,cellMass:.047,reserve:.25}),
    batteryCenter:[0,-.02,0],avionicsPower:25,
    solar:{area:.25,efficiency:.28,packing:.9,chargeEfficiency:.9},thermal:{conductance:.05,setpoint:258.15,sleepPower:1.5},
    control:{maxTiltDeg:15,maxClimb:2,maxDescent:1.5,maxSpeed:8,yawRateDeg:45},
    notes:{all:'team concept: every value is a design assumption to be tested in the simulator'},
    sources:[],
  }),
  'msh-hexa':Object.freeze({
    id:'msh-hexa',kind:'multirotor',label:{en:'Mars Science Helicopter hexacopter (NASA concept)',tr:'Mars Bilim Helikopteri altılısı (NASA kavramı)'},
    rotor:'msh',spins:[1,-1,1,-1,1,-1],rpm:{max:2800,min:800,nominal:2435},publishedMass:20.8,
    layout:{kind:'multirotor',body:[.5,.3,.5],arms:hexArms(1.33),armHeight:.12,feet:feet(.55,-.55)},
    frameParams:{plate:.004,armOD:.04,armID:.037,legOD:.025,legID:.022,cageRadius:.38,strutOD:.012,strutID:.010,nodeMass:.01,hexRadius:.32,hexHeight:.3},
    components:[
      {group:'avionics',name:'avionics, telecom, thermal',mass:2.0,center:[0,0,0],size:[.3,.2,.3]},
      {group:'payload',name:'science payload',mass:2.0,center:[0,-.2,0],size:[.25,.15,.25]},
      {group:'motors',name:'motors',mass:.5,perMount:true,size:[.1,.08,.1]},
    ],
    rotorMass:.4,motor:defineMotor({id:'msh-motor',kv:110,resistance:.1,noLoadCurrent:.8,maxCurrent:60,escEfficiency:.95}),
    battery:defineBattery({id:'msh-battery',series:12,parallel:4,cellCapacityAh:3.0,cellResistance:.03,cellMass:.045,reserve:.25}),
    batteryCenter:[0,-.05,0],avionicsPower:60,
    solar:{area:1.2,efficiency:.28,packing:.9,chargeEfficiency:.9},thermal:{conductance:.25,setpoint:258.15,sleepPower:5},
    control:{maxTiltDeg:12,maxClimb:2,maxDescent:1.5,maxSpeed:10,yawRateDeg:30},
    notes:{mass:'20.8 kg with Ingenuity-type rotors (NASA Ames Table 2)',rotor:'R 0.64 m, 6 rotors × 6 blades, σ 0.25, 2435 rpm (NASA Ames)',
      arms:'arm radius 1.33 m assumed so the rotors do not overlap (the source quotes ≈ 2.5 m overall size; rotor overlap is not modelled)',
      battery:'assumed',components:'assumed'},
    sources:['nasaMarsHeliCapabilities'],
  }),
});
export const VEHICLE_ORDER=Object.freeze(['ingenuity-like','osiris-mars-quad','msh-hexa','fpv5']);
// Derived vehicles (e.g. a Base Pathfinder design: preset + player's rotor, battery and camera)
// are registered here at run time; the presets above stay frozen and unchanged.
const DERIVED=new Map();
export function registerVehicle(spec){
  if(!spec?.id||VEHICLES[spec.id])throw new RangeError(`A derived vehicle needs a new id (got '${spec?.id}')`);
  DERIVED.set(spec.id,Object.freeze(spec));return spec.id;
}
export const getVehicle=id=>{const v=VEHICLES[id]??DERIVED.get(id);if(!v)throw new RangeError(`Unknown vehicle '${id}'`);return v;};
export {RPM};
