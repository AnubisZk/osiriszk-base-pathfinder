// The two simulators share one physics core and one app; a "world" picks the planet, site,
// defaults, options and look. Selected with ?world=earth | ?world=mars (or /earth, /mars).
import {DEFAULT_MISSION} from '../src/mission/Mission.js';
import {EXPERIMENTS,EARTH_EXPERIMENTS,EARTH_BASE} from '../src/experiment/presets.js';
import {ANKARA} from '../src/earth/sun.js';

export const WORLDS=Object.freeze({
  mars:{
    id:'mars',planet:'mars',
    site:{label:'Jezero 18.44°N 77.45°E',utcOffset:null},
    defaults:{},
    controls:['autonomous','earth-fpv','local-fpv'],
    winds:null, // from the Mars profile (Viking ranges)
    experiments:EXPERIMENTS,
    opticalDepthMax:5,
    solar:true,
  },
  earth:{
    id:'earth',planet:'earth',
    site:{label:`${ANKARA.label} ${ANKARA.lat.toFixed(2)}°N ${ANKARA.lonEast.toFixed(2)}°E · ${ANKARA.elevation} m`,utcOffset:3},
    defaults:{...EARTH_BASE,site:{...EARTH_BASE.site},waypoints:EARTH_BASE.waypoints.map(w=>({...w})),wind:{level:'calm',direction:225}},
    controls:['autonomous','local-fpv'],
    // the core's Earth wind levels (src/physics/Wind.js), labelled in both languages
    winds:[{id:'calm',label:{en:'Calm',tr:'Sakin'}},{id:'light',label:{en:'Light · 3 m/s',tr:'Hafif · 3 m/sn'}},
      {id:'moderate',label:{en:'Moderate · 6 m/s',tr:'Orta · 6 m/sn'}},{id:'strong',label:{en:'Strong · 9 m/s',tr:'Kuvvetli · 9 m/sn'}}],
    experiments:{...EARTH_EXPERIMENTS,'earth-mars':EXPERIMENTS['earth-mars']},
    opticalDepthMax:1.5,
    solar:false,
  },
});

/** World from ?world=… or a /earth, /mars path; null → show the landing page. */
export function resolveWorld(loc=location){
  const q=new URLSearchParams(loc.search).get('world');
  if(q&&WORLDS[q])return WORLDS[q];
  const m=/\/(earth|mars)\/?$/.exec(loc.pathname);
  return m?WORLDS[m[1]]:null;
}

/** Link to a world keeping the other query parameters (language, renderer, terrain…). */
export function worldHref(id,loc=location){
  const p=new URLSearchParams(loc.search);
  if(id)p.set('world',id);else p.delete('world');
  p.delete('terrain'); // a loaded DTM belongs to one world
  const s=p.toString(),base=loc.pathname.replace(/\/(earth|mars)\/?$/,'/');
  return `${base}${s?'?'+s:''}`;
}

/** Initial mission spec for a world. */
export function worldSpec(world){
  const s=JSON.parse(JSON.stringify(DEFAULT_MISSION));
  Object.assign(s,JSON.parse(JSON.stringify(world.defaults)));
  s.calibrated=true;return s;
}
