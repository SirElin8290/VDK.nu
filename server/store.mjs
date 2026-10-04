import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function hashPassword(value) { const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(value,salt,64).toString('hex')}`; }
export function verifyPassword(value, hash) { if(!hash)return false;const [salt,key]=hash.split(':');const calculated=scryptSync(value,salt,64);const stored=Buffer.from(key,'hex');return stored.length===calculated.length && timingSafeEqual(stored,calculated); }
export function newToken(){return randomBytes(32).toString('base64url');}
export function openStore(path=':memory:'){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS roles(user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('MEMBER','VIDEO_COACH','ADMIN')), PRIMARY KEY(user_id,role));
  CREATE TABLE IF NOT EXISTS memberships(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),season TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','active','rejected','expired')),paid INTEGER NOT NULL DEFAULT 0,payment_reference TEXT NOT NULL UNIQUE,consented_at TEXT NOT NULL,approved_at TEXT,paid_at TEXT,paid_by INTEGER REFERENCES users(id),UNIQUE(user_id,season));
  CREATE TABLE IF NOT EXISTS tokens(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),membership_id INTEGER REFERENCES memberships(id),kind TEXT NOT NULL CHECK(kind IN ('activation','reset')),expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY,external_match_id TEXT NOT NULL UNIQUE,season TEXT NOT NULL,starts_at TEXT NOT NULL,home TEXT NOT NULL,away TEXT NOT NULL,level TEXT NOT NULL CHECK(level IN ('senior','youth')),source_url TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS match_members(match_id INTEGER NOT NULL REFERENCES matches(id),user_id INTEGER NOT NULL REFERENCES users(id),colleague TEXT NOT NULL DEFAULT '',PRIMARY KEY(match_id,user_id));
  CREATE TABLE IF NOT EXISTS penalties(id INTEGER PRIMARY KEY,match_id INTEGER NOT NULL REFERENCES matches(id),external_event_id TEXT NOT NULL,category TEXT NOT NULL,seconds INTEGER NOT NULL,UNIQUE(match_id,external_event_id));
  CREATE TABLE IF NOT EXISTS coach_applications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),motivation TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS coachings(id INTEGER PRIMARY KEY,match_id INTEGER NOT NULL REFERENCES matches(id),coach_id INTEGER NOT NULL REFERENCES users(id),member_id INTEGER NOT NULL REFERENCES users(id),video_url TEXT NOT NULL,rights_note TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,published_at TEXT);
  CREATE TABLE IF NOT EXISTS clips(id INTEGER PRIMARY KEY,coaching_id INTEGER NOT NULL REFERENCES coachings(id),start_seconds INTEGER NOT NULL,end_seconds INTEGER NOT NULL,category TEXT NOT NULL,comment TEXT NOT NULL,audio_url TEXT NOT NULL DEFAULT '',CHECK(start_seconds>=0 AND end_seconds>start_seconds));
  CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),message TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor_id INTEGER REFERENCES users(id),action TEXT NOT NULL,target_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const columns=new Set(db.prepare('PRAGMA table_info(memberships)').all().map(x=>x.name));
  if(!columns.has('category'))db.exec("ALTER TABLE memberships ADD COLUMN category TEXT NOT NULL DEFAULT 'active' CHECK(category IN ('active','support','club','business'))");
  if(!columns.has('amount'))db.exec('ALTER TABLE memberships ADD COLUMN amount INTEGER NOT NULL DEFAULT 100');
  if(!columns.has('organization'))db.exec("ALTER TABLE memberships ADD COLUMN organization TEXT NOT NULL DEFAULT ''");
  return db;
}
export function transaction(db,fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function getRoles(db,id){return db.prepare('SELECT role FROM roles WHERE user_id=?').all(id).map(x=>x.role);}
export function publicUser(db,id,season){const u=db.prepare('SELECT id,name,email FROM users WHERE id=?').get(id);return u?{...u,roles:getRoles(db,id),season}:null;}
export function hasMembership(db,id,season){return !!db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND status='active' AND paid=1 AND category!='business'").get(id,season);}
export function audit(db,actor,action,target){db.prepare('INSERT INTO audit(actor_id,action,target_id) VALUES (?,?,?)').run(actor,action,target);}
export function createAdmin(db,{name,email,password,season}){return transaction(db,()=>{let u=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(u)throw new Error('Kontot finns redan. Skapa inte om en befintlig administratör.');const id=Number(db.prepare('INSERT INTO users(name,email,password_hash) VALUES (?,?,?)').run(name,email.toLowerCase(),hashPassword(password)).lastInsertRowid);db.prepare('INSERT INTO roles VALUES (?,?)').run(id,'MEMBER');db.prepare('INSERT INTO roles VALUES (?,?)').run(id,'ADMIN');db.prepare("INSERT INTO memberships(user_id,season,status,paid,payment_reference,consented_at) VALUES (?,?,'active',1,?,?)").run(id,season,'ADMIN-'+newToken().slice(0,10),new Date().toISOString());return id;});}
export function statistics(db,{season,userId,colleague=''}){
  const params=[season];let where='m.season=?';
  if(userId){where+=' AND EXISTS (SELECT 1 FROM match_members mm WHERE mm.match_id=m.id AND mm.user_id=?'+(colleague?' AND mm.colleague=?':'')+')';params.push(userId);if(colleague)params.push(colleague);}
  else{where+=" AND EXISTS (SELECT 1 FROM match_members mm JOIN memberships ms ON ms.user_id=mm.user_id WHERE mm.match_id=m.id AND ms.season=m.season AND ms.category='active' AND ms.paid=1 AND ms.status IN ('active','expired'))";}
  const matches=db.prepare(`SELECT count(*) AS count FROM matches m WHERE ${where}`).get(...params).count;
  const categories=db.prepare(`SELECT p.category,count(*) AS count FROM penalties p JOIN matches m ON m.id=p.match_id WHERE ${where} GROUP BY p.category ORDER BY count DESC,p.category`).all(...params);
  return {matches,penalties:categories.reduce((n,x)=>n+x.count,0),categories};
}
export function importMatch(db,record){
  if(!record.externalMatchId || !record.sourceUrl?.startsWith('https://') || !['senior','youth'].includes(record.level))throw new Error('Verifierat match-id, källa och nivå krävs.');
  const source=new URL(record.sourceUrl);if(!['innebandy.se','stats.innebandy.se','www.innebandy.se'].includes(source.hostname))throw new Error('Matchunderlaget måste ha en officiell innebandykälla.');
  if(!record.season || !record.home || !record.away || !Number.isFinite(Date.parse(record.startsAt)))throw new Error('Ofullständig match.');
  if(!Array.isArray(record.members)||!record.members.length)throw new Error('Matchen måste tillhöra en VDK-medlem.');
  return transaction(db,()=>{
    for(const member of record.members){const valid=db.prepare("SELECT 1 FROM memberships WHERE user_id=? AND season=? AND category='active' AND paid=1 AND status IN ('active','expired')").get(member.userId,record.season);if(!valid)throw new Error('Matchen får endast kopplas till säsongens aktiva domarmedlemmar i VDK.');}
    db.prepare('INSERT INTO matches(external_match_id,season,starts_at,home,away,level,source_url) VALUES (?,?,?,?,?,?,?) ON CONFLICT(external_match_id) DO UPDATE SET season=excluded.season,starts_at=excluded.starts_at,home=excluded.home,away=excluded.away,level=excluded.level,source_url=excluded.source_url').run(record.externalMatchId,record.season,record.startsAt,record.home,record.away,record.level,record.sourceUrl);
    const id=db.prepare('SELECT id FROM matches WHERE external_match_id=?').get(record.externalMatchId).id;
    for(const member of record.members)db.prepare('INSERT INTO match_members VALUES (?,?,?) ON CONFLICT(match_id,user_id) DO UPDATE SET colleague=excluded.colleague').run(id,member.userId,member.colleague||'');
    db.prepare('DELETE FROM penalties WHERE match_id=?').run(id);
    for(const event of record.penalties||[]){if(!event.externalEventId||!event.category||!Number.isInteger(event.seconds)||event.seconds<0)throw new Error('Ogiltig matchhändelse.');db.prepare('INSERT INTO penalties(match_id,external_event_id,category,seconds) VALUES (?,?,?,?)').run(id,event.externalEventId,event.category,event.seconds);}
    return id;
  });
}
