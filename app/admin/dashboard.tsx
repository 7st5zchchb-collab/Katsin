'use client';
import {useState} from 'react';
import {useLanguage} from '../components/language';
import {StaffIdentity,canBook,canCash,roleLabels} from '../../lib/staff-roles';
import AdminPanel from './panel';
import StaffProfile from './profile';
import StaffMembers from './staff-members';
import Cashier from './cashier';
import Activity from './activity';
import Schedule from './schedule';
import Tips from './tips';
import Closing from './closing';
import AssistantRates from './assistant-rates';
import TipHistory from './tip-history';
import {canViewSchedule} from '../../lib/schedule';
import {CalendarDays} from 'lucide-react';
export default function Dashboard({who}:{who:StaffIdentity}){const {t}=useLanguage();const [tab,setTab]=useState(canCash(who.role)&&!who.manager?'cashier':canBook(who.role)?'bookings':'profile'),[error,setError]=useState('');const showActivity=canBook(who.role)||canCash(who.role);
 async function logout(){try{const r=await fetch('/api/staff/session',{method:'DELETE'});if(!r.ok)throw Error();window.location.assign('/admin')}catch{setError(t('Փորձեք կրկին։'))}}
 const showSchedule=canViewSchedule(who,'assistant')||canViewSchedule(who,'waiter')||canViewSchedule(who,'host');
 const showTips=who.manager||['waiter','assistant'].includes(who.role);
 const showClosing=who.manager||who.role==='waiter';
 const showAssistantRates=who.manager||!!who.scheduleGroups?.includes('assistant');
 const tabs=[...(showTips?[['tip-history','Ստացած գումարներ']]:[]),...(showAssistantRates?[['assistant-rates','Օգնականների տոկոսներ']]:[]),...(showClosing?[['closing','Պլեն և օրվա փակում']]:[]),...(showTips?[['tips','Թեյավճարներ']]:[]),...(showSchedule?[['schedule','Գրաֆիկ']]:[]),...(canBook(who.role)?[['bookings','Ամրագրումներ']]:[]),...(canCash(who.role)?[['cashier','Գանձապահ']]:[]),['profile',who.manager?'Պրոֆիլներ և հերթափոխեր':'Իմ պրոֆիլը'],...(who.manager?[['team','Աշխատակիցներ']]:[]),...(showActivity?[['activity','Գործողություններ']]:[])];
 return <><header className="staff-header"><a href="/" aria-label="Katsin"><img src="/katsin-logo.png" alt="Katsin" width="94" height="44"/></a><div className="staff-identity"><strong>{who.name}</strong><span>{t(roleLabels[who.role])}</span></div><button className="staff-logout" onClick={logout}>{t('Դուրս գալ')}</button></header><main className="staff-dashboard"><nav className="staff-tabs" aria-label={t('Աշխատակցի բաժին')}>{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} aria-pressed={tab===id} onClick={()=>setTab(id)}>{id==='schedule'&&<CalendarDays size={16}/ >}{t(label)}</button>)}</nav>{error&&<p className="notice">{error}</p>}<div className={'staff-layout '+(showActivity&&tab!=='activity'?'with-activity':'')}><div className="staff-content">{tab==='bookings'&&canBook(who.role)&&<AdminPanel embedded staffName={who.name} manager={who.manager}/ >}{tab==='schedule'&&showSchedule&&<Schedule who={who}/ >}{tab==='tip-history'&&showTips&&<TipHistory manager={who.manager}/ >}{tab==='assistant-rates'&&showAssistantRates&&<AssistantRates/>}{tab==='closing'&&showClosing&&<Closing/>}{tab==='tips'&&showTips&&<Tips who={who}/ >}{tab==='profile'&&<StaffProfile who={who}/ >}{tab==='team'&&who.manager&&<StaffMembers/>}{tab==='cashier'&&canCash(who.role)&&<Cashier manager={who.manager}/ >}{tab==='activity'&&showActivity&&<Activity/>}</div>{showActivity&&tab!=='activity'&&<aside className="staff-aside"><Activity compact/></aside>}</div></main></>
}
