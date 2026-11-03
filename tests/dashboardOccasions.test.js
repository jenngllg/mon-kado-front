import { expect, it } from 'vitest';
import { groupDashboardOccasions } from '../src/features/home/dashboardOccasions.js';
const today = new Date('2026-11-03T00:00:00Z');
/** @param {string} id @param {string} occasion @param {string} date @param {string} [ownerId] */
function list(id, occasion, date, ownerId = id) { return {id,occasion,eventDate:date,ownerId,ownerDisplayName:'Camille',name:'Liste '+id,href:'/lists/'+id}; }
it('groups Christmas before limiting the next three distinct occasions', () => {
  const result = groupDashboardOccasions([
    ...['a','b','c','d'].map(id=>list(id,'christmas','2026-12-25')),
    list('e','birthday','2027-01-18'), list('f','wedding','2027-02-10')],today);
  expect(result).toHaveLength(3);expect(result.map(item=>item.lists.length)).toEqual([4,1,1]);
  expect(result[0].title).toBe('Noël');expect(result[0].ownerCount).toBe(4);
});
it('deduplicates by list identifier and prefers owner then group over followed access', () => {
  const followed=list('a','christmas','2026-12-25','owner'),group={...followed,id:'A',href:'/groups/g/wishlists/a'},own={...followed,href:'/lists/a'};
  const result=groupDashboardOccasions([followed,group,own,list('b','christmas','2026-12-25','owner')],today);
  expect(result[0].lists).toHaveLength(2);expect(result[0].ownerCount).toBe(1);expect(result[0].lists.find(item=>item.id==='a')?.href).toBe('/lists/a');
});
it('keeps people with identical names separate but groups their own birthday lists', () => {
  const result=groupDashboardOccasions([list('a','birthday','2020-01-18','alice'),list('b','birthday','2021-01-18','alice'),list('c','birthday','2022-01-18','bob')],today);
  expect(result).toHaveLength(2);expect(result.map(item=>item.lists.length).sort()).toEqual([1,2]);expect(result.every(item=>item.date==='2027-01-18')).toBe(true);
});
it('keeps distinct dates and unrelated custom occasions separate and omits past or undated lists', () => {
  const result=groupDashboardOccasions([list('past','wedding','2020-01-18'),{...list('none','birthday','2027-01-18'),eventDate:null},list('a','christmas','2026-12-24'),list('b','christmas','2026-12-25'),list('c','other','2026-12-25'),list('d','other','2026-12-25')],today);
  expect(result.map(item=>item.date)).toEqual(['2026-12-24','2026-12-25','2026-12-25']);expect(result.every(item=>item.lists.length===1)).toBe(true);
});
it('does not invent owner counts or merge unidentified birthday owners', () => {
  const missing={...list('a','birthday','2027-01-18'),ownerId:undefined};
  expect(groupDashboardOccasions([missing,{...missing,id:'b'}],today)).toHaveLength(2);
  expect(groupDashboardOccasions([{...missing,occasion:'christmas'}],today)[0].ownerCount).toBeNull();
});
