'use client';
import {useLanguage,LanguageSwitcher} from '../components/language';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Phone } from 'lucide-react';
import { rooms as originalRooms, tables } from '../../lib/catalog';

import RequestForm from '../request-form';
import { statuses, yerevanToday } from '../../lib/booking';
type Booking = {
    id: string;
    table_id: string;
    start: number;
    end: number;
    name: string;
    phone: string;
    note: string;
    guests: number;
    status: string;
    actor_name?: string;
    updated_at?: number;
};
const dateFormat = (n: number, locale:string) => new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Yerevan', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(n));
export default function AdminPanel({ staffName, manager, embedded=false }: {
    staffName: string;
    manager: boolean;
    embedded?: boolean;
}) {
 const {t:tr,locale,systemNote,guestCount,hourCount}=useLanguage();
 const rooms=originalRooms.map(r=>({...r,name:tr(r.name),subtitle:tr(r.subtitle)}));
    const [rows, setRows] = useState<Booking[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [filter, setFilter] = useState('all'), [date, setDate] = useState(''), [pending, setPending] = useState('');
    const [search, setSearch] = useState(''), [table, setTable] = useState(''), [time, setTime] = useState(''), [scope, setScope] = useState('all'), [page, setPage] = useState(1), [pages, setPages] = useState(1), [total, setTotal] = useState(0), [counts, setCounts] = useState({ pending: 0, confirmed: 0, total: 0 });
    const query = new URLSearchParams({ staff: '1', q: search, date, time, table, status: filter, scope, page: String(page) }).toString();
    const requestId = useRef(0);
    const [creating, setCreating] = useState(false), [assignments, setAssignments] = useState<Record<string, string>>({});
    async function load() { const id = ++requestId.current; try {
        const res = await fetch('/api/reservations?' + query);
        const data = await res.json() as {
            error?: string;
            reservations: Booking[];
            total: number;
            pages: number;
            page: number;
            counts: {
                pending: number;
                confirmed: number;
                total: number;
            };
        };
        if (id !== requestId.current)
            return;
        if (!res.ok)
            throw Error(data.error);
        setRows(data.reservations);
        setTotal(data.total);
        setPages(data.pages);
        setCounts(data.counts);
        if (data.page !== page)
            setPage(data.page);
        setError('');
    }
    catch (e) {
        if (id === requestId.current)
            setError(e instanceof Error ? e.message : tr("Չհաջողվեց բեռնել։"));
    }
    finally {
        if (id === requestId.current)
            setLoading(false);
    } }
    useEffect(() => { setLoading(true); const debounce = setTimeout(load, 250), poll=()=>{if(!document.hidden)void load()}, i = setInterval(poll, 5000); document.addEventListener('visibilitychange',poll); return () => { clearTimeout(debounce); clearInterval(i); document.removeEventListener('visibilitychange',poll); requestId.current++; }; }, [query]);
    function reset() { setSearch(''); setDate(''); setTime(''); setTable(''); setFilter('all'); setScope('all'); setPage(1); }
    async function change(id: string, status: string, tableId?: string) { setPending(id); try {
        const r = await fetch('/api/reservations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, tableId }) });
        const d = await r.json() as {
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : tr("Փորձեք կրկին։"));
    }
    finally {
        setPending('');
    } }
    async function logout() { await fetch('/api/staff/session', { method: 'DELETE' }); window.location.assign('/admin'); }
    const visible = rows;
    return <>{!embedded&&<header className="header"><a className="brand" href="/">◢ katsin.</a><button className="staff-logout" onClick={logout}>{tr("Դուրս գալ")}</button><a href="/" className="header-phone"><ArrowLeft size={16}/>{tr(" Հաճախորդի էջ")}</a></header>}<main className={embedded?"admin-main embedded":"admin-main"}><div className="admin-top"><div><div className="eyebrow">{tr("ԱՇԽԱՏԱԿՑԻ ԲԱԺԻՆ · ")}{manager?tr('Կառավարիչ'):staffName}</div><h2>{tr("Ամրագրումների կառավարում")}</h2></div><button className="primary" onClick={() => setCreating(v => !v)}>{creating ? tr("Փակել ձևը") : tr("+ Նոր ամրագրում")}</button><button className="primary" onClick={load}><RefreshCw size={15}/>{tr("Թարմացնել")}</button></div><div className="admin-create">{creating && <RequestForm admin initialDate={date || undefined} onDone={() => { setCreating(false); load(); }}/>}</div><p className="table-note">{tr("Հաստատելուց առաջ զանգահարեք հյուրին։ Կոնկրետ սեղանի սպասող և հաստատված հայտերը պահում են այն։ «Ցանկացած սեղան» հայտին նախ սեղան նշանակեք։ Ցանկը թարմացվում է ամեն 5 վայրկյանը մեկ։")}</p><p className="admin-scope">{date ? tr("Ընտրված օր՝ {0}", date) : tr("Ցուցադրվում են բոլոր օրերի հայտերը")}</p><div className="admin-stat-grid">{[['pending', tr("Սպասում են զանգի")], ['confirmed', tr("Հաստատված")], ['all', tr("Ընդհանուր հայտեր")]].map(([s, label]) => <div className="admin-stat" key={s}><strong>{s === 'all' ? counts.total : s === 'pending' ? counts.pending : counts.confirmed}</strong><span>{label}</span></div>)}</div><div className="history-tabs" role="group" aria-label={tr("Ամրագրումների ցուցակ")}>{[['all', tr("Բոլոր ամրագրումները")], ['active', tr("Ընթացիկ և առաջիկա")], ['history', tr("Պատմություն")]].map(([v, l]) => <button key={v} aria-pressed={scope === v} className={scope === v ? 'active' : ''} onClick={() => { setScope(v); setPage(1); }}>{l}</button>)}</div><div className="history-filters"><label>{tr("Անուն, հեռախոս կամ հայտի համար")}<input type="search" placeholder={tr("Որոնել ամբողջ պատմության մեջ")} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label><label>{tr("Ամսաթիվ")}<input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}/></label><label>{tr("Սկզբի ժամը")}<input type="time" value={time} onChange={e => { setTime(e.target.value); setPage(1); }}/></label><label>{tr("Սեղան")}<select value={table} onChange={e => { setTable(e.target.value); setPage(1); }}><option value="">{tr("Բոլոր սեղանները")}</option><option value="any">{tr("Ցանկացած սեղան")}</option>{rooms.map(r => <optgroup key={r.id} label={r.name}>{tables.filter(t => t.room === r.id).map(t => <option key={t.id} value={t.id}>№{t.number} · {r.name}</option>)}</optgroup>)}</select></label><label>{tr("Կարգավիճակ")}<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">{tr("Բոլոր կարգավիճակները")}</option>{Object.entries(statuses).map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label><div className="history-shortcuts"><button onClick={() => { setDate(yerevanToday()); setPage(1); }}>{tr("Այսօր")}</button><button onClick={reset}>{tr("Մաքրել զտիչները")}</button></div></div><p className="admin-scope">{tr("Գտնվել է ")}{total}{tr(" ամրագրում · ")}{page} / {pages}{tr(" էջ")}</p>{error && <div className="notice" role="alert">{tr(error)} <a href="/admin">{tr("Ստուգել մուտքը →")}</a></div>}{loading ? <p>{tr("Բեռնվում է…")}</p> : visible.length === 0 ? <div className="admin-empty">{tr("Այս պայմաններով ամրագրումներ չեն գտնվել։ Փոխեք զտիչները կամ ընտրեք բոլոր ամրագրումները։")}</div> : visible.map(b => { const t = tables.find(t => t.id === b.table_id); return <article className="request-card" key={b.id}><div><span className={'status-tag ' + b.status}>{tr(statuses[b.status])}</span><h3>{b.name}</h3><a href={'tel:' + b.phone}><Phone size={12} style={{ display: 'inline', marginRight: 7 }}/>{b.phone}</a><p>{tr("Հայտ՝ ")}{b.id.slice(0, 8).toUpperCase()}</p></div><div><h3>{t ? tr("Սեղան ") + t.number : tr("Ցանկացած սեղան")}</h3><p>{rooms.find(r => r.id === t?.room)?.name || tr("Սեղանը դեռ նշանակված չէ")} · {guestCount(b.guests)}</p><p>{dateFormat(b.start,locale)} — {new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Yerevan', hour: '2-digit', minute: '2-digit' }).format(new Date(b.end))}</p><p>{systemNote(b.note) || tr("Հավելյալ ցանկություններ չկան։")}</p></div><div><p>{b.status === 'pending' ? tr("Զանգահարեք և ճշտեք ամրագրումը։") : b.status === 'confirmed' ? tr("Հյուրի ամրագրումը հաստատված է։") : tr("Սեղանն ազատվել է այս հայտից։")}</p>{b.status === 'pending' && <label className="assign-table">{t ? tr("Ընտրված սեղանը (կարող եք փոխել)") : tr("Նշանակել սեղան")}<select aria-label={tr("Սեղան՝ ") + b.name} value={assignments[b.id] || t?.id || ''} onChange={e => setAssignments(a => ({ ...a, [b.id]: e.target.value }))}><option value="">{tr("Ընտրեք սեղանը")}</option>{rooms.map(r => <optgroup key={r.id} label={r.name}>{tables.filter(t => t.room === r.id && t.capacity >= b.guests).map(t => { const occupied = rows.some(other => other.id !== b.id && other.table_id === t.id && ['pending', 'confirmed'].includes(other.status) && other.start < b.end && other.end > b.start); return <option key={t.id} value={t.id} disabled={occupied}>№{t.number} · {guestCount(t.capacity)}{occupied ? tr(" · զբաղված") : ''}</option>; })}</optgroup>)}</select></label>}{b.actor_name&&<p className="last-action">{tr("Վերջին գործողությունը՝")} {b.actor_name}{b.updated_at?" · "+dateFormat(b.updated_at,locale):""}</p>}<div className="request-actions">{b.status === 'pending' && <><button className="confirm" disabled={pending === b.id || !(assignments[b.id] || t?.id)} onClick={() => change(b.id, 'confirmed', assignments[b.id] || t?.id)}>{tr("Հաստատել զանգից հետո")}</button><button disabled={pending === b.id} onClick={() => change(b.id, 'rejected')}>{tr("Մերժել")}</button></>}{['pending', 'confirmed'].includes(b.status) && <button disabled={pending === b.id} onClick={() => change(b.id, 'cancelled')}>{tr("Չեղարկել")}</button>}</div></div></article>; })}<div className="history-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>{tr("← Նախորդ էջ")}</button><span>{page} / {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>{tr("Հաջորդ էջ →")}</button></div></main></>;
}
