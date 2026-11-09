import {fromArrayBuffer} from 'geotiff';
import {datum} from '../provenance.js';
import {lonEast} from './tables.js';

/**
 * Raster adapter (GeoTIFF): read a global or regional Mars raster and sample it at the sites.
 * Supported georeferencing (the two forms NASA/USGS Mars products use):
 *   geographic   — pixel coordinates in degrees (planetocentric latitude, longitude)
 *   equirectangular — metres on a sphere: x = R (λ − λ0) cos φ_ts, y = R φ (λ, φ in radians)
 *     R defaults to 3 396 190 m (MOLA / USGS Mars sphere); λ0 and φ_ts from the GeoKeys when present.
 * The CRS found (or set by the user) is recorded in every sampled datum. Sampling takes the mean
 * and standard deviation of the valid pixels whose centres lie within `radiusKm` of the site (a
 * single nearest pixel when the radius is smaller than a pixel).
 */
export const MARS_SPHERE_M=3396190;

export async function readRaster(buffer,{band=0}={}){
  const tiff=await fromArrayBuffer(buffer),img=await tiff.getImage(),W=img.getWidth(),H=img.getHeight();
  const [ox,oy]=img.getOrigin(),[sx,sy]=img.getResolution(),keys=img.getGeoKeys?.()??{};
  const nodata=img.getGDALNoData?.()??null,rasters=await img.readRasters({interleave:false,samples:[band]});
  const geographic=keys.GTModelTypeGeoKey===2||(keys.GTModelTypeGeoKey==null&&Math.abs(sx)<1&&Math.abs(ox)<=360&&Math.abs(oy)<=90);
  const crs=geographic?{type:'geographic'}:{type:'equirectangular',R:keys.GeogSemiMajorAxisGeoKey??MARS_SPHERE_M,
    lon0:keys.ProjCenterLongGeoKey??keys.ProjNatOriginLongGeoKey??0,latTs:keys.ProjStdParallel1GeoKey??0};
  return {width:W,height:H,origin:[ox,oy],resolution:[sx,sy],nodata,data:rasters[0],crs,keys};
}

/** (lat, lonEast) → fractional pixel (column, row) for the raster's CRS. */
export function toPixel(r,lat,lon){
  let x,y;
  if(r.crs.type==='geographic'){
    // the raster's longitude convention (−180…180 or 0…360) follows its origin
    let L=lonEast(lon);if(r.origin[0]<0&&L>180)L-=360;x=L;y=lat;
  }else{
    const D=Math.PI/180;let dl=lonEast(lon)-lonEast(r.crs.lon0);if(dl>180)dl-=360;if(dl<-180)dl+=360;
    x=r.crs.R*dl*D*Math.cos(r.crs.latTs*D);y=r.crs.R*lat*D;
  }
  return [(x-r.origin[0])/r.resolution[0],(y-r.origin[1])/r.resolution[1]];
}

/** Pixel size in km at a latitude (east–west, north–south). */
export function pixelSizeKm(r,lat){
  if(r.crs.type==='geographic'){const k=MARS_SPHERE_M/1000*Math.PI/180;return [Math.abs(r.resolution[0])*k*Math.cos(lat*Math.PI/180),Math.abs(r.resolution[1])*k];}
  // x = R λ cos φts: one pixel spans Δλ = res / (R cos φts), i.e. res · cos φ / cos φts on the ground at latitude φ
  const D=Math.PI/180;return [Math.abs(r.resolution[0])/1000*Math.cos(lat*D)/Math.cos(r.crs.latTs*D),Math.abs(r.resolution[1])/1000];
}

/** Sample at a site: {value, std, count, pixelKm, inside}. */
export function sampleRaster(r,lat,lon,{radiusKm=0}={}){
  const [px,py]=toPixel(r,lat,lon),[kx,ky]=pixelSizeKm(r,lat),valid=v=>Number.isFinite(v)&&v>-1e30&&(r.nodata==null||v!==r.nodata);
  const inside=px>=0&&py>=0&&px<r.width&&py<r.height;
  if(!inside)return {value:null,std:null,count:0,pixelKm:[kx,ky],inside:false};
  const ri=Math.ceil(radiusKm/Math.max(1e-6,kx)),rj=Math.ceil(radiusKm/Math.max(1e-6,ky)),ci=Math.floor(px),cj=Math.floor(py);
  if(radiusKm<=0||(ri<=0&&rj<=0)){const v=r.data[ci+cj*r.width];return {value:valid(v)?v:null,std:null,count:valid(v)?1:0,pixelKm:[kx,ky],inside:true};}
  let n=0,s=0,s2=0;
  for(let j=Math.max(0,cj-rj);j<=Math.min(r.height-1,cj+rj);j++)for(let i=Math.max(0,ci-ri);i<=Math.min(r.width-1,ci+ri);i++){
    const dx=(i+.5-px)*kx,dy=(j+.5-py)*ky;if(dx*dx+dy*dy>radiusKm*radiusKm)continue;
    const v=r.data[i+j*r.width];if(!valid(v))continue;n++;s+=v;s2+=v*v;
  }
  if(!n){const v=r.data[ci+cj*r.width];return {value:valid(v)?v:null,std:null,count:valid(v)?1:0,pixelKm:[kx,ky],inside:true};}
  const mean=s/n;return {value:mean,std:n>1?Math.sqrt(Math.max(0,s2/n-mean*mean)):null,count:n,pixelKm:[kx,ky],inside:true};
}

/** Known transforms from a raster's native values to a site key. */
export const RASTER_TRANSFORMS=Object.freeze({
  identity:{label:'value as is',f:v=>v,df:1},
  swimConsistency:{label:'SWIM ice consistency c (−1…+1) → ice index (c + 1) / 2',f:v=>(v+1)/2,df:.5},
  kmToM:{label:'km → m',f:v=>v*1000,df:1000},
});

/**
 * Sample a raster at every site and return datums (kind given by the user, 'nasa' for a NASA
 * product). meta: {key, unit, kind, source, date, fileName, radiusKm, transform}
 */
export function rasterToDatums(r,sites,{key,unit,kind='nasa',source,date=null,fileName='raster.tif',radiusKm=0,transform='identity'}){
  const t=RASTER_TRANSFORMS[transform]??RASTER_TRANSFORMS.identity,out={},missing=[];
  for(const s of sites){
    const lat=s.data.latitude.value,lon=s.data.longitude.value,smp=sampleRaster(r,lat,lon,{radiusKm});
    if(smp.value==null){missing.push(s.id);continue;}
    const res=`${smp.pixelKm[0].toFixed(2)} × ${smp.pixelKm[1].toFixed(2)} km/pixel`;
    out[s.id]={[key]:datum(t.f(smp.value),{unit,kind,source:source||fileName,date,resolution:res,
      crs:r.crs.type==='geographic'?'planetocentric degrees':`equirectangular, R ${r.crs.R} m, λ0 ${r.crs.lon0}°, φts ${r.crs.latTs}°`,
      uncertainty:smp.std!=null?Math.abs(t.df)*smp.std:null,
      transforms:[`GeoTIFF ${fileName}: ${radiusKm>0?`mean of ${smp.count} pixels within ${radiusKm} km`:'nearest pixel'} at ${lat.toFixed(3)}°, ${lon.toFixed(3)}° E`,
        ...(t===RASTER_TRANSFORMS.identity?[]:[t.label])],
      note:smp.std!=null?'Uncertainty = spatial standard deviation within the radius':'Single pixel: uncertainty unknown'})};
  }
  return {edits:out,missing};
}
