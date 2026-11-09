/**
 * Schematic Mars map (equirectangular, east longitude 0–360°): latitude/longitude grid, the ±50°
 * Exploration Zone band (NASA 2015 guideline) and the candidate sites. No background imagery:
 * the map shows positions only. Click a site to select or deselect it.
 */
export function drawMarsMap(canvas,sites,selected,{onClick=null,lang='en'}={}){
  const dpr=Math.min(2,devicePixelRatio||1),w=canvas.clientWidth||400,h=Math.round(w/2);
  canvas.style.height=`${h}px`;canvas.width=w*dpr;canvas.height=h*dpr;
  const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const X=lon=>lon/360*w,Y=lat=>(90-lat)/180*h;
  g.fillStyle='#2a1a12';g.fillRect(0,0,w,h);
  g.fillStyle='#ff8a4c22';g.fillRect(0,Y(50),w,Y(-50)-Y(50));
  g.strokeStyle='#ffffff18';g.lineWidth=1;g.font='10px system-ui';g.fillStyle='#ffffff60';
  for(let lon=0;lon<=360;lon+=30){g.beginPath();g.moveTo(X(lon),0);g.lineTo(X(lon),h);g.stroke();if(lon<360)g.fillText(`${lon}°E`,X(lon)+2,h-3);}
  for(let lat=-60;lat<=60;lat+=30){g.beginPath();g.moveTo(0,Y(lat));g.lineTo(w,Y(lat));g.stroke();g.fillText(`${lat}°`,2,Y(lat)-2);}
  g.strokeStyle='#ff8a4c88';g.setLineDash([4,4]);for(const lat of [50,-50]){g.beginPath();g.moveTo(0,Y(lat));g.lineTo(w,Y(lat));g.stroke();}g.setLineDash([]);
  g.fillStyle='#ff8a4cbb';g.fillText(lang==='tr'?'±50° keşif bölgesi sınırı':'±50° exploration-zone limit',w-150,Y(50)-4);
  const hits=[];
  for(const s of sites){
    const x=X(s.data.longitude.value),y=Y(s.data.latitude.value),on=selected.includes(s.id);
    g.beginPath();g.arc(x,y,on?7:5,0,7);g.fillStyle=on?'#ff8a4c':'#ffffff55';g.fill();g.lineWidth=2;g.strokeStyle=on?'#fff':'#ffffff88';g.stroke();
    g.fillStyle=on?'#fff':'#ffffffaa';g.font=`${on?'600 ':''}12px system-ui`;const label=s.label[lang]??s.label.en;
    g.fillText(label,Math.min(w-g.measureText(label).width-4,x+9),y+4);hits.push({id:s.id,x,y});
  }
  canvas.onclick=onClick?e=>{const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
    const hit=hits.find(p=>Math.hypot(p.x-mx,p.y-my)<14);if(hit)onClick(hit.id);}:null;
}
