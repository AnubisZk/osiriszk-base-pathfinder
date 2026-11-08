// Landing page: pick the Earth or the Mars simulator. The numbers on the cards come from the same
// models the simulators use (profiles, ISA at the Ankara site, today's Earth–Mars light time).
import {PlanetEnvironment} from '../src/planet/PlanetEnvironment.js';
import {VEHICLES} from '../src/vehicles/presets.js';
import {earthMarsLink} from '../src/mars/time.js';
import {NASA_SERVICES,parseEpic,pickEpic,epicImageURL,epicDiskFraction,fetchFirstJSON} from '../src/realdata/nasa.js';
import {ANKARA} from '../src/earth/sun.js';
import {WORLDS,worldHref,worldSpec} from './worlds.js';
import {t,L,setLang,getLang} from './i18n.js';

const h=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!=null)e.setAttribute(k,v);}for(const c of kids.flat())if(c!=null)e.append(c);return e;};
const fmt=(v,d)=>(+v).toFixed(d);

function facts(id){
  const w=WORLDS[id],spec=worldSpec(w),env=new PlanetEnvironment(spec.profile);
  const elev=spec.siteElevation??0,rho=env.density(elev),light=earthMarsLink(Date.now()).oneWayLightTime/60;
  const delay=id==='earth'?t('earthDelay'):`${t('marsDelay')} (${fmt(light,1)} ${getLang()==='tr'?'dk bugün':'min today'})`;
  return [
    [t('gravityShort'),`${fmt(env.gravity,2)} m/s²`],
    [t('densityShort'),`${rho<.1?fmt(rho,3):fmt(rho,2)} kg/m³${id==='earth'?` · ${ANKARA.elevation} m`:''}`],
    [t('delayShort'),delay],
    [t('vehicleShort'),L(VEHICLES[spec.vehicle].label)],
  ];
}

// Card photos. Earth: today's NASA EPIC photo (DSCOVR at L1) centred nearest Ankara's longitude when
// the service answers, else the team's image. Mars: the team's photo. Edit credits here.
const PHOTOS={
  earth:{src:'img/earth-team.webp',scale:1,credit:{en:'Image: team-provided (source to be credited)',tr:'Görsel: takımın gönderdiği (kaynak eklenecek)'}},
  mars:{src:'img/mars-viking.webp',scale:1,credit:{en:'Image: Viking Orbiter mosaic, NASA/JPL/USGS',tr:'Görsel: Viking yörünge aracı mozaiği, NASA/JPL/USGS'}},
};
let epic=null; // {src, scale, time} once a photo has actually loaded
function photoOf(id){
  if(id==='earth'&&epic){const d=new Date(epic.time).toISOString().slice(0,16).replace('T',' ');
    return {src:epic.src,scale:epic.scale,credit:{en:`Photo: NASA EPIC / DSCOVR, ${d} UTC`,tr:`Fotoğraf: NASA EPIC / DSCOVR, ${d} UTC`}};}
  return PHOTOS[id];
}
async function loadEpic(onReady){
  try{
    const S=NASA_SERVICES.epic,{json}=await fetchFirstJSON([S.proxy,S.url],{timeout:8000}),e=pickEpic(parseEpic(json),ANKARA.lonEast);
    if(!e)return;
    const f=epicDiskFraction(e),scale=f?Math.min(1.4,Math.max(1,.985/f)):1.2,src=epicImageURL(e,'jpg');
    const img=new Image();img.decoding='async';img.src=src;await img.decode(); // only swap once the photo has really loaded
    epic={src,scale,time:e.time};onReady();
  }catch(err){console.info('EPIC photo unavailable, keeping the team image:',err.message);}
}

function card(id){
  const title=t(id==='earth'?'earthCardTitle':'marsCardTitle'),text=t(id==='earth'?'earthCardText':'marsCardText'),ph=photoOf(id);
  const img=h('img',{src:ph.src,alt:title,width:512,height:512,loading:'eager',style:`transform:scale(${ph.scale})`});
  img.addEventListener('error',()=>{img.remove();},{once:true}); // the CSS globe underneath stays as the last fallback
  return h('a',{class:`card ${id}`,href:worldHref(id)},
    h('div',{class:'globe'},img),h('small',{class:'credit'},L(ph.credit)),
    h('h3',{},title),h('p',{},text),
    h('dl',{},...facts(id).flatMap(([k,v])=>[h('dt',{},k),h('dd',{},v)])),
    h('span',{class:'go'},`${t('open')} →`));
}

export function showLanding(){
  setLang(getLang());
  document.body.classList.add('landing');document.title='OsirisZk · Earth & Mars rotorcraft simulators';
  const root=document.getElementById('landing');root.hidden=false;
  const render=()=>{
    const lang=h('select',{'aria-label':'Language',onchange:e=>{setLang(e.target.value);render();}},h('option',{value:'en'},'English'),h('option',{value:'tr'},'Türkçe'));lang.value=getLang();
    root.replaceChildren(
      h('div',{class:'land-top'},h('h1',{},h('span',{},'OsirisZk'),' · NASA Space Apps 2026'),lang),
      h('h2',{},t('landTitle')),h('p',{class:'sub'},t('landSub')),
      h('div',{class:'cards'},card('earth'),card('mars')),
      h('p',{class:'foot'},t('landFoot')));
  };
  render();
  loadEpic(render);
}
