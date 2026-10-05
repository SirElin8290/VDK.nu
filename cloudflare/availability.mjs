import {StatsSource,isLeague} from '../server/stats-source.mjs';
import {isVenueInScope} from '../server/stat-geography.mjs';
export function swedishDay(time=Date.now()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));}
export function matchDay(value){return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?value.slice(0,10):swedishDay(value);}
export function availabilityWindow(time=Date.now()){const from=swedishDay(time),end=new Date(from+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+29);return {from,to:end.toISOString().slice(0,10)};}
export function dailyThree(time){const hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Stockholm',hour:'2-digit',hourCycle:'h23'}).format(new Date(time));return hour==='03'?swedishDay(time):null;}
export function allowedCompetition(c){return isLeague(c)&&!/\b(?:HJ|DJ|VG)\s*18\b|juniorallsvenskan|(?:herr|dam)junior\s*18|tränings/i.test(c.Name||'');}
export function namedReferees(m){return [...new Set([m.Referee1,m.Referee2].map(x=>String(x||'').trim()).filter(Boolean))];}
const sourceFor=o=>o.sourceFactory?.()||new StatsSource();
export async function startAvailability(owner,day=swedishDay()){
 const db=owner.db;if(db.prepare('SELECT 1 FROM availability_plan WHERE id=1').get())return {busy:true};
 if(db.prepare('SELECT day FROM availability_snapshot WHERE id=1').get()?.day===day)return {started:false};
 const window=availabilityWindow(day+'T12:00:00Z');
 const state={...window,competitions:null,cursor:0,jobs:[],position:0,rows:[],errors:[]};
 db.prepare('INSERT INTO availability_plan VALUES(1,?,?)').run(day,JSON.stringify(state));await owner.ctx.storage.setAlarm(Date.now()+1000);return {started:true};
}
export async function runAvailability(owner){
 const db=owner.db,plan=db.prepare('SELECT * FROM availability_plan WHERE id=1').get();if(!plan)return;
 const s=JSON.parse(plan.state),source=sourceFor(owner);
 try{
  if(!s.competitions){const year=Number(s.from.slice(0,4))-(Number(s.from.slice(5,7))<7?1:0);const season=year-1982;s.season=season;s.competitions=(await source.get(`/seasons/${season}/federations/11/competitions`)).filter(c=>!/tränings|juniorallsvenskan|\b(?:HJ|DJ|VG)\s*18\b/i.test(c.Name||''));}
  if(s.cursor<s.competitions.length){
   const end=Math.min(s.cursor+5,s.competitions.length),seen=new Set(s.jobs.map(j=>j.id));
   for(;s.cursor<end;s.cursor++){const c=s.competitions[s.cursor],meta=await source.get('/competitions/'+c.CompetitionID);if(!allowedCompetition(meta))continue;
    for(const m of await source.get('/competitions/'+c.CompetitionID+'/matches')){const day=matchDay(m.MatchDateTime);if(m.Cancelled||m.HasFinalResult||day<s.from||day>s.to||seen.has(m.MatchID))continue;seen.add(m.MatchID);s.jobs.push({id:m.MatchID,c:{...meta,CompetitionID:m.CompetitionID||meta.CompetitionID,Name:m.CompetitionName||meta.Name}});}
   }
  }else{
   const end=Math.min(s.position+12,s.jobs.length);
   for(;s.position<end;s.position++){const j=s.jobs[s.position];try{
    const m=await source.get('/matches/'+j.id),refs=namedReferees(m);if(m.Cancelled||m.HasFinalResult||refs.length>1)continue;
    const c=m.CompetitionID&&m.CompetitionID!==j.c.CompetitionID?await source.get('/competitions/'+m.CompetitionID):j.c;if(!allowedCompetition(c))continue;
    const day=matchDay(m.MatchDateTime);if(day<s.from||day>s.to)continue;
    if(!m.VenueID)throw Error('Spelplats saknas');const cache=db.prepare('SELECT data FROM stats_venues WHERE id=?').get(m.VenueID),venue=cache?JSON.parse(cache.data):await source.get('/venues/'+m.VenueID);if(!isVenueInScope(venue))continue;
    if(!cache)db.prepare('INSERT OR REPLACE INTO stats_venues VALUES(?,?)').run(m.VenueID,JSON.stringify({City:venue.City,WGS84Latitude:venue.WGS84Latitude,WGS84Longitude:venue.WGS84Longitude}));
    s.rows.push({id:m.MatchID,day,starts_at:m.MatchDateTime,home:m.HomeTeam||m.HomeTeamName||'',away:m.AwayTeam||m.AwayTeamName||'',competition:c.Name,competitionId:c.CompetitionID,venue:m.Venue||m.VenueName||venue.City||'',referees:refs,source_url:`https://stats.innebandy.se/sasong/${s.season}/serie/${c.CompetitionID}/match/${m.MatchID}`});
   }catch(e){s.errors.push({id:j.id,error:e.message});}}
  }
  db.prepare('UPDATE availability_plan SET state=? WHERE id=1').run(JSON.stringify(s));
  if(s.cursor>=s.competitions.length&&s.position>=s.jobs.length){db.transaction(()=>{db.prepare('INSERT OR REPLACE INTO availability_snapshot VALUES(1,?,?,?)').run(plan.day,new Date().toISOString(),JSON.stringify({...s,competitions:s.competitions.map(c=>({id:c.CompetitionID,name:c.Name})),status:s.errors.length?'partial':'complete'}));db.prepare('DELETE FROM availability_plan WHERE id=1').run();});}
  else await owner.ctx.storage.setAlarm(Date.now()+1000);
 }catch(e){await owner.ctx.storage.setAlarm(Date.now()+60000);throw e;}
}
export function availabilityResults(db,params,time=Date.now()){
 const snapshot=db.prepare('SELECT * FROM availability_snapshot WHERE id=1').get(),window=availabilityWindow(time);if(!snapshot)return {...window,matches:[],competitions:[],updatedAt:null,loading:!!db.prepare('SELECT 1 FROM availability_plan').get()};
 const data=JSON.parse(snapshot.data);let rows=data.rows.filter(m=>m.day>=window.from&&m.day<=window.to);const competition=params.get('competition'),count=params.get('count'),team=(params.get('team')||'').toLocaleLowerCase('sv-SE'),referee=(params.get('referee')||'').toLocaleLowerCase('sv-SE');
 rows=rows.filter(m=>(!competition||String(m.competitionId)===competition)&&(!['0','1'].includes(count)||m.referees.length===Number(count))&&(!team||(m.home+' '+m.away).toLocaleLowerCase('sv-SE').includes(team))&&(!referee||m.referees.some(r=>r.toLocaleLowerCase('sv-SE').includes(referee)))&&(!params.get('from')||m.day>=params.get('from'))&&(!params.get('to')||m.day<=params.get('to')));
 return {...window,matches:rows.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)),competitions:data.competitions.filter(c=>allowedCompetition({Name:c.name,CompetitionTypeID:1})),updatedAt:snapshot.updated_at,status:data.status,unverified:data.errors.length,checked:data.jobs.length,loading:!!db.prepare('SELECT 1 FROM availability_plan').get()};
}
