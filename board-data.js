export const BOARD_LIMITS=Object.freeze({players:24,teamPlayers:12,arrows:30,drawings:30,pointsPerDrawing:200,totalPoints:1000,bytes:24576});
export const emptyBoard=()=>({version:1,referees:[],players:[],ball:null,arrows:[],drawings:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Ogiltig tavledata.');}
function point(p){keys(p,['x','y']);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)throw Error('Positioner måste ligga på planen.');return {x:p.x,y:p.y};}
export function normalizeBoard(value){
 keys(value,['version','referees','players','ball','arrows','drawings']);if(value.version!==1)throw Error('Tavlans version stöds inte.');
 for(const k of ['referees','players','arrows','drawings'])if(!Array.isArray(value[k]))throw Error('Ogiltig tavledata.');
 if(value.referees.length>2||value.players.length>BOARD_LIMITS.players||value.arrows.length>BOARD_LIMITS.arrows||value.drawings.length>BOARD_LIMITS.drawings)throw Error('För många markörer eller linjer på tavlan.');
 const refereeIds=new Set(),playerIds=new Set();
 const referees=value.referees.map(r=>{keys(r,['id','x','y']);if(!['D1','D2'].includes(r.id)||refereeIds.has(r.id))throw Error('Endast D1 och D2 får användas en gång vardera.');refereeIds.add(r.id);return {id:r.id,...point({x:r.x,y:r.y})};});
 const players=value.players.map(p=>{keys(p,['id','team','x','y']);if(typeof p.id!=='string'||!/^p[0-9]{1,6}$/.test(p.id)||playerIds.has(p.id)||!['A','B'].includes(p.team))throw Error('Ogiltig spelarmarkör.');playerIds.add(p.id);return {id:p.id,team:p.team,...point({x:p.x,y:p.y})};});
 for(const team of ['A','B'])if(players.filter(p=>p.team===team).length>BOARD_LIMITS.teamPlayers)throw Error('Högst 12 spelare per lag.');
 const ball=value.ball===null?null:point(value.ball);
 const arrows=value.arrows.map(a=>{keys(a,['from','to']);return {from:point(a.from),to:point(a.to)};});
 let count=0;const drawings=value.drawings.map(d=>{keys(d,['points']);if(!Array.isArray(d.points)||d.points.length<2||d.points.length>BOARD_LIMITS.pointsPerDrawing)throw Error('Ogiltig frihandslinje.');count+=d.points.length;return {points:d.points.map(point)};});if(count>BOARD_LIMITS.totalPoints)throw Error('För många ritpunkter på tavlan.');
 const board={version:1,referees,players,ball,arrows,drawings};if(new TextEncoder().encode(JSON.stringify(board)).length>BOARD_LIMITS.bytes)throw Error('Tavlan är för stor.');return board;
}
export const clampPoint=p=>({x:Math.round(Math.max(0,Math.min(1,p.x))*10000)/10000,y:Math.round(Math.max(0,Math.min(1,p.y))*10000)/10000});
export const courtPoint=p=>clampPoint({x:(p.x-20)/400,y:(p.y-20)/200});
export class BoardModel{
 constructor(data=emptyBoard()){this.state=normalizeBoard(data);this.past=[];this.future=[];}
 commit(data){const next=normalizeBoard(data);if(JSON.stringify(next)===JSON.stringify(this.state))return false;this.past.push(clone(this.state));if(this.past.length>80)this.past.shift();this.state=next;this.future=[];return true;}
 addMarker(tool,p){const s=clone(this.state),q=clampPoint(p);if(tool==='referee'){const id=['D1','D2'].find(id=>!s.referees.some(r=>r.id===id));if(!id)throw Error('D1 och D2 finns redan. Dra dem för att flytta dem.');s.referees.push({id,...q});}else if(tool==='A'||tool==='B'){const max=Math.max(0,...s.players.map(p=>Number(p.id.slice(1))));s.players.push({id:'p'+(max+1),team:tool,...q});}else if(tool==='ball')s.ball=q;else return false;return this.commit(s);}
 moveMarker(key,p){const s=clone(this.state),q=clampPoint(p);const target=key==='ball'?s.ball:key.startsWith('ref:')?s.referees.find(r=>r.id===key.slice(4)):s.players.find(r=>r.id===key.slice(7));if(!target)return false;Object.assign(target,q);return this.commit(s);}
 addArrow(from,to){const s=clone(this.state);s.arrows.push({from:clampPoint(from),to:clampPoint(to)});return this.commit(s);}
 addDrawing(points){const s=clone(this.state);s.drawings.push({points:points.map(clampPoint)});return this.commit(s);}
 undo(){if(!this.past.length)return false;this.future.push(clone(this.state));this.state=this.past.pop();return true;}
 redo(){if(!this.future.length)return false;this.past.push(clone(this.state));this.state=this.future.pop();return true;}
 clear(){return this.commit(emptyBoard());}
 serialize(){return JSON.stringify(this.state);}
 restore(data){return this.commit(typeof data==='string'?JSON.parse(data):data);}
}
