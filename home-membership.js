const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('sv-SE').format(n)+' kr';
const categories={active:{label:'Aktiv medlem',price:100,description:'För dig som dömer innebandy.'},support:{label:'Stödmedlem',price:100,description:'Stötta domarkåren och gemenskapen.'},club:{label:'Föreningsmedlem',price:1500,description:'Stöd och dialog för er förening.'},business:{label:'Företag · ge en gåva',price:1000,description:'Hjälp oss utveckla verksamheten.'}};
const brand='<span class="brand entry-brand" aria-label="VDK, grundat 2026"><span class="brand-word" aria-hidden="true"><b>V</b><b>D</b><b>K</b></span><span class="brand-year">EST. 2026</span></span>';
export function homeMembership(){return `<section class="home-entry" aria-labelledby="entry-title"><div class="entry-backdrop" aria-hidden="true"><img class="hero-image-dark" src="assets/hero-dark-neutral.jpg" alt="" fetchpriority="high"></div><div class="container entry-grid"><div class="entry-intro"><p class="eyebrow">Av domare, för domare</p><h1 id="entry-title">Tillsammans för en <span>starkare domarkår.</span></h1><p>VDK är en oberoende intresseorganisation som engagerar sig i domarfrågor. Gemenskap, utveckling och trygghet – på och utanför planen.</p><ul><li>Kollegor, medlemsmöten och erfarenhetsutbyte</li><li>Regelkunskap och digitala medlemsverktyg</li><li>En gemensam röst för våra medlemmar</li></ul><div class="motto"><strong>AEQUALITAS PRO OMNIBUS</strong><em>Lika för alla.</em></div><a class="text-link" href="#/om-vdk">Lär känna VDK →</a></div><div class="entry-card" id="home-membership"><div class="entry-rotor"><section class="entry-face entry-front" aria-labelledby="entry-register-title">${brand}<button class="button full-width entry-login-shortcut" type="button" data-entry-login>Redan medlem? Logga in här</button><p class="eyebrow">Välkommen till gemenskapen</p><h2 id="entry-register-title" tabindex="-1">Bli medlem i Värmlands Domarkollektiv</h2><div id="entry-registration"><p class="entry-subtitle">Välj medlemskap och registrera dig. Betala sedan med Swish.</p><ol class="entry-steps" aria-label="Så blir du medlem"><li aria-current="step">1. Registrera</li><li>2. Betala</li><li>3. Aktivera via mejl</li></ol><form id="entry-register-form"><fieldset class="entry-category"><legend>Vad passar dig?</legend>${Object.entries(categories).map(([key,c])=>`<label><input type="radio" name="category" value="${key}" ${key==='active'?'checked':''}><span><strong>${c.label}</strong><small>${key==='business'?'Från ':''}${money(c.price)}${key==='business'?'':' / säsong'}</small></span></label>`).join('')}</fieldset><p id="entry-category-description" class="entry-note">${categories.active.description}</p><div class="field" id="entry-organization-field" hidden><label for="entry-organization">Föreningens namn</label><input id="entry-organization" name="organization" maxlength="160" autocomplete="organization" disabled></div><div class="field" id="entry-amount-field" hidden><label for="entry-amount">Gåvans belopp (minst 1 000 kr)</label><input id="entry-amount" name="amount" type="number" min="1000" max="10000000" step="1" value="1000" disabled></div><div class="field"><label for="entry-name" id="entry-name-label">Förnamn och efternamn</label><input id="entry-name" name="name" required minlength="2" maxlength="120" autocomplete="name"></div><div class="field"><label for="entry-email">E-postadress</label><input id="entry-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false"></div><label class="check-label"><input type="checkbox" name="consent" required><span><span id="entry-consent-copy">Jag ansöker om medlemskap och har läst</span> <span id="entry-statutes-links"><a href="#/stadgar" target="_blank" rel="noopener">stadgarna</a> och </span><a href="#/integritet" target="_blank" rel="noopener">hur VDK behandlar mina uppgifter</a> (ny flik).</span></label><p class="form-error" id="entry-register-error" role="alert" tabindex="-1"></p><button type="submit" class="button full-width">Fortsätt till betalning →</button><p class="entry-note" id="entry-activation-note">Du väljer lösenord via aktiveringsmejlet. VDK kontrollerar betalningen manuellt.</p></form></div><div id="entry-payment" hidden tabindex="-1"></div></section><section class="entry-face entry-back" aria-labelledby="entry-login-title" aria-hidden="true" inert>${brand}<p class="eyebrow">Välkommen tillbaka</p><h2 id="entry-login-title" tabindex="-1">Logga in på Mina sidor</h2><p class="entry-subtitle">Dina kollegor, verktyg och möten – på ett ställe.</p><form id="entry-login-form"><div class="field"><label for="entry-login-email">E-postadress</label><input id="entry-login-email" name="email" type="email" required autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false"></div><div class="field"><label for="entry-login-password">Lösenord</label><div class="password-field"><input id="entry-login-password" name="password" type="password" required autocomplete="current-password"><button type="button" class="password-toggle" aria-controls="entry-login-password" aria-pressed="false">Visa</button></div></div><a class="text-link" href="#/aterstall">Glömt lösenord?</a><p class="form-error" id="entry-login-error" role="alert" tabindex="-1"></p><button class="button full-width" type="submit">Logga in</button></form><p class="entry-note">Registrerat dig men saknar lösenord? Öppna aktiveringsmejlet från konto@vdk.nu. Kontrollera även skräpposten.</p><div class="entry-switch"><button class="button button-outline full-width" type="button" data-entry-register>Ny hos VDK? Vänd till registrering</button></div></section></div></div></div></section>`;}

let cleanup;
export function mountHomeMembership({api,loadSettings,sharedQr,onLogin}){
 cleanup?.();cleanup=null;
 const root=document.querySelector('#home-membership');if(!root)return;
 const rotor=root.querySelector('.entry-rotor'),front=root.querySelector('.entry-front'),back=root.querySelector('.entry-back');
 const form=root.querySelector('#entry-register-form'),login=root.querySelector('#entry-login-form');
 let flipped=false,busy=false,redirect;
 const resize=()=>{if(root.isConnected)rotor.style.height=(flipped?back:front).offsetHeight+'px';};
 const observer=new ResizeObserver(resize);observer.observe(front);observer.observe(back);
 cleanup=()=>{observer.disconnect();clearTimeout(redirect);};
 function flip(value,focus=true){
  flipped=value;root.classList.toggle('is-flipped',value);front.inert=value;back.inert=!value;front.setAttribute('aria-hidden',String(value));back.setAttribute('aria-hidden',String(!value));resize();
  if(focus)(value?back:front).querySelector('h2').focus({preventScroll:true});
 }
 root.querySelector('[data-entry-login]').addEventListener('click',()=>{
  flip(true);
  // Auth cookies must be created on the member service as a first-party page.
  if(['vdk.nu','www.vdk.nu'].includes(location.hostname)){
   back.inert=true;
   redirect=setTimeout(()=>{if(root.isConnected)location.assign('https://vdk-members.soren-johansson-7.workers.dev/#/?inloggning=1');},matchMedia('(prefers-reduced-motion: reduce)').matches?0:650);
  }
 });
 root.querySelector('[data-entry-register]').addEventListener('click',()=>{clearTimeout(redirect);flip(false);});
 if(new URLSearchParams(location.hash.split('?')[1]).get('inloggning')==='1')flip(true,false);
 resize();
 form.addEventListener('change',()=>{
  const category=form.elements.category.value,c=categories[category],org=category==='club'||category==='business',business=category==='business';
  root.querySelector('#entry-category-description').textContent=c.description;
  root.querySelector('#entry-organization-field').hidden=!org;form.elements.organization.disabled=!org;form.elements.organization.required=org;
  root.querySelector('#entry-organization-field label').textContent=business?'Företagets namn':'Föreningens namn';
  root.querySelector('#entry-amount-field').hidden=!business;form.elements.amount.disabled=!business;form.elements.amount.required=business;
  root.querySelector('#entry-name-label').textContent=org?'Kontaktpersonens förnamn och efternamn':'Förnamn och efternamn';
  root.querySelector('#entry-statutes-links').hidden=business;
  root.querySelector('#entry-consent-copy').textContent=business?'Jag vill lämna en företagsgåva och har läst':'Jag ansöker om medlemskap och har läst';
  root.querySelector('#entry-activation-note').textContent=business?'Företagsgåvan är ett stöd till verksamheten och ger inget medlemskonto.':'Du väljer lösenord via aktiveringsmejlet. VDK kontrollerar betalningen manuellt.';
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;busy=true;
  const button=form.querySelector('[type=submit]'),error=root.querySelector('#entry-register-error'),data=Object.fromEntries(new FormData(form));button.disabled=true;error.textContent='';form.setAttribute('aria-busy','true');
  try{
   const settings=await loadSettings();
   const result=await api('/applications',{method:'POST',body:{...data,amount:data.category==='business'?Number(data.amount):undefined,season:settings.season,consent:data.consent==='on'}});
   if(!root.isConnected)return;
   const payment=root.querySelector('#entry-payment'),business=result.category==='business';
   root.querySelector('#entry-registration').hidden=true;
   root.querySelector('#entry-register-title').textContent=business?'Tack för att ni stöttar VDK!':'Din registrering är mottagen!';
   payment.innerHTML=`<ol class="entry-steps"><li>✓ Registrerat</li><li aria-current="step">2. Betala</li><li>${business?'3. Bekräftelse':'3. Aktivera'}</li></ol><p><strong>${esc(categories[result.category].label)} · ${money(result.fee)}</strong></p><p>Swisha <strong>${money(result.fee)}</strong> och ange <strong>${esc(result.paymentReference)}</strong> som meddelande, så kan vi koppla betalningen till din ${business?'gåva':'ansökan'}.</p>${sharedQr(result.category,{fee:result.fee,reference:result.paymentReference})}<div class="entry-next"><h3>${business?'Vad händer sedan?':'Aktivera ditt konto via mejlet'}</h3><p>${business?'VDK kontrollerar betalningen och bekräftar gåvan. En företagsgåva skapar inget medlemskonto.':result.activationEmailSent===false?'Har du redan ett konto kan du logga in med ditt befintliga lösenord. Saknar du lösenord och får inget aktiveringsmejl? Kontakta oss på kontakt@vdk.nu.':'Öppna mejlet från konto@vdk.nu och välj lösenord. Det kan ta några minuter. Kontrollera även skräpposten.'}</p>${business?'':`<p>${result.category==='support'?'När du aktiverat kontot kan du använda stödmedlemmens funktioner direkt.':'När du aktiverat kontot får du tillfällig åtkomst motsvarande stödmedlem. Din sökta medlemsbehörighet öppnas när VDK har kontrollerat betalningen och godkänt ansökan.'} Betalningen kontrolleras manuellt.</p>`}<a class="text-link" href="#/kontakt">Behöver du hjälp? Kontakta VDK</a></div>`;
   payment.hidden=false;resize();payment.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'smooth'});
   const view=payment.querySelector('.membership-qr-view');
   try{const converter=await import('./assets/documents/converter.js');await converter.renderExistingPdf(view.dataset.pdf,view.querySelector('canvas'));if(!root.isConnected)return;view.querySelector('canvas').hidden=false;view.querySelector('[role=status]')?.remove();}
   catch{if(root.isConnected)view.querySelector('[role=status]').textContent='Öppna Swish-koden som PDF nedan, eller använd Swishnumret.';}
  }catch(e){if(root.isConnected){error.textContent=e.message;error.focus();}}
  finally{busy=false;button.disabled=false;form.removeAttribute('aria-busy');}
 });
 login.addEventListener('submit',async e=>{
  e.preventDefault();const button=login.querySelector('[type=submit]'),error=root.querySelector('#entry-login-error');if(button.disabled)return;button.disabled=true;error.textContent='';
  try{const result=await api('/auth/login',{method:'POST',body:Object.fromEntries(new FormData(login))});if(root.isConnected)await onLogin(result.user);}
  catch(e){if(root.isConnected){error.textContent=e.message;error.focus();}}finally{button.disabled=false;}
 });
}
