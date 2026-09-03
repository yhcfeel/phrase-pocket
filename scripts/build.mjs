import {mkdir,readFile,writeFile,readdir,copyFile,rm} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve('app'),out=resolve('dist/client');
// Only remove this project's generated public directory.
if(out!==join(process.cwd(),'dist','client'))throw new Error('Unexpected output directory');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const files=[];
async function copy(dir){for(const item of await readdir(dir,{withFileTypes:true})){
 const file=join(dir,item.name),rel=relative(source,file).replaceAll('\\','/');
 if(item.isDirectory()){await copy(file);continue;}
 if(!/\.(html|css|js|json|png|svg|webmanifest)$/.test(item.name))continue;
 await mkdir(join(out,rel,'..'),{recursive:true});await copyFile(file,join(out,rel));files.push(rel);
}}
await copy(source);
const siteBase=process.env.SITE_URL||process.argv[2];
let preview='<meta property="og:image" content="./og.png"><meta name="twitter:image" content="./og.png">';
if(siteBase){
 const url=new URL(siteBase.replace(/\/?$/, '/'));if(url.protocol!=='https:')throw new Error('Site URL must use HTTPS');
 const imageURL=new URL('og.png',url).href.replaceAll('&','&amp;').replaceAll('"','&quot;');
 preview='<meta property="og:image" content="'+imageURL+'"><meta name="twitter:image" content="'+imageURL+'">';
}
const html=await readFile(join(out,'index.html'),'utf8');
await writeFile(join(out,'index.html'),html.replace('<!-- SOCIAL_PREVIEW -->',preview));
const seed=JSON.parse(await readFile(join(out,'phrases.json'),'utf8'));
if(seed.length<115||new Set(seed.map(x=>x.id)).size!==seed.length||seed.some(x=>!/^p\d+$/.test(x.id)||!x.english||!x.chinese))throw new Error('Seed validation failed');
for(const file of ['index.html','app.js','offline.js','review.js','styles.css','phrases.json','manifest.webmanifest','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png'])if(!files.includes(file))throw new Error('Missing: '+file);
const template=await readFile('scripts/sw-template.js','utf8');
const hash=createHash('sha256').update(template),integrity={};
for(const file of files.sort()){
 const data=await readFile(join(out,file));hash.update(file).update(data);
 integrity[file]='sha256-'+createHash('sha256').update(data).digest('base64');
}
const version=hash.digest('hex').slice(0,16),offlineFiles=files.filter(file=>file!=='og.png');
const sw=template.replace('__VERSION__',JSON.stringify(version)).replace('__FILES__',JSON.stringify(offlineFiles)).replace('__INTEGRITY__',JSON.stringify(integrity));
await writeFile(join(out,'sw.js'),sw);
await writeFile(join(out,'.nojekyll'),'');
console.log('Built '+files.length+' local assets, '+seed.length+' phrases; offline version '+version);
