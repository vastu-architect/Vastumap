/* Readouts only: this module never moves or centers scene objects. */
(function(){
 'use strict';
 const G=window.MeasurementGeometry,S=window.MeasurementState,W=window.VastuWallTools,NS='http://www.w3.org/2000/svg',ORIGIN={x:800,y:600};
 const ids=['measurementTools','measurementToggleBtn','measureVisible','measureScaleStatus','scaleDrawBtn','scaleLengthRow','scaleLengthCm','calibrationApplyBtn','scaleResetBtn','measureInstruction','measurementCancelBtn','wallDrawBtn','measurementWalls','measureShowWalls','metricGridVisible','metricGridStep','metricGridStepRow','metricGridStatus','measureExport','objectMeasurements','objectMeasureVisible','objectMeasureGrid','objectGridRow','measureShowCenter','measurementTarget','measurementReadouts','measureShowLabels','placementStrip','placementReadout','transformModeBtn','measureShowSectors','measurementSectorStatus'];
 const ui=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
 const SELECTOR='.vastu-grid,.purusha-grid,.axis-group,.overlay-wrap,.correction-object,.text-label,.footnote,.sticker';
 function svgElement(id,className){const node=document.createElementNS(NS,'svg');node.id=id;node.classList.add(className);node.setAttribute('viewBox','0 0 1600 1200');node.setAttribute('aria-hidden','true');canvas.appendChild(node);return node}
 const metricSvg=svgElement('metricGridOverlay','measurement-metric-grid'),svg=svgElement('measurementOverlay','measurement-overlay');
 const textContext=document.createElement('canvas').getContext('2d');textContext.font='12px Arial,sans-serif';
 const textWidth=text=>Math.max(40,Math.ceil(textContext.measureText(String(text)).width)+12);
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const state=()=>S.get(),angle=()=>Number(plan.dataset.rotation)||0;
 const toPlan=p=>G.rotate(p,ORIGIN,-angle()),toCanvas=p=>G.rotate(p,ORIGIN,angle());
 const number=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Math.abs(value)<.05?0:value);
 const cm=value=>number(value)+' см',snapshots=new WeakMap();
 let frame=0,drawing=null,draft=null,interactionState=null,hover=null,suppressClickUntil=0,wallSignature='',wallState=null,gridCache=null,renderedGridKey='';
 function screenPoint(event){const p=event.touches?event.touches[0]:event,r=canvas.getBoundingClientRect();return{x:(p.clientX-r.left)/(r.width/canvas.offsetWidth)-canvas.clientLeft,y:(p.clientY-r.top)/(r.height/canvas.offsetHeight)-canvas.clientTop}}
 function visible(el){return !!(el&&el.isConnected&&el.getClientRects().length&&getComputedStyle(el).display!=='none')}
 function objects(){return [...canvas.querySelectorAll(SELECTOR)]}
 function objectId(el){return ensureMeasurementObjectId(el)}
 function selected(){return sel&&sel!==plan&&sel.matches(SELECTOR)?sel:null}
 function center(el){const r=el.getBoundingClientRect();return screenPoint({clientX:r.left+r.width/2,clientY:r.top+r.height/2})}
 function meta(el){const id=objectId(el);return Object.hasOwn(state().objects,id)?state().objects[id]:{visible:true,gridId:'',targetId:'',label:''}}
 function editMeta(el){const id=objectId(el);if(!Object.hasOwn(state().objects,id))state().objects[id]={...meta(el)};return state().objects[id]}
 function objectName(el,index=0){
  const m=meta(el);if(m.label)return m.label;
  if(el.matches('.correction-object'))return el.dataset.caption||'Объект '+(index+1);
  if(el.matches('.text-label'))return el.textContent.trim().slice(0,40)||'Надпись';
  if(el.matches('.footnote'))return el.dataset.title||'Сноска';
  if(el.matches('.vastu-grid'))return 'Сетка '+([...canvas.querySelectorAll('.vastu-grid')].indexOf(el)+1);
  if(el.matches('.overlay-wrap'))return 'Картинка '+(index+1);
  if(el.matches('.purusha-grid'))return 'Пуруша-мандала';
  if(el.matches('.axis-group'))return 'Оси';return 'Метка '+(index+1);
 }
 function factor(){const c=state().calibration;return c?c.lengthCm/G.distance(c.a,c.b):null}
 function rect(el){return{left:parseFloat(el.style.left)||0,top:parseFloat(el.style.top)||0,width:parseFloat(el.style.width)||el.offsetWidth,height:parseFloat(el.style.height)||el.offsetHeight,rotation:Number(el.dataset.rot??el.dataset.rotation)||0}}
 function referenceGrid(el){
  if(el.matches('.vastu-grid'))return el;
  const all=[...canvas.querySelectorAll('.vastu-grid')],id=meta(el).gridId||state().activeGridId;
  if(id)return all.find(g=>g.dataset.gridId===id)||null;
  const shown=all.filter(visible),p=center(el),containing=shown.filter(g=>G.sectorAt(rect(g),p));
  if(containing.length)return containing.length===1?containing[0]:null;
  return shown.length===1?shown[0]:null;
 }
 function sectorInfo(el,p){
  const grid=referenceGrid(el);if(!grid||!visible(grid))return{grid:null,sector:null};
  return{grid,sector:G.sectorAt(rect(grid),p)};
 }
 function sectorName(info){return info.sector?(info.grid.querySelectorAll('.cell input')[info.sector.index]?.value||'Сектор '+(info.sector.index+1)):''}

 function message(text){ui.measureInstruction.textContent=text}
 function sceneChanged(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!isRestoring)render()})}
 function changed(action){pushHistory();action();scheduleAutosave();sceneChanged()}
 function optionList(select,items,value,empty){
  const signature=JSON.stringify(items);
  if(select.dataset.options!==signature){select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=empty;select.appendChild(first);items.forEach(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=label;select.appendChild(o)});select.dataset.options=signature}
  select.value=value;
 }
 function syncControls(){
  const s=state(),el=selected(),enabled=s.showSectors||s.calibration||s.walls.length||Object.keys(s.objects).length||ui.measurementTools.open;
  [['measureVisible','visible'],['measureShowWalls','showWalls'],['metricGridVisible','showGrid'],['measureExport','export'],['measureShowCenter','showCenter'],['measureShowLabels','showLabels'],['measureShowSectors','showSectors']].forEach(([id,key])=>ui[id].checked=s[key]);
  ui.measureScaleStatus.textContent=s.calibration?'Масштаб задан: отрезок '+cm(s.calibration.lengthCm):'Масштаб не задан';
  ui.scaleDrawBtn.textContent=s.calibration?'Изменить масштаб':'Отметить известную длину';
  ui.scaleResetBtn.hidden=!s.calibration;ui.scaleLengthRow.hidden=!draft;ui.measurementCancelBtn.hidden=!drawing&&!draft;ui.calibrationApplyBtn.disabled=!draft;
  ui.metricGridStepRow.hidden=!s.showGrid;if(document.activeElement!==ui.metricGridStep)ui.metricGridStep.value=s.gridStepCm;
  ui.measurementToggleBtn.setAttribute('aria-expanded',String(ui.measurementTools.open));
  ui.objectMeasurements.hidden=!el||!enabled;if(!el)return;
  const m=meta(el);ui.objectMeasureVisible.checked=m.visible;ui.objectGridRow.hidden=el.matches('.vastu-grid')||(!s.showCenter&&!s.showSectors);
  const targets=objects().filter(o=>o!==el&&visible(o)).map((o,i)=>[objectId(o),objectName(o,i)]);
  if(m.targetId&&!targets.some(([id])=>id===m.targetId))targets.push([m.targetId,'Объект скрыт или удалён']);
  optionList(ui.measurementTarget,targets,m.targetId,'Не измерять');
  const grids=[...canvas.querySelectorAll('.vastu-grid')],items=grids.map((g,i)=>[g.dataset.gridId,'Сетка '+(i+1)+(visible(g)?'':' — скрыта')]);
  const id=m.gridId||s.activeGridId;if(id&&!grids.some(g=>g.dataset.gridId===id))items.push([id,'Сетка удалена']);
  optionList(ui.objectMeasureGrid,items,id,'Авто по положению объекта');
 }
 function renderWalls(){
  const s=state(),signature=JSON.stringify([s.walls,s.calibration,s.visible,s.showWalls,W.selectedWallId()]);if(signature===wallSignature&&wallState===s)return;
  const openWalls=new Set([...ui.measurementWalls.querySelectorAll('.measurement-wall-extra[open]')].map(node=>node.closest('[data-wall-id]').dataset.wallId));
  wallSignature=signature;wallState=s;ui.measurementWalls.replaceChildren();
  if(!s.walls.length){const p=document.createElement('p');p.className='hint';p.textContent='Отметьте две точки внутренней стороны нужной стены.';ui.measurementWalls.appendChild(p)}
  s.walls.forEach((wall,index)=>{
   const row=document.createElement('div');row.className='measurement-wall'+(wall.visible?'':' is-hidden');row.dataset.wallId=wall.id;row.classList.toggle('is-selected',W.selectedWallId()===wall.id);
   const controls=document.createElement('div');controls.className='measurement-wall-row';
   const name=document.createElement('input');name.value=wall.name;name.maxLength=160;name.setAttribute('aria-label','Название стены '+(index+1));name.onchange=()=>changed(()=>wall.name=name.value.trim()||'Стена '+(index+1));
   const eye=document.createElement('button');eye.type='button';eye.textContent=wall.visible?'◉':'○';eye.setAttribute('aria-label',(wall.visible?'Скрыть ':'Показать ')+wall.name);eye.onclick=()=>changed(()=>wall.visible=!wall.visible);
   const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Удалить '+wall.name);remove.onclick=()=>changed(()=>state().walls=state().walls.filter(w=>w.id!==wall.id));controls.append(name,eye,remove);row.appendChild(controls);
   const editOnPlan=document.createElement('button');editOnPlan.type='button';editOnPlan.className='measurement-text-action';editOnPlan.dataset.editWall=wall.id;editOnPlan.textContent='Править на плане';editOnPlan.onclick=()=>W.selectWall(wall.id);editOnPlan.disabled=!wall.visible||!s.visible||!s.showWalls;row.appendChild(editOnPlan);
   const extra=document.createElement('details');extra.className='measurement-wall-extra';extra.open=openWalls.has(wall.id);const summary=document.createElement('summary');summary.textContent='Размер и правка';extra.appendChild(summary);
   const label=document.createElement('label');label.textContent='Контрольный замер, см';const actual=document.createElement('input');actual.inputMode='decimal';actual.value=wall.actualCm??'';actual.placeholder='Необязательно';actual.dataset.actualCm=wall.id;actual.setAttribute('aria-label','Контрольная длина '+wall.name);
   actual.onchange=()=>{const raw=actual.value.trim(),value=raw?Number(raw.replace(',','.')):null;if(value!==null&&(!Number.isFinite(value)||value<=0||value>1000000)){actual.value=wall.actualCm??'';message('Введите положительную длину в сантиметрах.');return}changed(()=>wall.actualCm=value)};label.appendChild(actual);extra.appendChild(label);
   if(wall.actualCm){const use=document.createElement('button');use.type='button';use.className='measurement-text-action';use.textContent='Взять за основу масштаба';use.onclick=()=>changed(()=>state().calibration={a:{...wall.a},b:{...wall.b},lengthCm:wall.actualCm});extra.appendChild(use)}
   const edit=document.createElement('button');edit.type='button';edit.className='measurement-text-action';edit.textContent='Переотметить стену';edit.onclick=()=>startDrawing('wall',wall.id);extra.appendChild(edit);row.appendChild(extra);
   const scale=factor(),length=document.createElement('small');
   if(scale){const predicted=G.distance(wall.a,wall.b)*scale;length.textContent='По плану '+cm(predicted);if(wall.actualCm){const difference=predicted-wall.actualCm;length.textContent+='; замер '+cm(wall.actualCm)+'; разница '+cm(difference);length.dataset.differenceCm=difference;if(Math.abs(difference)/wall.actualCm>.02){length.classList.add('measurement-warning');length.textContent+='. Проверьте план и замер.'}}}
   else length.textContent='Задайте масштаб для размеров в сантиметрах';row.appendChild(length);ui.measurementWalls.appendChild(row);
  });
 }
 function startDrawing(type,editId=''){
  if(!planData||!plan.complete||!plan.naturalWidth){ui.measurementTools.open=true;message('Сначала загрузите план квартиры.');return}
  if(type==='wall'&&!editId&&state().walls.length>=500){message('В проекте уже 500 стен.');return}
  W.beginDrawing(type);drawing={type,editId,points:[]};draft=null;interactionState=state();hover=null;ui.measurementTools.open=true;canvas.classList.add('measurement-drawing');
  message(type==='scale'?'Отметьте начало и конец отрезка известной длины.':type==='direction'?'Отметьте две точки вдоль прямой стены. Она задаст направление новых стен.':'Отметьте начало и конец внутренней стороны стены.');sceneChanged();
 }
 function cancelDrawing(clear=true){W.cancelDrawing();drawing=null;draft=null;interactionState=null;hover=null;canvas.classList.remove('measurement-drawing');if(clear)message('');sceneChanged()}
 function takePoint(event){
  if(!drawing)return;event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=performance.now()+500;const raw=toPlan(screenPoint(event)),p=drawing.type==='wall'?W.constrainDrawingPoint(drawing.points[0]||null,raw,drawing.editId):raw;
  if(!drawing.points.length){drawing.points.push(p);message('Теперь отметьте вторую точку.');sceneChanged();return}
  const a=drawing.points[0],b=p;if(G.distance(a,b)<2){message('Отметьте вторую точку дальше от первой.');return}
  if(drawing.type==='scale'){draft={a,b};drawing=null;hover=null;canvas.classList.remove('measurement-drawing');ui.scaleLengthRow.hidden=false;message('Введите реальную длину в сантиметрах.');sceneChanged();ui.scaleLengthCm.focus();return}
  if(drawing.type==='direction'){W.setBaseDirection(a,b);cancelDrawing(false);message('Направление стен задано. Существующие стены не изменены.');return}
  if(!W.validWall({a,b})){message('Отметьте допустимые точки стены.');return}
  const id=drawing.editId;let selectedId=id;
  changed(()=>{const old=state().walls.find(w=>w.id===id);if(old){old.a=a;old.b=b}else{let n=1;while(state().walls.some(w=>w.id==='wall-'+n))n++;selectedId='wall-'+n;state().walls.push({id:selectedId,name:'Стена '+n,a,b,visible:true,actualCm:null})}state().visible=true;state().showWalls=true});
  cancelDrawing(false);W.selectWall(selectedId);message(id?'Стена переотмечена.':'Стена добавлена. Концы можно уточнить на плане.');
 }
 function readings(){
  const s=state(),el=selected(),scale=factor();if(!el||!visible(el))return{el,point:null,rows:[],centerInfo:null,sectorInfo:null};
  const p=center(el),m=meta(el),rows=[],sector=s.showSectors?sectorInfo(el,p):null;let centerInfo=null;
  if(scale&&sector?.sector){const names={top:'Верхняя граница',right:'Правая граница',bottom:'Нижняя граница',left:'Левая граница'};sector.sector.edges.forEach(edge=>rows.push({kind:'sector',side:edge.side,reference:sector.grid.dataset.gridId+':sector-'+sector.sector.index,label:names[edge.side],distance:edge.distance*scale,a:p,b:edge.point}))}
  if(scale&&s.showWalls)s.walls.filter(w=>w.visible).forEach(w=>{const near=G.nearestOnSegment(p,toCanvas(w.a),toCanvas(w.b));rows.push({kind:'wall',reference:w.id,label:w.name+(near.atEndpoint?' — до угла':''),distance:near.distance*scale,a:p,b:near.point})});
  if(scale&&s.showObjects&&m.targetId){const target=objects().find(o=>objectId(o)===m.targetId&&visible(o));if(target){const q=center(target);rows.push({kind:'object',reference:m.targetId,label:'До '+objectName(target),distance:G.distance(p,q)*scale,a:p,b:q})}}
  if(scale&&s.showCenter){const grid=referenceGrid(el);if(grid&&visible(grid)){const offset=G.gridCenterOffset(rect(grid),p);centerInfo={reference:grid.dataset.gridId,dx:offset.dx*scale,dy:offset.dy*scale};rows.push({kind:'center',reference:grid.dataset.gridId,label:'До центра сетки',distance:offset.distance*scale,a:p,b:offset.center})}}
  return{el,point:p,rows,centerInfo,sectorInfo:sector,meta:m};
 }
 function readout(kind,reference,label,value,signed,side=''){return '<div class="measurement-readout" data-side="'+side+'" data-kind="'+kind+'" data-reference-id="'+escape(reference)+'" data-distance-cm="'+signed+'"><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong></div>'}
 function renderReadouts(view){
  const output=ui.measurementReadouts;
  ui.measurementSectorStatus.textContent=!state().showSectors||!view.point?'':view.sectorInfo?.sector?'Сектор: '+sectorName(view.sectorInfo):view.sectorInfo?.grid?'Объект вне васту-сетки.':'Выберите видимую сетку отсчёта. При наложении сеток укажите нужную вручную.';
  if(!view.el){output.replaceChildren();return}
  if(!visible(view.el)){output.innerHTML='<p class="hint">Объект скрыт. Покажите его в списке слоёв.</p>';return}
  if(!factor()){output.innerHTML='<p class="hint">Задайте масштаб слева, чтобы видеть расстояния в сантиметрах.</p>';return}
  let html='';const headings={sector:'До границ сектора',wall:'Отступы до стен',object:'Между центрами',center:'От центра васту-сетки'};
  Object.entries(headings).forEach(([kind,title])=>{const rows=view.rows.filter(r=>r.kind===kind);if(!rows.length)return;html+='<h4>'+title+'</h4>';rows.forEach(r=>html+=readout(kind,r.reference,r.label,cm(r.distance),r.distance,r.side));if(kind==='center'&&view.centerInfo){const c=view.centerInfo;html+=readout('center-x',c.reference,'Вдоль сетки',cm(Math.abs(c.dx))+(c.dx<-.05?' влево':' вправо'),c.dx)+readout('center-y',c.reference,'Поперёк сетки',cm(Math.abs(c.dy))+(c.dy<-.05?' вниз':' вверх'),c.dy)}});
  if(state().showCenter&&!view.centerInfo)html+='<p class="hint">Выберите видимую васту-сетку для отсчёта.</p>';
  output.innerHTML=html||'<p class="hint">Отметьте нужные стены или выберите второй объект.</p>';
 }
 function renderPlacementReadout(view){
  const rows=view.rows||[];
  ui.placementReadout.hidden=!view.point||!factor()||!rows.length;
  if(!ui.placementReadout.hidden){
   const items=rows.map(r=>({kind:r.kind,reference:r.reference,side:r.side,label:r.label,value:cm(r.distance),distance:r.distance}));
   if(view.centerInfo){const c=view.centerInfo;items.push({kind:'center-x',reference:c.reference,label:'Вдоль сетки',value:cm(Math.abs(c.dx))+(c.dx<-.05?' влево':' вправо'),distance:c.dx},{kind:'center-y',reference:c.reference,label:'Поперёк сетки',value:cm(Math.abs(c.dy))+(c.dy<-.05?' вниз':' вверх'),distance:c.dy})}
   ui.placementReadout.innerHTML='<span class="placement-readout-title">От центра:</span>'+items.map(r=>'<span class="placement-readout-item" data-side="'+(r.side||'')+'" data-kind="'+r.kind+'" data-reference-id="'+escape(r.reference)+'" data-distance-cm="'+r.distance+'"><span>'+escape(r.label)+'</span><strong>'+escape(r.value)+'</strong></span>').join('');
  }else ui.placementReadout.replaceChildren();
  ui.placementStrip.hidden=ui.transformModeBtn.hidden&&ui.placementReadout.hidden;
 }
 function line(a,b,color,width=1.5,dash='',attrs=''){return '<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="'+color+'" stroke-width="'+width+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+attrs+'/>'}
 function textAt(p,text,color='#24586a'){const width=textWidth(text);return '<g><rect x="'+(p.x-width/2)+'" y="'+(p.y-12)+'" width="'+width+'" height="21" rx="4" fill="white" fill-opacity=".94"/><text x="'+p.x+'" y="'+(p.y+3)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="'+color+'">'+escape(text)+'</text></g>'}
 function metricGrid(){
  const s=state(),scale=factor(),key=JSON.stringify([s.visible,s.showGrid,s.gridStepCm,s.calibration,angle(),Boolean(planData),plan.naturalWidth,plan.naturalHeight]);
  if(gridCache?.key===key)return gridCache;
  const data={key,svg:'',points:[],legend:null,tooDense:false};
  if(s.visible&&s.showGrid&&scale&&planData){
   const w=plan.naturalWidth||1050,h=plan.naturalHeight||780,fit=Math.min(1,1050/w,780/h),bounds={left:800-w*fit/2,top:600-h*fit/2,width:w*fit,height:h*fit};
   const layout=G.metricGrid(bounds,s.calibration.a,s.gridStepCm/scale);data.tooDense=layout.tooDense;
   layout.lines.forEach(l=>{const a=toCanvas(l.a),b=toCanvas(l.b),major=Math.abs(l.index*s.gridStepCm/100-Math.round(l.index*s.gridStepCm/100))<1e-8;data.svg+=line(a,b,'#4b8295',major?1.2:.65,'',' stroke-opacity="'+(major?'.32':'.18')+'" data-grid-axis="'+l.axis+'" data-grid-index="'+l.index+'"');data.points.push(a,b)});
   if(layout.lines.length)data.legend={point:toCanvas({x:bounds.left+90,y:bounds.top+20}),label:'Клетка: '+cm(s.gridStepCm)};
  }
  gridCache=data;return data;
 }
 function overlay(view,includeDraft,labels){
  const s=state();let out='';
  if(s.visible){
   if(s.showWalls)s.walls.filter(w=>w.visible).forEach(w=>{const shown=includeDraft?W.wallForDisplay(w):w,a=toCanvas(shown.a),b=toCanvas(shown.b);out+=line(a,b,'#35748a',3);if(labels)out+=textAt({x:(a.x+b.x)/2,y:(a.y+b.y)/2-13},w.name)});
   if(view.point&&view.meta.visible){view.rows.forEach(r=>{out+=line(r.a,r.b,r.kind==='object'?'#9c6234':r.kind==='sector'?'#69856b':'#35748a',1.5,'4 3');if(labels&&G.distance(r.a,r.b)>8)out+=textAt({x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2},cm(r.distance))});const p=view.point;if(!includeDraft)out+='<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="#a54532" stroke="white" stroke-width="1"/>'}
  }
  if(includeDraft){
   const points=draft?[draft.a,draft.b]:drawing?.points||[];
   if(points.length){
    const start=points[0],rawEnd=points[1]|| (hover?toPlan(hover):null),end=rawEnd&&drawing?.type==='wall'?W.constrainDrawingPoint(start,rawEnd,drawing.editId):rawEnd;
    const a=toCanvas(start),b=end?toCanvas(end):null;
    W.setDrawingPreview(drawing?.type==='wall'?start:null,drawing?.type==='wall'?end:null);
    out+=(b?line(a,b,'#9c6234',2,'6 4',' data-wall-draft="'+(drawing?.type==='wall'?'true':'false')+'"'):'')+'<circle cx="'+a.x+'" cy="'+a.y+'" r="5" fill="#9c6234"/>'+(b?'<circle cx="'+b.x+'" cy="'+b.y+'" r="5" fill="#9c6234"/>':'');
   }else W.setDrawingPreview(null,null);
  }
  return out;
 }
 function render(){
  if((drawing||draft)&&interactionState!==state()){drawing=null;draft=null;interactionState=null;hover=null;canvas.classList.remove('measurement-drawing');message('')}
  W.sceneChanged();syncControls();renderWalls();const view=readings(),grid=metricGrid();renderReadouts(view);renderPlacementReadout(view);svg.innerHTML=overlay(view,true,state().showLabels&&!window.VastuInteraction?.isDragging());
  if(renderedGridKey!==grid.key){metricSvg.innerHTML=grid.svg;metricSvg.dataset.stepCm=state().gridStepCm;renderedGridKey=grid.key}
  ui.metricGridStatus.textContent=!state().showGrid?'':!factor()?'Сначала задайте масштаб.':grid.tooDense?'Увеличьте размер клетки: сетка слишком частая.':'Одна клетка — '+cm(state().gridStepCm)+'. Сетка поворачивается вместе с планом.';
 }
 function captureExport(project){
  if(snapshots.has(project))return snapshots.get(project);const points=[],view=readings(),grid=metricGrid();
  if(!project.measurements?.export||!state().visible){const empty={gridSvg:'',svg:'',bounds:[]};snapshots.set(project,empty);return empty}
  const addText=(p,label)=>{const half=textWidth(label)/2;points.push({x:p.x-half-2,y:p.y-14},{x:p.x+half+2,y:p.y+12})};
  points.push(...grid.points);
  if(state().showWalls)state().walls.filter(w=>w.visible).forEach(w=>{const a=toCanvas(w.a),b=toCanvas(w.b);points.push(a,b);addText({x:(a.x+b.x)/2,y:(a.y+b.y)/2-13},w.name)});
  if(view.meta?.visible){view.rows.forEach(r=>{points.push(r.a,r.b);if(G.distance(r.a,r.b)>8)addText({x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2},cm(r.distance))});if(view.point)points.push({x:view.point.x-5,y:view.point.y-5},{x:view.point.x+5,y:view.point.y+5})}
  if(grid.legend)addText(grid.legend.point,grid.legend.label);
  const result={gridSvg:grid.svg,svg:overlay(view,false,true)+(grid.legend?textAt(grid.legend.point,grid.legend.label):''),bounds:points.flatMap(p=>[{x:p.x-3,y:p.y-3},{x:p.x+3,y:p.y+3}])};snapshots.set(project,result);return result;
 }
 ui.measurementToggleBtn.onclick=()=>{ui.measurementTools.open=!ui.measurementTools.open;sceneChanged();if(ui.measurementTools.open)ui.measurementTools.scrollIntoView({block:'nearest'})};
 ui.measurementTools.addEventListener('toggle',sceneChanged);
 ui.scaleDrawBtn.onclick=()=>startDrawing('scale');ui.wallDrawBtn.onclick=()=>startDrawing('wall');ui.measurementCancelBtn.onclick=()=>cancelDrawing();
 ui.calibrationApplyBtn.onclick=()=>{const value=Number(ui.scaleLengthCm.value.trim().replace(',','.'));if(!draft||!Number.isFinite(value)||value<=0||value>1000000){message('Введите положительную длину в сантиметрах.');return}const c={...draft,lengthCm:value};changed(()=>state().calibration=c);cancelDrawing(false);message('Масштаб задан. Отметьте стены; для проверки можно внести контрольный замер другой стены.')};
 ui.scaleResetBtn.onclick=()=>changed(()=>state().calibration=null);
 [['measureVisible','visible'],['measureShowWalls','showWalls'],['metricGridVisible','showGrid'],['measureExport','export'],['measureShowCenter','showCenter'],['measureShowLabels','showLabels'],['measureShowSectors','showSectors']].forEach(([id,key])=>ui[id].onchange=()=>changed(()=>state()[key]=ui[id].checked));
 ui.metricGridStep.onchange=()=>{const value=Number(ui.metricGridStep.value.trim().replace(',','.'));if(!Number.isFinite(value)||value<=0||value>1000000){ui.metricGridStep.value=state().gridStepCm;message('Введите положительный размер клетки в сантиметрах.');return}changed(()=>state().gridStepCm=value)};
 ui.objectMeasureVisible.onchange=()=>{const el=selected();if(el)changed(()=>editMeta(el).visible=ui.objectMeasureVisible.checked)};
 ui.measurementTarget.onchange=()=>{const el=selected();if(el)changed(()=>{editMeta(el).targetId=ui.measurementTarget.value;state().showObjects=true})};
 ui.objectMeasureGrid.onchange=()=>{const el=selected();if(el)changed(()=>{editMeta(el).gridId=ui.objectMeasureGrid.value;state().activeGridId=ui.objectMeasureGrid.value})};
 const mobileToggle=document.getElementById('mobileObjectsToggle');mobileToggle.onclick=()=>{const open=document.querySelector('.layers-panel').classList.toggle('mobile-objects-open');mobileToggle.setAttribute('aria-expanded',String(open))};
 W.attach({factor,toPlan,toCanvas,screenPoint,startDrawing,cancelDrawing,redraw:sceneChanged,isDrawing:()=>!!drawing||!!draft,toolsOpen:()=>ui.measurementTools.open});
 canvas.addEventListener('pointerdown',event=>{suppressClickUntil=0;takePoint(event)},true);
 ['mousedown','touchstart'].forEach(type=>canvas.addEventListener(type,e=>{if(drawing){e.preventDefault();e.stopImmediatePropagation()}},{capture:true,passive:false}));
 canvas.addEventListener('pointermove',e=>{if(drawing){hover=screenPoint(e);sceneChanged()}},true);
 canvas.addEventListener('click',e=>{if(drawing||performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(drawing||draft)){e.preventDefault();cancelDrawing()}},true);
 window.addEventListener('resize',()=>{centerWorkspace();sceneChanged()});plan.addEventListener('load',sceneChanged);
 new MutationObserver(records=>{if(records.some(r=>r.target!==svg&&r.target!==metricSvg&&r.target.id!=='wallEditOverlay'&&!r.target.closest?.('#wallEditOverlay')&&r.target.id!=='brahmasthanOverlay'&&!r.target.closest?.('#brahmasthanOverlay')&&!svg.contains(r.target)&&!metricSvg.contains(r.target)))sceneChanged()}).observe(canvas,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class','data-visible','data-rotation','data-rot','data-width','data-height']});
 window.VastuMeasurements={sceneChanged,captureExport,exportGridSVG:p=>captureExport(p).gridSvg,exportSVG:p=>captureExport(p).svg,exportBounds:p=>captureExport(p).bounds};sceneChanged();
})();
