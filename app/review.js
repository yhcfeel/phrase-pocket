export const STORAGE_KEY = 'phrase-pocket-v1';
export const MIN_WEIGHT = 0.25;
export const MAX_WEIGHT = 16;
export function normalizeEnglish(value) { return value.normalize('NFKC').replace(/[‘’]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase(); }
export function validatePhrase(english, chinese) {
 if(typeof english!=='string'||typeof chinese!=='string') throw new Error('请填写英语词组和中文释义。');
 const phrase={english:english.trim().replace(/\s+/g,' '),chinese:chinese.trim()};
 if(!phrase.english||!phrase.chinese) throw new Error('词组和释义都不能为空。');
 if(phrase.english.length>160||phrase.chinese.length>300) throw new Error('词组最多 160 字符，释义最多 300 字符。');
 if(!/[a-z]/i.test(phrase.english)) throw new Error('英语词组需要包含英文字母。');
 return phrase;
}
export function validateExample(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value)||typeof value.english!=='string'||typeof value.chinese!=='string')throw new Error('请同时填写英文例句和中文翻译。');
 const english=value.english.trim().replace(/\s+/g,' '),chinese=value.chinese.trim();
 if(!english&&!chinese)return null;
 if(!english||!chinese)throw new Error('请同时填写英文例句和中文翻译。');
 if(english.length>500||chinese.length>500)throw new Error('例句和翻译各最多 500 字符。');
 if(!/[a-z]/i.test(english))throw new Error('英文例句需要包含英文字母。');
 const highlights=value.highlights??[];
 if(!Array.isArray(highlights)||highlights.length>12)throw new Error('例句标记格式有误。');
 let offset=0;
 for(const part of highlights){
  if(typeof part!=='string'||!part||english.indexOf(part,offset)<0)throw new Error('例句标记与句子不一致。');
  offset=english.indexOf(part,offset)+part.length;
 }
 return {english,chinese,highlights};
}
export function parseStored(raw) {
 if(raw===null) return {version:1,custom:[],weights:{}};
 let value;
 try{value=JSON.parse(raw)}catch{throw new Error('保存的数据无法读取。原数据已保留，请勿清除浏览器数据。')}
 if(!value||value.version!==1||!Array.isArray(value.custom)||!value.weights||typeof value.weights!=='object'||Array.isArray(value.weights)) throw new Error('保存的数据格式无法识别。原数据已保留。');
 const ids=new Set(),names=new Set();
 const custom=value.custom.map(item=>{
  if(!item||typeof item.id!=='string'||!/^u-[a-zA-Z0-9-]+$/.test(item.id)||ids.has(item.id))throw new Error('词组数据异常。原数据已保留。');
  const phrase=validatePhrase(item.english,item.chinese),name=normalizeEnglish(phrase.english);
  if(names.has(name))throw new Error('词组数据重复。原数据已保留。');
  const example=validateExample(item.example);
  ids.add(item.id);names.add(name);return {id:item.id,...phrase,...(example?{example}:{})};
 });
 const weights={};
 for(const [id,weight] of Object.entries(value.weights)){
  if(!/^(p\d+|u-[a-zA-Z0-9-]+)$/.test(id)||typeof weight!=='number'||!Number.isFinite(weight)||weight<MIN_WEIGHT||weight>MAX_WEIGHT)throw new Error('复习进度异常。原数据已保留。');
  weights[id]=weight;
 }
 return {version:1,custom,weights};
}
export function loadState(storage,seed) {
 let raw;try{raw=storage.getItem(STORAGE_KEY)}catch{throw new Error('无法读取本机存储，请检查 Safari 的浏览器设置。')}
 const data=parseStored(raw);
 const names=new Set(seed.map(x=>normalizeEnglish(x.english)));
 const entries=[...seed,...data.custom.filter(x=>!names.has(normalizeEnglish(x.english)))].map(x=>({...x,weight:data.weights[x.id]??1}));
 return {data,entries};
}
function save(storage,data){
 try{storage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{throw new Error('未能保存：设备空间不足或浏览器禁止存储。请处理后重试。')}
}
export function ratePhrase(storage,seed,id,rating) {
 if(rating!=='forgot'&&rating!=='remember')throw new Error('无效的复习反馈。');
 const {data,entries}=loadState(storage,seed),entry=entries.find(x=>x.id===id);
 if(!entry)throw new Error('找不到这个词组，请换一个重试。');
 const weight=Math.max(MIN_WEIGHT,Math.min(MAX_WEIGHT,entry.weight*(rating==='forgot'?2:0.5)));
 save(storage,{...data,weights:{...data.weights,[id]:weight}});
 return {entries:entries.map(x=>x.id===id?{...x,weight}:x),weight};
}
export function addPhrase(storage,seed,english,chinese,id,exampleInput=null) {
 const phrase=validatePhrase(english,chinese),{data,entries}=loadState(storage,seed);
 const example=validateExample(exampleInput);
 if(!/^u-[a-zA-Z0-9-]+$/.test(id)||entries.some(x=>x.id===id))throw new Error('词组编号无效，请重试。');
 if(entries.some(x=>normalizeEnglish(x.english)===normalizeEnglish(phrase.english)))throw new Error('这个词组已经在口袋里了。');
 const entry={id,...phrase,...(example?{example}:{})};
 save(storage,{...data,custom:[...data.custom,entry]});
 return [...entries,{...entry,weight:1}];
}
export function pickPhrase(entries,previousId=null,random=Math.random){
 if(!entries.length)return null;
 const eligible=entries.length>1?entries.filter(x=>x.id!==previousId):entries;
 const weight=x=>Number.isFinite(x.weight)&&x.weight>0?Math.max(MIN_WEIGHT,Math.min(MAX_WEIGHT,x.weight)):1;
 const total=eligible.reduce((sum,x)=>sum+weight(x),0);
 let r=random();if(!Number.isFinite(r))r=0;
 let cursor=Math.max(0,Math.min(1-Number.EPSILON,r))*total;
 for(const entry of eligible){cursor-=weight(entry);if(cursor<0)return entry}
 return eligible[eligible.length-1];
}
