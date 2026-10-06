import{PDFDocument}from'pdf-lib';
export const documentSections={sif:'Svenska Innebandyförbundet',vibf:'Värmlands Innebandyförbund',vdk:'Värmlands Domarkollektiv'};
export function initializeDocuments(db){db.exec(`CREATE TABLE IF NOT EXISTS member_documents(id INTEGER PRIMARY KEY,title TEXT NOT NULL,section TEXT NOT NULL,content TEXT NOT NULL,filename TEXT NOT NULL,created_at TEXT NOT NULL,uploaded_by INTEGER NOT NULL REFERENCES users(id));CREATE TABLE IF NOT EXISTS document_pdf_chunks(document_id INTEGER NOT NULL REFERENCES member_documents(id),position INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(document_id,position));`);}
export async function documentsAction({db,path,method,body,req,requireMembership,auth,fail,res,json}){
 if(!path.startsWith('/api/documents')&&!path.startsWith('/api/admin/documents'))return false;
 const admin=path.startsWith('/api/admin/');const u=admin?auth(req,'ADMIN'):requireMembership(req);
 if(method==='GET'&&path==='/api/documents'){json(200,{sections:documentSections,documents:db.prepare('SELECT id,title,section,created_at FROM member_documents ORDER BY title COLLATE NOCASE').all()});return true;}
 const match=path.match(/^\/api\/documents\/(\d+)(\/pdf)?$/);
 if(match&&method==='GET'){const d=db.prepare('SELECT id,title,section,content,filename,created_at FROM member_documents WHERE id=?').get(Number(match[1]));if(!d)fail(404,'Dokumentet hittades inte.');if(!match[2])json(200,{document:d});else{const bytes=Buffer.concat(db.prepare('SELECT data FROM document_pdf_chunks WHERE document_id=? ORDER BY position').all(d.id).map(x=>Buffer.from(x.data)));res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="VDK-dokument-${d.id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);}return true;}
 if(path==='/api/admin/documents'&&method==='POST'){
 const title=typeof body.title==='string'?body.title.trim():'',content=typeof body.content==='string'?body.content.trim():'';
 if(title.length<2||title.length>180||!Object.hasOwn(documentSections,body.section)||!content||content.length>80000)fail(400,'Ange rubrik, sektion och hela dokumentets text (högst 80 000 tecken).');
 if(typeof body.pdf!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(body.pdf))fail(400,'En PDF-version krävs.');const pdf=Buffer.from(body.pdf,'base64');if(pdf.length>5*1024*1024)fail(413,'PDF-filen får vara högst 5 MB.');if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||!pdf.subarray(-2048).includes(Buffer.from('%%EOF')))fail(400,'Filen är inte en giltig PDF.');
 try{const parsed=await PDFDocument.load(pdf);if(parsed.getPageCount()>200)fail(400,'Dokumentet får vara högst 200 sidor.');}catch{fail(400,'PDF-filen kunde inte läsas. Använd en giltig PDF utan lösenord.');}
 const id=db.transaction(()=>{const row=db.prepare('INSERT INTO member_documents(title,section,content,filename,created_at,uploaded_by) VALUES(?,?,?,?,?,?)').run(title,body.section,content,'VDK-dokument.pdf',new Date().toISOString(),u.id);const id=Number(row.lastInsertRowid);for(let i=0;i<pdf.length;i+=65536)db.prepare('INSERT INTO document_pdf_chunks VALUES(?,?,?)').run(id,i/65536,pdf.subarray(i,i+65536));return id;});json(201,{ok:true,id});return true;}
 fail(404,'Dokumentfunktionen hittades inte.');
}
