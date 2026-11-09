import {datum,consistency} from './provenance.js';
import {CRITERIA,weightVector} from './criteria.js';
import {screen,defaultSafetyParams} from './safety.js';
import {topsis,sensitivity,monteCarlo,explain} from './mcdm.js';

/**
 * Put the survey's measurement into the site's data as a datum (kind 'simulation').
 * A failed survey leaves the value empty: the site then fails the "surveyed" safety rule.
 */
export function attachSurvey(site,survey){
  const a=survey.analysis,ok=survey.result.success&&a.safeFraction!=null;
  const safeArea=ok?datum(a.safeFraction*100,{unit:'%',kind:'simulation',source:'drone survey',uncertainty:a.safeUncertainty*100,measuredByDrone:true,
      resolution:`${a.grid.cell} m grid · GSD ${(a.gsd*1000).toFixed(1)} mm/px · ${a.photos} photos`,
      transforms:[`stereo heights from photo pairs, σZ = (H/B)·GSD·σpx = ${(a.sigmaZ*1000).toFixed(1)} mm`,
        `slope over 2 m ≤ ${a.params.slopeLimit}° and no rock ≥ ${a.params.hazardRock} m (rocks seen when ≥ ${a.params.detectPixels} px)`,
        `uncertainty: sampling ${(a.samplingError*100).toFixed(1)} % ⊕ threshold ${(a.thresholdError*100).toFixed(1)} %`],
      note:survey.procedural?'Measured over the SYNTHETIC terrain of this site (assumed relief and rocks); load a DTM for real slopes':'Measured over a real terrain model'})
    :datum(null,{unit:'%',kind:'simulation',source:'drone survey',measuredByDrone:true,note:`Survey did not complete: ${survey.result.reason}`});
  return {...site,survey,data:{...site.data,safeArea}};
}

/**
 * The decision: safety screening, decision matrix of the passing sites, TOPSIS, sensitivity and
 * Monte Carlo robustness, and the explanation of the result.
 * opts: {weights {criterionId: w}, safety (params), mcDraws, seed}
 */
export function decide(sites,{weights,safety=defaultSafetyParams(),mcDraws=2000,seed=2026}={}){
  const w=weightVector(weights??Object.fromEntries(CRITERIA.map(c=>[c.id,c.defaultWeight])));
  const screening=screen(sites,safety),passing=screening.filter(s=>s.pass).map(s=>s.site);
  const dirs=CRITERIA.map(c=>c.direction);
  const cell=(s,c)=>s.data[c.key];
  const quality=CRITERIA.map(c=>({criterion:c.id,...consistency(sites.map(s=>cell(s,c))),
    kinds:[...new Set(sites.map(s=>cell(s,c)?.kind).filter(Boolean))],
    separates:new Set(sites.map(s=>cell(s,c)?.value)).size>1}));
  const out={weights:w,dirs,screening,passing:passing.map(s=>s.id),quality,safety};
  if(!passing.length)return {...out,recommended:null,reason:'no site passes the mandatory safety conditions'};
  const X=passing.map(s=>CRITERIA.map(c=>cell(s,c).value)),U=passing.map(s=>CRITERIA.map(c=>cell(s,c).uncertainty??0));
  const res=topsis(X,w,dirs);
  const result={...out,matrix:{sites:passing.map(s=>s.id),X,U},topsis:res,
    ranking:res.order.map(i=>({site:passing[i].id,label:passing[i].label,C:res.C[i],Dplus:res.Dplus[i],Dminus:res.Dminus[i],rank:res.rank[i]}))};
  const recommended=passing[res.winner];
  if(passing.length===1)return {...result,recommended,single:true,explanation:[],sensitivity:null,mc:null};
  const nonNegative=CRITERIA.map(()=>true);
  return {...result,recommended,
    explanation:explain(res,dirs).map(e=>({...e,id:CRITERIA[e.criterion].id})),
    sensitivity:sensitivity(X,w,dirs),
    mc:{weights:monteCarlo(X,w,dirs,{mode:'weights',n:mcDraws,seed}),data:monteCarlo(X,w,dirs,{U,mode:'data',n:mcDraws,seed:seed+1,nonNegative}),
      both:monteCarlo(X,w,dirs,{U,mode:'both',n:mcDraws,seed:seed+2,nonNegative})}};
}

/** Kinds behind the recommendation: how much of it rests on assumptions. */
export function evidenceSummary(sites){
  const count={};for(const s of sites)for(const c of CRITERIA){const k=s.data[c.key]?.kind??'missing';count[k]=(count[k]??0)+1;}
  return count;
}
