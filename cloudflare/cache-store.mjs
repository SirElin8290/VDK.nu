import {normalizeName,referees,penaltySeconds,isLeague,isVdkStatisticsCompetition,isVdkJunior,isVdkRed} from '../server/stats-source.mjs';
export function cacheMatch(db,m,c,{federal=false,regionalEligible=true}={}){
 if(![40,41,42,43,44].includes(Number(m.SeasonID))||!isLeague(c)||(!federal&&!isVdkStatisticsCompetition(c)))throw Error('Matchen ligger utanför VDK:s statistikavgränsning');
 if(m.Cancelled||!m.HasFinalResult)return false;
 if(!Array.isArray(m.Events)||(!m.Events.length&&Number(m.GoalsHomeTeam)+Number(m.GoalsAwayTeam)>0))throw Error('Händelseprotokoll saknas');
 const ps=m.Events.filter(e=>e.MatchEventTypeID===2||e.MatchEventType==='Utvisning');
 if(ps.some(e=>!e.MatchEventID)||new Set(ps.map(e=>String(e.MatchEventID))).size!==ps.length)throw Error('Ogiltiga eller dubbla händelser');
 const refs=referees(m);
const users=db.prepare("SELECT u.id,u.name FROM users u WHERE EXISTS(SELECT 1 FROM roles r WHERE r.user_id=u.id AND r.role='ADMIN') OR EXISTS(SELECT 1 FROM memberships ms WHERE ms.user_id=u.id AND ms.status='active' AND ms.paid=1 AND ms.category='active')").all();
 if(federal&&!regionalEligible&&!refs.some(r=>users.some(u=>normalizeName(u.name)===normalizeName(r.name))))throw Error('Förbundsmatchen tillhör inte en aktiv VDK-domare.');
 return db.transaction(()=>{
  const id=Number(m.MatchID);
  if(!Number.isSafeInteger(id)||id<=0||!Number.isFinite(Date.parse(m.MatchDateTime)))throw Error('Ogiltig matchidentitet eller tid');
  db.prepare("INSERT INTO matches(id,external_match_id,season,starts_at,home,away,level,source_url,excluded,home_team_id,away_team_id,competition_id,competition_name) VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?) ON CONFLICT(id) DO UPDATE SET season=excluded.season,level=excluded.level,excluded=0,starts_at=excluded.starts_at,home=excluded.home,away=excluded.away,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,competition_id=excluded.competition_id,competition_name=excluded.competition_name,source_url=excluded.source_url").run(id,String(id),`${Number(m.SeasonID)+1982}/${String(Number(m.SeasonID)+1983).slice(-2)}`,m.MatchDateTime,m.HomeTeam,m.AwayTeam,(isVdkJunior(c)||isVdkRed(c))?'youth':'senior',`https://stats.innebandy.se/sasong/${m.SeasonID}/serie/${c.CompetitionID}/match/${id}`,String(m.HomeTeamID),String(m.AwayTeamID),String(c.CompetitionID),c.Name);
  db.prepare('UPDATE matches SET competition_scope=?,regional_eligible=? WHERE id=?').run(federal?'federal':'district',regionalEligible?1:0,id);
  db.prepare('DELETE FROM penalties WHERE match_id=?').run(id);
  db.prepare('DELETE FROM match_referees WHERE match_id=?').run(id);
  db.prepare('DELETE FROM match_members WHERE match_id=?').run(id);
  for(const e of ps)db.prepare('INSERT INTO penalties(match_id,external_event_id,category,seconds,team_id,code,period,minute,second) VALUES(?,?,?,?,?,?,?,?,?)').run(id,String(e.MatchEventID),e.PenaltyName||'Okänd',penaltySeconds(e.PenaltyName),Number(e.MatchTeamID)===Number(m.HomeMatchTeamID)?String(m.HomeTeamID):Number(e.MatchTeamID)===Number(m.AwayMatchTeamID)?String(m.AwayTeamID):'',String(e.PenaltyCode||''),e.Period??null,e.Minute??null,e.Second??null);

  for(const r of refs){
   db.prepare('INSERT INTO match_referees(match_id,referee_id,name,normalized_name) VALUES(?,?,?,?)').run(id,r.id,r.name,normalizeName(r.name));
   for(const u of users)if(normalizeName(u.name)===normalizeName(r.name))db.prepare('INSERT INTO match_members(match_id,user_id,colleague) VALUES(?,?,?)').run(id,u.id,refs.filter(x=>x.id!==r.id).map(x=>x.name).join(', '));
  }
  return true;
 });
}
