/**
 * The seven criteria of the brief, each tied to ONE metric so that every site is scored the same
 * way. direction: 'benefit' (more is better) or 'cost' (less is better).
 * drone: can the survey drone measure it? Only `safety` (landing-scale slope and rocks, from the
 * camera) is; ice below the surface, climate and radiation never come from the drone.
 */
export const CRITERIA=Object.freeze([
  {id:'water',key:'ice',direction:'benefit',unit:'index 0–1',defaultWeight:.22,drone:false,
    label:{en:'Water-ice access',tr:'Su buzu erişimi'},
    metric:{en:'Ice-access index 0–1 (SWIM ice consistency c → (c + 1) / 2 when imported)',tr:'Buz erişim indeksi 0–1 (SWIM buz tutarlılığı c içe aktarılırsa (c + 1) / 2)'}},
  {id:'safety',key:'safeArea',direction:'benefit',unit:'%',defaultWeight:.20,drone:true,
    label:{en:'Slope and landing safety',tr:'Eğim ve iniş güvenliği'},
    metric:{en:'Safe share of the surveyed area: slope ≤ limit over 2 m and no hazard rock (drone photogrammetry)',tr:'Taranan alanın güvenli payı: 2 m tabanda eğim ≤ sınır ve tehlikeli kaya yok (dron fotogrametrisi)'}},
  {id:'solar',key:'solar',direction:'benefit',unit:'Wh/m²/sol',defaultWeight:.14,drone:false,
    label:{en:'Solar energy potential',tr:'Güneş enerjisi potansiyeli'},
    metric:{en:'Annual-mean daily energy on a horizontal surface (model)',tr:'Yatay yüzeyde yıllık ortalama günlük enerji (model)'}},
  {id:'temperature',key:'temperature',direction:'benefit',unit:'K',defaultWeight:.08,drone:false,
    label:{en:'Temperature',tr:'Sıcaklık'},
    metric:{en:'Annual-mean surface temperature (model): warmer means less heating energy',tr:'Yıllık ortalama yüzey sıcaklığı (model): daha sıcak, daha az ısıtma enerjisi'}},
  {id:'dust',key:'dust',direction:'cost',unit:'τ',defaultWeight:.08,drone:false,
    label:{en:'Dust and wind risk',tr:'Toz ve rüzgâr riski'},
    metric:{en:'Annual-mean dust optical depth τ (higher = dustier, less power, more storms)',tr:'Yıllık ortalama toz optik derinliği τ (yüksek = daha tozlu, daha az güç, daha çok fırtına)'}},
  {id:'science',key:'science',direction:'benefit',unit:'1–9',defaultWeight:.18,drone:false,
    label:{en:'Scientific value',tr:'Bilimsel araştırma değeri'},
    metric:{en:'Expert score 1–9 with written rationale (assumption; the camera survey documents but does not score it)',tr:'Gerekçesi yazılı 1–9 uzman puanı (varsayım; kamera taraması belgeler ama puanlamaz)'}},
  {id:'access',key:'pressure',direction:'benefit',unit:'Pa',defaultWeight:.10,drone:false,
    label:{en:'Transport and communication',tr:'Ulaşım ve haberleşme'},
    metric:{en:'Annual-mean surface pressure from elevation (more atmosphere for entry, descent and landing); Earth link time is the same for all sites',tr:'Yükseklikten yıllık ortalama yüzey basıncı (giriş-iniş için daha çok atmosfer); Dünya bağlantı süresi tüm bölgelerde aynı'}},
]);
export const CRITERION=Object.freeze(Object.fromEntries(CRITERIA.map(c=>[c.id,c])));
export const defaultWeights=()=>Object.fromEntries(CRITERIA.map(c=>[c.id,c.defaultWeight]));

/** Weights as an array in CRITERIA order, normalised to sum 1 (negative → 0). */
export function weightVector(w){
  const v=CRITERIA.map(c=>Math.max(0,+(w[c.id]??0)||0)),s=v.reduce((a,b)=>a+b,0);
  if(!(s>0))throw new RangeError('At least one weight must be positive');
  return v.map(x=>x/s);
}
