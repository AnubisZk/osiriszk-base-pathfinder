import {PlanetEnvironment} from '../planet/PlanetEnvironment.js';
import {PlanetPhysics} from '../planet/PlanetPhysics.js';
import {buildVehicle} from '../vehicles/build.js';
import {RotorcraftVehicle} from '../vehicles/RotorcraftVehicle.js';
import {FlightControl} from '../control/FlightControl.js';
import {ProceduralTerrain} from '../terrain/terrain.js';
import {PlanetWind} from './PlanetWind.js';
import {Telemetry} from './Telemetry.js';
import {MissionRunner,energyBudget,DEFAULT_MISSION} from '../mission/Mission.js';
import {earthMarsLink,sunPosition} from '../mars/time.js';
import {earthSunPosition} from '../earth/sun.js';

/**
 * One simulation: environment, Rapier world, terrain, vehicle, flight control, mission executive,
 * wind and telemetry. Physics advances in fixed 240 Hz steps; `advance(frameDt)` is the real-time
 * entry for the renderer, `run(seconds)` the headless entry for experiments. Rendering never
 * writes to physics.
 */
export class Simulation {
  /** spec: a mission spec (see Mission.js); `terrain` may be shared between runs (read-only). */
  constructor(spec={},{terrain=null,record=true}={}){
    const s=this.spec={...DEFAULT_MISSION,...spec,wind:{...DEFAULT_MISSION.wind,...spec.wind}};
    this.environment=new PlanetEnvironment(s.profile,s.overrides??{});
    this.wind=new PlanetWind({environment:this.environment,level:s.wind.level,direction:s.wind.direction,seed:s.seed});
    this.physics=new PlanetPhysics(this.environment,{siteElevation:s.siteElevation,wind:this.wind});
    this.planet=this.environment.planet;
    this.terrain=terrain===false?null:(terrain??new ProceduralTerrain({seed:s.seed,planet:this.planet}));
    if(this.terrain)this.terrain.addToPhysics(this.physics);else this.physics.addGround();
    this.built=buildVehicle(s.vehicle,{frame:s.frame,payload:s.payload,rotorLossFactor:s.rotorLossFactor??null});
    const start=s.start??[0,0];
    const gy=this.terrain?this.terrain.heightAt(start[0],start[1]):0;
    this.vehicle=new RotorcraftVehicle(this.physics,this.built,{position:[start[0],gy-Math.min(...this.built.feet.map(f=>f[1]))+.03,start[1]],wind:this.wind});
    this.physics.step(); // settle colliders and scene queries
    this.control=new FlightControl(this.vehicle);
    this.physics.addForceHook((ph,dt)=>{this.mission?.update(dt);this.control.update(dt);},{first:true});
    // On Earth the pilot is local (no light time) and the Sun follows the NOAA equations.
    this.link=this.planet==='earth'?{distanceAU:0,distanceKm:0,oneWayLightTime:0,local:true}:earthMarsLink(s.date);
    this.sun=(this.planet==='earth'?earthSunPosition:sunPosition)(s.date,s.site.lat,s.site.lonEast);
    this.telemetry=new Telemetry(.1);this.record=record;
    this.mission=new MissionRunner(this,s);this.budget=energyBudget(this,s);
  }
  get time(){return this.physics.time;}
  start(){this.mission.start();}
  step(){this.physics.step();if(this.record)this.telemetry.sample(this);}
  /** Real-time entry: returns the render interpolation factor. */
  advance(frameDt){return this.physics.advance(frameDt,()=>{if(this.record)this.telemetry.sample(this);});}
  /** Headless run until the mission ends or `seconds` pass. */
  run(seconds=this.spec.timeLimit+5){
    const n=Math.round(seconds/this.physics.fixedDt);
    for(let i=0;i<n&&!this.mission.result;i++)this.step();
    if(!this.mission.result)this.mission.finish(false,'time limit');
    return this.mission.result;
  }
  dispose(){this.vehicle.dispose();this.physics.dispose();}
}
