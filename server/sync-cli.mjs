import {openStore} from './store.mjs';
import {syncStats} from './stats-sync.mjs';
const db=openStore(process.env.DB_PATH||'./data/vdk.sqlite');
try{const report=await syncStats(db,{seasonIds:(process.env.STATS_SEASON_IDS||'40,41,42,43,44').split(',').map(Number),federationIds:(process.env.STATS_FEDERATION_IDS||'11,1').split(',').map(Number),full:process.argv.includes('--full'),onProgress:p=>console.log(`${p.season}: ${p.competition}; kontrollerade ${p.examined}, importerade ${p.imported}`)});console.log(JSON.stringify(report,null,2));if(report.status!=='complete')process.exitCode=1;}finally{db.close();}
