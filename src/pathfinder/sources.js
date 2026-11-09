/**
 * Sources cited by the Base Pathfinder. Every datum's `source` is one of these ids (or a file name
 * for data the user imported). `use` says what we take from each source and how far it supports it.
 */
export const PF_SOURCES=Object.freeze({
  giss:{title:'NASA GISS, Mars lander missions (coordinates of Mars landing sites), via Wikipedia "Octavia E. Butler Landing"',
    url:'https://en.wikipedia.org/wiki/Octavia_E._Butler_Landing',use:'Perseverance landing coordinates 18.44° N, 77.45° E'},
  bradbury:{title:'Bradbury Landing (Curiosity), Wikipedia',url:'https://en.wikipedia.org/wiki/Bradbury_Landing',use:'Curiosity landing coordinates 4.59° S, 137.44° E'},
  zhurong:{title:'Zhurong (rover), Wikipedia',url:'https://en.wikipedia.org/wiki/Zhurong_(rover)',use:'Tianwen-1 / Zhurong landing coordinates 25.07° N, 109.93° E'},
  ez2015:{title:'The Planetary Society (2015), "Mars science and human spaceflight find common ground" — NASA First Landing Site / Exploration Zone workshop',
    url:'https://www.planetary.org/articles/20151029-mars-science-hsf-common-ground',
    use:'Exploration Zones: circular, 200 km wide, within 50° of the equator; ~45 zones pitched (Mawrth Vallis among them); shallow ice stable mainly at mid-latitudes'},
  piqueux2019:{title:'Piqueux et al. (2019), Widespread shallow water ice on Mars at high and mid latitudes, GRL',url:'https://doi.org/10.1029/2019GL083947',
    use:'Ice within ~30 cm of the surface in parts of Arcadia Planitia ("the most tempting target"); MCS, THEMIS, GRS, radar and fresh craters as evidence'},
  swim:{title:'Subsurface Water Ice Mapping (SWIM) project, Planetary Science Institute / JPL — data products',url:'https://swim.psi.edu/SWIM4MIMProducts.php',
    use:'Ice-consistency maps (neutron, thermal, radar, geomorphology), 3 km/pixel GeoTIFF, 60° S–60° N; import with the raster adapter'},
  mola:{title:'MGS MOLA Mission Experiment Gridded Data Records (MEGDR), NASA PDS',url:'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html',
    use:'Global elevation, 128 pixels/degree (≈ 463 m); import to replace the approximate elevations'},
  hirise:{title:'HiRISE digital terrain models (University of Arizona / NASA PDS)',url:'https://www.uahirise.org/dtm/',use:'≈ 1 m elevation models of selected sites; load as the survey terrain (tools/import-dtm.mjs)'},
  factSheet:{title:'NASA Mars Fact Sheet (NSSDCA)',url:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    use:'Surface pressure 6.36 mb at mean radius (4.0–8.7 mb by season), scale height 11.1 km, mean surface gravity 3.73 m/s²'},
  meda:{title:'Sánchez-Lavega et al. (2023), Mars 2020 Perseverance rover studies of the Martian atmosphere over Jezero from pressure measurements, JGR Planets 128; NASA MEDA release (air −83 … −23 °C)',
    url:'https://doi.org/10.1029/2022JE007480',use:'Jezero sol-averaged pressure 625–761 Pa over the seasons, air temperature −83 … −23 °C (model check only)'},
  mars24:{title:'Allison & McEwen (2000), Mars24 solar time algorithm (NASA GISS)',url:'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html',use:'Sun position for the insolation model'},
  appelbaum:{title:'Appelbaum & Flood (1989), Solar radiation on Mars, NASA TM-102299',url:'https://ntrs.nasa.gov/citations/19890018252',use:'Trend of diffuse light with dust optical depth (shape of the diffuse term, assumed)'},
  golombek1997:{title:'Golombek & Rapp (1997), Size-frequency distributions of rocks on Mars and Earth analog sites, JGR',url:'https://doi.org/10.1029/96JE03319',use:'Rock size–frequency model of the simulated terrain'},
  hwangYoon:{title:'Hwang & Yoon (1981), Multiple Attribute Decision Making: Methods and Applications (TOPSIS), Springer',url:'https://doi.org/10.1007/978-3-642-48318-9',use:'TOPSIS method'},
  saaty:{title:'Saaty (1987), The analytic hierarchy process — what it is and how it is used, Mathematical Modelling 9, 161–176',url:'https://doi.org/10.1016/0270-0255(87)90473-8',use:'AHP weights from pairwise comparisons, random index RI, consistency ratio CR < 0.1'},
  photogrammetry:{title:'Normal-case stereo photogrammetry: depth precision σZ = (H/B)·(H/f)·σpx (standard textbook relation, e.g. Kraus, Photogrammetry, de Gruyter)',
    url:null,use:'Depth precision of the simulated survey (pixel matching precision σpx assumed)'},
  ingenuityCam:{title:'NASA/JPL Ingenuity landing press kit — 13-megapixel colour camera',url:'https://www.jpl.nasa.gov/news/press_kits/ingenuity/landing/mission/spacecraft',use:'Pixel count of the standard camera (other camera values assumed)'},
});
export const sourceOf=id=>PF_SOURCES[id]??null;
