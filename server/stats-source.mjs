const BASE='https://api.innebandy.se/v2/api/public';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const normalizeName=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('sv-SE');
export class StatsSource {
  constructor({fetcher=fetch,delay=150}={}){this.fetcher=fetcher;this.delay=delay;this.token=null;this.calls=0;}
  async authorize(){const r=await this.fetcher('https://api.innebandy.se/StatsAppApi/api/startkit',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Statistikkällans startdata kunde inte läsas.');const data=await r.json();if(!data.accessToken)throw Error('Publik åtkomsttoken saknas.');this.token=data.accessToken;}
  async get(path){if(!this.token)await this.authorize();for(let attempt=0;attempt<4;attempt++){await sleep(this.delay);this.calls++;const r=await this.fetcher(BASE+path,{headers:{Authorization:'Bearer '+this.token,Referer:'https://stats.innebandy.se/'},signal:AbortSignal.timeout(30000)});if(r.ok)return r.json();if(r.status===401&&attempt===0){await this.authorize();continue;}if(r.status===429||r.status>=500){const retry=Number(r.headers.get('retry-after'));await sleep(Math.min(60000,Number.isFinite(retry)&&retry>0?retry*1000:1000*2**attempt));continue;}throw Error(`Statistikkällan svarade ${r.status} för ${path}`);}throw Error('Statistikkällan är tillfälligt otillgänglig.');}
}
export function isLeague(c){return c.CompetitionTypeID===1&&!/tränings|training|cup|kval|slutspel|mästerskap|sammandrag/i.test(c.Name);}
export function referees(m){return [1,2].map(n=>({id:Number(m['Referee'+n+'ID']),name:m['Referee'+n]||''})).filter(x=>x.id>0&&x.name);}
export function penaltySeconds(name){return [...String(name).matchAll(/(\d+(?:\s*\+\s*\d+)*)\s*min/gi)].reduce((total,found)=>total+found[1].split('+').reduce((n,x)=>n+Number(x.trim()),0)*60,0);}
export function memberRecord(m,c,season,members){
  if(!Array.isArray(m.Events))throw Error('Matchhändelser saknas; ska inte tolkas som noll utvisningar.');
  const refs=referees(m);const homeMatchTeam=Number(m.HomeMatchTeamID),awayMatchTeam=Number(m.AwayMatchTeamID);
  return {externalMatchId:String(m.MatchID),season,startsAt:m.MatchDateTime,home:m.HomeTeam,away:m.AwayTeam,homeTeamId:String(m.HomeTeamID),awayTeamId:String(m.AwayTeamID),competitionId:String(c.CompetitionID),competitionName:c.Name,level:/flick|pojk|junior|HJ|DJ|P\d|F\d/i.test(c.Name)?'youth':'senior',sourceUrl:`https://stats.innebandy.se/sasong/${m.SeasonID}/serie/${c.CompetitionID}/match/${m.MatchID}`,members:members.map(u=>({userId:u.userId,colleague:refs.filter(r=>r.id!==u.refereeId).map(r=>r.name).join(', ')})),penalties:m.Events.filter(e=>e.MatchEventTypeID===2||e.MatchEventType==='Utvisning').map(e=>({externalEventId:String(e.MatchEventID),category:e.PenaltyName||'Okänd utvisningstyp',code:String(e.PenaltyCode||''),seconds:penaltySeconds(e.PenaltyName),teamId:Number(e.MatchTeamID)===homeMatchTeam?String(m.HomeTeamID):Number(e.MatchTeamID)===awayMatchTeam?String(m.AwayTeamID):'',period:e.Period,minute:e.Minute,second:e.Second}))};
}
