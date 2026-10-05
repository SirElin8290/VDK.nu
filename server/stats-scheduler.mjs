import {syncStats} from './stats-sync.mjs';
export function scheduledWindow(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return parts.weekday==='Mon'&&parts.hour==='03'?`${parts.year}-${parts.month}-${parts.day}`:null;
}
export function startStatsScheduler(db,{seasonIds=[40,41,42,43,44],federationIds=[11,1],onReport=report=>console.log('VDK statistics sync:',report.status,report.imported,'matches')}={}){
  let running=false;
  async function tick(){const window=scheduledWindow();if(!window||running)return;if(db.prepare('SELECT 1 FROM sync_lock WHERE id=1').get())return;const claim=db.prepare("INSERT OR IGNORE INTO sync_schedule_windows VALUES (?,?,'running')").run(window,new Date().toISOString());if(!claim.changes)return;running=true;try{const report=await syncStats(db,{seasonIds,federationIds});db.prepare('UPDATE sync_schedule_windows SET status=? WHERE window=?').run(report.status,window);onReport(report);}catch(e){db.prepare("UPDATE sync_schedule_windows SET status='failed' WHERE window=?").run(window);console.error('VDK statistics sync failed:',e.message);}finally{running=false;}}
  const timer=setInterval(tick,30000);timer.unref();void tick();return ()=>clearInterval(timer);
}
