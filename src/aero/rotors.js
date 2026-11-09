import {defineRotor} from './rotor.js';

/**
 * Rotor and propeller definitions. Each geometry value carries its status in `notes`.
 */
export const ROTOR_SOURCES=Object.freeze({
  nasaGeometry:{title:'Koning et al., Ingenuity Mars Helicopter rotor geometry, NASA TM (2024), Tables 1–2',url:'https://ntrs.nasa.gov/api/citations/20240001510/downloads/1699_Koning_TM_082124.pdf'},
  nasaMarsHeliCapabilities:{title:'NASA Ames, Mars helicopter capabilities (Ingenuity and Mars Science Helicopter), Tables 1–2',url:'https://rotorcraft.arc.nasa.gov/Publications/files/MarsHeliCapabilities_Final_Update.pdf'},
  jplPressKit:{title:'NASA/JPL Ingenuity landing press kit – spacecraft',url:'https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft'},
});

export const ROTORS=Object.freeze({
  // Ingenuity-class rotor. Radius 0.605 m, 2 blades, rotor spacing 0.099 m, twist 16.3° (0.09R),
  // 17.6° (0.2R) to 0° at the tip, chord peak c/R 0.2021 at 0.3429R, tip c/R 0.0123 (NASA TM 2024).
  // Inner chord points and the straight twist line between 0.2R and the tip are assumed.
  ingenuity:defineRotor({
    id:'ingenuity',label:{en:'Ingenuity-class Mars rotor',tr:'Ingenuity sınıfı Mars rotoru'},
    radius:.605,blades:2,root:.0908,airfoil:'clf5605-like',stations:14,
    // Assumed chord points chosen so that 4-blade area ≈ 0.18 m² (NASA: 0.170) and thrust-weighted
    // solidity per rotor ≈ 0.073 (NASA σ 0.148 for the coaxial pair)
    chord:[[.0908,.07],[.2,.14],[.3429,.2021],[.6,.16],[.85,.105],[.95,.06],[1,.0123]],
    twist:[[.0908,16.316],[.2,17.616],[1,0]],
    inertia:.009, // kg·m² per rotor about the shaft (assumed: two ~35 g blades + hub)
    spacing:.099, // m between upper and lower rotor (sourced)
    notes:{radius:'sourced',blades:'sourced',spacing:'sourced',twist:'sourced endpoints, assumed linear between',chord:'sourced peak and tip, assumed inner points',inertia:'assumed'},
    source:'nasaGeometry',
  }),
  // Mars Science Helicopter hexacopter rotor: R 0.64 m, 6 blades, σ 0.25 (NASA Ames Table 2).
  // Chord follows σ with an assumed mild taper; twist assumed like Ingenuity's outer blade.
  msh:defineRotor({
    id:'msh',label:{en:'Mars Science Helicopter rotor (6 blades)',tr:'Mars Bilim Helikopteri rotoru (6 pal)'},
    radius:.64,blades:6,root:.1,airfoil:'clf5605-like',stations:12,
    chord:[[.1,.155],[1,.105]],twist:[[.1,17],[1,0]],inertia:.012,
    pitchOffset:4, // fixed blade pitch setting (deg) so hover needs ≈ 80 % of maximum rpm at ρ 0.020 (assumed design choice)
    notes:{radius:'sourced',blades:'sourced',chord:'assumed taper matching σ ≈ 0.25',twist:'assumed',inertia:'assumed'},
    source:'nasaMarsHeliCapabilities',
  }),
  // OsirisZk Mars quad concept rotor (hypothetical design study).
  'osiris-mars':defineRotor({
    id:'osiris-mars',label:{en:'OsirisZk Mars quad rotor (concept)',tr:'OsirisZk Mars dörtlü rotoru (kavram)'},
    radius:.5,blades:3,root:.12,airfoil:'clf5605-like',stations:12,
    chord:[[.12,.13],[.35,.16],[1,.05]],twist:[[.12,18],[1,2]],inertia:.004,pitchOffset:4,
    notes:{all:'assumed (team concept)'},source:null,
  }),
  // Standard 5-inch FPV propeller: D 0.127 m, pitch 4.3 in, 3 blades (typical; values assumed).
  fpv5:defineRotor({
    id:'fpv5',label:{en:'5-inch FPV propeller (5×4.3×3)',tr:'5 inç FPV pervanesi (5×4,3×3)'},
    radius:.0635,blades:3,root:.18,airfoil:'thin-cambered-prop',stations:10,pitch:.109,
    chord:[[.18,.17],[.45,.22],[1,.1]],inertia:6e-6,
    notes:{all:'assumed typical 5×4.3×3 propeller'},source:null,
  }),
});
// Derived rotors (scaled copies of a preset, registered at run time); presets stay frozen.
const DERIVED=new Map();
export function registerRotor(rotor){
  if(!rotor?.id||ROTORS[rotor.id])throw new RangeError(`A derived rotor needs a new id (got '${rotor?.id}')`);
  DERIVED.set(rotor.id,rotor);return rotor.id;
}
export const getRotor=id=>{const r=ROTORS[id]??DERIVED.get(id);if(!r)throw new RangeError(`Unknown rotor '${id}'`);return r;};
