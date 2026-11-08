// OsirisZk mission control app — the Earth and the Mars simulator (one app, world from ?world=).
// Physics: fixed 240 Hz steps (Rapier); rendering: interpolated between the last two physics
// states; the renderer never writes physics.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {Simulation} from '../src/sim/Simulation.js';
import {ProceduralTerrain,HeightmapTerrain} from '../src/terrain/terrain.js';
import {PROFILES,PROFILE_ORDER} from '../src/planet/index.js';
import {VEHICLES,VEHICLE_ORDER} from '../src/vehicles/presets.js';
import {FRAME_TYPES,FRAME_LABELS,FEA_NOTE} from '../src/frames/frames.js';
import {VARIABLES,toCSV} from '../src/experiment/Experiment.js';
import {solarPlan} from '../src/mission/Mission.js';
import {t,L,setLang,getLang,setWorld} from './i18n.js';
import {WORLDS,resolveWorld,worldHref,worldSpec} from './worlds.js';
import {MarsScene,followCamera} from './render/scene.js';
import {DustPlume} from './render/dust.js';
import {createVehicleModel} from './render/vehicleModel.js';
import {lineChart,barChart} from './ui/charts.js';
import {buildReport,markdownToHtml} from './report.js';

const WORLD=resolveWorld()??WORLDS.mars,MARS=WORLD.planet==='mars',EXPERIMENTS=WORLD.experiments;
setWorld(WORLD.id);document.body.dataset.world=WORLD.id;
await initializeRapier();
setLang(getLang());
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
// Terrain: a real DTM imported with tools/import-dtm.mjs (?terrain=<name>) or the labelled procedural one
async function loadTerrain(name){
  const procedural=()=>new ProceduralTerrain({seed:2026,cells:[512,512],planet:WORLD.planet}); // 2.3 m cells (physics and drawing)
  if(!name)return procedural();
  try{const meta=await (await fetch(`terrain/${name}.json`)).json(),buf=await (await fetch(`terrain/${name}.bin`)).arrayBuffer();
    return new HeightmapTerrain(meta.nx,meta.nz,meta.size,new Float32Array(buf),meta);}
  catch(e){console.warn('DTM not found, using procedural terrain',e);return procedural();}
}
const terrain=await loadTerrain(params.get('terrain'));
let spec=worldSpec(WORLD);
let sim=null,model=null,running=false,lastExperiment=null,worker=null,cameraMode='chase';

// ---------- renderer (WebGL by default, WebGPU on ?renderer=webgpu when available) ----------
const canvas=$('#view');let renderer,rendererName='WebGL2';
if(params.get('renderer')==='webgpu'&&navigator.gpu){
  try{const {WebGPURenderer}=await import('three/webgpu');renderer=new WebGPURenderer({canvas,antialias:true});await renderer.init();rendererName='WebGPU';}
  catch(e){console.warn('WebGPU unavailable, using WebGL',e);renderer=null;}
}
renderer??=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const world=new MarsScene(renderer,terrain,$('#quality').value,WORLD.id);
const camera=new THREE.PerspectiveCamera(60,1,.05,4000);const dust=new DustPlume(world.scene),dustColor=new THREE.Color(world.palette.dust);camera.position.set(6,5,8);
const orbit=new OrbitControls(camera,canvas);orbit.enabled=false;orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.495;orbit.maxDistance=400;
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

// ---------- simulation lifecycle ----------
const prevPos=new THREE.Vector3(),curPos=new THREE.Vector3(),prevQ=new THREE.Quaternion(),curQ=new THREE.Quaternion();
function capture(){const b=sim.vehicle.body,p=b.translation();curPos.set(p.x,p.y,p.z);curQ.copy(b.rotation());}
function onStep(){prevPos.copy(curPos);prevQ.copy(curQ);capture();sim.telemetry.sample(sim);}
function missionSpec(){const m={...spec,waypoints:spec.waypoints.map(w=>({...w}))};m.rotorLossFactor=spec.calibrated?null:1;delete m.calibrated;return m;}
function rebuild(){
  if(running)return;
  sim?.dispose();if(model){world.scene.remove(model.group);model.dispose();}
  try{sim=new Simulation(missionSpec(),{terrain});}
  catch(e){banner(String(e.message));return;}
  model=createVehicleModel(sim.built);world.scene.add(model.group);
  capture();prevPos.copy(curPos);prevQ.copy(curQ);
  world.setSky(sim.sun,spec.opticalDepth);world.setWaypoints(spec.waypoints,terrain);
  refreshPanels();
}
function launch(){if(running||!sim)return;if(sim.mission.result||sim.time>.1)rebuild();sim.start();running=true;refreshPanels();canvas.focus();}
function banner(msg){$('#banner').textContent=msg;}
let toastTimer=0;function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('on'),2600);}
const CONTROL_LABEL={autonomous:'autonomous','earth-fpv':'earthFpv','local-fpv':'localFpv'};
function setCamera(mode){cameraMode=mode;orbit.enabled=mode==='orbit';
  // orbit starts from a viewpoint behind and above the vehicle (not from inside it after FPV)
  if(mode==='orbit'&&sim){const s=Math.max(1,Math.cbrt(sim.built.mass)),p=sim.vehicle.position;camera.position.set(p.x+5*s,p.y+3*s,p.z+7*s);orbit.target.set(p.x,p.y,p.z);orbit.update();}}
function cycleCamera(){setCamera(cameraMode==='chase'?'fpv':cameraMode==='fpv'?'orbit':'chase');toast(`${t('camera')}: ${t(cameraMode)}`);if(activeTab==='flight')refreshPanels();}
function cycleControl(){if(running)return;const c=WORLD.controls;spec.control=c[(c.indexOf(spec.control)+1)%c.length];rebuild();toast(`${t('control')}: ${t(CONTROL_LABEL[spec.control])}`);}
function reset(){running=false;rebuild();}

// ---------- input: keyboard and standard gamepad ----------
const keys=new Set();
addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;keys.add(e.code);
  if(e.code==='KeyC')cycleCamera();
  if(e.code==='KeyL'&&running)sim.control.land();});
addEventListener('keyup',e=>keys.delete(e.code));
// Xbox / standard-mapping controller (W3C Gamepad "standard" layout): Mode 2 sticks; buttons with
// edge detection: A launch, B land, X control mode (before launch), Y camera, Menu reset.
const PAD={A:0,B:1,X:2,Y:3,MENU:9};let padPrev=[],padInfo=null;
const pads=()=>[...(navigator.getGamepads?.()??[])].filter(p=>p&&p.connected!==false);
const padName=id=>String(id).replace(/\s*\(.*$/,'').trim()||'Gamepad';
addEventListener('gamepadconnected',e=>toast(`🎮 ${padName(e.gamepad.id)} — ${t('padOn')}`));
addEventListener('gamepaddisconnected',()=>{padPrev=[];toast(`🎮 —`);});
function pollPad(){
  const all=pads(),pad=all.find(p=>p.mapping==='standard');
  padInfo=pad?{name:padName(pad.id),standard:true}:all[0]?{name:padName(all[0].id),standard:false}:null;
  if(!pad){padPrev=[];return;}
  const prev=padPrev,down=pad.buttons.map(b=>b.pressed),edge=i=>down[i]&&!prev[i];padPrev=down;
  if(edge(PAD.A))launch();
  if(edge(PAD.B)&&running)sim.control.land();
  if(edge(PAD.X))cycleControl();
  if(edge(PAD.Y))cycleCamera();
  if(edge(PAD.MENU))reset();
}
function stick(){
  const k=c=>keys.has(c)?1:0,s={pitch:k('ArrowUp')-k('ArrowDown'),roll:k('ArrowRight')-k('ArrowLeft'),yaw:k('KeyA')-k('KeyD'),climb:k('KeyW')-k('KeyS')};
  const pad=pads().find(p=>p.mapping==='standard');
  if(pad){const dz=v=>Math.abs(v)<.08?0:v;s.climb||=-dz(pad.axes[1]);s.yaw||=-dz(pad.axes[0]);s.roll||=dz(pad.axes[2]);s.pitch||=-dz(pad.axes[3]);}
  return s;
}

// ---------- UI ----------
const TABS=[['env','tabEnv'],['design','tabDesign'],['mission','tabMission'],['flight','tabFlight'],['telemetry','tabTelemetry'],['experiments','tabExperiments'],['report','tabReport']];
let activeTab='mission',expChoice=null;
const h=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='html')e.innerHTML=v;else if(v!=null&&v!==false)e.setAttribute(k,v===true?'':v);}for(const c of kids.flat())if(c!=null)e.append(c);return e;};
const row=(label,control)=>h('div',{class:'row'},h('label',{},label),control);
const select=(options,value,onchange)=>{const s=h('select',{onchange:e=>onchange(e.target.value)},...options.map(([v,lab])=>h('option',{value:v},lab)));s.value=value;return s;};
const num=(value,onchange,attrs={})=>h('input',{type:'number',value:value??'',...attrs,onchange:e=>onchange(e.target.value===''?null:+e.target.value)});
const fmt=(v,d=2)=>Number.isFinite(v)?(+v).toFixed(d):'—';

function buildTabs(){
  $('#tabs').replaceChildren(...TABS.map(([id,k])=>h('button',{class:id===activeTab?'on':'',onclick:()=>{activeTab=id;buildTabs();refreshPanels();}},t(k))));
  document.querySelectorAll('[data-t]').forEach(e=>{e.textContent=e.dataset.t==='title2'?t('title').split('·')[1].trim():t(e.dataset.t);});
}
function refreshPanels(){
  const pane=h('div',{class:'pane on'}),append=pane.append.bind(pane);pane.append=(...k)=>append(...k.flat().filter(x=>x!=null&&x!==false));
  ({env:paneEnv,design:paneDesign,mission:paneMission,flight:paneFlight,telemetry:paneTelemetry,experiments:paneExperiments,report:paneReport})[activeTab](pane);
  $('#panes').replaceChildren(pane);banner(L(terrain.meta.label));
}
const set=(k,v)=>{spec[k]=v;rebuild();};

function paneEnv(p){
  const env=sim.environment,ov=spec.overrides??{};
  const setOv=(k,v)=>{const o={...spec.overrides};if(v==null)delete o[k];else o[k]=v;if(k==='surfaceDensity')delete o.surfacePressure;spec.overrides=o;rebuild();};
  const winds=WORLD.winds??env.profile.winds??[{id:'calm',label:{en:'Calm',tr:'Sakin'}}];
  const date=new Date(spec.date).toISOString().slice(0,16),off=WORLD.site.utcOffset;
  const profiles=PROFILE_ORDER.filter(id=>PROFILES[id].planet===WORLD.planet);
  p.append(
    row(t('profile'),select(profiles.map(id=>[id,L(PROFILES[id].label)]),spec.profile,v=>{spec.profile=v;spec.overrides={};spec.wind={...spec.wind,level:'calm'};rebuild();})),
    MARS?null:row(t('siteElev'),num(spec.siteElevation,v=>set('siteElevation',Math.max(0,Math.min(5000,v??0))),{step:50,min:0,max:5000})),
    row(`${t('density')} (kg/m³)`,num(ov.surfaceDensity,v=>setOv('surfaceDensity',v),{step:.0005,min:.001,placeholder:`${t('useProfile')} ${fmt(env.surface.density,4)}`})),
    row(`${t('temperature')} (K)`,num(ov.surfaceTemperature,v=>setOv('surfaceTemperature',v),{step:1,min:100,placeholder:fmt(env.surface.temperature,1)})),
    row(`${t('gravity')} (m/s²)`,num(ov.gravity,v=>setOv('gravity',v),{step:.01,min:.5,placeholder:env.gravity})),
    row(t('wind'),select(winds.map(w=>[w.id,L(w.label)]),spec.wind.level,v=>{spec.wind={...spec.wind,level:v};rebuild();})),
    row(t('windDir'),num(spec.wind.direction,v=>{spec.wind={...spec.wind,direction:v??225};rebuild();},{step:15})),
    row(`${t('dust')}: ${fmt(spec.opticalDepth,2)}`,h('input',{type:'range',min:0,max:WORLD.opticalDepthMax,step:.05,value:spec.opticalDepth,
      oninput:e=>{spec.opticalDepth=+e.target.value;world.setSky(sim.sun,spec.opticalDepth);e.target.parentElement.firstChild.textContent=`${t('dust')}: ${fmt(spec.opticalDepth,2)}`;},
      onchange:()=>rebuild()})),
    row(t('date'),h('input',{type:'datetime-local',value:date,onchange:e=>{const ms=Date.parse(e.target.value+':00Z');if(Number.isFinite(ms))set('date',ms);}})),
    h('div',{class:'kv'},
      h('span',{},`${t('site')}`),h('b',{},WORLD.site.label),
      off!=null?h('span',{},`${t('localTime')} (UTC+${off})`):null,off!=null?h('b',{},new Date(spec.date+off*36e5).toISOString().slice(11,16)):null,
      h('span',{},`${t('sun')} ${t('elevation')} / ${t('azimuth')}`),h('b',{},`${fmt(sim.sun.elevation,1)}° / ${fmt(sim.sun.azimuth,0)}°`),
      h('span',{},t('lst')),h('b',{},MARS?`${fmt(sim.sun.localSolarTime,2)} h · Ls ${fmt(sim.sun.Ls,1)}°`:`${fmt(sim.sun.localSolarTime,2)} h · ${t('eot')} ${fmt(sim.sun.equationOfTime,1)} min`),
      MARS?h('span',{},t('delay')):null,MARS?h('b',{},`${fmt(sim.link.oneWayLightTime/60,1)} min · ${fmt(sim.link.distanceAU,3)} AU`):null),
    h('h3',{},t('params')),
    h('table',{},h('tr',{},h('th',{},''),h('th',{},''),h('th',{},t('status'))),
      ...env.parameters(getLang()).map(r=>h('tr',{},h('td',{},r.key),h('td',{},`${typeof r.value==='number'?+r.value.toPrecision(4):r.value} ${r.unit}`),
        h('td',{},h('span',{class:`badge ${r.status}`},r.statusLabel),r.source?.url?h('a',{href:r.source.url,target:'_blank',rel:'noopener',style:'margin-left:4px;color:var(--accent2)'},'↗'):null)))),
  );
}
function paneDesign(p){
  const b=sim.built,c=sim.control,v=b.spec,W=c.W,r0=sim.vehicle.rotors[0].rotor,atm=sim.environment.surface;
  const twr=v.kind==='coax'?(c.trim.thrustMax??NaN)/W:(c.tMax*b.rotors.length)/W;
  const omega=(v.kind==='coax'?(c.rpmSetpoint??v.rpm.nominal):(v.rpm.max))*Math.PI/30,tipM=omega*r0.radius/atm.speedOfSound;
  const st=r0.stations[Math.floor(r0.stations.length*.7)],re=atm.density*omega*st.r*st.c/atm.dynamicViscosity;
  const hoverP=v.kind==='coax'?c.trim.power/.84+v.avionicsPower:NaN;
  p.append(
    row(t('vehicle'),select(VEHICLE_ORDER.map(id=>[id,L(VEHICLES[id].label)]),spec.vehicle,v=>set('vehicle',v))),
    row(t('frame'),select(FRAME_TYPES.map(f=>[f,L(FRAME_LABELS[f])]),spec.frame,v=>set('frame',v))),
    row(`${t('payload')}: ${fmt(spec.payload,2)} kg`,h('input',{type:'range',min:0,max:v.publishedMass&&v.publishedMass>10?5:1.5,step:.05,value:spec.payload,onchange:e=>set('payload',+e.target.value)})),
    row(t('calibration'),select([['1',t('calibrated')],['0',t('uncalibrated')]],spec.calibrated?'1':'0',x=>set('calibrated',x==='1'))),
    h('div',{class:'kv'},
      h('span',{},t('mass')),h('b',{},`${fmt(b.mass,3)} kg`),
      h('span',{},t('com')),h('b',{},b.com.map(x=>fmt(x,3)).join(', ')+' m'),
      h('span',{},t('inertia')),h('b',{},b.principal.moments.map(m=>m.toExponential(2)).join(' · ')),
      h('span',{},t('canHover')),h('b',{class:c.canHover?'ok':'bad'},c.canHover?t('yes'):t('no')),
      h('span',{},t('twr')),h('b',{},fmt(twr,2)),
      h('span',{},t('rpm')),h('b',{},`${fmt(v.kind==='coax'?c.rpmSetpoint:NaN,0)} rpm`),
      h('span',{},t('tipMach')),h('b',{},fmt(tipM,2)),
      h('span',{},t('reynolds')),h('b',{},fmt(re,0)),
      h('span',{},t('hoverPower')),h('b',{},Number.isFinite(hoverP)?`${fmt(hoverP,0)} W`:fmt(sim.budget.hoverPower,0)+' W')),
    h('h3',{},t('breakdown')),h('table',{},...Object.entries(b.groups).map(([k,m])=>h('tr',{},h('td',{},k),h('td',{},`${fmt(m,3)} kg`),h('td',{},`${fmt(100*m/b.mass,1)} %`)))),
    h('p',{class:'note'},L(FEA_NOTE)),
    h('p',{class:'note'},Object.entries(v.notes??{}).map(([k,n])=>`${k}: ${n}`).join(' · ')),
  );
}
function currentPlan(){const e=sim.mission.result?.success?sim.mission.result.energyWh:sim.budget.energyWh;return solarPlan(sim,e,missionSpec());}
function drawMap(cv){
  const g=cv.getContext('2d'),N=cv.width=cv.height=360,R=150,img=g.createImageData(N,N);
  const base=MARS?[150,90,60,5,3,2]:[105,112,62,2,1.6,1];
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=(i/N-.5)*2*R,z=(j/N-.5)*2*R,hh=terrain.heightAt(x,z),n=terrain.normalAt(x,z,1.5),sh=.55+.45*Math.max(0,n[0]*.5+n[1]*.7-n[2]*.5);
    const k=(i+j*N)*4;img.data[k]=(base[0]+hh*base[3])*sh;img.data[k+1]=(base[1]+hh*base[4])*sh;img.data[k+2]=(base[2]+hh*base[5])*sh;img.data[k+3]=255;}
  g.putImageData(img,0,0);const P=(x,z)=>[(x/(2*R)+.5)*N,(z/(2*R)+.5)*N];
  g.fillStyle=MARS?'#1a0f0899':'#2a2a2a99';for(const r of terrain.rocks){if(r.d<.8||Math.abs(r.x)>R||Math.abs(r.z)>R)continue;const [a,b]=P(r.x,r.z);g.fillRect(a,b,2,2);}
  g.strokeStyle='#7ef0ff';g.lineWidth=2;g.beginPath();let [a,b]=P(0,0);g.moveTo(a,b);for(const w of spec.waypoints){[a,b]=P(w.x,w.z);g.lineTo(a,b);}if(spec.returnHome){[a,b]=P(0,0);g.lineTo(a,b);}g.stroke();
  g.fillStyle='#ffd166';[a,b]=P(0,0);g.beginPath();g.arc(a,b,5,0,7);g.fill();
  spec.waypoints.forEach((w,i)=>{[a,b]=P(w.x,w.z);g.fillStyle='#7ef0ff';g.beginPath();g.arc(a,b,5,0,7);g.fill();g.fillStyle='#fff';g.font='11px system-ui';g.fillText(`${i+1}`,a+7,b-6);});
  if(sim){const q=sim.vehicle.position;[a,b]=P(q.x,q.z);g.fillStyle='#ff8a4c';g.fillRect(a-3,b-3,6,6);}
  g.fillStyle='#fff9';g.fillText(`N ↑   ${2*R} m`,6,14);
  cv.onclick=e=>{if(running)return;const rc=cv.getBoundingClientRect(),x=((e.clientX-rc.left)/rc.width-.5)*2*R,z=((e.clientY-rc.top)/rc.height-.5)*2*R;
    spec.waypoints.push({x:Math.round(x),z:Math.round(z),action:'observe',dwell:4,name:`T${spec.waypoints.length+1}`});rebuild();};
}
function paneMission(p){
  const B=sim.budget,r=sim.mission.result,cv=h('canvas',{id:'map'});
  p.append(h('p',{class:'note'},t('addWp')),cv,
    h('table',{},...spec.waypoints.map((w,i)=>h('tr',{},h('td',{},`${i+1}. ${w.name}`),h('td',{},`x ${w.x} · z ${w.z}`),h('td',{},h('button',{class:'sec',disabled:running,onclick:()=>{spec.waypoints.splice(i,1);rebuild();}},'×'))))),
    h('div',{style:'display:flex;gap:6px;margin:6px 0'},h('button',{class:'sec',disabled:running,onclick:()=>{spec.waypoints=[];rebuild();}},t('clearWp'))),
    row(`${t('cruise')} (m)`,num(spec.cruiseAltitude,v=>set('cruiseAltitude',Math.max(1,v??5)),{step:1,min:1,max:30})),
    row(`${t('speed')} (m/s)`,num(spec.speed,v=>set('speed',Math.max(.5,v??3)),{step:.5,min:.5,max:12})),
    row(`${t('reserve')} (%)`,num(Math.round(spec.reserve*100),v=>set('reserve',Math.min(.6,Math.max(0,(v??15)/100))),{step:5,min:0,max:60})),
    row(t('control'),select(WORLD.controls.map(c=>[c,t(CONTROL_LABEL[c])]),spec.control,v=>set('control',v))),
    h('h3',{},t('budget')),
    h('div',{class:'kv'},
      h('span',{},t('route')),h('b',{},`${fmt(B.routeLength,0)} m`),h('span',{},t('flightTime')),h('b',{},`${fmt(B.flightTime,0)} s`),
      h('span',{},t('energy')),h('b',{},`${fmt(B.energyWh,2)} Wh`),h('span',{},t('available')),h('b',{},`${fmt(B.availableWh,2)} Wh`),
      h('span',{},t('margin')),h('b',{class:B.margin>0?'ok':'bad'},`${fmt(B.margin,2)} Wh`),h('span',{},t('feasible')),h('b',{class:B.feasible?'ok':'bad'},B.feasible?t('yes'):t('no'))),
    h('div',{style:'display:flex;gap:6px;margin:10px 0;flex-wrap:wrap'},
      h('button',{class:'act',disabled:running,onclick:launch},t('launch')),
      h('button',{class:'sec',disabled:!running,onclick:()=>sim.control.land()},t('land')),
      h('button',{class:'sec',onclick:reset},t('reset'))),
    r?h('p',{class:r.success?'ok':'bad'},`${t('result')}: ${r.success?t('success'):t('failed')} — ${r.reason} · ${t('observations')} ${r.observations}/${r.requiredObservations} · ${fmt(r.energyWh,2)} Wh · ${fmt(r.flightTime,1)} s`):null,
  );
  if(!WORLD.solar){requestAnimationFrame(()=>drawMap(cv));return;} // the multi-sol energy model is Mars-specific
  // energy over sols: solar charging, night heating, one flight per sol when the battery allows
  const plan=currentPlan(),soc=h('canvas',{class:'chart'}),pw=h('canvas',{class:'chart'}),sp=sim.built.spec;
  p.append(h('h3',{},t('solarTitle')),
    row(`${t('panelArea')} (m²)`,num(spec.panelArea,v=>set('panelArea',v),{step:.01,min:0,placeholder:`${sp.solar?.area??0}`})),
    row(`${t('dustRate')} (%/sol)`,num(+(100*spec.dustPerSol).toFixed(2),v=>set('dustPerSol',Math.max(0,(v??.2)/100)),{step:.05,min:0,max:2})),
    plan?h('div',{class:'kv'},
      h('span',{},t('harvest')),h('b',{},`${fmt(plan.meanHarvestWh,1)} Wh/sol`),h('span',{},t('night')),h('b',{},`${fmt(plan.meanNightWh,1)} Wh/sol`),
      h('span',{},t('flyToday')),h('b',{class:plan.days[0].flew?'ok':'bad'},plan.days[0].flew?t('yes'):t('no')),
      h('span',{},`${t('flightsSols')} (${plan.days.length})`),h('b',{},String(plan.flights)),
      h('span',{},t('survives')),h('b',{class:plan.survived&&plan.minSoC>.1?'ok':'bad'},`${plan.survived?t('yes'):t('no')} · min ${fmt(100*plan.minSoC,0)} %`)):h('p',{class:'note'},'—'),
    soc,pw,h('p',{class:'note'},t('solarNote')));
  requestAnimationFrame(()=>{drawMap(cv);if(plan){const x=plan.timeline.map(q=>q.sol);
    lineChart(soc,{x,xLabel:'sol',title:`${t('soc')} (%)`,series:[{label:'SoC',data:plan.timeline.map(q=>100*q.soc),color:'#7bd88f'}]});
    lineChart(pw,{x,xLabel:'sol',title:`${t('power')} (W)`,series:[{label:t('panel'),data:plan.timeline.map(q=>q.pv),color:'#ffd166'},{label:t('heater'),data:plan.timeline.map(q=>q.heat),color:'#ff6b6b'}]});}});
}
function paneFlight(p){
  p.append(row(t('camera'),select([['chase',t('chase')],['fpv',t('fpv')],['orbit',t('orbit')]],cameraMode,v=>{setCamera(v);canvas.focus();})),
    row(t('control'),select(WORLD.controls.map(c=>[c,t(CONTROL_LABEL[c])]),spec.control,v=>set('control',v))),
    h('p',{class:'note'},t('keys')),
    h('p',{class:padInfo?'ok':'note',id:'padStatus'},padInfo?`🎮 ${padInfo.name} — ${t('padOn')}${padInfo.standard?'':' (non-standard mapping)'}`:`🎮 ${t('padNone')}`),
    h('p',{class:'note'},t('padHelp')),MARS?h('p',{class:'note'},t('padFpvMars')):null,
    spec.control==='earth-fpv'?h('p',{class:'warn'},`${t('linkInfo')} (${fmt(sim.link.oneWayLightTime/60,1)} min)`):null,
    spec.control==='autonomous'?h('p',{class:'note'},`${t('autonomous')}: ${t('waypoints')} ${spec.waypoints.length}`):null);
}
let telemetryCanvases=null;
function paneTelemetry(p){
  telemetryCanvases=['alt','power','soc','tilt'].map(()=>h('canvas',{class:'chart'}));
  p.append(...telemetryCanvases,h('div',{style:'display:flex;gap:6px'},
    h('button',{class:'sec',onclick:()=>download('telemetry.csv',sim.telemetry.toCSV(),'text/csv')},`${t('export')} CSV`),
    h('button',{class:'sec',onclick:()=>download('telemetry.json',JSON.stringify(sim.telemetry.toJSON()),'application/json')},`${t('export')} JSON`)));
  drawTelemetry();
}
function drawTelemetry(){
  if(activeTab!=='telemetry'||!telemetryCanvases)return;const c=sim.telemetry.cols;
  lineChart(telemetryCanvases[0],{x:c.t,xLabel:'s',title:`${t('altitude')} (m) · ${t('speed')} (m/s)`,series:[{label:'AGL',data:c.agl,color:'#7ef0ff'},{label:'speed',data:c.speed,color:'#ff8a4c'}]});
  lineChart(telemetryCanvases[1],{x:c.t,xLabel:'s',title:`${t('power')} (W)`,series:[{label:'electrical',data:c.power,color:'#ffd166'},{label:'shaft',data:c.shaftPower,color:'#ff8a4c'}]});
  lineChart(telemetryCanvases[2],{x:c.t,xLabel:'s',title:`${t('soc')} (%) · ${t('energy')} (Wh)`,series:[{label:'SoC %',data:c.soc.map(v=>100*v),color:'#7bd88f'},{label:'Wh',data:c.energy,color:'#e2a6ff'}]});
  lineChart(telemetryCanvases[3],{x:c.t,xLabel:'s',title:`${t('tilt')} (°) · rpm/100`,series:[{label:'tilt',data:c.tilt,color:'#ff6b6b'},{label:'rpm/100',data:c.rpm0.map(v=>v/100),color:'#8ec5ff'}]});
}
function paneExperiments(p){
  const ids=Object.keys(EXPERIMENTS);let choice=expChoice&&EXPERIMENTS[expChoice]?expChoice:ids[0];
  const prog=h('p',{class:'note'}),chart=h('canvas',{class:'chart'}),chart2=h('canvas',{class:'chart'}),chart3=h('canvas',{class:'chart'}),table=h('div');
  const run=()=>{
    if(worker)return;const def=JSON.parse(JSON.stringify(EXPERIMENTS[choice]));
    worker=new Worker(new URL('./experiment-worker.js',import.meta.url),{type:'module'});
    worker.onmessage=e=>{const m=e.data;
      if(m.type==='progress')prog.textContent=`${t('expRunning')} ${m.done}/${m.total} · ${m.row.reason}`;
      if(m.type==='error'){prog.textContent=m.message;worker.terminate();worker=null;}
      if(m.type==='done'){lastExperiment=m.result;worker.terminate();worker=null;prog.textContent=`${t('expResults')}: ${m.result.rows.length}`;showResults();}};
    worker.postMessage(def);prog.textContent=`${t('expRunning')}…`;
  };
  const showResults=()=>{
    if(!lastExperiment)return;const d=lastExperiment.definition,keys=d.variables.map(v=>v.key),S=lastExperiment.summary;
    const labels=S.map(s=>keys.map(k=>s[k]).join(' / '));
    barChart(chart,{labels,values:S.map(s=>s.success?s.energyWh:NaN),errors:S.map(s=>s.energyWhSd),title:t('energy'),unit:'Wh'});
    barChart(chart2,{labels,values:S.map(s=>100*s.success),title:`${t('success')}`,unit:'%',color:'#7bd88f'});
    if(MARS)barChart(chart3,{labels,values:S.map(s=>s.flightsPer10Sols),title:`${t('flightsSols')} (10)`,color:'#ffd166'});
    table.replaceChildren(h('table',{},h('tr',{},...keys.map(k=>h('th',{},L(VARIABLES[k].label))),h('th',{},'✓'),h('th',{},'Wh'),h('th',{},'s'),h('th',{},'tilt°'),MARS?h('th',{},'✈/10 sol'):null),
      ...S.map(s=>h('tr',{},...keys.map(k=>h('td',{},String(s[k]))),h('td',{},`${fmt(100*s.success,0)}%`),h('td',{},`${fmt(s.energyWh,2)}±${fmt(s.energyWhSd,2)}`),h('td',{},fmt(s.flightTime,1)),h('td',{},fmt(s.maxTilt,1)),MARS?h('td',{},fmt(s.flightsPer10Sols,1)):null))),
      h('div',{style:'display:flex;gap:6px;margin-top:6px'},
        h('button',{class:'sec',onclick:()=>download(`${d.name}.csv`,toCSV(lastExperiment.rows),'text/csv')},`${t('export')} CSV`),
        h('button',{class:'sec',onclick:()=>download(`${d.name}.json`,JSON.stringify(lastExperiment,null,1),'application/json')},`${t('export')} JSON`)));
  };
  const def=EXPERIMENTS[choice];
  p.append(row(t('expPreset'),select(ids.map(id=>[id,L(EXPERIMENTS[id].label)]),choice,v=>{expChoice=v;refreshPanels();})),
    h('p',{class:'note'},`${t('expVar')}: ${def.variables.map(v=>`${L(VARIABLES[v.key].label)} = ${v.values.join(', ')}`).join(' × ')} · ${t('expSeeds')}: ${def.seeds.length}`),
    h('button',{class:'act',onclick:run,disabled:!!worker},t('expRun')),prog,chart,chart2,MARS?chart3:null,table);
  showResults();
}
function paneReport(p){
  const md=buildReport({sim,experiment:lastExperiment,dust:spec.opticalDepth,solar:WORLD.solar?currentPlan():null,world:WORLD.id,site:WORLD.site.label});
  p.append(h('div',{style:'display:flex;gap:6px'},
    h('button',{class:'sec',onclick:()=>download('osiriszk-report.md',md,'text/markdown')},`${t('download')} .md`),
    h('button',{class:'sec',onclick:()=>download('osiriszk-report.json',JSON.stringify({spec:missionSpec(),result:sim.mission.result,budget:sim.budget,experiment:lastExperiment,environment:sim.environment.toJSON()},null,1),'application/json')},`${t('download')} .json`)),
    h('div',{id:'report',html:markdownToHtml(md)}));
}
function download(name,text,type){const a=h('a',{href:URL.createObjectURL(new Blob([text],{type})),download:name});document.body.append(a);a.click();a.remove();}

function buildHeader(){
  document.title=t('title');$('#home').title=t('home');
  $('#worlds').replaceChildren(...['earth','mars'].map(id=>h('a',{href:worldHref(id),class:id===WORLD.id?'on':'','aria-current':id===WORLD.id?'page':null},t(id==='earth'?'worldEarth':'worldMars'))));
}
$('#home').href=worldHref(null);
$('#lang').value=getLang();
$('#lang').onchange=e=>{setLang(e.target.value);buildHeader();buildTabs();refreshPanels();};
$('#quality').onchange=e=>{world.setQuality(e.target.value);canvas.focus();};

// ---------- performance measurement ----------
const gl=renderer.getContext?.(),timer=gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');let gpuMs=NaN,pending=[];
const perf={frames:0,acc:0,phys:0,cpu:0,last:performance.now(),fps:0,frameMs:0,physMs:0,cpuMs:0,bench:null};
function gpuBegin(){if(!timer||pending.length>3)return null;const q=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,q);return q;}
function gpuEnd(q){if(!q)return;gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push(q);}
function gpuPoll(){while(pending.length){const q=pending[0];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))break;if(!gl.getParameter(timer.GPU_DISJOINT_EXT))gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);pending.shift();}}
function startBench(){perf.bench={start:performance.now(),frames:[],phys:[]};}

// ---------- main loop ----------
const rp=new THREE.Vector3(),rq=new THREE.Quaternion(),tmp=new THREE.Vector3(),fwd=new THREE.Vector3();let last=performance.now(),hudT=0,chartT=0;
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;const t0=performance.now();
  let alpha=1;pollPad();
  if(running&&sim){
    if(spec.control!=='autonomous'&&sim.mission.phase==='piloted')sim.mission.pilot(stick());
    const tp=performance.now();alpha=sim.physics.advance(dt,onStep);perf.phys+=performance.now()-tp;
    if(sim.mission.result){running=false;refreshPanels();}
  }
  rp.lerpVectors(prevPos,curPos,alpha);rq.slerpQuaternions(prevQ,curQ,alpha);
  model.group.position.copy(rp);model.group.quaternion.copy(rq);model.update(sim.vehicle,dt);
  // camera
  fwd.set(0,0,-1).applyQuaternion(rq);fwd.y=0;if(fwd.lengthSq()<1e-6)fwd.set(0,0,-1);fwd.normalize();
  if(cameraMode==='chase'){const s=Math.max(1,Math.cbrt(sim.built.mass));camera.position.lerp(tmp.copy(rp).addScaledVector(fwd,-4.5*s).add(new THREE.Vector3(0,2.2*s,0)),1-Math.exp(-dt*4));camera.lookAt(rp);}
  else if(cameraMode==='fpv'){camera.position.copy(rp).add(tmp.set(0,-.05,-.08).applyQuaternion(rq));camera.quaternion.copy(rq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.35));}
  else{orbit.target.copy(rp);orbit.update();}
  world.sun.target.position.copy(rp);world.sun.position.copy(rp).addScaledVector(world.sunDir,200);followCamera(world,camera);
  // rotor-downwash dust within ~2 rotor radii of the ground (visual only)
  {const R=sim.vehicle.rotors[0].rotor.radius*(sim.vehicle.rotors.length>2?2.2:1),agl=(sim.vehicle.out.groundHeight??99)-sim.vehicle.footClearance,
    spin=Math.min(1,sim.vehicle.rotors[0].motor.omega/Math.max(1,sim.control.rpmSetpoint?sim.control.rpmSetpoint*Math.PI/30:sim.vehicle.rotors[0].motor.omega||1));
    const strength=running?Math.max(0,Math.min(1,(2*R-agl)/(2*R)))*spin*Math.min(1,sim.vehicle.out.thrust/Math.max(1e-6,sim.control.W)):0;
    dust.update(dt,rp,(x,z)=>terrain.heightAt(x,z),R,strength,dustColor);}
  const q=gpuBegin();renderer.render(world.scene,camera);gpuEnd(q);if(timer)gpuPoll();
  perf.cpu+=performance.now()-t0;perf.frames++;
  if(perf.bench){perf.bench.frames.push(dt*1000);perf.bench.phys.push(perf.phys);if(now-perf.bench.start>1e4){finishBench();}}
  if(now-perf.last>500){const n=perf.frames,s=(now-perf.last)/1000;perf.fps=n/s;perf.frameMs=1000*s/n;perf.physMs=perf.phys/n;perf.cpuMs=perf.cpu/n;perf.frames=0;perf.phys=0;perf.cpu=0;perf.last=now;
    const info=renderer.info?.render??{};
    $('#perf').textContent=`${rendererName} · ${world.qualityName}\nFPS ${perf.fps.toFixed(0)} · frame ${perf.frameMs.toFixed(1)} ms\nCPU ${perf.cpuMs.toFixed(2)} ms · physics ${perf.physMs.toFixed(2)} ms\nGPU ${Number.isFinite(gpuMs)?gpuMs.toFixed(2)+' ms':'n/a'}\ndraw ${info.calls??'?'} · tris ${((info.triangles??0)/1000).toFixed(0)}k`;}
  if(now-hudT>100){hudT=now;hud();}
  if(running&&now-chartT>1000){chartT=now;drawTelemetry();if(activeTab==='mission'){const cv=$('#map');if(cv)drawMap(cv);}}
  requestAnimationFrame(frame);
}
function finishBench(){
  const b=perf.bench;perf.bench=null;const f=[...b.frames].sort((a,c)=>a-c),mean=f.reduce((s,x)=>s+x,0)/f.length;
  const dbg=gl?.getExtension?.('WEBGL_debug_renderer_info');
  const out={tool:'osiriszk-render-bench',date:new Date().toISOString(),renderer:rendererName,quality:world.qualityName,gpu:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'n/a',
    viewport:[innerWidth,innerHeight,renderer.getPixelRatio()],frames:f.length,meanFrameMs:+mean.toFixed(3),p95FrameMs:+f[Math.floor(.95*f.length)].toFixed(3),fps:+(1000/mean).toFixed(1),
    gpuMs:Number.isFinite(gpuMs)?+gpuMs.toFixed(3):null,drawCalls:renderer.info?.render?.calls,triangles:renderer.info?.render?.triangles,note:'Browsers cap FPS at the display refresh rate; compare frame and GPU times.'};
  download(`render-bench-${rendererName}-${world.qualityName}.json`,JSON.stringify(out,null,1),'application/json');
}
function hud(){
  const v=sim.vehicle,o=v.out,p=v.position,vel=v.velocity,agl=(o.groundHeight??NaN)-v.footClearance,c=sim.control;
  const link=sim.mission.link,wait=link?.queue?.length?link.queue[0].arrive-sim.time:null;
  $('#hud').textContent=`${L(sim.built.spec.label)}\n${t('phase')}: ${sim.mission.phase} · ${c.status}\n${t('altitude')}: ${fmt(agl,1)} m   ${t('vspeed')}: ${fmt(vel.y,1)} m/s\n`+
    `${t('speed')}: ${fmt(Math.hypot(vel.x,vel.z),1)} m/s   ${t('thrust')}: ${fmt(o.thrust,1)} N / ${fmt(c.W,1)} N\n${t('power')}: ${fmt(o.power,0)} W   ${t('energy')}: ${fmt(v.energyWh,2)} Wh\n`+
    `${t('soc')}: ${fmt(100*v.battery.soc,1)} %  ${fmt(v.battery.voltage,1)} V   rpm ${fmt(v.rpm(0),0)}\nρ ${fmt(o.density,4)} kg/m³   t ${fmt(sim.time,1)} s`+
    (link&&link.delay>0?`\n${t('linkWait')}: ${wait!=null?new Date(wait*1000).toISOString().slice(11,19):fmt(link.delay/60,1)+' min'}`:'')+
    (padInfo?`\n🎮 ${padInfo.name} · ${t(CONTROL_LABEL[spec.control])}`:'')+
    `\n[${t('perf')}] ${params.get('bench')?'':'B: '+t('bench')}`;
}
addEventListener('keydown',e=>{if(e.code==='KeyB'&&!perf.bench)startBench();});

buildHeader();buildTabs();rebuild();requestAnimationFrame(frame);
// read-only handle for automated checks
window.__osiris={world:WORLD.id,get sim(){return sim;},get running(){return running;},launch,rebuild,get spec(){return spec;},perf,get pad(){return padInfo;},pollPad,camera,setCamera};
