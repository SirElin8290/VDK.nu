(() => {
 const key='vdk-theme', media=window.matchMedia('(prefers-color-scheme: dark)');
 let saved;try{saved=localStorage.getItem(key);}catch{}
 let explicit=saved==='light'||saved==='dark';
 function apply(theme){
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#080b0c':'#f5f7f8');
  const button=document.querySelector('#theme-toggle');if(button){const next=theme==='dark'?'ljust':'mörkt';button.textContent=theme==='dark'?'Ljust läge':'Mörkt läge';button.setAttribute('aria-label','Byt till '+next+' läge');button.title='Byt till '+next+' läge';}
 }
 apply(explicit?saved:media.matches?'dark':'light');
 document.addEventListener('DOMContentLoaded',()=>{apply(document.documentElement.dataset.theme);document.querySelector('#theme-toggle')?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';explicit=true;try{localStorage.setItem(key,next);}catch{}apply(next);});});
 media.addEventListener('change',event=>{if(!explicit)apply(event.matches?'dark':'light');});
})();
