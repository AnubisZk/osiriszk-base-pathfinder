// Earth simulator: NOAA Sun, Earth world defaults, planet-aware simulation (no light delay, no
// Mars multi-sol energy), Earth procedural terrain, experiments keyed by planet, both UI languages.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {earthSunPosition,ANKARA} from '../src/earth/sun.js';
import {ProceduralTerrain,EARTH_TERRAIN} from '../src/terrain/terrain.js';
import {Simulation} from '../src/sim/Simulation.js';
import {solarPlan} from '../src/mission/Mission.js';
import {runExperiment} from '../src/experiment/Experiment.js';
import {EARTH_EXPERIMENTS,EARTH_BASE,EXPERIMENTS} from '../src/experiment/presets.js';
import {WORLDS,resolveWorld,worldHref,worldSpec} from '../app/worlds.js';
import {STRINGS} from '../app/i18n.js';

await initializeRapier();
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg??''} ${a} vs ${b} ± ${tol}`);

test('Earth Sun (NOAA/Spencer): solstice noon elevations at Ankara, equation of time, morning Sun in the south-east',()=>{
  // local solar noon elevation = 90° − φ ± 23.44°
  const noon=(y,m,d)=>{let best=-90;for(let min=8*60;min<12*60;min+=2)best=Math.max(best,earthSunPosition(Date.UTC(y,m,d,0,min),ANKARA.lat,ANKARA.lonEast).elevation);return best;};
  near(noon(2026,5,21),90-ANKARA.lat+23.44,.3,'June solstice');
  near(noon(2026,11,21),90-ANKARA.lat-23.44,.3,'December solstice');
  // equation of time: ≈ +16.4 min early November, ≈ −14.2 min mid-February (standard values)
  near(earthSunPosition(Date.UTC(2026,10,3,12),0,0).equationOfTime,16.4,.6,'EoT 3 Nov');
  near(earthSunPosition(Date.UTC(2026,1,11,12),0,0).equationOfTime,-14.2,.6,'EoT 11 Feb');
  // 09:00 TRT (06:00 UTC) on the challenge weekend: Sun low in the south-east
  const s=earthSunPosition(Date.UTC(2026,10,14,6),ANKARA.lat,ANKARA.lonEast);
  assert.ok(s.elevation>5&&s.elevation<25&&s.azimuth>110&&s.azimuth<150,JSON.stringify(s));
  // Earth–Sun distance: TOA irradiance higher at perihelion (Jan) than aphelion (Jul), ±3.3 %
  const jan=earthSunPosition(Date.UTC(2026,0,3,12),0,0).irradianceTOA,jul=earthSunPosition(Date.UTC(2026,6,4,12),0,0).irradianceTOA;
  near(jan/jul,1.069,.006,'perihelion/aphelion');
  assert.equal(s.Ls,null);
});

test('Earth terrain: no craters, gentle hills, sparse rocks, labelled illustrative; Mars terrain unchanged',()=>{
  const e=new ProceduralTerrain({seed:5,planet:'earth'}),m=new ProceduralTerrain({seed:5}),m2=new ProceduralTerrain({seed:5,planet:'mars'});
  assert.equal(e.craters.length,0);assert.equal(e.meta.planet,'earth');assert.match(e.meta.label.en,/NOT survey/);
  assert.ok(e.rocks.length<m.rocks.length/3,`${e.rocks.length} vs ${m.rocks.length}`);
  assert.equal(e.meta.rockAbundance,EARTH_TERRAIN.rockAbundance);
  assert.deepEqual(m.heights,m2.heights);assert.match(m.meta.label.en,/NOT NASA data/);
  // slopes stay flyable: 95 % of cells under 15°
  let steep=0,n=0;for(let x=-500;x<=500;x+=20)for(let z=-500;z<=500;z+=20){n++;if(Math.acos(e.normalAt(x,z,2)[1])*180/Math.PI>15)steep++;}
  assert.ok(steep/n<.05,`steep fraction ${steep/n}`);
});

test('Earth simulation: ISA at the Ankara site, local Sun, no light delay, no Mars multi-sol energy',()=>{
  const spec=worldSpec(WORLDS.earth),sim=new Simulation(spec,{terrain:false});
  assert.equal(sim.planet,'earth');assert.equal(sim.link.oneWayLightTime,0);
  near(sim.environment.density(ANKARA.elevation),1.1166,.002,'ISA density at 938 m');
  near(sim.sun.elevation,earthSunPosition(spec.date,ANKARA.lat,ANKARA.lonEast).elevation,1e-12);
  assert.ok(sim.sun.elevation>20,'default date is in daylight');
  assert.equal(sim.budget.solar,null);assert.equal(solarPlan(sim,1),null);
  sim.dispose();
});

test('Earth missions: the 5" quad flies the survey autonomously and with an on-site FPV pilot; the Ingenuity-like rotorcraft cannot lift off',()=>{
  const terrain=new ProceduralTerrain({seed:2026,planet:'earth'});
  const auto=new Simulation({...worldSpec(WORLDS.earth),seed:2026},{terrain});auto.start();const r=auto.run();auto.dispose();
  assert.equal(r.success,true,r.reason);assert.equal(r.observations,2);
  const ing=new Simulation({...worldSpec(WORLDS.earth),vehicle:'ingenuity-like'},{terrain});ing.start();const ri=ing.run();ing.dispose();
  assert.equal(ri.success,false);assert.match(ri.reason,/current|torque|thrust/);
  // scripted pilot through the zero-delay link (same pilot as the Mars FPV test)
  const sim=new Simulation({...worldSpec(WORLDS.earth),control:'local-fpv'},{terrain:false});sim.start();
  for(let i=0;i<240*200&&!sim.mission.result;i++){
    const p=sim.vehicle.position,v=sim.vehicle.velocity,todo=sim.mission.spec.waypoints.find(w=>!sim.mission.observations.some(o=>o.name===w.name));
    let stick={pitch:0,roll:0,yaw:0,climb:-1};
    if(todo){const dx=todo.x-p.x,dz=todo.z-p.z,d=Math.hypot(dx,dz)||1,want=Math.min(2,d*.4);
      stick={pitch:Math.max(-1,Math.min(1,(-(dz/d)*want+v.z)*.25)),roll:Math.max(-1,Math.min(1,((dx/d)*want-v.x)*.25)),yaw:0,climb:0};}
    if(sim.mission.phase==='piloted')sim.mission.pilot(stick);sim.step();
  }
  const rf=sim.mission.result;sim.dispose();
  assert.equal(rf.success,true,rf?.reason);assert.equal(rf.observations,2);
});

test('experiments: terrain is generated per planet; Earth presets use the Earth base',()=>{
  const cache=new Map(),def={name:'t',base:{...EARTH_BASE,waypoints:[{x:0,z:-15,action:'observe',dwell:1,name:'A'}],timeLimit:90},
    variables:[{key:'profile',values:['earth-isa','mars-brief']}],seeds:[1],terrainSeed:4};
  const res=runExperiment(def,{terrainCache:cache});
  assert.deepEqual([...cache.keys()].sort(),['earth:4','mars:4']);
  assert.equal(cache.get('earth:4').craters.length,0);assert.ok(cache.get('mars:4').craters.length>0);
  assert.equal(res.rows[0].success,true,res.rows[0].reason);
  for(const d of Object.values(EARTH_EXPERIMENTS))assert.equal(d.base.profile,'earth-isa',d.name);
  for(const id of Object.keys(WORLDS.earth.experiments))assert.ok(EARTH_EXPERIMENTS[id]||id==='earth-mars',id);
  assert.deepEqual(Object.keys(WORLDS.mars.experiments),Object.keys(EXPERIMENTS));
});

test('worlds: URL selection, links keep other parameters, defaults, controls; strings exist in both languages',()=>{
  assert.equal(resolveWorld({search:'?world=earth',pathname:'/'}).id,'earth');
  assert.equal(resolveWorld({search:'?world=mars&lang=tr',pathname:'/'}).id,'mars');
  assert.equal(resolveWorld({search:'',pathname:'/earth'}).id,'earth');
  assert.equal(resolveWorld({search:'?world=venus',pathname:'/'}),null);
  assert.equal(resolveWorld({search:'',pathname:'/'}),null);
  assert.equal(worldHref('earth',{search:'?world=mars&renderer=webgpu&terrain=jezero',pathname:'/app/'}),'/app/?world=earth&renderer=webgpu');
  assert.equal(worldHref(null,{search:'?world=mars',pathname:'/'}),'/');
  const e=worldSpec(WORLDS.earth),m=worldSpec(WORLDS.mars);
  assert.equal(e.profile,'earth-isa');assert.equal(e.vehicle,'fpv5');assert.equal(e.siteElevation,938);assert.equal(m.profile,'mars-brief');assert.equal(m.vehicle,'ingenuity-like');
  assert.ok(!WORLDS.earth.controls.includes('earth-fpv'),'no light-delay FPV on Earth');
  for(const w of WORLDS.earth.winds)assert.ok(['calm','light','moderate','strong'].includes(w.id));
  const en=Object.keys(STRINGS.en),tr=new Set(Object.keys(STRINGS.tr));
  assert.deepEqual(en.filter(k=>!tr.has(k)),[],'every English string has a Turkish one');
});
