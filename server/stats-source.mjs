const BASE='https://api.innebandy.se/v2/api/public';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const normalizeName=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('sv-SE');
const AUTH='https://api.innebandy.se/v2/api/auth';
const CLIENT={Origin:'https://stats.innebandy.se',Referer:'https://stats.innebandy.se/'};
const EMPTY_SHA256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const encode=new TextEncoder();
export class StatsSource {
  constructor({fetcher=fetch,delay=150}={}){this.fetcher=fetcher.bind(globalThis);this.delay=delay;this.session=null;this.connecting=null;this.calls=0;}
  async connect(){
    const start=await this.fetcher(AUTH+'/startkit',{headers:CLIENT,signal:AbortSignal.timeout(30000)});
    if(!start.ok)throw Error('Statistikkällans startdata kunde inte läsas (HTTP '+start.status+').');
    const {accessToken}=await start.json();
    if(!accessToken)throw Error('Publik åtkomsttoken saknas.');
    const headers={...CLIENT,Authorization:'Bearer '+accessToken};
    const response=await this.fetcher(AUTH+'/handshake',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Statistikkällans session kunde inte öppnas (HTTP '+response.status+').');
    const {ss,st}=await response.json();
    const cookies=(response.headers.getSetCookie?.()||response.headers.getAll?.('Set-Cookie')||[]).map(value=>value.split(';',1)[0]).join('; ');
    if(typeof ss!=='string'||!ss||!Number.isFinite(st)||!cookies)throw Error('Ofullständig publiksessionsdata från statistikkällan.');
    const key=await crypto.subtle.importKey('raw',encode.encode(ss),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    return {headers:{...headers,Cookie:cookies},key,offset:st-Date.now()};
  }
  async authorize(){
    if(!this.session){
      this.connecting??=this.connect().then(session=>this.session=session).finally(()=>{this.connecting=null;});
      return this.connecting;
    }
    return this.session;
  }
  async get(path){
    const url=new URL(BASE+path);
    for(let attempt=0;attempt<4;attempt++){
      const session=await this.authorize();
      await sleep(this.delay);this.calls++;
      const timestamp=String(Date.now()+session.offset),nonce=crypto.randomUUID();
      const message=['GET',url.pathname+url.search,timestamp,nonce,EMPTY_SHA256].join('\n');
      const bytes=await crypto.subtle.sign('HMAC',session.key,encode.encode(message));
      const signature=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
      const r=await this.fetcher(url.href,{headers:{...session.headers,'X-Signature':signature,'X-Timestamp':timestamp,'X-Nonce':nonce},signal:AbortSignal.timeout(30000)});
      if(r.ok)return r.json();
      if(r.status===401&&attempt===0){if(this.session===session)this.session=null;continue;}
      if(r.status===429||r.status>=500){const retry=Number(r.headers.get('retry-after'));await sleep(Math.min(60000,Number.isFinite(retry)&&retry>0?retry*1000:1000*2**attempt));continue;}
      throw Error(`Statistikkällan svarade ${r.status} för ${path}`);
    }
    throw Error('Statistikkällan är tillfälligt otillgänglig.');
  }
}
export function isLeague(c){return c.CompetitionTypeID===1&&!/tränings|training|cup|kval|slutspel|mästerskap|sammandrag/i.test(c.Name);}
export function referees(m){return [1,2].map(n=>({id:Number(m['Referee'+n+'ID']),name:m['Referee'+n]||''})).filter(x=>x.id>0&&x.name);}
export function penaltySeconds(name){return [...String(name).matchAll(/(\d+(?:\s*\+\s*\d+)*)\s*min/gi)].reduce((total,found)=>total+found[1].split('+').reduce((n,x)=>n+Number(x.trim()),0)*60,0);}
export function memberRecord(m,c,season,members){
  if(!Array.isArray(m.Events))throw Error('Matchhändelser saknas; ska inte tolkas som noll utvisningar.');
  const refs=referees(m);const homeMatchTeam=Number(m.HomeMatchTeamID),awayMatchTeam=Number(m.AwayMatchTeamID);
  return {externalMatchId:String(m.MatchID),season,startsAt:m.MatchDateTime,home:m.HomeTeam,away:m.AwayTeam,homeTeamId:String(m.HomeTeamID),awayTeamId:String(m.AwayTeamID),competitionId:String(c.CompetitionID),competitionName:c.Name,level:/flick|pojk|junior|HJ|DJ|P\d|F\d/i.test(c.Name)?'youth':'senior',sourceUrl:`https://stats.innebandy.se/sasong/${m.SeasonID}/serie/${c.CompetitionID}/match/${m.MatchID}`,members:members.map(u=>({userId:u.userId,colleague:refs.filter(r=>r.id!==u.refereeId).map(r=>r.name).join(', ')})),penalties:m.Events.filter(e=>e.MatchEventTypeID===2||e.MatchEventType==='Utvisning').map(e=>({externalEventId:String(e.MatchEventID),category:e.PenaltyName||'Okänd utvisningstyp',code:String(e.PenaltyCode||''),seconds:penaltySeconds(e.PenaltyName),teamId:Number(e.MatchTeamID)===homeMatchTeam?String(m.HomeTeamID):Number(e.MatchTeamID)===awayMatchTeam?String(m.AwayTeamID):'',period:e.Period,minute:e.Minute,second:e.Second}))};
}

// Junior competitions listed by Värmland include shared regional series and its JAS groups.
export const isVdkJunior=c=>/^(?:Pantamera\s+)?(?:Herrjunior\s*17|Damjunior\s*17)\b/i.test(c.Name)||/\b(?:HJ|DJ)\s*(?:17|18)\b/i.test(c.Name);
export const isVdkRed=c=>/^(?:Pantamera\s+)?(?:Pojkar|Flickor)\s+Röd\s+Serie\b/i.test(c.Name)||/^(?:Pantamera\s+)?Flick\s+Mörkröd\b/i.test(c.Name);
export const isVdkStatisticsCompetition=c=>isVdkJunior(c)||isVdkRed(c)||(/^(Herrar Division [2-9]|Damer Division [1-9])(?: |$)/.test(c.Name)&&!/\(SIBF\)/i.test(c.Name));

// USM F16/P16 qualification groups; other cup and final stages remain excluded.
export const isUsmQualifier=c=>[353,354].includes(Number(c.CategoryID))&&/^USM (?:Flickor|Pojkar) Grupp \d+$/i.test(String(c.Name||'').trim());
