import {datum,withValue} from './provenance.js';
import {siteModels} from './environment.js';

/**
 * Candidate base sites. Every number is a datum with its kind:
 *   coordinates of landing sites are published; a "representative point" inside a region is a
 *   team assumption; elevations are approximate assumptions until MOLA is imported; the ice index,
 *   dust τ and science score are assumptions with written rationale. Solar, temperature and
 *   pressure are computed by the models in environment.js; landing safety comes from the drone
 *   survey. The player can edit any assumption and import NASA data (adapters/) to replace it.
 *
 * `terrain` sets the SYNTHETIC local terrain the survey drone flies over (we have no real
 * topography of these sites here): relief (m), craters ≥ 10 m per km² and Golombek rock abundance k
 * are TEAM ASSUMPTIONS chosen to reflect each site's general character (smooth plains → low relief
 * and few rocks; layered or rocky terrain → rougher). They are not measurements. A real DTM
 * (e.g. HiRISE, tools/import-dtm.mjs) can be loaded instead and then the survey measures real
 * slopes.
 */
const A=(value,unit,uncertainty,rationale,extra={})=>datum(value,{unit,kind:'assumption',uncertainty,rationale,...extra});
const P=(value,unit,source,extra={})=>datum(value,{unit,kind:'published',source,...extra});
const ELEV_NOTE={en:'Approximate; replace with a MOLA MEGDR sample (raster adapter)',tr:'Yaklaşık; MOLA MEGDR örneğiyle değiştirin (raster bağdaştırıcı)'};
const DUST_NOTE='No site-specific dust climatology imported: global annual mean τ ≈ 0.5 assumed at every site, so this criterion does not separate the sites until data are imported';

export const SITE_CATALOG=Object.freeze([
  {id:'jezero',label:{en:'Jezero Crater',tr:'Jezero Krateri'},
    summary:{en:'Ancient lake and river delta; Perseverance landing site and sample cache',tr:'Eski göl ve nehir deltası; Perseverance iniş yeri ve numune deposu'},
    data:{
      latitude:P(18.4447,'°N','giss'),longitude:P(77.4508,'°E','giss'),
      elevation:A(-2600,'m',300,ELEV_NOTE.en),
      ice:A(.10,'index',.2,'18° N: near-surface ice is not expected this close to the equator (ez2015, piqueux2019); water would come from hydrated minerals'),
      dust:A(.5,'τ',.2,DUST_NOTE),
      science:A(9,'1–9',1,'Delta and lake sediments with organics potential; Perseverance cached samples; MEDA weather record'),
    },
    terrain:{relief:5,craterDensity:60,rockAbundance:.08},checks:['meda']},
  {id:'gale',label:{en:'Gale Crater',tr:'Gale Krateri'},
    summary:{en:'Mount Sharp layered sediments; Curiosity landing site',tr:'Sharp Dağı katmanlı tortulları; Curiosity iniş yeri'},
    data:{
      latitude:P(-4.5895,'°N','bradbury'),longitude:P(137.4417,'°E','bradbury'),
      elevation:A(-4500,'m',300,ELEV_NOTE.en),
      ice:A(.05,'index',.2,'4.6° S: equatorial, near-surface ice not expected; hydrated minerals present'),
      dust:A(.5,'τ',.2,DUST_NOTE),
      science:A(8,'1–9',1,'Thick layered sedimentary record of a habitable lake; more than a decade of Curiosity data'),
    },
    terrain:{relief:4.5,craterDensity:50,rockAbundance:.09}},
  {id:'arcadia',label:{en:'Arcadia Planitia',tr:'Arcadia Planitia'},
    summary:{en:'Smooth northern plains with shallow water ice',tr:'Sığ su buzu içeren düz kuzey ovası'},
    data:{
      latitude:A(42.0,'°N',0,'Representative point inside the shallow-ice part of Arcadia Planitia (team choice; region from piqueux2019)'),
      longitude:A(192.0,'°E',0,'Representative point (team choice)'),
      elevation:A(-3500,'m',400,ELEV_NOTE.en),
      ice:A(.85,'index',.15,'Piqueux et al. 2019: ice within ~30 cm of the surface in parts of Arcadia Planitia, "the most tempting target"'),
      dust:A(.5,'τ',.2,DUST_NOTE),
      science:A(6,'1–9',1,'Ice and recent-climate record; younger, less diverse geology than the crater sites'),
    },
    terrain:{relief:2.5,craterDensity:30,rockAbundance:.03}},
  {id:'mawrth',label:{en:'Mawrth Vallis',tr:'Mawrth Vallis'},
    summary:{en:'Thick, diverse clay-bearing layers; 2015 Exploration Zone proposal',tr:'Kalın ve çeşitli kil katmanları; 2015 Keşif Bölgesi önerisi'},
    data:{
      latitude:A(22.6,'°N',0,'Representative point near the candidate landing ellipses (team choice)'),
      longitude:A(343.5,'°E',0,'Representative point (team choice)'),
      elevation:A(-2500,'m',400,ELEV_NOTE.en),
      ice:A(.15,'index',.2,'22° N: no shallow ice expected; abundant hydrated clays as a water source'),
      dust:A(.5,'τ',.2,DUST_NOTE),
      science:A(8,'1–9',1,'One of the thickest and most diverse clay sequences on Mars; proposed Exploration Zone (ez2015)'),
    },
    terrain:{relief:7.5,craterDensity:50,rockAbundance:.07}},
  {id:'utopia',label:{en:'Utopia Planitia (Zhurong)',tr:'Utopia Planitia (Zhurong)'},
    summary:{en:'Lowland plains; Tianwen-1 / Zhurong landing region',tr:'Alçak ova; Tianwen-1 / Zhurong iniş bölgesi'},
    data:{
      latitude:P(25.066,'°N','zhurong'),longitude:P(109.925,'°E','zhurong'),
      elevation:A(-4100,'m',300,ELEV_NOTE.en),
      ice:A(.25,'index',.2,'25° N: south of the mid-latitude ice-rich deposits; low confidence'),
      dust:A(.5,'τ',.2,DUST_NOTE),
      science:A(6,'1–9',1,'Lowland plains with possible water-related landforms (debated); Zhurong rover data'),
    },
    terrain:{relief:3.5,craterDensity:40,rockAbundance:.05}},
]);
export const DEFAULT_SITES=Object.freeze(['jezero','arcadia','mawrth']);
export const siteSeed=id=>{let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%100000+1;};

/**
 * A working copy of a catalog site with the player's edits and imports applied and the models
 * (solar, temperature, pressure, column) computed. edits: {key: datum} replacing catalog datums.
 */
export function prepareSite(id,edits={}){
  const base=SITE_CATALOG.find(s=>s.id===id);if(!base)throw new RangeError(`Unknown site '${id}'`);
  const data={...base.data,...edits};
  const site={...base,data,seed:siteSeed(id)};
  const m=siteModels(site);
  site.data={...data,solar:edits.solar??m.solar,temperature:edits.temperature??m.temperature,pressure:edits.pressure??m.pressure,column:m.column};
  site.models=m;
  return site;
}

/** Edit an assumption (player input): keeps the rationale, records the change. */
export function editAssumption(d,value,who='player'){
  if(d.kind!=='assumption')throw new RangeError('Only assumptions can be edited by hand; import data to replace other kinds');
  return withValue(d,value,{transforms:[`edited by ${who}`]});
}
