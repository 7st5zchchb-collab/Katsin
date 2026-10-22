import type { Metadata } from "next";
import "./globals.css";
import {cookies} from "next/headers";
import {Language,supportedLanguages,translate} from "../lib/i18n";
import {LanguageProvider} from "./components/language";
export async function generateMetadata():Promise<Metadata>{const saved=(await cookies()).get('katsin_language')?.value as Language;const language=supportedLanguages.includes(saved)?saved:'hy';return {icons:{icon:[{url:'/katsin-logo.png',type:'image/png'}],apple:'/katsin-logo.png'},title:'Katsin · '+translate(language,'Ընտրեք ձեր սեղանը'),description:translate(language,'Ծանոթացեք սրահներին, տեսեք սեղանն ու տեսարանը և ուղարկեք ամրագրման հայտ։')}};
export default async function RootLayout({children}:Readonly<{children:React.ReactNode}>){const saved=(await cookies()).get('katsin_language')?.value as Language;const language=supportedLanguages.includes(saved)?saved:'hy';return <html lang={language}><body><LanguageProvider initialLanguage={language}>{children}</LanguageProvider></body></html>}
