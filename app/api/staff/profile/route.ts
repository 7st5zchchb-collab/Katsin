import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {staffJson as json,memberById,monthBounds,yerevanDay} from '../../../../lib/staff-data';
export async function GET(req:Request){
 try{
 const who=await currentStaff();if(!who)return json({error:'Մուտքն անհրաժեշտ է։'},403);
 const u=new URL(req.url),id=u.searchParams.get('staffId')||who.id,month=u.searchParams.get('month')||yerevanDay().slice(0,7);
 if(id!==who.id&&!who.manager)return json({error:'Հասանելի է միայն ձեր պրոֆիլը։'},403);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2020-01'||month>'2100-12')return json({error:'Սխալ ամիս։'},400);
 const m=id==='manager'?{id,name:env.STAFF_MANAGER_NAME||'Գլխավոր կառավարիչ',role:'manager',active:true}:await memberById(id);if(!m)return json({error:'Աշխատակիցը չի գտնվել։'},404);
 const {from,to}=monthBounds(month),now=Date.now(),limit=Math.min(now,to),page=Math.max(1,Math.min(100000,Number(u.searchParams.get('page')||1)||1));
 const count=await env.DB!.prepare('SELECT count(*) AS total FROM staff_shifts WHERE staff_id=? AND started_at<? AND coalesce(ended_at,?)>?').bind(id,to,now,from).first<{total:number}>();
 const shifts=await env.DB!.prepare('SELECT id,staff_id,started_at,ended_at,updated_at,actor_name,reason FROM staff_shifts WHERE staff_id=? AND started_at<? AND coalesce(ended_at,?)>? ORDER BY started_at DESC LIMIT 31 OFFSET ?').bind(id,to,now,from,(Math.floor(page)-1)*31).all();
 const stats=await env.DB!.prepare('SELECT coalesce(sum(max(0,min(coalesce(ended_at,?),?)-max(started_at,?))),0) AS milliseconds FROM staff_shifts WHERE staff_id=? AND started_at<? AND coalesce(ended_at,?)>?').bind(now,to,from,id,to,now,from).first<{milliseconds:number}>();
 const days=await env.DB!.prepare("WITH RECURSIVE days(day,stamp) AS (SELECT ?,? UNION ALL SELECT date(day,'+1 day'),stamp+86400000 FROM days WHERE stamp+86400000<?) SELECT count(*) AS total FROM days WHERE EXISTS(SELECT 1 FROM staff_shifts WHERE staff_id=? AND started_at<min(days.stamp+86400000,?) AND coalesce(ended_at,?)>days.stamp)").bind(month+'-01',from,limit,id,limit,now).first<{total:number}>();
 const open=await env.DB!.prepare('SELECT id,started_at FROM staff_shifts WHERE staff_id=? AND ended_at IS NULL').bind(id).first();
 let revenue:unknown=null;
 if(m.role==='waiter'){
 const manual=await env.DB!.prepare('SELECT day,amount,updated_at,updated_name,revision FROM staff_revenue WHERE staff_id=? AND day>=? AND day<? ORDER BY day DESC').bind(id,month+'-01',yerevanDay(to)).all<{day:string,amount:number,revision:number,updated_name:string,updated_at:number}>();
 const bills=await env.DB!.prepare("SELECT business_day AS day,sum(total) AS amount,count(*) AS bills FROM table_bills WHERE waiter_id=? AND status='closed' AND business_day>=? AND business_day<? GROUP BY business_day").bind(id,month+'-01',yerevanDay(to)).all<{day:string,amount:number,bills:number}>();
 const merged=new Map<string,{day:string,amount:number,revision:number,source:string,bills:number,updated_name?:string,updated_at?:number}>();
 for(const r of bills.results)merged.set(r.day,{...r,revision:0,source:'bills'});
 for(const r of manual.results)merged.set(r.day,{...r,bills:merged.get(r.day)?.bills||0,source:'manual'});
 const daily=[...merged.values()].sort((a,b)=>b.day.localeCompare(a.day));
 const today=yerevanDay(),todayManual=await env.DB!.prepare('SELECT amount FROM staff_revenue WHERE staff_id=? AND day=?').bind(id,today).first<{amount:number}>();
 const todayBills=await env.DB!.prepare("SELECT sum(total) AS amount FROM table_bills WHERE waiter_id=? AND status='closed' AND business_day=?").bind(id,today).first<{amount:number|null}>();
 const lifetime=await env.DB!.prepare("SELECT coalesce(sum(amount),0) AS amount FROM (SELECT amount FROM staff_revenue WHERE staff_id=? UNION ALL SELECT total AS amount FROM table_bills b WHERE waiter_id=? AND status='closed' AND NOT EXISTS (SELECT 1 FROM staff_revenue r WHERE r.staff_id=b.waiter_id AND r.day=b.business_day))").bind(id,id).first<{amount:number}>();
 revenue={daily,monthTotal:daily.reduce((a,r)=>a+r.amount,0),today:todayManual?.amount??todayBills?.amount??null,lifetime:lifetime?.amount||0};
 }
 return json({member:{id:m.id,name:m.name,role:m.role||'host',active:m.active},month,shifts:shifts.results,open,stats:{milliseconds:stats?.milliseconds||0,days:days?.total||0},pages:Math.max(1,Math.ceil((count?.total||0)/31)),page:Math.floor(page),revenue});
 }catch{return json({error:'Պրոֆիլը չհաջողվեց բեռնել։'},503)}
}
