// Headless Base Pathfinder mission: design → validation → three survey flights (Rapier) →
// safety screening → TOPSIS → sensitivity → report. Same code as the app.
//
//   node tools/pathfinder-run.mjs [--sites jezero,arcadia,mawrth] [--lang tr] [--out reports/pathfinder]
//
// Writes report.<lang>.md, data.csv, results.csv and mission.json.
import {mkdirSync,writeFileSync} from 'node:fs';
import {initializeRapier} from '../src/physics/FlightPhysics.js';
import {prepareSite,DEFAULT_SITES,DEFAULT_DESIGN,DEFAULT_ROUTE,validateMission,runSurvey,attachSurvey,decide,budget,
  buildPathfinderReport,dataCSV,resultsCSV,missionJSON,defaultWeights} from '../src/pathfinder/index.js';

const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
export async function runMission({siteIds=DEFAULT_SITES,design=DEFAULT_DESIGN,route=DEFAULT_ROUTE,weights=defaultWeights(),log=()=>{}}={}){
  await initializeRapier();
  let sites=siteIds.map(id=>prepareSite(id));
  const validation=validateMission(design,sites,route);
  log(`validation ${validation.ok?'ok':'FAILED'}: ${validation.perSite.map(p=>`${p.site} T/W ${p.thrustToWeight.toFixed(2)} E ${p.energyWh.toFixed(0)}/${p.availableWh.toFixed(0)} Wh`).join(' · ')}`);
  sites=sites.map(s=>{const t=Date.now(),sv=runSurvey(design,s,route);log(`survey ${s.id}: ${sv.result.reason}, ${sv.photos.length} photos, safe ${(sv.analysis.safeFraction*100).toFixed(1)} % (${((Date.now()-t)/1000).toFixed(1)} s)`);return attachSurvey(s,sv);});
  const decision=decide(sites,{weights});
  log(`recommended: ${decision.recommended?.id??'none'}`);
  return {design,budget:budget(design),route,validation,sites,decision};
}
if(import.meta.url===`file://${process.argv[1]}`){
  const out=get('out','reports/pathfinder'),lang=get('lang','en'),ids=(get('sites',DEFAULT_SITES.join(','))).split(',');
  const m=await runMission({siteIds:ids,log:s=>console.log(s)});
  mkdirSync(out,{recursive:true});
  for(const l of lang==='both'?['en','tr']:[lang])writeFileSync(`${out}/report.${l}.md`,buildPathfinderReport({...m,lang:l}));
  writeFileSync(`${out}/data.csv`,dataCSV(m.sites));writeFileSync(`${out}/results.csv`,resultsCSV(m.sites,m.decision));writeFileSync(`${out}/mission.json`,missionJSON(m));
  console.log(`written to ${out}/`);
}
