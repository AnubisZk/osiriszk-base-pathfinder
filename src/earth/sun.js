/**
 * Earth Sun position: NOAA "General Solar Position Calculations" (Spencer 1971 Fourier series for
 * the equation of time, declination and Earth–Sun distance). Accuracy ≈ 0.5° — ample for lighting
 * and solar-energy estimates. Same return shape as the Mars sunPosition (time.js).
 */
const D2R=Math.PI/180,R2D=180/Math.PI;
export const ANKARA=Object.freeze({lat:39.93,lonEast:32.85,elevation:938,label:'Ankara'});

export function earthSunPosition(ms,lat,lonEast){
  const d=new Date(ms),start=Date.UTC(d.getUTCFullYear(),0,1),doy=Math.floor((ms-start)/864e5)+1;
  const leap=new Date(Date.UTC(d.getUTCFullYear(),1,29)).getUTCMonth()===1,days=leap?366:365;
  const hour=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
  const g=2*Math.PI/days*(doy-1+(hour-12)/24);
  const eqtime=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g)); // minutes
  const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const r2inv=1.000110+.034221*Math.cos(g)+.001280*Math.sin(g)+.000719*Math.cos(2*g)+.000077*Math.sin(2*g); // (r0/r)²
  const tst=hour*60+eqtime+4*lonEast; // true solar time, minutes
  const lst=((tst/60)%24+24)%24,H=(lst-12)*15*D2R,f=lat*D2R;
  const E=-Math.cos(decl)*Math.sin(H),N=Math.sin(decl)*Math.cos(f)-Math.cos(decl)*Math.sin(f)*Math.cos(H),U=Math.sin(decl)*Math.sin(f)+Math.cos(decl)*Math.cos(f)*Math.cos(H);
  return {elevation:Math.asin(Math.max(-1,Math.min(1,U)))*R2D,azimuth:(Math.atan2(E,N)*R2D+360)%360,direction:{east:E,north:N,up:U},
    irradianceTOA:1361*r2inv,declination:decl*R2D,equationOfTime:eqtime,localSolarTime:lst,Ls:null};
}
