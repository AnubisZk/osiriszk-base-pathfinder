import {Simulation} from '../sim/Simulation.js';
import {ProceduralTerrain} from '../terrain/terrain.js';
import {cameraOf,gsd,footprint} from './design.js';
import {surveySpec} from './validation.js';
import {onSurveyLine} from './route.js';
import {analyseSurvey} from './photogrammetry.js';

/**
 * The autonomous survey flight at one site, in the existing simulator: Rapier rigid body, rotor
 * aerodynamics in the site's air, motor and battery models, the on-board mission executive
 * (autonomous, because of the Earth–Mars light time). Added here: a camera that fires along the
 * survey lines every `photoSpacing` metres when the drone is level and at survey height.
 *
 * Terrain: the site's SYNTHETIC terrain (ProceduralTerrain with the site's assumed relief, crater
 * density and rock abundance) unless a real DTM is passed. The analysis labels its results
 * 'simulation' accordingly.
 */
// 300 m × 300 m around the landing point: with 512 cells the grid is 0.59 m, fine enough for
// slopes over a 2 m baseline; rocks are generated over ±80 m so the Golombek model is not capped.
export const SURVEY_TERRAIN=Object.freeze({size:300,rockArea:80,maxRocks:40000});
export function siteTerrain(site,{cells=512}={}){
  return new ProceduralTerrain({seed:site.seed,cells:[cells,cells],size:[SURVEY_TERRAIN.size,SURVEY_TERRAIN.size],rockArea:SURVEY_TERRAIN.rockArea,
    maxRocks:SURVEY_TERRAIN.maxRocks,...site.terrain,planet:'mars'});
}

/** Camera trigger bound to a simulation. */
export class SurveyCamera {
  constructor(sim,camera,plan){this.sim=sim;this.camera=camera;this.plan=plan;this.photos=[];this.last=null;this.rejected={tilt:0,height:0};}
  update(){
    const sim=this.sim,m=sim.mission;if(!m||m.phase!=='transit'||!onSurveyLine(m.wp,this.plan.lines))return;
    const v=sim.vehicle,p=v.position,ground=sim.terrain?sim.terrain.heightAt(p.x,p.z):0,agl=p.y-ground-v.footClearance;
    if(this.last&&Math.hypot(p.x-this.last.x,p.z-this.last.z)<this.plan.photoSpacing)return;
    const q=v.body.rotation(),tilt=Math.acos(Math.min(1,1-2*(q.x*q.x+q.z*q.z)))*57.29578;
    if(tilt>15){this.rejected.tilt++;return;}
    if(Math.abs(agl-this.plan.altitude)>.3*this.plan.altitude){this.rejected.height++;return;}
    const fp=footprint(this.camera,agl);
    this.photos.push({t:sim.time,x:p.x,z:p.z,agl,tilt,gsd:gsd(this.camera,agl),across:fp.across,along:fp.along,line:(m.wp-1)/2});
    this.last={x:p.x,z:p.z};
  }
}

/**
 * Fly the survey at one site. Returns {result, photos, track (thinned telemetry for replay),
 * analysis (photogrammetry), plan, atmosphere, spec}. Deterministic for the same inputs.
 */
export function runSurvey(design,site,route,{terrain=null,cells=512,trackEvery=.2,onProgress=null}={}){
  const {spec,plan,atm}=surveySpec(design,site,route),cam=cameraOf(design);
  const ter=terrain??siteTerrain(site,{cells});
  const sim=new Simulation(spec,{terrain:ter,record:true});
  const camera=new SurveyCamera(sim,cam,plan);
  sim.physics.addForceHook(()=>camera.update());
  sim.start();
  const n=Math.round((spec.timeLimit+5)/sim.physics.fixedDt),every=Math.max(1,Math.round(n/100));
  for(let i=0;i<n&&!sim.mission.result;i++){sim.step();if(onProgress&&i%every===0)onProgress(i/n);}
  if(!sim.mission.result)sim.mission.finish(false,'time limit');
  const T=sim.telemetry.cols,track=[];let next=0;
  for(let i=0;i<T.t.length;i++)if(T.t[i]>=next){track.push([T.t[i],T.x[i],T.y[i],T.z[i],T.roll[i],T.pitch[i],T.yaw[i],T.rpm0[i],T.soc[i],T.power[i],T.agl[i]]);next=T.t[i]+trackEvery;}
  const analysis=analyseSurvey({terrain:ter,photos:camera.photos,plan,camera:cam,seed:site.seed});
  const out={site:site.id,result:sim.mission.result,photos:camera.photos,rejected:camera.rejected,track,trackColumns:['t','x','y','z','roll','pitch','yaw','rpm','soc','power','agl'],
    analysis,plan,atmosphere:atm,budget:sim.budget,spec:{...spec,waypoints:undefined},terrainLabel:ter.meta.label,procedural:!!ter.meta.procedural};
  sim.dispose();
  return out;
}
