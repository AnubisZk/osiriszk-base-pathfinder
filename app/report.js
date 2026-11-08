import {SOURCES} from '../src/planet/profiles.js';
import {ROTOR_SOURCES} from '../src/aero/rotors.js';
import {VEHICLE_SOURCES} from '../src/vehicles/presets.js';
import {TERRAIN_SOURCES} from '../src/terrain/terrain.js';
import {ASSUMPTIONS} from '../src/planet/PlanetFlightPhysics.js';
import {FEA_NOTE,FRAME_LABELS} from '../src/frames/frames.js';
import {getLang,L} from './i18n.js';

/** Scientific report (Markdown) from the current environment, design, mission and experiment. */
const f=(v,d=2)=>Number.isFinite(v)?(+v).toFixed(d):'—';
export function buildReport({sim,experiment=null,dust,solar=null,world='mars',site=null}){
  const lang=getLang(),tr=lang==='tr',env=sim.environment,b=sim.built,r=sim.mission.result,bud=sim.budget,T=sim.telemetry,mars=world==='mars';
  const H=(en,t)=>tr?t:en,lines=[];
  lines.push(`# ${mars?H('OsirisZk Mars Aerial Explorer — mission report','OsirisZk Mars Hava Kaşifi — görev raporu'):H('OsirisZk Earth Flight Lab — mission report','OsirisZk Dünya Uçuş Laboratuvarı — görev raporu')}`,'',
    `${H('Generated','Oluşturuldu')}: ${new Date().toISOString()} · ${H('simulation date','simülasyon tarihi')}: ${new Date(sim.spec.date).toISOString()}`,'');
  lines.push(`## 1. ${H('Environment','Ortam')}`,'',`${H('Profile','Profil')}: **${L(env.label)}**`,'',
    `| ${H('Parameter','Parametre')} | ${H('Value','Değer')} | ${H('Unit','Birim')} | ${H('Status','Durum')} | ${H('Source','Kaynak')} |`,'|---|---|---|---|---|');
  for(const p of env.parameters(lang))lines.push(`| ${p.key} | ${typeof p.value==='number'?+p.value.toPrecision(5):p.value} | ${p.unit} | ${p.statusLabel} | ${p.source?.title??''} |`);
  if(mars)lines.push('',`${H('Sun','Güneş')}: ${f(sim.sun.elevation,1)}° ${H('elevation','yükseklik')}, ${H('local solar time','yerel güneş saati')} ${f(sim.sun.localSolarTime,2)} h, Ls ${f(sim.sun.Ls,1)}°. ${H('Dust optical depth','Toz optik derinliği')} τ = ${f(dust,2)} (${H('assumed','varsayımsal')}).`,
    `${H('Earth–Mars one-way light time','Dünya–Mars tek yön ışık süresi')}: **${f(sim.link.oneWayLightTime/60,1)} min** (${f(sim.link.distanceAU,3)} AU).`,'');
  else lines.push('',`${H('Site','Bölge')}: ${site??''}, ${H('site elevation','rakım')} ${f(sim.spec.siteElevation,0)} m (ISA). ${H('Sun (NOAA equations)','Güneş (NOAA denklemleri)')}: ${f(sim.sun.elevation,1)}° ${H('elevation','yükseklik')}, ${f(sim.sun.azimuth,0)}° ${H('azimuth','azimut')}, ${H('local solar time','yerel güneş saati')} ${f(sim.sun.localSolarTime,2)} h. ${H('Pilot link: on site, no delay.','Pilot bağlantısı: sahada, gecikmesiz.')}`,'');
  lines.push(
    `${H('Terrain','Arazi')}: ${L(sim.terrain?.meta?.label)??'flat'}.`,'');
  lines.push(`## 2. ${H('Vehicle design','Araç tasarımı')}`,'',`**${L(b.spec.label)}**, ${H('frame','gövde')}: ${L(FRAME_LABELS[b.frame])}, ${H('payload','yük')} ${f(b.payload,2)} kg`,'',
    `- ${H('Mass','Kütle')}: ${f(b.mass,3)} kg (${H('calibration mass','kalibrasyon kütlesi')} ${f(b.miscMass,3)} kg)`,
    `- ${H('Principal inertia','Asal atalet')}: ${b.principal.moments.map(m=>m.toExponential(3)).join(', ')} kg·m²`,
    `- ${H('Mass breakdown','Kütle dağılımı')}: ${Object.entries(b.groups).map(([k,v])=>`${k} ${f(v,3)}`).join(', ')} kg`,
    `- ${H('Can hover here','Burada askıda kalabilir')}: **${sim.control.canHover?H('yes','evet'):H('no','hayır')}**${sim.control.rpmSetpoint?`, ${H('rotor speed','rotor devri')} ${f(sim.control.rpmSetpoint,0)} rpm`:''}`,
    `- ${L(FEA_NOTE)}`,'');
  lines.push(`## 3. ${H('Mission','Görev')}`,'',`${H('Control','Kontrol')}: ${sim.spec.control}; ${H('waypoints','ara noktalar')}: ${sim.spec.waypoints.length}; ${H('cruise','seyir')} ${sim.spec.cruiseAltitude} m, ${sim.spec.speed} m/s`,'',
    `| | ${H('Pre-flight estimate','Uçuş öncesi tahmin')} | ${H('Simulated','Simüle edilen')} |`,'|---|---|---|',
    `| ${H('Flight time','Uçuş süresi')} (s) | ${f(bud.flightTime,1)} | ${f(r?.flightTime,1)} |`,
    `| ${H('Energy','Enerji')} (Wh) | ${f(bud.energyWh,2)} | ${f(r?.energyWh,2)} |`,
    `| ${H('Route','Güzergâh')} (m) | ${f(bud.routeLength,0)} | ${f(r?.distance,0)} |`,'',
    r?`${H('Result','Sonuç')}: **${r.success?H('success','başarılı'):H('failed','başarısız')}** — ${r.reason}. ${H('Observations','Gözlemler')} ${r.observations}/${r.requiredObservations}, ${H('max tilt','en büyük eğim')} ${f(r.maxTilt,1)}°, ${H('hover position error RMS','askıda konum hatası RMS')} ${f(r.positionErrorRms,2)} m, ${H('battery left','kalan batarya')} ${f(100*r.socEnd,1)} %.`:H('Mission not flown yet.','Görev henüz uçulmadı.'),'');
  if(solar)lines.push(`${H('Energy over','Sol sol enerji')} ${solar.days.length} sol (τ ${f(solar.tau,2)}, ${H('panel','panel')} ${f(solar.panelArea,3)} m²): ${H('harvest','toplanan')} ${f(solar.meanHarvestWh,1)} Wh/sol, ${H('night heating + sleep','gece ısıtma + uyku')} ${f(solar.meanNightWh,1)} Wh/sol, ${H('flights','uçuş')} ${solar.flights}/${solar.days.length}, ${H('minimum battery','en düşük batarya')} ${f(100*solar.minSoC,0)} % (${H('panel efficiency, diffuse light, thermal conductance assumed','panel verimi, dağınık ışık, ısıl iletkenlik varsayımsal')}).`,'');
  if(T.length){const p=T.stats('power'),a=T.stats('agl');lines.push(`${H('Telemetry','Telemetri')}: ${T.length} ${H('samples','örnek')}, ${H('mean power','ortalama güç')} ${f(p.mean,0)} W (${H('max','en çok')} ${f(p.max,0)} W), ${H('max altitude','en yüksek irtifa')} ${f(a.max,1)} m.`,'');}
  if(experiment){
    const d=experiment.definition,keys=d.variables.map(v=>v.key);
    lines.push(`## 4. ${H('Experiment','Deney')}: ${L(d.label)??d.name}`,'',`${H('Seeds','Seed\'ler')}: ${d.seeds.join(', ')}`,'',
      `| ${keys.join(' | ')} | ${H('success','başarı')} | E (Wh) | t (s) | ${H('max tilt','eğim')} (°) | ${H('mass','kütle')} (kg) |`,`|${keys.map(()=>'---').join('|')}|---|---|---|---|---|`);
    for(const s of experiment.summary)lines.push(`| ${keys.map(k=>s[k]).join(' | ')} | ${f(100*s.success,0)} % | ${f(s.energyWh,2)} ± ${f(s.energyWhSd,2)} | ${f(s.flightTime,1)} | ${f(s.maxTilt,1)} | ${f(s.mass,3)} |`);
    lines.push('');
  }
  lines.push(`## ${experiment?5:4}. ${H('Assumptions and limits','Varsayımlar ve sınırlar')}`,'');
  for(const a of ASSUMPTIONS.filter(a=>!['controller-gravity','battery','core-calibration'].includes(a.id)))lines.push(`- ${a[lang]??a.en}`);
  lines.push(`- ${H('Mars rotor profile-loss factor 3.0 is calibrated to the published Ingenuity flight power (≈ 350 W).','Mars rotor profil kaybı katsayısı 3,0, Ingenuity\'nin yayımlanmış uçuş gücüne (≈ 350 W) kalibre edildi.')}`,
    `- ${H('Rotor blade flapping (blow-back) in edgewise flow and dust effects on sensors are not modelled.','Yatay akışta pal çırpması (geri yatma) ve tozun sensörlere etkisi modellenmedi.')}`,
    `- ${H('Terrain is procedural unless a real DTM is loaded; it is never presented as NASA data.','Gerçek bir DTM yüklenmedikçe arazi prosedüreldir; NASA verisi olarak sunulmaz.')}`,'');
  lines.push(`## ${H('Sources','Kaynaklar')}`,'');
  for(const s of [...Object.values(SOURCES),...Object.values(ROTOR_SOURCES),...Object.values(VEHICLE_SOURCES),...Object.values(TERRAIN_SOURCES)])
    if(s.url)lines.push(`- [${s.title}](${s.url})`);
  return lines.join('\n')+'\n';
}
/** Tiny Markdown → HTML for the in-app view (headings, tables, lists, bold, links). */
export function markdownToHtml(md){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out=[];let table=null,list=false;
  for(const line of md.split('\n')){
    if(line.startsWith('|')){const cells=line.split('|').slice(1,-1).map(c=>c.trim());if(cells.every(c=>/^-+$/.test(c)))continue;
      if(!table){table=[];out.push('<table>');}out.push(`<tr>${cells.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`);continue;}
    if(table){out.push('</table>');table=null;}
    if(line.startsWith('- ')){if(!list){out.push('<ul>');list=true;}out.push(`<li>${inline(line.slice(2))}</li>`);continue;}
    if(list){out.push('</ul>');list=false;}
    const h=line.match(/^(#+) (.*)/);if(h){out.push(`<h${h[1].length+1}>${inline(h[2])}</h${h[1].length+1}>`);continue;}
    if(line.trim())out.push(`<p>${inline(line)}</p>`);
  }
  if(table)out.push('</table>');if(list)out.push('</ul>');return out.join('\n');
}
