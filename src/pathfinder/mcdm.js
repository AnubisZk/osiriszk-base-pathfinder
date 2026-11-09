/**
 * Multi-criteria decision making, written out step by step so every number can be checked by hand.
 *
 * TOPSIS (Hwang & Yoon 1981):
 *   1. vector normalisation   r_ij = x_ij / √(Σ_i x_ij²)
 *   2. weighting              v_ij = w_j r_ij           (Σ w_j = 1)
 *   3. ideal and anti-ideal   v_j⁺ = max_i v_ij (benefit) or min (cost); v_j⁻ the opposite
 *   4. distances              D_i^± = √(Σ_j (v_ij − v_j^±)²)
 *   5. closeness              C_i = D_i⁻ / (D_i⁺ + D_i⁻) ∈ [0, 1]; rank by C, highest first
 * AHP (Saaty): weights = principal eigenvector of the reciprocal pairwise matrix (power iteration),
 *   λmax, CI = (λmax − n)/(n − 1), CR = CI / RI(n); CR < 0.1 is acceptably consistent.
 * Sensitivity: one weight swept 0 → 1 with the others rescaled in proportion; stability interval
 *   of the winner per criterion; seeded Monte Carlo over random weights (uniform on the simplex)
 *   and over the data uncertainties (normal, one σ = the datum's uncertainty).
 * No randomness anywhere except the seeded Monte Carlo, which is reproducible.
 */
export function mulberry32(a){return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

/** X: m alternatives × n criteria (finite numbers); w: n weights summing to 1; dirs: 'benefit'|'cost'. */
export function topsis(X,w,dirs){
  const m=X.length,n=w.length;
  if(!m)throw new RangeError('TOPSIS needs at least one alternative');
  for(const row of X){if(row.length!==n)throw new RangeError('Every alternative needs one value per criterion');for(const x of row)if(!Number.isFinite(x))throw new RangeError('TOPSIS values must be finite numbers');}
  const norms=Array.from({length:n},(_,j)=>Math.sqrt(X.reduce((s,r)=>s+r[j]*r[j],0)));
  const R=X.map(r=>r.map((x,j)=>norms[j]>0?x/norms[j]:0));
  const V=R.map(r=>r.map((x,j)=>x*w[j]));
  const col=j=>V.map(r=>r[j]);
  const ideal=Array.from({length:n},(_,j)=>dirs[j]==='cost'?Math.min(...col(j)):Math.max(...col(j)));
  const anti=Array.from({length:n},(_,j)=>dirs[j]==='cost'?Math.max(...col(j)):Math.min(...col(j)));
  const Dp=V.map(r=>Math.sqrt(r.reduce((s,v,j)=>s+(v-ideal[j])**2,0)));
  const Dm=V.map(r=>Math.sqrt(r.reduce((s,v,j)=>s+(v-anti[j])**2,0)));
  const C=Dp.map((d,i)=>d+Dm[i]>0?Dm[i]/(d+Dm[i]):.5);
  const order=C.map((c,i)=>i).sort((a,b)=>C[b]-C[a]||a-b);
  const rank=new Array(m);order.forEach((i,k)=>{rank[i]=k+1;});
  return {norms,R,V,ideal,anti,Dplus:Dp,Dminus:Dm,C,order,rank,winner:order[0]};
}

/** Saaty's random consistency index RI(n), n = 1…10. */
export const RANDOM_INDEX=Object.freeze([0,0,0,.58,.90,1.12,1.24,1.32,1.41,1.45,1.49]);
/** Saaty's 1–9 scale labels. */
export const SAATY_SCALE=Object.freeze([
  {v:1,en:'equal',tr:'eşit'},{v:3,en:'moderately more important',tr:'biraz daha önemli'},{v:5,en:'strongly more important',tr:'çok daha önemli'},
  {v:7,en:'very strongly more important',tr:'çok çok daha önemli'},{v:9,en:'extremely more important',tr:'son derece daha önemli'},
]);

/** Complete a pairwise matrix from its upper triangle (a_ij for i < j); a_ji = 1/a_ij, a_ii = 1. */
export function reciprocalMatrix(n,upper){
  const A=Array.from({length:n},()=>new Array(n).fill(1));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=upper(i,j);if(!(a>0))throw new RangeError(`Pairwise value a(${i},${j}) must be positive`);A[i][j]=a;A[j][i]=1/a;}
  return A;
}

/** AHP weights, λmax, CI, CR from a positive reciprocal matrix A (n × n). */
export function ahp(A,{iterations=200}={}){
  const n=A.length;
  for(let i=0;i<n;i++){if(A[i].length!==n)throw new RangeError('AHP matrix must be square');for(let j=0;j<n;j++){
    if(!(A[i][j]>0))throw new RangeError('AHP entries must be positive');
    if(Math.abs(A[i][j]*A[j][i]-1)>1e-6)throw new RangeError(`AHP matrix must be reciprocal (a${i}${j}·a${j}${i} = 1)`);}}
  let w=new Array(n).fill(1/n);
  for(let k=0;k<iterations;k++){
    const Aw=A.map(r=>r.reduce((s,a,j)=>s+a*w[j],0)),s=Aw.reduce((a,b)=>a+b,0),next=Aw.map(x=>x/s);
    const d=Math.max(...next.map((x,i)=>Math.abs(x-w[i])));w=next;if(d<1e-12)break;
  }
  const Aw=A.map(r=>r.reduce((s,a,j)=>s+a*w[j],0)),lambda=Aw.reduce((s,x,i)=>s+x/w[i],0)/n;
  const CI=n>2?(lambda-n)/(n-1):0,RI=RANDOM_INDEX[n]??1.49,CR=n>2?CI/RI:0;
  return {weights:w,lambdaMax:lambda,CI,RI,CR,consistent:CR<.1};
}

/** Weights with criterion j set to t ∈ [0,1] and the others rescaled to keep their proportions. */
export function sweepWeights(w,j,t){
  const rest=1-w[j];
  return w.map((x,k)=>k===j?t:rest>1e-12?x*(1-t)/rest:(1-t)/(w.length-1));
}

/**
 * One-at-a-time sensitivity: for each criterion j, closeness of every alternative as w_j goes
 * 0 → 1 (`steps` + 1 points) and the interval of w_j in which the baseline winner stays first.
 */
export function sensitivity(X,w,dirs,{steps=100}={}){
  const base=topsis(X,w,dirs).winner;
  return w.map((wj,j)=>{
    const ts=[],curves=X.map(()=>[]),winners=[];
    for(let k=0;k<=steps;k++){const t=k/steps,res=topsis(X,sweepWeights(w,j,t),dirs);ts.push(t);res.C.forEach((c,i)=>curves[i].push(c));winners.push(res.winner);}
    // contiguous interval around the current weight where the baseline winner stays first
    const k0=Math.round(wj*steps);let lo=k0,hi=k0;
    if(winners[k0]!==base)return {criterion:j,t:ts,curves,winners,interval:null,current:wj,switchesTo:[...new Set(winners)].filter(x=>x!==base)};
    while(lo>0&&winners[lo-1]===base)lo--;while(hi<steps&&winners[hi+1]===base)hi++;
    return {criterion:j,t:ts,curves,winners,interval:[ts[lo],ts[hi]],current:wj,
      switchesTo:[...new Set(winners)].filter(x=>x!==base)};
  });
}

/** Normal deviate (Box–Muller) from a uniform RNG. */
function gauss(rand){let u=0;while(u<=1e-12)u=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rand());}

/**
 * Seeded Monte Carlo. mode 'weights': w ~ uniform on the simplex (Dirichlet(1,…,1));
 * mode 'data': x_ij + σ_ij·N(0,1) (clamped at 0 when the metric cannot be negative), weights fixed;
 * mode 'both'. Returns the share of draws each alternative wins.
 */
export function monteCarlo(X,w,dirs,{U=null,mode='weights',n=2000,seed=2026,nonNegative=null}={}){
  const rand=mulberry32(seed),m=X.length,nc=w.length,wins=new Array(m).fill(0);
  for(let k=0;k<n;k++){
    let ww=w;
    if(mode!=='data'){const e=Array.from({length:nc},()=>-Math.log(Math.max(1e-12,rand())));const s=e.reduce((a,b)=>a+b,0);ww=e.map(x=>x/s);}
    let XX=X;
    if(mode!=='weights'&&U){XX=X.map((r,i)=>r.map((x,j)=>{const v=x+(U[i][j]??0)*gauss(rand);return nonNegative?.[j]?Math.max(0,v):v;}));}
    wins[topsis(XX,ww,dirs).winner]++;
  }
  return {shares:wins.map(c=>c/n),n,seed,mode};
}

/**
 * Why the winner beats the runner-up: per criterion, the difference of weighted normalised values
 * (positive = in favour of the winner, sign-corrected for cost criteria), largest first.
 */
export function explain(res,dirs,a=res.order[0],b=res.order[1]){
  if(b==null)return [];
  return dirs.map((d,j)=>{const diff=res.V[a][j]-res.V[b][j];return {criterion:j,advantage:d==='cost'?-diff:diff};})
    .sort((p,q)=>Math.abs(q.advantage)-Math.abs(p.advantage));
}
