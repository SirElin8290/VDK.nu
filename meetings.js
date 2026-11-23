const escape=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime=v=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const path=id=>'/meetings/'+encodeURIComponent(id);
let current=null;
export function leaveMeetings(){
 if(!current)return;
 const old=current;current=null;old.active=false;clearTimeout(old.timer);old.audio?.disconnect();
 window.removeEventListener('pagehide',old.onPageHide);window.removeEventListener('beforeunload',old.onBeforeUnload);
 if(old.joined)old.api(path(old.id)+'/leave',{method:'POST',body:{}}).catch(()=>{});
}
export async function meetingPage({api}){
 const id=new URLSearchParams(location.hash.split('?')[1]).get('id');
 if(id){
  const d=await api(path(id)),m=d.room;
  return `<div id="meeting-room" data-meeting="${escape(id)}">
   <a class="text-link" href="#/mina-sidor/moten">← Alla möten</a>
   <div class="meeting-title"><div><p class="eyebrow">VDK:s digitala mötesplats</p><h2>${escape(m.title)}</h2><p>${escape(formatTime(m.starts_at))} · Mötesledare: <span id="meeting-host">${escape(m.host_name)}</span></p></div><span class="badge" id="meeting-state">${m.status==='open'?'Öppet möte':'Avslutat möte'}</span></div>
   ${m.description?`<p class="meeting-description">${escape(m.description)}</p>`:''}
   <p class="control-note">Bara inloggade medlemmar kan delta. Ljudet spelas inte in. Chatten sparas och kan läsas av VDK:s medlemmar efter mötet.</p>
   <div id="meeting-alert" role="alert" hidden></div>
   <section class="card meeting-controls" aria-label="Möteskontroller">
    <div id="meeting-join-actions">${m.status==='open'?'<button class="button" id="meeting-join">Gå med i mötet</button>':''}</div>
    <div id="meeting-live-actions" class="inline-actions" hidden>
     <button class="button button-outline" id="meeting-audio-connect">Anslut ljud</button>
     <button class="button" id="meeting-mic" disabled aria-pressed="false">Mikrofon av</button>
     <button class="button button-outline" id="meeting-hand" aria-pressed="false">✋ Räck upp handen</button>
     <button class="button button-quiet" id="meeting-playback" hidden>Spela upp ljud</button>
     <button class="button button-quiet" id="meeting-leave">Lämna mötet</button>
    </div>
    <p id="meeting-audio-status" role="status">${m.status==='open'?'Gå med för att skriva i chatten, räcka upp handen och ansluta ljudet.':'Mötet är avslutat. Du kan läsa chatten nedan.'}</p>
    <div id="meeting-audio-elements"></div>
   </section>
   <div class="meeting-layout">
    <section class="card meeting-chat"><h3>Chatt</h3><p id="meeting-history-note" class="control-note">Senaste 100 meddelandena visas när du öppnar mötet.</p><div id="meeting-messages" class="meeting-messages" role="log" aria-label="Möteschatt" aria-live="polite" aria-relevant="additions"></div>
     <form id="meeting-chat-form" hidden><label for="meeting-message">Skriv till deltagarna</label><textarea id="meeting-message" name="message" required maxlength="3000" rows="2"></textarea><button class="button" type="submit">Skicka</button></form>
    </section>
    <aside class="meeting-sidebar">
     <section class="card"><h3>Talarlista</h3><p id="meeting-speaker" role="status">Ingen har ordet.</p><p class="control-note">Handuppräckning lägger dig sist i kön.</p><ol id="meeting-queue" class="meeting-queue"></ol><p id="meeting-empty-queue">Ingen väntar på ordet.</p>
      <button class="button" id="meeting-next" hidden>Ge ordet till nästa</button>
      <p class="control-note">Talarlistan är ett stöd för mötesledaren. Den styr inte deltagarnas mikrofoner.</p>
     </section>
     <section class="card"><h3>Deltagare <span id="meeting-count">0</span></h3><ul id="meeting-people" class="meeting-people"></ul><p class="control-note">En grön markering visar vem som pratar när du har anslutit ljudet.</p></section>
     <section class="card" id="meeting-lead-controls" hidden><h3>Led mötet</h3><label for="meeting-new-host">Lämna över mötesledningen</label><select id="meeting-new-host"></select><button class="button button-outline" id="meeting-transfer">Lämna över</button><button class="button button-quiet" id="meeting-end">Avsluta mötet för alla</button></section>
    </aside>
   </div>
  </div>`;
 }
 const d=await api('/meetings');
 const card=m=>`<article class="card meeting-card"><p class="eyebrow">${m.status==='open'?'Kommande / öppet':'Avslutat'}</p><h3>${escape(m.title)}</h3><p>${escape(formatTime(m.starts_at))} (svensk tid)<br>Mötesledare: ${escape(m.host_name)}</p><p>${escape(m.description)}</p><p>${m.participants} deltagare på plats</p><a class="button ${m.status==='open'?'':'button-outline'}" href="#/mina-sidor/moten?id=${escape(m.id)}">${m.status==='open'?'Öppna mötet':'Läs chatten'}</a></article>`;
 return `<section id="meeting-lobby"><p class="eyebrow">Träffas på VDK</p><h2>Mötesplats</h2><p>Prata med kollegorna med ljud och textchatt. Räck upp handen för att hamna i talarlistan. Alla medlemmar kan skapa möten.</p>
 ${!d.audioConfigured?'<div class="notice">Ljudtjänsten förbereds. Mötesrum, chatt och talarlista går att använda.</div>':''}
 <details class="card meeting-create"><summary>+ Skapa ett möte</summary><form id="meeting-create-form">
 <div class="field"><label for="meeting-title-input">Vad vill ni prata om?</label><input id="meeting-title-input" name="title" required minlength="2" maxlength="120" placeholder="Till exempel medlemsträff"></div>
 <div class="field"><label for="meeting-date-input">Datum och tid (svensk tid)</label><input id="meeting-date-input" name="startsAt" type="datetime-local"><small>Lämna tomt för att börja nu.</small></div>
 <div class="field"><label for="meeting-description-input">Beskrivning eller punkter att prata om</label><textarea id="meeting-description-input" name="description" maxlength="2000" rows="3"></textarea></div>
 <p class="control-note">Mötet blir synligt för alla VDK-medlemmar. Högst 40 deltagare och fyra timmar per möte. Kamera och inspelning används inte.</p>
 <button class="button" type="submit">Skapa möte</button><p class="form-error" role="alert" hidden></p></form></details>
 <h3>Öppna möten</h3><div class="meeting-cards">${d.rooms.filter(m=>m.status==='open').map(card).join('')||'<p>Inga möten planerade ännu. Skapa det första!</p>'}</div>
 ${d.rooms.some(m=>m.status!=='open')?`<details class="card"><summary>Tidigare möten – senaste veckan</summary><div class="meeting-cards">${d.rooms.filter(m=>m.status!=='open').map(card).join('')}</div></details>`:''}</section>`;
}
// Convert the explicit Swedish wall time independently of the member's device timezone.
export function swedishMeetingTime(value){
 if(!value)return '';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Välj datum och tid.');
 const utc=Date.parse(value+'Z');
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let result=utc;
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(result)).map(x=>[x.type,x.value]));const wall=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}Z`);result+=utc-wall;}
 if(!Number.isFinite(result))throw Error('Välj en giltig tid.');
 const p=Object.fromEntries(fmt.formatToParts(new Date(result)).map(x=>[x.type,x.value]));
 if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`!==value)throw Error('Den tiden finns inte vid bytet till sommartid. Välj en annan tid.');
 return new Date(result).toISOString();
}
export function mountMeetings({api,user,toast}){
 const create=document.querySelector('#meeting-create-form');
 create?.addEventListener('submit',async event=>{
  event.preventDefault();const button=create.querySelector('button'),error=create.querySelector('.form-error');button.disabled=true;error.hidden=true;
  try{const values=Object.fromEntries(new FormData(create));const d=await api('/meetings',{method:'POST',body:{...values,startsAt:swedishMeetingTime(values.startsAt)}});location.hash='/mina-sidor/moten?id='+d.id;}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
 });
 const root=document.querySelector('#meeting-room');if(!root)return;
 const c={id:root.dataset.meeting,api,user,active:true,joined:false,timer:null,audio:null,mic:false,data:null,lastMessage:0,seen:new Set(),speakers:[],chatId:crypto.randomUUID(),pending:false};
 current=c;const el=id=>root.querySelector('#meeting-'+id);
 const alert=message=>{el('alert').textContent=message;el('alert').hidden=!message;};
 const status=message=>{if(c.active)el('audio-status').textContent=message;};
 const post=(action,body={})=>api(path(c.id)+'/'+action,{method:'POST',body});
 const toggleMic=enabled=>{c.mic=enabled;if(c.active){el('mic').textContent=enabled?'Mikrofon på – stäng av':'Mikrofon av – slå på';el('mic').setAttribute('aria-pressed',String(enabled));}};
 const drawPeople=()=>{el('people').innerHTML=(c.data?.people||[]).map(p=>`<li class="${c.speakers.includes(p.id)?'is-speaking':''}"><span aria-hidden="true">●</span> ${escape(p.name)}${p.id===user.id?' (du)':''}${p.id===c.data.room.host_id?' · mötesledare':''}</li>`).join('')||'<li>Ingen har gått med ännu.</li>';};
 function update(d){
  if(!c.active)return;c.data=d;
  el('host').textContent=d.room.host_name;el('count').textContent=String(d.people.length);
  el('state').textContent=d.room.status==='open'?'Öppet möte':'Avslutat möte';
  el('lead-controls').hidden=!d.canLead||!c.joined||d.room.status!=='open';
  el('next').hidden=!d.canLead||!c.joined||d.room.status!=='open';
  el('next').textContent=d.queue.length?'Ge ordet till nästa':'Markera ordet som avslutat';
  el('speaker').textContent=d.speaker?'Har ordet: '+d.speaker.name:'Ingen har ordet.';
  el('queue').innerHTML=d.queue.map(p=>`<li><span>${escape(p.name)}${p.user_id===user.id?' (du)':''}</span>${d.canLead&&c.joined?`<button class="button button-quiet button-small" data-meeting-check="${p.id}" aria-label="Bocka av ${escape(p.name)}">✓ Klar</button>`:''}</li>`).join('');
  el('empty-queue').hidden=!!d.queue.length;
  const raised=d.queue.some(p=>p.user_id===user.id);el('hand').setAttribute('aria-pressed',String(raised));el('hand').textContent=raised?'✋ Ta ner handen':'✋ Räck upp handen';
  const selected=el('new-host').value;el('new-host').innerHTML=d.people.filter(p=>p.id!==d.room.host_id).map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('');if([...el('new-host').options].some(p=>p.value===selected))el('new-host').value=selected;
  drawPeople();
  const messages=el('messages'),atBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<100;
  for(const m of d.messages){
   c.lastMessage=Math.max(c.lastMessage,m.id);if(c.seen.has(m.id))continue;c.seen.add(m.id);
   const article=document.createElement('article');article.className='meeting-message';article.innerHTML=`<p><strong>${escape(m.name)}</strong> <time datetime="${new Date(m.created_at).toISOString()}">${escape(new Date(m.created_at).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}))}</time></p><div>${escape(m.body)}</div>`;messages.append(article);
  }
  if(atBottom)messages.scrollTop=messages.scrollHeight;
  if(d.room.status!=='open'){
   c.joined=false;c.audio?.disconnect();el('join-actions').hidden=true;el('live-actions').hidden=true;el('chat-form').hidden=true;status('Mötet är avslutat. Du kan läsa chatten här.');
  }
 }
 async function refresh(){
  if(!c.active||c.pending)return;
  c.pending=true;clearTimeout(c.timer);
  try{
   const d=c.joined?await api(path(c.id)+'/pulse?after='+c.lastMessage,{method:'POST',body:{}}):await api(path(c.id)+'?after='+c.lastMessage);
   if(!c.active)return;update(d);alert('');
  }catch(e){
   if(c.active){
    alert(e.message);
    if([401,403,409].includes(e.status)){
     c.joined=false;c.audio?.disconnect();el('live-actions').hidden=true;el('chat-form').hidden=true;
     el('join-actions').hidden=false;
    }
   }
  }
  finally{c.pending=false;if(c.active&&c.data?.room.status!=='ended')c.timer=setTimeout(refresh,c.joined?4000:10000);}
 }
 async function action(button,job){
  if(button.disabled)return;button.disabled=true;try{await job();await refresh();}catch(e){if(c.active)alert(e.message);}finally{button.disabled=false;}
 }
 async function connect(){
  if(c.audio?.connected)return;
  status('Ansluter ljud…');const d=await post('audio');
  if(!c.active)return;
  const {connectAudio}=await import('./assets/meetings/audio.js');
  if(!c.active)return;
  const audio=await connectAudio({url:d.url,token:d.token,container:el('audio-elements'),onStatus:status,onMute:toggleMic,onSpeakers:ids=>{c.speakers=ids;if(c.active)drawPeople();},onDisconnect:()=>{if(!c.active)return;el('audio-connect').hidden=false;el('mic').disabled=true;status(c.data?.room.status!=='open'?'Mötet är avslutat. Du kan läsa chatten här.':'Ljudet är frånkopplat. Du är kvar i chatten och kan ansluta ljud igen.');}});
  if(!c.active){await audio.disconnect();return;}
  c.audio=audio;el('audio-connect').hidden=true;el('mic').disabled=false;el('playback').hidden=false;
 }
 el('join')?.addEventListener('click',event=>action(event.currentTarget,async()=>{
  const d=await post('join');if(!c.active){await post('leave');return;}
  c.joined=true;update(d);el('join-actions').hidden=true;el('live-actions').hidden=false;el('chat-form').hidden=false;status('Du är med i mötet. Du kan skriva och räcka upp handen.');
  try{await connect();}catch(e){status('Textchatten är ansluten. Ljudet kunde inte anslutas: '+e.message);}
 }));
 el('audio-connect').addEventListener('click',event=>action(event.currentTarget,connect));
 el('mic').addEventListener('click',event=>action(event.currentTarget,async()=>{try{await c.audio?.microphone(!c.mic);}catch{throw Error('Mikrofonen kunde inte startas. Tillåt mikrofon i webbläsaren och försök igen.');}}));
 el('playback').addEventListener('click',event=>action(event.currentTarget,async()=>{await c.audio?.playback();status('Ljuduppspelningen är aktiverad.');}));
 el('hand').addEventListener('click',event=>action(event.currentTarget,()=>post('hand',{raised:!c.data.queue.some(p=>p.user_id===user.id)})));
 el('next').addEventListener('click',event=>action(event.currentTarget,()=>post('next')));
 el('queue').addEventListener('click',event=>{const button=event.target.closest('[data-meeting-check]');if(button)action(button,()=>post('next',{queueId:Number(button.dataset.meetingCheck)}));});
 el('transfer').addEventListener('click',event=>action(event.currentTarget,()=>post('host',{userId:Number(el('new-host').value)})));
 el('end').addEventListener('click',event=>{if(confirm('Avsluta mötet för alla deltagare?'))action(event.currentTarget,()=>post('end'));});
 el('leave').addEventListener('click',event=>action(event.currentTarget,async()=>{
  c.joined=false;await c.audio?.disconnect();await post('leave');location.hash='/mina-sidor/moten';
 }));
 el('chat-form').addEventListener('submit',async event=>{
  event.preventDefault();const input=el('message'),value=input.value,button=el('chat-form').querySelector('button');
  await action(button,async()=>{await post('chat',{message:value,clientId:c.chatId});if(input.value===value)input.value='';c.chatId=crypto.randomUUID();});
 });
 c.onPageHide=()=>{c.audio?.disconnect();if(c.joined){const base=window.VDK_CONFIG?.apiBase||'';fetch(base+'/api'+path(c.id)+'/leave',{method:'POST',credentials:'include',keepalive:true,headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});}};
 c.onBeforeUnload=event=>{if(c.joined){event.preventDefault();event.returnValue='';}};
 window.addEventListener('pagehide',c.onPageHide);window.addEventListener('beforeunload',c.onBeforeUnload);
 refresh();
}
