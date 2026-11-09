// Survey flights off the render thread: headless Rapier, deterministic, faster than real time.
import {initializeRapier} from '../../src/physics/FlightPhysics.js';
import {prepareSite,runSurvey} from '../../src/pathfinder/index.js';
import {datum} from '../../src/pathfinder/provenance.js';
const ready=initializeRapier();
self.onmessage=async e=>{
  await ready;
  const {design,route,sites}=e.data;
  for(const {id,edits,key} of sites){
    try{
      // datums lose their prototype-free freeze in postMessage; rebuild them (same fields)
      const ed=Object.fromEntries(Object.entries(edits??{}).map(([k,d])=>[k,datum(d.value,d)]));
      const site=prepareSite(id,ed);
      const survey=runSurvey(design,site,route,{onProgress:p=>self.postMessage({type:'progress',site:id,p})});
      self.postMessage({type:'site',site:id,key,survey});
    }catch(err){self.postMessage({type:'error',site:id,message:String(err?.message??err)});}
  }
  self.postMessage({type:'done'});
};
