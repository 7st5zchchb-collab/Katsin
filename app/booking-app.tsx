'use client';
import {useLanguage,LanguageSwitcher} from './components/language';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Check, ChevronLeft, ChevronRight, Clock, MapPin, Phone, Users, X, LayoutGrid, Map, CalendarDays, LoaderCircle } from 'lucide-react';
import { rooms as originalRooms, tables, Table } from '../lib/catalog';
import { interval, yerevanToday } from '../lib/booking';
import { phoneLabel, restaurantPhone } from '../lib/config';
import RequestForm from './request-form';
import Discover from './discover';
import {photoPreview} from '../lib/photo-previews';
const labels = ['Սրահի ընդհանուր տեսքը', 'Սեղանը և նստատեղերը', 'Տեսարանը սեղանից'];
export default function BookingApp() {
 const {t:tr,locale,systemNote,guestCount,hourCount}=useLanguage();
 const rooms=originalRooms.map(r=>({...r,name:tr(r.name),subtitle:tr(r.subtitle)}));
    const [floor, setFloor] = useState('main');
    const [room, setRoom] = useState('coupe1'), [date, setDate] = useState(''), [time, setTime] = useState('19:00'), [guests, setGuests] = useState(2), [duration, setDuration] = useState(3), [mode, setMode] = useState('cards');
    const [busy, setBusy] = useState<Record<string, string>>({}), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [refresh, setRefresh] = useState(0);
    const [selected, setSelected] = useState<Table | null>(null), [photo, setPhoto] = useState(0), [sending, setSending] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
    const [lastBooking, setLastBooking] = useState<{
        date: string;
        time: string;
        guests: number;
        number: string;
    } | null>(null);
    const [anyOpen, setAnyOpen] = useState(false);
    const [introOpen, setIntroOpen] = useState(true);
    const [introTab, setIntroTab] = useState(1);
    const introDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { if (introOpen)
        introDialog.current?.showModal();
    else
        introDialog.current?.close(); }, [introOpen]);
    const anyDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { if (anyOpen)
        anyDialog.current?.showModal();
    else
        anyDialog.current?.close(); }, [anyOpen]);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => setDate(yerevanToday()), []);
    useEffect(() => {
        if (!date)
            return;
        const ctrl = new AbortController();
        let live = true, inFlight = false;
        async function update() { if(inFlight || document.hidden)return; inFlight=true; setLoading(true); setLoadError(''); try {
            const w = interval(date, time, duration);
            const res = await fetch(`/api/reservations?start=${w.start}&end=${w.end}`, { signal: ctrl.signal });
            const data = await res.json() as {
                error?: string;
                busy: {
                    table_id: string;
                    status: string;
                }[];
            };
            if (!res.ok)
                throw Error(data.error);
            if (live)
                setBusy(Object.fromEntries(data.busy.map((b: {
                    table_id: string;
                    status: string;
                }) => [b.table_id, b.status])));
        }
        catch (e) {
            if (live && !ctrl.signal.aborted)
                setLoadError(e instanceof Error ? e.message : tr("Չհաջողվեց բեռնել։"));
        }
        finally {
            inFlight=false;
            if (live)
                setLoading(false);
        } }
        update();
        const timer = setInterval(update, 30000);
        const visible=()=>{if(!document.hidden)void update()};
        document.addEventListener('visibilitychange',visible);
        return () => { live = false; ctrl.abort(); clearInterval(timer); document.removeEventListener('visibilitychange',visible); };
    }, [date, time, duration, refresh]);
    useEffect(() => { const d = dialog.current; if (selected || success) {
        if (d && !d.open)
            d.showModal();
    }
    else if (d?.open)
        d.close(); }, [selected, success]);
    const activeRoom = rooms.find(r => r.id === room)!;
    const visible = tables.filter(t => t.room === room);
    const eligible = visible.filter(t => t.capacity >= guests && !busy[t.id]).length;
    const past = !!date && interval(date, time, duration).start <= Date.now();
    function open(t: Table) { setSelected(t); setPhoto(0); setError(''); setSuccess(''); }
    function close() { if (sending)
        return; setSelected(null); setSuccess(''); setError(''); }
    async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!selected)
        return; setSending(true); setError(''); const fd = new FormData(e.currentTarget); try {
        const res = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: selected.id, ...interval(date, time, duration), guests, name: fd.get('name'), phone: fd.get('phone'), occasion: fd.get('occasion'), note: fd.get('note') }) });
        const data = await res.json() as {
            error?: string;
            id: string;
        };
        if (!res.ok)
            throw Error(data.error);
        setLastBooking({ date, time, guests, number: selected.number });
        setSuccess(data.id);
        setRefresh(x => x + 1);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : tr("Փորձեք կրկին։"));
        setRefresh(x => x + 1);
    }
    finally {
        setSending(false);
    } }
    return <>
 <header className="header"><a className="brand" href="/" aria-label={tr("Katsin գլխավոր էջ")}><img className="brand-logo" src="/katsin-logo.png" alt="" width="94" height="44"/> katsin<span className="brand-dot">.</span></a><nav><a href="#rooms">{tr("Սրահներ և սեղաններ")}</a><a href="#how">{tr("Ինչպես ամրագրել")}</a><a href="#menu">{tr("Մենյու")}</a><a href="#about">{tr("Իմանալ ավելին")}</a></nav><a className="header-phone" href={'tel:' + restaurantPhone}><Phone size={16}/><span>{phoneLabel}</span></a></header>
 <main>
 <section className="hero"><div className="hero-copy"><div className="eyebrow"><span />{tr(" ՁԵՐ ԵՐԵԿՈՆ ՍԿՍՎՈՒՄ Է ԱՅՍՏԵՂ")}</div><h1>{tr("Լավ երեկոյի")}<br />{tr("համար՝")}<br /><em>{tr("ձեր սեղանը։")}</em></h1><p>{tr("Նայեք սրահը, ընտրեք ձեր սիրելի անկյունը և տեսեք՝ ինչ տեսարան է բացվում հենց ձեր սեղանից։")}</p><a className="primary" href="#rooms">{tr("Ընտրել սեղան · 20 000 ֏ ")}<ArrowUpRight size={19}/></a><button className="any-hero" onClick={() => setAnyOpen(true)}>{tr("Ցանկացած սեղան · անվճար →")}</button><div className="hero-note"><span className="little-line"/>{tr(" Իրական նկարներ։ Հարմար ընտրություն։")}</div></div><div className="hero-image"><img fetchPriority="high" decoding="async" src={rooms[2].image} alt={tr("Katsin ռեստորանի Ծառի սրահը")}/><div className="image-shade"/><span className="hero-image-label"><MapPin size={14}/>{tr(" Ծառի սրահ")}</span><div className="hero-image-caption"><span>KATSIN RESTAURANT</span><p>{tr("Ձեր տեղը՝")}<br />{tr("մեր պատմության մեջ։")}</p></div><a href="#rooms" className="hero-round" aria-label={tr("Անցնել սեղաններին")}><ArrowRight /></a></div></section>
 <section id="rooms" className="selection"><div className="section-title"><div><div className="eyebrow">{tr("ԱՄՐԱԳՐՈՒՄ")}</div><h2>{tr("Գտեք ձեր տեղը")}</h2></div><p>{tr("Ընտրեք օրը, ժամը և հյուրերի քանակը։")}<br />{tr("Մենք կզանգահարենք՝ հայտը հաստատելու համար։")}</p></div>
 <div className="filterbar"><label><span><CalendarDays size={15}/>{tr(" Ամսաթիվ")}</span><input aria-label={tr("Ամսաթիվ")} type="date" min={yerevanToday()} value={date} onInput={e => setDate(e.currentTarget.value)} required/></label><label><span><Clock size={15}/>{tr(" Ժամը")}</span><input aria-label={tr("Ժամը")} type="time" step="1800" value={time} onInput={e => setTime(e.currentTarget.value)} required/></label><label><span><Users size={15}/>{tr(" Հյուրերի քանակ")}</span><select aria-label={tr("Հյուրերի քանակ")} value={guests} onChange={e => setGuests(+e.target.value)}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{guestCount(i + 1)}</option>)}</select></label><label><span><Clock size={15}/>{tr(" Տևողություն")}</span><select aria-label={tr("Տևողություն")} value={duration} onChange={e => setDuration(+e.target.value)}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{hourCount(n)}</option>)}</select></label><div className="filter-summary"><span>{tr("Ձեր երեկոն")}</span><strong>{guestCount(guests)} · {hourCount(duration)}</strong><small>{tr("Երևանի ժամանակով")}</small></div></div>
 {past && <div className="notice" role="alert">{tr("Ընտրեք ապագա ամսաթիվ և ժամ՝ հայտ ուղարկելու համար։")}</div>}
 <div className="any-banner"><div><h3>{tr("Սեղանի ընտրությունը վստահեք մեզ")}</h3><p>{tr("Անվճար ամրագրում․ սեղանը տեղում տրամադրում է մեր աշխատակիցը՝ ըստ հասանելիության։ Կոնկրետ սեղանի ընտրությունը՝ 20 000 ֏։")}</p></div><button className="any-hero" onClick={() => setAnyOpen(true)}>{tr("Ցանկացած սեղան · անվճար ")}<ArrowRight size={18}/></button></div>
 <div className="floor-selector" role="group" aria-label={tr("Ընտրել սրահների բաժինը")}><button className={floor === 'main' ? 'active' : ''} aria-pressed={floor === 'main'} onClick={() => { setFloor('main'); setRoom('coupe1'); }}><span>{tr("Գլխավոր սրահներ")}</span><small>{tr("Կուպեներ · Ծառի սրահ · Արձանի սրահ")}</small></button><button className={floor === 'second' ? 'active' : ''} aria-pressed={floor === 'second'} onClick={() => { setFloor('second'); setRoom('floor30'); }}><span>{tr("2-րդ հարկ")}</span><small>{tr("30-ի · 40-ի · 50-ի սրահներ")}</small></button></div><h3 className="floor-heading">{floor === 'second' ? tr("2-րդ հարկի սրահներ") : tr("Գլխավոր սրահներ")}</h3>
 <div className="room-tabs" role="tablist" aria-label={tr("Սրահներ")}>{rooms.filter(r => floor === 'second' ? r.id.startsWith('floor') : !r.id.startsWith('floor')).map((r, i) => <button role="tab" aria-selected={room === r.id} key={r.id} onClick={() => setRoom(r.id)} className={room === r.id ? 'active' : ''}><span className="tab-index">0{i + 1}</span><span>{r.name}<small>{r.subtitle}</small></span><span className="tab-count">{tables.filter(t => t.room === r.id).length}</span></button>)}</div>
 <div className="room-intro"><div><h3>{activeRoom.name} <span>· {activeRoom.subtitle}</span></h3><p>{visible.length === 0 ? tr("Սրահի ընդհանուր տեսքը") : loading ? tr("Ստուգում ենք ազատ սեղանները…") : loadError ? tr("Ազատությունը ստուգված չէ") : tr("{0} հարմար ազատ սեղան՝ ձեր ընտրության համար", eligible)}</p></div><div className="view-toggle" hidden={visible.length === 0}><button className={mode === 'cards' ? 'active' : ''} onClick={() => setMode('cards')}><LayoutGrid size={16}/>{tr(" Նկարներ")}</button><button className={mode === 'map' ? 'active' : ''} onClick={() => setMode('map')}><Map size={16}/>{tr(" Քարտեզ")}</button></div></div>
 {loadError && <div className="notice" role="alert">{tr(loadError)} <button onClick={() => setRefresh(x => x + 1)}>{tr("Կրկին փորձել")}</button></div>}
 <section className="room-overview"><h4>{activeRoom.name}{tr(" · սրահի ընդհանուր տեսքը")}</h4><p>{tr("Նկարը շարժեք աջ ու ձախ՝ սրահը դիտելու համար։")}</p><div className="panorama-scroll" key={room} tabIndex={0} role="region" aria-label={activeRoom.name + tr(" պանորամա")}><img className={room.startsWith('floor') ? 'floor-photo' : ''} src={activeRoom.image} alt={activeRoom.name + tr(" ընդհանուր տեսքը")} draggable="false" loading="lazy" decoding="async"/></div>{visible.length === 0 && <p className="table-note">{tr("Կոնկրետ սեղանի ընտրության համար զանգահարեք մեզ՝ ")}<a href={'tel:' + restaurantPhone}>{phoneLabel}</a>{tr("։")}</p>}</section>
 {visible.length > 0 && <><div className="legend"><span><i className="free-dot"/>{tr("Ազատ")}</span><span><i className="pending-dot"/>{tr("Հաստատման փուլում")}</span><span><i className="busy-dot"/>{tr("Ամրագրված")}</span></div>
 {mode === 'cards' ? <div className="table-grid">{visible.map(t => { const status = busy[t.id]; const fits = t.capacity >= guests; return <article className={'table-card ' + (status ? 'reserved ' : '') + (!fits ? 'not-fitting' : '')} key={t.id}><button className="table-photo" onClick={() => open(t)} aria-label={tr("Տեսնել ") + t.capacity + tr(" անձի սեղանը")}><img src={photoPreview(t.photos[1] || t.photos[0])} alt={t.capacity + tr(" անձի սեղան")} loading="lazy" decoding="async"/><span className={'availability ' + (status || 'free')}>{loading ? tr("Ստուգվում է") : loadError ? tr("Չի ստուգվել") : status === 'confirmed' ? tr("Ամրագրված") : status === 'pending' ? tr("Ամրագրված · սպասում է հաստատման") : tr("Ազատ է")}</span><span className="photo-count">{t.photos.length}{tr(" նկար ")}<ArrowUpRight size={13}/></span></button><div className="table-info"><div className="table-top"><h4>{tr("Սեղան №")}{t.number}</h4><span><Users size={15}/>{guestCount(t.number === '12–13' ? '8–10' : t.capacity)}</span></div><p>{t.shape === 'round' ? tr("Կլոր սեղան") : tr("Ուղղանկյուն սեղան")} · {activeRoom.name}</p><p className="table-price">{tr("Կոնկրետ սեղանի ընտրություն · ")}<strong>{tr("20 000 ֏")}</strong></p>{!fits && <small className="fit-warning">{tr("Ձեր խմբի համար տեղերը բավարար չեն")}</small>}<button className="card-action" onClick={() => open(t)}>{tr("Դիտել սեղանն ու տեսարանը ")}<ArrowRight size={17}/></button></div></article>; })}</div> : <div className="floorplan"><div className="plan-head"><div><h4>{activeRoom.name}</h4><p>{tr("Պայմանական հատակագիծ․ սեղանների դիրքերը ճշտման ենթակա են։")}</p></div><button onClick={() => { setSelected(visible[0]); setPhoto(0); }}>{tr("Տեսնել սրահի նկարը ")}<ArrowUpRight size={15}/></button></div><div className="plan-layout"><span className="plan-wall">{tr("ՍՐԱՀ")}</span><div className="plan-tables">{visible.map(t => <button key={t.id} onClick={() => open(t)} className={'plan-table ' + t.shape + ' ' + (busy[t.id] || 'free') + (t.capacity < guests ? ' muted' : '')}><span>№{t.number}</span><small>{tr("20 000 ֏")}</small><small>{busy[t.id] ? tr("Ամրագրված") : tr("Ազատ է")}</small><small>{guestCount(t.capacity)}</small></button>)}</div><div className="plan-entry">{tr("Մուտք դեպի սրահ")}</div></div><p className="plan-help">{tr("Սեղմեք սեղանին՝ նկարները և մանրամասները դիտելու համար։")}</p></div>}
 {guests > 6 && <div className="group-help"><Users size={22}/><div><strong>{tr("Մեծ ընկերությա՞մբ եք գալիս")}</strong><p>{tr("Սեղանների միավորման և հատուկ դասավորության համար զանգահարեք մեզ։")}</p></div><a href={'tel:' + restaurantPhone}>{tr("Զանգահարել ")}<Phone size={16}/></a></div>}
 </>}
 </section>
 <section id="how" className="how"><div className="eyebrow">{tr("ՊԱՐԶ Է ԵՎ ՀԱՐՄԱՐ")}</div><h2>{tr("Ձեր սեղանը՝ երեք քայլով")}</h2><div className="steps">{[['01', tr("Ընտրեք ձեր տեղը"), tr("Նշեք օրը, ժամը և հյուրերի քանակը։ Նայեք սեղանն ու տեսարանը։")], ['02', tr("Ուղարկեք հայտը"), tr("Լրացրեք անունը, ազգանունը և հեռախոսահամարը։")], ['03', tr("Սպասեք մեր զանգին"), tr("Աշխատակիցը կկապվի ձեզ հետ։ Ամրագրումը ուժի մեջ է զանգով հաստատելուց հետո։")]].map(s => <div key={s[0]}><span>{s[0]}</span><h3>{s[1]}</h3><p>{s[2]}</p></div>)}</div></section>
 <section id="menu" className="menu-section"><div><div className="eyebrow">KATSIN · {tr('Մենյու')}</div><h2>{tr("Ծանոթացեք մենյուին")}</h2><p>{tr("Դիտեք մեր մենյուն Katsin-ի պաշտոնական Instagram-ի Menu բաժնում։")}</p></div><a className="primary" href="https://www.instagram.com/stories/highlights/17962033184423489/" target="_blank" rel="noopener noreferrer">{tr("Մենյու · Instagram ")}<ArrowUpRight size={18}/></a></section>
 <Discover/>
 <section className="contact"><div><div className="eyebrow">{tr("ՄԻՇՏ ԿԱՊԻ ՄԵՋ")}</div><h2>{tr("Ուրիշ հարցե՞ր ունեք")}</h2><p>{tr("Մենյուի, նախնական պատվերի կամ հատուկ ցանկությունների համար զանգահարեք մեզ։")}</p></div><a href={'tel:' + restaurantPhone}><Phone size={22}/>{phoneLabel}<ArrowUpRight size={23}/></a></section>
 </main><footer><a className="brand footer-brand" href="/" aria-label="Katsin"><img src="/katsin-logo.png" alt="Katsin" width="94" height="44"/></a><p>{tr("Ձեր երեկոն սկսվում է ճիշտ տեղից։")}</p></footer>
 <dialog ref={introDialog} className="intro-dialog" aria-labelledby="intro-title" onCancel={e => e.preventDefault()}><LanguageSwitcher/><div className="eyebrow">{tr("ԲԱՐԻ ԳԱԼՈՒՍՏ KATSIN")}</div><h2 id="intro-title">{tr("Նախ ծանոթացեք")}<br />{tr("ամրագրման պայմաններին")}</h2><div className="intro-tabs" role="tablist" aria-label={tr("Ամրագրման տեղեկություններ")}>{[[1, tr("Ամրագրման պայմաններ")], [2, tr("Հնարավոր փոփոխություններ")]].map(([n, label]) => <button key={n} type="button" role="tab" id={'intro-tab-' + n} aria-selected={introTab === n} aria-controls={'intro-panel-' + n} className={introTab === n ? 'active' : ''} onClick={() => setIntroTab(Number(n))}><span>0{n}</span>{label}</button>)}</div><section role="tabpanel" id="intro-panel-1" aria-labelledby="intro-tab-1" hidden={introTab !== 1}><h3 className="intro-section-title">{tr("Ամրագրման պայմաններ")}</h3><div className="intro-option"><strong>{tr("Ցանկացած սեղան ")}<span>{tr("Անվճար")}</span></strong><p>{tr("Դուք նշում եք օրը, ժամը և հյուրերի քանակը։ Մեր աշխատակիցը ձեզ տեղավորում է հասանելի սեղաններից մեկի մոտ։")}</p></div><div className="intro-option paid"><strong>{tr("Կոնկրետ սեղան ")}<span>{tr("20 000 ֏")}</span></strong><p>{tr("Եթե ցանկանում եք հենց ձեր ընտրած սեղանը, դրա ամրագրման վճարը 20 000 դրամ է։ Այս պայմանը գործում է բոլոր սեղանների համար։")}</p></div></section><section className="intro-changes" role="tabpanel" id="intro-panel-2" aria-labelledby="intro-tab-2" hidden={introTab !== 2}><h3 id="changes-title" className="intro-section-title">{tr("Ուշադրություն․ հնարավոր փոփոխություններ")}</h3><p>{tr("Հարգելի՛ հյուր, որոշ հանգամանքներում կարող է անհրաժեշտ լինել փոփոխել ձեր ամրագրման մանրամասները, այդ թվում՝ ընտրված սեղանը։ Նման դեպքում մենք նախապես կկապվենք ձեզ հետ՝ զանգով կամ հաղորդագրությամբ, կտեղեկացնենք փոփոխության մասին և ձեզ հետ կհամաձայնեցնենք առաջարկվող տարբերակը։")}</p><p className="intro-contact-note">{tr("Խնդրում ենք նշել գործող հեռախոսահամար, որպեսզի կարողանանք ժամանակին կապվել ձեզ հետ։")}</p></section><button className="primary submit" onClick={() => setIntroOpen(false)}>{tr("Ծանոթացա, դիտել սեղանները ")}<ArrowRight size={18}/></button><button className="intro-free" onClick={() => { setIntroOpen(false); setAnyOpen(true); }}>{tr("Ամրագրել ցանկացած սեղան · անվճար")}</button></dialog>
 <dialog ref={anyDialog} className="any-dialog" onCancel={() => setAnyOpen(false)}><button className="close-dialog" onClick={() => setAnyOpen(false)} aria-label={tr("Փակել")}><X /></button>{anyOpen && <RequestForm initialDate={date} initialTime={time} initialGuests={guests} initialDuration={duration} onDone={() => { setAnyOpen(false); setRefresh(x => x + 1); }}/>}</dialog>
 <dialog ref={dialog} className="booking-dialog" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === dialog.current)
        close(); }}><button className="close-dialog" onClick={close} aria-label={tr("Փակել")} disabled={sending}><X size={22}/></button>{success ? <div className="success-panel"><div className="success-icon"><Check size={35}/></div><div className="eyebrow">{tr("ՀԱՅՏԸ ՍՏԱՑՎԱԾ Է")}</div><h2>{tr("Շնորհակալություն։")}<br />{tr("Մենք կզանգահարենք ձեզ։")}</h2><p>{tr("Ձեր հայտը սպասում է զանգով հաստատման։ Կոնկրետ սեղանի ընտրության վճարը՝ 20 000 ֏։ Վճարման պայմաններն ու վերջնական հաստատումը կճշտվեն զանգով։")}</p><div className="booking-recap"><strong>{tr("Սեղան №")}{lastBooking?.number}{tr(" · 20 000 ֏")}</strong><span>{lastBooking?.date} · {lastBooking?.time}</span><span>{lastBooking?.guests}{tr(" անձ")}</span></div><small>{tr("Հայտի համարը՝ ")}{success.slice(0, 8).toUpperCase()}</small><button className="primary" onClick={close}>{tr("Վերադառնալ սեղաններին ")}<ArrowRight size={18}/></button></div> : selected && <div className="dialog-content"><div className="gallery"><div className="gallery-main"><img src={selected.photos[photo]} alt={tr(labels[photo])}/><button className="gallery-prev" onClick={() => setPhoto((photo + selected.photos.length - 1) % selected.photos.length)} aria-label={tr("Նախորդ նկար")}><ChevronLeft /></button><button className="gallery-next" onClick={() => setPhoto((photo + 1) % selected.photos.length)} aria-label={tr("Հաջորդ նկար")}><ChevronRight /></button><span>{tr(labels[photo])} · {photo + 1}/{selected.photos.length}</span></div><div className="thumbnails">{selected.photos.map((src, i) => <button key={src + i} className={photo === i ? 'active' : ''} onClick={() => setPhoto(i)}><img src={photoPreview(src)} alt={tr(labels[i])} decoding="async"/><span>{i === 0 ? tr("Սրահը") : i === 1 ? tr("Սեղանը") : tr("Տեսարանը")}</span></button>)}</div></div><div className="booking-details"><div className="eyebrow">{rooms.find(r => r.id === selected.room)?.name}</div><h2>{tr("Սեղան №")}{selected.number}</h2><div className="selection-price"><strong>{tr("Կոնկրետ սեղանի ընտրություն՝ 20 000 ֏")}</strong><p>{tr("Վճարովի ընտրությունը վերաբերում է հենց այս սեղանին։ Վճարման պայմանները կճշտենք զանգով։")}</p></div><div className="details-meta"><span><Users size={16}/>{tr("Մինչև ")}{guestCount(selected.capacity)}</span><span>{selected.shape === 'round' ? tr("Կլոր") : tr("Ուղղանկյուն")}</span></div>{selected.number === '12–13' && <p className="table-note">{tr("Մեկ ընդհանուր սեղան՝ 8–10 անձի համար։ Նստատեղերը պատրաստվում են ըստ ամրագրման։")}</p>}<div className="booking-recap"><span>{date} · {time}</span><span>{guestCount(guests)} · {hourCount(duration)}</span></div>{busy[selected.id] || selected.capacity < guests || past || loading || loadError ? <div className="unavailable"><h3>{selected.capacity < guests ? tr("Տեղերը բավարար չեն") : busy[selected.id] ? tr("Այս ժամին սեղանը հասանելի չէ") : past ? tr("Ընտրեք ապագա ժամ") : tr("Ազատությունը դեռ ստուգված չէ")}</h3><p>{tr("Փակեք պատուհանը և փոխեք ժամը կամ ընտրեք այլ սեղան։ Հատուկ հարցերով կարող եք զանգահարել։")}</p><a href={'tel:' + restaurantPhone}><Phone size={16}/> {phoneLabel}</a></div> : <form onSubmit={submit}><div className="form-title">{tr("Ամրագրման հայտ")}</div><label>{tr("Անուն, ազգանուն")}<input name="name" autoComplete="name" required minLength={3} maxLength={100} placeholder={tr("Օրինակ՝ Անի Սարգսյան")}/></label><label>{tr("Հեռախոսահամար")}<input name="phone" type="tel" autoComplete="tel" required pattern="[+0-9 ()\-]{8,24}" maxLength={24} placeholder="+374 __ ______"/></label><label>{tr("Առիթը (ոչ պարտադիր)")}<select name="occasion"><option value="">{tr("Նշված չէ")}</option><option>{tr("Ծննդյան օր")}</option><option>{tr("Տարեդարձ")}</option><option>{tr("Ընտանեկան հանդիպում")}</option><option>{tr("Այլ առիթ")}</option></select></label><label>{tr("Հավելյալ ցանկություններ ")}<span>{tr("(ոչ պարտադիր)")}</span><textarea name="note" maxLength={1000} placeholder={tr("Հատուկ առիթ, երեխայի աթոռակ կամ այլ ցանկություն")} rows={2}/></label><label className="consent"><input type="checkbox" required/>{tr("Համաձայն եմ կոնկրետ սեղանի ընտրության 20 000 ֏ վճարին և հայտը զանգով հաստատելուն։")}</label>{error && <div className="notice" role="alert">{tr(error)}</div>}<button className="primary submit" type="submit" disabled={sending}>{sending ? <><LoaderCircle className="spin" size={17}/>{tr("Ուղարկվում է…")}</> : <>{tr("Ուղարկել հայտը ")}<ArrowUpRight size={18}/></>}</button><p className="form-note"><Clock size={13}/>{tr(" Ամրագրումը հաստատվում է մեր զանգից հետո։")}</p></form>}</div></div>}</dialog>
 </>;
}
