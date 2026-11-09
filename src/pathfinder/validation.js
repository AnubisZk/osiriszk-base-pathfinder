import {Simulation} from '../sim/Simulation.js';
import {deriveVehicle,budget,cameraOf} from './design.js';
import {planSurvey} from './route.js';
import {flightAtmosphere,utcForLocalTime} from './environment.js';

/**
 * Mission validation before any flight (brief: budget, total mass, rotor thrust, ability to take
 * off, energy sufficiency, range). Uses the SAME vehicle model and flight-control trim the
 * simulation flies with, at each site's own air density. Every failure comes with the reason in
 * numbers and the ways to fix it (educational feedback); nothing is decided by a random roll.
 */
export const MARGINS=Object.freeze({thrustToWeight:1.3,reserve:.15}); // assumed design margins
export const TURN=Object.freeze({base:3.5,perSpeed:2}); // s per waypoint (calibrated, see below)

/** Mission spec for one site's survey flight (shared by validation and the survey). */
export function surveySpec(design,site,route){
  const vehicle=deriveVehicle(design),cam=cameraOf(design),plan=planSurvey(cam,route),atm=flightAtmosphere(site,site.models);
  return {plan,atm,spec:{vehicle,frame:design.frame,payload:0,profile:'mars-brief',overrides:atm.overrides,siteElevation:0,
    date:utcForLocalTime(site.data.longitude.value,11),site:{lat:site.data.latitude.value,lonEast:site.data.longitude.value},
    seed:site.seed,wind:{level:route.wind??'calm',direction:225},cruiseAltitude:plan.altitude,speed:plan.speed,reserve:MARGINS.reserve,
    returnHome:true,control:'autonomous',waypoints:plan.waypoints,timeLimit:Math.round(plan.distance/plan.speed+plan.lines*2*10+120),opticalDepth:site.data.dust.value,solarSols:3}};
}

const msg=(id,severity,en,tr,fixes=[])=>({id,severity,en,tr,fixes});

/** Validate a design + route at each site. Returns per-site checks and the overall verdict. */
export function validateMission(design,sites,route){
  const b=budget(design),global=[];
  if(!b.within)global.push(msg('budget','error',
    `Over budget by ${(-b.remaining).toFixed(0)} M USD (representative costs): ${b.total} M of ${b.total+b.remaining} M.`,
    `Bütçe ${(-b.remaining).toFixed(0)} milyon USD aşılıyor (temsili maliyetler): ${b.total+b.remaining} milyonun ${b.total} milyonu.`,
    [{en:'Choose a cheaper rotor, battery or camera',tr:'Daha ucuz rotor, batarya ya da kamera seçin'}]));
  const perSite=sites.map(site=>{
    const {spec,plan,atm}=surveySpec(design,site,route);
    const sim=new Simulation({...spec,timeLimit:1e6},{terrain:false,record:false});
    const v=sim.vehicle,ctl=sim.control,W=ctl.W,n=v.rotors.length;
    const tMax=v.spec.kind==='coax'?(ctl.trim?.thrustMax??0):(ctl.tMax??0)*n;
    const e0=sim.budget,checks=[],name=site.label;
    // The planning estimate (Mission.js) has no time for stopping at each line end; the executive
    // decelerates, settles within 1.2 m and turns. Calibrated against this simulator for the scout
    // drone (speeds 2–6 m/s): about 3.5 s + 2 s per m/s of cruise speed per waypoint, at hover power.
    const turns=plan.waypoints.length+1,turnTime=turns*(TURN.base+TURN.perSpeed*plan.speed);
    const e={...e0,turnTime,flightTime:e0.flightTime+turnTime,energyWh:e0.energyWh+turnTime*e0.hoverPower/3600};
    e.margin=e.availableWh-e.energyWh;e.feasible=ctl.canHover&&e.energyWh<=e.availableWh;
    const tw=W>0?tMax/W:0;
    if(!ctl.canHover)checks.push(msg('takeoff','error',
      `Your drone cannot take off at ${name.en}: the maximum rotor thrust (${tMax.toFixed(1)} N) is lower than its weight on Mars (${W.toFixed(1)} N) in air of ${atm.density.toFixed(4)} kg/m³.`,
      `Dronunuz ${name.tr} bölgesinde kalkamaz: en büyük rotor itkisi (${tMax.toFixed(1)} N) Mars'taki ağırlığından (${W.toFixed(1)} N) küçük; hava yoğunluğu ${atm.density.toFixed(4)} kg/m³.`,
      [{en:'Increase the rotor radius',tr:'Rotor yarıçapını büyütün'},{en:'Reduce the mass (smaller battery or lighter camera)',tr:'Kütleyi azaltın (daha küçük batarya ya da hafif kamera)'},
       {en:'Choose a lower site (denser air)',tr:'Daha alçak bir bölge seçin (daha yoğun hava)'}]));
    else if(tw<MARGINS.thrustToWeight)checks.push(msg('margin','warning',
      `Thrust margin at ${name.en} is ${tw.toFixed(2)} × weight; climbs and gusts need at least ${MARGINS.thrustToWeight} (assumed).`,
      `${name.tr} bölgesinde itki payı ağırlığın ${tw.toFixed(2)} katı; tırmanış ve rüzgâr için en az ${MARGINS.thrustToWeight} gerekir (varsayım).`,
      [{en:'Increase the rotor radius or reduce the mass',tr:'Rotor yarıçapını büyütün ya da kütleyi azaltın'}]));
    if(ctl.canHover&&!e.feasible)checks.push(msg('energy','error',
      `At ${name.en} the survey needs about ${e.energyWh.toFixed(0)} Wh; the battery can give ${e.availableWh.toFixed(0)} Wh after the ${(MARGINS.reserve*100).toFixed(0)} % reserve.`,
      `${name.tr} bölgesinde tarama yaklaşık ${e.energyWh.toFixed(0)} Wh ister; batarya %${(MARGINS.reserve*100).toFixed(0)} yedekten sonra ${e.availableWh.toFixed(0)} Wh verebilir.`,
      [{en:'Survey a smaller area',tr:'Daha küçük bir alan tarayın'},{en:'Fly higher (wider swath, fewer lines)',tr:'Daha yüksekten uçun (geniş şerit, az çizgi)'},
       {en:'Reduce the side overlap',tr:'Yan bindirmeyi azaltın'},{en:'Take a bigger battery',tr:'Daha büyük batarya alın'}]));
    // range at cruise speed with the energy available (straight line, no hover segments)
    const range=ctl.canHover&&Number.isFinite(e.cruisePower)?e.availableWh*3600/e.cruisePower*plan.speed:0;
    for(const w of plan.warnings)checks.push(msg(w.id,'warning',w.en,w.tr));
    const res={site:site.id,label:site.label,mass:v.built.mass,weight:W,maxThrust:tMax,thrustToWeight:tw,canHover:ctl.canHover,density:atm.density,
      hoverPower:e.hoverPower,cruisePower:e.cruisePower,energyWh:e.energyWh,availableWh:e.availableWh,margin:e.margin,flightTime:e.flightTime,
      range,routeLength:plan.distance,plan,checks,ok:!checks.some(c=>c.severity==='error')};
    sim.dispose();return res;
  });
  const ok=b.within&&perSite.every(s=>s.ok);
  return {budget:b,global,perSite,ok};
}
