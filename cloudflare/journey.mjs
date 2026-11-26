import catalog from '../data-catalogs/journey-2026-27.json' with {type:'json'};
import {normalizeName} from '../server/stats-source.mjs';
const kinds=['halls','clubs','colleagues'];
export function initializeJourney(db){
 db.exec(`CREATE TABLE IF NOT EXISTS match_referees(match_id INTEGER NOT NULL,referee_id INTEGER NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,PRIMARY KEY(match_id,referee_id));
 CREATE TABLE IF NOT EXISTS journey_manual_selections(user_id INTEGER NOT NULL,kind TEXT NOT NULL,item_key TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,kind,item_key));
 CREATE TABLE IF NOT EXISTS journey_manual_items(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,kind,normalized_name));
 CREATE TABLE IF NOT EXISTS journey_referee_directory(id INTEGER PRIMARY KEY,name TEXT NOT NULL,normalized_name TEXT NOT NULL);`);
}
export function badgeProgress(done,total){
 const levels=[['bronze','Brons',1],['silver','Silver',Math.max(1,Math.ceil(total*.6))],['gold','Guld',total]].map(([id,label,target])=>({id,label,target,earned:total>0&&done>=target}));
 return {done,total,percent:total?Math.round(done/total*100):0,tier:done===0?'none':done>=total?'gold':done>=Math.ceil(total*.6)?'silver':'bronze',levels,next:levels.find(l=>!l.earned)||null};
}
function catalogues(db,user,target=catalog){
 // Keep every discovered referee, including retired/deceased people and names from older seasons.
 // No network request: the directory uses only the match bank already held by VDK.
 db.exec(`INSERT INTO journey_referee_directory(id,name,normalized_name)
 SELECT referee_id,name,normalized_name FROM (SELECT r.*,ROW_NUMBER() OVER(PARTITION BY r.referee_id ORDER BY m.starts_at DESC,r.match_id DESC) AS pos FROM match_referees r JOIN matches m ON m.id=r.match_id WHERE r.referee_id>0 AND trim(r.name)!='') WHERE pos=1
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,normalized_name=excluded.normalized_name;`);
 const profile=db.prepare('SELECT referee_id FROM stats_profiles WHERE user_id=?').get(user.id);
 const colleagues=db.prepare('SELECT id,name,normalized_name FROM journey_referee_directory').all().filter(r=>r.id!==Number(profile?.referee_id)&&r.normalized_name!==normalizeName(user.name)).map(r=>({key:String(r.id),name:r.name}));
 const lists={halls:target.halls.map(h=>({key:String(h.id),name:h.name,city:h.city||''})),clubs:target.clubs.map(c=>({key:String(c.id),name:c.name})),colleagues};
 for(const item of db.prepare('SELECT id,kind,name FROM journey_manual_items WHERE user_id=?').all(user.id))lists[item.kind]?.push({key:'custom:'+item.id,name:item.name,custom:true});
 for(const kind of kinds)lists[kind].sort((a,b)=>a.name.localeCompare(b.name,'sv'));
 return lists;
}
export function journeyView(db,user,_params,{target=catalog}={}){
 const lists=catalogues(db,user,target),selections=db.prepare('SELECT kind,item_key FROM journey_manual_selections WHERE user_id=?').all(user.id),selected=new Set(selections.map(s=>s.kind+':'+s.item_key)),progress={};
 for(const kind of kinds){lists[kind]=lists[kind].map(x=>({...x,selected:selected.has(kind+':'+x.key)}));progress[kind]=badgeProgress(lists[kind].filter(x=>x.selected).length,lists[kind].length);}
 return {mode:'manual',...lists,progress,doubleSilver:progress.halls.tier==='gold'&&progress.clubs.tier==='gold',catalog:{season:target.season,checkedAt:target.checkedAt},colleagueMilestones:[5,10,20,30,50].map(target=>({target,earned:progress.colleagues.done>=target}))};
}
export async function journeyAction({db,path,req,auth,json,fail,body={}}){
 if(!['/api/journey','/api/journey/selection','/api/journey/items'].includes(path))return false;
 const user=auth(req);if(!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND category='active' AND status='active' AND paid=1").get(user.id,user.season))fail(403,'Min domarresa är för godkända aktiva domarmedlemmar.');
 if(path==='/api/journey'){if(req.method!=='GET')fail(405,'Metoden stöds inte.');json(200,journeyView(db,user));return true;}
 if(req.method!=='POST')fail(405,'Metoden stöds inte.');
 const {kind}=body;if(!kinds.includes(kind))fail(400,'Välj hallar, föreningar eller kollegor.');
 if(path==='/api/journey/selection'){
  if(typeof body.key!=='string'||body.key.length>80||typeof body.selected!=='boolean')fail(400,'Ogiltig markering.');
  const lists=catalogues(db,user);if(!lists[kind].some(x=>x.key===body.key))fail(404,'Posten finns inte i din lista.');
  if(body.selected)db.prepare('INSERT INTO journey_manual_selections VALUES(?,?,?,?) ON CONFLICT(user_id,kind,item_key) DO UPDATE SET updated_at=excluded.updated_at').run(user.id,kind,body.key,new Date().toISOString());
  else db.prepare('DELETE FROM journey_manual_selections WHERE user_id=? AND kind=? AND item_key=?').run(user.id,kind,body.key);
 }else{
  if(typeof body.name!=='string')fail(400,'Skriv ett namn.');const name=body.name.trim().replace(/\s+/g,' '),normalized=normalizeName(name);
  if(name.length<2||name.length>120||/[\x00-\x1f\x7f]/.test(name))fail(400,'Namnet ska innehålla 2–120 tecken.');
  if(kind==='colleagues'&&normalized===normalizeName(user.name))fail(400,'Du kan inte lägga till dig själv som kollega.');
  const lists=catalogues(db,user);if(lists[kind].some(x=>normalizeName(x.name)===normalized))fail(409,'Namnet finns redan. Sök i listan och markera det.');
  if(db.prepare('SELECT count(*) n FROM journey_manual_items WHERE user_id=?').get(user.id).n>=500)fail(400,'Du har nått gränsen för egna tillägg. Kontakta VDK.');
  db.prepare('INSERT INTO journey_manual_items(user_id,kind,name,normalized_name,created_at) VALUES(?,?,?,?,?)').run(user.id,kind,name,normalized,new Date().toISOString());
 }
 json(200,journeyView(db,user));return true;
}
