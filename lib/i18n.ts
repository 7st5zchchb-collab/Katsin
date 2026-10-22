import messages from './translations.json';
export type Language='hy'|'en'|'ru';
export const supportedLanguages:Language[]=['hy','en','ru'];
export const localeFor=(lang:Language)=>({hy:'hy-AM',en:'en-GB',ru:'ru-RU'}[lang]);
export function translate(lang:Language,text:string,...values:(string|number|undefined)[]){
 const trimmed=text.trim();const dictionary=messages as Record<string,{en:string,ru:string}>;
 const source=dictionary[trimmed]?trimmed:Object.keys(dictionary).find(k=>dictionary[k].en===trimmed||dictionary[k].ru===trimmed)??trimmed;
 const result=lang==='hy'?source:dictionary[source]?.[lang]??trimmed;
 const leading=text.match(/^\s*/)?.[0]||'',trailing=text.match(/\s*$/)?.[0]||'';
 return leading+result.replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??''))+trailing;
}
export function translateSystemNote(lang:Language,note:string){
 return note.split('\n').map((line,index)=>{
  if(index===0&&line.startsWith('Ընտրություն՝')){
   const table=line.match(/^Ընտրություն՝ կոնկրետ սեղան №(.+) · 20 000 ֏։ Վճարման պայմանները՝ զանգով։$/);
   if(table)return translate(lang,'Ընտրություն՝ կոնկրետ սեղան №{0} · 20 000 ֏։ Վճարման պայմանները՝ զանգով։',table[1]);
   return translate(lang,line);
  }
  if(index<=1&&line.startsWith('Առիթ՝ '))return translate(lang,'Առիթ՝')+' '+translate(lang,line.slice(6));
  return line;
 }).join('\n');
}
