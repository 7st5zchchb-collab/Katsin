export const staffRoles=['director','manager','host','cashier','waiter','assistant'] as const;
export type StaffRole=typeof staffRoles[number];
export type StaffMember={id:string,name:string,active:boolean,codeHash:string,createdAt:number,role?:StaffRole,firstName?:string,lastName?:string,jobTitle?:string,scheduleGroups?:('assistant'|'waiter')[],revokedBefore?:number};
export type StaffIdentity={id:string,name:string,role:StaffRole,manager:boolean,scheduleGroups?:('assistant'|'waiter')[]};
export const isManager=(role:StaffRole)=>role==='director'||role==='manager';
export const canBook=(role:StaffRole)=>isManager(role)||role==='host';
export const validRole=(role:unknown):role is StaffRole=>typeof role==='string'&&staffRoles.includes(role as StaffRole);
export const roleLabels={director:'Տնօրեն',manager:'Մենեջեր',host:'Հյուրընկալ',cashier:'Գանձապահ',waiter:'Մատուցող',assistant:'Օգնական'};

export const canCash=(role:StaffRole)=>isManager(role)||role==='cashier';
