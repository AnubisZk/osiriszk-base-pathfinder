// Dev server: the same NASA proxy paths as app/public/_redirects (Netlify), so the app's
// "real conditions" buttons work in `npm run dev:app` without browser CORS limits.
export default {
  server:{
    proxy:{
      '/nasa/mars':{target:'https://mars.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/mars/,'')},
      '/nasa/power':{target:'https://power.larc.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/power/,'')},
      '/nasa/epic':{target:'https://epic.gsfc.nasa.gov',changeOrigin:true,rewrite:p=>p.replace(/^\/nasa\/epic/,'')},
    },
  },
};
