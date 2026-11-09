/**
 * Table adapters: CSV, JSON and GeoJSON → rows (plain objects of strings/numbers).
 * They only parse; turning a column into a site value with its provenance is done by mapping.js,
 * where the user says what each column is (or accepts the suggested mapping).
 */

/** Parse a number written with a dot or a decimal comma ("0,85"); '' / '-' / 'NA' → null. */
export function parseNumber(v){
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(v==null)return null;
  let s=String(v).trim();if(!s||/^(-|na|n\/a|nan|null|none)$/i.test(s))return null;
  if(/^-?\d+,\d+$/.test(s))s=s.replace(',','.');
  const x=Number(s);return Number.isFinite(x)?x:null;
}

/** CSV (RFC 4180 quoting) with delimiter auto-detected among , ; tab. Returns {columns, rows, delimiter}. */
export function parseCSV(text){
  text=String(text).replace(/^﻿/,'');
  const first=text.split(/\r?\n/).find(l=>l.trim())??'';
  const count=d=>{let n=0,q=false;for(const ch of first){if(ch==='"')q=!q;else if(ch===d&&!q)n++;}return n;};
  const delimiter=[',',';','\t'].sort((a,b)=>count(b)-count(a))[0];
  const records=[];let field='',row=[],q=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else q=false;}else field+=ch;continue;}
    if(ch==='"'){q=true;continue;}
    if(ch===delimiter){row.push(field);field='';continue;}
    if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(c=>c.trim()!==''))records.push(row);row=[];continue;}
    field+=ch;
  }
  if(field!==''||row.length){row.push(field);if(row.some(c=>c.trim()!==''))records.push(row);}
  if(!records.length)throw new RangeError('Empty CSV');
  const columns=records[0].map((c,i)=>c.trim()||`column${i+1}`);
  const rows=records.slice(1).map(r=>Object.fromEntries(columns.map((c,i)=>[c,(r[i]??'').trim()])));
  return {columns,rows,delimiter,format:'csv'};
}

/** JSON: an array of objects, or {rows|sites|data|features: [...]}. */
export function parseJSONTable(text){
  const j=typeof text==='string'?JSON.parse(text):text;
  if(j?.type==='FeatureCollection'||j?.type==='Feature')return parseGeoJSON(j);
  const arr=Array.isArray(j)?j:j?.rows??j?.sites??j?.data;
  if(!Array.isArray(arr)||!arr.every(r=>r&&typeof r==='object'))throw new RangeError('JSON must be an array of objects or {rows: [...]}');
  const columns=[...new Set(arr.flatMap(r=>Object.keys(r)))];
  return {columns,rows:arr.map(r=>({...r})),format:'json'};
}

/** Longitude to east 0–360. */
export const lonEast=lon=>((lon%360)+360)%360;

/**
 * GeoJSON (Point features; other geometries use the mean of their vertices). RFC 7946 coordinates
 * are [longitude, latitude] in degrees; for Mars data we read them as planetocentric degrees and
 * convert longitudes to east 0–360 (recorded in the row as _crs).
 */
export function parseGeoJSON(text){
  const j=typeof text==='string'?JSON.parse(text):text;
  const feats=j?.type==='FeatureCollection'?j.features:j?.type==='Feature'?[j]:null;
  if(!Array.isArray(feats))throw new RangeError('Not a GeoJSON Feature or FeatureCollection');
  const flat=c=>Array.isArray(c[0])?c.flatMap(flat):[c];
  const rows=feats.map((f,i)=>{
    const g=f.geometry;if(!g?.coordinates)throw new RangeError(`Feature ${i} has no geometry`);
    const pts=g.type==='Point'?[g.coordinates]:flat(g.coordinates);
    const lon=pts.reduce((s,p)=>s+p[0],0)/pts.length,lat=pts.reduce((s,p)=>s+p[1],0)/pts.length;
    return {...(f.properties??{}),_lat:lat,_lon:lonEast(lon),_geometry:g.type,_crs:j.crs?.properties?.name??'planetocentric degrees (assumed for Mars)'};
  });
  const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  return {columns,rows,format:'geojson'};
}

/** Pick the parser from the file name / content. */
export function parseTable(name,text){
  const n=String(name).toLowerCase();
  if(n.endsWith('.geojson'))return parseGeoJSON(text);
  if(n.endsWith('.json'))return parseJSONTable(text);
  if(n.endsWith('.csv')||n.endsWith('.tsv')||n.endsWith('.txt'))return parseCSV(text);
  const t=String(text).trim();return t.startsWith('{')||t.startsWith('[')?parseJSONTable(t):parseCSV(t);
}
