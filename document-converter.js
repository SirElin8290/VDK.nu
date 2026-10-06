import mammoth from 'mammoth/mammoth.browser.js';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/documents/pdf.worker.mjs',location.href).href;
export async function readDocument(file){
 if(!file||file.size>5*1024*1024)throw Error('Välj en fil på högst 5 MB.');const bytes=new Uint8Array(await file.arrayBuffer()),ext=file.name.split('.').at(-1).toLowerCase();let content='',pdf=null;
 if(ext==='pdf'){const task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,useSystemFonts:true}),doc=await task.promise;try{if(doc.numPages>200)throw Error('Dokumentet får vara högst 200 sidor.');for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),text=await page.getTextContent();content+=text.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n\n';}pdf=bytes;}finally{await task.destroy();}}
 else if(ext==='docx'){const html=await mammoth.convertToHtml({arrayBuffer:bytes.buffer},{externalFileAccess:false});const parsed=new DOMParser().parseFromString(html.value,'text/html');if(parsed.querySelector('img'))throw Error('Word-filen innehåller bilder. Exportera den som PDF i Word och ladda upp PDF-versionen för att bevara hela innehållet.');parsed.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,tr').forEach(el=>{if(el.tagName==='TR'||(el.tagName==='P'&&el.closest('li')))return;content+=el.textContent+'\n\n';});}
 else if(ext==='txt')content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 else throw Error('Välj PDF, Word (.docx) eller en UTF-8-textfil (.txt).');
 if(content.length>80000)throw Error('Dokumentets text får vara högst 80 000 tecken.');return {content:content.trim(),pdf,originalPdf:ext==='pdf'};
}
export async function textPdf(title,content){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const font=await doc.embedFont(await(await fetch('assets/documents/NotoSans-Regular.ttf')).arrayBuffer(),{subset:true});let page,y;const next=()=>{page=doc.addPage([595.28,841.89]);y=790;};next();
 const write=(text,size)=>{const words=text.split(/\s+/),lines=[];let line='';for(const word of words){for(const char of (line?' ':'')+word){if(font.widthOfTextAtSize(line+char,size)>490){lines.push(line);line='';}line+=char;}}lines.push(line);for(const l of lines){if(y<55)next();page.drawText(l,{x:50,y,size,font});y-=size*1.55;}y-=8;};write(title,18);for(const paragraph of content.split(/\n/))write(paragraph,11);return doc.save();
}
export function base64Pdf(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}

export async function renderExistingPdf(url,canvas){
 const task=pdfjs.getDocument({url,isEvalSupported:false,useSystemFonts:true}),doc=await task.promise;try{const page=await doc.getPage(1),original=page.getViewport({scale:1}),view=page.getViewport({scale:Math.min(2,1000/original.width)});canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;}finally{await task.destroy();}
}
