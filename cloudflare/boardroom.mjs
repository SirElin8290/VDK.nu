import {PDFDocument} from 'pdf-lib';
import {hasBoardAccess} from './board-access.mjs';
import {ensureBoardMeeting} from './meetings.mjs';
export function initializeBoardroom(db){db.exec(`CREATE TABLE IF NOT EXISTS board_documents(id INTEGER PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,filename TEXT NOT NULL,uploaded_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS board_document_chunks(document_id INTEGER NOT NULL REFERENCES board_documents(id),position INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(document_id,position));
CREATE TABLE IF NOT EXISTS board_proposals(id INTEGER PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',version INTEGER NOT NULL DEFAULT 1,created_by INTEGER NOT NULL REFERENCES users(id),updated_by INTEGER NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL);`);}
export async function boardroomAction({db,path,method,body,req,requireMembership,fail,json,res}){
 if(!/^\/api\/boardroom(?:\/|$)/.test(path))return false;
 const user=requireMembership(req);
 if(!hasBoardAccess(db,user.id))fail(403,'Styrelserummet är bara tillgängligt för behöriga styrelsemedlemmar.');
 const text=(v,min,max)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)fail(400,'Kontrollera rubrik och innehåll.');return v.trim();};
 if(path==='/api/boardroom'&&method==='GET'){
  const meeting=ensureBoardMeeting(db);
  return json(200,{meetingId:meeting.id,members:db.prepare('SELECT u.id,u.name FROM users u JOIN board_access a ON a.user_id=u.id ORDER BY u.name').all(),participants:db.prepare('SELECT u.id,u.name FROM meeting_attendees a JOIN users u ON u.id=a.user_id WHERE a.room_id=? AND a.last_seen>? ORDER BY a.joined_at').all(meeting.id,Date.now()-120000),documents:db.prepare('SELECT d.id,d.title,d.filename,d.created_at,u.name AS uploaded_by FROM board_documents d JOIN users u ON u.id=d.uploaded_by ORDER BY d.created_at DESC,d.id DESC').all(),proposals:db.prepare('SELECT p.*,u.name AS updated_by_name FROM board_proposals p JOIN users u ON u.id=p.updated_by ORDER BY p.updated_at DESC,p.id DESC').all()}),true;
 }
 if(path==='/api/boardroom/documents'&&method==='POST'){
  const title=text(body.title,2,180),content=text(body.content,1,80000),filename=text(body.filename||'Styrelsedokument.pdf',1,180);
  if(body.reviewed!==true)fail(400,'Granska dokumentets text innan du laddar upp.');
  if(typeof body.pdf!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(body.pdf))fail(400,'En PDF-version krävs.');
  const pdf=Buffer.from(body.pdf,'base64');
  if(pdf.length>5*1024*1024)fail(413,'PDF-filen får vara högst 5 MB.');
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||!pdf.subarray(-2048).includes(Buffer.from('%%EOF')))fail(400,'Filen är inte en giltig PDF.');
  try{const parsed=await PDFDocument.load(pdf);if(parsed.getPageCount()>200)fail(400,'Dokumentet får vara högst 200 sidor.');}catch{fail(400,'PDF-filen kunde inte läsas.');}
  const id=db.transaction(()=>{const row=db.prepare('INSERT INTO board_documents(title,content,filename,uploaded_by,created_at) VALUES(?,?,?,?,?)').run(title,content,filename,user.id,new Date().toISOString());const id=Number(row.lastInsertRowid);for(let i=0;i<pdf.length;i+=65536)db.prepare('INSERT INTO board_document_chunks VALUES(?,?,?)').run(id,i/65536,pdf.subarray(i,i+65536));return id;});
  return json(201,{id}),true;
 }
 const document=path.match(/^\/api\/boardroom\/documents\/(\d+)(\/pdf)?$/);
 if(document&&method==='GET'){
  const d=db.prepare('SELECT d.*,u.name AS uploaded_by_name FROM board_documents d JOIN users u ON u.id=d.uploaded_by WHERE d.id=?').get(Number(document[1]));
  if(!d)fail(404,'Dokumentet hittades inte.');
  if(!document[2])return json(200,{document:d}),true;
  const bytes=Buffer.concat(db.prepare('SELECT data FROM board_document_chunks WHERE document_id=? ORDER BY position').all(d.id).map(r=>Buffer.from(r.data)));
  res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="VDK-styrelse-'+d.id+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
 }
 const proposal=path.match(/^\/api\/boardroom\/proposals(?:\/(\d+))?$/);
 if(proposal&&method==='POST'){
  const title=text(body.title,2,180),content=text(body.content,1,40000),status=body.status||'draft';
  if(!['draft','working','done'].includes(status))fail(400,'Välj en giltig status.');
  let id=Number(proposal[1]);
  if(id){
   if(!Number.isSafeInteger(body.version)||body.version<1)fail(400,'Versionsuppgift saknas.');
   const result=db.prepare('UPDATE board_proposals SET title=?,content=?,status=?,version=version+1,updated_by=?,updated_at=? WHERE id=? AND version=?').run(title,content,status,user.id,new Date().toISOString(),id,body.version);
   if(!result.changes)fail(409,'Förslaget har ändrats av en kollega. Kopiera din text och öppna förslaget igen innan du sparar.');
  }else id=Number(db.prepare('INSERT INTO board_proposals(title,content,status,created_by,updated_by,updated_at) VALUES(?,?,?,?,?,?)').run(title,content,status,user.id,user.id,new Date().toISOString()).lastInsertRowid);
  return json(proposal[1]?200:201,{id}),true;
 }
 fail(404,'Styrelsefunktionen hittades inte.');
}
