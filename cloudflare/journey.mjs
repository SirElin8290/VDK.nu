import catalog from '../data-catalogs/journey-history.json' with {type:'json'};
import {normalizeName} from '../server/stats-source.mjs';
const kinds=['halls','clubs','colleagues'];
export function initializeJourney(db){
 db.exec(`CREATE TABLE IF NOT EXISTS match_referees(match_id INTEGER NOT NULL,referee_id INTEGER NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,PRIMARY KEY(match_id,referee_id));
 CREATE TABLE IF NOT EXISTS journey_manual_selections(user_id INTEGER NOT NULL,kind TEXT NOT NULL,item_key TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,kind,item_key));
 CREATE TABLE IF NOT EXISTS journey_manual_items(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,kind,normalized_name));
 CREATE TABLE IF NOT EXISTS journey_referee_directory(id INTEGER PRIMARY KEY,name TEXT NOT NULL,normalized_name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS journey_catalog_overrides(kind TEXT NOT NULL,item_key TEXT NOT NULL,scope TEXT NOT NULL,municipality TEXT,reviewed_at TEXT NOT NULL,actor_id INTEGER NOT NULL,PRIMARY KEY(kind,item_key));
 CREATE TABLE IF NOT EXISTS journey_global_items(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,scope TEXT NOT NULL,municipality TEXT,actor_id INTEGER NOT NULL);`);
 const cols=new Set(db.prepare('PRAGMA table_info(journey_manual_items)').all().map(x=>x.name));
 if(!cols.has('scope'))db.exec("ALTER TABLE journey_manual_items ADD COLUMN scope TEXT NOT NULL DEFAULT 'legends'");
 if(!cols.has('municipality'))db.exec('ALTER TABLE journey_manual_items ADD COLUMN municipality TEXT');
 const refs=new Set(db.prepare('PRAGMA table_info(journey_referee_directory)').all().map(x=>x.name));if(!refs.has('regional'))db.exec('ALTER TABLE journey_referee_directory ADD COLUMN regional INTEGER NOT NULL DEFAULT 0');
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
 db.exec("UPDATE journey_referee_directory SET regional=1 WHERE regional=0 AND id IN (SELECT r.referee_id FROM match_referees r JOIN matches m ON m.id=r.match_id WHERE m.excluded=0 AND (m.competition_scope='district' OR m.regional_eligible=1))");
 const profile=db.prepare('SELECT referee_id FROM stats_profiles WHERE user_id=?').get(user.id);
 const current=new Set(db.prepare('SELECT DISTINCT r.referee_id FROM match_referees r JOIN matches m ON m.id=r.match_id WHERE m.season=? AND m.excluded=0').all(user.season).map(r=>r.referee_id));
 const future=new Set();const snapshot=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='availability_snapshot'").get()?db.prepare('SELECT data FROM availability_snapshot WHERE id=1').get():null;if(snapshot)for(const m of JSON.parse(snapshot.data).rows||[])for(const name of m.referees||[])future.add(normalizeName(name));
 const retained=new Set(db.prepare("SELECT item_key FROM journey_manual_selections WHERE user_id=? AND kind='colleagues'").all(user.id).map(x=>x.item_key));
 const colleagues=db.prepare('SELECT id,name,normalized_name,regional FROM journey_referee_directory').all().filter(r=>(r.regional||retained.has(String(r.id)))&&r.id!==Number(profile?.referee_id)&&r.normalized_name!==normalizeName(user.name)).map(r=>({key:String(r.id),name:r.name,scope:current.has(r.id)||future.has(r.normalized_name)?'active':'legends',reviewNote:current.has(r.id)||future.has(r.normalized_name)?'Förekommer i årets matchunderlag.':'Historiskt matchunderlag; aktuell aktivitet inte bekräftad.'}));
 const lists={halls:target.halls.map(h=>({...h,key:h.key||String(h.id),scope:h.scope||'active',city:h.city||''})),clubs:target.clubs.map(c=>({...c,key:c.key||String(c.id),scope:c.scope||'active'})),colleagues};
 for(const item of db.prepare('SELECT * FROM journey_global_items').all())lists[item.kind]?.push({...item,key:'extra:'+item.id,global:true});
 for(const item of db.prepare('SELECT id,kind,name,scope,municipality FROM journey_manual_items WHERE user_id=?').all(user.id))lists[item.kind]?.push({...item,key:'custom:'+item.id,custom:true});
 const overrides=new Map(db.prepare('SELECT * FROM journey_catalog_overrides').all().map(x=>[x.kind+':'+x.item_key,x]));
 for(const kind of kinds){for(const item of lists[kind]){const override=overrides.get(kind+':'+item.key);if(override){item.scope=override.scope;item.municipality=override.municipality||item.municipality;item.reviewNote='Klassificerad av VDK.';}if(item.municipality)item.municipalityName=catalog.municipalities.find(m=>m.id===item.municipality)?.name;}lists[kind].sort((a,b)=>a.name.localeCompare(b.name,'sv'));}
 return lists;
}
export function municipalityProgress(halls,clubs,municipalities=catalog.municipalities){return municipalities.map(m=>{const hs=halls.filter(h=>h.scope==='active'&&h.municipality===m.id),cs=clubs.filter(c=>c.scope==='active'&&c.municipality===m.id),done=hs.filter(h=>h.selected).length;return {...m,total:hs.length,done,clubTotal:cs.length,clubDone:cs.filter(c=>c.selected).length,state:done===0?'empty':done===hs.length?'complete':'started'};});}
export function journeyView(db,user,_params,{target=catalog}={}){
 const lists=catalogues(db,user,target),selections=db.prepare('SELECT kind,item_key FROM journey_manual_selections WHERE user_id=?').all(user.id),selected=new Set(selections.map(s=>s.kind+':'+s.item_key)),groups={};
 for(const kind of kinds)lists[kind]=lists[kind].map(x=>({...x,selected:selected.has(kind+':'+x.key)}));
 for(const scope of ['active','legends']){const group={progress:{}};for(const kind of kinds){group[kind]=lists[kind].filter(x=>x.scope===scope);group.progress[kind]=badgeProgress(group[kind].filter(x=>x.selected).length,group[kind].length);}group.doubleSilver=group.progress.halls.tier==='gold'&&group.progress.clubs.tier==='gold';groups[scope]=group;}
 return {mode:'manual',...lists,groups,progress:groups.active.progress,doubleSilver:groups.active.doubleSilver,municipalities:municipalityProgress(lists.halls,lists.clubs),canManage:user.roles?.includes('ADMIN')||false,catalog:{season:target.season},colleagueMilestones:[5,10,20,30,50].map(target=>({target,earned:lists.colleagues.filter(x=>x.selected).length>=target}))};
}
export async function journeyAction({db,path,req,auth,json,fail,body={}}){
 if(!['/api/journey','/api/journey/selection','/api/journey/items','/api/journey/classify'].includes(path))return false;
 const user=auth(req);if(!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND category='active' AND status='active' AND paid=1").get(user.id,user.season))fail(403,'Min domarresa är för godkända aktiva domarmedlemmar.');
 if(path==='/api/journey'){if(req.method!=='GET')fail(405,'Metoden stöds inte.');json(200,journeyView(db,user));return true;}
 if(req.method!=='POST')fail(405,'Metoden stöds inte.');
 const {kind}=body;if(!kinds.includes(kind))fail(400,'Välj hallar, föreningar eller kollegor.');
 const scope=body.scope||'legends';
 const municipality=body.municipality||null;
 if(body.scope&&!['active','legends'].includes(scope))fail(400,'Välj Aktiva eller Legends.');
 if(municipality&&!catalog.municipalities.some(m=>m.id===municipality))fail(400,'Välj en kommun i kartområdet.');
 if(path==='/api/journey/classify'){
  const item=catalogues(db,user)[kind].find(x=>x.key===body.key);if(!item)fail(404,'Posten finns inte i din lista.');
  const admin=user.roles?.includes('ADMIN');if(!admin&&!item.custom)fail(403,'Bara admin kan flytta gemensamma poster.');
  const area=municipality||item.municipality||null;if(kind==='halls'&&scope==='active'&&!area)fail(400,'En aktiv hall behöver kopplas till en kommun.');
  if(item.custom)db.prepare('UPDATE journey_manual_items SET scope=?,municipality=? WHERE id=? AND user_id=?').run(scope,area,Number(item.key.slice(7)),user.id);
  else db.prepare('INSERT INTO journey_catalog_overrides VALUES(?,?,?,?,?,?) ON CONFLICT(kind,item_key) DO UPDATE SET scope=excluded.scope,municipality=excluded.municipality,reviewed_at=excluded.reviewed_at,actor_id=excluded.actor_id').run(kind,item.key,scope,area,new Date().toISOString(),user.id);
 }else if(path==='/api/journey/selection'){
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
  if(kind==='halls'&&scope==='active'&&!municipality)fail(400,'Välj kommun för en aktiv hall.');
  if(body.shared){if(!user.roles?.includes('ADMIN'))fail(403,'Bara admin kan lägga till gemensamma poster.');db.prepare('INSERT INTO journey_global_items(kind,name,scope,municipality,actor_id) VALUES(?,?,?,?,?)').run(kind,name,scope,municipality,user.id);}
  else db.prepare('INSERT INTO journey_manual_items(user_id,kind,name,normalized_name,created_at,scope,municipality) VALUES(?,?,?,?,?,?,?)').run(user.id,kind,name,normalized,new Date().toISOString(),scope,municipality);
 }
 json(200,journeyView(db,user));return true;
}
