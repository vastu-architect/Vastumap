/* A manual work ruler. Gestures preview locally; exports never include this tool. */
(function(){
 'use strict';
 const G=window.MeasurementGeometry,S=window.MeasurementState,NS='http://www.w3.org/2000/svg';
 const ids=['rulerToggleBtn','rulerProperties','rulerLength','rulerAngle','rulerAngleApplyBtn','rulerHorizontalBtn','rulerVerticalBtn','rulerHideBtn','rulerStatus'];
 const ui=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
 const svg=document.createElementNS(NS,'svg');svg.id='manualRulerOverlay';svg.classList.add('manual-ruler-overlay');svg.setAttribute('viewBox','0 0 1600 1200');canvas.appendChild(svg);
 let bridge=null,frame=0,active=false,gesture=null,feedback='',suppressClick=false,observedState=null;
 const state=()=>S.get(),clone=value=>({visible:value.visible,a:{...value.a},b:{...value.b}});
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Math.abs(value)<.05?0:value);
 const same=(a,b)=>a.visible===b.visible&&a.a.x===b.a.x&&a.a.y===b.a.y&&a.b.x===b.b.x&&a.b.y===b.b.y;
 function scale(){return canvas.getBoundingClientRect().width/canvas.offsetWidth||1}
 function otherContext(){return !!sel||!!window.VastuWallTools?.selectedWallId()||!!bridge?.isDrawing()}
 function restoreHeader(){if(!otherContext())showProperties('')}
 function valid(value){return [value.a,value.b].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1000000&&Math.abs(p.y)<=1000000)&&G.distance(value.a,value.b)>=.000001}
 function displayState(){return gesture?clone(gesture.preview):clone(state().ruler)}
 function sceneChanged(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
 function removeGestureListeners(){window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancelGesture,true);window.removeEventListener('blur',cancelGesture)}
 function cancelGesture(event){
  if(!gesture||(event?.type==='pointercancel'&&event.pointerId!==gesture.pointerId))return;
  const id=gesture.pointerId;gesture=null;removeGestureListeners();
  try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id)}catch(error){}
  sceneChanged();
 }
 function deactivate(){cancelGesture();active=false;feedback='';restoreHeader();sceneChanged()}
 function activate(){
  if(!bridge)return;
  bridge.cancelDrawing();window.VastuWallTools?.clearSelection();clearSel();active=true;feedback='';sceneChanged();
 }
 function checkpoint(action){cancelGesture();pushHistory();action();scheduleAutosave();sceneChanged();bridge?.redraw()}
 function hide(){
  deactivate();if(!state().ruler.visible)return;
  checkpoint(()=>state().ruler.visible=false);
 }
 function setAngle(value){
  if(!state().ruler.visible||!Number.isFinite(value)||Math.abs(value)>360){feedback='Введите угол от −360° до 360°.';sceneChanged();return}
  const current=state().ruler,length=G.distance(current.a,current.b),center={x:(current.a.x+current.b.x)/2,y:(current.a.y+current.b.y)/2};
  const next={visible:true,a:G.wallPointAtAngle(center,length/2,value+180),b:G.wallPointAtAngle(center,length/2,value)};
  if(!valid(next)){feedback='Линейка выходит за допустимые пределы плана.';sceneChanged();return}
  if(G.distance(next.a,current.a)<.000001&&G.distance(next.b,current.b)<.000001)return;
  checkpoint(()=>state().ruler=next);feedback='Угол применён. Центр и длина линейки сохранены.';sceneChanged();
 }
 function start(event,part){
  if(!bridge||bridge.isDrawing()||!state().ruler.visible||event.button>0||event.isPrimary===false)return;
  event.preventDefault();event.stopImmediatePropagation();cancelGesture();activate();
  const original=clone(state().ruler);
  gesture={pointerId:event.pointerId,state:state(),part,start:bridge.toPlan(bridge.screenPoint(event)),original,preview:clone(original),moved:false};
  suppressClick=true;
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',cancelGesture,true);window.addEventListener('blur',cancelGesture);
  try{canvas.setPointerCapture(event.pointerId)}catch(error){}
  sceneChanged();
 }
 function move(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(gesture.state!==state()||!state().ruler.visible||!same(state().ruler,gesture.original)||otherContext()){cancelGesture();return}
  const p=bridge.toPlan(bridge.screenPoint(event)),next=clone(gesture.original);
  if(gesture.part==='body'){
   const dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;
   next.a={x:next.a.x+dx,y:next.a.y+dy};next.b={x:next.b.x+dx,y:next.b.y+dy};
  }else next[gesture.part]=p;
  if(!valid(next))return;
  gesture.preview=next;gesture.moved=G.distance(next.a,gesture.original.a)>.000001||G.distance(next.b,gesture.original.b)>.000001;
  feedback='';sceneChanged();
 }
 function finish(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();const completed=gesture;cancelGesture();suppressClick=true;
  if(completed.state!==state()||!same(state().ruler,completed.original)||!completed.moved||!valid(completed.preview)||otherContext())return;
  pushHistory();state().ruler=clone(completed.preview);scheduleAutosave();sceneChanged();bridge.redraw();
 }
 function line(a,b,attrs){return '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" '+attrs+'/>'}
 function render(){
  if(!bridge||isRestoring)return;
  if(observedState!==state()){cancelGesture();observedState=state();active=false;feedback='';restoreHeader()}
  if(gesture&&(gesture.state!==state()||!same(state().ruler,gesture.original)))cancelGesture();
  const isDrawing=bridge.isDrawing();
  if(otherContext()){cancelGesture();active=false}
  const value=displayState();
  if(!value.visible){if(active)restoreHeader();active=false;cancelGesture()}
  ui.rulerToggleBtn.setAttribute('aria-pressed',String(value.visible));ui.rulerToggleBtn.classList.toggle('is-active',value.visible);
  ui.rulerProperties.hidden=!value.visible||!active;
  if(active&&value.visible)propertyTitle.textContent='Линейка';
  if(!value.visible){svg.replaceChildren();return}
  const factor=bridge.factor(),length=G.distance(value.a,value.b),r=scale(),a=bridge.toCanvas(value.a),b=bridge.toCanvas(value.b),displayLength=G.distance(a,b);
  const u={x:(b.x-a.x)/displayLength,y:(b.y-a.y)/displayLength},n={x:-u.y,y:u.x},half=18/r,angle=G.wallAngle(value.a,value.b);
  const at=(offset,normal=0)=>({x:a.x+u.x*offset+n.x*normal,y:a.y+u.y*offset+n.y*normal});
  const corners=[at(0,-half),at(displayLength,-half),at(displayLength,half),at(0,half)];
  ui.rulerLength.textContent=factor?format(length*factor)+' см':'Масштаб не задан';
  if(document.activeElement!==ui.rulerAngle)ui.rulerAngle.value=String(Math.round(angle*1000)/1000);
  ui.rulerAngle.disabled=!!gesture;ui.rulerAngleApplyBtn.disabled=!!gesture;
  ui.rulerStatus.textContent=feedback||(!planData?'Загрузите план и задайте масштаб, чтобы проверять размеры.':!factor?'Задайте масштаб плана, чтобы видеть сантиметры.':'Середина — перемещение, концы — длина и поворот.');
  const interactive=isDrawing?'none':'all',out=['<g data-ruler-body style="pointer-events:'+interactive+';cursor:move;touch-action:none">'];
  out.push('<polygon data-ruler-band points="'+corners.map(p=>p.x+','+p.y).join(' ')+'" fill="#f4f5f5" fill-opacity=".68" stroke="#69747b" stroke-opacity=".65" stroke-width="'+1/r+'"/>');
  if(factor){
   const labelWidth=Math.max(56,format(length*factor).length*6+12),layout=G.rulerTicks(length*factor,Math.max(7,labelWidth/8)/r*factor),digits=Math.min(6,Math.max(0,-Math.floor(Math.log10(layout.stepCm))));
   const tickFormat=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(value);
   const displayAngle=G.wallAngle(a,b),flipped=displayAngle>90||displayAngle< -90,labelAngle=displayAngle>90?displayAngle-180:displayAngle< -90?displayAngle+180:displayAngle;
   layout.ticks.forEach(tick=>{
    const offset=tick.cm/factor,size=(tick.major?10:5)/r;
    out.push(line(at(offset,-half),at(offset,-half+size),'data-ruler-tick-cm="'+tick.cm+'" stroke="#59636b" stroke-width="'+.8/r+'"'));
    out.push(line(at(offset,half),at(offset,half-size),'stroke="#59636b" stroke-width="'+.8/r+'"'));
    if(tick.major&&displayLength*r>=40){
     const first=tick.cm===0,last=(displayLength-offset)*r<10,shift=first?10/r:last?-10/r:0,p=at(offset+shift,3/r),label=first?'0 см':tickFormat(tick.cm);
     const anchor=first?(flipped?'end':'start'):last?(flipped?'start':'end'):'middle';
     out.push('<text data-ruler-label-cm="'+tick.cm+'" x="'+p.x+'" y="'+p.y+'" transform="rotate('+labelAngle+' '+p.x+' '+p.y+')" text-anchor="'+anchor+'" font-size="'+10/r+'" font-family="Arial,sans-serif" fill="#38454d" pointer-events="none">'+escape(label)+'</text>');
    }
   });
  }
  out.push('</g>');
  if(active&&!isDrawing)['a','b'].forEach(side=>{const p=side==='a'?a:b;out.push('<g data-ruler-handle="'+side+'" style="pointer-events:all;cursor:crosshair;touch-action:none"><circle cx="'+p.x+'" cy="'+p.y+'" r="'+13/r+'" fill="transparent"/><circle cx="'+p.x+'" cy="'+p.y+'" r="'+4/r+'" fill="white" stroke="#436b80" stroke-width="'+1.5/r+'"/></g>')});
  svg.innerHTML=out.join('');
 }
 function attach(context){
  bridge=context;observedState=state();
  ui.rulerToggleBtn.addEventListener('click',()=>{
   if(state().ruler.visible){hide();return}
   checkpoint(()=>state().ruler.visible=true);activate();
  });
  ui.rulerHideBtn.addEventListener('click',hide);
  ui.rulerAngleApplyBtn.addEventListener('click',()=>{const raw=ui.rulerAngle.value.trim();if(!raw){feedback='Введите угол от −360° до 360°.';sceneChanged();return}setAngle(Number(raw.replace(',','.')))});
  ui.rulerAngle.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();ui.rulerAngleApplyBtn.click()}});
  ui.rulerHorizontalBtn.addEventListener('click',()=>setAngle(0));ui.rulerVerticalBtn.addEventListener('click',()=>setAngle(90));
  document.addEventListener('pointerdown',()=>suppressClick=false,true);
  canvas.addEventListener('pointerdown',event=>{
   if(bridge.isDrawing())return;
   const handle=event.target.closest?.('[data-ruler-handle]');if(handle){start(event,handle.dataset.rulerHandle);return}
   if(event.target.closest?.('[data-ruler-body]'))start(event,'body');
  },true);
  ['mousedown','touchstart'].forEach(type=>canvas.addEventListener(type,event=>{if(gesture||event.target.closest?.('[data-ruler-body],[data-ruler-handle]')){if(bridge.isDrawing())return;event.preventDefault();event.stopImmediatePropagation()}},{capture:true,passive:false}));
  canvas.addEventListener('click',event=>{if(suppressClick&&event.detail>0){suppressClick=false;event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(gesture||active)){event.preventDefault();deactivate()}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cancelGesture()});
  canvas.addEventListener('lostpointercapture',event=>{if(gesture?.pointerId===event.pointerId)cancelGesture()});
  sceneChanged();
 }
 window.VastuRuler={attach,sceneChanged,deactivate,hide,displayState,isDragging:()=>!!gesture};
})();
