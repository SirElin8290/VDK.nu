import {normalizeBoard} from '../board-data.js';
import {developmentSteps} from '../development.js';
import {hasMembership,getRoles} from './store.mjs';
export function initializeCoaching(db){
 const fields={coachings:{overview:"TEXT NOT NULL DEFAULT ''",star1:"TEXT NOT NULL DEFAULT ''",star2:"TEXT NOT NULL DEFAULT ''",wish:"TEXT NOT NULL DEFAULT ''",wish_step:'INTEGER',revision:'INTEGER NOT NULL DEFAULT 0',updated_at:'TEXT'},clips:{period:'INTEGER',sort_order:'INTEGER',board_data:'TEXT'}};
 for(const [table,columns] of Object.entries(fields)){const existing=new Set(db.prepare('PRAGMA table_info('+table+')').all().map(x=>x.name));for(const [name,type] of Object.entries(columns))if(!existing.has(name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+type);}
}
export function coachingList(db,where,params=[]){return db.prepare(`SELECT c.*,m.home,m.away,m.season,m.starts_at,m.competition_name,u.name AS coach_name,member.name AS member_name,(SELECT colleague FROM match_members WHERE match_id=c.match_id AND user_id=c.member_id) AS colleague,(SELECT viewed_at FROM coaching_views WHERE coaching_id=c.id AND user_id=c.member_id) AS viewed_at FROM coachings c JOIN matches m ON m.id=c.match_id JOIN users u ON u.id=c.coach_id JOIN users member ON member.id=c.member_id WHERE m.excluded=0 AND datetime(m.starts_at)<=datetime('now') AND (${where}) ORDER BY c.id DESC`).all(...params).map(c=>({...c,clips:db.prepare('SELECT * FROM clips WHERE coaching_id=? ORDER BY coalesce(sort_order,1000000),coalesce(period,1),start_seconds,id').all(c.id).map(({board_data,...clip})=>({...clip,board:board_data?JSON.parse(board_data):null}))}));}
export function coachingAction({db,path,method,body,req,auth,requireMembership,fail,season,transaction,audit}){
 const response=(data,status=200)=>({status,data});
 const historical=id=>db.prepare("SELECT * FROM matches WHERE id=? AND excluded=0 AND datetime(starts_at)<=datetime('now')").get(id);
 const draft=id=>{const u=requireMembership(req,'VIDEO_COACH'),c=db.prepare('SELECT * FROM coachings WHERE id=? AND coach_id=?').get(id,u.id);if(!c||!historical(c.match_id))fail(404,'Uppdraget finns inte.');if(c.status!=='draft')fail(409,'Publicerad coachning kan inte ändras.');if(body.revision!==undefined&&body.revision!==c.revision)fail(409,'Utkastet har ändrats i en annan flik. Öppna uppdraget igen innan du sparar.');return {u,c};};
 const string=(value,max)=>{if(typeof value!=='string'||value.length>max)fail(400,'Text saknas eller är för lång.');return value.trim();};
 const touch=id=>db.prepare('UPDATE coachings SET revision=revision+1,updated_at=? WHERE id=?').run(new Date().toISOString(),id);
 if(path==='/api/coachings'&&method==='GET'){const u=requireMembership(req);return response({coachings:coachingList(db,"c.member_id=? AND c.status='published'",[u.id])});}
 let hit=path.match(/^\/api\/coachings\/(\d+)$/);
 if(hit&&method==='GET'){const u=requireMembership(req),c=coachingList(db,"c.id=? AND c.member_id=? AND c.status='published'",[Number(hit[1]),u.id])[0];if(!c)fail(404,'Coachningen finns inte.');return response({coaching:c});}
 if(path==='/api/coach/work'&&method==='GET'){const u=requireMembership(req,'VIDEO_COACH');return response({coachings:coachingList(db,'c.coach_id=?',[u.id])});}
 hit=path.match(/^\/api\/coach\/work\/(\d+)\/clips\/(\d+)\/board$/);
 if(hit&&method==='POST'){const id=Number(hit[1]),clipId=Number(hit[2]),{u,c}=draft(id);if(!Number.isInteger(body.revision))fail(400,'Utkastets revision krävs.');if(!db.prepare('SELECT 1 FROM clips WHERE id=? AND coaching_id=?').get(clipId,id))fail(404,'Situationen finns inte.');let board=null;if(body.board!==null){try{board=normalizeBoard(body.board);}catch(e){fail(400,e.message);}}transaction(db,()=>{db.prepare('UPDATE clips SET board_data=? WHERE id=? AND coaching_id=?').run(board===null?null:JSON.stringify(board),clipId,id);touch(id);audit(db,u.id,board?'situation_board_saved':'situation_board_removed',id);});return response({ok:true,revision:c.revision+1});}
 hit=path.match(/^\/api\/coach\/work\/(\d+)(?:\/(save|clips|publish|order)(?:\/(\d+)(?:\/(delete))?)?)?$/);
 if(hit){const id=Number(hit[1]),op=hit[2],clipId=Number(hit[3]);
  if(method==='GET'&&!op){const u=requireMembership(req,'VIDEO_COACH'),c=coachingList(db,'c.id=? AND c.coach_id=?',[id,u.id])[0];if(!c)fail(404,'Uppdraget finns inte.');return response({coaching:c});}
  if(method!=='POST')return null;
  const {u,c}=draft(id);
  if(op==='save'){
   const values=['overview','star1','star2','wish'].map(k=>string(body[k]??'',k==='overview'?10000:5000));const step=body.wishStep??null;if(step!==null&&(!Number.isInteger(step)||!developmentSteps[step]))fail(400,'Välj ett giltigt utvecklingsområde.');
   transaction(db,()=>{db.prepare('UPDATE coachings SET overview=?,star1=?,star2=?,wish=?,wish_step=? WHERE id=?').run(...values,step,id);touch(id);audit(db,u.id,'coaching_draft_saved',id);});return response({ok:true,revision:c.revision+1});
  }
  if(op==='clips'){
   if(clipId&&!db.prepare('SELECT 1 FROM clips WHERE id=? AND coaching_id=?').get(clipId,id))fail(404,'Situationen finns inte.');
   if(hit[4]==='delete'){transaction(db,()=>{db.prepare('DELETE FROM clips WHERE id=? AND coaching_id=?').run(clipId,id);touch(id);});return response({ok:true,revision:c.revision+1});}
   const period=body.period,seconds=body.seconds;
   if(!Number.isInteger(period)||period<1||period>5||!Number.isInteger(seconds)||seconds<0||seconds>3599)fail(400,'Ange period 1–5 och matchtid i mm:ss.');
   const comment=string(body.comment,5000);if(!comment)fail(400,'Skriv en kommentar.');
   let savedClipId=clipId;transaction(db,()=>{if(clipId)db.prepare('UPDATE clips SET period=?,start_seconds=?,end_seconds=?,comment=? WHERE id=? AND coaching_id=?').run(period,seconds,seconds+1,comment,clipId,id);else{const max=db.prepare('SELECT max(sort_order) AS n FROM clips WHERE coaching_id=?').get(id).n;savedClipId=Number(db.prepare("INSERT INTO clips(coaching_id,period,start_seconds,end_seconds,category,comment,audio_url,sort_order) VALUES(?,?,?,?,'',?,'',?)").run(id,period,seconds,seconds+1,comment,max===null?null:max+1).lastInsertRowid);}touch(id);audit(db,u.id,clipId?'situation_updated':'situation_created',id);});return response({ok:true,clipId:savedClipId,revision:c.revision+1});
  }
  if(op==='order'){
   const ids=body.ids,actual=db.prepare('SELECT id FROM clips WHERE coaching_id=?').all(id).map(x=>x.id);if(!Array.isArray(ids)||ids.length!==actual.length||new Set(ids).size!==actual.length||ids.some(x=>!actual.includes(x)))fail(400,'Ordningen måste innehålla alla uppdragets situationer en gång.');transaction(db,()=>{for(const [i,n]of ids.entries())db.prepare('UPDATE clips SET sort_order=? WHERE id=? AND coaching_id=?').run(i,n,id);touch(id);});return response({ok:true,revision:c.revision+1});
  }
  if(op==='publish'){
   const clips=db.prepare('SELECT * FROM clips WHERE coaching_id=?').all(id);if(!clips.length||clips.some(s=>!s.period||!s.comment.trim())||[c.overview,c.star1,c.star2,c.wish].some(x=>!x.trim()))fail(400,'Fyll i minst en situation med period och tid, helhetsbild, Star 1, Star 2 och Wish före publicering.');
   transaction(db,()=>{db.prepare("UPDATE coachings SET status='published',published_at=?,revision=revision+1 WHERE id=?").run(new Date().toISOString(),id);db.prepare('INSERT INTO notifications(user_id,message) VALUES(?,?)').run(c.member_id,`Ny videocoachning: ${clips.length} situationer analyserade, två styrkor och ett utvecklingsfokus.`);audit(db,u.id,'coaching_published',id);});return response({ok:true});
  }
 }
 if(path==='/api/admin/coaching-options'&&method==='GET'){auth(req,'ADMIN');return response({matches:db.prepare("SELECT m.* FROM matches m WHERE excluded=0 AND datetime(starts_at)<=datetime('now') AND EXISTS(SELECT 1 FROM match_members mm JOIN memberships ms ON ms.user_id=mm.user_id WHERE mm.match_id=m.id AND ms.season=? AND ms.status='active' AND ms.paid=1 AND ms.category!='business') ORDER BY starts_at DESC").all(season),coaches:db.prepare("SELECT u.id,u.name FROM users u JOIN roles r ON r.user_id=u.id WHERE r.role='VIDEO_COACH'").all().filter(u=>hasMembership(db,u.id,season)||getRoles(db,u.id).includes('ADMIN')),members:db.prepare("SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.season=? AND m.status='active' AND m.paid=1 AND m.category!='business'").all(season),participants:db.prepare("SELECT mm.match_id,mm.user_id FROM match_members mm JOIN matches m ON m.id=mm.match_id WHERE m.excluded=0 AND datetime(m.starts_at)<=datetime('now')").all()});}
 if(path==='/api/admin/coachings'){const admin=auth(req,'ADMIN');if(method==='GET')return response({coachings:coachingList(db,'1=1')});if(method==='POST'){
  const m=historical(body.matchId);if(!m)fail(400,'Välj en verifierad historisk match.');if(!getRoles(db,body.coachId).includes('VIDEO_COACH')||(!hasMembership(db,body.coachId,season)&&!getRoles(db,body.coachId).includes('ADMIN')))fail(400,'Välj en aktiv videocoach.');if(!hasMembership(db,body.memberId,season)||!db.prepare('SELECT 1 FROM match_members WHERE match_id=? AND user_id=?').get(m.id,body.memberId))fail(400,'En aktiv medlem som dömt matchen krävs.');
  const video=string(body.videoUrl??'',2000),rights=string(body.rightsNote??'',1000);if(video){let url;try{url=new URL(video);}catch{fail(400,'Ogiltig videolänk.');}if(url.protocol!=='https:'||url.username||url.password)fail(400,'Videolänken måste använda HTTPS.');if(body.rightsConfirmed!==true||rights.length<5)fail(400,'Dokumentera tillståndet för den externa videokällan.');}
  const result=db.prepare('INSERT INTO coachings(match_id,coach_id,member_id,video_url,rights_note) VALUES(?,?,?,?,?)').run(m.id,body.coachId,body.memberId,video,rights);audit(db,admin.id,'coaching_assigned',Number(result.lastInsertRowid));return response({id:Number(result.lastInsertRowid)},201);
 }}
 hit=path.match(/^\/api\/admin\/members\/(\d+)\/role$/);
 if(hit&&method==='POST'){const admin=auth(req,'ADMIN'),id=Number(hit[1]);if(!['VIDEO_COACH','MEMBER'].includes(body.role)||body.enabled!==undefined&&typeof body.enabled!=='boolean')fail(400,'Endast videocoachrollen kan hanteras här.');const enabled=body.role==='VIDEO_COACH'&&body.enabled!==false;if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(id))fail(404,'Medlemmen finns inte.');if(enabled&&!hasMembership(db,id,season)&&!getRoles(db,id).includes('ADMIN'))fail(409,'Ett aktivt medlemskap krävs.');if(enabled)db.prepare("INSERT OR IGNORE INTO roles VALUES(?,'VIDEO_COACH')").run(id);else db.prepare("DELETE FROM roles WHERE user_id=? AND role='VIDEO_COACH'").run(id);audit(db,admin.id,enabled?'video_coach_granted':'video_coach_removed',id);return response({ok:true});}
 return null;
}
