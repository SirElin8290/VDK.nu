import {isVenueInScope} from '../server/stat-geography.mjs';
import {StatsSource,isLeague,isVdkStatisticsCompetition,normalizeName,referees} from '../server/stats-source.mjs';
import {cacheMatch} from './cache-store.mjs';
const sourceFor=owner=>owner.sourceFactory?.()||new StatsSource();
export const isRegionalSenior=isVdkStatisticsCompetition;
export function memberRoster(db){return db.prepare("SELECT u.id,u.name FROM users u WHERE EXISTS(SELECT 1 FROM roles r WHERE r.user_id=u.id AND r.role='ADMIN') OR EXISTS(SELECT 1 FROM memberships ms WHERE ms.user_id=u.id AND ms.status='active' AND ms.paid=1 AND ms.category='active')").all();}
const matchesRoster=(refs,roster)=>refs.some(r=>roster.some(u=>normalizeName(u.name)===normalizeName(r.name)));
const compact=c=>({CompetitionID:c.CompetitionID,CompetitionTypeID:c.CompetitionTypeID,Name:c.Name,federal:!!c.federal,regional:!!c.regional});
const queueSize=(db,window)=>db.prepare('SELECT count(*) AS n FROM stats_sync_jobs WHERE window=?').get(window).n;
async function discover(owner,window){
 const {db}=owner,source=sourceFor(owner),plan=db.prepare('SELECT jobs FROM regional_sync_plan WHERE id=1 AND window=?').get(window);let state=JSON.parse(plan?.jobs||'[]');
 if(Array.isArray(state)){const byId=new Map();for(const season of [40,41,42,43,44]){for(const c of await source.get(`/seasons/${season}/federations/11/competitions`))if(isRegionalSenior(c))byId.set(c.CompetitionID,compact({...c,regional:true}));for(const c of await source.get(`/seasons/${season}/federations/1/competitions`)){const regional=byId.get(c.CompetitionID)?.regional||false;byId.set(c.CompetitionID,compact({...c,federal:true,regional}));}}state={planning:true,competitions:[...byId.values()],cursor:0,jobs:[],queued:0};db.prepare('UPDATE regional_sync_plan SET jobs=? WHERE id=1 AND window=?').run(JSON.stringify(state),window);}
 // Jobs are persisted as small rows; a five-season national backfill cannot exceed a SQL row limit.
 if(state.jobs?.length){let next=queueSize(db,window);for(const j of state.jobs)if(!db.prepare('SELECT 1 FROM stats_sync_jobs WHERE window=? AND match_id=?').get(window,j.id))db.prepare('INSERT INTO stats_sync_jobs VALUES(?,?,?,?)').run(window,next++,j.id,JSON.stringify(compact(j.competition)));state.jobs=[];}
 let position=queueSize(db,window);const roster=memberRoster(db),catalog=new Map(state.competitions.map(c=>[Number(c.CompetitionID),c])),end=Math.min(state.cursor+6,state.competitions.length);
 for(;state.cursor<end;state.cursor++){
  const listing=state.competitions[state.cursor],meta=compact({...await source.get(`/competitions/${listing.CompetitionID}`),federal:listing.federal,regional:listing.regional});
  if(isLeague(meta)&&(meta.federal||isRegionalSenior(meta)))for(const m of await source.get(`/competitions/${meta.CompetitionID}/matches`)){
   if(m.Cancelled){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(m.MatchID));continue;}
   if(!m.HasFinalResult||db.prepare('SELECT 1 FROM stats_sync_jobs WHERE window=? AND match_id=?').get(window,m.MatchID))continue;
   const actualId=m.CompetitionID||meta.CompetitionID,actual=compact({...meta,CompetitionID:actualId,Name:m.CompetitionName||meta.Name,federal:meta.federal||catalog.get(Number(actualId))?.federal});
   const exists=db.prepare('SELECT id,competition_id,competition_scope FROM matches WHERE external_match_id=?').get(String(m.MatchID)),old=Date.now()-new Date(m.MatchDateTime).getTime()>21*86400000;
   if(actual.federal){const index=db.prepare('SELECT referees FROM federal_match_index WHERE match_id=?').get(m.MatchID);if(index&&old){const refs=JSON.parse(index.referees),selected=roster.filter(u=>refs.some(r=>normalizeName(r.name)===normalizeName(u.name)));if(!selected.length)continue;if(exists&&exists.competition_scope==='federal'&&selected.every(u=>db.prepare('SELECT 1 FROM match_members WHERE match_id=? AND user_id=?').get(exists.id,u.id)))continue;}}
   else{const checked=db.prepare("SELECT in_scope FROM stats_geography WHERE match_id=? AND scope_version='vdk-geography-1'").get(m.MatchID);if(old&&checked&&(checked.in_scope===0||(exists&&String(exists.competition_id)===String(actual.CompetitionID))))continue;}
   db.prepare('INSERT INTO stats_sync_jobs VALUES(?,?,?,?)').run(window,position++,m.MatchID,JSON.stringify(actual));
  }
  state.queued=position;db.prepare('UPDATE regional_sync_plan SET jobs=? WHERE id=1 AND window=?').run(JSON.stringify({...state,cursor:state.cursor+1}),window);
 }
 if(state.cursor<state.competitions.length){await owner.ctx.storage.setAlarm(Date.now()+1000);return {started:true,planning:true,competitions:state.cursor,totalCompetitions:state.competitions.length};}
 db.prepare("UPDATE regional_sync_plan SET jobs='[]',position=0,errors='[]' WHERE id=1 AND window=?").run(window);await owner.ctx.storage.setAlarm(Date.now()+1000);return {started:true,jobs:position};
}
export async function planSync(owner,window){const {db}=owner;const claimed=db.transaction(()=>{if(db.prepare('SELECT 1 FROM regional_sync_plan').get())return false;if(db.prepare("SELECT 1 FROM sync_schedule_windows WHERE window=? AND status IN ('running','complete','partial')").get(window))return false;const started=new Date().toISOString();db.prepare('INSERT INTO sync_schedule_windows(window,started_at,status) VALUES(?,?,?) ON CONFLICT(window) DO UPDATE SET started_at=excluded.started_at,status=excluded.status').run(window,started,'running');db.prepare("INSERT INTO regional_sync_plan(id,window,jobs,position,errors,started_at) VALUES(1,?,'[]',-1,'[]',?)").run(window,started);return true;});if(!claimed)return {started:false,busy:!!db.prepare('SELECT 1 FROM regional_sync_plan').get()};await owner.ctx.storage.setAlarm(Date.now()+120000);try{return await discover(owner,window);}catch(e){db.prepare('UPDATE regional_sync_plan SET errors=? WHERE id=1').run(JSON.stringify([{error:e.message,phase:'planning'}]));await owner.ctx.storage.setAlarm(Date.now()+60000);return {started:true,retrying:true};}}
async function regionalVenue(owner,source,m){const {db}=owner,venueId=Number(m.VenueID);if(!venueId)throw Error('Spelplats saknas');const cached=db.prepare('SELECT data FROM stats_venues WHERE id=?').get(venueId),venue=cached?JSON.parse(cached.data):await source.get('/venues/'+venueId),inScope=isVenueInScope(venue);if(!cached)db.prepare('INSERT OR REPLACE INTO stats_venues VALUES(?,?)').run(venueId,JSON.stringify({City:venue.City,WGS84Latitude:venue.WGS84Latitude,WGS84Longitude:venue.WGS84Longitude}));db.prepare('INSERT OR REPLACE INTO stats_geography VALUES(?,?,?,?)').run(m.MatchID,venueId,inScope?1:0,'vdk-geography-1');return inScope;}
export async function runSyncBatch(owner){
 const {db}=owner,plan=db.prepare('SELECT * FROM regional_sync_plan WHERE id=1').get();if(!plan)return;
 try{if(plan.position===-1)return await discover(owner,plan.window);
  const legacy=JSON.parse(plan.jobs),queued=queueSize(db,plan.window),total=queued||legacy.length,errors=JSON.parse(plan.errors),source=sourceFor(owner),roster=memberRoster(db);
  const end=Math.min(plan.position+15,total),jobs=queued?db.prepare('SELECT match_id AS id,competition FROM stats_sync_jobs WHERE window=? AND position>=? ORDER BY position LIMIT 15').all(plan.window,plan.position).map(j=>({...j,competition:JSON.parse(j.competition)})):legacy.slice(plan.position,end);
  const fetched=new Map();async function read(j){try{fetched.set(j.id,{match:await source.get(`/matches/${j.id}`)});}catch(error){fetched.set(j.id,{error});}}
  if(jobs.length)await read(jobs[0]);for(let i=1;i<jobs.length;i+=3)await Promise.all(jobs.slice(i,i+3).map(read));
  let position=plan.position;
  for(const j of jobs){try{const result=fetched.get(j.id);if(result.error)throw result.error;const m=result.match;if(m.Cancelled){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));}else{
    const c=m.CompetitionID&&Number(m.CompetitionID)!==Number(j.competition.CompetitionID)?compact({...await source.get('/competitions/'+m.CompetitionID),federal:j.competition.federal,regional:j.competition.regional}):j.competition;
    if(!isLeague(c))throw Error('Matchen är inte seriespel');
    if(c.federal){const refs=referees(m);db.prepare('INSERT OR REPLACE INTO federal_match_index VALUES(?,?,?)').run(m.MatchID,JSON.stringify(refs),new Date().toISOString());const own=matchesRoster(refs,roster);let regionalEligible=false;if(isRegionalSenior(c)){try{regionalEligible=await regionalVenue(owner,source,m);}catch(e){errors.push({matchId:j.id,error:e.message,scope:'regional'});}}
     if(own||regionalEligible)cacheMatch(db,m,c,{federal:true,regionalEligible});else if(db.prepare('SELECT 1 FROM matches WHERE id=?').get(m.MatchID))db.prepare('UPDATE matches SET regional_eligible=0,competition_scope=? WHERE id=?').run('federal',m.MatchID);
    }else{let inScope;try{inScope=await regionalVenue(owner,source,m);}catch(e){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));throw e;}if(!inScope)db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));else cacheMatch(db,m,c);}
   }}catch(e){errors.push({matchId:j.id,error:e.message});}position++;db.prepare('UPDATE regional_sync_plan SET position=?,errors=? WHERE id=1').run(position,JSON.stringify(errors));}
  if(position<total){await owner.ctx.storage.setAlarm(Date.now()+1000);return;}
  db.transaction(()=>{const status=errors.length?'partial':'complete';db.prepare('INSERT INTO sync_runs(started_at,finished_at,status,report) VALUES(?,?,?,?)').run(plan.started_at,new Date().toISOString(),status,JSON.stringify({scope:'Värmlands regionala seriespel samt VDK-domarnas förbundsserier i hela Sverige',checked:total,errors}));db.prepare('UPDATE sync_schedule_windows SET status=? WHERE window=?').run(status,plan.window);db.prepare('DELETE FROM stats_sync_jobs WHERE window=?').run(plan.window);db.prepare('DELETE FROM regional_sync_plan WHERE id=1').run();});
 }catch(e){await owner.ctx.storage.setAlarm(Date.now()+60000);throw e;}
}
export function isSwedishMondayThree(time){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',weekday:'short',hour:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(x=>[x.type,x.value]));return p.weekday==='Mon'&&p.hour==='03'?`${p.year}-${p.month}-${p.day}`:null;}
