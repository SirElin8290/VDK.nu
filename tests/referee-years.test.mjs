import {test} from 'node:test';import assert from 'node:assert/strict';
import {refereeYears,parseRefereeStartYear,refereeCalendarYear} from '../server/referee-years.mjs';
const now=new Date('2026-11-26T12:00:00Z');
test('career badges are cumulative and exact at all six milestones through 50 calendar years',()=>{
 for(const [years,expected]of [[0,[]],[4,[]],[5,[5]],[9,[5]],[10,[5,10]],[19,[5,10]],[20,[5,10,20]],[29,[5,10,20]],[30,[5,10,20,30]],[39,[5,10,20,30]],[40,[5,10,20,30,40]],[49,[5,10,20,30,40]],[50,[5,10,20,30,40,50]],[60,[5,10,20,30,40,50]]])assert.deepEqual(refereeYears(2026-years,now).badges.map(b=>b.milestone),expected);
 assert.equal(refereeYears(null,now).years,null);assert.deepEqual(refereeYears(null,now).badges,[]);assert.deepEqual(refereeYears(2027,now).badges,[]);
});
test('start year validation permits clearing and rejects future, malformed or noninteger values',()=>{
 assert.equal(parseRefereeStartYear(' 2001 ',now),2001);assert.equal(parseRefereeStartYear(2026,now),2026);for(const value of ['',null,'   '])assert.equal(parseRefereeStartYear(value,now),null);
 for(const value of [2027,1899,2001.5,true,{},'20e2','2020-01-01'])assert.throws(()=>parseRefereeStartYear(value,now));
});
test('year rollover follows Sweden and recalculates without background jobs',()=>{
 const before=new Date('2026-12-31T22:59:59Z'),after=new Date('2026-12-31T23:00:00Z');assert.equal(refereeCalendarYear(before),2026);assert.equal(refereeCalendarYear(after),2027);assert.equal(refereeYears(2022,before).badges.length,0);assert.equal(refereeYears(2022,after).badges[0].milestone,5);
});
