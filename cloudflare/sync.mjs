import {StatsSource,isLeague} from '../server/stats-source.mjs';
import {cacheMatch} from './cache-store.mjs';
const sourceFor=owner=>owner.sourceFactory?.()||new StatsSource();
export const isRegionalSenior=c=>/^(Herrar Division [2-9]|Damer Division [1-9])(?: |$)/.test(c.Name)&&!/\(SIBF\)/i.test(c.Name);
async function discover(owner,window){
 const {db}=owner,source=sourceFor(owner),jobs=[],seen=new Set();
 for(const season of [43,44])for(const c of await source.get(`/seasons/${season}/federations/11/competitions`)){
  if(!isRegionalSenior(c))continue;
  const meta=await source.get(`/competitions/${c.CompetitionID}`);
  if(!isRegionalSenior(meta)||!isLeague(meta))continue;
  for(const m of await source.get(`/competitions/${c.CompetitionID}/matches`)){
   if(m.Cancelled){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(m.MatchID));continue;}
   if(!m.HasFinalResult||seen.has(m.MatchID))continue;
   seen.add(m.MatchID);
   const exists=db.prepare('SELECT 1 FROM matches WHERE external_match_id=?').get(String(m.MatchID));
   if(exists&&Date.now()-new Date(m.MatchDateTime).getTime()>21*86400000)continue;
   jobs.push({id:m.MatchID,competition:meta});
  }
 }
 db.prepare('UPDATE regional_sync_plan SET jobs=?,position=0,errors=? WHERE id=1 AND window=?').run(JSON.stringify(jobs),'[]',window);
 await owner.ctx.storage.setAlarm(Date.now()+1000);
 return {started:true,jobs:jobs.length};
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
   try{const m=await source.get(`/matches/${j.id}`);if(m.Cancelled)db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(String(j.id));else cacheMatch(db,m,j.competition);}catch(e){errors.push({matchId:j.id,error:e.message});}
   db.prepare('UPDATE regional_sync_plan SET position=?,errors=? WHERE id=1').run(position+1,JSON.stringify(errors));
  }
  if(position<jobs.length){await owner.ctx.storage.setAlarm(Date.now()+1000);return;}
  db.transaction(()=>{
   const status=errors.length?'partial':'complete';
   db.prepare('INSERT INTO sync_runs(started_at,finished_at,status,report) VALUES(?,?,?,?)').run(plan.started_at,new Date().toISOString(),status,JSON.stringify({scope:'Värmland, ordinarie seniorserier',checked:jobs.length,errors}));
   db.prepare('UPDATE sync_schedule_windows SET status=? WHERE window=?').run(status,plan.window);
   db.prepare('DELETE FROM regional_sync_plan WHERE id=1').run();
  });
 }catch(e){await owner.ctx.storage.setAlarm(Date.now()+60000);throw e;}
}
export function isSwedishMondayThree(time){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',weekday:'short',hour:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time)).map(x=>[x.type,x.value]));
 return p.weekday==='Mon'&&p.hour==='03'?`${p.year}-${p.month}-${p.day}`:null;
}
