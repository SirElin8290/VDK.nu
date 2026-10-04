(() => {
 const key='vdk-theme', media=window.matchMedia('(prefers-color-scheme: dark)');
 let saved;try{saved=localStorage.getItem(key);}catch{}
 let explicit=saved==='light'||saved==='dark';
 function apply(theme){
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#080b0c':'#f5f7f8');
  const button=document.querySelector('#theme-toggle');if(button){const next=theme==='dark'?'ljust':'mörkt';button.innerHTML=theme==='dark'?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.1A8.6 8.6 0 0 1 9.9 3.5a8.6 8.6 0 1 0 10.6 10.6Z"/></svg>';button.setAttribute('aria-label','Byt till '+next+' läge');button.title='Byt till '+next+' läge';}
 }
 apply(explicit?saved:media.matches?'dark':'light');
 document.addEventListener('DOMContentLoaded',()=>{apply(document.documentElement.dataset.theme);document.querySelector('#theme-toggle')?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';explicit=true;try{localStorage.setItem(key,next);}catch{}apply(next);});});
 media.addEventListener('change',event=>{if(!explicit)apply(event.matches?'dark':'light');});
})();
