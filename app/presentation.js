export function fitPhraseText(viewport,target){
 const available=viewport?.clientWidth;
 if(!available||!target)return;
 const maximum=36,minimum=22;
 target.style.fontSize=maximum+'px';
 const measured=target.scrollWidth;
 const size=measured>available?Math.max(minimum,Math.floor(maximum*(available-2)/measured*10)/10):maximum;
 target.style.fontSize=size+'px';
 // Extremely long custom phrases remain whole and can be scrolled horizontally.
 viewport.dataset.overflow=String(target.scrollWidth>available+1);
 viewport.scrollLeft=0;
}

export function renderHighlights(target,text,highlights=[]){
 target.replaceChildren();let offset=0;
 for(const phrase of highlights){
  const start=text.indexOf(phrase,offset);if(start<0)continue;
  target.append(document.createTextNode(text.slice(offset,start)));
  const mark=document.createElement('mark');mark.textContent=phrase;target.append(mark);
  offset=start+phrase.length;
 }
 target.append(document.createTextNode(text.slice(offset)));
}
