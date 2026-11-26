// Run after build-journey-catalog.mjs. Only reviewed identity/location corrections.
import {readFile,writeFile} from 'node:fs/promises';
import {StatsSource} from './stats-source.mjs';
const path='data-catalogs/journey-2026-27.json',data=JSON.parse(await readFile(path,'utf8'));
const source=new StatsSource(),rows=await source.get('/venues/4874/matches');
const matches=rows.filter(m=>Number(m.SeasonID)===44&&!m.Cancelled&&data.competitions.some(c=>c.id===m.CompetitionID));
if(matches.length&&!data.halls.some(h=>h.id===4874))data.halls.push({id:4874,name:'Vallargärdets Sporthall',city:'Vallargärdet',address:'',lat:null,lng:null,inScope:true,scheduledMatches:matches.length,locationNote:'Vallargärdets skola, Ulvsby. Exakt kartposition saknas i matchkällan.',locationSource:'https://www.laget.se/UlvsbyIF-tabata/Event/Month/2026/11/18?eventId=30624007'});
// Two API identifiers for the same named court at identical coordinates count once.
// Distinct court names (A/B, AllOffice/ASP/Klubbhuset) remain separate.
const grouped=new Map();for(const hall of data.halls){hall.name=hall.name.trim();const key=[hall.name.toLocaleLowerCase('sv'),hall.lat,hall.lng].join('|');if(!grouped.has(key))grouped.set(key,{...hall,aliases:hall.aliases||[hall.id]});else{const h=grouped.get(key);h.aliases=[...new Set([...h.aliases,...(hall.aliases||[hall.id])])];h.scheduledMatches+=hall.scheduledMatches;}}
data.halls=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'sv'));data.clubs.forEach(c=>c.name=c.name.trim());
data.locationReview={excluded:[{id:3670,name:'Norrbyhallen',reason:'Örebro'},{id:3484,name:'Tybblelundsskolan',reason:'Örebro'},{id:4116,name:'Lindbacka Sporthall',reason:'Lindesberg'}],sources:['https://orebro.se/kultur--fritid/motion--idrott/idrottsanlaggningar/kommunens-bokningsbara-idrottsanlaggningar.html','https://www.lindesberg.se/download/18.f8e5dc7175d75112a2bbbb/1606214154869/Pressmeddelande%2011%20november%202020_Nya%20namn%20p%C3%A5%20tva%CC%8A%20omra%CC%8Aden%20i%20Lindesberg.pdf'],unpositioned:[4874]};
data.errors=data.errors.filter(e=>!data.locationReview.excluded.some(v=>v.id===e.venue)&&e.venue!==4874);
await writeFile(path,JSON.stringify(data,null,2));console.log(JSON.stringify({halls:data.halls.length,clubs:data.clubs.length,errors:data.errors,unpositioned:data.halls.filter(h=>!h.lat).map(h=>h.name)}));
