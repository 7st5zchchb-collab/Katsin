import type {StaffIdentity} from './staff-roles';
export type ScheduleGroup='assistant'|'waiter'|'host';
export const validGroup=(g:unknown):g is ScheduleGroup=>g==='assistant'||g==='waiter'||g==='host';
export const assistantShiftCodes=['SH','11','1'] as const;
export type AssistantShiftCode=typeof assistantShiftCodes[number];
export type ScheduleCell=({kind:'off'}|{kind:'shift',start:string,end:string}|{kind:'code',code:AssistantShiftCode})&{closing?:boolean};
export type ScheduleEntries=Record<string,Record<string,ScheduleCell>>;
export type ScheduleSnapshot={entries:ScheduleEntries,at:number,by:string,publishAt?:number,roster?:{id:string,name:string}[]};
export type WeeklySchedule={mutation?:string,revision:number,draft:ScheduleEntries,published:ScheduleSnapshot|null,scheduled:ScheduleSnapshot|null,updatedAt:number,updatedBy:string};
export const canEditSchedule=(who:StaffIdentity,group:ScheduleGroup)=>who.manager||!!who.scheduleGroups?.includes(group);
export const canViewSchedule=(who:StaffIdentity,group:ScheduleGroup)=>who.manager||who.role===group||!!who.scheduleGroups?.includes(group);
export const dayAt=(n:number)=>new Date(n+4*3600000).toISOString().slice(0,10);
export function mondayFor(day=dayAt(Date.now())){const d=new Date(day+'T00:00:00Z');const shift=(d.getUTCDay()+6)%7;return new Date(+d-shift*86400000).toISOString().slice(0,10)}
export function weekDays(monday:string){return Array.from({length:7},(_,i)=>new Date(Date.parse(monday+'T00:00:00Z')+i*86400000).toISOString().slice(0,10))}
export function validWeek(day:unknown):day is string{if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(day+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===day&&d.getUTCDay()===1&&day>='2020-01-01'&&day<='2100-12-31'}
export function visibleSnapshot(schedule:WeeklySchedule,now:number){return schedule.scheduled&&schedule.scheduled.publishAt!<=now?schedule.scheduled:schedule.published}
export function validateEntries(raw:unknown,ids:string[],week:string,complete:boolean,group?:ScheduleGroup):ScheduleEntries|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const days=weekDays(week),clean:ScheduleEntries={};
 for(const [id,row] of Object.entries(raw)){
  if(!ids.includes(id)||!row||typeof row!=='object'||Array.isArray(row))return null;
  clean[id]={};
  for(const [day,rawCell] of Object.entries(row)){
   const cell=rawCell as Record<string,unknown>;
   if(!days.includes(day)||!cell||typeof cell!=='object')return null;
   if(cell.closing!==undefined&&typeof cell.closing!=='boolean'||cell.closing===true&&(group!=='waiter'||cell.kind==='off'||cell.kind==='code'&&cell.code==='11'||cell.kind==='shift'&&cell.start==='11:00'))return null;
   if(cell.kind==='off')clean[id][day]={kind:'off'};
   else if((group==='assistant'||group==='waiter')&&cell.kind==='code'&&assistantShiftCodes.includes(cell.code as AssistantShiftCode))clean[id][day]={kind:'code',code:cell.code as AssistantShiftCode};
   else if(cell.kind==='shift'&&typeof cell.start==='string'&&typeof cell.end==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(cell.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(cell.end)&&cell.start!==cell.end)clean[id][day]={kind:'shift',start:cell.start,end:cell.end};
   else return null;
   if(group==='waiter'&&cell.closing===true)clean[id][day].closing=true;
  }
 }
 if(complete&&(!ids.length||ids.some(id=>days.some(day=>!clean[id]?.[day]))))return null;
 return clean;
}

export function shiftCode(cell?:ScheduleCell):'OFF'|'SH'|'11'|'1'|'?' {if(!cell)return '?';if(cell.kind==='off')return 'OFF';if(cell.kind==='code')return cell.code;if(cell.start==='11:00')return '11';if(cell.start==='13:00')return '1';return '?'}
export function assistantDay(entries:ScheduleEntries,people:{id:string,name:string}[],day:string){const groups:{OFF:typeof people,SH:typeof people,'11':typeof people,'1':typeof people,'?':typeof people}={OFF:[],SH:[],'11':[],'1':[],'?':[]};for(const p of people)groups[shiftCode(entries[p.id]?.[day])].push(p);return {groups,balanced:groups['11'].length===2&&groups['1'].length===1&&[1,2].includes(groups.OFF.length)&&groups['?'].length===0};}
export type DepartureOrder={first?:string,second?:string,day?:string,boundary?:boolean,reason:'decided'|'off-tie'|'missing'|'tie'|'count'};
export function departureOrder(ids:string[],day:string,entries:ScheduleEntries):DepartureOrder{
 if(ids.length!==2)return {reason:'count'};const [a,b]=ids;if(!!entries[a]?.[day]?.closing!==!!entries[b]?.[day]?.closing)return {reason:'decided',first:entries[a]?.[day]?.closing?b:a,second:entries[a]?.[day]?.closing?a:b,day};const rank=(s:string)=>s==='11'?0:s==='1'?1:2;
 // Only compare known contiguous dates. Never invent an order from names or IDs.
 const known=Object.values(entries).flatMap(row=>Object.keys(row)).sort(),last=known.at(-1)||day;
 for(let i=1;i<=98;i++){const next=new Date(Date.parse(day+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);if(next>last)return {reason:'missing',day:next};const x=shiftCode(entries[a]?.[next]),y=shiftCode(entries[b]?.[next]);if(x==='?'||y==='?')return {reason:'missing',day:next};
 if(x!==y&&(x==='11'||x==='1'||y==='11'||y==='1'))return {reason:'decided',first:rank(x)<rank(y)?a:b,second:rank(x)<rank(y)?b:a,day:next};
 if(x==='OFF'||y==='OFF'){const prev=new Date(Date.parse(next+'T00:00:00Z')-86400000).toISOString().slice(0,10),px=shiftCode(entries[a]?.[prev]),py=shiftCode(entries[b]?.[prev]);if(px!=='?'&&py!=='?'&&rank(px)!==rank(py))return {reason:'decided',first:rank(px)<rank(py)?a:b,second:rank(px)<rank(py)?b:a,day:prev,boundary:true};return {reason:'off-tie',day:next,boundary:true};}
 }return {reason:'tie'};
}

export function closingRoster(snapshot:ScheduleSnapshot|null,day:string){return (snapshot?.roster||[]).filter(p=>{const c=snapshot?.entries[p.id]?.[day];return c&&c.kind!=='off'&&c.closing===true}).map(p=>({id:p.id,name:p.name}));}

export function departureRanks(people:{id:string}[],day:string,entries:ScheduleEntries,group:ScheduleGroup):Record<string,number>{
 if(group==='host')return {};
 const early=people.filter(p=>shiftCode(entries[p.id]?.[day])==='11'&&!entries[p.id]?.[day]?.closing);if(early.length!==2)return {};
 const ranks:Record<string,number>={},pair=departureOrder(early.map(p=>p.id),day,entries);if(pair.reason==='decided'){ranks[pair.first!]=1;ranks[pair.second!]=2;}if(group==='assistant')return ranks;
 const rest=people.filter(p=>{const c=entries[p.id]?.[day];return c&&c.kind!=='off'&&!c.closing&&shiftCode(c)!=='11'});
 // A number is assigned only when every comparison for that person is resolved.
 for(const p of rest){let before=0,resolved=true;for(const q of rest){if(p.id===q.id)continue;const comparison=departureOrder([p.id,q.id],day,entries);if(comparison.reason!=='decided'){resolved=false;break;}if(comparison.first===q.id)before++;}if(resolved)ranks[p.id]=3+before;}
 const counts:Record<number,number>={};for(const n of Object.values(ranks))counts[n]=(counts[n]||0)+1;for(const [id,n] of Object.entries(ranks))if(counts[n]>1)delete ranks[id];return ranks;
}
