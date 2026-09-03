import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as review from '../app/review.js';

// Runs the real controller against an event/element adapter, not a browser.
// These checks validate saved data and transitions, not Safari visual layout.
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../app/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
const presentation=(await readFile(new URL('../app/presentation.js',import.meta.url),'utf8')).replaceAll('export ','');
const seed=[{id:'p001',english:'apply sth. to sth.',chinese:'把……应用于……',example:{english:'Try to apply this rule to your writing.',chinese:'试着把这条规则应用到你的写作中。',highlights:['apply','to']}},{id:'p002',english:'in keeping with',chinese:'与……一致',example:{english:'The sign is in keeping with the café.',chinese:'招牌与咖啡馆风格一致。',highlights:['in keeping with']}}];
class Element{
 constructor(tag='span'){this.tagName=tag;this.dataset={};this.attributes={};this.listeners={};this.children=[];this.hidden=false;this.disabled=false;this.value='';}
 set textContent(text){this.text=String(text);this.children=[];}
 get textContent(){return this.children.length?this.children.map(x=>x.textContent).join(''):this.text||'';}
 replaceChildren(){this.children=[];this.text='';}
 append(child){this.children.push(child);}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(name,handler){this.listeners[name]=handler;}
 click(){if(!this.disabled)this.listeners.click?.({target:this});}
 focus(){}
}
async function app(){
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const data=new Map();let fail=false;const timers=[];
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(fail)throw new Error('quota');data.set(key,value)}};
 const document={getElementById:id=>nodes.get(id)??null,createTextNode:text=>({textContent:text}),createElement:tag=>new Element(tag)};
 const context=vm.createContext({...review,prepareOffline(){},document,window:{localStorage:storage,addEventListener(){}},navigator:{},fetch:async()=>({ok:true,json:async()=>seed}),setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){}});
 vm.runInContext(presentation,context);vm.runInContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 const snapshot=()=>vm.runInContext('({id:current.id,english:current.english,revealed,advancing})',context);
 return{nodes,storage,context,snapshot,failStorage:()=>{fail=true},flush:()=>{timers.splice(0).forEach(fn=>fn())}};
}
test('either rating saves the old card and immediately shows the next with its meaning hidden',async()=>{
 const a=await app();assert.equal(a.nodes.has('next'),false);
 const first=a.snapshot().id;a.nodes.get('card').click();assert.equal(a.snapshot().revealed,true);
 a.nodes.get('forgot').click();assert.notEqual(a.snapshot().id,first);assert.equal(a.snapshot().revealed,false);
 assert.equal(review.loadState(a.storage,seed).entries.find(x=>x.id===first).weight,2);
 a.flush();const second=a.snapshot().id;a.nodes.get('remember').click();assert.notEqual(a.snapshot().id,second);
 assert.equal(review.loadState(a.storage,seed).entries.find(x=>x.id===second).weight,.5);
});
test('a fast second tap cannot accidentally rate the next card',async()=>{
 const a=await app();a.nodes.get('forgot').click();const saved=a.storage.getItem(review.STORAGE_KEY);const next=a.snapshot().id;
 a.nodes.get('forgot').click();assert.equal(a.context.rate('remember'),false);
 assert.equal(a.storage.getItem(review.STORAGE_KEY),saved);assert.equal(a.snapshot().id,next);
 a.flush();assert.equal(a.nodes.get('remember').disabled,false);assert.equal(a.context.rate('remember'),true);
});
test('failed persistence leaves the same card visible and available to retry',async()=>{
 const a=await app();const before=a.snapshot().id;a.failStorage();a.nodes.get('remember').click();
 assert.equal(a.snapshot().id,before);assert.equal(a.snapshot().advancing,false);
 assert.equal(a.nodes.get('notice').hidden,false);assert.match(a.nodes.get('notice').textContent,/未能保存/);
 assert.equal(a.nodes.get('remember').disabled,false);assert.equal(a.storage.getItem(review.STORAGE_KEY),null);
});
test('typography preserves exact text and treats user markup as text',async()=>{
 const a=await app();const text='bring A into contact with B; sb. <img src=x onerror=alert(1)>';
 a.context.renderEnglish(text);const node=a.nodes.get('english');assert.equal(node.textContent,text);
 assert.deepEqual(node.children.filter(x=>x.tagName).map(x=>x.textContent),['A','B','sb.']);
 assert.ok(node.children.filter(x=>x.tagName).every(x=>x.tagName==='span'&&x.className==='phrase-slot'));
});
test('revealing a card shows its matching example and translation; advancing hides both',async()=>{
 const a=await app(),entry=seed.find(x=>x.id===a.snapshot().id);
 assert.equal(a.nodes.get('example').hidden,true);
 a.nodes.get('card').click();assert.equal(a.nodes.get('example').hidden,false);
 assert.equal(a.nodes.get('example-english').textContent,entry.example.english);
 assert.equal(a.nodes.get('example-chinese').textContent,entry.example.chinese);
 a.nodes.get('remember').click();assert.equal(a.nodes.get('example').hidden,true);
});
test('example emphasis follows the ordered phrase parts and never interprets HTML',async()=>{
 const a=await app(),target=a.nodes.get('example-english');
 const sentence='Try to apply this rule to <img src=x>.';
 a.context.renderHighlights(target,sentence,['apply','to']);
 assert.equal(target.textContent,sentence);
 const marks=target.children.filter(x=>x.tagName);
 assert.deepEqual(marks.map(x=>x.textContent),['apply','to']);
 assert.ok(marks.every(x=>x.tagName==='mark'));
 assert.equal(target.children[0].textContent,'Try to ');
});
