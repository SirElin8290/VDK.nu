export function refereeCalendarYear(now=new Date()){
 return Number(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric'}).format(now));
}
export function parseRefereeStartYear(value,now=new Date()){
 if(value===null||typeof value==='string'&&!value.trim())return null;
 const current=refereeCalendarYear(now);
 if(!['number','string'].includes(typeof value)||!/^\d{4}$/.test(String(value).trim()))throw Object.assign(Error('Ange startåret med fyra siffror eller lämna tomt.'),{status:400});
 const year=Number(value);if(!Number.isInteger(year)||year<1900||year>current)throw Object.assign(Error('Startåret ska vara mellan 1900 och '+current+'.'),{status:400});return year;
}
export function refereeYears(startYear,now=new Date()){
 const currentYear=refereeCalendarYear(now),valid=Number.isInteger(startYear)&&startYear>=1900&&startYear<=currentYear,years=valid?currentYear-startYear:null;
 const levels=[[5,'bronze'],[10,'silver'],[20,'gold']].map(([target,tier])=>({target,tier,earned:years!==null&&years>=target}));
 return {currentYear,years,levels,badges:levels.filter(l=>l.earned).map(l=>({kind:'referee-years',scope:'career',tier:l.tier,label:l.target+' domarår',milestone:l.target}))};
}
