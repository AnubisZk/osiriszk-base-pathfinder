// Mars Base Pathfinder — the game loop in nine steps:
// budget → drone → three sites → route → autonomous survey flights (Rapier, in a worker) →
// merge drone and NASA data → safety screening + TOPSIS → recommendation → scientific report.
// All decisions come from src/pathfinder (the same code the tests and tools/pathfinder-run.mjs use).
import {initializeRapier} from '../../src/physics/FlightPhysics.js';
import {SITE_CATALOG,DEFAULT_SITES,prepareSite,editAssumption,CRITERIA,defaultWeights,weightVector,KINDS,PF_SOURCES,
  DEFAULT_DESIGN,ROTOR_OPTIONS,BATTERY_OPTIONS,CAMERA_OPTIONS,FRAME_COSTS,budget,cameraOf,DEFAULT_ROUTE,ROUTE_LIMITS,planSurvey,
  validateMission,attachSurvey,decide,SAFETY_RULES,defaultSafetyParams,ahp,reciprocalMatrix,buildPathfinderReport,dataCSV,resultsCSV,missionJSON,QUESTION} from '../../src/pathfinder/index.js';
import {parseTable} from '../../src/pathfinder/adapters/tables.js';
import {suggestMapping,applyMapping,checkMapping,readDataPack,makeDataPack,TARGET_KEYS} from '../../src/pathfinder/adapters/mapping.js';
import {readRaster,rasterToDatums,RASTER_TRANSFORMS} from '../../src/pathfinder/adapters/raster.js';
import {FRAME_TYPES,FRAME_LABELS} from '../../src/frames/frames.js';
import {getProfile} from '../../src/planet/profiles.js';
import {lineChart,barChart} from '../ui/charts.js';
import {SiteView} from './view3d.js';
import {drawMarsMap} from './map2d.js';
import {t,L,setLang,getLang} from './strings.js';

await initializeRapier();
setLang(getLang());
const $=s=>document.querySelector(s);
function h(tag,attrs={},...kids){
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs??{})){
    if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='html')e.innerHTML=v;else if(v===true)e.setAttribute(k,'');else if(v!=null&&v!==false)e.setAttribute(k,v);
  }
  for(const c of kids.flat(Infinity))if(c!=null&&c!==false)e.append(c instanceof Node?c:String(c));
  return e;
}
const f=(v,d=2)=>v==null||!Number.isFinite(v)?'—':Math.abs(v)>=1000?v.toFixed(0):Math.abs(v)>=100?v.toFixed(Math.min(d,1)):v.toFixed(d);
const decs=v=>Math.abs(v)>=100?0:Math.abs(v)>=10?1:2;
/** value ± uncertainty, both with the decimals the value's size calls for */
const vu=d=>d&&d.value!=null?`${d.value.toFixed(decs(d.value))}${d.uncertainty!=null?` ± ${d.uncertainty.toFixed(decs(d.value))}`:''}`:'—';
const pct=v=>getLang()==='tr'?`%${v}`:`${v} %`;
const kindBadge=d=>d?h('span',{class:`kind k-${d.kind}`,title:L(KINDS[d.kind].label)},L(KINDS[d.kind].short)):h('span',{class:'kind'},'—');
const store={get(){try{return JSON.parse(localStorage.getItem('osiris-pathfinder')??'{}');}catch{return {};}},set(v){try{localStorage.setItem('osiris-pathfinder',JSON.stringify(v));}catch{}}};

// ---------------------------------------------------------------- state
const saved=store.get();
const state={
  step:Math.min(9,Math.max(1,saved.step??1)),
  design:{...DEFAULT_DESIGN,...saved.design},
  selected:Array.isArray(saved.selected)&&saved.selected.length===3&&saved.selected.every(id=>SITE_CATALOG.some(s=>s.id===id))?saved.selected:[...DEFAULT_SITES],
  route:{...DEFAULT_ROUTE,wind:'calm',...saved.route},
  weights:{...defaultWeights(),...saved.weights},weightMode:'sliders',ahpUpper:{},
  safety:{...defaultSafetyParams(),...saved.safety},
  edits:{},surveys:{},viewSite:null,flying:null,detail:null,importer:null,sensCrit:0,
};
const persist=()=>store.set({step:state.step,design:state.design,selected:state.selected,route:state.route,weights:state.weights,safety:state.safety});

const sitesNow=()=>state.selected.map(id=>prepareSite(id,state.edits[id]??{}));
const surveyKey=s=>JSON.stringify({d:state.design,r:state.route,lat:s.data.latitude.value,lon:s.data.longitude.value,el:s.data.elevation.value,ter:s.terrain});
function sitesWithSurveys(){
  return sitesNow().map(s=>{const sv=state.surveys[s.id];return sv&&sv.key===surveyKey(s)?attachSurvey(s,sv.survey):s;});
}
let vCache={key:null,value:null};
function validation(){
  const key=JSON.stringify({d:state.design,r:state.route,s:state.selected,e:Object.keys(state.edits).map(k=>[k,Object.keys(state.edits[k])]),ev:sitesNow().map(s=>s.data.elevation.value)});
  if(vCache.key!==key){vCache={key,value:validateMission(state.design,sitesNow(),state.route)};}
  return vCache.value;
}
const decisionNow=()=>decide(sitesWithSurveys(),{weights:state.weights,safety:state.safety,mcDraws:1000});

// ---------------------------------------------------------------- 3D view
const view=new SiteView($('#view'),{onHud:s=>{
  $('#hud').hidden=false;
  $('#hud').textContent=`${t('time')} ${f(s.t,0)} / ${f(s.end,0)} s\n${t('agl')} ${f(s.agl,1)} m\n${t('soc')} ${f(s.soc*100,0)} %\n${t('power')} ${f(s.power,0)} W\n${t('photosTaken')} ${s.photos}`;}});
function syncView(){
  const sites=sitesNow(),site=sites.find(s=>s.id===state.viewSite)??sites[0];state.viewSite=site.id;
  if(view.site?.id!==site.id||view.siteTerrainKey!==JSON.stringify(site.terrain)){view.showSite(site);view.siteTerrainKey=JSON.stringify(site.terrain);}
  view.setDrone(state.design);
  let plan=null;try{plan=planSurvey(cameraOf(state.design),state.route);}catch{}
  if(state.step>=4&&plan)view.setRoute(plan);else{view.overlay.clear();view.route=null;}
  const sv=state.surveys[site.id];
  if(state.step>=5&&sv&&sv.key===surveyKey(site))view.setSurvey(sv.survey,{showSafety:state.step>=6});
  $('#sitetabs').replaceChildren(...sites.map(s=>h('button',{class:s.id===site.id?'on':'',onclick:()=>{state.viewSite=s.id;view.stopReplay();$('#hud').hidden=true;syncView();}},L(s.label))));
}

// ---------------------------------------------------------------- shell
function header(){
  const lang=h('select',{'aria-label':t('lang'),onchange:e=>{setLang(e.target.value);render();}},h('option',{value:'en'},'English'),h('option',{value:'tr'},'Türkçe'));lang.value=getLang();
  $('#top').replaceChildren(h('a',{class:'home',href:`./${location.search}`},t('back')),h('h1',{},h('span',{},'OsirisZk'),' · ',t('title')),h('small',{},t('subtitle')),h('div',{class:'sp'}),lang);
  $('#stepper').replaceChildren(...t('steps').map((s,i)=>h('button',{class:`${state.step===i+1?'on':''}`,onclick:()=>go(i+1)},h('b',{},i+1),' ',s)));
}
function go(step){
  state.step=Math.max(1,Math.min(9,step));persist();view.stopReplay();$('#hud').hidden=true;
  if(state.step===8){try{const d=decisionNow();if(d.recommended)state.viewSite=d.recommended.id;}catch{}}
  render();
}
function render(){
  header();
  const body=[h('h2',{},t('stepTitles')[state.step-1])];
  try{body.push(...[null,stepBudget,stepDrone,stepSites,stepRoute,stepSurvey,stepData,stepCompare,stepRecommend,stepReport][state.step]());}
  catch(err){console.error(err);body.push(h('p',{class:'bad'},String(err.message??err)));}
  body.push(h('div',{class:'nav'},state.step>1?h('button',{class:'sec',onclick:()=>go(state.step-1)},`← ${t('prev')}`):h('span'),state.step<9?h('button',{class:'act',onclick:()=>go(state.step+1)},`${t('next')} →`):h('span')));
  $('#panel').replaceChildren(...body.flat().filter(x=>x!=null&&x!==false));$('#panel').scrollTop=0;
  syncView();
  for(const fn of afterRender.splice(0))fn();
}
const afterRender=[];

// ---------------------------------------------------------------- 1 budget
function budgetTable(b){
  return h('table',{},h('tr',{},h('th',{},t('item')),h('th',{class:'num'},t('cost'))),
    ...b.items.filter(i=>i.kind==='base'||i.cost).map(i=>h('tr',{},h('td',{},L(i.label)),h('td',{class:'num'},i.cost))),
    h('tr',{class:'sum'},h('td',{},t('total')),h('td',{class:'num'},b.total)),h('tr',{},h('td',{},t('remaining')),h('td',{class:`num ${b.within?'ok':'bad'}`},b.remaining)));
}
function stepBudget(){
  const b=budget(state.design);
  return [h('p',{class:'note'},t('representative')),budgetTable(b),
    h('div',{class:'bar'},h('i',{style:`width:${Math.min(100,b.total)}%`,class:b.within?'':'over'})),
    h('p',{class:b.within?'ok':'bad'},`${b.within?t('budgetOk'):t('budgetOver')}: ${b.total} / 100 M USD`)];
}

// ---------------------------------------------------------------- 2 drone
function select(options,value,onchange){const s=h('select',{onchange:e=>onchange(e.target.value)},...options.map(([v,l])=>h('option',{value:v},l)));s.value=value;return s;}
function messages(list){
  return list.map(m=>h('div',{class:`msg ${m.severity}`},h('b',{},m.severity==='error'?'✗ ':'⚠ '),L(m),
    m.fixes?.length?h('div',{class:'fixes'},`${t('fixes')}: `,m.fixes.map(x=>L(x)).join(' · ')):null));
}
function validationTable(v){
  return h('table',{},h('tr',{},...[t('site'),`${t('mass')} kg`,`ρ kg/m³`,t('tw'),`${t('hover')} W`,`${t('plannedE')} Wh`,`${t('availableE')} Wh`,`${t('flightT')} s`,`${t('range')} m`].map(x=>h('th',{},x))),
    ...v.perSite.map(p=>h('tr',{},h('td',{},L(p.label)),h('td',{class:'num'},f(p.mass)),h('td',{class:'num'},f(p.density,4)),h('td',{class:`num ${p.thrustToWeight<1?'bad':p.thrustToWeight<1.3?'warn':'ok'}`},f(p.thrustToWeight)),
      h('td',{class:'num'},f(p.hoverPower,0)),h('td',{class:`num ${p.energyWh>p.availableWh?'bad':''}`},f(p.energyWh,1)),h('td',{class:'num'},f(p.availableWh,1)),h('td',{class:'num'},f(p.flightTime,0)),h('td',{class:'num'},f(p.range,0)))));
}
function stepDrone(){
  const d=state.design,set=(k,v)=>{state.design={...d,[k]:v};persist();render();};
  const cost=c=>c?` (+${c} M)`:'';
  const v=validation(),b=v.budget;
  return [
    h('div',{class:'grid2'},
      h('label',{},t('rotor')),select(ROTOR_OPTIONS.map(o=>[o.id,L(o.label)+cost(o.cost)]),d.rotor,x=>set('rotor',x)),
      h('label',{},t('battery')),select(BATTERY_OPTIONS.map(o=>[o.id,L(o.label)+cost(o.cost)]),d.battery,x=>set('battery',x)),
      h('label',{},t('camera')),select(CAMERA_OPTIONS.map(o=>[o.id,L(o.label)+cost(o.cost)]),d.camera,x=>set('camera',x)),
      h('label',{},t('frame')),select(FRAME_TYPES.map(id=>[id,L(FRAME_LABELS[id])+cost(FRAME_COSTS[id])]),d.frame,x=>set('frame',x))),
    h('p',{class:`${b.within?'ok':'bad'}`},`${t('total')}: ${b.total} M USD · ${t('remaining')}: ${b.remaining} M USD`),
    h('h3',{},t('perSite')),validationTable(v),
    ...messages([...v.global,...v.perSite.flatMap(p=>p.checks)]),
    v.ok&&!v.perSite.some(p=>p.checks.length)?h('p',{class:'ok'},t('allGood')):null,
    h('p',{class:'note'},t('feaNote'))];
}

// ---------------------------------------------------------------- 3 sites and data
function dataRows(sites,keys){
  return keys.map(([key,label,unit])=>h('tr',{},h('td',{},label,unit?h('small',{},` ${unit}`):null),
    ...sites.map(s=>{const d=s.data[key];return h('td',{class:'cell',onclick:()=>{state.detail={site:s.id,key};render();}},
      vu(d),kindBadge(d));})));
}
function criteriaKeys(withSafety=true){
  return [...CRITERIA.filter(c=>withSafety||c.key!=='safeArea').map(c=>[c.key,L(c.label),c.unit]),['latitude','lat','°'],['longitude','lon','°E'],['elevation',L({en:'elevation',tr:'yükseklik'}),'m']];
}
function detailPanel(sites){
  const dt=state.detail;if(!dt)return null;const s=sites.find(x=>x.id===dt.site);if(!s)return null;const d=s.data[dt.key];if(!d)return null;
  const src=d.source&&PF_SOURCES[d.source];
  const edit=d.kind==='assumption'?(()=>{const inp=h('input',{type:'number',step:'any',value:d.value});
    return h('div',{class:'row'},inp,h('button',{class:'sec',onclick:()=>{const v=+inp.value;if(!Number.isFinite(v))return;
      (state.edits[s.id]??={})[dt.key]=editAssumption(d,v,'player');render();}},t('edit')));})():null;
  return h('div',{class:'detail'},h('b',{},`${L(s.label)} · ${dt.key}`),' ',kindBadge(d),
    h('div',{},`${vu(d)} ${d.unit}`),
    src?h('div',{},`${t('source')}: `,src.url?h('a',{href:src.url,target:'_blank',rel:'noopener'},src.title):src.title):d.source?h('div',{},`${t('source')}: ${d.source}`):null,
    d.resolution?h('div',{},`${t('resolution')}: ${d.resolution}`):null,d.date?h('div',{},`${t('date')}: ${d.date}`):null,d.crs?h('div',{},`CRS: ${d.crs}`):null,
    d.rationale?h('div',{},`${t('rationale')}: ${d.rationale}`):null,d.transforms.length?h('div',{},`${t('steps2')}: ${d.transforms.join(' → ')}`):null,
    d.note?h('div',{class:'note'},d.note):null,edit);
}
function stepSites(){
  const cv=h('canvas',{class:'map'}),sites=sitesNow();
  const toggle=id=>{const sel=state.selected;if(sel.includes(id)){if(sel.length>1)state.selected=sel.filter(x=>x!==id);}else{state.selected=[...sel,id].slice(-3);}
    persist();state.detail=null;render();};
  afterRender.push(()=>drawMarsMap(cv,SITE_CATALOG.map(s=>prepareSite(s.id,state.edits[s.id]??{})),state.selected,{onClick:toggle,lang:getLang()}));
  const editCount=Object.values(state.edits).reduce((n,e)=>n+Object.keys(e).length,0);
  return [h('p',{class:'note'},t('sitesHint')),cv,
    h('div',{class:'sites'},...SITE_CATALOG.map(s=>h('label',{class:`site ${state.selected.includes(s.id)?'on':''}`},
      h('input',{type:'checkbox',checked:state.selected.includes(s.id),onchange:()=>toggle(s.id)}),h('b',{},L(s.label)),h('small',{},L(s.summary))))),
    state.selected.length!==3?h('p',{class:'warn'},'3 ×'):null,
    h('table',{class:'data'},h('tr',{},h('th',{},t('criterion')),...sites.map(s=>h('th',{},L(s.label)))),...dataRows(sites,criteriaKeys(false))),
    detailPanel(sites),
    h('h3',{},t('importData')),h('p',{class:'note'},t('importHint')),importer(sites),
    editCount?h('p',{},`${editCount} ${t('editsCount')} `,h('button',{class:'sec',onclick:()=>{state.edits={};state.detail=null;render();}},t('resetEdits'))):null];
}

// ---------------------------------------------------------------- import (tables, rasters, data packs)
function importer(sites){
  const file=h('input',{type:'file',accept:'.csv,.tsv,.txt,.json,.geojson,.tif,.tiff',onchange:async e=>{
    const fl=e.target.files[0];if(!fl)return;
    try{
      if(/\.tiff?$/i.test(fl.name)){state.importer={type:'raster',name:fl.name,raster:await readRaster(await fl.arrayBuffer()),key:'ice',transform:'identity',radius:10,kind:'nasa',source:'',date:''};}
      else{const text=await fl.text();
        if(text.includes('osiriszk-pathfinder-data/')){const pack=readDataPack(text);mergeEdits(pack.edits);state.importer={type:'done',message:`${t('imported')}: ${fl.name}`};}
        else{const table=parseTable(fl.name,text);state.importer={type:'table',name:fl.name,table,mapping:suggestMapping(table)};}}
    }catch(err){state.importer={type:'error',message:String(err.message??err)};}
    render();}});
  const I=state.importer,out=[file];
  if(I?.type==='error')out.push(h('p',{class:'bad'},I.message));
  if(I?.type==='done')out.push(h('p',{class:'ok'},I.message));
  if(I?.type==='table')out.push(mappingEditor(I,sites));
  if(I?.type==='raster')out.push(rasterEditor(I,sites));
  return h('div',{class:'importer'},...out);
}
function mergeEdits(edits){for(const [id,vals] of Object.entries(edits))state.edits[id]={...(state.edits[id]??{}),...vals};vCache.key=null;}
const kindOptions=()=>Object.keys(KINDS).filter(k=>k!=='simulation'&&k!=='model').map(k=>[k,L(KINDS[k].label)]);
function mappingEditor(I,sites){
  const m=I.mapping,rer=()=>render();
  const cols=I.table.columns,colOpts=[['',t('ignore')],...cols.map(c=>[c,c])];
  const matchSel=select([['id',t('byId')],['nearest',t('byNearest')]],m.match.by,v=>{m.match.by=v;rer();});
  const rows=cols.filter(c=>!c.startsWith('_')&&c!==m.match.column&&c!==m.match.latColumn&&c!==m.match.lonColumn).map(c=>{
    const fld=m.fields.find(x=>x.column===c);
    const target=select([['',t('ignore')],...Object.entries(TARGET_KEYS).map(([k,v])=>[k,L(v.label)])],fld?.key??'',v=>{
      m.fields=m.fields.filter(x=>x.column!==c);if(v)m.fields.push({column:c,key:v,unit:TARGET_KEYS[v].unit,scale:1,offset:0,kind:'synthetic',source:'',date:'',resolution:''});rer();});
    if(!fld)return h('tr',{},h('td',{},c),h('td',{},target),h('td',{colspan:5}));
    const inp=(k,w=70)=>h('input',{value:fld[k]??'',style:`width:${w}px`,onchange:e=>{fld[k]=['scale','offset'].includes(k)?+e.target.value:e.target.value;}});
    return h('tr',{},h('td',{},c),h('td',{},target),h('td',{},select(kindOptions(),fld.kind,v=>{fld.kind=v;})),h('td',{},inp('source',120)),h('td',{},inp('date',60)),h('td',{},inp('scale',50)),
      h('td',{},select(colOpts,fld.uncertaintyColumn??'',v=>{fld.uncertaintyColumn=v||undefined;})));
  });
  const matchCols=m.match.by==='id'?[h('label',{},t('column')),select(colOpts.slice(1),m.match.column??cols[0],v=>{m.match.column=v;rer();})]
    :[h('label',{},'lat'),select(colOpts.slice(1),m.match.latColumn??'',v=>{m.match.latColumn=v;}),h('label',{},'lon'),select(colOpts.slice(1),m.match.lonColumn??'',v=>{m.match.lonColumn=v;}),
      h('label',{},'km'),h('input',{type:'number',value:m.match.maxDistanceKm??50,style:'width:70px',onchange:e=>{m.match.maxDistanceKm=+e.target.value;}})];
  const problems=checkMapping(I.table,m);
  return h('div',{class:'mapping'},h('b',{},`${t('mapping')}: ${I.name} (${I.table.rows.length} rows)`),
    h('div',{class:'row'},h('label',{},t('matchBy')),matchSel,...matchCols),
    h('table',{},h('tr',{},...[t('column'),t('target'),t('kind'),t('source'),t('date'),t('scale'),t('uncCol')].map(x=>h('th',{},x))),...rows),
    problems.length?h('p',{class:'warn'},problems.join(' · ')):null,
    h('div',{class:'btns'},h('button',{class:'act',onclick:()=>{const r=applyMapping(I.table,m,SITE_CATALOG.map(s=>prepareSite(s.id,state.edits[s.id]??{})),{fileName:I.name});
      if(r.problems.length){alert(r.problems.join('\n'));return;}mergeEdits(r.edits);state.importer={type:'done',message:`${t('imported')}: ${I.name} · ${r.matched.length} ✓ · ${r.unmatched.length} ${t('unmatched')}`};render();}},t('apply')),
      h('button',{class:'sec',onclick:()=>{state.importer=null;render();}},t('cancel'))));
}
function rasterEditor(I,sites){
  const r=I.raster;
  return h('div',{class:'mapping'},h('b',{},`GeoTIFF ${I.name}: ${r.width} × ${r.height}, CRS ${r.crs.type}`),
    h('div',{class:'grid2'},h('label',{},t('rasterKey')),select(Object.entries(TARGET_KEYS).map(([k,v])=>[k,L(v.label)]),I.key,v=>{I.key=v;}),
      h('label',{},t('transform')),select(Object.entries(RASTER_TRANSFORMS).map(([k,v])=>[k,v.label]),I.transform,v=>{I.transform=v;}),
      h('label',{},t('radius')),h('input',{type:'number',value:I.radius,onchange:e=>{I.radius=+e.target.value;}}),
      h('label',{},t('kind')),select(kindOptions(),I.kind,v=>{I.kind=v;}),
      h('label',{},t('source')),h('input',{value:I.source,placeholder:'e.g. SWIM ice consistency v3 (PSI/JPL)',onchange:e=>{I.source=e.target.value;}}),
      h('label',{},t('date')),h('input',{value:I.date,onchange:e=>{I.date=e.target.value;}})),
    h('div',{class:'btns'},h('button',{class:'act',onclick:()=>{
      if(I.kind==='nasa'&&!I.source){alert('NASA data needs its source');return;}
      const all=SITE_CATALOG.map(s=>prepareSite(s.id,state.edits[s.id]??{}));
      const {edits,missing}=rasterToDatums(r,all,{key:I.key,unit:TARGET_KEYS[I.key].unit,kind:I.kind,source:I.source,date:I.date||null,fileName:I.name,radiusKm:I.radius,transform:I.transform});
      mergeEdits(edits);state.importer={type:'done',message:`${t('imported')}: ${I.name} → ${I.key} · ${Object.keys(edits).length} ✓${missing.length?` · outside: ${missing.join(', ')}`:''}`};render();}},t('sample')),
      h('button',{class:'sec',onclick:()=>{state.importer=null;render();}},t('cancel'))));
}

// ---------------------------------------------------------------- 4 route
function slider(label,key,step,fmt=v=>v){
  const [lo,hi]=ROUTE_LIMITS[key],val=h('b',{},fmt(state.route[key]));
  return [h('label',{},label,' ',val),h('input',{type:'range',min:lo,max:hi,step,value:state.route[key],
    oninput:e=>{val.textContent=fmt(+e.target.value);},onchange:e=>{state.route={...state.route,[key]:+e.target.value};persist();render();}})];
}
function stepRoute(){
  const cam=cameraOf(state.design),p=planSurvey(cam,state.route),v=validation();
  const winds=getProfile('mars-brief').winds.filter(w=>w.id!=='dust-storm');
  return [h('div',{class:'grid2'},...slider(t('area'),'area',10,x=>`${x} × ${x} m`),...slider(t('altitude'),'altitude',1,x=>`${x} m`),...slider(t('speed'),'speed',.5,x=>`${x} m/s`),
      ...slider(t('side'),'sideOverlap',.05,x=>pct(Math.round(x*100))),...slider(t('forward'),'forwardOverlap',.05,x=>pct(Math.round(x*100))),
      h('label',{},t('wind')),select(winds.map(w=>[w.id,L(w.label)]),state.route.wind??'calm',x=>{state.route={...state.route,wind:x};persist();render();})),
    h('div',{class:'kv'},...[[t('swath'),`${f(p.swath,1)} m`],[t('spacing'),`${f(p.spacing,1)} m`],[t('lines'),p.lines],[t('photos'),`≈ ${p.expectedPhotos}`],
      [t('gsd'),`${f(p.gsd*1000,1)} mm/px`],[t('stereoBase'),f(p.baseHeightRatio,2)],[t('blur'),`${f(p.blurPx,2)} px`],[t('distance'),`${f(p.distance,0)} m`]].flatMap(([k,x])=>[h('span',{},k),h('b',{},x)])),
    h('h3',{},t('perSite')),validationTable(v),...messages([...v.global,...v.perSite.flatMap(x=>x.checks)])];
}

// ---------------------------------------------------------------- 5 survey
let worker=null;
function runSurveys(){
  if(worker)worker.terminate();
  const sites=sitesNow();state.flying={progress:Object.fromEntries(sites.map(s=>[s.id,0])),errors:{}};
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=e=>{const m=e.data;
    if(m.type==='progress'){state.flying.progress[m.site]=m.p;const bar=document.querySelector(`[data-progress="${m.site}"]`);if(bar)bar.style.width=`${(m.p*100).toFixed(0)}%`;}
    if(m.type==='site'){state.surveys[m.site]={key:m.key,survey:m.survey};state.flying.progress[m.site]=1;if(state.step===5)render();}
    if(m.type==='error'){state.flying.errors[m.site]=m.message;render();}
    if(m.type==='done'){state.flying=null;worker.terminate();worker=null;render();}};
  worker.postMessage({design:state.design,route:state.route,sites:sites.map(s=>({id:s.id,edits:state.edits[s.id]??{},key:surveyKey(s)}))});
  render();
}
// flight results come from the mission executive in English; show them in the interface language
const REASONS={complete:'tamamlandı','time limit':'süre sınırı','battery depleted in flight':'uçuşta batarya bitti','crash: attitude lost':'kaza: denge kaybı',
  'cannot take off: maximum thrust below weight':'kalkamaz: en büyük itki ağırlıktan az','did not lift off: motor current (torque) limit':'kalkamadı: motor akım (tork) sınırı',
  'did not lift off':'kalkamadı',battery:'batarya yetersiz'};
const reasonText=r=>getLang()==='tr'?(REASONS[r]??r):r;
function surveyRows(sites){
  return h('table',{},h('tr',{},...[t('site'),t('result'),'s','Wh',t('photos'),t('coverage'),t('safeArea'),''].map(x=>h('th',{},x))),
    ...sites.map(s=>{const sv=state.surveys[s.id],valid=sv&&sv.key===surveyKey(s),fl=state.flying;
      if(fl&&fl.progress[s.id]<1&&!valid)return h('tr',{},h('td',{},L(s.label)),h('td',{colspan:7},h('div',{class:'bar'},h('i',{'data-progress':s.id,style:`width:${(fl.progress[s.id]*100).toFixed(0)}%`})),fl.errors[s.id]?h('span',{class:'bad'},fl.errors[s.id]):null));
      if(!sv)return h('tr',{},h('td',{},L(s.label)),h('td',{colspan:7,class:'note'},'—'));
      const r=sv.survey.result,a=sv.survey.analysis;
      return h('tr',{class:valid?'':'stale'},h('td',{},L(s.label)),h('td',{class:r.success?'ok':'bad'},`${r.success?'✓':'✗'} ${reasonText(r.reason)}`),h('td',{class:'num'},f(r.flightTime,0)),h('td',{class:'num'},f(r.energyWh,1)),
        h('td',{class:'num'},a.photos),h('td',{class:'num'},pct(f(a.coverage*100,0))),h('td',{class:'num'},a.safeFraction!=null?`${f(a.safeFraction*100,1)} ± ${f(a.safeUncertainty*100,1)} %`:'—'),
        h('td',{},h('button',{class:'sec',onclick:()=>{state.viewSite=s.id;syncView();view.replay(sv.survey.track,{speed:+($('#rspeed')?.value??8)});}},`▶ ${t('replay')}`)));}));
}
function stepSurvey(){
  const v=validation(),sites=sitesNow(),stale=sites.some(s=>state.surveys[s.id]&&state.surveys[s.id].key!==surveyKey(s));
  const sp=select([[1,'×1'],[4,'×4'],[8,'×8'],[16,'×16'],[32,'×32']],8,x=>view.setSpeed(+x));sp.id='rspeed';
  return [h('p',{class:'note'},L({en:'Each flight runs in the full simulator: Rapier rigid body at 240 Hz, rotor aerodynamics in the site\'s air, motor and battery models, autonomous mission executive (commands from Earth would arrive minutes late). The camera fires along the survey lines.',
      tr:'Her uçuş tam simülatörde koşar: 240 Hz Rapier katı cismi, bölgenin havasında rotor aerodinamiği, motor ve batarya modelleri, otonom görev yürütücüsü (Dünya\'dan komutlar dakikalarca geç gelirdi). Kamera tarama çizgileri boyunca çeker.'})),
    v.ok?null:h('p',{class:'bad'},t('invalid')),...(v.ok?[]:messages([...v.global,...v.perSite.flatMap(x=>x.checks)].filter(m=>m.severity==='error'))),
    h('div',{class:'btns'},h('button',{class:'act',disabled:!v.ok||!!state.flying,onclick:runSurveys},state.flying?t('running'):t('runSurveys')),
      h('label',{},t('speedX'),' ',sp),h('button',{class:'sec',onclick:()=>view.togglePlay()},`${t('play')} / ${t('pause')}`)),
    surveyRows(sites),stale?h('p',{class:'warn'},t('stale')):null];
}

// ---------------------------------------------------------------- 6 data fusion
function stepData(){
  const sites=sitesWithSurveys();
  if(!sites.some(s=>s.survey))return [h('p',{class:'warn'},t('noSurvey'))];
  return [h('p',{class:'note'},t('droneCannot')),
    h('table',{class:'data'},h('tr',{},h('th',{},t('criterion')),...sites.map(s=>h('th',{},L(s.label)))),...dataRows(sites,criteriaKeys(true))),
    detailPanel(sites),
    h('h3',{},L({en:'Photogrammetry (drone camera)',tr:'Fotogrametri (dron kamerası)'})),
    h('table',{},h('tr',{},h('th',{}),...sites.map(s=>h('th',{},L(s.label)))),
      ...[[t('coverage'),a=>pct(f(a.coverage*100,0))],[t('gsd'),a=>`${f(a.gsd*1000,1)} mm/px`],[t('sigmaZ'),a=>`${f(a.sigmaZ*1000,1)} mm`],
        [t('safeArea'),a=>a.safeFraction!=null?`${f(a.safeFraction*100,1)} ± ${f(a.safeUncertainty*100,1)} %`:'—'],[t('truth'),a=>a.truth.safeFraction!=null?`${f(a.truth.safeFraction*100,1)} %`:'—'],
        [t('demRmse'),a=>`${f(a.truth.demRmse*1000,1)} mm`],[t('rocks'),a=>`${a.rocks.hazardDetected} / ${a.truth.hazardRocks}`],
        [L({en:'mean / p95 slope',tr:'ortalama / p95 eğim'}),a=>`${f(a.meanSlope,1)}° / ${f(a.p95Slope,1)}°`]]
        .map(([k,fn])=>h('tr',{},h('td',{},k),...sites.map(s=>h('td',{class:'num'},s.survey?fn(s.survey.analysis):'—'))))),
    h('p',{class:'note'},L({en:'Map in the 3D view: green safe, orange too steep, red rock hazard. Terrain is synthetic unless a DTM was loaded: the "truth" row checks the method.',tr:'3B görünümdeki harita: yeşil güvenli, turuncu fazla eğimli, kırmızı kaya tehlikesi. DTM yüklenmediyse arazi sentetiktir: "gerçek" satırı yöntemi doğrular.'}))];
}

// ---------------------------------------------------------------- 7 compare
const SAATY=[9,7,5,3,1,1/3,1/5,1/7,1/9],saatyLabel=v=>v>=1?String(v):`1/${Math.round(1/v)}`;
function weightsEditor(){
  const w=weightVector(state.weights);
  if(state.weightMode==='sliders')return h('div',{class:'grid2'},...CRITERIA.flatMap((c,j)=>{const val=h('b',{},pct(f(w[j]*100,0)));
    return [h('label',{},L(c.label),' ',val),h('input',{type:'range',min:0,max:1,step:.01,value:state.weights[c.id],oninput:e=>{val.textContent=f(+e.target.value,2);},
      onchange:e=>{state.weights={...state.weights,[c.id]:+e.target.value};persist();render();}})];}));
  const n=CRITERIA.length,up=(i,j)=>state.ahpUpper[`${i},${j}`]??1,A=reciprocalMatrix(n,up),r=ahp(A);
  const pairs=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)pairs.push(h('tr',{},h('td',{},L(CRITERIA[i].label)),
    h('td',{},select(SAATY.map(v=>[v,saatyLabel(v)]),up(i,j),x=>{state.ahpUpper[`${i},${j}`]=+x;render();})),h('td',{},L(CRITERIA[j].label))));
  return h('div',{},h('p',{class:'note'},t('ahpHint')),h('table',{class:'ahp'},...pairs),
    h('p',{class:r.consistent?'ok':'bad'},`${t('cr')} = ${f(r.CR,3)} (λmax ${f(r.lambdaMax,3)}): ${r.consistent?t('crOk'):t('crBad')}`),
    h('div',{class:'kv'},...CRITERIA.flatMap((c,j)=>[h('span',{},L(c.label)),h('b',{},pct(f(r.weights[j]*100,1)))])),
    h('button',{class:'act',disabled:!r.consistent,onclick:()=>{state.weights=Object.fromEntries(CRITERIA.map((c,j)=>[c.id,+r.weights[j].toFixed(4)]));state.weightMode='sliders';persist();render();}},t('useAhp')));
}
function stepCompare(){
  const sites=sitesWithSurveys();if(!sites.some(s=>s.survey))return [h('p',{class:'warn'},t('noSurvey'))];
  const d=decisionNow(),cv=h('canvas',{class:'chart'});
  const params=h('div',{class:'grid2'},...SAFETY_RULES.flatMap(r=>[h('label',{},L(r.label),' ',kindBadge({kind:r.kind})),
    h('input',{type:'number',value:state.safety[r.param],step:'any',onchange:e=>{state.safety={...state.safety,[r.param]:+e.target.value};persist();render();}})]));
  const scr=h('table',{},h('tr',{},h('th',{},''),...d.screening.map(x=>h('th',{},L(x.site.label)))),
    ...SAFETY_RULES.map(r=>h('tr',{},h('td',{},L(r.label),h('small',{},` ${state.safety[r.param]} ${r.unit}`)),...d.screening.map(x=>{const c=x.checks.find(k=>k.rule.id===r.id);
      return h('td',{class:c.pass?'ok':'bad'},`${c.pass?'✓':'✗'} ${f(c.value,1)}`);}))));
  const res=d.ranking?h('table',{},h('tr',{},...[t('rank'),t('site'),'D⁺','D⁻',t('closeness')].map(x=>h('th',{},x))),
    ...d.ranking.map(r=>h('tr',{},h('td',{},r.rank),h('td',{},L(r.label)),h('td',{class:'num'},f(r.Dplus,4)),h('td',{class:'num'},f(r.Dminus,4)),h('td',{class:'num'},h('b',{},f(r.C,3))))),
    ...d.screening.filter(x=>!x.pass).map(x=>h('tr',{class:'stale'},h('td',{},'—'),h('td',{},L(x.site.label)),h('td',{colspan:3},t('notRanked')))))
    :h('p',{class:'bad'},t('noPass'));
  if(d.ranking)afterRender.push(()=>barChart(cv,{labels:d.ranking.map(r=>L(r.label)),values:d.ranking.map(r=>r.C),title:t('closeness')}));
  return [h('h3',{},t('safetyRules')),params,scr,
    h('h3',{},t('weights')),h('div',{class:'btns'},h('button',{class:state.weightMode==='sliders'?'act':'sec',onclick:()=>{state.weightMode='sliders';render();}},t('sliders')),
      h('button',{class:state.weightMode==='ahp'?'act':'sec',onclick:()=>{state.weightMode='ahp';render();}},t('ahp'))),weightsEditor(),
    h('h3',{},t('topsis')),res,d.ranking?cv:null,
    h('p',{class:'note'},'r = x / √Σx² · v = w·r · D± = √Σ(v − v±)² · C = D⁻ / (D⁺ + D⁻)')];
}

// ---------------------------------------------------------------- 8 recommend
function stepRecommend(){
  const sites=sitesWithSurveys();if(!sites.some(s=>s.survey))return [h('p',{class:'warn'},t('noSurvey'))];
  const d=decisionNow();if(!d.recommended)return [h('p',{class:'bad'},t('noPass'))];
  const win=d.recommended,second=d.ranking[1],byId=Object.fromEntries(sites.map(s=>[s.id,s]));
  const out=[h('div',{class:'winner'},h('small',{},t('recommended')),h('h2',{},L(win.label)),h('div',{},`${t('closeness')} = ${f(d.ranking[0].C,3)}`,second?` · ${L(second.label)} ${f(second.C,3)}`:''))];
  if(d.single)return out;
  const maxA=Math.max(...d.explanation.map(e=>Math.abs(e.advantage)),1e-9);
  out.push(h('h3',{},`${t('why')}: ${L(second.label)}`),...d.explanation.map(e=>{const c=CRITERIA[e.criterion],a=win.data[c.key],b=byId[second.site].data[c.key];
    return h('div',{class:'why'},h('span',{},L(c.label)),h('div',{class:'wbar'},h('i',{class:e.advantage>=0?'pos':'neg',style:`width:${(Math.abs(e.advantage)/maxA*50).toFixed(1)}%`})),
      h('small',{},`${f(a.value)} vs ${f(b.value)} ${c.unit}`,' ',kindBadge(a)));}));
  out.push(h('h3',{},t('robust')),h('p',{class:'note'},`${L(win.label)} ${t('stableWhile')}:`),
    h('table',{},h('tr',{},...[t('criterion'),L({en:'weight now',tr:'şimdiki ağırlık'}),L({en:'stays first',tr:'birinci kalır'}),L({en:'outside the range',tr:'aralık dışında'})].map(x=>h('th',{},x))),
      ...d.sensitivity.map(s=>{const c=CRITERIA[s.criterion];
      return h('tr',{},h('td',{},L(c.label)),h('td',{class:'num'},f(s.current,2)),h('td',{class:'num'},s.interval?`${f(s.interval[0],2)} – ${f(s.interval[1],2)}`:'—'),
        h('td',{class:'note'},s.switchesTo.length?`→ ${s.switchesTo.map(i=>L(byId[d.matrix.sites[i]].label)).join(', ')}`:s.ties?L({en:'sites tie (criterion does not separate them)',tr:'bölgeler eşit (ölçüt ayırmıyor)'}):'—'));})),
    h('div',{class:'kv'},...[['mcW','weights'],['mcD','data'],['mcB','both']].flatMap(([k,m])=>[h('span',{},t(k)),h('b',{},pct(f(d.mc[m].shares[d.topsis.winner]*100,0)))])),
    h('p',{class:'note'},`${d.mc.weights.n} · seed ${d.mc.weights.seed} · ${t('keepsFirst')}`));
  const cv=h('canvas',{class:'chart tall'}),sel=select(CRITERIA.map((c,j)=>[j,L(c.label)]),state.sensCrit,x=>{state.sensCrit=+x;render();});
  const s=d.sensitivity[state.sensCrit],colors=['#ff8a4c','#7ef0ff','#7bd88f'];
  afterRender.push(()=>lineChart(cv,{x:s.t,series:s.curves.map((y,i)=>({label:L(byId[d.matrix.sites[i]].label),data:y,color:colors[i%3]})),xLabel:`w (${L(CRITERIA[state.sensCrit].label)})`}));
  out.push(h('h3',{},t('sensitivity')),sel,cv);
  const kinds={};for(const c of CRITERIA){const k=win.data[c.key]?.kind;kinds[k]=(kinds[k]??0)+1;}
  out.push(h('h3',{},t('restsOn')),h('p',{},...Object.entries(kinds).flatMap(([k,n])=>[`${n} × `,kindBadge({kind:k}),' '])));
  const flat=d.quality.filter(q=>!q.separates).map(q=>L(CRITERIA.find(c=>c.id===q.criterion).label)),mixed=d.quality.filter(q=>q.mixed).map(q=>L(CRITERIA.find(c=>c.id===q.criterion).label));
  if(flat.length)out.push(h('p',{class:'note'},`${t('flat')}: ${flat.join(', ')}`));
  if(mixed.length)out.push(h('p',{class:'warn'},`${t('mixed')}: ${mixed.join(', ')}`));
  return out;
}

// ---------------------------------------------------------------- 9 report
function mdToHtml(md){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g,'$1<i>$2</i>').replace(/(https?:\/\/[^\s)|]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  const out=[];let tb=null,ul=false;
  for(const line of md.split('\n')){
    if(line.startsWith('|')){const c=line.split('|').slice(1,-1).map(x=>x.trim());if(c.every(x=>/^:?-+:?$/.test(x)))continue;
      if(!tb){tb=true;out.push('<table>');}out.push(`<tr>${c.map(x=>`<td>${inl(x)}</td>`).join('')}</tr>`);continue;}
    if(tb){out.push('</table>');tb=null;}
    if(line.startsWith('- ')){if(!ul){out.push('<ul>');ul=true;}out.push(`<li>${inl(line.slice(2))}</li>`);continue;}
    if(ul){out.push('</ul>');ul=false;}
    const m=line.match(/^(#+) (.*)/);if(m){out.push(`<h${m[1].length+1}>${inl(m[2])}</h${m[1].length+1}>`);continue;}
    if(line.trim())out.push(`<p>${inl(line)}</p>`);
  }
  if(tb)out.push('</table>');if(ul)out.push('</ul>');return out.join('\n');
}
function download(name,text,type){const a=h('a',{href:URL.createObjectURL(new Blob([text],{type})),download:name});document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
function stepReport(){
  const sites=sitesWithSurveys();if(!sites.some(s=>s.survey))return [h('p',{class:'warn'},t('noReport'))];
  const d=decisionNow(),m={design:state.design,budget:budget(state.design),route:state.route,validation:validation(),sites,decision:d};
  const md=buildPathfinderReport({...m,lang:getLang()});
  const stamp=new Date().toISOString().slice(0,10);
  return [h('div',{class:'btns'},
      h('button',{class:'act',onclick:()=>download(`pathfinder-report-${stamp}.md`,md,'text/markdown')},t('reportMd')),
      h('button',{class:'sec',onclick:()=>download(`pathfinder-data-${stamp}.csv`,dataCSV(sites),'text/csv')},t('dataCsv')),
      h('button',{class:'sec',onclick:()=>download(`pathfinder-results-${stamp}.csv`,resultsCSV(sites,d),'text/csv')},t('resultsCsv')),
      h('button',{class:'sec',onclick:()=>download(`pathfinder-mission-${stamp}.json`,missionJSON(m,{full:true}),'application/json')},t('json')),
      h('button',{class:'sec',onclick:()=>download(`pathfinder-datapack-${stamp}.json`,JSON.stringify(makeDataPack(state.edits),null,1),'application/json')},L({en:'Data pack (JSON)',tr:'Veri paketi (JSON)'}))),
    h('div',{class:'report',html:mdToHtml(md)})];
}

render();
window.__pathfinder={state,view,render,go,decisionNow,validation,sitesWithSurveys,QUESTION};
