import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MarsScene,followCamera} from '../render/scene.js';
import {createVehicleModel} from '../render/vehicleModel.js';
import {buildVehicle} from '../../src/vehicles/build.js';
import {sunPosition} from '../../src/mars/time.js';
import {siteTerrain,utcForLocalTime,deriveVehicle} from '../../src/pathfinder/index.js';

/**
 * 3D view of one candidate site: its (synthetic) survey terrain, the planned route, the drone,
 * the photo footprints and the photogrammetric safety map, and a replay of a flown survey from
 * its recorded track. Draws only; the flights themselves run in the worker.
 */
const D2R=Math.PI/180;
export class SiteView {
  constructor(canvas,{onHud=()=>{}}={}){
    this.canvas=canvas;this.onHud=onHud;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.camera=new THREE.PerspectiveCamera(55,1,.1,4000);this.camera.position.set(70,60,80);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.maxPolarAngle=Math.PI*.49;this.controls.maxDistance=320;
    this.terrains=new Map();this.world=null;this.overlay=new THREE.Group();this.model=null;this.replayState=null;
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    let last=performance.now();
    const loop=now=>{const dt=Math.min(.1,(now-last)/1000);last=now;this.tick(dt);requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  resize(){const w=this.canvas.clientWidth||800,h=this.canvas.clientHeight||600;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  terrainFor(site){
    const key=`${site.id}:${JSON.stringify(site.terrain)}`;
    if(!this.terrains.has(key))this.terrains.set(key,siteTerrain(site));
    return this.terrains.get(key);
  }
  /** Show a site (terrain, sky at the survey's local time). */
  showSite(site,quality='medium'){
    const terrain=this.terrainFor(site);this.site=site;
    if(!this.world){this.world=new MarsScene(this.renderer,terrain,quality,'mars');this.world.scene.add(this.overlay);}
    else if(this.world.terrain!==terrain)this.world.setTerrain(terrain);
    const lat=site.data.latitude.value,lon=site.data.longitude.value,sun=sunPosition(utcForLocalTime(lon,11),lat,lon);
    this.world.setSky(sun,site.data.dust.value);
    const h0=terrain.heightAt(0,0);this.ground0=h0;this.controls.target.set(0,h0+4,0);
    this.overlay.clear();this.route=null;this.stopReplay();
    if(this.model)this.placeModelAtHome();
  }
  /** The drone model for a design (rebuilt when the design changes). */
  setDrone(design){
    const id=deriveVehicle(design),key=`${id}:${design.frame}`;if(this.modelKey===key)return;
    if(this.model){this.world?.scene.remove(this.model.group);this.model.dispose();}
    this.built=buildVehicle(id,{frame:design.frame});this.model=createVehicleModel(this.built);this.modelKey=key;
    if(this.world){this.world.scene.add(this.model.group);this.placeModelAtHome();}
  }
  placeModelAtHome(){
    if(!this.model||!this.world)return;if(!this.model.group.parent)this.world.scene.add(this.model.group);
    const T=this.world.terrain,y=T.heightAt(0,0)-Math.min(...this.built.feet.map(f=>f[1]))+.03;
    this.model.group.position.set(0,y,0);this.model.group.quaternion.identity();
  }
  /** Planned route: survey square on the ground and the flight path at survey height. */
  setRoute(plan){
    this.overlay.clear();const T=this.world.terrain,half=plan.area/2,lift=.15;
    const outline=[];for(let k=0;k<=64;k++){const s=k/16,side=Math.floor(s),f=s-side,c=[[-half,-half],[half,-half],[half,half],[-half,half],[-half,-half]];
      const a=c[side%4],b=c[(side+1)%4]??c[0];const x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;outline.push(new THREE.Vector3(x,T.heightAt(x,z)+lift,z));}
    this.overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline),new THREE.LineBasicMaterial({color:'#ffd166'})));
    const pts=[[0,0],...plan.waypoints.map(w=>[w.x,w.z]),[0,0]],path=[];
    for(let i=1;i<pts.length;i++){const [x0,z0]=pts[i-1],[x1,z1]=pts[i],n=Math.max(2,Math.ceil(Math.hypot(x1-x0,z1-z0)/2));
      for(let k=0;k<=n;k++){const x=x0+(x1-x0)*k/n,z=z0+(z1-z0)*k/n;path.push(new THREE.Vector3(x,T.heightAt(x,z)+plan.altitude,z));}}
    this.overlay.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),new THREE.LineBasicMaterial({color:'#7ef0ff',transparent:true,opacity:.75})));
    const home=new THREE.Mesh(new THREE.TorusGeometry(1.4,.07,6,32),new THREE.MeshBasicMaterial({color:'#ffd166'}));home.rotation.x=-Math.PI/2;home.position.set(0,T.heightAt(0,0)+.06,0);this.overlay.add(home);
    this.route=plan;
  }
  /** Photo footprints (revealed during a replay) and the safety map from the analysis. */
  setSurvey(survey,{showSafety=true}={}){
    if(this.route)this.setRoute(this.route);else this.overlay.clear();
    const T=this.world.terrain,ph=survey.photos,pos=new Float32Array(ph.length*24);
    ph.forEach((p,i)=>{const a=p.across/2,b=p.along/2,c=[[p.x-a,p.z-b],[p.x+a,p.z-b],[p.x+a,p.z+b],[p.x-a,p.z+b]];
      for(let e=0;e<4;e++){const [x0,z0]=c[e],[x1,z1]=c[(e+1)%4];pos.set([x0,T.heightAt(x0,z0)+.25,z0,x1,T.heightAt(x1,z1)+.25,z1],i*24+e*6);}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    this.footprints=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:showSafety?.1:.22,depthWrite:false}));this.overlay.add(this.footprints);
    this.photoTimes=ph.map(p=>p.t);
    if(showSafety&&survey.analysis?.grid)this.overlay.add(this.safetyMesh(survey.analysis.grid));
  }
  safetyMesh(grid){
    const {n,cell}=grid,half=n*cell/2,T=this.world.terrain,data=new Uint8Array(n*n*4);
    const col={1:[70,210,120,95],2:[255,170,60,150],3:[255,70,70,190]};
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const s=grid.state[i+j*n],c=col[s];if(!c)continue;const k=(i+(n-1-j)*n)*4;data.set(c,k);}
    const tex=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);tex.magFilter=THREE.NearestFilter;tex.needsUpdate=true;
    const seg=Math.min(160,n),geo=new THREE.PlaneGeometry(2*half,2*half,seg,seg);geo.rotateX(-Math.PI/2);
    const P=geo.attributes.position;for(let k=0;k<P.count;k++){const x=P.getX(k),z=P.getZ(k);P.setY(k,T.heightAt(x,z)+.12);}
    geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.renderOrder=2;return m;
  }
  /** Replay a recorded track: rows [t, x, y, z, roll, pitch, yaw, rpm, soc, power, agl]. */
  replay(track,{speed=4}={}){
    if(!track?.length)return;this.replayState={track,t:0,i:0,speed,playing:true};if(this.footprints)this.footprints.geometry.setDrawRange(0,0);
    // chase view: start close behind the drone, then follow it (the user can still orbit and zoom)
    const p=new THREE.Vector3(track[0][1],track[0][2],track[0][3]);this.controls.target.copy(p);this.camera.position.copy(p).add(new THREE.Vector3(14,9,18));
  }
  stopReplay(){this.replayState=null;}
  togglePlay(){if(this.replayState)this.replayState.playing=!this.replayState.playing;return this.replayState?.playing;}
  setSpeed(v){if(this.replayState)this.replayState.speed=v;}
  tick(dt){
    if(!this.world)return;
    const R=this.replayState;
    if(R&&this.model){
      const tr=R.track,end=tr[tr.length-1][0];if(R.playing)R.t=Math.min(end,R.t+dt*R.speed);
      while(R.i<tr.length-2&&tr[R.i+1][0]<=R.t)R.i++;while(R.i>0&&tr[R.i][0]>R.t)R.i--;
      const a=tr[R.i],b=tr[Math.min(tr.length-1,R.i+1)],u=b[0]>a[0]?Math.max(0,Math.min(1,(R.t-a[0])/(b[0]-a[0]))):0;
      const qa=new THREE.Quaternion().setFromEuler(new THREE.Euler(a[5]*D2R,a[6]*D2R,a[4]*D2R,'YXZ')),qb=new THREE.Quaternion().setFromEuler(new THREE.Euler(b[5]*D2R,b[6]*D2R,b[4]*D2R,'YXZ'));
      const g=this.model.group;g.position.set(a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u);g.quaternion.copy(qa).slerp(qb,u);
      const omega=(a[7]+(b[7]-a[7])*u)*2*Math.PI/60;this.model.update({rotors:this.model.rotors.map(()=>({motor:{omega}}))},dt*Math.min(R.speed,4));
      if(this.footprints&&this.photoTimes){let k=0;while(k<this.photoTimes.length&&this.photoTimes[k]<=R.t)k++;this.footprints.geometry.setDrawRange(0,k*8);}
      const before=this.controls.target.clone();this.controls.target.lerp(g.position,.15);this.camera.position.add(this.controls.target.clone().sub(before));
      this.world.sun.target.position.copy(g.position);this.world.sun.position.copy(g.position).addScaledVector(this.world.sunDir,200);
      this.onHud({t:R.t,end,agl:a[10],soc:a[8],power:a[9],photos:this.photoTimes?this.photoTimes.filter(x=>x<=R.t).length:0,playing:R.playing});
    }
    this.controls.update();followCamera(this.world,this.camera);this.renderer.render(this.world.scene,this.camera);
  }
}
