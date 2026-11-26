import {build} from 'esbuild';import {copyFile,mkdir}from'node:fs/promises';
await mkdir('assets/documents',{recursive:true});
await build({entryPoints:['document-converter.js'],bundle:true,format:'esm',platform:'browser',outfile:'assets/documents/converter.js',minify:true});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs','assets/documents/pdf.worker.mjs');

await build({entryPoints:['meeting-audio.js'],bundle:true,format:'esm',platform:'browser',outfile:'assets/meetings/audio.js',minify:true});

await mkdir('assets/journey',{recursive:true});
await build({entryPoints:['journey-maps.js'],bundle:true,format:'esm',platform:'browser',outfile:'assets/journey/maps.js',minify:true});
await copyFile('node_modules/leaflet/dist/leaflet.css','assets/journey/leaflet.css');
