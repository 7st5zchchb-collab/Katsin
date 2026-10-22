export type BillItem={name:string,quantity:number,unitPrice:number};
export function validateItems(value:unknown):{items:BillItem[],total:number}|null{
 if(!Array.isArray(value)||value.length>100)return null;
 const items:BillItem[]=[];let total=0;
 for(const raw of value){
  if(!raw||typeof raw!=='object'||typeof raw.name!=='string'||raw.name.trim().length<1||raw.name.trim().length>120||!Number.isSafeInteger(raw.quantity)||raw.quantity<1||raw.quantity>1000||!Number.isSafeInteger(raw.unitPrice)||raw.unitPrice<0||raw.unitPrice>100_000_000)return null;
  items.push({name:raw.name.trim(),quantity:raw.quantity,unitPrice:raw.unitPrice});total+=raw.quantity*raw.unitPrice;
 }
 return Number.isSafeInteger(total)&&total<=1_000_000_000_000?{items,total}:null;
}
