import {prepareOffline} from './offline.js';
import {fitPhraseText,renderHighlights} from './presentation.js';
import {addPhrase,loadState,ratePhrase,pickPhrase,STORAGE_KEY} from './review.js';
const el=id=>document.getElementById(id);
let seed=[],entries=[],current=null,revealed=false,storage=null,ready=false,storageBroken=false,advancing=false;
function notice(message){el('notice').textContent=message;el('notice').hidden=!message;}
function feedback(message){el('feedback').textContent=message;}
function scheduleFit(){window.requestAnimationFrame?.(()=>fitPhraseText(el('phrase-line'),el('english')));}
function renderEnglish(text){
 const target=el('english');target.replaceChildren();
 target.dataset.length=text.length>65?'very-long':text.length>35?'long':'short';
 const slots=/\b(?:sb\.|sth\.|one['’]s|[ABCX](?![A-Za-z]))|…+/g;
 let start=0;
 for(const match of text.matchAll(slots)){
  target.append(document.createTextNode(text.slice(start,match.index)));
  const slot=document.createElement('span');slot.className='phrase-slot';slot.textContent=match[0];target.append(slot);start=match.index+match[0].length;
 }
 target.append(document.createTextNode(text.slice(start)));
 scheduleFit();
}
function renderControls(){
 for(const id of ['forgot','remember'])el(id).disabled=!current||advancing||storageBroken;
 el('open-add').disabled=!ready||storageBroken;
}
function render(){
 el('phrase-count').textContent=entries.length+' 个词组';
 renderEnglish(current?.english||(ready?'口袋还是空的':'准备词组…'));
 el('meaning').textContent=current?.chinese||'点右上角 ＋，放入第一个词组。';
 el('meaning').hidden=!revealed;el('reveal-hint').hidden=revealed||!current;
 const example=current?.example;
 el('example').hidden=!revealed||!example;
 let highlights=example?.highlights||[];
 if(example&&!highlights.length&&current?.english){
  const index=example.english.toLocaleLowerCase('en').indexOf(current.english.toLocaleLowerCase('en'));
  if(index>=0)highlights=[example.english.slice(index,index+current.english.length)];
 }
 renderHighlights(el('example-english'),example?.english||'',highlights);
 el('example-chinese').textContent=example?.chinese||'';
 el('card').setAttribute('aria-expanded',String(revealed));
 el('card').setAttribute('aria-label',current?current.english+'，'+(revealed?current.chinese+(example?'。例句：'+example.english+'。'+example.chinese:'')+'。点击收起':'点击查看释义和例句'):'暂无词组');
 el('card').disabled=!current;
 el('card-bottom').textContent=revealed?'再看一眼，也是一种进步':'先回想，再揭晓';
 renderControls();
}
function next(message='选一下，继续下一词。'){
 if(!ready)return;
 current=pickPhrase(entries,current?.id);revealed=!current;
 feedback(message);render();
}
function rate(rating){
 if(!current||advancing||!storage||storageBroken)return false;
 try{
 const result=ratePhrase(storage,seed,current.id,rating);entries=result.entries;
 advancing=true;notice('');
 next(rating==='forgot'?'已记下，之后多见几次。':'已记下，之后少见一些。');
 // Display the new card immediately, ignoring a double tap carried over from the old card.
 setTimeout(()=>{advancing=false;renderControls()},350);
 return true;
 }catch(error){notice(error.message);return false}
}
function add(english,chinese,example=null){
 if(!storage||storageBroken)throw new Error('本机存储暂不可用。');
 const id='u-'+crypto.randomUUID();
 entries=addPhrase(storage,seed,english,chinese,id,example);
 if(!current)current=pickPhrase(entries);
 notice('');render();feedback('已放进口袋，下次可能就会遇见。');
 return {id,english:entries[entries.length-1].english};
}
el('card').addEventListener('click',()=>{revealed=!revealed;render()});
el('forgot').addEventListener('click',()=>rate('forgot'));
el('remember').addEventListener('click',()=>rate('remember'));
el('open-add').addEventListener('click',()=>{
 el('form-error').hidden=true;el('add-dialog').showModal();el('new-english').focus();
});
for(const id of ['close-add','cancel-add'])el(id).addEventListener('click',()=>el('add-dialog').close());
el('add-dialog').addEventListener('close',()=>el('open-add').focus());
el('add-dialog').addEventListener('click',event=>{if(event.target===el('add-dialog')){const r=el('add-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)el('add-dialog').close()}});
el('add-form').addEventListener('submit',event=>{
 event.preventDefault();
 try{add(el('new-english').value,el('new-chinese').value,{english:el('new-example-english').value,chinese:el('new-example-chinese').value});el('add-form').reset();el('add-dialog').close();}
 catch(error){el('form-error').textContent=error.message;el('form-error').hidden=false;}
});
window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY||!storage)return;
 try{entries=loadState(storage,seed).entries;storageBroken=false;notice('');if(current)current=entries.find(x=>x.id===current.id)||pickPhrase(entries);render();}
 catch(error){storageBroken=true;notice(error.message);render();}
});
async function init(){
 render();
 try{const response=await fetch('./phrases.json');if(!response.ok)throw new Error('词库未能载入，请联网后重新打开一次。');seed=await response.json();if(!Array.isArray(seed)||seed.length===0||seed.some(x=>!x.id||!x.english||!x.chinese))throw new Error('内置词库格式有误。');}
 catch(error){notice(error.message);ready=true;render();return;}
 try{storage=window.localStorage;entries=loadState(storage,seed).entries;}
 catch(error){entries=seed.map(x=>({...x,weight:1}));storageBroken=true;notice(error.message);}
 ready=true;next();registerTools();
}
function registerTools(){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const tools=[
 {name:'read_current_phrase',description:'Read the visible current phrase and review state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({id:current?.id,english:current?.english,chinese:revealed?current?.chinese:null,revealed,advancing,total:entries.length})},
 {name:'rate_current_phrase',description:'Remember or forget the visible phrase, save its weight locally, then immediately show the next card. Same action as the two review buttons.',inputSchema:{type:'object',properties:{rating:{type:'string',enum:['forgot','remember']}},required:['rating'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{if(!input||Object.keys(input).some(k=>k!=='rating')||!['forgot','remember'].includes(input.rating))throw new Error('Invalid rating');return{saved:rate(input.rating),id:current?.id,english:current?.english}}},
 {name:'add_phrase',description:'Save one English phrase and Chinese meaning in this device using the same validation as the Add form.',inputSchema:{type:'object',properties:{english:{type:'string',maxLength:160},chinese:{type:'string',maxLength:300}},required:['english','chinese'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:input=>{if(!input||Object.keys(input).some(k=>!['english','chinese'].includes(k)))throw new Error('Invalid input');return add(input.english,input.chinese);}}
 ];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
window.addEventListener('resize',scheduleFit);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleFit).observe(el('phrase-line'));
document.fonts?.ready.then(scheduleFit);
init();prepareOffline();
