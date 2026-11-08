// Real NASA conditions: parsers, unit handling, conversion to environment overrides, measured wind,
// fetch fallback, and the published MEDA range against the model. The JSON below are small
// hand-made fixtures in the services' documented shapes (not real measurements).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {PlanetEnvironment} from '../src/planet/PlanetEnvironment.js';
import {Simulation} from '../src/sim/Simulation.js';
import {PlanetWind} from '../src/sim/PlanetWind.js';
import {parseEpic,pickEpic,epicImageURL,epicDiskFraction,parseMarsWeather,latestCompleteSol,marsConditions,powerURL,parsePowerHourly,pickPowerHour,earthConditions,fetchFirstJSON,MEDA_PUBLISHED,NASA_SERVICES} from '../src/realdata/nasa.js';

await initializeRapier();
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg??''} ${a} vs ${b} ± ${tol}`);

test('Mars weather feed: sols/soles, strings, missing values, hPa → Pa, newest first',()=>{
  const fx={sols:[
    {terrestrial_date:'2026-10-01',sol:'2000',ls:'200',season:'early autumn',min_temp:'-80',max_temp:'-20',pressure:'720',atmo_opacity:'Sunny'},
    {terrestrial_date:'2026-10-03',sol:'2002',ls:'201',min_temp:-78,max_temp:-21,pressure:'--'},
    {terrestrial_date:'2026-10-02',sol:'2001',ls:'200',min_temp:'-79',max_temp:'-22',pressure:'7.1'},
  ]};
  const s=parseMarsWeather(fx);
  assert.deepEqual(s.map(x=>x.sol),[2002,2001,2000]);
  assert.equal(s[0].pressurePa,null);near(s[1].pressurePa,710,1e-9);assert.match(s[1].unitNote,/hPa/);
  assert.equal(latestCompleteSol(s).sol,2001);
  assert.equal(parseMarsWeather({soles:[{sol:'4000',min_temp:'-70',max_temp:'-5',pressure:'850'}]})[0].pressurePa,850);
  assert.throws(()=>parseMarsWeather({foo:1}),/no sols/);
  // implausible values are dropped, not used
  assert.equal(parseMarsWeather({sols:[{sol:1,min_temp:-300,max_temp:-20,pressure:5000}]})[0].pressurePa,null);
});

test('Mars conditions: measured pressure, high/low air temperature at the mission local time, ideal-gas density',()=>{
  const env=new PlanetEnvironment('mars-brief'),sol={pressurePa:700,minTempC:-80,maxTempC:-20};
  const noon=marsConditions(sol,14,env),dawn=marsConditions(sol,6,env);
  near(noon.temperature,253.15,1e-9,'afternoon high');near(dawn.temperature,193.15,1e-9,'dawn low');
  const R=env.with(noon.overrides).atmosphere(0).gasConstant;
  near(noon.density,700/(R*253.15),1e-12);assert.ok(dawn.density>noon.density);
  assert.equal(env.with(noon.overrides).atmosphere(0).pressure,700);
});

test('NASA POWER: request URL, fill values, UTC hours, same-hour pick, site values reproduced exactly',()=>{
  const u=new URL(powerURL({lat:39.93,lonEast:32.85,endMs:Date.UTC(2026,10,6),days:3}));
  assert.equal(u.searchParams.get('parameters'),'T2M,PS,WS10M,WD10M');assert.equal(u.searchParams.get('start'),'20261103');assert.equal(u.searchParams.get('end'),'20261106');
  assert.equal(u.searchParams.get('time-standard'),'UTC');assert.equal(u.searchParams.get('latitude'),'39.9300');
  const fx={type:'Feature',geometry:{type:'Point',coordinates:[32.85,39.93,1012.3]},header:{fill_value:-999},
    properties:{parameter:{T2M:{'2026110507':6.5,'2026110508':8.25,'2026110607':5.1,'2026110608':-999},PS:{'2026110507':90.8,'2026110508':90.85,'2026110607':91.1,'2026110608':91.0},
      WS10M:{'2026110507':2.1,'2026110508':3.4,'2026110607':1.2,'2026110608':1.0},WD10M:{'2026110507':40,'2026110508':45,'2026110607':350,'2026110608':355}}}};
  const P=parsePowerHourly(fx);assert.equal(P.hours.length,4);assert.equal(P.hours[3].t2m,null);near(P.elevation,1012.3,1e-9);
  assert.equal(P.hours[0].time,Date.UTC(2026,10,5,7));
  // mission at 08:00 UTC: the latest complete 08 UTC hour (6 Nov 08 has a fill value) → 5 Nov 08
  assert.equal(pickPowerHour(P.hours,Date.UTC(2026,10,14,8)).key,'2026110508');
  assert.equal(pickPowerHour(P.hours,Date.UTC(2026,10,14,13)).key,'2026110607'); // no 13 UTC hour → latest complete
  const env=new PlanetEnvironment('earth-isa'),c=earthConditions(P.hours[1],938,env),site=env.with(c.overrides).atmosphere(938);
  near(site.temperature,8.25+273.15,.01,'site T');near(site.pressure,90850,.1,'site p');
  near(c.density,90850/(site.gasConstant*(8.25+273.15)),2e-6);
  assert.equal(c.wind.speed,3.4);assert.equal(c.wind.direction,225); // from 45° (NE) → blowing toward 225° (SW)
  assert.throws(()=>parsePowerHourly({messages:['bad request']}),/bad request/);
});

test('measured wind: the planet wind model uses the measured 10 m speed; Simulation passes it through',()=>{
  const env=new PlanetEnvironment('earth-isa'),w=new PlanetWind({environment:env,level:'measured',speed:4,direction:90,seed:3});
  assert.equal(w.level,'measured');assert.equal(w.spec.speed,4);
  let sx=0,n=0;for(let t=0;t<600;t+=.5){sx+=w.velocity(t,{x:0,y:10,z:0}).x;n++;}
  near(sx/n,4,.6,'mean eastward wind at 10 m');
  assert.equal(new PlanetWind({environment:env,level:'measured'}).level,'calm','no speed → no measured level');
  const sim=new Simulation({profile:'earth-isa',vehicle:'fpv5',siteElevation:938,wind:{level:'measured',speed:5,direction:0}},{terrain:false});
  assert.equal(sim.wind.spec.speed,5);sim.dispose();
});

test('fetch: proxy first, then the direct URL; errors are collected, never replaced by invented data',async()=>{
  const calls=[],fake=async url=>{calls.push(url);if(url.startsWith('nasa/'))return {ok:false,status:404,text:async()=>''};return {ok:true,status:200,text:async()=>'{"sols":[]}'};};
  const r=await fetchFirstJSON([NASA_SERVICES.mars2020.proxy,NASA_SERVICES.mars2020.url],{fetchImpl:fake});
  assert.equal(r.url,NASA_SERVICES.mars2020.url);assert.deepEqual(r.json,{sols:[]});assert.equal(calls.length,2);
  await assert.rejects(fetchFirstJSON(['a','b'],{fetchImpl:async()=>{throw new Error('offline');}}),/a: offline · b: offline/);
});

test('model check: published MEDA seasonal pressures give midday densities inside Ingenuity\'s flown range; the brief\'s 0.020 is the dense end',()=>{
  const env=new PlanetEnvironment('mars-brief'),M=MEDA_PUBLISHED,air={minTempC:M.airTemperature.minC,maxTempC:M.airTemperature.maxC};
  const lo=marsConditions({...air,pressurePa:M.pressureMin.value},12,env).density,hi=marsConditions({...air,pressurePa:M.pressureMax.value},12,env).density;
  // Ingenuity: designed for 0.0145–0.0185, flew down to ≈ 0.012 kg/m³ (Grip 2021)
  assert.ok(lo>=.012&&lo<.0145,`low season midday ${lo}`);assert.ok(hi>=.0145&&hi<=.0185,`high season midday ${hi}`);
  const dawnHigh=marsConditions({...air,pressurePa:M.pressureMax.value},6,env).density;
  near(dawnHigh,env.density(0),.0015,'brief 0.020 ≈ high-season pre-dawn');
});

test('EPIC (landing photo): list parsing, nearest-longitude pick, archive URL, disk size from DSCOVR distance',()=>{
  const fx=[ // fixture in the API's shape
    {image:'epic_1b_20261107013000',date:'2026-11-07 01:25:00',centroid_coordinates:{lat:-5,lon:150},dscovr_j2000_position:{x:1.4e6,y:3e5,z:1e5}},
    {image:'epic_1b_20261107093000',date:'2026-11-07 09:25:00',centroid_coordinates:{lat:-5,lon:30},dscovr_j2000_position:{x:1.4e6,y:3e5,z:1e5}},
    {image:'epic_1b_20261107233000',date:'2026-11-07 23:25:00',centroid_coordinates:{lat:-5,lon:-170}},
    {image:'../../etc/passwd',date:'2026-11-07 10:00:00',centroid_coordinates:{lat:0,lon:33}}, // rejected name
  ];
  const l=parseEpic(fx);assert.equal(l.length,3);assert.equal(l[0].time,Date.UTC(2026,10,7,1,25));
  assert.equal(pickEpic(l,32.85).image,'epic_1b_20261107093000');
  assert.equal(pickEpic(l,-175).image,'epic_1b_20261107233000'); // wraps across ±180°
  assert.equal(epicImageURL(l[1]),'https://epic.gsfc.nasa.gov/archive/natural/2026/11/07/jpg/epic_1b_20261107093000.jpg');
  assert.equal(epicImageURL(l[1],'png','nasa/epic/archive/natural'),'nasa/epic/archive/natural/2026/11/07/png/epic_1b_20261107093000.png');
  const f=epicDiskFraction(l[1]);assert.ok(f>.75&&f<.85,`disk fraction ${f}`);assert.equal(epicDiskFraction(l[2]),null);
  assert.throws(()=>parseEpic({}),/not a list/);
});
