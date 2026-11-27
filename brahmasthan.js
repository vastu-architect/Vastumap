/* The guide follows its grid; regular rubies move only on an explicit placement action. */
(function(){
 'use strict';
 const G=window.MeasurementGeometry,S=window.MeasurementState,NS='http://www.w3.org/2000/svg';
 const ui=Object.fromEntries(['brahmasthanTools','nineRubiesBtn','brahmasthanGridVisible','brahmasthanStatus'].map(id=>[id,document.getElementById(id)]));
 const svg=document.createElementNS(NS,'svg');svg.id='brahmasthanOverlay';svg.classList.add('brahmasthan-overlay');svg.setAttribute('viewBox','0 0 1600 1200');svg.setAttribute('aria-hidden','true');canvas.appendChild(svg);
 let frame=0,feedback=null,lastMarkup='';
 const state=()=>S.get();
 const groupFor=id=>Object.hasOwn(state().brahmasthans,id)?state().brahmasthans[id]:null;
 const safeGridId=id=>typeof id==='string'&&id.length<=128&&/^[a-z0-9][a-z0-9_.:-]*$/i.test(id)&&!['__proto__','prototype','constructor'].includes(id);
 const shown=el=>!!el?.isConnected&&isLayerVisible(el)&&!el.hidden&&getComputedStyle(el).display!=='none';
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function rect(el){return{left:parseFloat(el.style.left)||0,top:parseFloat(el.style.top)||0,width:storedDimension(el,'width',480),height:storedDimension(el,'height',480),rotation:Number(el.dataset.rot)||0}}
 function center(el){const box=el.getBoundingClientRect(),area=canvas.getBoundingClientRect();return{x:(box.left+box.width/2-area.left)/(area.width/canvas.offsetWidth)-canvas.clientLeft,y:(box.top+box.height/2-area.top)/(area.height/canvas.offsetHeight)-canvas.clientTop}}
 function metadata(el){return el?.dataset.measurementId&&state().objects[el.dataset.measurementId]||{}}
 function gridForSelection(el=sel){
  if(!el||el===plan||!el.isConnected)return null;
  if(el.matches('.vastu-grid'))return el;
  const all=[...canvas.querySelectorAll('.vastu-grid')],preferred=metadata(el).gridId||state().activeGridId;
  if(preferred)return all.find(grid=>grid.dataset.gridId===preferred)||null;
  const visible=all.filter(shown),p=center(el),containing=visible.filter(grid=>G.sectorAt(rect(grid),p));
  return containing.length===1?containing[0]:containing.length>1?null:visible.length===1?visible[0]:null;
 }
 function contextGrid(){
  const grid=sel?.matches('.vastu-grid')?sel:gridForSelection();if(!shown(grid)||!sel||!shown(sel))return null;
  if(sel===grid)return grid;
  const group=groupFor(grid.dataset.gridId),id=sel.dataset.measurementId;
  if(group?.rubies.includes(id))return grid;
  return G.sectorAt(rect(grid),center(sel))?.index===4?grid:null;
 }
 function rubyById(id){if(!id)return null;return [...canvas.querySelectorAll('.correction-object')].find(el=>el.dataset.measurementId===id&&el.dataset.category==='stones'&&el.dataset.item==='ruby')||null}
 function guideRecords(project){
  const groups=project.measurements?.brahmasthans||{};
  return (project.grids||[]).filter(grid=>grid.visible!==false&&Object.hasOwn(groups,grid.gridId)&&groups[grid.gridId].visible).map(grid=>({id:grid.gridId,layout:G.brahmasthanLayout(grid)}));
 }
 function guideSVG(records){return records.map(({id,layout})=>'<g data-brahmasthan-grid-id="'+escape(id)+'" data-brahmasthan-grid="'+escape(id)+'" fill="none" stroke="#426c7b" stroke-opacity=".8" stroke-width="1.4">'+['outline','lines'].map(key=>layout[key].map(l=>'<line data-brahmasthan-line="'+(key==='lines'?'subdivision':'outline')+'" x1="'+l.a.x+'" y1="'+l.a.y+'" x2="'+l.b.x+'" y2="'+l.b.y+'"'+(key==='lines'?' stroke-dasharray="5 3"':'')+'/>').join('')).join('')+'</g>').join('')}
 function liveGuide(){return guideRecords({measurements:state(),grids:[...canvas.querySelectorAll('.vastu-grid')].map(grid=>({...rect(grid),gridId:grid.dataset.gridId,visible:shown(grid)}))})}
 function render(){
  if(isRestoring)return;
  const markup=guideSVG(liveGuide());if(markup!==lastMarkup){svg.innerHTML=markup;lastMarkup=markup}
  const grid=contextGrid();ui.brahmasthanTools.hidden=!grid;if(!grid)return;
  const group=groupFor(grid.dataset.gridId),count=group?group.rubies.filter(id=>rubyById(id)).length:0;
  ui.brahmasthanGridVisible.checked=!!group?.visible;ui.brahmasthanGridVisible.disabled=!group;
  ui.nineRubiesBtn.textContent=group?'Расставить 9 рубинов':'9 рубинов';
  ui.nineRubiesBtn.disabled=!group&&Object.keys(state().brahmasthans).length>=200;
  ui.brahmasthanStatus.textContent=feedback?.gridId===grid.dataset.gridId?feedback.text:group?'Рубинов: '+count+' из 9. Подсетка скрывается отдельно от объектов.':'Разместить по рубину в центре каждой из девяти равных частей Брахмастана.';
 }
 function sceneChanged(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;render()})}
 function restoreSelection(original,type,id){
  const el=original?.isConnected?original:id?[...canvas.querySelectorAll('[data-measurement-id]')].find(item=>item.dataset.measurementId===id):null;
  if(el){if(type==='plan')selectPlan();else select(el,type)}else clearSel();
 }
 function placeNineRubies(){
  const grid=contextGrid();if(!grid)return;
  let gridId=grid.dataset.gridId;const existing=groupFor(gridId);
  if(!existing&&Object.keys(state().brahmasthans).length>=200){feedback={gridId,text:'Достигнут предел: 200 наборов рубинов.'};sceneChanged();return}
  const slots=existing?.rubies||Array(9).fill(''),layout=G.brahmasthanLayout(rect(grid)),size=Math.min(32,Math.max(8,Math.min(rect(grid).width,rect(grid).height)/9*.4));
  const skippedCount=slots.filter(id=>{const ruby=rubyById(id);return ruby&&(ruby.dataset.locked==='true'||!shown(ruby))}).length;
  const required=slots.filter(id=>{const ruby=rubyById(id);return !ruby||((ruby.dataset.locked!=='true'&&shown(ruby))&&!Object.hasOwn(state().objects,id))}).length;
  if(Object.keys(state().objects).length+required>2000){feedback={gridId,text:'Недостаточно места в проекте для девяти объектов измерений.'};sceneChanged();return}
  const alreadyPlaced=existing&&layout.centers.every((p,index)=>{const ruby=rubyById(slots[index]);return ruby&&(ruby.dataset.locked==='true'||!shown(ruby)||(Object.hasOwn(state().objects,slots[index])&&Math.hypot(parseFloat(ruby.style.left)+storedDimension(ruby,'width',32)/2-p.x,parseFloat(ruby.style.top)+storedDimension(ruby,'height',32)/2-p.y)<.01))});
  if(alreadyPlaced){feedback={gridId,text:(skippedCount?'Скрытые или зафиксированные пропущены: '+skippedCount+'. ':'')+'Остальные рубины уже по центрам. Подсетка скрывается отдельно.'};sceneChanged();return}
  const before=collect({includePlanData:false}),previousHistory=[...historyStack],previousRedo=[...redoStack],original=sel,originalType=selType,originalId=original?.dataset.measurementId;
  const previousNodes=[...canvas.childNodes],previousAttributes=[...canvas.querySelectorAll('*')].map(node=>[node,[...node.attributes].map(attribute=>[attribute.name,attribute.value])]);
  const previousGroups=structuredClone(correctionGroups),previousCounters=[gridCounter,labelCounter,footnoteCounter,stickerCounter,axisCounter,overlayCounter,purushaCounter,correctionCounter,captionGroupCounter];
  let created=0,moved=0,skipped=0;
  pushHistory(JSON.stringify(before));
  try{
   if(!safeGridId(gridId)){
    const oldId=gridId;gridId=allocateGridId();grid.dataset.gridId=gridId;
    canvas.querySelectorAll('.axis-group').forEach(axis=>{if(axis.dataset.targetGridId===oldId)axis.dataset.targetGridId=gridId});
   }
   const group=groupFor(gridId)||(state().brahmasthans[gridId]={visible:true,rubies:Array(9).fill('')});
   layout.centers.forEach((p,index)=>{
    let ruby=rubyById(group.rubies[index]);
    if(ruby&&(ruby.dataset.locked==='true'||!shown(ruby))){skipped++;return}
    if(!ruby){
     ruby=addCorrection('stones','ruby',{left:p.x-size/2,top:p.y-size/2,width:size,height:size,caption:'Рубин '+(index+1),showCaption:false});
     if(!ruby)throw new Error('Не удалось создать рубин');
     group.rubies[index]=ensureMeasurementObjectId(ruby);created++;
    }else{
     ruby.style.left=(p.x-storedDimension(ruby,'width',32)/2)+'px';ruby.style.top=(p.y-storedDimension(ruby,'height',32)/2)+'px';updateCorrectionCaptionPosition(ruby);moved++;
    }
    const id=ensureMeasurementObjectId(ruby);
    if(!Object.hasOwn(state().objects,id))state().objects[id]={visible:true,gridId,targetId:'',label:''};
   });
   feedback={gridId,text:(created?'Добавлено: '+created+'. ':'')+(moved?'По центрам: '+moved+'. ':'')+(skipped?'Скрытые или зафиксированные пропущены: '+skipped+'. ':'')+'Подсетка и рубины скрываются отдельно.'};
  }catch(error){
   // Restore the original nodes directly: a failing constructor must not run again.
   canvas.replaceChildren(...previousNodes);
   previousAttributes.forEach(([node,attributes])=>{[...node.attributes].forEach(attribute=>node.removeAttribute(attribute.name));attributes.forEach(([name,value])=>node.setAttribute(name,value))});
   S.replace(before.measurements);correctionGroups=previousGroups;
   [gridCounter,labelCounter,footnoteCounter,stickerCounter,axisCounter,overlayCounter,purushaCounter,correctionCounter,captionGroupCounter]=previousCounters;
   historyStack=previousHistory;redoStack=previousRedo;cancelAutosave();
   gridId=grid.dataset.gridId;feedback={gridId,text:'Не удалось расставить рубины. Проект восстановлен.'};
  }
  restoreSelection(original,originalType,originalId);refreshLayers();scheduleAutosave();notifyMeasurementSceneChanged();
 }
 ui.nineRubiesBtn.addEventListener('click',placeNineRubies);
 ui.brahmasthanGridVisible.addEventListener('change',()=>{
  const grid=contextGrid(),group=grid&&groupFor(grid.dataset.gridId);if(!group)return;
  pushHistory();group.visible=ui.brahmasthanGridVisible.checked;feedback=null;scheduleAutosave();notifyMeasurementSceneChanged();
 });
 new MutationObserver(records=>{if(records.some(r=>r.target.matches?.('.vastu-grid')||r.target.closest?.('.vastu-grid')||(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(node=>node.matches?.('.vastu-grid')))))sceneChanged()}).observe(canvas,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','data-visible','data-rot']});
 window.VastuBrahmasthan={sceneChanged,gridForSelection,placeNineRubies,exportSVG:project=>guideSVG(guideRecords(project)),exportBounds:project=>guideRecords(project).flatMap(({layout})=>layout.outline.flatMap(line=>[line.a,line.b]))};
 sceneChanged();
})();
