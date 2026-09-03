// No network is required after the complete application has been cached.
export async function prepareOffline(){
 const status=document.getElementById('offline-status'),button=document.getElementById('apply-update');
 if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='请通过 HTTPS 打开以启用离线';return;}
 let registration,reloading=false,hadController=!!navigator.serviceWorker.controller;
 function showUpdate(){
  if(!registration?.waiting)return;
  status.textContent='新版已备好 · 进度会保留';button.hidden=false;
 }
 function watchWorker(worker){
  if(!worker)return;
  worker.addEventListener('statechange',()=>{
   if(worker.state==='installed')showUpdate();
   if(worker.state==='activated')checkOffline();
  });
 }
 async function checkOffline(){
  if(!registration)return;
  if(registration.waiting){showUpdate();return;}
  const worker=registration.active;if(!worker)return;
  const channel=new MessageChannel();
  const timer=setTimeout(()=>{channel.port1.close();if(!registration.waiting)status.textContent='离线准备中，请保持联网片刻';},8000);
  channel.port1.onmessage=event=>{
   if(event.data?.type!=='OFFLINE_READY')return;
   clearTimeout(timer);channel.port1.close();
   if(registration.waiting){showUpdate();return;}
   status.textContent=event.data.ready?'离线已就绪 · 数据保存在本机':'离线文件不完整，请联网后重开';
  };
  worker.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
 }
 button.addEventListener('click',()=>{
  if(document.getElementById('add-dialog').open)return;
  if(!registration?.waiting)return;
  button.disabled=true;status.textContent='正在更新，进度会保留…';
  registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(hadController){
   // Preserve an unfinished Add form, including in another open tab.
   const reload=()=>{if(!reloading){reloading=true;location.reload();}};
   const dialog=document.getElementById('add-dialog');
   if(dialog.open){status.textContent='新版已就绪，完成添加后自动更新';dialog.addEventListener('close',reload,{once:true});}
   else reload();
  }else{hadController=true;checkOffline();}
 });
 try{
  status.textContent='正在准备离线使用…';
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>watchWorker(registration.installing));
  watchWorker(registration.installing);showUpdate();checkOffline();
  let checking=false,lastCheck=0;
  async function update(){
   if(navigator.onLine===false||checking||Date.now()-lastCheck<60000)return;
   checking=true;lastCheck=Date.now();
   try{await registration.update();showUpdate();}catch{/* The cached app remains usable offline. */}
   finally{checking=false;}
  }
  window.addEventListener('online',()=>{lastCheck=0;update();checkOffline();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){update();checkOffline();}});
  window.addEventListener('pageshow',()=>{update();checkOffline();});
  update();
  // Best effort only; iOS makes the final storage-retention decision.
  if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
 }catch{status.textContent='离线准备未完成，请联网后重开';}
}
