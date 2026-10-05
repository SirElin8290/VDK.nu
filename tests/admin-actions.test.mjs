import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudStore} from './cloud-fixture.mjs';
import {openStore,hashPassword,newToken,digest} from '../server/store.mjs';
import {createApp as cloudApp} from '../cloudflare/api.mjs';
import {createApp as localApp} from '../server/index.mjs';

for(const [label,store,createApp] of [['Cloudflare',cloudStore,cloudApp],['local',openStore,localApp]]){
 function fixture(t,ownerEmail='sorenjohansson@outlook.com'){
  const db=store();t.after(()=>db.close());
  const app=createApp({db,ownerAdminEmail:ownerEmail,env:{PUBLIC_ORIGIN:'https://vdk.nu',OWNER_ADMIN_EMAIL:ownerEmail},origin:'https://vdk.nu',mailer:async()=>{throw Error('No mail expected');}});
  const handler=app.handler||app.server.listeners('request')[0];
  function user(email,roles=['MEMBER'],status='active',paid=1,season='2026/27'){
   const id=Number(db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(email,email,hashPassword('Existing-password-123')).lastInsertRowid);
   for(const role of roles)db.prepare('INSERT INTO roles VALUES (?,?)').run(id,role);
   const membershipId=Number(db.prepare('INSERT INTO memberships(user_id,season,status,paid,payment_reference,consented_at,approved_at,paid_at,paid_by) VALUES (?,?,?,?,?,?,?,?,?)').run(id,season,status,paid,'REF-'+id,'consent','approved','paid',null).lastInsertRowid);
   return {id,membershipId};
  }
  function session(id){const token=newToken();db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),id,Date.now()+600000);return 'vdk_session='+token;}
  async function request(path,cookie='',body={},method='POST'){
   let status,output;await handler({url:'/api'+path,method,socket:{remoteAddress:'test'},headers:{origin:'https://vdk.nu',cookie,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}},{setHeader(){},writeHead(s){status=s;},end(v){output=v;}});
   return {status,data:JSON.parse(output||'null')};
  }
  return {db,user,session,request};
 }
 test(label+': reactivation preserves account, payment, roles and other members, and does not revive old sessions',async t=>{
  const {db,user,session,request}=fixture(t);const owner=user('sorenjohansson@outlook.com',['ADMIN']);const cookie=session(owner.id);
  const alfred=user('affe.sarnehed@live.se',['MEMBER','VIDEO_COACH']);const other=user('other@example.test');const old=session(alfred.id);
  const before=db.prepare('SELECT * FROM memberships WHERE id=?').get(alfred.membershipId);const account=db.prepare('SELECT * FROM users WHERE id=?').get(alfred.id);const otherBefore=db.prepare('SELECT * FROM memberships WHERE id=?').get(other.membershipId);
  assert.equal((await request(`/admin/applications/${alfred.membershipId}/close`,cookie)).status,200);
  assert.equal((await request(`/admin/applications/${alfred.membershipId}/reactivate`,old)).status,401);
  assert.equal((await request(`/admin/applications/${alfred.membershipId}/reactivate`,cookie)).status,200);
  assert.deepEqual(db.prepare('SELECT * FROM memberships WHERE id=?').get(alfred.membershipId),before);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE id=?').get(alfred.id),account);
  assert.deepEqual(db.prepare('SELECT * FROM memberships WHERE id=?').get(other.membershipId),otherBefore);
  assert.deepEqual(db.prepare('SELECT role FROM roles WHERE user_id=? ORDER BY role').all(alfred.id).map(x=>x.role),['MEMBER','VIDEO_COACH']);
  assert.equal((await request('/me',old,{},'GET')).status,401);
  assert.equal((await request('/auth/login','',{email:'affe.sarnehed@live.se',password:'Existing-password-123'})).status,200);
  assert.equal((await request(`/admin/applications/${alfred.membershipId}/reactivate`,cookie)).status,409);
  for(const [status,paid,season] of [['expired',0,'2026/27'],['pending',1,'2026/27'],['expired',1,'2025/26']]){
   const target=user(status+paid+season+'@example.test',['MEMBER'],status,paid,season);
   assert.equal((await request(`/admin/applications/${target.membershipId}/reactivate`,cookie)).status,season==='2025/26'?404:409);
  }
 });
 test(label+': only configured owner ADMIN can grant admin, preserving MEMBER and account data',async t=>{
  const {db,user,session,request}=fixture(t);const owner=user('sorenjohansson@outlook.com',['ADMIN']);const ownerCookie=session(owner.id);
  const alfred=user('affe.sarnehed@live.se');const other=user('other@example.test');const otherCookie=session(other.id);
  const before=db.prepare('SELECT * FROM users WHERE id=?').get(alfred.id);const membership=db.prepare('SELECT * FROM memberships WHERE id=?').get(alfred.membershipId);
  assert.equal((await request(`/admin/members/${alfred.id}/grant-admin`)).status,401);
  assert.equal((await request(`/admin/members/${alfred.id}/grant-admin`,otherCookie)).status,403);
  assert.equal((await request('/admin/members',ownerCookie,{},'GET')).data.canGrantAdmin,true);
  assert.equal((await request(`/admin/members/${owner.id}/grant-admin`,ownerCookie)).status,400);
  assert.equal((await request('/admin/members/99999/grant-admin',ownerCookie)).status,404);
  assert.equal((await request(`/admin/members/${alfred.id}/grant-admin`,ownerCookie)).status,200);
  assert.equal((await request(`/admin/members/${alfred.id}/grant-admin`,ownerCookie)).status,200);
  assert.deepEqual(db.prepare('SELECT role FROM roles WHERE user_id=? ORDER BY role').all(alfred.id).map(x=>x.role),['ADMIN','MEMBER']);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE id=?').get(alfred.id),before);
  assert.deepEqual(db.prepare('SELECT * FROM memberships WHERE id=?').get(alfred.membershipId),membership);
  const alfredCookie=session(alfred.id);
  assert.equal((await request('/admin/members',alfredCookie,{},'GET')).data.canGrantAdmin,false);
  assert.equal((await request(`/admin/members/${other.id}/grant-admin`,alfredCookie)).status,403);
  assert.equal((await request(`/admin/members/${other.id}/role`,alfredCookie,{role:'ADMIN'})).status,400);
  assert.equal(db.prepare("SELECT count(*) n FROM audit WHERE action='role_ADMIN'").get().n,1);
  const expired=user('expired@example.test',['MEMBER'],'expired');
  assert.equal((await request(`/admin/members/${expired.id}/grant-admin`,ownerCookie)).status,409);
 });
 test(label+': absent owner configuration grants nobody delegation rights',async t=>{
  const {user,session,request}=fixture(t,'');const owner=user('sorenjohansson@outlook.com',['ADMIN']);const target=user('member@example.test');
  assert.equal((await request(`/admin/members/${target.id}/grant-admin`,session(owner.id))).status,403);
 });
}
