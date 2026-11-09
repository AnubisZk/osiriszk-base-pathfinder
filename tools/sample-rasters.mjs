// Sample NASA rasters at the candidate sites → a Pathfinder data pack (JSON) the app imports.
// Run it where the NASA data are downloaded (the files are large and are not in the repository).
//
//   node tools/sample-rasters.mjs --raster SWIM_ice_consistency.tif --key ice --transform swimConsistency \
//        --unit index --source "SWIM (PSI/JPL) ice consistency" --date 2021 --radius 10 --out data/swim.json
//   node tools/sample-rasters.mjs --raster Mars_MGS_MOLA_DEM_mosaic_global_463m.tif --key elevation --unit m \
//        --source "MGS MOLA DEM 463 m (USGS)" --radius 5 --out data/mola.json [--sites jezero,arcadia]
//
// Keys: ice, elevation, dust, solar, temperature, pressure. Transforms: identity, swimConsistency, kmToM.
// Every value keeps the file name, pixel size, sampling radius, CRS and transform as provenance.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {readRaster,rasterToDatums} from '../src/pathfinder/adapters/raster.js';
import {makeDataPack,TARGET_KEYS} from '../src/pathfinder/adapters/mapping.js';
import {prepareSite,SITE_CATALOG} from '../src/pathfinder/sites.js';

const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const file=get('raster'),key=get('key');
if(!file||!TARGET_KEYS[key]){console.error(`Usage: node tools/sample-rasters.mjs --raster <file.tif> --key <${Object.keys(TARGET_KEYS).join('|')}> [--unit] [--source] [--date] [--radius km] [--transform] [--kind nasa] [--out pack.json]`);process.exit(1);}
const buf=readFileSync(file),r=await readRaster(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
const ids=(get('sites',SITE_CATALOG.map(s=>s.id).join(','))).split(','),sites=ids.map(id=>prepareSite(id));
const {edits,missing}=rasterToDatums(r,sites,{key,unit:get('unit',TARGET_KEYS[key].unit),kind:get('kind','nasa'),source:get('source',file),date:get('date',null),
  fileName:file.split(/[\\/]/).pop(),radiusKm:+get('radius','0'),transform:get('transform','identity')});
console.log(`raster ${r.width} × ${r.height}, CRS ${r.crs.type}; sampled ${Object.keys(edits).length} sites${missing.length?`, outside: ${missing.join(', ')}`:''}`);
for(const [id,v] of Object.entries(edits))console.log(`  ${id}: ${v[key].value.toFixed(3)} ${v[key].unit}${v[key].uncertainty!=null?` ± ${v[key].uncertainty.toFixed(3)}`:''}`);
const out=get('out',`pathfinder-${key}.json`);mkdirSync(dirname(out)||'.',{recursive:true});
writeFileSync(out,JSON.stringify(makeDataPack(edits,{note:`${key} from ${file}`}),null,1));console.log(`data pack: ${out}`);
