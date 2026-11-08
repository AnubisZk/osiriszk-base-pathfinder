/**
 * Mars terrain for physics and rendering: a regular height grid (also the Rapier heightfield),
 * crater and rock lists, and the provenance of the data.
 *
 *  - ProceduralTerrain: seeded synthetic terrain. NOT NASA data and always labelled as such.
 *    Craters follow a power-law size–frequency distribution (shape assumed); rock sizes follow the
 *    Golombek & Rapp (1997) Mars rock-abundance model, F_k(D) = k e^(−q D), q = 1.79 + 0.152 / k.
 *  - HeightmapTerrain: a real digital terrain model (e.g. a HiRISE DTM of Jezero converted with
 *    tools/import-dtm.mjs), with its source and licence carried in `meta`.
 * Coordinates: x east, z south (north = −Z), y up, metres; grid centred on (0, 0).
 */
export const TERRAIN_SOURCES=Object.freeze({
  golombek1997:{title:'Golombek & Rapp (1997), Size-frequency distributions of rocks on Mars and Earth analog sites, JGR 102(E2)',url:'https://doi.org/10.1029/96JE03319'},
  hirise:{title:'HiRISE Digital Terrain Models (University of Arizona / NASA PDS)',url:'https://www.uahirise.org/dtm/'},
});

export function mulberry32(a){return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

class GridTerrain {
  /** heights: Float32Array of (nx+1)·(nz+1), index i + j·(nx+1) with i along x, j along z. */
  constructor(nx,nz,size,heights,meta){
    this.nx=nx;this.nz=nz;this.size=size;this.heights=heights;this.meta=meta;
    this.cell=[size[0]/nx,size[1]/nz];this.craters=[];this.rocks=[];
    let lo=Infinity,hi=-Infinity;for(const h of heights){if(h<lo)lo=h;if(h>hi)hi=h;}this.minHeight=lo;this.maxHeight=hi;
  }
  /** Bilinear height at (x, z); identical to the triangulated surface along grid lines. */
  heightAt(x,z){
    const fx=(x/this.size[0]+.5)*this.nx,fz=(z/this.size[1]+.5)*this.nz;
    const i=Math.max(0,Math.min(this.nx-1,Math.floor(fx))),j=Math.max(0,Math.min(this.nz-1,Math.floor(fz)));
    const u=Math.max(0,Math.min(1,fx-i)),v=Math.max(0,Math.min(1,fz-j)),W=this.nx+1,H=this.heights;
    const h00=H[i+j*W],h10=H[i+1+j*W],h01=H[i+(j+1)*W],h11=H[i+1+(j+1)*W];
    return (1-u)*(1-v)*h00+u*(1-v)*h10+(1-u)*v*h01+u*v*h11;
  }
  normalAt(x,z,d=.5){const hx=this.heightAt(x+d,z)-this.heightAt(x-d,z),hz=this.heightAt(x,z+d)-this.heightAt(x,z-d);const n=[-hx/(2*d),1,-hz/(2*d)],l=Math.hypot(...n);return n.map(v=>v/l);}
  /** Heights in Rapier's heightfield order (column-major: index = i·(nz+1) + j). */
  rapierHeights(){
    const W=this.nx+1,Hn=this.nz+1,out=new Float32Array(W*Hn);
    for(let i=0;i<W;i++)for(let j=0;j<Hn;j++)out[i*Hn+j]=this.heights[i+j*W];
    return out;
  }
  /** Add the terrain (and optionally rock colliders) to a PlanetPhysics world. */
  addToPhysics(physics,{rockColliders=true,minRock=.35,maxRocks=600}={}){
    physics.addHeightfield(this.nx,this.nz,this.rapierHeights(),this.size);
    if(rockColliders){let n=0;for(const r of this.rocks){if(r.d<minRock)continue;if(n++>=maxRocks)break;physics.addBall([r.x,r.y+r.d*.15,r.z],r.d*.42);}}
  }
}

export class HeightmapTerrain extends GridTerrain {
  /** meta: {source, title, url, license, credit, cellSize, ...}; heights already in metres. */
  constructor(nx,nz,size,heights,meta){
    if(!meta?.source||meta.source==='procedural')throw new RangeError('HeightmapTerrain needs the real data source in meta.source');
    super(nx,nz,size,heights,{...meta,procedural:false});
  }
}

/** Earth defaults: rolling steppe-like hills, no craters, sparse rocks (all assumed, illustrative). */
export const EARTH_TERRAIN=Object.freeze({relief:16,craterDensity:0,rockAbundance:.01,maxRocks:1500});

export class ProceduralTerrain extends GridTerrain {
  /**
   * opts: {planet 'mars'|'earth', seed, size [m, m], cells [nx, nz], relief (m), craterDensity (craters ≥ 10 m
   *        per km²), rockAbundance k (fraction of area covered by rocks), rockArea (m) half-size for rocks}
   * Earth uses EARTH_TERRAIN as defaults; Mars keeps the original defaults.
   */
  constructor(opts={}){
    const planet=opts.planet==='earth'?'earth':'mars';
    const {seed=2026,size=[1200,1200],cells=[256,256],relief=6,craterDensity=60,rockAbundance=.08,rockArea=250,maxRocks=6000}={...(planet==='earth'?EARTH_TERRAIN:{}),...opts};
    const [nx,nz]=cells,rand=mulberry32(seed),W=nx+1,heights=new Float32Array(W*(nz+1));
    // value-noise octaves (smooth lattice noise)
    const lattice=[];for(let o=0;o<5;o++){const n=4<<o,g=new Float32Array((n+1)*(n+1));for(let k=0;k<g.length;k++)g[k]=rand()*2-1;lattice.push({n,g});}
    const noise=(x,z)=>{let s=0,amp=1;for(const {n,g} of lattice){const fx=(x/size[0]+.5)*n,fz=(z/size[1]+.5)*n,i=Math.min(n-1,Math.max(0,Math.floor(fx))),j=Math.min(n-1,Math.max(0,Math.floor(fz)));
      let u=fx-i,v=fz-j;u=u*u*(3-2*u);v=v*v*(3-2*v);const a=g[i+j*(n+1)],b=g[i+1+j*(n+1)],c=g[i+(j+1)*(n+1)],d=g[i+1+(j+1)*(n+1)];
      s+=amp*((1-u)*(1-v)*a+u*(1-v)*b+(1-u)*v*c+u*v*d);amp*=.5;}return s;};
    // craters: cumulative N(>D) ∝ D^−2 between 10 m and 160 m (shape assumed)
    const area=size[0]*size[1]/1e6,count=Math.round(craterDensity*area),craters=[];
    for(let k=0;k<count;k++){
      const D=10/Math.sqrt(1-rand()*(1-(10/160)**2));
      craters.push({x:(rand()-.5)*size[0],z:(rand()-.5)*size[1],D,depth:.2*D*(.6+.4*rand()),rim:.04*D,age:rand()});
    }
    const craterAt=(x,z)=>{let h=0;for(const c of craters){const dx=x-c.x,dz=z-c.z,r=Math.hypot(dx,dz)/(c.D/2);if(r>2.2)continue;
      const fresh=1-.6*c.age;
      if(r<1)h+=fresh*(c.depth*(r*r-1)+c.rim*r**4);else h+=fresh*c.rim*Math.exp(-(((r-1)/.35)**2))*(r<1.6?1:Math.exp(-(r-1.6)*2));}return h;};
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const x=(i/nx-.5)*size[0],z=(j/nz-.5)*size[1];
      heights[i+j*W]=relief*noise(x,z)+craterAt(x,z);
    }
    super(nx,nz,size,heights,{source:'procedural',procedural:true,seed,planet,
      label:planet==='earth'?{en:'Procedural Earth terrain — illustrative, NOT survey or map data',tr:'Prosedürel Dünya arazisi — temsilî, harita/ölçüm verisi DEĞİL'}
        :{en:'Procedural terrain — illustrative, NOT NASA data',tr:'Prosedürel arazi — temsilî, NASA verisi DEĞİL'},
      method:planet==='earth'?'value-noise rolling hills (assumed), sparse rocks from the Golombek & Rapp model (fit to Mars and Earth analog sites)'
        :'value-noise relief, power-law crater field (assumed), Golombek & Rapp rock-size model',sources:['golombek1997'],
      rockAbundance,craterDensity});
    this.craters=craters;
    // rocks (Golombek & Rapp 1997): cumulative area fraction F(D) = k e^(−qD); sample D ≥ 0.15 m
    const q=1.79+.152/rockAbundance,Dmin=.15,Dmax=2.5,fracArea=rockAbundance*(Math.exp(-q*Dmin)-Math.exp(-q*Dmax));
    const meanArea=(()=>{let s=0,n=0;for(let k=0;k<2000;k++){const D=-Math.log(Math.exp(-q*Dmin)-rand()*(Math.exp(-q*Dmin)-Math.exp(-q*Dmax)))/q;s+=Math.PI*D*D/4;n++;}return s/n;})();
    // number of rocks such that their summed footprint equals the model's area fraction
    const rockN=Math.min(maxRocks,Math.round(fracArea*(2*rockArea)**2/meanArea));
    for(let k=0;k<rockN;k++){
      // size drawn ∝ area-weighted distribution → number-weighted by dividing by D² (rejection)
      let D;do{D=-Math.log(Math.exp(-q*Dmin)-rand()*(Math.exp(-q*Dmin)-Math.exp(-q*Dmax)))/q;}while(rand()>(Dmin/D)**2);
      const x=(rand()-.5)*2*rockArea,z=(rand()-.5)*2*rockArea;
      this.rocks.push({x,z,y:this.heightAt(x,z),d:D,rot:rand()*Math.PI*2,shape:Math.floor(rand()*4)});
    }
    this.rocks.sort((a,b)=>b.d-a.d);
  }
}
