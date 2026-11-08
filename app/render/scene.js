import * as THREE from 'three';

/**
 * Planet scene: terrain mesh (from the physics height grid), instanced rocks, sky and fog from
 * optical depth, Sun (Mars24 on Mars, NOAA on Earth) with Beer–Lambert attenuation, one shadow map
 * that follows the vehicle. Draws only; never touches physics. Quality presets trade detail for
 * frame time; palettes give the Mars and Earth looks (colours are illustrative).
 */
export const QUALITY={
  low:{pixelRatio:.75,shadows:false,rocks:1500,shadowSize:1024,antialias:false},
  medium:{pixelRatio:1,shadows:true,rocks:3500,shadowSize:1024,antialias:true},
  high:{pixelRatio:Math.min(2,globalThis.devicePixelRatio||1),shadows:true,rocks:6000,shadowSize:2048,antialias:true},
};

export const PALETTES={
  mars:{id:'mars',sunColor:'#fff1dd',skyLight:'#d9b38c',groundLight:'#6b3c22',fog:'#c9a37f',beamRef:590,rock:'#8a5d42',
    detailTint:[1,.93,.86],speck:[[80,60],[50,30],[30,20]],dust:'#c08a62'},
  earth:{id:'earth',sunColor:'#fff6ea',skyLight:'#b9d4f2',groundLight:'#4b4a2c',fog:'#c9d9ea',beamRef:1000,rock:'#8d8a84',
    detailTint:[.97,1,.9],speck:[[60,50],[70,40],[30,20]],dust:'#9c8b6e'},
};

function detailTexture(P){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),img=g.createImageData(256,256),[tr,tg,tb]=P.detailTint,[sr,sg,sb]=P.speck;
  let s=1234567;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<256*256;i++){const v=200+r()*55;img.data[i*4]=v*tr;img.data[i*4+1]=v*tg;img.data[i*4+2]=v*tb;img.data[i*4+3]=255;}
  g.putImageData(img,0,0);for(let k=0;k<900;k++){g.fillStyle=`rgba(${sr[0]+r()*sr[1]},${sg[0]+r()*sg[1]},${sb[0]+r()*sb[1]},${.08+r()*.15})`;g.beginPath();g.arc(r()*256,r()*256,.5+r()*2.5,0,7);g.fill();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

function detailNormal(){
  // tiled normal map from a two-octave value-noise height field (visual micro-relief only)
  const N=256,h=new Float32Array(N*N);let s=97531;const r=()=>(s=(s*16807)%2147483647)/2147483647;
  for(const [cell,amp] of [[32,1],[8,.45],[4,.2]]){const n=N/cell,g=new Float32Array((n+1)*(n+1)).map(()=>r());
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const fx=x/cell,fy=y/cell,i=Math.floor(fx),j=Math.floor(fy);let u=fx-i,v=fy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);
      const a=g[(i%n)+(j%n)*(n+1)],b=g[((i+1)%n)+(j%n)*(n+1)],c=g[(i%n)+((j+1)%n)*(n+1)],d=g[((i+1)%n)+((j+1)%n)*(n+1)];
      h[x+y*N]+=amp*((1-u)*(1-v)*a+u*(1-v)*b+(1-u)*v*c+u*v*d);}}
  const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const dx=(h[((x+1)%N)+y*N]-h[((x+N-1)%N)+y*N])*3,dy=(h[x+((y+1)%N)*N]-h[x+((y+N-1)%N)*N])*3,l=Math.hypot(dx,dy,1),k=(x+y*N)*4;
    img.data[k]=(-dx/l*.5+.5)*255;img.data[k+1]=(-dy/l*.5+.5)*255;img.data[k+2]=(1/l*.5+.5)*255;img.data[k+3]=255;}
  g.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}
function sunTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,250,240,1)');gr.addColorStop(.12,'rgba(255,244,225,1)');gr.addColorStop(.22,'rgba(220,225,255,.35)');gr.addColorStop(1,'rgba(200,210,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export class MarsScene {
  constructor(renderer,terrain,quality='medium',palette='mars'){
    const P=this.palette=PALETTES[palette]??PALETTES.mars;
    this.renderer=renderer;this.scene=new THREE.Scene();this.terrain=terrain;
    this.sun=new THREE.DirectionalLight(P.sunColor,2.4);this.sun.castShadow=true;this.scene.add(this.sun,this.sun.target);
    this.sky=new THREE.HemisphereLight(P.skyLight,P.groundLight,.55);this.scene.add(this.sky);
    this.scene.fog=new THREE.FogExp2(P.fog,.0016);
    const dome=new THREE.SphereGeometry(1800,48,24);dome.setAttribute('color',new THREE.BufferAttribute(new Float32Array(dome.attributes.position.count*3),3));
    this.dome=new THREE.Mesh(dome,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));this.dome.renderOrder=-1;this.scene.add(this.dome);
    this.sunSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTexture(),fog:false,depthWrite:false,transparent:true}));this.sunSprite.scale.setScalar(140);this.scene.add(this.sunSprite);
    this.sunDir=new THREE.Vector3(0,1,0);
    this.buildTerrain();this.setQuality(quality);this.markers=new THREE.Group();this.scene.add(this.markers);
  }
  buildTerrain(){
    const T=this.terrain,W=T.nx+1,geo=new THREE.PlaneGeometry(T.size[0],T.size[1],T.nx,T.nz);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,col=new Float32Array(pos.count*3);
    for(let k=0;k<pos.count;k++){
      const x=pos.getX(k),z=pos.getZ(k),i=Math.round((x/T.size[0]+.5)*T.nx),j=Math.round((z/T.size[1]+.5)*T.nz),h=T.heights[i+j*W];
      pos.setY(k,h);
    }
    geo.computeVertexNormals();
    const nrm=geo.attributes.normal;
    for(let k=0;k<pos.count;k++){
      const slope=1-nrm.getY(k),h=pos.getY(k),x=pos.getX(k),z=pos.getZ(k);
      const n=.5+.5*Math.sin(x*.05+Math.cos(z*.021)*2)*Math.cos(z*.043+Math.sin(x*.017)*2),m=.5+.5*Math.sin(x*.31)*Math.sin(z*.27);
      const dust=Math.max(0,Math.min(1,1-slope*6))*(.6+.4*n),rock=Math.min(1,slope*5);
      if(this.palette.id==='earth'){
        // late-autumn steppe: dry grass with greener patches in hollows, bare soil on slopes (illustrative)
        const green=Math.max(0,Math.min(1,.55*n+.35*m-.02*h)),flat=Math.max(0,Math.min(1,1-slope*5));
        col[k*3]=(.44-.12*green)*flat+.42*(1-flat)+.02*m;col[k*3+1]=(.42-.02*green)*flat+.36*(1-flat)+.02*m;col[k*3+2]=(.24-.06*green)*flat+.29*(1-flat)+.01*m;
        continue;
      }
      const r=.50+.16*dust-.10*rock+.03*m+.003*h,g=.30+.09*dust-.07*rock+.02*m+.0015*h,b=.19+.04*dust-.04*rock+.01*m;
      col[k*3]=r;col[k*3+1]=g;col[k*3+2]=b;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    const tex=detailTexture(this.palette);tex.repeat.set(T.size[0]/6,T.size[1]/6);
    const detail=detailNormal();detail.repeat.set(T.size[0]/9,T.size[1]/9);
    this.ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:tex,normalMap:detail,normalScale:new THREE.Vector2(.9,.9),roughness:.95,metalness:0}));
    this.ground.receiveShadow=true;this.scene.add(this.ground);
  }
  buildRocks(count){
    if(this.rockMeshes)for(const m of this.rockMeshes){this.scene.remove(m);m.geometry.dispose();}
    const rocks=this.terrain.rocks.slice(0,count),shapes=[0,1,2,3].map(s=>{
      const g=new THREE.IcosahedronGeometry(.5,1),p=g.attributes.position;let seed=s*97+13;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
      for(let k=0;k<p.count;k++){const f=.75+.4*r();p.setXYZ(k,p.getX(k)*f,p.getY(k)*f*.7,p.getZ(k)*f);}g.computeVertexNormals();return g;});
    const mat=new THREE.MeshStandardMaterial({color:this.palette.rock,roughness:.88,flatShading:true}),earth=this.palette.id==='earth',m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
    this.rockMeshes=shapes.map((g,s)=>{
      const list=rocks.filter(r=>r.shape===s),mesh=new THREE.InstancedMesh(g,mat,list.length);
      const col=new THREE.Color();
      list.forEach((r,i)=>{e.set(0,r.rot,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(r.x,r.y+r.d*.12,r.z),q,new THREE.Vector3(r.d,r.d*(.7+.3*((i*7)%10)/10),r.d));mesh.setMatrixAt(i,m4);
        const k=((i*2654435761)>>>0)/4294967296;if(earth)col.setRGB(.62+.3*k,.6+.28*k,.57+.25*k);else col.setRGB(.55+.35*k,.42+.2*k,.36+.12*k);mesh.setColorAt(i,col);});
      mesh.castShadow=this.quality.shadows;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
    });
  }
  setQuality(name){
    this.qualityName=name;this.quality=QUALITY[name];
    this.renderer.setPixelRatio(this.quality.pixelRatio);this.renderer.shadowMap.enabled=this.quality.shadows;
    this.sun.castShadow=this.quality.shadows;this.sun.shadow.mapSize.set(this.quality.shadowSize,this.quality.shadowSize);
    this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
    this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.03;const cam=this.sun.shadow.camera;cam.left=cam.bottom=-30;cam.right=cam.top=30;cam.near=1;cam.far=400;cam.updateProjectionMatrix();
    this.buildRocks(this.quality.rocks);
  }
  /**
   * Sky, fog and sunlight from the Sun's elevation/azimuth and dust optical depth τ.
   * Direct beam ∝ TOA irradiance · exp(−τ / cos Z) (Beer–Lambert); colours are illustrative.
   */
  setSky(sun,tau){
    const el=sun.elevation*Math.PI/180,az=sun.azimuth*Math.PI/180,up=Math.max(.02,Math.sin(el));
    const beam=Math.max(0,sun.irradianceTOA*Math.exp(-tau/up))*(el>0?1:0);
    this.sun.intensity=2.6*beam/this.palette.beamRef;this.sun.position.set(Math.sin(az)*Math.cos(el)*200,Math.sin(el)*200,-Math.cos(az)*Math.cos(el)*200);
    const day=Math.max(0,Math.min(1,el/(10*Math.PI/180)+.15)),dusty=Math.min(1,tau/2);
    if(this.palette.id==='earth')return this.setEarthSky(el,az,tau,day,beam);
    const sky=new THREE.Color().setRGB(.78*day+.06,.6*day+.05,.45*day+.09).lerp(new THREE.Color('#b0896a'),dusty*.4*day);
    this.sunDir.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).normalize();
    // Sky dome (illustrative colours): butterscotch dusty sky, darker toward the zenith, a cool halo
    // around the Sun from forward scattering by dust (the blue Mars sunset when the Sun is low)
    const P=this.dome.geometry.attributes.position,C=this.dome.geometry.attributes.color,v=new THREE.Vector3(),zen=sky.clone().multiplyScalar(.62),hor=sky.clone().lerp(new THREE.Color('#e8c39c'),.25*day),halo=new THREE.Color('#9fb6d8'),c=new THREE.Color();
    for(let k=0;k<P.count;k++){v.fromBufferAttribute(P,k).normalize();const up=Math.max(0,v.y),cs=v.dot(this.sunDir),near=Math.max(0,cs)**12*(.25+.75*(1-Math.min(1,el*3)))*day;
      c.copy(hor).lerp(zen,Math.pow(up,.6)).lerp(halo,Math.min(.85,near*.9));if(v.y<0)c.copy(hor).multiplyScalar(.85);C.setXYZ(k,c.r,c.g,c.b);}
    C.needsUpdate=true;this.scene.background=null;
    this.sunSprite.visible=el>-.02;this.sunSprite.material.opacity=Math.max(.15,Math.exp(-tau/Math.max(.08,Math.sin(el))));
    this.scene.fog.color.copy(hor);this.scene.fog.density=.0006+.0018*tau;
    this.sky.intensity=.3+.7*day*(.5+.5*Math.min(1,tau)); // night: faint ambient so the scene stays readable
    this.sky.color.copy(sky).lerp(new THREE.Color(this.palette.skyLight),.5);
    this.sunInfo={beam,tau};
  }
  /** Earth: Rayleigh-blue sky, white haze toward the horizon, warm low Sun (illustrative colours). */
  setEarthSky(el,az,tau,day,beam){
    this.sunDir.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).normalize();
    const hazy=Math.min(1,tau/1.2),low=Math.max(0,1-Math.abs(el)/(12*Math.PI/180)); // 1 near sunrise/sunset
    const zen=new THREE.Color().setRGB(.006,.01,.03).lerp(new THREE.Color('#2f6fd0'),day).lerp(new THREE.Color('#8fa7c4'),hazy*.5*day);
    const hor=new THREE.Color().setRGB(.014,.02,.04).lerp(new THREE.Color('#cfe2f5'),day).lerp(new THREE.Color('#e6e6e2'),hazy*.5*day);
    const glow=new THREE.Color('#fff3d6').lerp(new THREE.Color('#ff9d5c'),low),c=new THREE.Color(),v=new THREE.Vector3();
    const P=this.dome.geometry.attributes.position,C=this.dome.geometry.attributes.color;
    for(let k=0;k<P.count;k++){v.fromBufferAttribute(P,k).normalize();const up=Math.max(0,v.y),cs=Math.max(0,v.dot(this.sunDir));
      c.copy(hor).lerp(zen,Math.pow(up,.45));
      c.lerp(glow,Math.min(.9,(cs**24*.9+cs**4*.35*low*(1-up))*Math.max(day,low*.6)));
      if(v.y<0)c.copy(hor).multiplyScalar(.8);C.setXYZ(k,c.r,c.g,c.b);}
    C.needsUpdate=true;this.scene.background=null;
    this.sun.color.set(this.palette.sunColor).lerp(new THREE.Color('#ffb27a'),low*.7);
    this.sunSprite.visible=el>-.02;this.sunSprite.material.opacity=Math.max(.25,Math.exp(-tau/Math.max(.08,Math.sin(el))));
    this.scene.fog.color.copy(hor);this.scene.fog.density=.0004+.0012*tau;
    this.sky.color.copy(zen).lerp(new THREE.Color('#ffffff'),.35);this.sky.intensity=.25+.8*day;
    this.sunInfo={beam,tau};
  }
  followShadow(target){this.sun.target.position.copy(target);this.sun.position.add(target).sub(this._last??target);this._last=target.clone();}
  setWaypoints(wps,terrain){
    this.markers.clear();
    const mat=new THREE.MeshBasicMaterial({color:'#7ef0ff'}),home=new THREE.MeshBasicMaterial({color:'#ffd166'}),pts=[];
    const beacon=new THREE.MeshBasicMaterial({color:'#7ef0ff',transparent:true,opacity:.35,depthWrite:false});
    const add=(x,z,m,pole)=>{const y=terrain.heightAt(x,z);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.2,.06,6,32),m);ring.rotation.x=-Math.PI/2;ring.position.set(x,y+.05,z);this.markers.add(ring);
      if(pole){const b=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,8,6),beacon);b.position.set(x,y+4,z);this.markers.add(b);}pts.push(new THREE.Vector3(x,y+.3,z));};
    add(0,0,home,false);for(const w of wps)add(w.x,w.z,mat,true);add(0,0,home,false);
    if(pts.length>1)this.markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#7ef0ff',transparent:true,opacity:.6})));
  }
}

/** Keep the sky dome and Sun sprite centred on the camera (they are at "infinity"). */
export function followCamera(world,camera){world.dome.position.copy(camera.position);world.sunSprite.position.copy(camera.position).addScaledVector(world.sunDir,1600);}
