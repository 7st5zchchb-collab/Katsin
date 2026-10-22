import previews from './photo-previews.json';
export function photoPreview(src:string){return (previews as Record<string,string>)[src]||src}
