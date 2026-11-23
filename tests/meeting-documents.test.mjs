import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {cloudStore} from './cloud-fixture.mjs';
import {createApp} from '../cloudflare/api.mjs';
import {digest} from '../cloudflare/store.mjs';
test('meeting documents are shared by participants, persist and keep board privacy',async t=>{
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

 const made=await req('/meetings',first,{title:'Dokumentmöte'}),base='/meetings/'+made.data.id;
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
 const body={title:'Dagordning',content:'Gemensamt underlag',filename:'dagordning.pdf',reviewed:true,pdf:Buffer.from(bytes).toString('base64')};
 assert.equal((await req(base+'/documents',second,body)).status,409);
 await req(base+'/join',second,{});
 const upload=await req(base+'/documents',second,body);assert.equal(upload.status,201);
 const target=base+'/documents/'+upload.data.id;
 assert.equal((await req(base,first)).data.documents[0].uploaded_by,'Board two');
 assert.equal((await req(target,first)).data.document.content,body.content);
 const downloaded=await req(target+'/pdf',first);assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(downloaded.data),Buffer.from(bytes));
 assert.equal((await req(target)).status,401);
 const other=await req('/meetings',first,{title:'Annat möte'});
 assert.equal((await req('/meetings/'+other.data.id+'/documents/'+upload.data.id,first)).status,404);
 assert.equal((await req(base+'/documents',second,{...body,pdf:'ZmFrZQ=='})).status,400);
 const privateRoom=(await req('/boardroom',first)).data.meetingId,privateBase='/meetings/'+privateRoom;
 await req(privateBase+'/join',first,{});const secret=await req(privateBase+'/documents',first,body);assert.equal(secret.status,201);
 for(const suffix of ['', '/documents/'+secret.data.id, '/documents/'+secret.data.id+'/pdf'])assert.equal((await req(privateBase+suffix,outside)).status,403);
 await req(base+'/end',first,{});
 assert.equal((await req(target,second)).status,200);
 assert.equal((await req(base+'/documents',second,body)).status,409);
});
