import catalog from '../data-catalogs/journey-2026-27.json' with {type:'json'};
import {normalizeName,StatsSource} from '../server/stats-source.mjs';

export const journeyCatalog=catalog;
export function initializeJourney(db){
 db.exec(`CREATE TABLE IF NOT EXISTS match_referees(match_id INTEGER NOT NULL,referee_id INTEGER NOT NULL,name TEXT NOT NULL,normalized_name TEXT NOT NULL,PRIMARY KEY(match_id,referee_id));
 CREATE TABLE IF NOT EXISTS journey_versions(version TEXT PRIMARY KEY,season TEXT NOT NULL,checked_at TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS journey_teams(id INTEGER PRIMARY KEY,association_id INTEGER NOT NULL,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS journey_facts(match_key TEXT PRIMARY KEY,venue_id INTEGER NOT NULL,home_team_id INTEGER NOT NULL,away_team_id INTEGER NOT NULL,played INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS journey_jobs(kind TEXT NOT NULL,external_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',PRIMARY KEY(kind,external_id));
 CREATE INDEX IF NOT EXISTS journey_due ON journey_jobs(status,next_attempt);
 CREATE TABLE IF NOT EXISTS journey_awards(user_id INTEGER NOT NULL,version TEXT NOT NULL,badge TEXT NOT NULL,awarded_at TEXT NOT NULL,PRIMARY KEY(user_id,version,badge));`);
 if(!db.prepare('SELECT 1 FROM journey_versions WHERE version=?').get(catalog.version))(db.transaction||((fn)=>fn()))(()=>{
  db.prepare('INSERT INTO journey_versions VALUES(?,?,?,?)').run(catalog.version,catalog.season,catalog.checkedAt,JSON.stringify({halls:catalog.halls,clubs:catalog.clubs}));
  for(const t of catalog.teams)db.prepare('INSERT OR IGNORE INTO journey_teams VALUES(?,?,?)').run(t.id,t.associationId,t.associationName||'');
 });
}
export function rememberJourneyMatch(db,m){
 if(!Number(m.MatchID)||!Number(m.VenueID))return;
 const played=m.HasFinalResult===true&&!m.Cancelled&&!m.Abandoned&&Number(m.MatchResultTypeID)!==6;
 db.prepare('INSERT INTO journey_facts VALUES(?,?,?,?,?) ON CONFLICT(match_key) DO UPDATE SET venue_id=excluded.venue_id,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,played=excluded.played').run(String(m.MatchID),Number(m.VenueID),Number(m.HomeTeamID)||0,Number(m.AwayTeamID)||0,played?1:0);
}
export function enqueueJourney(db,{retry=false}={}){
 if(retry)db.prepare("UPDATE journey_jobs SET status='pending',attempts=0,next_attempt=0 WHERE status='failed'").run();
 const missing=db.prepare(`SELECT DISTINCT m.external_match_id,m.competition_id FROM matches m WHERE m.excluded=0 AND EXISTS(SELECT 1 FROM match_members mm WHERE mm.match_id=m.id) AND NOT EXISTS(SELECT 1 FROM journey_facts f WHERE f.match_key=m.external_match_id)`).all();
 for(const m of missing){const id=String(m.competition_id||''),done=id&&db.prepare("SELECT 1 FROM journey_jobs WHERE kind='competition' AND external_id=? AND status='complete'").get(id);const kind=id&&!done?'competition':'match',key=kind==='competition'?id:m.external_match_id;db.prepare('INSERT OR IGNORE INTO journey_jobs(kind,external_id) VALUES(?,?)').run(kind,key);}
 const teams=db.prepare(`SELECT DISTINCT t.id FROM (SELECT f.home_team_id AS id FROM journey_facts f JOIN matches m ON m.external_match_id=f.match_key WHERE m.excluded=0 AND EXISTS(SELECT 1 FROM match_members mm WHERE mm.match_id=m.id) UNION SELECT f.away_team_id FROM journey_facts f JOIN matches m ON m.external_match_id=f.match_key WHERE m.excluded=0 AND EXISTS(SELECT 1 FROM match_members mm WHERE mm.match_id=m.id)) t WHERE t.id>0 AND NOT EXISTS(SELECT 1 FROM journey_teams j WHERE j.id=t.id)`).all();
 for(const t of teams)db.prepare("INSERT OR IGNORE INTO journey_jobs(kind,external_id) VALUES('team',?)").run(String(t.id));
 return journeyStatus(db);
}
export function journeyStatus(db){return {pending:db.prepare("SELECT count(*) n FROM journey_jobs WHERE status='pending'").get().n,failed:db.prepare("SELECT count(*) n FROM journey_jobs WHERE status='failed'").get().n,catalogVersion:catalog.version,halls:catalog.halls.length,clubs:catalog.clubs.length};}
export async function runJourneyBatch(owner){
 const {db}=owner,jobs=db.prepare("SELECT * FROM journey_jobs WHERE status='pending' AND next_attempt<=? ORDER BY CASE kind WHEN 'competition' THEN 0 WHEN 'match' THEN 1 ELSE 2 END,external_id LIMIT 3").all(Date.now());if(!jobs.length)return false;
 const source=owner.journeySource||new StatsSource(),fetched=new Map();
 await Promise.all(jobs.map(async job=>{const path=job.kind==='team'?'/teams/':job.kind==='match'?'/matches/':'/competitions/';try{fetched.set(job,await source.get(path+encodeURIComponent(job.external_id)+(job.kind==='competition'?'/matches':'')));}catch(error){fetched.set(job,{journeyError:error});}}));
 for(const job of jobs)try{
  const payload=fetched.get(job);if(payload?.journeyError)throw payload.journeyError;
  if(job.kind==='team'){const t=payload;if(!Number(t.AssociationID))throw Error('Föreningskoppling saknas');db.prepare('INSERT OR REPLACE INTO journey_teams VALUES(?,?,?)').run(Number(job.external_id),Number(t.AssociationID),String(t.AssociationName||''));}
  else if(job.kind==='match')rememberJourneyMatch(db,payload);
  else{const rows=payload;if(!Array.isArray(rows))throw Error('Matchlista saknas');db.transaction(()=>{for(const m of rows)if(db.prepare('SELECT 1 FROM matches WHERE external_match_id=?').get(String(m.MatchID)))rememberJourneyMatch(db,m);});}
  db.prepare("UPDATE journey_jobs SET status='complete',error='' WHERE kind=? AND external_id=?").run(job.kind,job.external_id);
 }catch(e){db.prepare('UPDATE journey_jobs SET attempts=attempts+1,status=?,next_attempt=?,error=? WHERE kind=? AND external_id=?').run(job.attempts>=2?'failed':'pending',Date.now()+60000*2**job.attempts,String(e.message).slice(0,180),job.kind,job.external_id);}
 enqueueJourney(db);return true;
}
export function badgeProgress(done,total){
 const levels=[['bronze','Brons',.25],['silver','Silver',.6],['gold','Guld',1]].map(([id,label,part])=>({id,label,target:Math.ceil(total*part),earned:total>0&&done>=Math.ceil(total*part)}));
 return {done,total,percent:total?Math.round(done/total*100):0,levels,next:levels.find(l=>!l.earned)||null};
}
function summarize(rows,halls,clubs,teamMap,user,ownRefereeId){
 const hallMap=new Map(halls.map(h=>[h.id,{...h,matches:[]}])),aliases=new Map(halls.flatMap(h=>(h.aliases||[h.id]).map(id=>[id,h.id]))),clubMap=new Map(clubs.map(c=>[c.id,{...c,matches:[]}])),peers=new Map();let missing=0;
 for(const m of rows){
  if(m.played===null||m.played===undefined){missing++;continue;}if(!m.played)continue;
  const entry={id:m.id,date:m.starts_at,season:m.season,home:m.home,away:m.away,competition:m.competition_name,url:m.source_url};
  hallMap.get(aliases.get(m.venue_id)||m.venue_id)?.matches.push(entry);
  const associations=new Set([teamMap.get(m.home_team_id),teamMap.get(m.away_team_id)].filter(Boolean));
  for(const id of associations)clubMap.get(id)?.matches.push(entry);
  if(!teamMap.has(m.home_team_id)||!teamMap.has(m.away_team_id))missing++;
  for(const r of m.referees){if(!r.referee_id||r.referee_id===ownRefereeId||r.normalized_name===normalizeName(user.name))continue;const peer=peers.get(r.referee_id)||{id:r.referee_id,name:r.name,matches:[]};peer.matches.push(entry);peers.set(r.referee_id,peer);}
 }
 const pack=map=>[...map.values()].map(x=>({...x,count:x.matches.length,visited:x.matches.length>0,first:x.matches.at(-1)?.date||null,last:x.matches[0]?.date||null}));
 return {halls:pack(hallMap),clubs:pack(clubMap),colleagues:[...peers.values()].map(x=>({...x,count:x.matches.length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'sv')),missing};
}
export function journeyView(db,user,params,{target=catalog,now=Date.now()}={}){
 const rows=db.prepare(`SELECT m.id,m.external_match_id,m.starts_at,m.season,m.home,m.away,m.source_url,m.competition_name,f.venue_id,f.home_team_id,f.away_team_id,f.played FROM matches m JOIN match_members mm ON mm.match_id=m.id LEFT JOIN journey_facts f ON f.match_key=m.external_match_id WHERE mm.user_id=? AND m.excluded=0 ORDER BY m.starts_at DESC,m.id DESC`).all(user.id).filter(m=>Date.parse(m.starts_at)<=now);
 const referees=db.prepare('SELECT r.* FROM match_referees r JOIN match_members mm ON mm.match_id=r.match_id WHERE mm.user_id=?').all(user.id),byMatch=new Map();for(const r of referees){if(!byMatch.has(r.match_id))byMatch.set(r.match_id,[]);byMatch.get(r.match_id).push(r);}for(const row of rows)row.referees=byMatch.get(row.id)||[];
 const teams=new Map(db.prepare('SELECT id,association_id FROM journey_teams').all().map(t=>[t.id,t.association_id])),profile=db.prepare('SELECT referee_id FROM stats_profiles WHERE user_id=?').get(user.id);
 const lifetime=summarize(rows,target.halls,target.clubs,teams,user,Number(profile?.referee_id)||null),seasons=[...new Set(rows.map(m=>m.season))].sort().reverse(),season=params.get('season')||'all';
 if(season!=='all'&&!seasons.includes(season))throw Object.assign(Error('Välj en säsong som finns i din matchhistorik.'),{status:400});
 const selected=season==='all'?lifetime:summarize(rows.filter(m=>m.season===season),target.halls,target.clubs,teams,user,Number(profile?.referee_id)||null);
 const progress={halls:badgeProgress(lifetime.halls.filter(h=>h.visited).length,target.halls.length),clubs:badgeProgress(lifetime.clubs.filter(c=>c.visited).length,target.clubs.length)};
 for(const [kind,p] of Object.entries(progress))for(const l of p.levels)if(l.earned)db.prepare('INSERT OR IGNORE INTO journey_awards VALUES(?,?,?,?)').run(user.id,target.version,kind+'-'+l.id,new Date(now).toISOString());
 const complete=progress.halls.levels.at(-1).earned&&progress.clubs.levels.at(-1).earned;if(complete)db.prepare('INSERT OR IGNORE INTO journey_awards VALUES(?,?,?,?)').run(user.id,target.version,'double-silver',new Date(now).toISOString());
 return {catalog:{version:target.version,season:target.season,checkedAt:target.checkedAt,definition:target.definition},season,seasons,...selected,progress,colleagueTotal:lifetime.colleagues.length,colleagueMilestones:[5,10,20,30].map(target=>({target,earned:lifetime.colleagues.length>=target})),awards:db.prepare('SELECT version,badge,awarded_at FROM journey_awards WHERE user_id=? ORDER BY awarded_at').all(user.id),doubleSilver:complete,historyMatches:rows.length,historyFrom:rows.at(-1)?.season||null,sync:journeyStatus(db)};
}
export async function journeyAction({db,path,req,auth,json,fail,url,onQueued}){
 if(path!=='/api/journey')return false;
 if(req.method!=='GET')fail(405,'Metoden stöds inte.');
 const user=auth(req);if(!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND category='active' AND status='active' AND paid=1").get(user.id,user.season))fail(403,'Min domarresa är för godkända aktiva domarmedlemmar.');
 const status=enqueueJourney(db);if(status.pending)await onQueued?.();
 try{return json(200,journeyView(db,user,url.searchParams)),true;}catch(e){if(e.status)fail(e.status,e.message);throw e;}
}
