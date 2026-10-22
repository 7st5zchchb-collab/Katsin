export const statuses: Record<string,string> = {pending:'Սպասում է զանգով հաստատման',confirmed:'Հաստատված',rejected:'Մերժված',cancelled:'Չեղարկված'};
export function yerevanToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Yerevan',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function interval(date:string,time:string,duration:number){ const start=Date.parse(`${date}T${time}:00+04:00`); return {start,end:start+duration*3600000}; }
export function validWindow(start:number,end:number){return Number.isFinite(start)&&Number.isFinite(end)&&start>Date.now()&&start<Date.now()+366*86400000&&end>start&&end-start<=6*3600000;}
