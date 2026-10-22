'use client';
import {useLanguage,LanguageSwitcher} from './components/language';
import { useState } from 'react';
import { interval, yerevanToday } from '../lib/booking';
import { rooms as originalRooms, tables } from '../lib/catalog';
export default function RequestForm({ admin = false, onDone, initialDate, initialTime = '19:00', initialGuests = 2, initialDuration = 3 }: {
    admin?: boolean;
    onDone: () => void;
    initialDate?: string;
    initialTime?: string;
    initialGuests?: number;
    initialDuration?: number;
}) {
 const {t:tr,locale,systemNote,guestCount,hourCount}=useLanguage();
 const rooms=originalRooms.map(r=>({...r,name:tr(r.name),subtitle:tr(r.subtitle)}));
    const [date, setDate] = useState(initialDate || yerevanToday()), [time, setTime] = useState(initialTime), [duration, setDuration] = useState(initialDuration), [guests, setGuests] = useState(initialGuests), [tableId, setTableId] = useState('any'), [sending, setSending] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
    async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const fd = new FormData(e.currentTarget); setSending(true); setError(''); try {
        const r = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId, ...interval(date, time, duration), guests, name: fd.get('name'), phone: fd.get('phone'), occasion: fd.get('occasion'), note: fd.get('note'), status: admin ? fd.get('status') : 'pending' }) });
        const d = await r.json() as {
            id: string;
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        setSuccess(d.id);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : tr("Փորձեք կրկին։"));
    }
    finally {
        setSending(false);
    } }
    if (success)
        return <div className="success-panel"><div className="eyebrow">{tr("ՀԱՅՏԸ ՍՏԱՑՎԱԾ Է")}</div><h2>{admin ? tr("Ամրագրումը պահպանված է։") : tr("Շնորհակալություն։ Մենք կզանգահարենք ձեզ։")}</h2><p>{admin ? tr("Հայտը կարող եք կառավարել ցանկում։") : tr("Աշխատակիցը կճշտի ցանկությունները և ձեզ համար սեղան կառաջարկի։ Ամրագրումը վերջնական է զանգով հաստատելուց հետո։")}</p><small>{tr("Հայտ՝ ")}{success.slice(0, 8).toUpperCase()}</small><p /><button className="primary" onClick={onDone}>{tr("Փակել")}</button></div>;
    return <form className="request-form" onSubmit={submit}><div className="eyebrow">{admin ? tr("ԱՇԽԱՏԱԿՑԻ ԲԱԺԻՆ") : tr("ԱՄՐԱԳՐՄԱՆ ՀԱՅՏ")}</div><h2>{admin ? tr("Նոր ամրագրում") : tr("Ցանկացած սեղան · անվճար")}</h2><p className="table-note">{admin ? tr("Ընտրեք սեղանն ու կարգավիճակը։") : tr("Ամրագրումն անվճար է։ Կոնկրետ սեղան չի ընտրվում․ մեր աշխատակիցը ձեզ կտեղավորի հասանելի սեղաններից մեկի մոտ։")}</p><div className="request-fields"><label>{tr("Անուն, ազգանուն")}<input name="name" required minLength={3} maxLength={100} autoComplete="name" placeholder={tr("Անի Սարգսյան")}/></label><label>{tr("Հեռախոսահամար")}<input name="phone" type="tel" required pattern="[+0-9 ()\-]{8,24}" maxLength={24} autoComplete="tel" placeholder="+374 __ ______"/></label><label>{tr("Ամսաթիվ")}<input type="date" min={yerevanToday()} required value={date} onInput={e => setDate(e.currentTarget.value)}/></label><label>{tr("Ժամը")}<input type="time" required value={time} onInput={e => setTime(e.currentTarget.value)}/></label><label>{tr("Հյուրերի քանակ")}<input type="number" min={1} max={50} required value={guests} onInput={e => setGuests(+e.currentTarget.value)}/></label><label>{tr("Տևողություն")}<select value={duration} onChange={e => setDuration(+e.target.value)}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{hourCount(n)}</option>)}</select></label><label>{tr("Առիթը ")}<span>{tr("(ոչ պարտադիր)")}</span><select name="occasion"><option value="">{tr("Նշված չէ")}</option>{[tr("Սովորական այցելություն"), tr("Ծննդյան օր"), tr("Տարեդարձ"), tr("Ընտանեկան հանդիպում"), tr("Գործնական հանդիպում"), tr("Այլ առիթ")].map(n => <option key={n}>{n}</option>)}</select></label>{admin && <><label>{tr("Սեղան")}<select value={tableId} onChange={e => setTableId(e.target.value)}><option value="any">{tr("Ցանկացած սեղան · անվճար")}</option>{rooms.map(r => <optgroup key={r.id} label={r.name}>{tables.filter(t => t.room === r.id && t.capacity >= guests).map(t => <option key={t.id} value={t.id}>№{t.number} · {t.capacity}{tr(" անձ · 20 000 ֏")}</option>)}</optgroup>)}</select></label><label>{tr("Կարգավիճակ")}<select name="status"><option value="pending">{tr("Սպասում է զանգի")}</option><option value="confirmed" disabled={tableId === 'any'}>{tr("Հաստատված է · հյուրի հետ ճշտված")}</option></select></label></>}</div><label>{tr("Հավելյալ ցանկություններ")}<textarea name="note" maxLength={1000} rows={2} placeholder={tr("Սրահ, հատուկ ցանկություն կամ այլ մանրամասներ")}/></label>{!admin && <label className="consent"><input type="checkbox" required/>{tr("Համաձայն եմ, որ կապվեն ինձ հետ՝ հայտը հաստատելու համար։")}</label>}{error && <div className="notice" role="alert">{tr(error)}</div>}<button className="primary submit" disabled={sending}>{sending ? tr("Ուղարկվում է…") : admin ? tr("Պահպանել ամրագրումը") : tr("Ուղարկել հայտը")}</button></form>;
}
