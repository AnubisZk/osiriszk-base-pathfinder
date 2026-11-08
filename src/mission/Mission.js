import {DelayedLink} from './DelayedLink.js';
import {simulateSols} from '../power/solar.js';

/**
 * Mission definition, pre-flight energy budget and the on-board mission executive.
 *
 * spec: {vehicle, frame, payload, profile, overrides, siteElevation, date (UTC ms), site {lat, lonEast},
 *        seed, wind {level, direction}, cruiseAltitude (m AGL), speed (m/s), reserve (fraction of usable
 *        energy kept), waypoints [{x, z, action: 'observe'|'pass', dwell (s), name}], returnHome,
 *        control: 'autonomous' | 'earth-fpv' | 'local-fpv', timeLimit (s)}
 */
export const DEFAULT_MISSION=Object.freeze({
  vehicle:'ingenuity-like',frame:'carbon',payload:0,profile:'mars-brief',overrides:{},siteElevation:0,
  date:Date.UTC(2026,10,14,17,0,0)/* ≈ 10:30 local solar time at Jezero */,site:{lat:18.4447,lonEast:77.4508},seed:2026,wind:{level:'calm',direction:225},
  cruiseAltitude:5,speed:3,reserve:.15,returnHome:true,control:'autonomous',timeLimit:240,
  opticalDepth:.5,panelArea:null,dustPerSol:.002,solarSols:10,
  waypoints:[{x:0,z:-40,action:'observe',dwell:4,name:'Rock outcrop A'},{x:30,z:-60,action:'observe',dwell:4,name:'Crater rim B'}],
});

const RPM=2*Math.PI/60;
/**
 * Energy budget before flight (planning estimate, independent of the simulation):
 * hover power from the rotor model (+ avionics), forward flight power from momentum theory
 * (induced velocity falls with speed) plus body parasite power ½ρV³CdA. Electrical efficiency
 * assumed 0.85 for the estimate; the simulation itself uses the motor model.
 */
export function energyBudget(sim,spec){
  const ctl=sim.control,v=sim.vehicle,env=sim.environment,W=ctl.W,rho=env.density(sim.physics.altitude(v.position.y));
  const rotors=v.rotors.length,A=v.rotors[0].rotor.disk*(v.spec.kind==='coax'?1:rotors);
  let hoverShaft;
  if(v.spec.kind==='coax')hoverShaft=ctl.trim.power;
  else{const T=W/rotors,c=ctl.curve.find(r=>r[1]>=T);hoverShaft=c?rotors*c[2]*c[0]:Infinity;}
  const eta=.85,avionics=v.spec.avionicsPower,vh=Math.sqrt(W/(2*rho*A));
  const cdA=(()=>{const d=v.built.drag;return 1.2*d.tubes[2]+1.17*d.plates[2]+1.05*d.boxes[2];})();
  const power=V=>{
    // induced velocity in forward flight (Glauert, level): v_i⁴ + V² v_i² − v_h⁴ = 0
    const vi=Math.sqrt((-V*V+Math.sqrt(V**4+4*vh**4))/2),induced=hoverShaft*.6*(vi/vh)+hoverShaft*.4; // ~60 % induced share in hover (assumed)
    return (induced+.5*rho*V**3*cdA)/eta+avionics;
  };
  const pts=[[0,0],...spec.waypoints.map(w=>[w.x,w.z]),...(spec.returnHome?[[0,0]]:[])];
  let dist=0;for(let i=1;i<pts.length;i++)dist+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const climbTime=spec.cruiseAltitude/Math.max(.3,v.spec.control.maxClimb*.6)*2,dwell=spec.waypoints.reduce((s,w)=>s+(w.action==='observe'?w.dwell:0),0);
  if(!ctl.canHover)return {routeLength:dist,cruiseTime:NaN,hoverTime:NaN,spinupTime:NaN,flightTime:NaN,hoverPower:NaN,cruisePower:NaN,energyWh:NaN,usableWh:v.battery.remainingWh(),availableWh:v.battery.remainingWh()*(1-spec.reserve),margin:NaN,feasible:false,canHover:false};
  const cruise=dist/spec.speed,spinup=v.spec.kind==='coax'?((ctl.rpmSetpoint??v.spec.rpm.nominal)/400):0;
  const hoverTime=climbTime+dwell+4,hoverP=power(0),cruiseP=power(spec.speed);
  const energy=(hoverTime*hoverP+cruise*cruiseP+spinup*.5*hoverP)/3600;
  const usable=v.battery.remainingWh(),available=usable*(1-spec.reserve);
  const solar=solarPlan(sim,energy,spec);
  return {routeLength:dist,cruiseTime:cruise,hoverTime,spinupTime:spinup,flightTime:hoverTime+cruise+spinup,hoverPower:hoverP,cruisePower:cruiseP,
    energyWh:energy,usableWh:usable,availableWh:available,margin:available-energy,feasible:ctl.canHover&&energy<=available,canHover:ctl.canHover,
    solar:solar&&{flights:solar.flights,sols:solar.days.length,flyToday:solar.days[0].flew,harvestWh:solar.meanHarvestWh,nightWh:solar.meanNightWh,minSoC:solar.minSoC,survived:solar.survived}};
}

/**
 * Energy over sols for this vehicle at this site and season: solar charging, night heating and one
 * flight of `energyWh` per sol at the mission's local solar time when the battery allows it.
 */
export function solarPlan(sim,energyWh,spec=sim.spec){
  // The multi-sol model uses the Mars Sun, sol length and Mars thermal ranges: Mars only.
  if(!Number.isFinite(energyWh)||sim.environment.planet!=='mars')return null;
  const day=spec.date-((sim.sun.localSolarTime/24)*88775244); // local midnight before the mission
  return simulateSols({vehicle:sim.built.spec,site:spec.site,start:day,sols:spec.solarSols??10,tau:spec.opticalDepth??.5,
    dustPerSol:spec.dustPerSol??.002,panelArea:spec.panelArea??null,flight:{energyWh,lst:sim.sun.localSolarTime}});
}

/** On-board mission executive: phases, waypoint logic, observations, failure detection. */
export class MissionRunner {
  constructor(sim,spec){
    this.sim=sim;this.spec=spec;this.phase='preflight';this.wp=0;this.dwell=0;this.observations=[];this.result=null;
    this.maxTilt=0;this.distance=0;this.last=null;this.posErr=[];this.homeY=null;
    const c=spec.control;
    this.link=c==='earth-fpv'?new DelayedLink(spec.linkDelay??sim.link.oneWayLightTime):c==='local-fpv'?new DelayedLink(0):null;
    if(this.link)this.spec={...spec,waypoints:spec.waypoints.map(w=>({...w}))};
  }
  /** Ground height (terrain) under a point. */
  ground(x,z){return this.sim.terrain?this.sim.terrain.heightAt(x,z):0;}
  start(){const v=this.sim.vehicle;if(!v.arm()){this.finish(false,'battery');return;}this.phase='takeoff';this.sim.telemetry.event(this.sim.time,'arm');
    const p=v.position;this.homeY=p.y;this.sim.control.setTarget([p.x,this.ground(p.x,p.z)+v.footClearance+this.spec.cruiseAltitude,p.z]);}
  /** Pilot input (FPV modes): goes through the link; returns arrival info. */
  pilot(stick){if(!this.link)return null;this.link.send(this.sim.time,stick);return {arrivesIn:this.link.delay};}
  update(dt){
    const sim=this.sim,v=sim.vehicle,ctl=sim.control,s=this.spec;if(this.result)return;
    const p=v.position,vel=v.velocity;
    if(this.last)this.distance+=Math.hypot(p.x-this.last.x,p.z-this.last.z);this.last={x:p.x,z:p.z};
    // failure detection
    const q=v.body.rotation(),tilt=Math.acos(Math.min(1,1-2*(q.x*q.x+q.z*q.z)))*57.29578;this.maxTilt=Math.max(this.maxTilt,tilt);
    if(tilt>70&&this.phase!=='preflight'){this.finish(false,'crash: attitude lost');return;}
    if(v.cutoff){this.finish(false,'battery depleted in flight');return;}
    if(sim.time>s.timeLimit){this.finish(false,'time limit');return;}
    if(this.link){
      // FPV through the link: autonomous take-off, then pilot commands as they arrive. On-board
      // failsafe: no fresh command → hold position; 20 s without one → land (assumed policy).
      if(this.phase==='takeoff'){
        if(ctl.status==='flying'&&Math.abs(p.y-ctl.target.position[1])<.4){this.phase='piloted';this.noLink=0;}
        return;
      }
      if(this.phase==='piloted'){
        const r=this.link.receive(sim.time);
        if(r.command&&!r.stale&&r.age<this.link.delay+1){ctl.setManual(r.command);this.noLink=0;}
        else{if(ctl.mode==='manual')ctl.setTarget([p.x,p.y,p.z]);this.noLink+=dt;
          if(this.noLink>20){this.phase='landing';ctl.land();sim.telemetry.event(sim.time,'link-timeout');}}
        for(const w of s.waypoints){
          if(w.action!=='observe'||this.observations.some(o=>o.name===w.name))continue;
          const d=Math.hypot(w.x-p.x,w.z-p.z);
          if(d<3&&Math.hypot(vel.x,vel.z)<.6){w._dwell=(w._dwell??0)+dt;if(w._dwell>=(w.dwell??3)){this.observations.push({name:w.name,t:sim.time,x:p.x,z:p.z,error:d});sim.telemetry.event(sim.time,'observe',{name:w.name});}}
          else w._dwell=0;
        }
        const agl=(v.out.groundHeight??9)-v.footClearance;
        if(ctl.mode==='manual'&&agl<.15&&vel.y<=0){this.phase='landing';ctl.land();}
        return;
      }
      if(this.phase==='landing'&&!v.armed){
        const need=s.waypoints.filter(w=>w.action==='observe').length,ok=this.observations.length===need;
        this.finish(ok,ok?'complete (piloted)':this.link.delay>0?'link delay: commands arrived too late; vehicle landed on failsafe':'landed with missing observations');
      }
      return;
    }
    const cruise=x=>this.ground(x[0],x[1])+v.footClearance+s.cruiseAltitude;
    const targets=[...s.waypoints,...(s.returnHome?[{x:0,z:0,action:'pass',name:'home'}]:[])];
    if(this.phase==='takeoff'){
      if(ctl.status==='flying'&&Math.abs(p.y-ctl.target.position[1])<.3&&Math.abs(vel.y)<.3){if(!targets.length){this.phase='hover';return;}this.phase='transit';this.goTo(targets[0]);}
      // lift-off check: still on the ground long after the rotors are up to speed
      const agl=(v.out.groundHeight??0)-v.footClearance;
      this.groundTime=agl<.1?(this.groundTime??0)+dt:0;
      if(this.groundTime>(v.spec.kind==='coax'?20:6)){const limited=v.rotors.some(r=>r.motor.current>=.98*v.spec.motor.maxCurrent);v.disarm();this.finish(false,!ctl.canHover?'cannot take off: maximum thrust below weight':limited?'did not lift off: motor current (torque) limit':'did not lift off');}
      return;
    }
    if(this.phase==='transit'||this.phase==='observe'){
      const w=targets[this.wp],dx=w.x-p.x,dz=w.z-p.z,d=Math.hypot(dx,dz);
      // keep cruise altitude above the terrain ahead
      ctl.target.position[1]=Math.max(cruise([p.x+Math.sign(dx)*Math.min(5,Math.abs(dx)),p.z+Math.sign(dz)*Math.min(5,Math.abs(dz))]),cruise([w.x,w.z]));
      if(this.phase==='transit'&&d<1.2&&Math.hypot(vel.x,vel.z)<.6){
        if(w.action==='observe'){this.phase='observe';this.dwell=0;}
        else this.next(targets);
      }
      if(this.phase==='observe'){
        this.dwell+=dt;this.posErr.push(d);
        if(this.dwell>=(w.dwell??3)){this.observations.push({name:w.name,t:sim.time,x:p.x,z:p.z,agl:p.y-this.ground(p.x,p.z)-v.footClearance,error:d});sim.telemetry.event(sim.time,'observe',{name:w.name});this.next(targets);}
      }
      return;
    }
    if(this.phase==='landing'&&!v.armed&&ctl.status==='landed'){
      const ok=this.observations.length===s.waypoints.filter(w=>w.action==='observe').length;
      this.finish(ok,ok?'complete':'landed with missing observations');
    }
  }
  goTo(w){const v=this.sim.vehicle;this.sim.control.setTarget([w.x,this.ground(w.x,w.z)+v.footClearance+this.spec.cruiseAltitude,w.z],{speed:this.spec.speed,yaw:null});}
  next(targets){this.wp++;if(this.wp>=targets.length){this.phase='landing';this.sim.control.land();return;}this.phase='transit';this.goTo(targets[this.wp]);}
  finish(success,reason){
    const sim=this.sim,v=sim.vehicle,T=sim.telemetry;T.sample(sim,true);
    const hover=T.stats('rateNorm',['observe']),tilt=T.stats('tilt',['transit','observe']);
    this.result={success,reason,flightTime:sim.time,energyWh:v.energyWh,distance:this.distance,observations:this.observations.length,
      requiredObservations:this.spec.waypoints.filter(w=>w.action==='observe').length,maxTilt:this.maxTilt,
      hoverRateRms:hover.rms,tiltRms:tilt.rms,positionErrorRms:this.posErr.length?Math.sqrt(this.posErr.reduce((s,x)=>s+x*x,0)/this.posErr.length):NaN,
      socEnd:v.battery.soc,mass:v.built.mass};
    this.phase=success?'complete':'failed';sim.telemetry.event(sim.time,success?'complete':'failed',{reason});
  }
}
