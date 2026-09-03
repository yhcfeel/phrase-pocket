import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../dist/client/',import.meta.url);
const sw=await readFile(new URL('sw.js',root),'utf8');
const offline=(await readFile(new URL('../app/offline.js',import.meta.url),'utf8')).replace('export async','async');
function emitter(extra={}){const listeners={};return{...extra,addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},emit:(name)=>{for(const fn of listeners[name]||[])fn()}};}
async function ui({controlled=true,waiting=true,dialogOpen=false}={}){
 const status={},button=emitter({hidden:true}),dialog=emitter({open:dialogOpen}),messages=[];let reloads=0,updates=0;
 const worker=emitter({state:'activated',postMessage:msg=>messages.push(msg)});
 const registration=emitter({waiting:waiting?worker:null,active:worker,update:async()=>{updates++}});
 const serviceWorker=emitter({controller:controlled?worker:null,register:async(url,options)=>{assert.equal(url,'./sw.js');assert.equal(options.scope,'./');assert.equal(options.updateViaCache,'none');return registration;}});
 const document=emitter({visibilityState:'visible',getElementById:id=>({'offline-status':status,'apply-update':button,'add-dialog':dialog})[id]});
 const window=emitter({isSecureContext:true});
 class Channel{constructor(){this.port1={close(){}};this.port2={};}}
 const context=vm.createContext({navigator:{serviceWorker,onLine:true},document,window,location:{reload:()=>reloads++},MessageChannel:Channel,setTimeout:()=>1,clearTimeout,Date});
 await vm.runInContext(offline+';prepareOffline()',context);
 return{status,button,dialog,worker,registration,serviceWorker,document,window,messages,get reloads(){return reloads},get updates(){return updates}};
}
test('a downloaded update waits for a tap; takeover reloads exactly once',async()=>{
 const a=await ui();assert.equal(a.button.hidden,false);assert.equal(a.reloads,0);
 a.button.emit('click');assert.ok(a.messages.some(x=>x.type==='ACTIVATE_UPDATE'));
 a.serviceWorker.emit('controllerchange');a.serviceWorker.emit('controllerchange');assert.equal(a.reloads,1);
});
test('first installation does not unexpectedly reload the page',async()=>{const a=await ui({controlled:false,waiting:false});a.serviceWorker.emit('controllerchange');assert.equal(a.reloads,0)});
test('an unfinished Add form survives another tab applying an update',async()=>{const a=await ui({dialogOpen:true});a.serviceWorker.emit('controllerchange');assert.equal(a.reloads,0);a.dialog.open=false;a.dialog.emit('close');assert.equal(a.reloads,1)});
test('returning online retries the update check',async()=>{const a=await ui();await new Promise(r=>setImmediate(r));const count=a.updates;a.window.emit('online');await new Promise(r=>setImmediate(r));assert.equal(a.updates,count+1)});
test('every precached asset has matching integrity, including offline controller',async()=>{
 const context=vm.createContext({self:{registration:{scope:'https://example.test/my-phrases/'},addEventListener(){}},URL});
 vm.runInContext(sw,context);const files=vm.runInContext('FILES',context),integrity=vm.runInContext('INTEGRITY',context);
 assert.ok(files.includes('offline.js'));
 for(const file of files)assert.equal(integrity[file],'sha256-'+createHash('sha256').update(await readFile(new URL(file,root))).digest('base64'));
});
test('manifest and all page assets stay inside an arbitrary GitHub project path',async()=>{
 const base='https://someone.github.io/some-project/';const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
 const html=await readFile(new URL('index.html',root),'utf8');
 for(const ref of [manifest.start_url,manifest.scope,manifest.id,...manifest.icons.map(x=>x.src),...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>x[1])])assert.ok(new URL(ref,base).href.startsWith(base));
});
test('activation request is refused for an incomplete update',async()=>{
 const handlers={};let skipped=0,complete=false,task;
 const self={registration:{scope:'https://test.invalid/pocket/'},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>{skipped++}};
 vm.runInNewContext(sw,{self,URL,caches:{open:async()=>({match:async()=>complete?new Response('cached'):undefined})},Response});
 const activate=async()=>{handlers.message({data:{type:'ACTIVATE_UPDATE'},waitUntil:p=>task=p});await task;};
 await activate();assert.equal(skipped,0);complete=true;await activate();assert.equal(skipped,1);
});
