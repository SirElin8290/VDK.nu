import {transaction,importMatch} from './store.mjs';
import {StatsSource,normalizeName,isLeague,referees,memberRecord} from './stats-source.mjs';

async function mapLimit(items,fn){let next=0;await Promise.all(Array.from({length:3},async()=>{while(next<items.length)await fn(items[next++]);}));}
// One shared scan, regardless of whether the roster contains 1 or 100 referees.
export async function syncStats(db,{source=new StatsSource(),seasonIds=[43,44],federationIds=[11,1],full=false,now=new Date(),onProgress=()=>{}}={}){
  const lock=db.prepare("INSERT OR IGNORE INTO sync_lock VALUES (1,?)").run(Date.now());if(!lock.changes)throw Error('En statistikuppdatering pågår redan. Kontrollera låset efter ett avbrutet serverjobb.');
  const report={startedAt:now.toISOString(),finishedAt:null,status:'running',scope:{seasonIds,federationIds,full},competitions:0,examined:0,imported:0,unreported:0,errors:[],unresolved:[]};
  const run=Number(db.prepare('INSERT INTO sync_runs(started_at,status,report) VALUES (?,?,?)').run(report.startedAt,'running',JSON.stringify(report)).lastInsertRowid);
  try{
    // Approved active referee members are enrolled by name; pilot consent is explicit.
    db.prepare("INSERT OR IGNORE INTO stats_profiles(user_id,name,enabled,authorization) SELECT DISTINCT u.id,u.name,1,'active-member' FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.category='active' AND m.status='active' AND m.paid=1").run();
    const roster=db.prepare("SELECT user_id AS userId,name,referee_id AS refereeId FROM stats_profiles sp WHERE enabled=1 AND (authorization!='active-member' OR EXISTS (SELECT 1 FROM memberships ms WHERE ms.user_id=sp.user_id AND ms.category='active' AND ms.paid=1 AND ms.status='active' AND ms.season=(SELECT max(season) FROM memberships)))").all();
    if(!roster.length)throw Error('Det finns inga godkända domarmedlemmar att hämta för.');
    const indexed=db.prepare('SELECT referees FROM stats_match_index').all();
    for(const u of roster.filter(x=>!x.refereeId)){const ids=new Set(indexed.flatMap(x=>JSON.parse(x.referees)).filter(r=>normalizeName(r.name)===normalizeName(u.name)).map(r=>r.id));if(ids.size===1){u.refereeId=[...ids][0];db.prepare('UPDATE stats_profiles SET referee_id=? WHERE user_id=?').run(u.refereeId,u.userId);}else if(ids.size>1)report.errors.push({error:'Flera statistik-ID för namnet '+u.name});}
    const seen=new Set();const seenMatches=new Set();
    for(const sid of seasonIds){const seasons=await source.get('/seasons/');const season=seasons.find(s=>Number(s.SeasonID)===sid)?.Name||seasons.find(s=>Number(s.SeasonID)===sid)?.SeasonName;if(!season)throw Error('Okänd säsong '+sid);
      for(const fid of federationIds){const comps=await source.get(`/seasons/${sid}/federations/${fid}/competitions`);
        for(const listing of comps){if(seen.has(listing.CompetitionID))continue;seen.add(listing.CompetitionID);
          try{const c=await source.get('/competitions/'+listing.CompetitionID);if(!isLeague(c))continue;report.competitions++;const matches=await source.get(`/competitions/${c.CompetitionID}/matches`);
            await mapLimit(matches,async listingMatch=>{const key=String(listingMatch.MatchID);if(seenMatches.has(key))return;seenMatches.add(key);const date=new Date(listingMatch.MatchDateTime);if(listingMatch.Cancelled){db.prepare('UPDATE matches SET excluded=1 WHERE external_match_id=?').run(key);return;}if(date>now)return;const cached=db.prepare('SELECT * FROM stats_match_index WHERE match_id=?').get(String(listingMatch.MatchID));const recent=now-date<21*86400000;const revisit=cached&&cached.imported===0&&cached.member_match===1;
              if(!full&&cached&&!recent&&!revisit){const refs=JSON.parse(cached.referees);if(!refs.some(r=>roster.some(u=>u.refereeId===r.id)&&!db.prepare('SELECT 1 FROM match_members mm JOIN matches m ON m.id=mm.match_id WHERE m.external_match_id=? AND mm.user_id=?').get(cached.match_id,roster.find(u=>u.refereeId===r.id)?.userId)))return;}
              try{const m=await source.get('/matches/'+listingMatch.MatchID);report.examined++;const refs=referees(m);const selected=[];
                for(const u of roster){const named=refs.filter(r=>normalizeName(r.name)===normalizeName(u.name));if(!u.refereeId&&named.length===1){u.refereeId=named[0].id;db.prepare('UPDATE stats_profiles SET referee_id=? WHERE user_id=?').run(u.refereeId,u.userId);}if(u.refereeId&&named.length===1&&named[0].id!==u.refereeId){report.errors.push({matchId:m.MatchID,error:'Namnet har ett annat statistik-ID: '+u.name});continue;}const r=refs.find(r=>r.id===u.refereeId);if(r){if(normalizeName(r.name)!==normalizeName(u.name)){report.errors.push({matchId:m.MatchID,error:'Domar-ID och namn stämmer inte: '+u.name});continue;}selected.push(u);}}
                const hasEvents=Array.isArray(m.Events);const complete=m.HasFinalResult===true&&hasEvents;let imported=0;
                if(selected.length&&complete){const actualCompetition=Number(m.CompetitionID)===Number(c.CompetitionID)?c:await source.get('/competitions/'+m.CompetitionID);if(!isLeague(actualCompetition))return;importMatch(db,memberRecord(m,actualCompetition,season,selected));report.imported++;imported=1;}else if(selected.length)report.unreported++;
                db.prepare('INSERT INTO stats_match_index VALUES (?,?,?,?,?,?) ON CONFLICT(match_id) DO UPDATE SET referees=excluded.referees,checked_at=excluded.checked_at,imported=excluded.imported,member_match=excluded.member_match').run(String(m.MatchID),season,JSON.stringify(refs),now.toISOString(),imported,selected.length?1:0);
              }catch(e){report.errors.push({matchId:listingMatch.MatchID,error:e.message});}
            });
            onProgress({season,competition:c.Name,examined:report.examined,imported:report.imported});
          }catch(e){report.errors.push({competitionId:listing.CompetitionID,error:e.message});}
        }
      }
    }
    report.unresolved=roster.filter(u=>!u.refereeId).map(u=>u.name);report.status=report.errors.length?'partial':'complete';
  }catch(e){report.status='failed';report.errors.push({error:e.message});}
  finally{report.finishedAt=new Date().toISOString();transaction(db,()=>{db.prepare('UPDATE sync_runs SET finished_at=?,status=?,report=? WHERE id=?').run(report.finishedAt,report.status,JSON.stringify(report),run);db.prepare('DELETE FROM sync_lock WHERE id=1').run();});}
  return report;
}
