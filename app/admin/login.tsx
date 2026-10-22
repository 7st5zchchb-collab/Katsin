'use client';
import {useLanguage,LanguageSwitcher} from '../components/language';
import { useState } from 'react';
export default function StaffLogin() {
 const {t:tr,locale,systemNote}=useLanguage();
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [show, setShow] = useState(false);
    async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget); try {
        const r = await fetch('/api/staff/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: f.get('password') }) });
        const d = await r.json() as {
            error?: string;
        };
        if (!r.ok)
            throw Error(d.error);
        window.location.assign('/admin');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : tr("Փորձեք կրկին։"));
        setBusy(false);
    } }
    return <form onSubmit={submit}><label className="staff-password-label">{tr("Անհատական մուտքի կոդ")}<input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} placeholder={tr("Մուտքագրեք ձեր կոդը")}/></label><label className="staff-show"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)}/>{tr("Ցույց տալ կոդը")}</label>{error && <div className="notice" role="alert">{tr(error)}</div>}<button className="primary" disabled={busy}>{busy ? tr("Մուտք է կատարվում…") : tr("Մուտք գործել →")}</button></form>;
}
