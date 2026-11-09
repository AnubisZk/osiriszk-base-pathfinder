// Base Pathfinder data adapters: CSV / JSON / GeoJSON parsing, field mapping with provenance,
// data packs, GeoTIFF sampling in geographic and equirectangular coordinates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeArrayBuffer} from 'geotiff';
import {parseCSV,parseJSONTable,parseGeoJSON,parseTable,parseNumber} from '../src/pathfinder/adapters/tables.js';
import {suggestMapping,applyMapping,checkMapping,marsDistanceKm,makeDataPack,readDataPack} from '../src/pathfinder/adapters/mapping.js';
import {readRaster,sampleRaster,rasterToDatums,MARS_SPHERE_M} from '../src/pathfinder/adapters/raster.js';
import {prepareSite} from '../src/pathfinder/sites.js';

const near=(a,b,tol,msg='')=>assert.ok(Math.abs(a-b)<=tol,`${msg} ${a} vs ${b} ± ${tol}`);
const sites=['jezero','arcadia','mawrth'].map(id=>prepareSite(id));

test('CSV: quotes, semicolons, decimal commas, blank lines; numbers parsed safely',()=>{
  const t=parseCSV('site;ice;"note, with comma"\r\njezero;0,10;"say ""hi"""\n\narcadia;0,85;x\n');
  assert.equal(t.delimiter,';');assert.deepEqual(t.columns,['site','ice','note, with comma']);assert.equal(t.rows.length,2);
  assert.equal(t.rows[0]['note, with comma'],'say "hi"');assert.equal(parseNumber(t.rows[1].ice),.85);
  for(const v of ['','-','NA','nan',null])assert.equal(parseNumber(v),null);assert.equal(parseNumber('1e3'),1000);
  assert.throws(()=>parseCSV(''),/Empty/);
});

test('JSON and GeoJSON tables; GeoJSON longitudes become east 0–360',()=>{
  const j=parseJSONTable('{"rows":[{"site":"gale","ice":0.05}]}');assert.deepEqual(j.columns,['site','ice']);
  const g=parseGeoJSON({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[-168,42]},properties:{ice:.9}},
    {type:'Feature',geometry:{type:'Polygon',coordinates:[[[10,10],[12,10],[12,12],[10,12]]]},properties:{ice:.1}}]});
  assert.equal(g.rows[0]._lon,192);assert.equal(g.rows[0]._lat,42);near(g.rows[1]._lon,11,1e-9);
  assert.equal(parseTable('x.geojson',JSON.stringify({type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{}})).format,'geojson');
  assert.throws(()=>parseJSONTable('{"a":1}'),/array of objects/);
});

test('mapping: suggested from column names, matched by id or nearest point, provenance recorded',()=>{
  const t=parseCSV('site,ice_index,elevation_m\nJezero,0.12,-2550\nArcadia Planitia,0.9,-3400\nOlympus,0.5,21000\n');
  const m=suggestMapping(t);assert.equal(m.match.by,'id');assert.deepEqual(m.fields.map(f=>f.key),['ice','elevation']);
  m.fields.forEach(f=>{f.kind='nasa';f.source='test dataset';});
  const r=applyMapping(t,m,sites,{fileName:'t.csv'});
  assert.deepEqual(r.unmatched,[2]);assert.equal(r.edits.jezero.ice.value,.12);assert.equal(r.edits.arcadia.elevation.value,-3400);
  assert.equal(r.edits.jezero.ice.kind,'nasa');assert.match(r.edits.jezero.ice.transforms[0],/CSV t\.csv, row 2, column 'ice_index'/);
  // NASA without a source is refused; unknown columns are reported
  const bad={...m,fields:[{...m.fields[0],source:''}]};assert.match(checkMapping(t,bad).join(),/needs its source/);
  // nearest-point matching with a scale (km → m)
  const g=parseGeoJSON({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[77.5,18.4]},properties:{elev_km:-2.6}}]});
  const r2=applyMapping(g,{match:{by:'nearest',latColumn:'_lat',lonColumn:'_lon',maxDistanceKm:20},fields:[{column:'elev_km',key:'elevation',unit:'m',scale:1000,kind:'synthetic'}]},sites);
  assert.equal(r2.edits.jezero.elevation.value,-2600);assert.match(r2.edits.jezero.elevation.transforms.join(),/× 1000/);assert.match(r2.edits.jezero.elevation.transforms.join(),/nearest point/);
  near(marsDistanceKm(0,0,0,1),3389.5*Math.PI/180,1e-9);
});

test('data pack round trip keeps every provenance field',()=>{
  const t=parseCSV('site,tau\nmawrth,0.62\n'),m=suggestMapping(t);m.fields[0].kind='published';m.fields[0].source='paper';m.fields[0].date='2020';
  const {edits}=applyMapping(t,m,sites),pack=JSON.parse(JSON.stringify(makeDataPack(edits))),back=readDataPack(pack);
  assert.deepEqual(back.edits.mawrth.dust,edits.mawrth.dust);assert.throws(()=>readDataPack({format:'x'}),/Not an OsirisZk/);
});

test('GeoTIFF: geographic raster sampled at a site (nearest pixel and window mean)',async()=>{
  // 360 × 180 one-degree grid, value = latitude + longitude/1000 (pixel centres)
  const W=360,H=180,vals=new Float32Array(W*H);for(let j=0;j<H;j++)for(let i=0;i<W;i++)vals[i+j*W]=(89.5-j)+(i+.5)/1000;
  const buf=await writeArrayBuffer(vals,{width:W,height:H,ModelPixelScale:[1,1,0],ModelTiepoint:[0,0,0,0,90,0],GeographicTypeGeoKey:4326,GTModelTypeGeoKey:2});
  const r=await readRaster(buf);assert.equal(r.crs.type,'geographic');
  const s=sampleRaster(r,18.44,77.45);near(s.value,18.5+77.5/1000,1e-4);assert.equal(s.count,1);
  const w=sampleRaster(r,18.44,77.45,{radiusKm:200});assert.ok(w.count>4&&w.std>0);
  const {edits}=rasterToDatums(r,sites,{key:'elevation',unit:'m',source:'test raster',fileName:'g.tif'});
  assert.equal(edits.jezero.elevation.kind,'nasa');assert.match(edits.jezero.elevation.resolution,/km\/pixel/);assert.match(edits.jezero.elevation.crs,/degrees/);
});

test('GeoTIFF: equirectangular metres on the Mars sphere, SWIM transform (c + 1)/2',async()=>{
  const W=720,H=360,res=Math.PI/180*MARS_SPHERE_M/2,vals=new Float32Array(W*H);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const lat=90-(j+.5)/2;vals[i+j*W]=lat>35&&lat<50?.8:-.6;} // "ice consistency"
  const buf=await writeArrayBuffer(vals,{width:W,height:H,ModelPixelScale:[res,res,0],ModelTiepoint:[0,0,0,-180*Math.PI/180*MARS_SPHERE_M,90*Math.PI/180*MARS_SPHERE_M,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32767});
  const r=await readRaster(buf);assert.equal(r.crs.type,'equirectangular');
  const {edits}=rasterToDatums(r,sites,{key:'ice',unit:'index',source:'synthetic SWIM-like test grid',transform:'swimConsistency',radiusKm:30});
  near(edits.arcadia.ice.value,.9,1e-6);near(edits.jezero.ice.value,.2,1e-6);assert.match(edits.arcadia.ice.transforms.join(),/SWIM/);
});
