import {env} from 'cloudflare:workers';
import {currentStaff} from '../../../staff-auth';
import {canBook,canCash} from '../../../../lib/staff-roles';
import {staffJson as json} from '../../../../lib/staff-data';
export async function GET(req:Request){
 try{
 const who=await currentStaff();if(!who||(!canBook(who.role)&&!canCash(who.role)))return json({error:'Մուտքը սահմանափակ է։'},403);
 const u=new URL(req.url),clauses:string[]=[],args:string[]=[];
 if(!who.manager){clauses.push(who.role==='cashier'?"entity_type='bill'":"entity_type='reservation'")}
 for(const [param,column] of [['actor','actor_id'],['entity','entity_id'],['subject','subject_id']] as const){const v=u.searchParams.get(param);if(v){clauses.push(column+'=?');args.push(v.slice(0,100))}}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const total=await env.DB!.prepare('SELECT count(*) AS total FROM staff_activity'+where).bind(...args).first<{total:number}>();
 const pages=Math.max(1,Math.ceil((total?.total||0)/30)),page=Math.min(pages,Math.max(1,Math.floor(Number(u.searchParams.get('page')||1))||1));
 const rows=await env.DB!.prepare('SELECT * FROM staff_activity'+where+' ORDER BY created_at DESC,id DESC LIMIT 30 OFFSET ?').bind(...args,(page-1)*30).all();return json({activity:rows.results,pages,page,total:total?.total||0});
 }catch{return json({error:'Պատմությունը չհաջողվեց բեռնել։'},503)}
}
