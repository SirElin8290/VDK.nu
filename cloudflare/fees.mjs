// VDK's supplied 2026/27 matrix. Amount per referee, travel excluded.
export function matchFee(season,name){
 if(season!=='2026/27')return null;
 const n=name.normalize('NFC').toLocaleLowerCase('sv-SE');
 // Tournament phases must be explicit; never infer a phase from dates.
 if(/(?:\bdm\b|distriktsmästerskap|lilla vm)/.test(n)){
  if(/junior/.test(n)&&/\bdm\b|distriktsmästerskap/.test(n))return 580;
  const group=/gruppspel/.test(n),final=/slutspel/.test(n);if(group===final)return null;
  if(/lilla vm/.test(n))return group?280:350;
  if(/senior/.test(n))return group?720:1000;
  return null;
 }
 if(/(?:herrjunior|damjunior|hj|dj)\s*17\b/.test(n)&&/region/.test(n))return 790;
 if(/junior|\bhj\s*18|\bdj\s*18|förbund|allsvensk|svenska super|\bssl\b/.test(n))return null;
 const division=n.match(/(?:herrar?|damer?)\s+(?:division|div\.?)\s*([1-5])\b|\b([hd])([1-5])\b/);
 if(division){const gender=division[2]||(division[0].startsWith('h')?'h':'d'),level=Number(division[1]||division[3]);return ({h:{2:1000,3:910,4:790,5:690},d:{1:1000,2:910,3:790}})[gender]?.[level]??null;}
 const red=n.match(/röd(?:\s+serie)?\s*([1-9])\b/);if(red)return Number(red[1])<=2?500:370;
 if(/blå(?:\s+serie)?\s*[1-3]\b/.test(n))return 300;
 if(/grön|poolspel/.test(n))return 180;
 return null;
}
export function feeSummary(matches,season){
 const items=matches.map(m=>({id:m.id,starts_at:m.starts_at,home:m.home,away:m.away,competition_name:m.competition_name,amount:matchFee(season,m.competition_name)}));
 const priced=items.filter(m=>m.amount!==null),months=new Map();for(const m of priced){const key=m.starts_at.slice(0,7);months.set(key,(months.get(key)||0)+m.amount);}
 return {status:!priced.length?'unavailable':priced.length===items.length?'complete':'partial',amount:priced.length?priced.reduce((sum,m)=>sum+m.amount,0):null,pricedMatches:priced.length,unpricedMatches:items.length-priced.length,items,months:[...months].sort().map(([month,amount])=>({month,amount})),source:'VDK:s arvodesunderlag 2026/27',reason:season==='2026/27'?'Matchnivåer som inte kan kopplas säkert till arvodesunderlaget lämnas utan belopp.':'Verifierat arvodesunderlag saknas för säsongen.'};
}
