/* Wall editing keeps pointer previews transient; only a completed gesture changes the project. */
(function(){
 'use strict';
 const G=window.MeasurementGeometry,S=window.MeasurementState,NS='http://www.w3.org/2000/svg';
 const ui=Object.fromEntries(['wallFreeAngleBtn','wallSnap','wallDirectionBtn','wallDirectionResetBtn','wallDirectionStatus','wallProperties','wallPropertyName','wallPropertyLength','wallPropertyAngle','wallAngleApplyBtn','wallEditStatus','wallPropertiesDoneBtn'].map(id=>[id,document.getElementById(id)]));
 const svg=document.createElementNS(NS,'svg');svg.id='wallEditOverlay';svg.classList.add('wall-edit-overlay');svg.setAttribute('viewBox','0 0 1600 1200');svg.setAttribute('aria-hidden','true');canvas.appendChild(svg);
 let bridge=null,frame=0,selection='',selectionState=null,gesture=null,drawingPreview=null,snapPoint=null,feedback='',suppressClickUntil=0;
 const state=()=>S.get(),escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Math.abs(value)<.05?0:value);
 const cloneWall=wall=>({...wall,a:{...wall.a},b:{...wall.b}});
 function scale(){return canvas.getBoundingClientRect().width/canvas.offsetWidth||1}
 function findWall(id=selection){return state().walls.find(wall=>wall.id===id)||null}
 function isShown(wall){return !!wall&&state().visible&&state().showWalls&&wall.visible}
 function validPoint(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1000000&&Math.abs(p.y)<=1000000}
 function validWall(wall){return validPoint(wall.a)&&validPoint(wall.b)&&G.distance(wall.a,wall.b)>=2}
 function removeGestureListeners(){window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',cancelGesture,true);window.removeEventListener('blur',cancelGesture)}
 function cancelGesture(event){
  if(!gesture||(event?.type==='pointercancel'&&event.pointerId!==gesture.pointerId))return;
  const id=gesture.pointerId;gesture=null;snapPoint=null;removeGestureListeners();canvas.classList.remove('wall-endpoint-editing');
  try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id)}catch(error){}
  sceneChanged();bridge?.redraw();
 }
 function clearSelection(){
  cancelGesture();selection='';selectionState=null;feedback='';snapPoint=null;
  if(!sel)showProperties('');sceneChanged();bridge?.redraw();
 }
 function selectWall(id){
  const wall=findWall(id);if(!isShown(wall))return;
  bridge?.cancelDrawing(false);cancelGesture();clearSel();selection=id;selectionState=state();feedback='';drawingPreview=null;
  propertyTitle.textContent='Стена';sceneChanged();bridge?.redraw();
 }
 function sceneChanged(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
 function checkpoint(action){cancelGesture();pushHistory();action();scheduleAutosave();sceneChanged();bridge?.redraw()}
 function constrainDrawingPoint(a,p,excludeId='',directionAngle=null){
  const free=state().wallFreeAngle||!a;
  let q=a?G.constrainWallPoint(a,p,{free,baseAngle:state().wallBaseAngle,directionAngle}):{...p};snapPoint=null;
  if(state().wallSnap){
   const radius=8/scale();let nearest=radius,chosen=null;
   const direction=a&&!free?(directionAngle??(G.distance(a,q)>.000001?G.wallAngle(a,q):null)):null;
   state().walls.filter(wall=>isShown(wall)&&wall.id!==excludeId).forEach(wall=>[wall.a,wall.b].forEach(candidate=>{
    const distance=G.distance(p,candidate);if(distance>nearest)return;
    if(a&&!free){const aligned=G.constrainWallPoint(a,candidate,{directionAngle:direction,baseAngle:state().wallBaseAngle});if(G.distance(aligned,candidate)>.000001)return}
    nearest=distance;chosen=candidate;
   }));
   if(chosen){q={...chosen};snapPoint={...chosen}}
  }
  return q;
 }
 function wallForDisplay(wall){return gesture&&gesture.wall===wall?gesture.preview:wall}
 function startHandle(event,id,side){
  const wall=findWall(id);if(!isShown(wall)||!bridge||event.button>0||event.isPrimary===false)return;
  event.preventDefault();event.stopImmediatePropagation();cancelGesture();
  const original=cloneWall(wall),fixed=side==='a'?'b':'a';
  gesture={pointerId:event.pointerId,state:state(),wall,side,fixed,original,preview:cloneWall(wall),direction:G.wallAngle(original[fixed],original[side]),moved:false};
  suppressClickUntil=performance.now()+500;canvas.classList.add('wall-endpoint-editing');
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',cancelGesture,true);window.addEventListener('blur',cancelGesture);
  try{canvas.setPointerCapture(event.pointerId)}catch(error){}
  sceneChanged();
 }
 function move(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(gesture.state!==state()||!isShown(gesture.wall)||findWall(gesture.wall.id)!==gesture.wall){cancelGesture();return}
  const p=bridge.toPlan(bridge.screenPoint(event)),q=constrainDrawingPoint(gesture.original[gesture.fixed],p,gesture.wall.id,gesture.direction);
  if(!validPoint(q))return;
  gesture.preview={...gesture.original,[gesture.side]:q};gesture.moved=G.distance(q,gesture.original[gesture.side])>.000001;
  feedback='';sceneChanged();bridge.redraw();
 }
 function finish(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  event.preventDefault();event.stopImmediatePropagation();
  const completed=gesture;cancelGesture();suppressClickUntil=performance.now()+500;
  if(completed.state!==state()||findWall(completed.wall.id)!==completed.wall||!isShown(completed.wall))return;
  if(!completed.moved)return;
  if(!validWall(completed.preview)){feedback='Концы стены должны находиться дальше друг от друга.';sceneChanged();return}
  if(G.distance(completed.wall.a,completed.original.a)>.000001||G.distance(completed.wall.b,completed.original.b)>.000001)return;
  pushHistory();completed.wall.a={...completed.preview.a};completed.wall.b={...completed.preview.b};scheduleAutosave();sceneChanged();bridge.redraw();
 }
 function render(){
  if(!bridge||isRestoring)return;
  if(gesture&&(gesture.state!==state()||findWall(gesture.wall.id)!==gesture.wall||!isShown(gesture.wall)))cancelGesture();
  if(selection&&(selectionState!==state()||!isShown(findWall())||sel))clearSelection();
  if(drawingPreview&&drawingPreview.state!==state())drawingPreview=null;
  ui.wallFreeAngleBtn.textContent='Свободный угол: '+(state().wallFreeAngle?'вкл':'выкл');ui.wallFreeAngleBtn.setAttribute('aria-pressed',String(state().wallFreeAngle));ui.wallFreeAngleBtn.classList.toggle('is-active',state().wallFreeAngle);
  ui.wallSnap.checked=state().wallSnap;ui.wallDirectionResetBtn.hidden=Math.abs(state().wallBaseAngle)<.000001;
  if(ui.wallDirectionStatus)ui.wallDirectionStatus.textContent=Math.abs(state().wallBaseAngle)<.000001?'По осям изображения.':'Направление стен: '+format(state().wallBaseAngle)+'°. Существующие стены не меняются.';
  const wall=findWall(),view=wall?wallForDisplay(wall):drawingPreview;
  ui.wallProperties.hidden=!view;
  if(view){
   propertyTitle.textContent='Стена';ui.wallPropertyName.textContent=wall?.name||'Новая стена';
   const length=G.distance(view.a,view.b),factor=bridge.factor();ui.wallPropertyLength.textContent=factor?format(length*factor)+' см':'Масштаб не задан';
   if(document.activeElement!==ui.wallPropertyAngle)ui.wallPropertyAngle.value=length>.000001?String(Math.round(G.wallAngle(view.a,view.b)*1000)/1000):'';
   ui.wallPropertyAngle.readOnly=!wall||!state().wallFreeAngle||!!gesture;ui.wallAngleApplyBtn.disabled=!wall||!state().wallFreeAngle||!!gesture;
   ui.wallEditStatus.textContent=feedback||(!wall?'Отметьте вторую точку стены.':state().wallFreeAngle?'Переместите конец стены или введите точный угол.':'Переместите конец стены. Направление сохраняется.');
  }
  const ratio=scale(),showHits=!bridge.isDrawing()&&!gesture&&!sel&&(bridge.toolsOpen()||!!selection),lines=[];
  if(showHits)state().walls.filter(isShown).forEach(w=>{const shown=wallForDisplay(w),a=bridge.toCanvas(shown.a),b=bridge.toCanvas(shown.b);lines.push('<line data-wall-hit="'+escape(w.id)+'" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="transparent" stroke-width="'+8/ratio+'" pointer-events="stroke"/>')});
  if(wall&&!bridge.isDrawing()){
   ['a','b'].forEach(side=>{const p=bridge.toCanvas(view[side]);lines.push('<g class="wall-handle" data-wall-id="'+escape(wall.id)+'" data-wall-handle="'+side+'" pointer-events="all"><circle cx="'+p.x+'" cy="'+p.y+'" r="'+14/ratio+'" fill="transparent"/><circle cx="'+p.x+'" cy="'+p.y+'" r="'+5/ratio+'" fill="white" stroke="#9c6234" stroke-width="'+1.5/ratio+'"/></g>')});
  }
  if(snapPoint){const p=bridge.toCanvas(snapPoint);lines.push('<circle data-wall-snap-marker cx="'+p.x+'" cy="'+p.y+'" r="'+7/ratio+'" fill="none" stroke="#4d835d" stroke-width="'+1.5/ratio+'" pointer-events="none"/>')}
  svg.innerHTML=lines.join('');
 }
 function attach(context){
  bridge=context;
  ui.wallFreeAngleBtn.addEventListener('click',()=>checkpoint(()=>state().wallFreeAngle=!state().wallFreeAngle));
  ui.wallSnap.addEventListener('change',()=>checkpoint(()=>state().wallSnap=ui.wallSnap.checked));
  ui.wallDirectionBtn.addEventListener('click',()=>bridge.startDrawing('direction'));
  ui.wallDirectionResetBtn.addEventListener('click',()=>checkpoint(()=>state().wallBaseAngle=0));
  ui.wallPropertiesDoneBtn.addEventListener('click',()=>{bridge.cancelDrawing();clearSelection()});
  ui.wallPropertyAngle.addEventListener('keydown',event=>{if(event.key==='Enter'&&!ui.wallAngleApplyBtn.disabled){event.preventDefault();ui.wallAngleApplyBtn.click()}});
  ui.wallAngleApplyBtn.addEventListener('click',()=>{
   const wall=findWall(),value=Number(ui.wallPropertyAngle.value.trim().replace(',','.'));
   if(!wall||!state().wallFreeAngle)return;
   if(!ui.wallPropertyAngle.value.trim()||!Number.isFinite(value)||Math.abs(value)>360){feedback='Введите угол от −360° до 360°.';sceneChanged();return}
   const next={...wall,b:G.wallPointAtAngle(wall.a,G.distance(wall.a,wall.b),value)};
   if(!validWall(next)){feedback='Угол выходит за допустимые пределы плана.';sceneChanged();return}
   if(G.distance(wall.b,next.b)<.000001)return;
   checkpoint(()=>wall.b=next.b);feedback='Угол применён. Длина стены сохранена.';sceneChanged();
  });
  document.addEventListener('pointerdown',()=>suppressClickUntil=0,true);
  canvas.addEventListener('pointerdown',event=>{
   if(bridge.isDrawing())return;
   const handle=event.target.closest?.('[data-wall-handle]');if(handle){startHandle(event,handle.dataset.wallId,handle.dataset.wallHandle);return}
   const hit=event.target.closest?.('[data-wall-hit]');if(hit){event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=performance.now()+500;selectWall(hit.dataset.wallHit)}
  },true);
  canvas.addEventListener('click',event=>{
   if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return}
   if(selection&&!event.target.closest?.('[data-wall-hit],[data-wall-handle]'))clearSelection();
  },true);
  ['mousedown','touchstart'].forEach(type=>canvas.addEventListener(type,event=>{if(gesture||event.target.closest?.('[data-wall-hit],[data-wall-handle]')){event.preventDefault();event.stopImmediatePropagation()}},{capture:true,passive:false}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(gesture||selection)){event.preventDefault();cancelGesture();clearSelection()}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')cancelGesture()});
  sceneChanged();
 }
 window.VastuWallTools={attach,sceneChanged,selectWall,clearSelection,constrainDrawingPoint,wallForDisplay,selectedWallId:()=>selection,isDragging:()=>!!gesture,validWall,
  beginDrawing(type){clearSelection();if(type==='wall'||type==='direction')clearSel();drawingPreview=null;snapPoint=null},cancelDrawing(){drawingPreview=null;snapPoint=null;sceneChanged()},
  setDrawingPreview(a,b){drawingPreview=a&&b?{a,b,state:state()}:null;sceneChanged()},
  setBaseDirection(a,b){checkpoint(()=>state().wallBaseAngle=G.wallAngle(a,b))}
 };
})();
