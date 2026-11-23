const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Intl.DateTimeFormat('sv-SE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const statuses={draft:'Utkast',working:'Pågående',done:'Färdigt'};
export async function boardroomPage({api}){
 const d=await api('/boardroom'),params=new URLSearchParams(location.hash.split('?')[1]),documentId=params.get('document');
 if(documentId){
  const {document:doc}=await api('/boardroom/documents/'+encodeURIComponent(documentId));
  return `<div id="boardroom"><a class="text-link" href="#/mina-sidor/styrelserum">← Till styrelserummet</a><h2>${esc(doc.title)}</h2><p class="badge">Endast styrelsen</p><button class="button" data-board-download="${doc.id}">Ladda ner PDF</button><article class="card board-document-text">${esc(doc.content)}</article></div>`;
 }
 const proposal=d.proposals.find(p=>String(p.id)===params.get('proposal'));
 return `<section id="boardroom"><p class="eyebrow">VDK · privat arbetsyta</p><h2>Styrelserummet</h2>
 <section class="card board-standby"><div><span class="badge">${d.participants.length?'Samtal pågår':'Standby'}</span><h3>Alltid redo för styrelsen</h3><p>Gå direkt in med ljud, textchatt och talarlista. Du behöver inte skapa eller boka något möte.</p><p>${d.participants.length?esc(d.participants.map(p=>p.name).join(', '))+' är på plats.':'Ingen är ansluten just nu.'}</p></div><a class="button" href="#/mina-sidor/moten?id=${esc(d.meetingId)}">Gå med i styrelserummet</a></section>
 <p class="control-note">Bara behöriga styrelsemedlemmar kommer åt detta rum, dess chatt och arbetsmaterial. Behöriga just nu: ${esc(d.members.map(m=>m.name).join(', '))}.</p>
 <div class="board-workspace"><section class="card"><h3>Förslag och pågående arbete</h3><p>Skriv ett nytt förslag eller fortsätt bearbeta något ni redan påbörjat.</p>
 <form id="board-proposal-form" data-id="${proposal?.id||''}" data-version="${proposal?.version||''}">
 <div class="field"><label for="board-proposal-title">Rubrik</label><input id="board-proposal-title" name="title" value="${esc(proposal?.title||'')}" required minlength="2" maxlength="180"></div>
 <div class="field"><label for="board-proposal-content">Förslag eller arbetsanteckning</label><textarea id="board-proposal-content" name="content" rows="8" required maxlength="40000">${esc(proposal?.content||'')}</textarea></div>
 <div class="field"><label for="board-proposal-status">Status</label><select name="status" id="board-proposal-status">${Object.entries(statuses).map(([key,name])=>`<option value="${key}" ${proposal?.status===key?'selected':''}>${name}</option>`).join('')}</select></div>
 <button type="submit" class="button">${proposal?'Spara ändringar':'Spara förslag'}</button>${proposal?'<a class="text-link" href="#/mina-sidor/styrelserum">Nytt förslag</a>':''}<p class="form-error" role="alert" hidden></p></form>
 <div class="board-proposals">${d.proposals.map(p=>`<article><span class="badge">${statuses[p.status]}</span><h4><a class="text-link" href="#/mina-sidor/styrelserum?proposal=${p.id}">${esc(p.title)}</a></h4><p>${esc(p.content.slice(0,220))}${p.content.length>220?'…':''}</p><small>Senast ändrat av ${esc(p.updated_by_name)} · ${esc(date(p.updated_at))}</small></article>`).join('')||'<p>Inga förslag sparade ännu.</p>'}</div>
 </section><section class="card"><h3>Styrelsens dokument</h3><p>Privata PDF-filer, Word-dokument och textfiler. Läs hela innehållet här och ladda ner som PDF.</p>
 <details><summary>Ladda upp ett dokument</summary><form id="board-document-form">
 <div class="field"><label for="board-file">PDF, Word (.docx) eller text (.txt), högst 5 MB</label><input id="board-file" type="file" accept=".pdf,.docx,.txt" required></div>
 <button type="button" id="board-read-file" class="button button-outline">Läs in dokument</button><p id="board-file-status" role="status"></p>
 <div class="field"><label for="board-document-title">Rubrik</label><input name="title" id="board-document-title" required minlength="2" maxlength="180"></div>
 <div class="field"><label for="board-document-content">Hela dokumentets innehåll</label><textarea name="content" id="board-document-content" rows="10" required maxlength="80000"></textarea></div>
 <label class="check-label"><input type="checkbox" name="reviewed" required><span>Jag har granskat att hela texten stämmer. Word och text omvandlas till PDF.</span></label>
 <button class="button" type="submit">Spara i styrelserummet</button><p class="form-error" role="alert" hidden></p></form></details>
 <div class="board-document-list">${d.documents.map(doc=>`<article><h4>${esc(doc.title)}</h4><p><small>${esc(doc.uploaded_by)} · ${esc(date(doc.created_at))}</small></p><a class="text-link" href="#/mina-sidor/styrelserum?document=${doc.id}">Läs dokumentet</a> · <button type="button" class="button button-quiet button-small" data-board-download="${doc.id}">Ladda ner PDF</button></article>`).join('')||'<p>Inga dokument uppladdade ännu.</p>'}</div></section></div></section>`;
}
export function mountBoardroom({api,apiBase,toast}){
 if(!document.querySelector('#boardroom'))return;
 const proposal=document.querySelector('#board-proposal-form');
 proposal?.addEventListener('submit',async e=>{
  e.preventDefault();const button=proposal.querySelector('button[type=submit]'),error=proposal.querySelector('.form-error');button.disabled=true;error.hidden=true;
  try{await api('/boardroom/proposals'+(proposal.dataset.id?'/'+proposal.dataset.id:''),{method:'POST',body:{...Object.fromEntries(new FormData(proposal)),version:Number(proposal.dataset.version)||undefined}});toast('Förslaget är sparat för styrelsen.');location.hash='/mina-sidor/styrelserum?updated='+Date.now();}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
 });
 const form=document.querySelector('#board-document-form'),fileInput=document.querySelector('#board-file'),progress=document.querySelector('#board-file-status');
 let source=null,converter;
 const load=async()=>converter||(converter=await import('./assets/documents/converter.js'));
 fileInput?.addEventListener('change',()=>{source=null;form.querySelector('[name=reviewed]').checked=false;});
 document.querySelector('#board-read-file')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;progress.textContent='Läser dokumentet…';
  try{const file=fileInput.files[0];const tools=await load(),read=await tools.readDocument(file);if(file!==fileInput.files[0])throw Error('Filen ändrades. Läs in den igen.');source=read;document.querySelector('#board-document-content').value=source.content;if(!document.querySelector('#board-document-title').value)document.querySelector('#board-document-title').value=file.name.replace(/\.[^.]+$/,'');progress.textContent='Granska texten innan du sparar.';}
  catch(e){progress.textContent=e.message;}finally{button.disabled=false;}
 });
 form?.addEventListener('submit',async e=>{
  e.preventDefault();const error=form.querySelector('.form-error'),button=form.querySelector('button[type=submit]');button.disabled=true;error.hidden=true;
  try{if(!source)throw Error('Läs in den valda filen först.');const data=Object.fromEntries(new FormData(form)),tools=await load();const pdf=source.originalPdf?source.pdf:await tools.textPdf(data.title,data.content);await api('/boardroom/documents',{method:'POST',body:{title:data.title,content:data.content,filename:fileInput.files[0].name,reviewed:true,pdf:tools.base64Pdf(pdf)}});toast('Dokumentet är sparat privat för styrelsen.');location.hash='/mina-sidor/styrelserum?updated='+Date.now();}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
 });
 document.querySelectorAll('[data-board-download]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;
  try{const r=await fetch(apiBase+'/api/boardroom/documents/'+button.dataset.boardDownload+'/pdf',{credentials:'include'});if(!r.ok)throw Error('PDF-filen kunde inte hämtas. Kontrollera din åtkomst.');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='VDK-styrelse-'+button.dataset.boardDownload+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  catch(e){toast(e.message);}finally{button.disabled=false;}
 }));
}
