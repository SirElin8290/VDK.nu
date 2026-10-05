import {feeSummary} from './fees.mjs';
import {hasMembership} from './store.mjs';
export function dashboard(db,user,season,swishNumber,now=Date.now()){
 const membership=db.prepare('SELECT * FROM memberships WHERE user_id=? AND season=?').get(user.id,season)||null;
 const access=user.roles.includes('ADMIN')||hasMembership(db,user.id,season);
 const base={season,access,membership,swishNumber,fee:{status:'unavailable',amount:null,reason:'Arvodesberäkning kommer snart. Verifierad arvodesmatris saknas.'}};
 if(!access)return base;
 // Cache import only accepts final results. Also reject future/invalid dates here.
 const history=db.prepare(`SELECT m.*,mm.colleague,(SELECT count(*) FROM penalties p WHERE p.match_id=m.id) AS penalty_count FROM matches m JOIN match_members mm ON mm.match_id=m.id WHERE mm.user_id=? AND m.excluded=0 ORDER BY m.starts_at DESC`).all(user.id).filter(m=>Number.isFinite(Date.parse(m.starts_at))&&Date.parse(m.starts_at)<=now);
 const matches=history.filter(m=>m.season===season),ids=new Set(matches.map(m=>m.id));
 const categories=db.prepare('SELECT p.* FROM penalties p JOIN match_members mm ON mm.match_id=p.match_id WHERE mm.user_id=?').all(user.id).filter(p=>ids.has(p.match_id));
 const groups=new Map();for(const p of categories){const key=p.code+'|'+p.category;const g=groups.get(key)||{code:p.code,category:p.category,count:0};g.count++;groups.set(key,g);}
 const months=new Map();for(const m of matches){const key=m.starts_at.slice(0,7);months.set(key,(months.get(key)||0)+1);}
 const coachings=db.prepare(`SELECT c.id,c.match_id,c.published_at,m.home,m.away,m.starts_at,u.name AS coach_name,(SELECT count(*) FROM clips WHERE coaching_id=c.id) AS clip_count,(SELECT viewed_at FROM coaching_views WHERE user_id=? AND coaching_id=c.id) AS viewed_at FROM coachings c JOIN matches m ON m.id=c.match_id JOIN users u ON u.id=c.coach_id WHERE c.member_id=? AND c.status='published' AND m.excluded=0 ORDER BY c.published_at DESC,c.id DESC`).all(user.id,user.id).filter(c=>Number.isFinite(Date.parse(c.starts_at))&&Date.parse(c.starts_at)<=now);
 return {...base,fee:feeSummary(matches,season),counts:{matches:matches.length,penalties:categories.length,coachings:coachings.length,colleagues:new Set(matches.flatMap(m=>m.colleague.split(',').map(x=>x.trim()).filter(Boolean))).size},average:matches.length?categories.length/matches.length:0,months:[...months].sort().map(([month,count])=>({month,count})),topPenalties:[...groups.values()].sort((a,b)=>b.count-a.count||a.category.localeCompare(b.category,'sv')).slice(0,3),latestMatches:matches.slice(0,5),coachings,notifications:db.prepare('SELECT message,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 10').all(user.id)};
}
