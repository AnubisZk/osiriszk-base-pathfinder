/**
 * Provenance of every number the Base Pathfinder uses.
 *
 * A value never travels alone: it is a `datum` with its unit, its KIND (where it comes from),
 * source, resolution, date, uncertainty, coordinate system and the processing steps that produced
 * it. The decision code reads only datums, the interface and the report print the kind next to
 * every number, and a criterion whose values were obtained by different methods for different
 * sites is flagged (an MCDM comparison is only fair when every alternative is measured the same way).
 *
 * Kinds:
 *   nasa        a value read from a NASA (or partner agency) dataset the user imported
 *               (raster sample, table row) — carries the file, resolution and processing steps
 *   published   a number printed in a publication or an official page (coordinates, MEDA ranges)
 *   model       computed by a physical model in this code from other datums (insolation, pressure)
 *   simulation  measured by the simulated drone over the simulated terrain (synthetic unless a real
 *               DTM was loaded for that site)
 *   synthetic   an illustrative example value with no claim to describe the real site
 *   assumption  a user (team) assumption, with its rationale; the player can edit it
 */
export const KINDS=Object.freeze({
  nasa:{order:0,label:{en:'NASA data',tr:'NASA verisi'},short:{en:'NASA',tr:'NASA'}},
  published:{order:1,label:{en:'Published value',tr:'Yayımlanmış değer'},short:{en:'published',tr:'yayın'}},
  model:{order:2,label:{en:'Model (computed)',tr:'Model hesabı'},short:{en:'model',tr:'model'}},
  simulation:{order:3,label:{en:'Drone simulation',tr:'Dron simülasyonu'},short:{en:'simulation',tr:'simülasyon'}},
  synthetic:{order:4,label:{en:'Synthetic example',tr:'Sentetik örnek'},short:{en:'synthetic',tr:'sentetik'}},
  assumption:{order:5,label:{en:'User assumption',tr:'Kullanıcı varsayımı'},short:{en:'assumption',tr:'varsayım'}},
});
export const KIND_ORDER=Object.freeze(Object.keys(KINDS));

/**
 * Make a datum. `value` must be a finite number (or null when the value is not available);
 * `uncertainty` is one standard deviation in the same unit (null = not known).
 * meta: {unit, kind, source (id in SOURCES or free text), resolution, date, uncertainty, crs,
 *        transforms [strings], note, rationale, measuredByDrone}
 */
export function datum(value,meta){
  if(!meta||!KINDS[meta.kind])throw new RangeError(`datum needs a known kind (${KIND_ORDER.join(', ')}), got '${meta?.kind}'`);
  if(value!=null&&!Number.isFinite(value))throw new RangeError(`datum value must be a finite number or null, got ${value}`);
  const u=meta.uncertainty;
  if(u!=null&&!(Number.isFinite(u)&&u>=0))throw new RangeError(`uncertainty must be a non-negative number or null, got ${u}`);
  return Object.freeze({
    value:value??null,unit:meta.unit??'',kind:meta.kind,source:meta.source??null,resolution:meta.resolution??null,
    date:meta.date??null,uncertainty:u??null,crs:meta.crs??null,transforms:Object.freeze([...(meta.transforms??[])]),
    note:meta.note??null,rationale:meta.rationale??null,measuredByDrone:!!meta.measuredByDrone,
  });
}

/** A copy of a datum with some fields changed (e.g. the player edits an assumption). */
export function withValue(d,value,changes={}){
  return datum(value,{...d,...changes,transforms:[...d.transforms,...(changes.transforms??[])]});
}

/** True when the value could only have come from a sensor the drone does not carry. */
export const NOT_DRONE_MEASURABLE=Object.freeze(['subsurfaceIce','radiation','annualTemperature','annualInsolation','dustClimate','surfacePressure']);

/** Short label like "0.85 ± 0.20 (assumption)". */
export function formatDatum(d,{digits=2,lang='en'}={}){
  if(!d||d.value==null)return '—';
  const f=v=>Math.abs(v)>=1000?v.toFixed(0):Math.abs(v)>=100?v.toFixed(Math.min(digits,1)):v.toFixed(digits);
  const u=d.uncertainty!=null?` ± ${f(d.uncertainty)}`:'';
  return `${f(d.value)}${u}${d.unit?' '+d.unit:''} (${KINDS[d.kind].short[lang]??KINDS[d.kind].short.en})`;
}

/**
 * Within one criterion, are all alternatives measured the same way? Returns the set of kinds and
 * a warning when they differ (a model value at one site against a NASA sample at another is not a
 * like-for-like comparison).
 */
export function consistency(datums){
  const kinds=[...new Set(datums.filter(Boolean).map(d=>d.kind))];
  const missing=datums.filter(d=>!d||d.value==null).length;
  return {kinds,mixed:kinds.length>1,missing,ok:kinds.length<=1&&missing===0};
}
