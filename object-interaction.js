/* Transient canvas controls. Editing mode and drag feedback are never saved in a project. */
(()=>{
 "use strict";
 const button=document.getElementById("transformModeBtn");
 const transformable=".vastu-grid,.purusha-grid,.overlay-wrap,.correction-object,.footnote";
 let observedSelection=null,transformMode=false,movingObject=null,dropClick=null,dropClickTimer=null;

 function current(){return sel?.isConnected?sel:null}
 function eligible(el){return !!el?.matches(transformable)&&el.dataset.locked!=="true"&&!el.hidden&&isLayerVisible(el)&&getComputedStyle(el).display!=="none"}
 function sceneChanged(){
  const el=current();
  if(el!==observedSelection){transformMode=false;movingObject=null;observedSelection=el}
  if(!eligible(el))transformMode=false;
  if(movingObject&&(movingObject!==el||movingObject.dataset.locked==="true"))movingObject=null;
  document.body.classList.toggle("object-transform-editing",transformMode);
  document.body.classList.toggle("object-dragging",!!movingObject);
  if(button){
   button.hidden=!eligible(el);
   button.textContent=transformMode?"Готово":"Размер и поворот";
   button.setAttribute("aria-pressed",String(transformMode));
   button.title=transformMode?"Завершить изменение размера и поворота (Esc)":"Показать ручки изменения размера и поворота";
  }
 }
 function setTransformMode(enabled){
  if(drag)stop();
  observedSelection=current();
  transformMode=!!enabled&&eligible(observedSelection);
  sceneChanged();
  notifyMeasurementSceneChanged();
 }
 function beginDrag(el){
  if(el!==current()||el.dataset.locked==="true"||movingObject===el)return;
  if(observedSelection!==el)sceneChanged();
  movingObject=el;
  document.body.classList.add("object-dragging");
  notifyMeasurementSceneChanged();
 }
 function clearDropClick(){
  dropClick=null;
  clearTimeout(dropClickTimer);
  dropClickTimer=null;
 }
 function endDrag(event){
  if(!movingObject)return;
  clearDropClick();
  // Hiding a detached caption changes the browser's mouseup target to the canvas.
  // Consume that gesture's generated click before it clears the selection.
  if(event?.type==="mouseup"&&event.button===0){
   dropClick={x:event.clientX,y:event.clientY,time:event.timeStamp};
   dropClickTimer=setTimeout(clearDropClick,0);
  }
  movingObject=null;
  document.body.classList.remove("object-dragging");
  notifyMeasurementSceneChanged();
 }
 button?.addEventListener("click",()=>setTransformMode(!transformMode));
 document.addEventListener("click",event=>{
  if(!dropClick)return;
  const matches=event.detail>0&&event.button===0&&canvas.contains(event.target)&&Math.hypot(event.clientX-dropClick.x,event.clientY-dropClick.y)<=2&&event.timeStamp-dropClick.time>=0&&event.timeStamp-dropClick.time<250;
  clearDropClick();
  if(matches){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 ["pointerdown","mousedown","touchstart"].forEach(type=>document.addEventListener(type,clearDropClick,{capture:true,passive:true}));
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape"||(!transformMode&&!movingObject&&!drag))return;
  if(drag)stop();
  setTransformMode(false);
  event.preventDefault();
 });
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="hidden"&&drag)stop();
 });
 window.VastuInteraction={
  sceneChanged,beginDrag,endDrag,setTransformMode,
  isDragging:()=>!!movingObject,
  isTransformMode:()=>transformMode,
  canTransform:el=>transformMode&&el===current()&&eligible(el)
 };
 sceneChanged();
})();
