import {datum,KINDS} from '../provenance.js';
import {parseNumber,lonEast} from './tables.js';

/**
 * Field mapping: what each column of an imported table means. The user confirms (or edits) a
 * mapping; nothing is imported silently. Rows are matched to sites by id/name or by the nearest
 * site within a distance; each mapped column becomes a datum with the provenance the user gave
 * (kind, source, date, resolution, unit, CRS) plus the processing steps (scale, offset, match).
 *
 * mapping = {
 *   match: {by: 'id' | 'nearest', column, latColumn, lonColumn, maxDistanceKm},
 *   fields: [{column, key, unit, scale = 1, offset = 0, uncertainty | uncertaintyColumn,
 *             kind, source, date, resolution, crs}]
 * }
 */
export const MARS_RADIUS_KM=3389.5;
export const TARGET_KEYS=Object.freeze({
  ice:{unit:'index',label:{en:'Water-ice access index (0–1)',tr:'Su buzu erişim indeksi (0–1)'},range:[0,1]},
  elevation:{unit:'m',label:{en:'Elevation (m, MOLA)',tr:'Yükseklik (m, MOLA)'},range:[-9000,22000]},
  dust:{unit:'τ',label:{en:'Dust optical depth τ',tr:'Toz optik derinliği τ'},range:[0,10]},
  science:{unit:'1–9',label:{en:'Science score (1–9)',tr:'Bilim puanı (1–9)'},range:[1,9]},
  solar:{unit:'Wh/m²/sol',label:{en:'Solar energy (Wh/m²/sol)',tr:'Güneş enerjisi (Wh/m²/sol)'},range:[0,10000]},
  temperature:{unit:'K',label:{en:'Mean surface temperature (K)',tr:'Ortalama yüzey sıcaklığı (K)'},range:[100,350]},
  pressure:{unit:'Pa',label:{en:'Mean surface pressure (Pa)',tr:'Ortalama yüzey basıncı (Pa)'},range:[50,2000]},
});
// column-name hints for the suggested mapping (lower case, no spaces)
const HINTS={ice:['ice','iceindex','ice_index','buz','swim','consistency'],elevation:['elevation','elev','mola','height','yukseklik','yükseklik','z'],
  dust:['tau','dust','opacity','toz'],science:['science','bilim','score'],solar:['solar','insolation','gunes','güneş'],temperature:['temperature','temp','sicaklik','sıcaklık','t'],pressure:['pressure','basinc','basınç','p']};
const norm=s=>String(s).toLowerCase().replace(/[\s()°\-]/g,'').replace(/_+/g,'_');

/** Great-circle distance (km) on the Mars sphere between (lat, lon) points in degrees. */
export function marsDistanceKm(lat1,lon1,lat2,lon2){
  const r=Math.PI/180,dl=(lat2-lat1)*r,dn=(lon2-lon1)*r,a=Math.sin(dl/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dn/2)**2;
  return 2*MARS_RADIUS_KM*Math.asin(Math.min(1,Math.sqrt(a)));
}

/** A starting mapping guessed from the column names; the user reviews it before applying. */
export function suggestMapping(table){
  const cols=table.columns,find=list=>cols.find(c=>list.includes(norm(c)));
  const idCol=find(['site','id','siteid','name','bolge','bölge']),lat=find(['lat','latitude','enlem','_lat']),lon=find(['lon','long','longitude','boylam','_lon']);
  const match=idCol?{by:'id',column:idCol}:lat&&lon?{by:'nearest',latColumn:lat,lonColumn:lon,maxDistanceKm:50}:{by:'id',column:cols[0]};
  const used=new Set([match.column,match.latColumn,match.lonColumn]);
  const fields=[];
  // exact match, or a long hint at the start of the name ("elevation_m", "ice_consistency")
  const hit=(c,hints)=>{const n=norm(c);return hints.some(h=>n===h||(h.length>=3&&n.startsWith(h)));};
  for(const [key,hints] of Object.entries(HINTS)){const c=cols.find(c=>!used.has(c)&&!c.startsWith('_')&&hit(c,hints));if(c){used.add(c);fields.push({column:c,key,unit:TARGET_KEYS[key].unit,scale:1,offset:0,kind:'synthetic',source:'',date:'',resolution:''});}}
  return {match,fields,unmapped:cols.filter(c=>!used.has(c)&&!c.startsWith('_'))};
}

/** Check a mapping before applying it. Returns a list of problems (empty = fine). */
export function checkMapping(table,mapping){
  const p=[],has=c=>table.columns.includes(c);
  const m=mapping.match;
  if(m.by==='id'&&!has(m.column))p.push(`match column '${m.column}' not in the table`);
  if(m.by==='nearest'&&(!has(m.latColumn)||!has(m.lonColumn)))p.push('latitude/longitude columns not in the table');
  if(!mapping.fields?.length)p.push('no column is mapped to a site value');
  for(const f of mapping.fields??[]){
    if(!has(f.column))p.push(`column '${f.column}' not in the table`);
    if(!TARGET_KEYS[f.key])p.push(`unknown target '${f.key}'`);
    if(!KINDS[f.kind])p.push(`column '${f.column}': choose what kind of value it is`);
    if(f.kind==='nasa'&&!f.source)p.push(`column '${f.column}': NASA data needs its source (dataset or URL)`);
    if(f.uncertaintyColumn&&!has(f.uncertaintyColumn))p.push(`uncertainty column '${f.uncertaintyColumn}' not in the table`);
  }
  return p;
}

/**
 * Apply a mapping. sites: [{id, label, data: {latitude, longitude}}]. Returns
 * {edits: {siteId: {key: datum}}, matched: [{row, site, distanceKm}], unmatched: [row index], problems}.
 */
export function applyMapping(table,mapping,sites,{fileName='import'}={}){
  const problems=checkMapping(table,mapping);if(problems.length)return {edits:{},matched:[],unmatched:[],problems};
  const edits={},matched=[],unmatched=[],m=mapping.match;
  const byName=s=>[s.id,s.label?.en,s.label?.tr].filter(Boolean).map(x=>norm(x));
  table.rows.forEach((row,i)=>{
    let site=null,dist=null;
    if(m.by==='id'){const v=norm(row[m.column]??'');site=sites.find(s=>byName(s).some(n=>n===v||n.startsWith(v)&&v.length>=4))??null;}
    else{
      const lat=parseNumber(row[m.latColumn]),lon=parseNumber(row[m.lonColumn]);
      if(lat!=null&&lon!=null){let best=null;for(const s of sites){const d=marsDistanceKm(lat,lonEast(lon),s.data.latitude.value,s.data.longitude.value);if(!best||d<best.d)best={s,d};}
        if(best&&best.d<=(m.maxDistanceKm??50)){site=best.s;dist=best.d;}}
    }
    if(!site){unmatched.push(i);return;}
    matched.push({row:i,site:site.id,distanceKm:dist});
    for(const f of mapping.fields){
      const raw=parseNumber(row[f.column]);if(raw==null)continue;
      const value=raw*(f.scale??1)+(f.offset??0),rg=TARGET_KEYS[f.key].range;
      const u=f.uncertaintyColumn?parseNumber(row[f.uncertaintyColumn]):f.uncertainty!=null&&f.uncertainty!==''?parseNumber(f.uncertainty):null;
      const transforms=[`${table.format.toUpperCase()} ${fileName}, row ${i+2}, column '${f.column}'`];
      if((f.scale??1)!==1||(f.offset??0)!==0)transforms.push(`value = raw × ${f.scale??1} + ${f.offset??0}`);
      if(dist!=null)transforms.push(`matched to ${site.id} by nearest point (${dist.toFixed(1)} km)`);
      const note=value<rg[0]||value>rg[1]?`outside the expected range ${rg[0]}…${rg[1]} ${TARGET_KEYS[f.key].unit}: check the unit and scale`:null;
      (edits[site.id]??={})[f.key]=datum(value,{unit:f.unit||TARGET_KEYS[f.key].unit,kind:f.kind,source:f.source||fileName,date:f.date||null,
        resolution:f.resolution||null,crs:f.crs||(m.by==='nearest'?'planetocentric lat / east lon (deg)':null),uncertainty:u!=null&&u>=0?u*(f.scale??1):null,transforms,note});
    }
  });
  return {edits,matched,unmatched,problems:[]};
}

/**
 * A data pack: the portable result of an import or of tools/sample-rasters.mjs.
 * {format: 'osiriszk-pathfinder-data/1', created, edits: {siteId: {key: datum fields}}}
 */
export function makeDataPack(edits,meta={}){return {format:'osiriszk-pathfinder-data/1',created:new Date().toISOString(),...meta,edits};}
export function readDataPack(json){
  const j=typeof json==='string'?JSON.parse(json):json;
  if(j?.format!=='osiriszk-pathfinder-data/1')throw new RangeError('Not an OsirisZk Pathfinder data pack');
  const edits={};
  for(const [site,vals] of Object.entries(j.edits??{}))for(const [key,d] of Object.entries(vals)){
    if(!TARGET_KEYS[key])throw new RangeError(`Unknown key '${key}' in the data pack`);
    (edits[site]??={})[key]=datum(d.value,d);
  }
  return {edits,meta:{created:j.created,note:j.note??null}};
}
