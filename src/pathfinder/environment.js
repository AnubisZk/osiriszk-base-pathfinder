import {sunPosition,localSolarTime} from '../mars/time.js';
import {surfaceIrradiance,SOL_SECONDS} from '../power/solar.js';
import {PlanetEnvironment} from '../planet/PlanetEnvironment.js';
import {datum} from './provenance.js';

/**
 * Site environment MODELS (computed, kind 'model'): annual solar energy, annual mean surface
 * temperature, surface pressure and the air density the drone flies in. Each returns a datum whose
 * `transforms` list the steps and whose inputs (latitude, elevation, τ) carry their own kinds.
 * These are first-order physical estimates for ranking sites against each other, not climate data;
 * the report says so and the raster adapter can replace them with NASA products.
 */
export const MARS_YEAR_SOLS=668.6;
// NASA Mars Fact Sheet: surface pressure 6.36 mb at mean radius, scale height 11.1 km
export const P_REF=636,SCALE_HEIGHT=11100;
const SIGMA=5.670374419e-8;
// assumptions of the temperature model (kept here so the report can print them)
export const TEMP_MODEL=Object.freeze({albedo:.25,emissivity:.95,flightWarming:20});

/**
 * Annual-mean daily solar energy on a horizontal surface (Wh/m² per sol) and mean irradiance
 * (W/m²) at latitude `lat` (deg) with dust optical depth τ, integrated over one Mars year with the
 * Mars24 Sun (time.js) and the Beer–Lambert beam + assumed diffuse term (solar.js).
 * Sampling: every `everySols` sols, 15-minute steps within the sol.
 */
export function annualInsolation(lat,lonEast,tau,{start=Date.UTC(2026,0,1),everySols=10,stepMinutes=15}={}){
  const solMs=SOL_SECONDS*1000,steps=Math.round(SOL_SECONDS/(stepMinutes*60)),n=Math.ceil(MARS_YEAR_SOLS/everySols);
  let sumWh=0,days=0;
  for(let d=0;d<n;d++){
    let wh=0;
    for(let k=0;k<steps;k++){const ms=start+(d*everySols+k/steps)*solMs,s=sunPosition(ms,lat,lonEast);wh+=surfaceIrradiance(s,tau).global*SOL_SECONDS/steps/3600;}
    sumWh+=wh;days++;
  }
  const whPerSol=sumWh/days;
  return {whPerSol,meanIrradiance:whPerSol*3600/SOL_SECONDS};
}

/** Surface pressure (Pa) at MOLA elevation h (m): p = p_ref · exp(−h / H), Fact Sheet constants. */
export const surfacePressure=h=>P_REF*Math.exp(-h/SCALE_HEIGHT);

/**
 * Site models from the site's latitude, longitude, elevation and τ datums.
 * Returns datums: solar (Wh/m²/sol), temperature (K, annual mean surface), pressure (Pa),
 * column (kg/m², atmosphere above the surface: shielding indicator), and the flight atmosphere.
 */
export function siteModels(site){
  const lat=site.data.latitude.value,lon=site.data.longitude.value,h=site.data.elevation.value,tau=site.data.dust.value;
  const ins=annualInsolation(lat,lon,tau);
  const {albedo,emissivity}=TEMP_MODEL,T=((1-albedo)*ins.meanIrradiance/(emissivity*SIGMA))**.25;
  const p=surfacePressure(h),g=3.73;
  const solar=datum(ins.whPerSol,{unit:'Wh/m²/sol',kind:'model',source:'mars24',uncertainty:ins.whPerSol*.15,
    transforms:[`Sun position over one Mars year (Mars24), latitude ${lat.toFixed(2)}° (${site.data.latitude.kind})`,
      `beam exp(−τ/μ) + assumed diffuse term, τ = ${tau.toFixed(2)} (${site.data.dust.kind})`,'mean over 67 sampled sols, 15-min steps'],
    note:'±15 %: diffuse-light shape and dust season not resolved'});
  const temperature=datum(T,{unit:'K',kind:'model',source:'factSheet',uncertainty:15,
    transforms:[`radiative balance T = ((1 − A)·Ī / (ε σ))^¼ with A = ${albedo}, ε = ${emissivity} (assumed)`,`Ī = ${ins.meanIrradiance.toFixed(1)} W/m² from the insolation model`],
    note:'Annual mean surface temperature; no atmosphere greenhouse, no thermal inertia (±15 K)'});
  const pressure=datum(p,{unit:'Pa',kind:'model',source:'factSheet',uncertainty:p*.15,
    transforms:[`p = ${P_REF} Pa · exp(−h / ${SCALE_HEIGHT/1000} km), h = ${h.toFixed(0)} m (${site.data.elevation.kind})`],
    note:'Annual mean; seasonal swing about ±25 % (Fact Sheet 4.0–8.7 mb)'});
  const column=datum(p/g,{unit:'kg/m²',kind:'model',source:'factSheet',uncertainty:p/g*.15,transforms:['column mass = p / g, g = 3.73 m/s²'],
    note:'Atmosphere above the site: more mass = more braking for landing and more shielding (indicator, not a dose)'});
  return {solar,temperature,pressure,column,insolation:ins};
}

/**
 * The atmosphere the survey flight sees at a site: annual-mean pressure and a late-morning air
 * temperature (annual mean + TEMP_MODEL.flightWarming, assumed). Returns PlanetEnvironment
 * overrides for the 'mars-brief' profile and the resulting density.
 */
export function flightAtmosphere(site,models=siteModels(site)){
  const T=models.temperature.value+TEMP_MODEL.flightWarming,p=models.pressure.value;
  const overrides={surfacePressure:p,surfaceTemperature:T};
  const env=new PlanetEnvironment('mars-brief',overrides);
  return {overrides,density:env.density(0),temperature:T,pressure:p};
}

/** UTC time (ms) of the first local solar time `lst` (h) at the site on/after `fromMs`. */
export function utcForLocalTime(lonEast,lst=11,fromMs=Date.UTC(2026,10,14)){
  const now=localSolarTime(fromMs,lonEast),dh=((lst-now)%24+24)%24;
  let ms=fromMs+dh/24*SOL_SECONDS*1000;
  // one Newton correction (equation of time drifts slowly)
  const err=((lst-localSolarTime(ms,lonEast)+36)%24)-12;ms+=err/24*SOL_SECONDS*1000;
  return ms;
}
