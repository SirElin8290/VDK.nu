import {openStore,createAdmin} from './store.mjs';
const {ADMIN_NAME:name,ADMIN_EMAIL:email,ADMIN_PASSWORD:password}=process.env;
if(!name||!email||!password||password.length<12)throw new Error('Ange ADMIN_NAME, ADMIN_EMAIL och ADMIN_PASSWORD (minst 12 tecken) i miljön.');
const db=openStore(process.env.DB_PATH||'./data/vdk.sqlite');
createAdmin(db,{name,email,password,season:process.env.SEASON||'2026/27'});
db.close();console.log('Administratören är skapad. Ta bort ADMIN_PASSWORD ur miljön.');
