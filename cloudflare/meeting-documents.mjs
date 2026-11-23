import {PDFDocument} from 'pdf-lib';
export function initializeMeetingDocuments(db){db.exec(`CREATE TABLE IF NOT EXISTS meeting_documents(id INTEGER PRIMARY KEY,room_id TEXT NOT NULL REFERENCES meeting_rooms(id),title TEXT NOT NULL,content TEXT NOT NULL,filename TEXT NOT NULL,uploaded_by INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS meeting_documents_room ON meeting_documents(room_id,id);
CREATE TABLE IF NOT EXISTS meeting_document_chunks(document_id INTEGER NOT NULL REFERENCES meeting_documents(id),position INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(document_id,position));`);}
export async function meetingDocuments({db,room,user,method,body,documentId,pdf,fail,json,res,rate,req}){
 const text=(v,min,max)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)fail(400,'Kontrollera rubrik och innehåll.');return v.trim();};
 if(method==='POST'&&!documentId){
  if(room.status!=='open')fail(409,'Mötet är avslutat.');
  if(!db.prepare('SELECT 1 FROM meeting_attendees WHERE room_id=? AND user_id=? AND last_seen>?').get(room.id,user.id,Date.now()-120000))fail(409,'Gå med i mötet först.');
  rate(req,'meeting-document-'+user.id,30);
  if(db.prepare('SELECT count(*) n FROM meeting_documents WHERE room_id=?').get(room.id).n>=100)fail(409,'Mötet har redan 100 dokument.');
  const title=text(body.title,2,180),content=text(body.content,1,80000),filename=text(body.filename||'Mötesdokument.pdf',1,180);
  if(body.reviewed!==true)fail(400,'Granska dokumentets text innan du laddar upp.');
  if(typeof body.pdf!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(body.pdf))fail(400,'En PDF-version krävs.');
  const pdf=Buffer.from(body.pdf,'base64');
  if(pdf.length>5*1024*1024)fail(413,'PDF-filen får vara högst 5 MB.');
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||!pdf.subarray(-2048).includes(Buffer.from('%%EOF')))fail(400,'Filen är inte en giltig PDF.');
  try{const parsed=await PDFDocument.load(pdf);if(parsed.getPageCount()>200)fail(400,'Dokumentet får vara högst 200 sidor.');}catch{fail(400,'PDF-filen kunde inte läsas.');}
  const id=db.transaction(()=>{const row=db.prepare('INSERT INTO meeting_documents(room_id,title,content,filename,uploaded_by,created_at) VALUES(?,?,?,?,?,?)').run(room.id,title,content,filename,user.id,new Date().toISOString());const id=Number(row.lastInsertRowid);for(let i=0;i<pdf.length;i+=65536)db.prepare('INSERT INTO meeting_document_chunks VALUES(?,?,?)').run(id,i/65536,pdf.subarray(i,i+65536));return id;});
  return json(201,{id}),true;
 }
 if(documentId&&method==='GET'){
  const d=db.prepare('SELECT d.*,u.name AS uploaded_by_name FROM meeting_documents d JOIN users u ON u.id=d.uploaded_by WHERE d.id=? AND d.room_id=?').get(Number(documentId),room.id);
  if(!d)fail(404,'Dokumentet hittades inte.');
  if(!pdf)return json(200,{document:d}),true;
  const bytes=Buffer.concat(db.prepare('SELECT data FROM meeting_document_chunks WHERE document_id=? ORDER BY position').all(d.id).map(r=>Buffer.from(r.data)));
  res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="VDK-mote-'+d.id+'.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;
 }
 fail(405,'Metoden stöds inte.');
}
