import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {cloudStore} from './cloud-fixture.mjs';
import {createApp} from '../cloudflare/api.mjs';
import {digest} from '../cloudflare/store.mjs';
test('boardroom documents, PDF and proposals stay private even from unassigned admins; drafts reject lost updates',async t=>{
 const db=cloudStore();t.after(()=>db.close());const {handler}=createApp({db,env:{SEASON:'2026/27',PUBLIC_ORIGIN:'https://vdk.nu'}});
 const add=(name,board,admin=false)=>{
  const id=Number(db.prepare('INSERT INTO users(name,email) VALUES(?,?)').run(name,name+'@example.test').lastInsertRowid);
  db.prepare("INSERT INTO roles VALUES(?,'MEMBER')").run(id);if(admin)db.prepare("INSERT INTO roles VALUES(?,'ADMIN')").run(id);
  db.prepare("INSERT INTO memberships(user_id,season,status,paid,category,payment_reference,consented_at) VALUES(?,'2026/27','active',1,'active',?,'2026-11-23')").run(id,'board-'+id);
  if(board)db.prepare('INSERT INTO board_access VALUES(?,?,?)').run(id,new Date().toISOString(),id);
  const token='boardroom-test-session-'+id;db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),id,Date.now()+600000);return {id,cookie:'vdk_session='+token};
 };
 const first=add('Board one',true),second=add('Board two',true),outside=add('Other admin',false,true);
 async function req(path,user,body){
  let status,out,headers={};await handler({url:'/api'+path,method:body===undefined?'GET':'POST',headers:{cookie:user?.cookie||'',origin:'https://vdk.nu','content-type':'application/json'},socket:{remoteAddress:'board-test'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body||{}));}},{setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);},end(b){out=b;}});
  return {status,headers,data:headers['Content-Type']?.startsWith('application/pdf')?out:JSON.parse(out||'null')};
 }
 assert.equal((await req('/boardroom')).status,401);assert.equal((await req('/boardroom',outside)).status,403);
 assert.equal((await req('/me',first)).data.user.boardAccess,true);assert.equal((await req('/me',outside)).data.user.boardAccess,false);
 const initial=await req('/boardroom',first);assert.equal(initial.status,200);assert.equal(initial.data.members.length,2);assert.ok(initial.data.meetingId);
 const note=await req('/boardroom/proposals',first,{title:'Nytt förslag',content:'Internt utkast',status:'draft'});assert.equal(note.status,201);
 const saved=await req('/boardroom/proposals/'+note.data.id,second,{title:'Nytt förslag',content:'Bearbetat utkast',status:'working',version:1});assert.equal(saved.status,200);
 assert.equal((await req('/boardroom/proposals/'+note.data.id,first,{title:'Gamla ändringen',content:'Får inte skriva över',status:'draft',version:1})).status,409);
 assert.equal((await req('/boardroom/proposals',outside,{title:'Ej behörig',content:'Nej'})).status,403);
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 const upload=await req('/boardroom/documents',first,{title:'Arbetsmaterial',content:'Endast styrelsen',filename:'utkast.pdf',reviewed:true,pdf:Buffer.from(bytes).toString('base64')});assert.equal(upload.status,201);
 const path='/boardroom/documents/'+upload.data.id;
 assert.equal((await req(path,second)).data.document.content,'Endast styrelsen');
 assert.ok(Buffer.from((await req(path+'/pdf',second)).data).subarray(0,5).equals(Buffer.from('%PDF-')));
 for(const target of ['/boardroom',path,path+'/pdf'])assert.equal((await req(target,outside)).status,403,target);
 assert.equal((await req('/documents',outside)).data.documents.length,0);
 db.prepare('DELETE FROM board_access WHERE user_id=?').run(second.id);assert.equal((await req(path,second)).status,403);
});
