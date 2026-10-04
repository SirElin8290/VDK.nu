import {planSync,runSyncBatch,isSwedishMondayThree} from './sync.mjs';
import {DurableObject} from 'cloudflare:workers';
import {initializeStore} from './store.mjs';
import {createApp} from './api.mjs';
export class VdkDatabase extends DurableObject{
 constructor(ctx,env){super(ctx,env);this.env=env;const sql=ctx.storage.sql;this.db={exec:q=>sql.exec(q),transaction:fn=>ctx.storage.transactionSync(fn),prepare:q=>({all:(...p)=>[...sql.exec(q,...p)],get:(...p)=>[...sql.exec(q,...p)][0],run:(...p)=>{sql.exec(q,...p);return {lastInsertRowid:[...sql.exec('SELECT last_insert_rowid() AS id')][0].id,changes:[...sql.exec('SELECT changes() AS n')][0].n};}})};initializeStore(this.db);}
 async startSync(window){return planSync(this,window);}
 async alarm(){return runSyncBatch(this);}
 async fetch(request){const u=new URL(request.url);if(u.pathname.startsWith('/internal/')){
 if(!this.env.IMPORT_SECRET||request.headers.get('Authorization')!=='Bearer '+this.env.IMPORT_SECRET)return Response.json({error:'Åtkomst nekad'},{status:403});
 if(u.pathname==='/internal/sync'&&request.method==='POST')return Response.json(await this.startSync('manual-'+new Date().toISOString()));
 if(u.pathname==='/internal/status'&&request.method==='GET')return Response.json({sync:this.db.prepare('SELECT window,position,errors,started_at FROM regional_sync_plan WHERE id=1').get()||null,lastRun:this.db.prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1').get()||null,matches:this.db.prepare('SELECT season,count(*) AS count FROM matches WHERE excluded=0 GROUP BY season').all()});
 if(u.pathname!=='/internal/import'||request.method!=='POST')return Response.json({error:'Funktionen hittades inte'},{status:404});
 const body=await request.json();if(!Array.isArray(body.statements)||body.statements.length>300)return Response.json({error:'Ogiltig import'},{status:400});this.db.transaction(()=>{for(const s of body.statements){if(typeof s.sql!=='string'||!Array.isArray(s.params))throw Error('Ogiltig import');this.db.prepare(s.sql).run(...s.params);}});return Response.json({ok:true,count:body.statements.length});}
 const {handler}=this.app||(this.app=createApp({db:this.db,env:this.env,origin:this.env.PUBLIC_ORIGIN||u.origin}));const headers=new Headers();let status=200,body=null;const req={url:u.pathname+u.search,method:request.method,headers:Object.fromEntries(request.headers),socket:{remoteAddress:request.headers.get('CF-Connecting-IP')||'unknown'},async *[Symbol.asyncIterator](){yield Buffer.from(await request.arrayBuffer());}};const res={setHeader:(k,v)=>headers.set(k,v),writeHead:(s,h)=>{status=s;if(h)for(const[k,v]of Object.entries(h))headers.set(k,v);},end:b=>{body=b??null;}};await handler(req,res);return new Response(body,{status,headers});}
}
export default{async scheduled(controller,env,ctx){const window=isSwedishMondayThree(controller.scheduledTime);if(window)ctx.waitUntil(env.VDK_DB.get(env.VDK_DB.idFromName('vdk-production')).startSync(window));},async fetch(request,env){const u=new URL(request.url);if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/internal/')){const id=env.VDK_DB.idFromName('vdk-production');return env.VDK_DB.get(id).fetch(request);}const r=await env.ASSETS.fetch(request);const headers=new Headers(r.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('Cache-Control','no-cache');return new Response(r.body,{status:r.status,headers});}};

