const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const meetingDocumentPanel=()=>`<h3>Dokument</h3><p>Alla deltagare kan dela dokument. Dokumenten sparas med mötet.</p><div id="meeting-doc-upload" hidden> <details><summary>Ladda upp ett dokument</summary><form id="meeting-doc-document-form">
 <div class="field"><label for="meeting-doc-file">PDF, Word (.docx) eller text (.txt), högst 5 MB</label><input id="meeting-doc-file" type="file" accept=".pdf,.docx,.txt" required></div>
 <button type="button" id="meeting-doc-read-file" class="button button-outline">Läs in dokument</button><p id="meeting-doc-file-status" role="status"></p>
 <div class="field"><label for="meeting-doc-document-title">Rubrik</label><input name="title" id="meeting-doc-document-title" required minlength="2" maxlength="180"></div>
 <div class="field"><label for="meeting-doc-document-content">Hela dokumentets innehåll</label><textarea name="content" id="meeting-doc-document-content" rows="10" required maxlength="80000"></textarea></div>
 <label class="check-label"><input type="checkbox" name="reviewed" required><span>Jag har granskat att hela texten stämmer. Word och text omvandlas till PDF.</span></label>
 <button class="button" type="submit">Dela i mötet</button><p class="form-error" role="alert" hidden></p></form></details>
</div><div id="meeting-doc-list"></div><article id="meeting-doc-reading" class="card board-document-text" hidden></article>`;
export function mountMeetingDocuments({api,apiBase,id,toast,refresh}){
 const base='/meetings/'+id+'/documents';
 const form=document.querySelector('#meeting-doc-document-form'),fileInput=document.querySelector('#meeting-doc-file'),progress=document.querySelector('#meeting-doc-file-status');
 let source=null,converter;
 const load=async()=>converter||(converter=await import('./assets/documents/converter.js'));
 fileInput?.addEventListener('change',()=>{source=null;form.querySelector('[name=reviewed]').checked=false;});
 document.querySelector('#meeting-doc-read-file')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;progress.textContent='Läser dokumentet…';
  try{const file=fileInput.files[0];const tools=await load(),read=await tools.readDocument(file);if(file!==fileInput.files[0])throw Error('Filen ändrades. Läs in den igen.');source=read;document.querySelector('#meeting-doc-document-content').value=source.content;if(!document.querySelector('#meeting-doc-document-title').value)document.querySelector('#meeting-doc-document-title').value=file.name.replace(/\.[^.]+$/,'');progress.textContent='Granska texten innan du sparar.';}
  catch(e){progress.textContent=e.message;}finally{button.disabled=false;}
 });
 form?.addEventListener('submit',async e=>{
  e.preventDefault();const error=form.querySelector('.form-error'),button=form.querySelector('button[type=submit]');button.disabled=true;error.hidden=true;
  try{if(!source)throw Error('Läs in den valda filen först.');const data=Object.fromEntries(new FormData(form)),tools=await load();const pdf=source.originalPdf?source.pdf:await tools.textPdf(data.title,data.content);await api(base,{method:'POST',body:{title:data.title,content:data.content,filename:fileInput.files[0].name,reviewed:true,pdf:tools.base64Pdf(pdf)}});toast('Dokumentet är delat i mötet.');form.reset();source=null;progress.textContent='';await refresh();}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
 });

 const list=document.querySelector('#meeting-doc-list'),reading=document.querySelector('#meeting-doc-reading');
 list.addEventListener('click',async e=>{const button=e.target.closest('[data-document-id]');if(!button)return;button.disabled=true;try{const target=base+'/'+button.dataset.documentId;if(button.dataset.download){const r=await fetch(apiBase+'/api'+target+'/pdf',{credentials:'include'});if(!r.ok)throw Error('Dokumentet kunde inte hämtas.');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download='VDK-mote-'+button.dataset.documentId+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}else{const {document:d}=await api(target);reading.innerHTML='<button class="button button-quiet" type="button">Stäng dokumentet</button><h4>'+esc(d.title)+'</h4><div>'+esc(d.content)+'</div>';reading.hidden=false;reading.querySelector('button').onclick=()=>{reading.hidden=true;button.focus();};reading.scrollIntoView({block:'nearest'});}}catch(e){toast(e.message);}finally{button.disabled=false;}});
 let last='';return d=>{document.querySelector('#meeting-doc-upload').hidden=!(d.joined&&d.room.status==='open');const docs=d.documents||[],key=JSON.stringify(docs);if(key===last)return;last=key;list.innerHTML=docs.map(doc=>`<article class="meeting-document-item"><h4>${esc(doc.title)}</h4><small>${esc(doc.uploaded_by)} · ${esc(new Date(doc.created_at).toLocaleDateString('sv-SE'))}</small><div class="inline-actions"><button class="button button-outline button-small" data-document-id="${doc.id}">Läs dokumentet</button><button class="button button-quiet button-small" data-document-id="${doc.id}" data-download="true">Ladda ner PDF</button></div></article>`).join('')||'<p>Inga dokument delade ännu.</p>';};
}
