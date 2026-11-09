import {CRITERIA} from './criteria.js';
import {KINDS} from './provenance.js';
import {PF_SOURCES} from './sources.js';
import {SAFETY_RULES} from './safety.js';
import {TEMP_MODEL,P_REF,SCALE_HEIGHT} from './environment.js';
import {MEDA_PUBLISHED} from '../realdata/nasa.js';
import {FEA_NOTE} from '../frames/frames.js';
import {cameraOf} from './design.js';

/**
 * Scientific report (Markdown) and data exports (CSV, JSON) of a Base Pathfinder mission.
 * Every number in the report is printed with its kind; the answer to the final question is
 * built only from the computed decision (no fixed text picks the winner).
 */
const QUESTION='Where should humanity establish its first Mars research base, and why?';

export function buildPathfinderReport({lang='en',design,budget,route,validation,sites,decision,generatedAt=new Date().toISOString()}){
  const T=(en,tr)=>lang==='tr'?tr:en,L=o=>o?.[lang]??o?.en??'';
  const f=(v,d=2)=>v==null||!Number.isFinite(v)?'—':Math.abs(v)>=1000?v.toFixed(0):v.toFixed(d);
  const kind=d=>d?L(KINDS[d.kind].short):'—';
  const cell=(d,dig=2)=>d&&d.value!=null?`${f(d.value,dig)}${d.uncertainty!=null?` ± ${f(d.uncertainty,dig)}`:''} *(${kind(d)})*`:'—';
  const byId=Object.fromEntries(sites.map(s=>[s.id,s])),name=id=>L(byId[id]?.label)||id;
  const md=[];
  md.push(`# Mars Base Pathfinder — ${T('mission report','görev raporu')}`,'',
    `*${T('Generated','Oluşturuldu')}: ${generatedAt} · OsirisZk · ${T('costs are representative game values; synthetic terrain and assumptions are labelled','maliyetler temsili oyun değerleridir; sentetik arazi ve varsayımlar etiketlidir')}*`,'');
  // ---- the answer
  md.push(`## ${T('Answer','Cevap')}: “${QUESTION}”`,'');
  const d=decision;
  if(!d.recommended){
    md.push(T(`**No recommendation.** None of the candidate sites passed the mandatory safety conditions (section 5). A base is not placed where a safe landing has not been shown.`,
      `**Öneri yok.** Aday bölgelerin hiçbiri zorunlu güvenlik koşullarını geçemedi (bölüm 5). Güvenli iniş gösterilmeyen yere üs kurulmaz.`),'');
  }else{
    const win=d.recommended,r=d.ranking;
    md.push(`**${L(win.label)}** — ${T('TOPSIS closeness','TOPSIS yakınlık katsayısı')} C = ${f(r[0].C,3)}${r[1]?`; ${T('next','sonraki')}: ${L(r[1].label)} C = ${f(r[1].C,3)}`:''}${r[2]?`, ${L(r[2].label)} C = ${f(r[2].C,3)}`:''}.`,'');
    if(d.single)md.push(T('Only this site passed the safety conditions, so no weighing was needed.','Güvenlik koşullarını yalnız bu bölge geçti; ağırlıklandırmaya gerek kalmadı.'),'');
    else{
      md.push(`**${T('Why','Neden')}** (${T('weighted, normalised advantage over','ağırlıklı, normalize üstünlük; karşısında')} ${L(r[1].label)}):`,'');
      for(const e of d.explanation.slice(0,4)){
        const c=CRITERIA[e.criterion],a=win.data[c.key],b=byId[r[1].site].data[c.key];
        md.push(`- ${L(c.label)}: ${cell(a)} ${T('vs','karşı')} ${cell(b)} ${c.unit} → ${e.advantage>=0?T('in favour','lehine'):T('against','aleyhine')} (${f(e.advantage,3)})`);
      }
      md.push('');
      md.push(`**${T('How robust','Ne kadar sağlam')}**: ${T('the winner stays first while each weight moves within','her ağırlık şu aralıkta değiştikçe kazanan birinci kalıyor')}:`,'');
      for(const s of d.sensitivity){const c=CRITERIA[s.criterion];md.push(`- ${L(c.label)} (${T('now','şimdi')} ${f(s.current,2)}): ${s.interval?`${f(s.interval[0],2)} – ${f(s.interval[1],2)}`:T('already not first','zaten birinci değil')}${s.switchesTo.length?`; ${T('outside it','dışında')}: ${s.switchesTo.map(i=>name(d.matrix.sites[i])).join(', ')}`:''}`);}
      md.push('',`${T('Seeded Monte Carlo','Tohumlu Monte Carlo')} (${d.mc.weights.n} ${T('draws','çekiliş')}): ${T('random weights','rastgele ağırlıklar')} ${(d.mc.weights.shares[d.topsis.winner]*100).toFixed(0)} %, ${T('data within their uncertainty','belirsizlik içindeki veri')} ${(d.mc.data.shares[d.topsis.winner]*100).toFixed(0)} %, ${T('both','ikisi birden')} ${(d.mc.both.shares[d.topsis.winner]*100).toFixed(0)} % ${T('of draws keep this site first','çekilişte bu bölge birinci kalıyor')}.`,'');
    }
    const kinds={};for(const c of CRITERIA){const k=win.data[c.key]?.kind;kinds[k]=(kinds[k]??0)+1;}
    md.push(`**${T('What it rests on','Neye dayanıyor')}**: ${Object.entries(kinds).map(([k,n])=>`${n} × ${L(KINDS[k]?.label)}`).join(', ')}. `+
      T('Assumptions can be edited and NASA data imported; the decision is recomputed.','Varsayımlar değiştirilebilir, NASA verisi içe aktarılabilir; karar yeniden hesaplanır.'),'');
    const flat=d.quality.filter(q=>!q.separates).map(q=>L(CRITERIA.find(c=>c.id===q.criterion).label));
    if(flat.length)md.push(`*${T('Criteria that do not separate the sites with the current data','Mevcut veriyle bölgeleri ayırt etmeyen ölçütler')}: ${flat.join(', ')}.*`,'');
    const mixed=d.quality.filter(q=>q.mixed).map(q=>L(CRITERIA.find(c=>c.id===q.criterion).label));
    if(mixed.length)md.push(`*${T('Warning — values of different kinds compared within','Uyarı — aynı ölçütte farklı türde değerler karşılaştırılıyor')}: ${mixed.join(', ')}.*`,'');
  }
  // ---- 1 budget
  md.push(`## 1. ${T('Mission budget (representative)','Görev bütçesi (temsili)')}`,'',`| ${T('Item','Kalem')} | M USD |`,'|---|---:|');
  for(const it of budget.items)if(it.cost||it.kind==='base')md.push(`| ${L(it.label)} | ${it.cost} |`);
  md.push(`| **${T('Total','Toplam')}** | **${budget.total}** |`,`| ${T('Remaining of 100','100 içinden kalan')} | ${budget.remaining} |`,'',
    `*${T('Representative game costs, not real mission estimates.','Temsili oyun maliyetleridir; gerçek görev tahmini değildir.')}*`,'');
  // ---- 2 design
  const cam=cameraOf(design);
  md.push(`## 2. ${T('Scout drone','Keşif dronu')}`,'',`- ${T('Rotor','Rotor')}: ${design.rotor} · ${T('battery','batarya')}: ${design.battery} · ${T('camera','kamera')}: ${L(cam.label)} · ${T('frame','gövde')}: ${design.frame}`,
    `- ${T('Camera','Kamera')}: ${cam.px[0]} × ${cam.px[1]} px, ${(cam.pitch*1e6).toFixed(2)} µm, f = ${(cam.focal*1000).toFixed(1)} mm, ${cam.mass} kg, ${cam.power} W, σpx ${cam.sigmaPx} (${T('pixel count of the standard camera from the Ingenuity press kit; the rest assumed','standart kameranın piksel sayısı Ingenuity basın kitinden; gerisi varsayım')})`,
    `- ${L(FEA_NOTE)}`,'',
    `| ${T('Site','Bölge')} | ${T('mass','kütle')} kg | ρ kg/m³ | T/W | ${T('hover','asılı')} W | ${T('planned energy','planlanan enerji')} Wh | ${T('available','kullanılabilir')} Wh | ${T('range','menzil')} m | ${T('checks','kontroller')} |`,'|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for(const p of validation.perSite)md.push(`| ${name(p.site)} | ${f(p.mass)} | ${f(p.density,4)} | ${f(p.thrustToWeight)} | ${f(p.hoverPower,0)} | ${f(p.energyWh,1)} | ${f(p.availableWh,1)} | ${f(p.range,0)} | ${p.checks.map(c=>c.id).join(', ')||'✓'} |`);
  md.push('');
  // ---- 3 data
  md.push(`## 3. ${T('Candidate sites and their data','Aday bölgeler ve verileri')}`,'',`| ${T('Criterion','Ölçüt')} | ${sites.map(s=>L(s.label)).join(' | ')} |`,`|---|${sites.map(()=>'---').join('|')}|`);
  for(const c of CRITERIA)md.push(`| ${L(c.label)} (${c.unit}, ${c.direction==='cost'?T('lower better','düşük iyi'):T('higher better','yüksek iyi')}) | ${sites.map(s=>cell(s.data[c.key])).join(' | ')} |`);
  for(const k of ['latitude','longitude','elevation'])md.push(`| ${k} | ${sites.map(s=>cell(s.data[k],k==='elevation'?0:3)).join(' | ')} |`);
  md.push('',`**${T('Provenance of each value','Her değerin kaynağı')}**`,'');
  for(const s of sites){md.push(`*${L(s.label)}*`,'');
    for(const k of [...CRITERIA.map(c=>c.key),'latitude','elevation']){const v=s.data[k];if(!v)continue;
      const src=v.source&&PF_SOURCES[v.source]?PF_SOURCES[v.source].title:v.source??'—';
      md.push(`- **${k}**: ${cell(v)} — ${T('source','kaynak')}: ${src}${v.resolution?`; ${T('resolution','çözünürlük')}: ${v.resolution}`:''}${v.date?`; ${T('date','tarih')}: ${v.date}`:''}${v.transforms.length?`; ${T('steps','adımlar')}: ${v.transforms.join(' → ')}`:''}${v.rationale?`; ${T('rationale','gerekçe')}: ${v.rationale}`:''}${v.note?`; ${v.note}`:''}`);}
    md.push('');}
  // ---- 4 surveys
  md.push(`## 4. ${T('Survey flights (Rapier, autonomous)','Keşif uçuşları (Rapier, otonom)')}`,'',
    `${T('Route','Güzergâh')}: ${route.area} m × ${route.area} m, ${route.altitude} m AGL, ${route.speed} m/s, ${T('overlap','bindirme')} ${Math.round(route.forwardOverlap*100)} / ${Math.round(route.sideOverlap*100)} %.`,'',
    `| ${T('Site','Bölge')} | ${T('result','sonuç')} | s | Wh | ${T('photos','foto')} | ${T('stereo cover','stereo kapsama')} | GSD mm | σZ mm | ${T('safe area','güvenli alan')} % | ${T('truth (synthetic)','gerçek (sentetik)')} % | DEM RMSE mm | ${T('hazard rocks','tehlikeli kaya')} |`,
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for(const s of sites){const v=s.survey;if(!v){md.push(`| ${L(s.label)} | ${T('not flown','uçulmadı')} |||||||||||`);continue;}const a=v.analysis;
    md.push(`| ${L(s.label)} | ${v.result.success?'✓':'✗'} ${v.result.reason} | ${f(v.result.flightTime,0)} | ${f(v.result.energyWh,1)} | ${a.photos} | ${f(a.coverage*100,0)} % | ${f(a.gsd*1000,1)} | ${f(a.sigmaZ*1000,1)} | ${a.safeFraction!=null?`${f(a.safeFraction*100,1)} ± ${f(a.safeUncertainty*100,1)}`:'—'} | ${a.truth.safeFraction!=null?f(a.truth.safeFraction*100,1):'—'} | ${f(a.truth.demRmse*1000,1)} | ${a.rocks.hazardDetected} / ${a.truth.hazardRocks} |`);}
  md.push('',`*${T('The drone measures the surface only: slopes and rocks from stereo photos. Subsurface ice, radiation and climate are never shown as drone measurements. Terrain is synthetic unless a DTM was loaded, so the "truth" column checks the method, not Mars.','Dron yalnız yüzeyi ölçer: stereo fotoğraflardan eğim ve kaya. Yer altı buzu, radyasyon ve iklim hiçbir zaman dron ölçümü olarak gösterilmez. DTM yüklenmediyse arazi sentetiktir; "gerçek" sütunu Mars\'ı değil yöntemi doğrular.')}*`,'');
  // ---- 5 safety
  md.push(`## 5. ${T('Mandatory safety conditions','Zorunlu güvenlik koşulları')}`,'',`| ${T('Rule','Kural')} | ${T('threshold','eşik')} | ${sites.map(s=>L(s.label)).join(' | ')} |`,`|---|---|${sites.map(()=>'---').join('|')}|`);
  for(const rule of SAFETY_RULES){const row=d.screening.map(x=>x.checks.find(c=>c.rule.id===rule.id));
    md.push(`| ${L(rule.label)} (${L(KINDS[rule.kind].short)}) | ${d.safety[rule.param]} ${rule.unit} | ${row.map(c=>`${c.pass?'✓':'✗'} ${f(c.value,1)}`).join(' | ')} |`);}
  md.push('',...SAFETY_RULES.map(r=>`- ${L(r.label)}: ${L(r.why)}`),'');
  // ---- 6 TOPSIS
  if(d.topsis){
    md.push(`## 6. ${T('Decision matrix and TOPSIS','Karar matrisi ve TOPSIS')}`,'',`| ${T('Criterion','Ölçüt')} | ${T('weight','ağırlık')} | ${T('direction','yön')} | ${d.matrix.sites.map(name).join(' | ')} |`,`|---|---:|---|${d.matrix.sites.map(()=>'---:').join('|')}|`);
    CRITERIA.forEach((c,j)=>md.push(`| ${L(c.label)} | ${f(d.weights[j],3)} | ${c.direction} | ${d.matrix.X.map(r=>f(r[j],3)).join(' | ')} |`));
    md.push(`| D⁺ | | | ${d.topsis.Dplus.map(x=>f(x,4)).join(' | ')} |`,`| D⁻ | | | ${d.topsis.Dminus.map(x=>f(x,4)).join(' | ')} |`,`| **C** | | | ${d.topsis.C.map(x=>`**${f(x,3)}**`).join(' | ')} |`,`| ${T('rank','sıra')} | | | ${d.topsis.rank.join(' | ')} |`,'',
      T('Steps: r = x / √Σx² · v = w r · ideal v⁺ and anti-ideal v⁻ per criterion · D± = √Σ(v − v±)² · C = D⁻/(D⁺ + D⁻).','Adımlar: r = x / √Σx² · v = w r · her ölçütte ideal v⁺ ve en kötü v⁻ · D± = √Σ(v − v±)² · C = D⁻/(D⁺ + D⁻).'),'');
  }
  // ---- 7 model checks
  const jz=sites.find(s=>s.id==='jezero');
  md.push(`## 7. ${T('Model checks','Model kontrolleri')}`,'');
  if(jz)md.push(`- ${T('Jezero pressure model','Jezero basınç modeli')} ${f(jz.data.pressure.value,0)} Pa ${T('vs MEDA sol-averaged','karşı MEDA sol ortalaması')} ${MEDA_PUBLISHED.pressureMin.value}–${MEDA_PUBLISHED.pressureMax.value} Pa (${T('published','yayın')}); ${T('the model uses the Fact Sheet mean-radius pressure and an approximate elevation','model Fact Sheet ortalama yarıçap basıncını ve yaklaşık yüksekliği kullanır')}.`,
    `- ${T('Jezero temperature model','Jezero sıcaklık modeli')} ${f(jz.data.temperature.value,1)} K ${T('vs MEDA air','karşı MEDA hava')} ${MEDA_PUBLISHED.airTemperature.minC+273.15}–${MEDA_PUBLISHED.airTemperature.maxC+273.15} K (${T('mid-range','aralık ortası')} ${f((MEDA_PUBLISHED.airTemperature.minC+MEDA_PUBLISHED.airTemperature.maxC)/2+273.15,1)} K).`);
  md.push(`- ${T('Models','Modeller')}: p = ${P_REF} Pa · exp(−h / ${SCALE_HEIGHT/1000} km); T = ((1 − ${TEMP_MODEL.albedo})·Ī / (${TEMP_MODEL.emissivity} σ))^¼; ${T('insolation from the Mars24 Sun with Beer–Lambert dust attenuation','Mars24 Güneşi ve Beer–Lambert toz sönümüyle güneşlenme')}.`,'');
  // ---- 8 limits
  md.push(`## 8. ${T('Assumptions and limitations','Varsayımlar ve sınırlar')}`,'',
    ...[T('All money values are representative game costs.','Tüm para değerleri temsili oyun maliyetleridir.'),
      T('The local terrain of each site is synthetic (assumed relief, craters and rocks) unless a DTM is loaded; the landing-safety number then tests the method, not the real site.','DTM yüklenmedikçe her bölgenin yerel arazisi sentetiktir (varsayılan rölyef, krater, kaya); iniş güvenliği sayısı o zaman gerçek bölgeyi değil yöntemi sınar.'),
      T('Ice index, dust τ, science score and the elevations are assumptions with written rationale until NASA rasters are imported (SWIM, MOLA).','Buz indeksi, toz τ, bilim puanı ve yükseklikler NASA rasterleri (SWIM, MOLA) içe aktarılana kadar gerekçeli varsayımlardır.'),
      T('Solar, temperature and pressure are first-order models (±15 %), not climate data.','Güneş, sıcaklık ve basınç birinci dereceden modellerdir (±%15), iklim verisi değildir.'),
      T('TOPSIS treats criteria as independent; solar, temperature and dust are physically linked, so their combined weight counts the Sun more than once.','TOPSIS ölçütleri bağımsız sayar; güneş, sıcaklık ve toz fiziksel olarak bağlıdır, bu yüzden toplam ağırlıkları Güneş\'i birden çok kez sayar.'),
      T('Surveying three sites with one drone design is a game simplification: a real campaign would need a landing at each site.','Üç bölgeyi tek dron tasarımıyla taramak bir oyun basitleştirmesidir: gerçek bir kampanyada her bölgeye ayrı iniş gerekir.'),
      T('No structural analysis of the frames; the mass and inertia changes are applied, strength is not claimed.','Gövdelerin yapısal analizi yapılmadı; kütle ve atalet değişiklikleri uygulanır, dayanım iddia edilmez.'),
      T('The energy plan adds a turn time per waypoint calibrated against this simulator (3.5 s + 2 s per m/s).','Enerji planı her ara noktaya bu simülatöre göre kalibre edilmiş dönüş süresi ekler (3,5 sn + her m/sn için 2 sn).')].map(x=>`- ${x}`),'');
  // ---- 9 sources
  md.push(`## 9. ${T('Sources','Kaynaklar')}`,'',...Object.values(PF_SOURCES).map(s=>`- ${s.title}${s.url?` — ${s.url}`:''}`),'');
  return md.join('\n');
}

const q=v=>{const s=v==null?'':String(v);return /[",\n;]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
/** Decision matrix with provenance, one row per site × value (CSV). */
export function dataCSV(sites){
  const rows=[['site','key','value','unit','uncertainty','kind','source','resolution','date','crs','transforms','rationale','note']];
  for(const s of sites)for(const [k,v] of Object.entries(s.data))if(v&&typeof v==='object'&&'kind' in v)
    rows.push([s.id,k,v.value,v.unit,v.uncertainty,v.kind,v.source,v.resolution,v.date,v.crs,v.transforms.join(' > '),v.rationale,v.note]);
  return rows.map(r=>r.map(q).join(',')).join('\n');
}
/** Results per site (CSV): safety, closeness, rank, survey metrics. */
export function resultsCSV(sites,decision){
  const rows=[['site','passes_safety','failed_rules','topsis_C','D_plus','D_minus','rank','survey_success','flight_time_s','energy_Wh','photos','stereo_coverage','safe_area_pct','safe_area_unc_pct']];
  for(const s of sites){
    const sc=decision.screening.find(x=>x.site.id===s.id),r=decision.ranking?.find(x=>x.site===s.id),v=s.survey,a=v?.analysis;
    rows.push([s.id,sc?.pass,sc?.checks.filter(c=>!c.pass).map(c=>c.rule.id).join(' '),r?.C,r?.Dplus,r?.Dminus,r?.rank,v?.result.success,v?.result.flightTime,v?.result.energyWh,a?.photos,a?.coverage,a?.safeFraction!=null?a.safeFraction*100:null,a?.safeUncertainty!=null?a.safeUncertainty*100:null]);
  }
  return rows.map(r=>r.map(q).join(',')).join('\n');
}
/** Everything as JSON (without the large replay tracks and grids unless asked). */
export function missionJSON({design,budget,route,validation,sites,decision},{full=false}={}){
  const strip=s=>({...s,survey:s.survey&&{...s.survey,track:full?s.survey.track:undefined,analysis:{...s.survey.analysis,grid:full?s.survey.analysis.grid:undefined}},models:undefined});
  const dec={...decision,screening:decision.screening.map(x=>({site:x.site.id,pass:x.pass,checks:x.checks.map(c=>({rule:c.rule.id,pass:c.pass,value:c.value,threshold:c.threshold}))})),
    recommended:decision.recommended?.id??null,sensitivity:decision.sensitivity?.map(s=>({criterion:CRITERIA[s.criterion].id,interval:s.interval,current:s.current,switchesTo:s.switchesTo}))};
  return JSON.stringify({question:QUESTION,design,budget,route,validation,sites:sites.map(strip),decision:dec,generator:'OsirisZk Mars Base Pathfinder'},null,1);
}
export {QUESTION};
