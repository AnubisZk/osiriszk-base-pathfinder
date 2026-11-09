import {gsd,footprint} from './design.js';

/**
 * Survey route planner: a "lawnmower" pattern over a square landing area centred on the drone's
 * landing point (home, 0,0), lines running north–south. The camera fires along the lines only.
 *
 *   swath (across track)   W = 2 H tan(FOV_across / 2)
 *   line spacing           s = W (1 − side overlap)
 *   photo spacing          b = L (1 − forward overlap), L = 2 H tan(FOV_along / 2)   (stereo base)
 *   GSD                    H · pixel pitch / focal length
 *   motion blur (px)       v · t_exposure / GSD   (t_exposure assumed 1/1000 s rolling, 1/2000 s global)
 *
 * Waypoints are the line ends ('pass'); the mission executive stops briefly at each end to turn.
 */
export const DEFAULT_ROUTE=Object.freeze({area:80,altitude:20,speed:4,sideOverlap:.6,forwardOverlap:.75});
export const ROUTE_LIMITS=Object.freeze({area:[30,200],altitude:[8,60],speed:[1,8],sideOverlap:[.3,.85],forwardOverlap:[.6,.9]});

export function planSurvey(camera,route=DEFAULT_ROUTE){
  const r={...DEFAULT_ROUTE,...route};
  for(const [k,[lo,hi]] of Object.entries(ROUTE_LIMITS))if(!(r[k]>=lo&&r[k]<=hi))throw new RangeError(`${k} must be in [${lo}, ${hi}], got ${r[k]}`);
  const fp=footprint(camera,r.altitude),spacing=fp.across*(1-r.sideOverlap),photoSpacing=fp.along*(1-r.forwardOverlap);
  const half=r.area/2,lines=Math.max(2,Math.ceil(r.area/spacing)+1),step=r.area/(lines-1);
  const waypoints=[];
  for(let k=0;k<lines;k++){
    const x=-half+k*step,[z0,z1]=k%2?[half,-half]:[-half,half];
    waypoints.push({x,z:z0,action:'pass',name:`L${k+1}a`},{x,z:z1,action:'pass',name:`L${k+1}b`});
  }
  const pts=[[0,0],...waypoints.map(w=>[w.x,w.z]),[0,0]];
  let distance=0;for(let i=1;i<pts.length;i++)distance+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  const g=gsd(camera,r.altitude),exposure=camera.shutter==='global'?1/2000:1/1000,blurPx=r.speed*exposure/g;
  const lineLength=lines*r.area,expectedPhotos=lines*(Math.floor(r.area/photoSpacing)+1);
  const warnings=[];
  if(blurPx>1)warnings.push({id:'blur',value:blurPx,
    en:`Motion blur ${blurPx.toFixed(1)} px at ${r.speed} m/s: slow down or use the global-shutter mapping camera`,
    tr:`${r.speed} m/sn hızda ${blurPx.toFixed(1)} piksel hareket bulanıklığı: yavaşlayın ya da global deklanşörlü haritalama kamerasını seçin`});
  if(step<spacing*.5)warnings.push({id:'dense',value:step,en:'Lines closer than half the planned spacing (area too small for this swath)',tr:'Çizgiler planlanan aralığın yarısından yakın (bu şerit için alan çok küçük)'});
  return {...r,swath:fp.across,footprintAlong:fp.along,spacing:step,plannedSpacing:spacing,photoSpacing,lines,waypoints,distance,lineLength,
    gsd:g,exposure,blurPx,expectedPhotos,baseHeightRatio:photoSpacing/r.altitude,warnings};
}

/** Is the drone flying along a survey line? (target index odd: from a line's first end to its second) */
export const onSurveyLine=(wpIndex,lines)=>wpIndex%2===1&&wpIndex<2*lines;
