import {build} from 'esbuild';import {copyFile,mkdir}from'node:fs/promises';
await mkdir('assets/documents',{recursive:true});
await build({entryPoints:['document-converter.js'],bundle:true,format:'esm',platform:'browser',outfile:'assets/documents/converter.js',minify:true});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs','assets/documents/pdf.worker.mjs');
