import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// The output is fixed to this repository's public build folder.
const output=new URL('../public-build/',import.meta.url);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ['index.html','styles.css','app.js','config.js','theme.js','demo-questions.js','development.js','statutes.js'])await copyFile(new URL('../'+file,import.meta.url),new URL(file,output));
await cp(new URL('../assets/',import.meta.url),new URL('assets/',output),{recursive:true});
await cp(new URL('../rule-demo/',import.meta.url),new URL('innebandyregler/',output),{recursive:true});
if(process.argv.includes('--worker'))await cp(new URL('../innebandyregler/',import.meta.url),new URL('member-rules/',output),{recursive:true});
console.log('Publika filer exporterade från '+root);
