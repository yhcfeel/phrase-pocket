import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateExample,addPhrase,ratePhrase,loadState,STORAGE_KEY} from '../app/review.js';
import {fitPhraseText} from '../app/presentation.js';
const seed=JSON.parse(await readFile(new URL('../app/phrases.json',import.meta.url),'utf8'));
function memory(){const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
test('all original 115 phrases have complete, valid bilingual examples and matching emphasis',()=>{
 for(const phrase of seed.filter(x=>Number(x.id.slice(1))<=115)){
  assert.ok(phrase.example,phrase.id);assert.ok(validateExample(phrase.example),phrase.id);
  assert.ok(phrase.example.highlights.length>0,phrase.id);
  assert.ok(!/\[\[|\]\]|sb\.|sth\./.test(phrase.example.english),phrase.id+' needs a real sentence');
 }
});
test('existing stored phrases and review weights survive adding optional example fields',()=>{
 const s=memory();s.setItem(STORAGE_KEY,JSON.stringify({version:1,custom:[{id:'u-old',english:'old sample phrase',chinese:'旧词'}],weights:{p001:2,'u-old':4}}));
 const state=loadState(s,seed);
 assert.equal(state.entries.find(x=>x.id==='u-old').weight,4);assert.equal(state.entries[0].weight,2);assert.ok(state.entries[0].example);
 const before=s.getItem(STORAGE_KEY);loadState(s,seed);assert.equal(s.getItem(STORAGE_KEY),before);
});
test('a user example and its translation survive rating and reopening',()=>{
 const s=memory(),example={english:'This is a sample sentence.',chinese:'这是一个例句。'};
 addPhrase(s,seed,'test sample phrase','测试词组','u-example',example);
 ratePhrase(s,seed,'u-example','forgot');const saved=loadState(s,seed).entries.find(x=>x.id==='u-example');
 assert.equal(saved.example.english,example.english);assert.equal(saved.example.chinese,example.chinese);assert.equal(saved.weight,2);
});
test('an incomplete translation is rejected without changing existing data',()=>{
 const s=memory();ratePhrase(s,seed,'p001','forgot');const previous=s.getItem(STORAGE_KEY);
 assert.throws(()=>addPhrase(s,seed,'sample phrase','测试','u-invalid',{english:'A sentence.',chinese:''}),/同时填写/);
 assert.equal(s.getItem(STORAGE_KEY),previous);assert.equal(validateExample({english:'',chinese:''}),null);
});
test('fitting a phrase uses available width and keeps a readable floor without altering its text',()=>{
 const viewport={clientWidth:324,dataset:{},scrollLeft:25};
 const target={textContent:'A complete phrase',style:{},get scrollWidth(){return Number.parseFloat(this.style.fontSize)*13;}};
 fitPhraseText(viewport,target);assert.ok(target.scrollWidth<=324);assert.ok(Number.parseFloat(target.style.fontSize)>=22);assert.equal(viewport.scrollLeft,0);
 viewport.clientWidth=100;fitPhraseText(viewport,target);assert.equal(target.style.fontSize,'22px');assert.equal(viewport.dataset.overflow,'true');assert.equal(target.textContent,'A complete phrase');
 viewport.clientWidth=800;fitPhraseText(viewport,target);assert.equal(target.style.fontSize,'36px');
});
