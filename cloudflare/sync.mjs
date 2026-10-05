import {isVenueInScope} from '../server/stat-geography.mjs';
import {StatsSource,isLeague,isVdkStatisticsCompetition} from '../server/stats-source.mjs';
import {cacheMatch} from './cache-store.mjs';
const sourceFor=owner=>owner.sourceFactory?.()||new StatsSource();
export const isRegionalSenior=isVdkStatisticsCompetition;
async function discover(owner,window){
 const {db}=owner,source=sourceFor(owner);const plan=db.prepare('SELECT jobs FROM regional_sync_plan WHERE id=1 AND window=?').get(window);let state=JSON.parse(plan?.jobs||'[]');
 if(Array.isArray(state)){const competitions=[],seen=new Set();for(const season of [43,44])for(const c of await source.get(`/seasons/${season}/federations/11/competitions`)){if(isRegionalSenior(c)&&!seen.has(c.CompetitionID)){seen.add(c.CompetitionID);competitions.push(c);}}state={planning:true,competitions,cursor:0,jobs:[]};db.prepare('UPDATE regional_sync_plan SET jobs=? WHERE id=1 AND window=?').run(JSON.stringify(state),window);}
 const seen=new Set(state.jobs.map(j=>j.id));const end=Math.min(state.cursor+6,state.competitions.length);
 for(;state.cursor<end;state.cursor++){
  const c=state.competitions[state.cursor];const meta=await source.get(`/competitions/${c.CompetitionID}`);
  if(isRegionalSenior(meta)&&isLeague(meta))for(const m of await source.get(`/competitions/${c.CompetitionID}/matches`)){
   if(m.Cancelled){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(m.MatchID));continue;}
   if(!m.HasFinalResult||seen.has(m.MatchID))continue;seen.add(m.MatchID);
   const actual={...meta,CompetitionID:m.CompetitionID||meta.CompetitionID,Name:m.CompetitionName||meta.Name};const exists=db.prepare('SELECT competition_id FROM matches WHERE external_match_id=?').get(String(m.MatchID));const checked=db.prepare("SELECT in_scope FROM stats_geography WHERE match_id=? AND scope_version='vdk-geography-1'").get(m.MatchID);if(checked&&(checked.in_scope===0||(exists&&String(exists.competition_id)===String(actual.CompetitionID)))&&Date.now()-new Date(m.MatchDateTime).getTime()>21*86400000)continue;
   state.jobs.push({id:m.MatchID,competition:actual});
  }
  db.prepare('UPDATE regional_sync_plan SET jobs=? WHERE id=1 AND window=?').run(JSON.stringify({...state,cursor:state.cursor+1}),window);
 }
 if(state.cursor<state.competitions.length){await owner.ctx.storage.setAlarm(Date.now()+1000);return {started:true,planning:true,competitions:state.cursor,totalCompetitions:state.competitions.length};}
 db.prepare('UPDATE regional_sync_plan SET jobs=?,position=0,errors=? WHERE id=1 AND window=?').run(JSON.stringify(state.jobs),'[]',window);await owner.ctx.storage.setAlarm(Date.now()+1000);return {started:true,jobs:state.jobs.length};
}
export async function planSync(owner,window){
 const {db}=owner;
 const claimed=db.transaction(()=>{
  if(db.prepare('SELECT 1 FROM regional_sync_plan').get())return false;
  if(db.prepare("SELECT 1 FROM sync_schedule_windows WHERE window=? AND status IN ('running','complete','partial')").get(window))return false;
  const started=new Date().toISOString();
  db.prepare('INSERT INTO sync_schedule_windows(window,started_at,status) VALUES(?,?,?) ON CONFLICT(window) DO UPDATE SET started_at=excluded.started_at,status=excluded.status').run(window,started,'running');
  db.prepare("INSERT INTO regional_sync_plan(id,window,jobs,position,errors,started_at) VALUES(1,?,'[]',-1,'[]',?)").run(window,started);
  return true;
 });
 if(!claimed)return {started:false,busy:!!db.prepare('SELECT 1 FROM regional_sync_plan').get()};
 // Persist recovery before network work; overlapping triggers cannot claim another plan.
 await owner.ctx.storage.setAlarm(Date.now()+120000);
 try{return await discover(owner,window);}catch(e){
  db.prepare('UPDATE regional_sync_plan SET errors=? WHERE id=1').run(JSON.stringify([{error:e.message,phase:'planning'}]));
  await owner.ctx.storage.setAlarm(Date.now()+60000);
  return {started:true,retrying:true};
 }
}
export async function runSyncBatch(owner){
 const {db}=owner,plan=db.prepare('SELECT * FROM regional_sync_plan WHERE id=1').get();
 if(!plan)return;
 try{
  if(plan.position===-1)return await discover(owner,plan.window);
  const jobs=JSON.parse(plan.jobs),errors=JSON.parse(plan.errors),source=sourceFor(owner);
  let position=plan.position;
  const end=Math.min(position+15,jobs.length);
  for(;position<end;position++){
   const j=jobs[position];
   try{const m=await source.get(`/matches/${j.id}`);if(m.Cancelled)db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));else{let inScope;try{const venueId=Number(m.VenueID);if(!venueId)throw Error('Spelplats saknas');const cached=db.prepare('SELECT data FROM stats_venues WHERE id=?').get(venueId);const venue=cached?JSON.parse(cached.data):await source.get('/venues/'+venueId);inScope=isVenueInScope(venue);if(!cached)db.prepare('INSERT OR REPLACE INTO stats_venues VALUES(?,?)').run(venueId,JSON.stringify({City:venue.City,WGS84Latitude:venue.WGS84Latitude,WGS84Longitude:venue.WGS84Longitude}));db.prepare('INSERT OR REPLACE INTO stats_geography VALUES(?,?,?,?)').run(m.MatchID,venueId,inScope?1:0,'vdk-geography-1');}catch(e){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));throw e;}if(!inScope){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));}else{const c=m.CompetitionID&&Number(m.CompetitionID)!==Number(j.competition.CompetitionID)?await source.get('/competitions/'+m.CompetitionID):j.competition;cacheMatch(db,m,c);}}}catch(e){errors.push({matchId:j.id,error:e.message});}
   db.prepare('UPDATE regional_sync_plan SET position=?,errors=? WHERE id=1').run(position+1,JSON.stringify(errors));
  }
  if(position<jobs.length){await owner.ctx.storage.setAlarm(Date.now()+1000);return;}
  db.transaction(()=>{
   const status=errors.length?'partial':'complete';
   db.prepare('INSERT INTO sync_runs(started_at,finished_at,status,report) VALUES(?,?,?,?)').run(plan.started_at,new Date().toISOString(),status,JSON.stringify({scope:'Matcher spelade i Värmland samt Karlskoga, Degerfors, Billingsfors och Åmål; seniorserier och HJ17/DJ17/HJ18/DJ18',checked:jobs.length,errors}));
   db.prepare('UPDATE sync_schedule_windows SET status=? WHERE window=?').run(status,plan.window);
   db.prepare('DELETE FROM regional_sync_plan WHERE id=1').run();
  });
 }catch(e){await owner.ctx.storage.setAlarm(Date.now()+60000);throw e;}
}
export function isSwedishMondayThree(time){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',weekday:'short',hour:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(x=>[x.type,x.value]));
 return p.weekday==='Mon'&&p.hour==='03'?`${p.year}-${p.month}-${p.day}`:null;
}
