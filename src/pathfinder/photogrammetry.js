import {mulberry32} from './mcdm.js';

/**
 * Photogrammetric analysis of the simulated survey (what the drone's camera can measure):
 * a 1 m grid over the landing area; a cell seen by ≥ 2 photos is in stereo and gets a height.
 *
 *  Height precision (normal-case stereo):  σZ = (H / B) · GSD · σpx
 *      H flight height, B stereo base (photo spacing), GSD ground sample distance,
 *      σpx image matching precision in pixels (camera property, assumed)
 *  Slope over a 2 m baseline from the reconstructed heights (central differences).
 *  Rocks are detected when at least 3 pixels across (D ≥ 3 GSD, assumed) and seen in ≥ 1 photo.
 *  Safe cell: slope ≤ slope limit AND no hazard rock (D ≥ hazard size) within D/2 + 0.5 m.
 *
 * The SAME quantities computed from the true terrain (no noise, all rocks) are returned as
 * `truth`, so the report can show how good the measurement was (on synthetic terrain the truth is
 * known exactly — on Mars it is not, which is why the measurement and its error matter).
 * The noise is seeded: the analysis is reproducible.
 */
export const PG_DEFAULTS=Object.freeze({cell:1,slopeLimit:10,hazardRock:.5,detectPixels:3,correlationLength:5});

export function analyseSurvey({terrain,photos,plan,camera,seed=1,params={}}){
  const P={...PG_DEFAULTS,...params},half=plan.area/2,c=P.cell,n=Math.round(plan.area/c),N=n*n;
  const views=new Uint16Array(N),cx=i=>-half+(i+.5)*c;
  for(const ph of photos){
    const i0=Math.max(0,Math.floor((ph.x-ph.across/2+half)/c)),i1=Math.min(n-1,Math.floor((ph.x+ph.across/2+half)/c));
    const j0=Math.max(0,Math.floor((ph.z-ph.along/2+half)/c)),j1=Math.min(n-1,Math.floor((ph.z+ph.along/2+half)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)views[i+j*n]++;
  }
  const H=photos.length?photos.reduce((s,p)=>s+p.agl,0)/photos.length:plan.altitude;
  const GSD=H*camera.pitch/camera.focal,B=plan.photoSpacing,sigmaZ=(H/B)*GSD*camera.sigmaPx;
  const rand=mulberry32(seed*7919+13),gauss=()=>{let u=0;while(u<=1e-12)u=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rand());};
  const truthH=new Float64Array(N),measH=new Float64Array(N);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=i+j*n,h=terrain.heightAt(cx(i),cx(j));truthH[k]=h;measH[k]=views[k]>=2?h+sigmaZ*gauss():NaN;}
  // rocks: hazard footprints (truth: all rocks; measured: detected ones)
  const detectMin=P.detectPixels*GSD,rocks=terrain.rocks.filter(r=>Math.abs(r.x)<=half+2&&Math.abs(r.z)<=half+2);
  const seen=(x,z)=>{const i=Math.floor((x+half)/c),j=Math.floor((z+half)/c);return i>=0&&j>=0&&i<n&&j<n&&views[i+j*n]>=1;};
  const detected=rocks.filter(r=>r.d>=detectMin&&seen(r.x,r.z));
  const hazardMask=list=>{const m=new Uint8Array(N);for(const r of list){if(r.d<P.hazardRock)continue;const rad=r.d/2+.5;
    const i0=Math.max(0,Math.floor((r.x-rad+half)/c)),i1=Math.min(n-1,Math.floor((r.x+rad+half)/c)),j0=Math.max(0,Math.floor((r.z-rad+half)/c)),j1=Math.min(n-1,Math.floor((r.z+rad+half)/c));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(Math.hypot(cx(i)-r.x,cx(j)-r.z)<=rad)m[i+j*n]=1;}return m;};
  const hzTrue=hazardMask(rocks),hzMeas=hazardMask(detected);
  const slopeAt=(Hs,i,j)=>{if(i<1||j<1||i>n-2||j>n-2)return NaN;const a=Hs[i-1+j*n],b=Hs[i+1+j*n],d=Hs[i+(j-1)*n],e=Hs[i+(j+1)*n];
    if(!(Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(d)&&Number.isFinite(e)))return NaN;return Math.atan(Math.hypot((b-a)/(2*c),(e-d)/(2*c)))*57.29578;};
  const state=new Uint8Array(N); // 0 not measured, 1 safe, 2 too steep, 3 rock hazard
  let measured=0,safe=0,safeTrue=0,near=0,sumS=0,sumST=0,err2=0,errN=0;const slopes=[],slopesTrue=[];
  const sigmaSlope=Math.atan(Math.SQRT2*sigmaZ/(2*c))*57.29578;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=i+j*n,s=slopeAt(measH,i,j);if(!Number.isFinite(s))continue;
    const st=slopeAt(truthH,i,j);measured++;slopes.push(s);slopesTrue.push(st);sumS+=s;sumST+=st;
    err2+=(measH[k]-truthH[k])**2;errN++;
    const ok=s<=P.slopeLimit&&!hzMeas[k],okT=st<=P.slopeLimit&&!hzTrue[k];
    state[k]=ok?1:hzMeas[k]?3:2;if(ok)safe++;if(okT)safeTrue++;
    if(Math.abs(s-P.slopeLimit)<2*sigmaSlope)near++;
  }
  const pct=(a,q)=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*b.length))];};
  const p=measured?safe/measured:null,neff=measured/(P.correlationLength/c)**2;
  // sampling error (correlated cells) and threshold error (cells within 2σ of the slope limit, half of them could flip)
  const sampling=p!=null&&neff>0?Math.sqrt(p*(1-p)/Math.max(1,neff)):null,threshold=measured?.5*near/measured:null;
  const uncertainty=p!=null?Math.hypot(sampling,threshold):null;
  const areaRock=list=>list.reduce((s,r)=>s+Math.PI*r.d*r.d/4,0);
  const coveredArea=measured*c*c;
  return {
    grid:{n,cell:c,area:plan.area,views:Array.from(views),state:Array.from(state)},
    photos:photos.length,coverage:measured/N,stereoCells:measured,cells:N,
    flightHeight:H,gsd:GSD,base:B,sigmaZ,sigmaSlope,params:P,
    safeFraction:p,safeUncertainty:uncertainty,samplingError:sampling,thresholdError:threshold,
    meanSlope:measured?sumS/measured:null,p95Slope:pct(slopes,.95),
    rocks:{detected:detected.length,hazardDetected:detected.filter(r=>r.d>=P.hazardRock).length,smallestDetectable:detectMin,
      abundanceMeasured:coveredArea?areaRock(detected.filter(r=>seen(r.x,r.z)))/coveredArea:null},
    truth:{safeFraction:measured?safeTrue/measured:null,meanSlope:measured?sumST/measured:null,p95Slope:pct(slopesTrue,.95),
      hazardRocks:rocks.filter(r=>r.d>=P.hazardRock&&seen(r.x,r.z)).length,abundance:coveredArea?areaRock(rocks.filter(r=>seen(r.x,r.z)))/coveredArea:null,
      demRmse:errN?Math.sqrt(err2/errN):null},
  };
}
