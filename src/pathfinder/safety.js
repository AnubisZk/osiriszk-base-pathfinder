/**
 * Mandatory safety conditions, checked BEFORE any weighing. A site that fails one is not ranked
 * (no weight can buy back an unsafe landing). Each rule says where its threshold comes from;
 * thresholds marked 'assumption' are team choices the player can change.
 */
export const SAFETY_RULES=Object.freeze([
  {id:'latitude',label:{en:'Latitude within ±50°',tr:'Enlem ±50° içinde'},kind:'published',source:'ez2015',param:'maxLatitude',default:50,unit:'°',
    why:{en:'NASA 2015 Exploration Zone guideline for the first human missions',tr:'NASA 2015 Keşif Bölgesi kılavuzu (ilk insanlı görevler)'},
    test:(s,p)=>Math.abs(s.data.latitude.value)<=p.maxLatitude,
    value:s=>Math.abs(s.data.latitude.value)},
  {id:'elevation',label:{en:'Low enough for entry, descent and landing',tr:'Giriş-iniş için yeterince alçak'},kind:'assumption',param:'maxElevation',default:-1000,unit:'m',
    why:{en:'Team assumption: heavy landers need the thicker air of the lowlands (MOLA elevation ≤ −1 km)',tr:'Takım varsayımı: ağır iniş araçları alçak bölgelerin kalın havasına ihtiyaç duyar (MOLA ≤ −1 km)'},
    test:(s,p)=>s.data.elevation.value<=p.maxElevation,value:s=>s.data.elevation.value},
  {id:'surveyed',label:{en:'Landing area surveyed by the drone',tr:'İniş alanı dronla tarandı'},kind:'assumption',param:'minCoverage',default:60,unit:'%',
    why:{en:'No site is certified without a landing-scale survey; at least this share of the area seen in stereo',tr:'İniş ölçeğinde tarama olmadan bölge onaylanmaz; alanın en az bu kadarı stereo görülmeli'},
    test:(s,p)=>!!s.survey&&s.survey.result.success&&s.survey.analysis.coverage*100>=p.minCoverage,
    value:s=>s.survey?s.survey.analysis.coverage*100:NaN},
  {id:'safeArea',label:{en:'Enough safe landing ground',tr:'Yeterli güvenli iniş alanı'},kind:'assumption',param:'minSafeArea',default:50,unit:'%',
    why:{en:'Team assumption: at least half of the surveyed ground must be safe (slope and rocks)',tr:'Takım varsayımı: taranan zeminin en az yarısı güvenli olmalı (eğim ve kaya)'},
    test:(s,p)=>s.data.safeArea?.value!=null&&s.data.safeArea.value>=p.minSafeArea,value:s=>s.data.safeArea?.value??NaN},
]);
export const defaultSafetyParams=()=>Object.fromEntries(SAFETY_RULES.map(r=>[r.param,r.default]));

/** Screen sites: [{site, pass, checks:[{rule, pass, value}]}]. */
export function screen(sites,params=defaultSafetyParams()){
  return sites.map(site=>{
    const checks=SAFETY_RULES.map(rule=>({rule,pass:!!rule.test(site,params),value:rule.value(site),threshold:params[rule.param]}));
    return {site,pass:checks.every(c=>c.pass),checks};
  });
}
