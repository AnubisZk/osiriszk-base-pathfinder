/** Ready-made experiments (Phase 6). Each varies one or two factors under otherwise equal conditions. */
export const EXPERIMENTS=Object.freeze({
  frames:{name:'frames',label:{en:'Frame geometry: carbon vs C60 lattice vs hex cell',tr:'Gövde geometrisi: karbon, C60 kafes, altıgen hücre'},
    base:{vehicle:'ingenuity-like',wind:{level:'summer'}},variables:[{key:'frame',values:['carbon','fullerene','hexcell']}],seeds:[1,2,3]},
  density:{name:'density',label:{en:'Air density sweep (Jezero seasons)',tr:'Hava yoğunluğu taraması (Jezero mevsimleri)'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'density',values:[.010,.012,.0145,.0165,.0185,.020]}],seeds:[1]},
  vehicles:{name:'vehicles',label:{en:'Rotor systems on the same mission',tr:'Aynı görevde rotor sistemleri'},
    base:{},variables:[{key:'vehicle',values:['ingenuity-like','osiris-mars-quad','msh-hexa','fpv5']}],seeds:[1,2]},
  payload:{name:'payload',label:{en:'Payload on the OsirisZk quad',tr:'OsirisZk dörtlüsünde yük'},
    base:{vehicle:'osiris-mars-quad'},variables:[{key:'payload',values:[0,.25,.5,1,1.5]}],seeds:[1]},
  wind:{name:'wind',label:{en:'Mars wind levels',tr:'Mars rüzgâr seviyeleri'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'wind',values:['calm','summer','fall','dust-storm']}],seeds:[1,2,3]},
  route:{name:'route',label:{en:'Route length vs energy',tr:'Güzergâh uzunluğu ve enerji'},
    base:{vehicle:'ingenuity-like'},variables:[{key:'route',values:['short','standard','survey']}],seeds:[1]},
  solar:{name:'solar',label:{en:'Dust optical depth vs flights per 10 sols',tr:'Toz optik derinliği ve 10 solda uçuş sayısı'},
    base:{route:'short',waypoints:[{x:0,z:-40,action:'observe',dwell:4,name:'Outcrop A'}]},variables:[{key:'vehicle',values:['ingenuity-like','osiris-mars-quad']},{key:'opticalDepth',values:[.3,.5,1,2,4]}],seeds:[1]},
  panel:{name:'panel',label:{en:'Solar panel area on the OsirisZk quad (τ = 1)',tr:'OsirisZk dörtlüsünde panel alanı (τ = 1)'},
    base:{vehicle:'osiris-mars-quad',opticalDepth:1},variables:[{key:'panelArea',values:[.05,.1,.15,.25,.4]}],seeds:[1]},
  'earth-mars':{name:'earth-mars',label:{en:'Earth vs Mars: same vehicles',tr:'Dünya ve Mars: aynı araçlar'},
    base:{},variables:[{key:'profile',values:['earth-isa','mars-brief']},{key:'vehicle',values:['fpv5','ingenuity-like']}],seeds:[1]},
});

/**
 * Earth-world experiments: the same runner at Ankara (ISA atmosphere, 938 m site, NOAA Sun, core
 * Earth wind levels, procedural Earth terrain). Vehicle, payload and route choices are the team's
 * scenarios; nothing here is Mars-specific.
 */
export const EARTH_BASE=Object.freeze({profile:'earth-isa',site:{lat:39.93,lonEast:32.85},siteElevation:938,
  date:Date.UTC(2026,10,14,8,0,0)/* 11:00 TRT */,vehicle:'fpv5',opticalDepth:.2,
  waypoints:[{x:0,z:-40,action:'observe',dwell:4,name:'Survey point A'},{x:30,z:-60,action:'observe',dwell:4,name:'Survey point B'}]});
const earth=(over)=>({...EARTH_BASE,...over});
export const EARTH_EXPERIMENTS=Object.freeze({
  'earth-vehicles':{name:'earth-vehicles',label:{en:'Rotor systems on Earth (Ankara, 938 m)',tr:'Dünya\'da rotor sistemleri (Ankara, 938 m)'},
    base:earth({}),variables:[{key:'vehicle',values:['fpv5','osiris-mars-quad','ingenuity-like','msh-hexa']}],seeds:[1,2]},
  'earth-payload':{name:'earth-payload',label:{en:'Payload on the 5" quad (Earth)',tr:'5" dörtlüde yük (Dünya)'},
    base:earth({}),variables:[{key:'payload',values:[0,.1,.2,.4,.6]}],seeds:[1]},
  'earth-wind':{name:'earth-wind',label:{en:'Earth wind levels on the 5" quad',tr:'5" dörtlüde Dünya rüzgâr seviyeleri'},
    base:earth({}),variables:[{key:'wind',values:['calm','light','moderate','strong']}],seeds:[1,2,3]},
  'earth-frames':{name:'earth-frames',label:{en:'Frame geometry on the 5" quad (Earth)',tr:'5" dörtlüde gövde geometrisi (Dünya)'},
    base:earth({}),variables:[{key:'frame',values:['carbon','fullerene','hexcell']}],seeds:[1,2]},
  'earth-route':{name:'earth-route',label:{en:'Route length vs energy (Earth)',tr:'Güzergâh uzunluğu ve enerji (Dünya)'},
    base:earth({}),variables:[{key:'route',values:['short','standard','survey']}],seeds:[1]},
});
