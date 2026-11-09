// Base Pathfinder with the real flight physics (Rapier): validation messages, survey flights with the
// camera, energy running out, photogrammetry against the known synthetic terrain, the full decision
// loop and its report. Small survey areas keep the test fast.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {Simulation} from '../src/sim/Simulation.js';
import {prepareSite} from '../src/pathfinder/sites.js';
import {DEFAULT_DESIGN,deriveVehicle,budget} from '../src/pathfinder/design.js';
import {validateMission,surveySpec} from '../src/pathfinder/validation.js';
import {runSurvey,siteTerrain} from '../src/pathfinder/survey.js';
import {analyseSurvey} from '../src/pathfinder/photogrammetry.js';
import {attachSurvey,decide} from '../src/pathfinder/decision.js';
import {buildPathfinderReport,dataCSV,resultsCSV,missionJSON,QUESTION} from '../src/pathfinder/report.js';
import {getVehicle} from '../src/vehicles/presets.js';
import {CRITERIA} from '../src/pathfinder/criteria.js';

await initializeRapier();
const near=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b} ± ${tol}`);
const SMALL={area:40,altitude:20,speed:4,sideOverlap:.6,forwardOverlap:.75};

test('design → derived vehicle: bigger rotors and batteries change mass, thrust and energy; presets untouched',()=>{
  const a=getVehicle(deriveVehicle(DEFAULT_DESIGN)),b=getVehicle(deriveVehicle({...DEFAULT_DESIGN,rotor:'r60',battery:'b4'}));
  assert.ok(b.battery.nominalEnergyWh===2*a.battery.nominalEnergyWh&&b.battery.mass===2*a.battery.mass);
  assert.ok(b.rotorMass>a.rotorMass);assert.equal(deriveVehicle(DEFAULT_DESIGN),deriveVehicle(DEFAULT_DESIGN),'registered once');
  assert.equal(getVehicle('osiris-mars-quad').battery.parallel,2,'the preset is unchanged');
});

test('validation explains failures in numbers and offers fixes (take-off, energy, budget)',()=>{
  const jz=prepareSite('jezero');
  const small=validateMission({...DEFAULT_DESIGN,rotor:'r45'},[jz],SMALL),t=small.perSite[0].checks.find(c=>c.id==='takeoff');
  assert.ok(t&&t.severity==='error'&&!small.ok);assert.match(t.en,/cannot take off.*maximum rotor thrust \(\d+\.\d N\) is lower than its weight on Mars \(\d+\.\d N\)/);
  assert.match(t.tr,/kalkamaz/);assert.ok(t.fixes.some(f=>/rotor radius/.test(f.en)));
  const long=validateMission(DEFAULT_DESIGN,[jz],{area:200,altitude:10,speed:2,sideOverlap:.8,forwardOverlap:.75}),e=long.perSite[0].checks.find(c=>c.id==='energy');
  assert.ok(e&&!long.ok);assert.match(e.en,/needs about \d+ Wh; the battery can give \d+ Wh/);
  const ok=validateMission(DEFAULT_DESIGN,[jz],SMALL);assert.ok(ok.ok&&ok.perSite[0].thrustToWeight>1.3);
  // the planning estimate (with the calibrated turn time) brackets the energy the simulation will use
  near(ok.perSite[0].energyWh,33.4,8,'planned Wh for the 40 m survey');
  assert.equal(budget(DEFAULT_DESIGN).remaining,30);
});

test('survey flight: autonomous, camera fires on the lines, stereo coverage, measured safety close to the truth',()=>{
  const site=prepareSite('arcadia'),s=runSurvey(DEFAULT_DESIGN,site,SMALL);
  assert.ok(s.result.success,s.result.reason);assert.equal(s.spec.control,'autonomous');
  assert.ok(s.photos.length>=.8*s.plan.expectedPhotos,`${s.photos.length} photos of ${s.plan.expectedPhotos}`);
  const a=s.analysis;assert.ok(a.coverage>.8,`coverage ${a.coverage}`);
  near(a.sigmaZ,(a.flightHeight/a.base)*a.gsd*.5,1e-12,'σZ = (H/B)·GSD·σpx');
  near(a.truth.demRmse,a.sigmaZ,a.sigmaZ*.15,'height error matches the stereo precision');
  near(a.safeFraction,a.truth.safeFraction,.05,'measured safe share vs the synthetic truth');
  assert.ok(a.safeUncertainty>0&&a.safeUncertainty<.2);assert.ok(s.procedural,'synthetic terrain is labelled');
  // the analysis is reproducible (seeded measurement noise)
  const again=analyseSurvey({terrain:siteTerrain(site),photos:s.photos,plan:s.plan,camera:{pitch:1.12e-6,focal:3.4e-3,sigmaPx:.5},seed:site.seed});
  assert.equal(again.safeFraction,a.safeFraction);
  // replay track for the 3D view: time-ordered, ends on the ground
  assert.ok(s.track.length>50&&s.track.every((r,i)=>!i||r[0]>s.track[i-1][0]));
});

test('energy running out ends the mission (brief acceptance test 5)',()=>{
  const site=prepareSite('jezero'),{spec}=surveySpec(DEFAULT_DESIGN,site,SMALL);
  const sim=new Simulation(spec,{terrain:siteTerrain(site),record:false});
  sim.vehicle.battery.soc=sim.vehicle.battery.spec.reserve+.02; // almost empty at take-off
  sim.start();const r=sim.run(400);
  assert.equal(r.success,false);assert.match(r.reason,/battery/);sim.dispose();
});

test('full loop: three sites, safety first, TOPSIS ranking, report answers the question with numbers',()=>{
  let sites=['jezero','arcadia','mawrth'].map(id=>prepareSite(id));
  sites=sites.map(s=>attachSurvey(s,runSurvey(DEFAULT_DESIGN,s,SMALL)));
  for(const s of sites){assert.equal(s.data.safeArea.kind,'simulation');assert.ok(s.data.safeArea.measuredByDrone);}
  const d=decide(sites,{mcDraws:300});
  assert.ok(d.recommended,'a site is recommended');
  const best=d.ranking[0];assert.equal(best.site,d.recommended.id);assert.ok(d.ranking.every(r=>r.C<=best.C));
  // every ranked site passed every mandatory rule
  for(const r of d.ranking)assert.ok(d.screening.find(x=>x.site.id===r.site).pass);
  // deterministic: the same inputs give the same decision
  const d2=decide(sites,{mcDraws:300});assert.deepEqual(d2.ranking.map(r=>[r.site,r.C]),d.ranking.map(r=>[r.site,r.C]));assert.deepEqual(d2.mc.both.shares,d.mc.both.shares);
  // weights change the ranking when they should: all weight on science favours the highest science score
  const sci=decide(sites,{weights:Object.fromEntries(CRITERIA.map(c=>[c.id,c.id==='science'?1:0])),mcDraws:50});
  const passing=sites.filter(s=>sci.passing.includes(s.id)),top=passing.reduce((a,b)=>b.data.science.value>a.data.science.value?b:a);
  assert.equal(sci.recommended.id,top.id);
  const val=validateMission(DEFAULT_DESIGN,sites,SMALL);
  const md=buildPathfinderReport({lang:'en',design:DEFAULT_DESIGN,budget:budget(DEFAULT_DESIGN),route:SMALL,validation:val,sites,decision:d,generatedAt:'test'});
  assert.ok(md.includes(QUESTION));assert.ok(md.includes(`**${d.recommended.label.en}**`));assert.match(md,/TOPSIS closeness C = 0\.\d{3}/);
  assert.match(md,/Monte Carlo/);assert.match(md,/representative/);
  const tr=buildPathfinderReport({lang:'tr',design:DEFAULT_DESIGN,budget:budget(DEFAULT_DESIGN),route:SMALL,validation:val,sites,decision:d,generatedAt:'test'});
  assert.match(tr,/Cevap/);assert.match(tr,/temsili/);
  assert.match(dataCSV(sites).split('\n')[0],/^site,key,value,unit,uncertainty,kind,source/);
  assert.equal(resultsCSV(sites,d).split('\n').length,4);
  const j=JSON.parse(missionJSON({design:DEFAULT_DESIGN,budget:budget(DEFAULT_DESIGN),route:SMALL,validation:val,sites,decision:d}));
  assert.equal(j.decision.recommended,d.recommended.id);assert.equal(j.question,QUESTION);
});
