import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {cloudStore} from './cloud-fixture.mjs';
import {createApp} from '../cloudflare/api.mjs';
import {digest} from '../cloudflare/store.mjs';
import {swedishMeetingTime,orderedMeetingPeople} from '../meetings.js';
import {deliverMeetingInvitation,meetingInvitationEmail} from '../cloudflare/meetings.mjs';

function fixture(t,extra={}){
 const db=cloudStore();t.after(()=>db.close());
 const env={SEASON:'2026/27',PUBLIC_ORIGIN:'https://vdk.nu',...extra};
 const {handler}=createApp({db,env});
 function member(name,category='active',status='active',paid=1){
  const id=Number(db.prepare('INSERT INTO users(name,email) VALUES(?,?)').run(name,name+'@example.test').lastInsertRowid);
  db.prepare("INSERT INTO roles VALUES(?,'MEMBER')").run(id);
  db.prepare('INSERT INTO memberships(user_id,season,status,paid,category,payment_reference,consented_at) VALUES(?,?,?,?,?,?,?)').run(id,'2026/27',status,paid,category,'meeting-'+id,new Date().toISOString());
  const token='meeting-session-abcdefghijklmnop-'+id;db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),id,Date.now()+600000);
  return {id,cookie:'vdk_session='+token};
 }
 async function request(path,who,body,origin='https://vdk.nu'){
  let status,output;const method=body===undefined?'GET':'POST';
  await handler({url:'/api/meetings'+path,method,headers:{cookie:who?.cookie||'',origin,'content-type':'application/json'},socket:{remoteAddress:'meeting-tests'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body||{}));}},{setHeader(){},writeHead(s){status=s;},end(v){output=v;}});
  return {status,data:JSON.parse(output||'null')};
 }
 return {db,request,member,env};
}
test('meeting access includes all member categories but blocks anonymous, expired and unrelated origins',async t=>{
 const {request,member}=fixture(t);
 assert.equal((await request('')).status,401);
 for(const category of ['active','support','club']){const u=member(category,category);assert.equal((await request('',u)).status,200);assert.equal((await request('',u,{title:'Möte '+category})).status,201);}
 const expired=member('expired','active','expired');assert.equal((await request('',expired)).status,403);
 const unpaid=member('unpaid','active','pending',0);assert.equal((await request('',unpaid)).status,403);
 const business=member('business','business');assert.equal((await request('',business)).status,403);
 const member1=member('member');assert.equal((await request('',member1,{title:'Blocked'},'https://other.example')).status,403);
});
test('queue is first come first served, duplicate hands and retries do not move members, only leader can advance',async t=>{
 const {request,member,db}=fixture(t),leader=member('Leader'),erik=member('Erik Nilsson'),sara=member('Sara Olsson','support');
 const created=await request('',leader,{title:'Medlemsträff',description:'DK-frågor'}),id=created.data.id;
 for(const who of [leader,erik,sara])assert.equal((await request('/'+id+'/join',who,{})).status,200);
 for(const who of [erik,sara,erik])assert.equal((await request('/'+id+'/hand',who,{raised:true})).status,200);
 let state=(await request('/'+id,leader)).data;
 assert.deepEqual(state.queue.map(u=>u.name),['Erik Nilsson','Sara Olsson']);
 assert.equal((await request('/'+id+'/next',erik,{})).status,403);
 assert.equal((await request('/'+id+'/next',leader,{})).status,200);
 state=(await request('/'+id,leader)).data;assert.equal(state.speaker.name,'Erik Nilsson');assert.deepEqual(state.queue.map(u=>u.name),['Sara Olsson']);
 assert.equal((await request('/'+id+'/next',leader,{queueId:state.queue[0].id})).status,200);
 assert.equal((await request('/'+id+'/next',leader,{queueId:state.queue[0].id})).status,409);
 await request('/'+id+'/hand',sara,{raised:true});await request('/'+id+'/leave',sara,{});
 assert.equal((await request('/'+id,leader)).data.queue.length,0);
 assert.equal((await request('/'+id+'/hand',sara,{raised:true})).status,409);
 await request('/'+id+'/hand',erik,{raised:true});
 db.prepare('UPDATE meeting_attendees SET last_seen=? WHERE user_id=?').run(Date.now()-130000,erik.id);
 assert.equal((await request('/'+id,leader)).data.queue.length,0);
});
test('chat is private to membership, idempotent, incremental and retained when meeting ends without further joins',async t=>{
 const {request,member}=fixture(t),host=member('Host'),guest=member('Guest');
 const id=(await request('',host,{title:'Testmeeting'})).data.id;
 assert.equal((await request('/'+id+'/chat',guest,{message:'Hello',clientId:'testmessage1'})).status,409);
 await request('/'+id+'/join',host,{});await request('/'+id+'/join',guest,{});
 for(let n=0;n<2;n++)assert.equal((await request('/'+id+'/chat',guest,{message:'<script>alert(1)</script>',clientId:'testmessage1'})).status,201);
 const state=(await request('/'+id,host)).data;assert.equal(state.messages.length,1);assert.equal(state.messages[0].name,'Guest');assert.equal((await request('/'+id+'?after='+state.messages[0].id,host)).data.messages.length,0);
 assert.equal((await request('/'+id+'/host',guest,{userId:guest.id})).status,403);
 assert.equal((await request('/'+id+'/host',host,{userId:guest.id})).status,200);
 assert.equal((await request('/'+id+'/end',host,{})).status,403);
 assert.equal((await request('/'+id+'/end',guest,{})).status,200);
 assert.equal((await request('/'+id+'/join',host,{})).status,409);
 assert.equal((await request('/'+id+'/pulse',host,{})).data.room.status,'ended');
 assert.equal((await request('/'+id,host)).data.messages.length,1);
 assert.equal((await request('/'+id)).status,401);
});
test('audio token authorizes microphone in exactly one room, never grants camera or admin rights or exposes secret',async t=>{
 const secret='test-only-livekit-secret-not-a-real-key',key='test-only-api-key';
 const {request,member}=fixture(t,{LIVEKIT_URL:'wss://unit-test.livekit.cloud',LIVEKIT_API_KEY:key,LIVEKIT_API_SECRET:secret});
 const u=member('Audio'),id=(await request('',u,{title:'Audio'})).data.id;
 assert.equal((await request('/'+id+'/audio',u,{})).status,409);
 await request('/'+id+'/join',u,{});
 const response=await request('/'+id+'/audio',u,{});assert.equal(response.status,200);
 const [header,body,signature]=response.data.token.split('.'),claims=JSON.parse(Buffer.from(body,'base64url'));
 assert.equal(createHmac('sha256',secret).update(header+'.'+body).digest('base64url'),signature);
 assert.equal(claims.sub,String(u.id));assert.equal(claims.name,'Audio');assert.equal(claims.video.room,'vdk-meeting-'+id);
 assert.deepEqual(claims.video.canPublishSources,['microphone']);assert.equal(claims.video.roomAdmin,undefined);assert.equal(claims.video.canPublishData,false);
 assert.ok(claims.exp-Math.floor(Date.now()/1000)<=300);assert.ok(!JSON.stringify(response).includes(secret));
});
test('Swedish meeting time is independent of device timezone and rejects nonexistent DST time',()=>{
 assert.equal(swedishMeetingTime('2026-11-23T18:00'),'2026-11-23T17:00:00.000Z');
 assert.equal(swedishMeetingTime('2026-07-23T18:00'),'2026-07-23T16:00:00.000Z');
 assert.throws(()=>swedishMeetingTime('2026-03-29T02:30'),/sommartid/);
});

test('meeting invitation is opt in, validates recipients, and queues only selected members once',async t=>{
 const {db,request,member,env}=fixture(t,{RESEND_API_KEY:'test-only',EMAIL_FROM:'VDK <konto@vdk.nu>'});
 const host=member('Host'),one=member('Erik'),two=member('Sara','support');
 db.prepare('UPDATE users SET password_hash=?').run('test-account');
 const without=(await request('',host,{title:'Utan mejl',sendInvites:false,inviteeIds:[one.id]})).data.id;
 assert.equal(db.prepare('SELECT count(*) n FROM meeting_invitations').get().n,0);
 assert.equal((await request('',host,{title:'Fel val',sendInvites:true,inviteeIds:[999999]})).status,400);
 assert.equal((await request('',host,{title:'Inget val',sendInvites:true,inviteeIds:[]})).status,400);
 const created=await request('',host,{title:'Medlemsträff',sendInvites:true,inviteeIds:[one.id,one.id]});
 assert.equal(created.status,201);assert.equal(created.data.queuedInvitations,1);
 const id=created.data.id;
 assert.equal((await request('/'+id+'/invite',one,{sendInvites:true,inviteeIds:[two.id]})).status,403);
 assert.equal((await request('/'+id+'/invite',host,{sendInvites:true,inviteeIds:[one.id]})).data.queuedInvitations,0);
 const sent=[],owner={db,env,meetingMailer:async m=>sent.push(m)};
 assert.equal(await deliverMeetingInvitation(owner),true);assert.equal(sent.length,1);assert.equal(sent[0].to,'Erik@example.test');
 assert.match(sent[0].text,/svensk tid/);assert.match(sent[0].html,/https:\/\/vdk.nu/);
 assert.equal(await deliverMeetingInvitation(owner),false);
 assert.equal(db.prepare('SELECT status FROM meeting_invitations WHERE room_id=?').get(id).status,'sent');
 assert.equal((await request('/'+without+'/invite',host,{sendInvites:false,inviteeIds:[two.id]})).data.queuedInvitations,0);
});
test('meeting emails retry safely, and ended meetings cancel queued invitations',async t=>{
 const {db,request,member,env}=fixture(t,{RESEND_API_KEY:'test-only',EMAIL_FROM:'VDK <konto@vdk.nu>'});
 const host=member('Host'),guest=member('Guest');db.prepare('UPDATE users SET password_hash=?').run('test-account');
 const id=(await request('',host,{title:'Retry',sendInvites:true,inviteeIds:[guest.id]})).data.id;
 await deliverMeetingInvitation({db,env,meetingMailer:async()=>{throw Error('temporary');}});
 const job=db.prepare('SELECT * FROM meeting_invitations').get();assert.equal(job.status,'pending');assert.equal(job.attempts,1);assert.ok(job.next_attempt>Date.now());
 await request('/'+id+'/end',host,{});db.prepare('UPDATE meeting_invitations SET next_attempt=0').run();
 let mailed=false;await deliverMeetingInvitation({db,env,meetingMailer:async()=>{mailed=true;}});
 assert.equal(mailed,false);assert.equal(db.prepare('SELECT status FROM meeting_invitations').get().status,'cancelled');
});
test('speaker order pins leader first and moves live speakers above other attendees',()=>{
 const people=[{id:3},{id:2},{id:1},{id:4}];
 assert.deepEqual(orderedMeetingPeople(people,1,[4,2]).map(p=>p.id),[1,2,4,3]);
 assert.deepEqual(people.map(p=>p.id),[3,2,1,4]);
 const m=meetingInvitationEmail({room:{id:'test',title:'<script>',starts_at:'2026-11-23T17:00:00Z',description:'<img>'},recipient:{name:'<unsafe>',email:'x@example.test'},host:{name:'VDK'}});
 assert.match(m.text,/18:00/);assert.match(m.text,/23 november 2026/);assert.ok(!m.html.includes('<script>'));assert.ok(!m.html.includes('<img>'));assert.ok(m.html.includes('&lt;unsafe&gt;'));
});
