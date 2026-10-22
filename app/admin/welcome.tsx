'use client';
import {useLanguage,LanguageSwitcher} from '../components/language';
import StaffLogin from './login';
export default function StaffWelcome() {
 const {t:tr,locale,systemNote}=useLanguage();
    return <><header className="header"><a className="brand" href="/">◢ katsin.</a><a href="/">{tr("Հյուրերի էջ →")}</a></header><main className="staff-entry"><section className="staff-welcome"><div className="eyebrow">{tr("KATSIN · ԱՇԽԱՏԱԿՑԻ ԲԱԺԻՆ")}</div><h1>{tr("Աշխատանքային")}<br /><em>{tr("աշխատասենյակ")}</em></h1><p>{tr("Մուտք գործեք ձեր կոդով՝ ձեր դերին համապատասխան բաժինները բացելու համար։")}</p><div className="staff-features"><span>{tr("01 · Ամրագրումներ և հաշիվներ")}</span><span>{tr("02 · Անհատական պրոֆիլներ")}</span><span>{tr("03 · Աշխատանքային որոնելի պատմություն")}</span></div></section><section className="staff-login"><div className="eyebrow">{tr("ԱՇԽԱՏԱԿՑԻ ՄՈՒՏՔ")}</div><h2>{tr("Բարի վերադարձ")}</h2><p>{tr("Բաժինը բացելու համար մուտքագրեք ձեր անհատական կոդը։")}</p><StaffLogin /><small>{tr("Մուտքը պահպանվում է 8 ժամ։ Հյուրերը կայքից օգտվում են առանց գրանցման։")}</small><a className="staff-back" href="/">{tr("← Վերադառնալ հյուրերի էջ")}</a></section></main></>;
}
