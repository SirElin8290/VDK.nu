import {DatabaseSync} from 'node:sqlite';
import {initializeStore} from '../cloudflare/store.mjs';
export function cloudStore(){
 const db=new DatabaseSync(':memory:');
 db.transaction=fn=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 initializeStore(db);return db;
}
