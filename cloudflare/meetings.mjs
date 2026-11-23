import {createHmac,randomUUID} from 'node:crypto';

const PRESENCE=120000,MAX_PEOPLE=40,MAX_HOURS=4;
const roomName=id=>'vdk-meeting-'+id;
export function initializeMeetings(db){
 db.exec(`CREATE TABLE IF NOT EXISTS meeting_rooms(
 id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',host_id INTEGER NOT NULL REFERENCES users(id),
 created_by INTEGER NOT NULL REFERENCES users(id),starts_at TEXT NOT NULL,created_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'open',opened_at INTEGER,ended_at INTEGER,current_speaker INTEGER REFERENCES users(id));
 CREATE INDEX IF NOT EXISTS meetings_by_start ON meeting_rooms(status,starts_at);
 CREATE TABLE IF NOT EXISTS meeting_attendees(room_id TEXT NOT NULL REFERENCES meeting_rooms(id),user_id INTEGER NOT NULL REFERENCES users(id),
 joined_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,PRIMARY KEY(room_id,user_id));
 CREATE INDEX IF NOT EXISTS meeting_presence ON meeting_attendees(room_id,last_seen);
 CREATE TABLE IF NOT EXISTS meeting_hands(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES meeting_rooms(id),
 user_id INTEGER NOT NULL REFERENCES users(id),raised_at INTEGER NOT NULL,UNIQUE(room_id,user_id));
 CREATE INDEX IF NOT EXISTS meeting_queue ON meeting_hands(room_id,id);
 CREATE TABLE IF NOT EXISTS meeting_chat(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL REFERENCES meeting_rooms(id),
 user_id INTEGER NOT NULL REFERENCES users(id),body TEXT NOT NULL,client_id TEXT NOT NULL,created_at INTEGER NOT NULL,
 UNIQUE(room_id,user_id,client_id));
 CREATE INDEX IF NOT EXISTS meeting_chat_cursor ON meeting_chat(room_id,id);`);
}
export function meetingToken(env,claims,lifetime=300){
 const now=Math.floor(Date.now()/1000);
 const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 const head=b64({alg:'HS256',typ:'JWT'}),body=b64({iss:env.LIVEKIT_API_KEY,nbf:now-10,exp:now+lifetime,...claims});
 return head+'.'+body+'.'+createHmac('sha256',env.LIVEKIT_API_SECRET).update(head+'.'+body).digest('base64url');
}
function audioReady(env){try{const u=new URL(env.LIVEKIT_URL);return u.protocol==='wss:'&&u.hostname.endsWith('.livekit.cloud')&&!!env.LIVEKIT_API_KEY&&!!env.LIVEKIT_API_SECRET;}catch{return false;}}
async function deleteAudio(env,id){
 if(!audioReady(env))return;
 const url=new URL(env.LIVEKIT_URL);url.protocol='https:';
 const token=meetingToken(env,{video:{roomCreate:true}},60);
 const r=await fetch(new URL('/twirp/livekit.RoomService/DeleteRoom',url),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({room:roomName(id)}),signal:AbortSignal.timeout(10000)});
 if(!r.ok&&r.status!==404)throw Error('Ljudrummet kunde inte avslutas. Försök igen.');
}
function roomView(db,room,now){
 return {...room,host_name:db.prepare('SELECT name FROM users WHERE id=?').get(room.host_id)?.name||'',participants:db.prepare('SELECT count(*) AS n FROM meeting_attendees WHERE room_id=? AND last_seen>?').get(room.id,now-PRESENCE).n};
}
function roomState(db,room,user,params,env){
 const now=Date.now(),view=roomView(db,room,now),cursor=Number(params.get('after'))||0;
 const people=db.prepare('SELECT a.user_id AS id,u.name FROM meeting_attendees a JOIN users u ON u.id=a.user_id WHERE a.room_id=? AND a.last_seen>? ORDER BY a.joined_at,a.user_id').all(room.id,now-PRESENCE);
 const queue=db.prepare('SELECT h.id,h.user_id,u.name FROM meeting_hands h JOIN users u ON u.id=h.user_id JOIN meeting_attendees a ON a.room_id=h.room_id AND a.user_id=h.user_id WHERE h.room_id=? AND a.last_seen>? ORDER BY h.id').all(room.id,now-PRESENCE);
 const messages=cursor?db.prepare('SELECT c.id,c.user_id,u.name,c.body,c.created_at FROM meeting_chat c JOIN users u ON u.id=c.user_id WHERE c.room_id=? AND c.id>? ORDER BY c.id LIMIT 100').all(room.id,cursor):db.prepare('SELECT c.id,c.user_id,u.name,c.body,c.created_at FROM meeting_chat c JOIN users u ON u.id=c.user_id WHERE c.room_id=? ORDER BY c.id DESC LIMIT 100').all(room.id).reverse();
 const joined=people.some(p=>p.id===user.id);
 const speaker=room.current_speaker&&people.find(p=>p.id===room.current_speaker)||null;
 return {room:view,people,queue,messages,joined,speaker,canLead:room.host_id===user.id||user.roles.includes('ADMIN'),audioConfigured:audioReady(env),maxParticipants:MAX_PEOPLE};
}
export async function meetingsAction({db,path,method,body,req,requireMembership,fail,json,url,env,rate}){
 if(!/^\/api\/meetings(?:\/|$)/.test(path))return false;
 const user=requireMembership(req),now=Date.now();
 const text=(v,min,max)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)fail(400,'Kontrollera mötets uppgifter.');return v.trim();};
 if(path==='/api/meetings'){
  if(method==='GET'){
   const rooms=db.prepare("SELECT * FROM meeting_rooms WHERE status='open' OR ended_at>? ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,starts_at LIMIT 80").all(now-7*86400000).map(r=>roomView(db,r,now));
   return json(200,{rooms,audioConfigured:audioReady(env),maxParticipants:MAX_PEOPLE}),true;
  }
  rate(req,'meeting-create-'+user.id,12);
  const title=text(body.title,2,120),description=text(body.description||'',0,2000);
  const start=body.startsAt?Date.parse(body.startsAt):now;
  if(!Number.isFinite(start)||start<now-86400000||start>now+366*86400000)fail(400,'Välj en giltig tid för mötet.');
  if(db.prepare("SELECT count(*) n FROM meeting_rooms WHERE created_by=? AND status='open'").get(user.id).n>=10)fail(409,'Du har redan tio öppna möten. Avsluta ett innan du skapar fler.');
  const id=randomUUID();
  db.prepare('INSERT INTO meeting_rooms(id,title,description,host_id,created_by,starts_at,created_at) VALUES(?,?,?,?,?,?,?)').run(id,title,description,user.id,user.id,new Date(start).toISOString(),now);
  return json(201,{id}),true;
 }
 const match=path.match(/^\/api\/meetings\/([0-9a-f-]{36})(?:\/(join|pulse|leave|chat|hand|next|host|end|audio))?$/);
 if(!match)fail(404,'Mötet hittades inte.');
 const id=match[1],action=match[2];
 let room=db.prepare('SELECT * FROM meeting_rooms WHERE id=?').get(id);
 if(!room)fail(404,'Mötet hittades inte.');
 // Expired calls cannot continue to issue new connection tokens.
 if(room.status==='open'&&room.opened_at&&now-room.opened_at>MAX_HOURS*3600000){
  await deleteAudio(env,id);
  db.prepare("UPDATE meeting_rooms SET status='ended',ended_at=?,current_speaker=NULL WHERE id=?").run(now,id);
  db.prepare('DELETE FROM meeting_hands WHERE room_id=?').run(id);
  room=db.prepare('SELECT * FROM meeting_rooms WHERE id=?').get(id);
 }
 if(method==='GET'&&!action)return json(200,roomState(db,room,user,url.searchParams,env)),true;
 if(method!=='POST'||!action)fail(405,'Metoden stöds inte.');
 if(action==='leave'){
  db.prepare('DELETE FROM meeting_attendees WHERE room_id=? AND user_id=?').run(id,user.id);
  db.prepare('DELETE FROM meeting_hands WHERE room_id=? AND user_id=?').run(id,user.id);
  db.prepare('UPDATE meeting_rooms SET current_speaker=NULL WHERE id=? AND current_speaker=?').run(id,user.id);
  return json(200,{ok:true}),true;
 }
 if(room.status!=='open'){if(action==='pulse')return json(200,roomState(db,room,user,url.searchParams,env)),true;fail(409,'Mötet är avslutat.');}
 if(action==='join'){
  const own=db.prepare('SELECT 1 FROM meeting_attendees WHERE room_id=? AND user_id=? AND last_seen>?').get(id,user.id,now-PRESENCE);
  if(!own&&db.prepare('SELECT count(*) n FROM meeting_attendees WHERE room_id=? AND last_seen>?').get(id,now-PRESENCE).n>=MAX_PEOPLE)fail(409,'Mötet är fullt. Högst 40 deltagare kan vara med.');
  db.prepare('DELETE FROM meeting_hands WHERE room_id=? AND user_id IN (SELECT user_id FROM meeting_attendees WHERE room_id=? AND last_seen<=?)').run(id,id,now-PRESENCE);
  db.prepare('INSERT INTO meeting_attendees VALUES(?,?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET joined_at=CASE WHEN last_seen<=? THEN excluded.joined_at ELSE joined_at END,last_seen=excluded.last_seen').run(id,user.id,now,now,now-PRESENCE);
  db.prepare('UPDATE meeting_rooms SET opened_at=COALESCE(opened_at,?) WHERE id=?').run(Math.max(now,Date.parse(room.starts_at)),id);
  return json(200,roomState(db,db.prepare('SELECT * FROM meeting_rooms WHERE id=?').get(id),user,url.searchParams,env)),true;
 }
 if(['next','host','end'].includes(action)&&room.host_id!==user.id&&!user.roles.includes('ADMIN'))fail(403,'Bara mötesledaren eller en administratör kan göra det.');
 const attendee=db.prepare('SELECT 1 FROM meeting_attendees WHERE room_id=? AND user_id=? AND last_seen>?').get(id,user.id,now-PRESENCE);
 if(!attendee&&action!=='end')fail(409,'Gå med i mötet först.');
 if(action==='pulse'){
  db.prepare('UPDATE meeting_attendees SET last_seen=? WHERE room_id=? AND user_id=?').run(now,id,user.id);
  return json(200,roomState(db,room,user,url.searchParams,env)),true;
 }
 if(action==='chat'){
  rate(req,'meeting-chat-'+user.id,150);
  const message=text(body.message,1,3000),clientId=text(body.clientId,10,80);
  db.prepare('INSERT OR IGNORE INTO meeting_chat(room_id,user_id,body,client_id,created_at) VALUES(?,?,?,?,?)').run(id,user.id,message,clientId,now);
  return json(201,{ok:true}),true;
 }
 if(action==='hand'){
  if(typeof body.raised!=='boolean')fail(400,'Välj om handen ska vara uppe eller nere.');
  if(body.raised)db.prepare('INSERT OR IGNORE INTO meeting_hands(room_id,user_id,raised_at) VALUES(?,?,?)').run(id,user.id,now);
  else db.prepare('DELETE FROM meeting_hands WHERE room_id=? AND user_id=?').run(id,user.id);
  return json(200,{ok:true}),true;
 }
 if(action==='next'){
  const first=db.prepare('SELECT h.id,h.user_id FROM meeting_hands h JOIN meeting_attendees a ON a.room_id=h.room_id AND a.user_id=h.user_id WHERE h.room_id=? AND a.last_seen>? ORDER BY h.id LIMIT 1').get(id,now-PRESENCE);
  if(body.queueId!=null){
   const selected=db.prepare('SELECT id FROM meeting_hands WHERE room_id=? AND id=?').get(id,Number(body.queueId));
   if(!selected)fail(409,'Personen har redan lämnat talarlistan.');
   db.prepare('DELETE FROM meeting_hands WHERE room_id=? AND id=?').run(id,selected.id);
  }else{
   if(first)db.prepare('DELETE FROM meeting_hands WHERE id=?').run(first.id);
   db.prepare('UPDATE meeting_rooms SET current_speaker=? WHERE id=?').run(first?.user_id||null,id);
  }
  return json(200,{ok:true}),true;
 }
 if(action==='host'){
  if(!db.prepare('SELECT 1 FROM meeting_attendees WHERE room_id=? AND user_id=? AND last_seen>?').get(id,Number(body.userId),now-PRESENCE))fail(400,'Välj en deltagare som är med i mötet.');
  db.prepare('UPDATE meeting_rooms SET host_id=? WHERE id=?').run(Number(body.userId),id);
  return json(200,{ok:true}),true;
 }
 if(action==='end'){
  await deleteAudio(env,id);
  db.prepare("UPDATE meeting_rooms SET status='ended',ended_at=?,current_speaker=NULL WHERE id=?").run(now,id);
  db.prepare('DELETE FROM meeting_hands WHERE room_id=?').run(id);
  return json(200,{ok:true}),true;
 }
 if(action==='audio'){
  rate(req,'meeting-audio-'+user.id,50);
  if(!audioReady(env))fail(503,'Ljudet är inte anslutet ännu. Textchatten och talarlistan fungerar.');
  const token=meetingToken(env,{sub:String(user.id),name:user.name,video:{roomJoin:true,room:roomName(id),canPublish:true,canPublishSources:['microphone'],canSubscribe:true,canPublishData:false},roomConfig:{maxParticipants:MAX_PEOPLE,emptyTimeout:60,departureTimeout:20}});
  return json(200,{url:env.LIVEKIT_URL,token}),true;
 }
 fail(404,'Mötesfunktionen hittades inte.');
}
