'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {Language,supportedLanguages,translate,localeFor,translateSystemNote} from '../../lib/i18n';
const LanguageContext=createContext<{language:Language,setLanguage:(l:Language)=>void}>({language:'hy',setLanguage:()=>{}});
export function LanguageProvider({initialLanguage,children}:{initialLanguage:Language,children:React.ReactNode}){
 const [language,setValue]=useState(initialLanguage);
 function setLanguage(lang:Language){setValue(lang);document.documentElement.lang=lang;try{localStorage.setItem('katsin-language',lang)}catch{}document.cookie=`katsin_language=${lang}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;const url=new URL(window.location.href);url.searchParams.set('lang',lang);window.history.replaceState(null,'',url);}
 useEffect(()=>{const fromLink=new URL(window.location.href).searchParams.get('lang');let saved:string|null=null;try{saved=localStorage.getItem('katsin-language')}catch{}const candidate=fromLink||saved||initialLanguage;if(supportedLanguages.includes(candidate as Language))setLanguage(candidate as Language)},[]);
 useEffect(()=>{document.documentElement.lang=language;document.title='Katsin · '+translate(language,'Ընտրեք ձեր սեղանը');document.querySelector('meta[name="description"]')?.setAttribute('content',translate(language,'Ծանոթացեք սրահներին, տեսեք սեղանն ու տեսարանը և ուղարկեք ամրագրման հայտ։'))},[language]);
 return <LanguageContext.Provider value={{language,setLanguage}}>{children}<LanguageSwitcher floating/></LanguageContext.Provider>;
}
export function useLanguage(){const {language,setLanguage}=useContext(LanguageContext);return {language,setLanguage,guestCount:(n:number|string)=>String(n)+' '+(language==='ru'?'чел.':language==='en'?(Number(n)===1?'guest':'guests'):'անձ'),hourCount:(n:number)=>String(n)+' '+(language==='ru'?'ч.':language==='en'?(n===1?'hour':'hours'):'ժամ'),locale:localeFor(language),t:(text:string,...values:(string|number|undefined)[])=>translate(language,text,...values),systemNote:(note:string)=>translateSystemNote(language,note)}}
export function LanguageSwitcher({floating=false}:{floating?:boolean}){const {language,setLanguage}=useContext(LanguageContext);return <div className={floating?'language-switcher floating':'language-switcher'}><select aria-label={{hy:'Լեզու',en:'Language',ru:'Язык'}[language]} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="hy">Հայերեն</option><option value="en">English</option><option value="ru">Русский</option></select></div>}
