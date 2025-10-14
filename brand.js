// v5.4 brand pack: inject TradeA logo badge into header (retro only)
(function(){
  const LOGO = 'assets/tradea-icon.png';
  function ensureBadge(){
    const header = document.querySelector('.topbar, header, .app-header') || document.body;
    if (!header) return;
    let existing = header.querySelector('.logo-badge');
    if (!existing) {
      const img = document.createElement('img');
      img.className = 'logo-badge';
      img.src = LOGO;
      img.alt = 'TradeA';
      header.insertBefore(img, header.firstChild);
    }
  }
  function toggleFavicon(href){
    const rels = ['icon','shortcut icon','apple-touch-icon'];
    rels.forEach(rel=>{
      let link = document.querySelector(`link[rel="${rel}"]`);
      if(!link){ link = document.createElement('link'); link.rel = rel; document.head.appendChild(link); }
      link.href = href;
      if(rel==='icon') link.type = 'image/png';
    });
  }
  function init(){
    ensureBadge();
    toggleFavicon('assets/tradea-icon.png');
    // manifest link
    let mf = document.querySelector('link[rel="manifest"]');
    if(!mf){ mf = document.createElement('link'); mf.rel='manifest'; document.head.appendChild(mf); }
    mf.href = 'manifest.webmanifest';
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();