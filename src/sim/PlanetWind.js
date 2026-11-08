import {Wind,WIND_LEVELS} from '../physics/Wind.js';

/**
 * The core's seeded wind and turbulence model with planet-specific levels: on Mars the Viking
 * Lander ranges from the NASA Fact Sheet (calm, summer 2–7, fall 5–10, dust storm 17–30 m/s).
 * Same seed and time → same wind (render-rate independent), as in the core.
 * Level 'measured' with a speed (m/s at 10 m, e.g. NASA POWER WS10M) adds a level whose gust and
 * turbulence follow the core's Earth ratios (gust 0.5×, turbulence ≈ 0.17× the mean; assumed).
 */
export class PlanetWind extends Wind {
  constructor({environment=null,level='calm',direction=225,seed=7,speed=null}={}){
    super({level:'off',direction,seed});
    this.levels=Object.fromEntries((environment?.profile?.winds??[]).map(w=>[w.id,{label:w.label.en,labels:w.label,speed:w.speed,gust:w.gust,turbulence:w.turbulence,range:w.range}]));
    if(!Object.keys(this.levels).length)this.levels={calm:{label:'Calm',speed:0,gust:0,turbulence:0},...WIND_LEVELS};
    if(Number.isFinite(speed)&&speed>=0)this.levels.measured={label:`Measured · ${speed.toFixed(1)} m/s`,labels:{en:`Measured · ${speed.toFixed(1)} m/s`,tr:`Ölçülen · ${speed.toFixed(1)} m/sn`},speed,gust:.5*speed,turbulence:speed/6};
    this.setLevel(level);
  }
  setLevel(level){
    const L=this.levels??WIND_LEVELS;
    this.level=L[level]?level:Object.keys(L)[0];this.spec=L[this.level];
  }
}
