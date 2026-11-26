import seriesCatalogue from '../data-catalogs/journey-series.json' with {type:'json'};
import catalog from '../data-catalogs/journey-history.json' with {type:'json'};
import {normalizeName} from '../server/stats-source.mjs';
const kinds=['halls','clubs','colleagues','series'];
export function initializeJourney(db){
 db.exec(`CREATE TABLE IF NOT EXISTS match_referees(match_id INTEGER NOT NULL,referee_id INTEGER NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,PRIMARY KEY(match_id,referee_id));
 CREATE TABLE IF NOT EXISTS journey_manual_selections(user_id INTEGER NOT NULL,kind TEXT NOT NULL,item_key TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,kind,item_key));
 CREATE TABLE IF NOT EXISTS journey_manual_items(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,kind,normalized_name));
 CREATE TABLE IF NOT EXISTS journey_referee_directory(id INTEGER PRIMARY KEY,name TEXT NOT NULL,normalized_name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS journey_catalog_overrides(kind TEXT NOT NULL,item_key TEXT NOT NULL,scope TEXT NOT NULL,municipality TEXT,reviewed_at TEXT NOT NULL,actor_id INTEGER NOT NULL,PRIMARY KEY(kind,item_key));
 CREATE TABLE IF NOT EXISTS journey_proposals(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,scope TEXT NOT NULL,municipality TEXT,evidence TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by INTEGER,review_comment TEXT NOT NULL DEFAULT '',item_key TEXT,legacy_item_id INTEGER UNIQUE);
 CREATE UNIQUE INDEX IF NOT EXISTS journey_pending_unique ON journey_proposals(user_id,kind,normalized_name) WHERE status='pending';
 CREATE TABLE IF NOT EXISTS journey_global_items(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,scope TEXT NOT NULL,municipality TEXT,actor_id INTEGER NOT NULL);`);
 const cols=new Set(db.prepare('PRAGMA table_info(journey_manual_items)').all().map(x=>x.name));
 if(!cols.has('scope'))db.exec("ALTER TABLE journey_manual_items ADD COLUMN scope TEXT NOT NULL DEFAULT 'legends'");
 if(!cols.has('municipality'))db.exec('ALTER TABLE journey_manual_items ADD COLUMN municipality TEXT');
 db.exec("INSERT OR IGNORE INTO journey_proposals(user_id,kind,name,normalized_name,scope,municipality,evidence,created_at,legacy_item_id) SELECT user_id,kind,name,normalized_name,scope,municipality,'Tidigare eget tillägg – behöver granskas.',created_at,id FROM journey_manual_items");
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
 const lists={series:seriesCatalogue.map(x=>({...x})),halls:target.halls.map(h=>({...h,key:h.key||String(h.id),scope:h.scope||'active',city:h.city||''})),clubs:target.clubs.map(c=>({...c,key:c.key||String(c.id),scope:c.scope||'active'})),colleagues};
 for(const item of db.prepare('SELECT * FROM journey_global_items').all())lists[item.kind]?.push({...item,key:'extra:'+item.id,global:true});
 const overrides=new Map(db.prepare('SELECT * FROM journey_catalog_overrides').all().map(x=>[x.kind+':'+x.item_key,x]));
 for(const kind of kinds){for(const item of lists[kind]){const override=overrides.get(kind+':'+item.key);if(override){item.scope=override.scope;item.municipality=override.municipality||item.municipality;item.reviewNote='Klassificerad av VDK.';}if(item.municipality)item.municipalityName=catalog.municipalities.find(m=>m.id===item.municipality)?.name;}lists[kind].sort((a,b)=>a.name.localeCompare(b.name,'sv'));}
 return lists;
}
export function municipalityProgress(halls,clubs,municipalities=catalog.municipalities){return municipalities.map(m=>{const hs=halls.filter(h=>h.scope==='active'&&h.municipality===m.id),cs=clubs.filter(c=>c.scope==='active'&&c.municipality===m.id),done=hs.filter(h=>h.selected).length;return {...m,total:hs.length,done,clubTotal:cs.length,clubDone:cs.filter(c=>c.selected).length,state:done===0?'empty':done===hs.length?'complete':'started'};});}
export function journeyView(db,user,_params,{target=catalog}={}){
 const lists=catalogues(db,user,target),selections=db.prepare('SELECT kind,item_key FROM journey_manual_selections WHERE user_id=?').all(user.id),selected=new Set(selections.map(s=>s.kind+':'+s.item_key)),groups={};
 for(const kind of kinds)lists[kind]=lists[kind].map(x=>({...x,selected:selected.has(kind+':'+x.key)}));
 for(const scope of ['active','legends']){const group={progress:{}};for(const kind of kinds){group[kind]=lists[kind].filter(x=>x.scope===scope);group.progress[kind]=badgeProgress(group[kind].filter(x=>x.selected).length,group[kind].length);}group.doubleSilver=group.progress.halls.tier==='gold'&&group.progress.clubs.tier==='gold';groups[scope]=group;}
 return {proposals:db.prepare("SELECT id,kind,name,scope,status,created_at,reviewed_at,review_comment FROM journey_proposals WHERE user_id=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 200").all(user.id),pendingCount:user.roles?.includes('ADMIN')?db.prepare("SELECT count(*) n FROM journey_proposals WHERE status='pending'").get().n:0,mode:'manual',...lists,groups,progress:groups.active.progress,doubleSilver:groups.active.doubleSilver,municipalities:municipalityProgress(lists.halls,lists.clubs),canManage:user.roles?.includes('ADMIN')||false,catalog:{season:target.season},colleagueMilestones:[5,10,20,30,50].map(target=>({target,earned:lists.colleagues.filter(x=>x.selected).length>=target}))};
}
export async function journeyAction({db,path,req,auth,json,fail,body={}}){
 const reviewMatch=path.match(/^\/api\/journey\/proposals\/(\d+)\/review$/);
 if(path==='/api/journey/proposals'||reviewMatch)return reviewAction({db,path,req,auth,json,fail,body,reviewMatch});
 if(!['/api/journey','/api/journey/selection','/api/journey/items','/api/journey/classify'].includes(path))return false;
 const user=auth(req);if(!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND category='active' AND status='active' AND paid=1").get(user.id,user.season))fail(403,'Min domarresa är för godkända aktiva domarmedlemmar.');
 if(path==='/api/journey'){if(req.method!=='GET')fail(405,'Metoden stöds inte.');json(200,journeyView(db,user));return true;}
 if(req.method!=='POST')fail(405,'Metoden stöds inte.');
 const {kind}=body;if(!kinds.includes(kind))fail(400,'Välj hallar, föreningar, kollegor eller serier.');
 const scope=body.scope||'legends';
 const municipality=body.municipality||null;
 if(body.scope&&!['active','legends'].includes(scope))fail(400,'Välj Aktiva eller Legends.');
 if(municipality&&!catalog.municipalities.some(m=>m.id===municipality))fail(400,'Välj en kommun i kartområdet.');
 if(path==='/api/journey/classify'){
  const item=catalogues(db,user)[kind].find(x=>x.key===body.key);if(!item)fail(404,'Posten finns inte i din lista.');
  const admin=user.roles?.includes('ADMIN');if(!admin)fail(403,'Bara admin kan flytta godkända poster.');
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
  if(db.prepare("SELECT count(*) n FROM journey_proposals WHERE user_id=? AND status='pending'").get(user.id).n>=50)fail(400,'Du har redan 50 förslag som väntar på granskning.');
  if(db.prepare("SELECT 1 FROM journey_proposals WHERE user_id=? AND kind=? AND normalized_name=? AND status='pending'").get(user.id,kind,normalized))fail(409,'Du har redan skickat det här förslaget. Det väntar på adminens granskning.');
  if(kind==='halls'&&scope==='active'&&!municipality)fail(400,'Välj kommun för en aktiv hall.');
  const evidence=body.evidence??'';if(typeof evidence!=='string'||evidence.length>2000)fail(400,'Underlaget får vara högst 2 000 tecken.');
  db.prepare('INSERT INTO journey_proposals(user_id,kind,name,normalized_name,scope,municipality,evidence,created_at) VALUES(?,?,?,?,?,?,?,?)').run(user.id,kind,name,normalized,scope,municipality,evidence.trim(),new Date().toISOString());
 }
 json(200,journeyView(db,user));return true;
}

function reviewList(db){return {proposals:db.prepare("SELECT p.*,u.name AS submitted_by FROM journey_proposals p JOIN users u ON u.id=p.user_id WHERE p.status='pending' OR p.id IN(SELECT id FROM journey_proposals WHERE status!='pending' ORDER BY id DESC LIMIT 50) ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END,p.id DESC").all(),municipalities:catalog.municipalities};}
function reviewAction({db,path,req,auth,json,fail,body,reviewMatch}){
 const admin=auth(req,'ADMIN');if(!admin.roles?.includes('ADMIN'))fail(403,'Bara admin kan granska förslag.');
 if(path==='/api/journey/proposals'){if(req.method!=='GET')fail(405,'Metoden stöds inte.');json(200,reviewList(db));return true;}
 if(req.method!=='POST')fail(405,'Metoden stöds inte.');
 const id=Number(reviewMatch[1]),proposal=db.prepare('SELECT * FROM journey_proposals WHERE id=?').get(id);if(!proposal)fail(404,'Förslaget finns inte.');if(proposal.status!=='pending')fail(409,'Förslaget är redan granskat. Uppdatera listan.');
 if(!['approved','rejected'].includes(body.decision))fail(400,'Välj godkänn eller avslå.');
 const comment=body.comment??'';if(typeof comment!=='string'||comment.length>1000)fail(400,'Kommentaren får vara högst 1 000 tecken.');
 let key=null,name=proposal.name,scope=proposal.scope,municipality=proposal.municipality;
 if(body.decision==='approved'){
  if(body.verified!==true)fail(400,'Bekräfta att du kontrollerat att hallen, föreningen eller domaren finns eller har funnits.');
  name=body.name??name;if(typeof name!=='string')fail(400,'Skriv ett namn.');name=name.trim().replace(/\s+/g,' ');if(name.length<2||name.length>120||/[\x00-\x1f\x7f]/.test(name))fail(400,'Kontrollera namnet.');
  scope=body.scope??scope;municipality=body.municipality??municipality;if(!['active','legends'].includes(scope))fail(400,'Välj Aktiva eller Legends.');if(municipality&&!catalog.municipalities.some(m=>m.id===municipality))fail(400,'Välj en giltig kommun.');if(proposal.kind==='halls'&&scope==='active'&&!municipality)fail(400,'En aktiv hall behöver en kommun.');
 }
 const apply=()=>{
  if(db.prepare('SELECT status FROM journey_proposals WHERE id=?').get(id).status!=='pending')fail(409,'Förslaget är redan granskat.');
  if(body.decision==='approved'){
   const submitter=db.prepare('SELECT id,name FROM users WHERE id=?').get(proposal.user_id),existing=catalogues(db,{...admin,...submitter})[proposal.kind].find(x=>normalizeName(x.name)===normalizeName(name));
   if(existing)key=existing.key;else{const result=db.prepare('INSERT INTO journey_global_items(kind,name,scope,municipality,actor_id) VALUES(?,?,?,?,?)').run(proposal.kind,name,scope,municipality||null,admin.id);key='extra:'+Number(result.lastInsertRowid);}
   if(proposal.legacy_item_id)db.prepare("INSERT OR IGNORE INTO journey_manual_selections(user_id,kind,item_key,updated_at) SELECT user_id,kind,?,updated_at FROM journey_manual_selections WHERE user_id=? AND kind=? AND item_key=?").run(key,proposal.user_id,proposal.kind,'custom:'+proposal.legacy_item_id);
  }
  db.prepare('UPDATE journey_proposals SET status=?,name=?,normalized_name=?,scope=?,municipality=?,reviewed_at=?,reviewed_by=?,review_comment=?,item_key=? WHERE id=? AND status=\'pending\'').run(body.decision,name,normalizeName(name),scope,municipality||null,new Date().toISOString(),admin.id,comment.trim(),key,id);
 };
 if(db.transaction)db.transaction(apply);else{db.exec('BEGIN');try{apply();db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
 json(200,reviewList(db));return true;
}

// Only aggregate badges and explicitly selected series are shareable, never raw
// hall/club/colleague checklists, proposals, reviewer notes or map coordinates.
export function journeyProfileSummary(db,user){const view=journeyView(db,user);const titles={halls:'Hallar',clubs:'Föreningar',colleagues:'Domarkollegor',series:'Serier'};const badges=[];for(const scope of ['active','legends']){for(const [kind,p]of Object.entries(view.groups[scope].progress))if(p.tier!=='none')badges.push({kind,scope,tier:p.tier,label:titles[kind],done:p.done,total:p.total});if(view.groups[scope].doubleSilver)badges.push({kind:'combined',scope,tier:'silver',label:'Dubbelresan'});}return {badges,series:view.series.filter(s=>s.selected).map(s=>({key:s.key,name:s.name,group:s.group||'Övriga serier'}))};}
