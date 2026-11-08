// Real conditions from NASA services, fetched at run time (in the browser) and turned into
// environment overrides. Nothing here invents data: if a service cannot be reached the caller
// keeps the model values and says so.
//
//  Mars  · NASA/JPL Mars 2020 weather feed (Perseverance MEDA at Jezero, the simulator's site):
//          daily air temperature high/low (°C) and pressure (Pa) per sol. Outreach product;
//          it lags and has gaps. Science-grade MEDA data are in the PDS (months later).
//  Earth · NASA POWER (Langley) hourly point data: 2 m temperature (°C), surface pressure (kPa),
//          10 m wind speed (m/s) and direction (° from north, where the wind comes from).
//          Typically 2–7 days behind real time.
//  Earth · NASA EPIC (DSCOVR, Sun–Earth L1): full-disk natural-colour photos of the sunlit Earth,
//          several per day, usually 12–36 h behind. Used on the landing page.
import {ambientTemperature} from '../power/solar.js';

export const NASA_SERVICES=Object.freeze({
  mars2020:{
    label:'NASA/JPL Mars 2020 weather (Perseverance MEDA, Jezero)',
    url:'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json',
    // same-origin path, proxied by Netlify (app/public/_redirects) and the Vite dev server
    proxy:'nasa/mars/rss/api/?feed=weather&category=mars2020&feedtype=json',
    page:'https://mars.nasa.gov/mars2020/weather/',
  },
  power:{
    label:'NASA POWER hourly (Langley Research Center)',
    url:'https://power.larc.nasa.gov/api/temporal/hourly/point',
    proxy:'nasa/power/api/temporal/hourly/point',
    page:'https://power.larc.nasa.gov/',
  },
  epic:{
    label:'NASA EPIC (DSCOVR), natural colour',
    url:'https://epic.gsfc.nasa.gov/api/natural',
    proxy:'nasa/epic/api/natural',
    archive:'https://epic.gsfc.nasa.gov/archive/natural',
    page:'https://epic.gsfc.nasa.gov/',
    fovDeg:.61, // EPIC field of view (the 2048² images span it)
  },
});

/** Published MEDA ranges at Jezero (offline reference, sourced; see docs/SOURCES.md). */
export const MEDA_PUBLISHED=Object.freeze({
  pressureMin:{value:625,ls:101,sol:306,note:'sol-averaged minimum, southern winter, MY36'},
  pressureMax:{value:761,ls:55,sol:105,note:'sol-averaged maximum, northern spring, MY36'},
  airTemperature:{minC:-83,maxC:-23,note:'typical pre-dawn low and afternoon high of the air'},
  firstReading:{value:718,note:'first MEDA pressure, 19 Feb 2021'},
  source:'sanchezLavega2023',temperatureSource:'nasaMedaRelease',
});

const num=v=>{
  if(v==null)return null;if(typeof v==='number')return Number.isFinite(v)?v:null;
  const s=String(v).trim();if(!s||/^-+$/.test(s)||/n\/?a/i.test(s))return null;
  const x=parseFloat(s.replace(',','.'));return Number.isFinite(x)?x:null;
};

/**
 * Parse the Mars 2020 (or MSL) weather feed. Accepts `sols` or `soles`, numbers or strings, "--"
 * for missing. Pressure in hPa/mbar (4–12) is converted to Pa. Returns newest first.
 */
export function parseMarsWeather(json){
  const list=json?.sols??json?.soles;
  if(!Array.isArray(list))throw new Error('Unexpected Mars weather format (no sols list)');
  const out=[];
  for(const s of list){
    const sol=num(s.sol);if(sol==null)continue;
    let p=num(s.pressure),unitNote=null;
    if(p!=null&&p>=4&&p<=12){p*=100;unitNote='pressure given in hPa, converted to Pa';}
    let lo=num(s.min_temp),hi=num(s.max_temp);
    const ok=v=>v!=null&&v>-140&&v<45;
    if(!ok(lo))lo=null;if(!ok(hi))hi=null;if(lo!=null&&hi!=null&&lo>hi)[lo,hi]=[hi,lo];
    if(p!=null&&(p<300||p>1300))p=null;
    out.push({sol,date:s.terrestrial_date??null,ls:num(s.ls),season:s.season??null,minTempC:lo,maxTempC:hi,pressurePa:p,
      sunrise:s.sunrise??null,sunset:s.sunset??null,opacity:s.atmo_opacity??null,uv:s.local_uv_irradiance_index??null,
      windSpeed:num(s.wind_speed),windDirection:s.wind_direction&&!/^-+$/.test(s.wind_direction)?s.wind_direction:null,unitNote});
  }
  return out.sort((a,b)=>b.sol-a.sol);
}
export const latestCompleteSol=sols=>sols.find(s=>s.pressurePa!=null&&s.minTempC!=null&&s.maxTempC!=null)??null;

/**
 * Mars overrides from one sol: the sol's pressure as the surface pressure at the site, and the air
 * temperature at the mission's local solar time from the sol's high/low with the simulator's
 * diurnal shape (that shape is assumed; the high and low are measured).
 */
export function marsConditions(sol,lst,environment){
  const lo=sol.minTempC+273.15,hi=sol.maxTempC+273.15,T=ambientTemperature(lst,{min:lo,max:hi});
  const env=environment.with({surfacePressure:sol.pressurePa,surfaceTemperature:T});
  return {overrides:{surfacePressure:sol.pressurePa,surfaceTemperature:+T.toFixed(2)},density:env.density(0),temperature:T,pressure:sol.pressurePa};
}

const ymd=d=>d.toISOString().slice(0,10).replace(/-/g,'');
/** POWER hourly request for the last `days` days ending `endMs` (UTC hours). */
export function powerURL({lat,lonEast,endMs=Date.now(),days=10,base=NASA_SERVICES.power.url}){
  const end=new Date(endMs),start=new Date(endMs-days*864e5);
  const q=new URLSearchParams({parameters:'T2M,PS,WS10M,WD10M',community:'RE',longitude:lonEast.toFixed(4),latitude:lat.toFixed(4),
    start:ymd(start),end:ymd(end),format:'JSON','time-standard':'UTC'});
  return `${base}?${q}`;
}

/** Parse a POWER hourly JSON response. Hours are UTC when requested with time-standard=UTC. */
export function parsePowerHourly(json){
  const P=json?.properties?.parameter;
  if(!P?.T2M)throw new Error(json?.messages?.join?.(' ')||json?.message||'Unexpected POWER format (no T2M)');
  const fill=num(json?.header?.fill_value)??-999,val=v=>{const x=num(v);return x==null||x===fill||x<=-990?null:x;};
  const hours=Object.keys(P.T2M).sort().map(k=>({key:k,time:Date.UTC(+k.slice(0,4),+k.slice(4,6)-1,+k.slice(6,8),+k.slice(8,10)||0),
    t2m:val(P.T2M[k]),ps:val(P.PS?.[k]),ws10m:val(P.WS10M?.[k]),wd10m:val(P.WD10M?.[k])}));
  const c=json?.geometry?.coordinates??[];
  return {hours,lonEast:num(c[0]),lat:num(c[1]),elevation:num(c[2]),timeStandard:json?.header?.time_standard??json?.header?.timeStandard??'UTC'};
}
/** Latest complete hour, preferring the same UTC hour of day as the mission. */
export function pickPowerHour(hours,missionMs){
  const full=hours.filter(h=>h.t2m!=null&&h.ps!=null&&h.ws10m!=null&&h.wd10m!=null);
  if(!full.length)return null;
  const hh=new Date(missionMs).getUTCHours(),same=full.filter(h=>new Date(h.time).getUTCHours()===hh);
  return (same.length?same:full).at(-1);
}

/**
 * Earth overrides from one POWER hour: profile surface (h = 0) temperature and pressure chosen so
 * that the layered ISA model gives exactly the measured values at the site elevation; the wind is
 * the measured 10 m wind (the core wind model is nominal at 10 m).
 */
export function earthConditions(hour,siteElevation,environment){
  const Ts=hour.t2m+273.15,ps=hour.ps*1000;let T0=Ts,p0=ps;
  for(let k=0;k<6;k++){const s=environment.with({surfaceTemperature:T0,surfacePressure:p0}).atmosphere(siteElevation);T0+=Ts-s.temperature;p0*=ps/s.pressure;}
  const env=environment.with({surfaceTemperature:T0,surfacePressure:p0});
  // rounded to 0.01 K / 0.1 Pa (site values then match the measurement to < 0.1 Pa, < 0.01 K)
  return {overrides:{surfaceTemperature:Math.round(T0*100)/100,surfacePressure:Math.round(p0*10)/10},density:env.density(siteElevation),temperature:Ts,pressure:ps,
    wind:{level:'measured',speed:hour.ws10m,direction:(hour.wd10m+180)%360,fromDirection:hour.wd10m}};
}

/** Try URLs in order (proxy first, then direct); returns {json, url} or throws with every error. */
export async function fetchFirstJSON(urls,{timeout=15000,fetchImpl=globalThis.fetch}={}){
  const errors=[];
  for(const url of urls){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{const r=await fetchImpl(url,{signal:ctl.signal,headers:{accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const text=await r.text();
      try{return {json:JSON.parse(text),url,text};}catch{throw new Error('not JSON');}
    }catch(e){errors.push(`${url}: ${e.name==='AbortError'?'timeout':e.message}`);}
    finally{clearTimeout(timer);}
  }
  throw new Error(errors.join(' · '));
}

/** EPIC "natural" image list → [{image, time (UTC ms), lat, lon, distanceKm}], oldest first. */
export function parseEpic(json){
  if(!Array.isArray(json))throw new Error('Unexpected EPIC format (not a list)');
  const out=[];
  for(const e of json){
    const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(e?.date??'');
    if(!m||typeof e.image!=='string'||!/^[\w-]+$/.test(e.image))continue;
    const p=e.dscovr_j2000_position,dist=p?Math.hypot(p.x,p.y,p.z):null;
    out.push({image:e.image,time:Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]),lat:num(e.centroid_coordinates?.lat),lon:num(e.centroid_coordinates?.lon),
      distanceKm:Number.isFinite(dist)&&dist>1e5?dist:null});
  }
  return out.sort((a,b)=>a.time-b.time);
}
/** The photo centred nearest a longitude (e.g. Ankara's), latest on ties. */
export function pickEpic(list,lonEast){
  let best=null,err=Infinity;
  for(const e of list){if(e.lon==null)continue;const d=Math.abs(((e.lon-lonEast)%360+540)%360-180);if(d<=err){err=d;best=e;}}
  return best??list.at(-1)??null;
}
/** Archive URL of one EPIC photo: kind 'jpg' (2048², ~0.5 MB), 'png' (2048²) or 'thumbs'. */
export function epicImageURL(e,kind='jpg',base=NASA_SERVICES.epic.archive){
  const d=new Date(e.time),p=n=>String(n).padStart(2,'0'),ext=kind==='png'?'png':'jpg';
  return `${base}/${d.getUTCFullYear()}/${p(d.getUTCMonth()+1)}/${p(d.getUTCDate())}/${kind}/${e.image}.${ext}`;
}
/** Share of the image width covered by the Earth's disk, from DSCOVR's distance (null if unknown). */
export function epicDiskFraction(e,fovDeg=NASA_SERVICES.epic.fovDeg){
  if(!e?.distanceKm)return null;
  return Math.min(1,2*Math.atan(6371/e.distanceKm)*180/Math.PI/fovDeg);
}
