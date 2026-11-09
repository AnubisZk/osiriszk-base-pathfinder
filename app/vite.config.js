// Dev server: the same NASA proxy paths as app/public/_redirects (Netlify), so the app's
// "real conditions" buttons work in `npm run dev:app` without browser CORS limits.
// Build: two pages — the simulators (index.html) and the Mars Base Pathfinder (pathfinder.html).
import {fileURLToPath} from 'node:url';
const page=p=>fileURLToPath(new URL(p,import.meta.url));
export default {
  server:{
    proxy:{
      '/nasa/mars':{target:'https://mars.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/mars/,'')},
      '/nasa/power':{target:'https://power.larc.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/power/,'')},
      '/nasa/epic':{target:'https://epic.gsfc.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/epic/,'')},
    },
  },
  worker:{format:'es'},
  build:{rollupOptions:{input:{index:page('./index.html'),pathfinder:page('./pathfinder.html')}}},
};
