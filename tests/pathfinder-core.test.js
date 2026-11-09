// Base Pathfinder: pure logic (no Rapier). Hand-checked TOPSIS and AHP examples, sensitivity,
// seeded Monte Carlo, safety screening, provenance rules, site models, budget, route geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {topsis,ahp,reciprocalMatrix,sensitivity,sweepWeights,monteCarlo,explain,RANDOM_INDEX} from '../src/pathfinder/mcdm.js';
import {datum,consistency,KINDS,formatDatum} from '../src/pathfinder/provenance.js';
import {CRITERIA,weightVector,defaultWeights} from '../src/pathfinder/criteria.js';
import {SITE_CATALOG,prepareSite,editAssumption} from '../src/pathfinder/sites.js';
import {surfacePressure,annualInsolation,utcForLocalTime,P_REF} from '../src/pathfinder/environment.js';
import {screen,defaultSafetyParams} from '../src/pathfinder/safety.js';
import {budget,DEFAULT_DESIGN,CAMERA_OPTIONS,gsd,footprint} from '../src/pathfinder/design.js';
import {planSurvey,DEFAULT_ROUTE} from '../src/pathfinder/route.js';
import {localSolarTime} from '../src/mars/time.js';
import {PF_SOURCES} from '../src/pathfinder/sources.js';

const near=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b} ± ${tol}`);

test('TOPSIS: hand-computed 3 × 2 example (vector normalisation, equal weights)',()=>{
  const r=topsis([[1,4],[3,2],[2,3]],[.5,.5],['benefit','benefit']);
  near(r.norms[0],Math.sqrt(14),1e-12);near(r.norms[1],Math.sqrt(29),1e-12);
  near(r.Dplus[0],.267261,1e-6);near(r.Dplus[1],.185695,1e-6);near(r.Dplus[2],.162720,1e-6);
  near(r.Dminus[0],.185695,1e-6);near(r.Dminus[1],.267261,1e-6);near(r.Dminus[2],.162720,1e-6);
  near(r.C[0],.409963,1e-6);near(r.C[1],.590037,1e-6);near(r.C[2],.5,1e-9);
  assert.deepEqual(r.order,[1,2,0]);assert.deepEqual(r.rank,[3,1,2]);assert.equal(r.winner,1);
  // a cost criterion flips its ideal
  const c=topsis([[1,4],[3,2],[2,3]],[.5,.5],['benefit','cost']);
  assert.equal(c.winner,1);near(c.Dplus[1],0,1e-12,'best on both');
  // identical alternatives: closeness 0.5, no division by zero
  assert.deepEqual(topsis([[1,1],[1,1]],[.5,.5],['benefit','cost']).C,[.5,.5]);
  assert.throws(()=>topsis([[1,NaN]],[.5,.5],['benefit','benefit']),/finite/);
});

test('AHP: consistent matrix gives its weights exactly; Saaty textbook matrix gives CR ≈ 0.033',()=>{
  const w=[.5,.3,.2],A=reciprocalMatrix(3,(i,j)=>w[i]/w[j]),r=ahp(A);
  r.weights.forEach((x,i)=>near(x,w[i],1e-9));near(r.lambdaMax,3,1e-9);near(r.CR,0,1e-9);assert.ok(r.consistent);
  const s=ahp(reciprocalMatrix(3,(i,j)=>({'0,1':3,'0,2':5,'1,2':3})[`${i},${j}`]));
  near(s.weights[0],.637,.002);near(s.weights[1],.258,.002);near(s.weights[2],.105,.002);
  near(s.lambdaMax,3.0385,.001);near(s.CR,.0332,.001);assert.ok(s.consistent);
  assert.equal(RANDOM_INDEX[3],.58);
  // an inconsistent judgement (A > B > C but C ≫ A) is flagged
  const bad=ahp(reciprocalMatrix(3,(i,j)=>({'0,1':5,'0,2':1/7,'1,2':5})[`${i},${j}`]));assert.ok(bad.CR>.1&&!bad.consistent);
  assert.throws(()=>ahp([[1,2],[2,1]]),/reciprocal/);
});

test('sensitivity: proportional weight sweep, stability interval and the switch point',()=>{
  const w=[.5,.5],sw=sweepWeights(w,0,.8);near(sw[0],.8,1e-12);near(sw[1],.2,1e-12);
  const s=sensitivity([[1,4],[3,2],[2,3]],w,['benefit','benefit']);
  // alternative 1 (best on criterion 0) stays first from w0 ≈ 0.41 up to 1; below, alternative 0 wins
  const i0=s[0].interval;near(i0[0],.41,1e-9);near(i0[1],1,1e-12);assert.deepEqual(s[0].switchesTo,[0]);
  const X=[[1,4],[3,2],[2,3]],d=['benefit','benefit'];
  assert.equal(topsis(X,sweepWeights(w,0,.40),d).winner,0);assert.equal(topsis(X,sweepWeights(w,0,.41),d).winner,1);
  // the curves are TOPSIS closeness values at each step
  near(s[0].curves[1][50],.590037,1e-6);
});

test('Monte Carlo: seeded (reproducible), shares sum to 1, data mode respects uncertainty',()=>{
  const X=[[1,4],[3,2],[2,3]],w=[.5,.5],d=['benefit','benefit'];
  const a=monteCarlo(X,w,d,{n:500,seed:7}),b=monteCarlo(X,w,d,{n:500,seed:7});
  assert.deepEqual(a.shares,b.shares);near(a.shares.reduce((s,x)=>s+x,0),1,1e-12);
  const none=monteCarlo(X,w,d,{U:[[0,0],[0,0],[0,0]],mode:'data',n:200,seed:1});assert.equal(none.shares[1],1,'no uncertainty → same winner every draw');
  const e=explain(topsis(X,w,d),d);assert.equal(e.length,2);assert.ok(Math.abs(e[0].advantage)>=Math.abs(e[1].advantage));
});

test('provenance: kinds are required, uncertainties are non-negative, mixed kinds are flagged',()=>{
  assert.throws(()=>datum(1,{unit:'m'}),/known kind/);assert.throws(()=>datum(1,{kind:'nasa',uncertainty:-1}),/non-negative/);
  assert.throws(()=>datum(NaN,{kind:'model'}),/finite/);
  const a=datum(.8,{kind:'nasa',source:'swim',unit:'index',uncertainty:.1}),b=datum(.2,{kind:'assumption',unit:'index'});
  assert.ok(consistency([a,b]).mixed);assert.ok(consistency([a,a]).ok);assert.equal(consistency([a,null]).missing,1);
  assert.match(formatDatum(a),/0\.80 ± 0\.10 index \(NASA\)/);assert.equal(Object.keys(KINDS).length,6);
  assert.ok(Object.isFrozen(a));
});

test('catalog: every site value is a datum with a kind; published coordinates cite a source; assumptions explain themselves',()=>{
  assert.equal(SITE_CATALOG.length,5);
  for(const s of SITE_CATALOG){
    for(const [k,d] of Object.entries(s.data)){assert.ok(KINDS[d.kind],`${s.id}.${k}`);
      if(d.kind==='published')assert.ok(PF_SOURCES[d.source],`${s.id}.${k} source`);
      if(d.kind==='assumption')assert.ok(d.rationale,`${s.id}.${k} rationale`);}
    assert.ok(Math.abs(s.data.latitude.value)<=90&&s.data.longitude.value>=0&&s.data.longitude.value<360);
    // the drone never "measures" subsurface ice: the ice index is never kind 'simulation'
    assert.notEqual(s.data.ice.kind,'simulation');assert.ok(!s.data.ice.measuredByDrone);
  }
  const ids=SITE_CATALOG.map(s=>s.id);assert.equal(new Set(ids).size,ids.length);
});

test('site models: pressure from elevation (Fact Sheet), insolation falls with latitude, flight at ~11:00 local time',()=>{
  near(surfacePressure(0),P_REF,1e-9);near(surfacePressure(-11100),P_REF*Math.E,1e-6);
  const eq=annualInsolation(0,0,.5,{everySols:30}),mid=annualInsolation(45,0,.5,{everySols:30});
  assert.ok(eq.whPerSol>mid.whPerSol,'equator gets more sunlight over a year');
  assert.ok(annualInsolation(0,0,1.5,{everySols:30}).whPerSol<eq.whPerSol,'dust lowers it');
  const jz=prepareSite('jezero'),ar=prepareSite('arcadia');
  for(const k of ['solar','temperature','pressure'])assert.equal(jz.data[k].kind,'model');
  assert.ok(jz.data.solar.value>ar.data.solar.value&&jz.data.temperature.value>ar.data.temperature.value);
  // model check: Jezero annual-mean temperature inside the MEDA air range 190–250 K
  assert.ok(jz.data.temperature.value>190&&jz.data.temperature.value<250);
  const ms=utcForLocalTime(77.45,11);near(localSolarTime(ms,77.45),11,.05);
  // editing an assumption recomputes the models that depend on it
  const higher=prepareSite('jezero',{elevation:editAssumption(jz.data.elevation,0)});
  assert.ok(higher.data.pressure.value<jz.data.pressure.value);assert.match(higher.data.elevation.transforms.at(-1),/edited/);
  assert.throws(()=>editAssumption(jz.data.latitude,10),/Only assumptions/);
});

test('safety screening: latitude rule from the 2015 guideline; unsurveyed sites are not certified',()=>{
  const sites=['jezero','arcadia'].map(id=>prepareSite(id));
  const r=screen(sites,defaultSafetyParams());
  assert.ok(r.every(x=>!x.pass),'no survey yet → not certified');
  assert.ok(r.every(x=>x.checks.find(c=>c.rule.id==='latitude').pass));
  const strict=screen(sites,{...defaultSafetyParams(),maxLatitude:30});
  assert.equal(strict[1].checks.find(c=>c.rule.id==='latitude').pass,false,'Arcadia (42° N) fails a 30° limit');
});

test('budget: 100 M with 70 M of base items and 30 M left (brief); upgrades cost; over budget is reported',()=>{
  const b=budget(DEFAULT_DESIGN);assert.equal(b.base,70);assert.equal(b.total,70);assert.equal(b.remaining,30);assert.ok(b.within&&b.representative);
  const big=budget({rotor:'r60',battery:'b4',camera:'mapping',frame:'fullerene'});assert.equal(big.total,70+6+9+7+2);assert.ok(big.within);
  assert.throws(()=>budget({...DEFAULT_DESIGN,camera:'x'}),/Unknown camera/);
  const w=weightVector(defaultWeights());near(w.reduce((a,b)=>a+b,0),1,1e-12);assert.equal(w.length,CRITERIA.length);
});

test('route: swath, spacing, GSD and waypoint pattern follow the camera geometry',()=>{
  const cam=CAMERA_OPTIONS[0],p=planSurvey(cam,DEFAULT_ROUTE);
  near(p.gsd,20*cam.pitch/cam.focal,1e-12);near(gsd(cam,10),p.gsd/2,1e-12);
  const fp=footprint(cam,20);near(p.swath,fp.across,1e-12);near(p.plannedSpacing,fp.across*.4,1e-12);near(p.photoSpacing,fp.along*.25,1e-12);
  assert.equal(p.waypoints.length,2*p.lines);assert.ok((p.lines-1)*p.spacing>=p.area-1e-9);
  // lines alternate direction (lawnmower) and stay inside the area
  assert.equal(p.waypoints[0].z,-40);assert.equal(p.waypoints[1].z,40);assert.equal(p.waypoints[2].z,40);
  assert.ok(p.waypoints.every(w=>Math.abs(w.x)<=40+1e-9&&Math.abs(w.z)<=40+1e-9));
  assert.throws(()=>planSurvey(cam,{...DEFAULT_ROUTE,altitude:2}),/altitude/);
  assert.ok(planSurvey(cam,{...DEFAULT_ROUTE,speed:8}).warnings.some(w=>w.id==='blur'),'rolling shutter at 8 m/s blurs');
});
