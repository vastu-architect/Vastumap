/* Rooms organize wall lists; object wall choices are measurement preferences, never constraints. */
(function(){
 'use strict';
 const S=window.MeasurementState;
 const ids=['roomAddBtn','roomCreateRow','roomNameInput','roomCreateBtn','roomCreateCancelBtn','wallRoomTarget','wallRoomTargetRow','objectWallTargets','objectWallSummary','objectWallChoices','objectWallsClearBtn','objectWallsAllBtn'];
 const ui=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
 let bridge=null,choiceSignature='',choiceState=null;
 const state=()=>S.get(),rooms=()=>state().rooms||[];
 const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
 function roomFor(id){return rooms().find(room=>room.id===id)||null}
 function selectedIds(meta){return Array.isArray(meta?.wallIds)?meta.wallIds:[]}
 function selectedWalls(meta){const ids=new Set(selectedIds(meta));return state().walls.filter(wall=>ids.has(wall.id))}
 function roomOptions(select,value){
  const signature=JSON.stringify(rooms().map(room=>[room.id,room.name]));
  if(select.dataset.roomOptions!==signature){
   select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Без комнаты';select.appendChild(empty);
   rooms().forEach(room=>{const option=document.createElement('option');option.value=room.id;option.textContent=room.name;select.appendChild(option)});
   select.dataset.roomOptions=signature;
  }
  const missing=[...select.options].find(option=>option.dataset.missingRoom);if(missing)missing.remove();
  if(value&&!roomFor(value)){const option=document.createElement('option');option.value=value;option.textContent='Комната удалена';option.dataset.missingRoom='true';select.appendChild(option)}
  select.value=value||'';
 }
 function notify(message){bridge?.message(message)}
 function validName(value){return typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\u0000-\u001f]/.test(value)}
 function createRoom(){
  if(!bridge)return;
  const name=ui.roomNameInput.value.trim();if(!validName(name)){notify('Введите название комнаты, не более 160 символов.');ui.roomNameInput.focus();return}
  if(rooms().length>=100){notify('В проекте уже 100 комнат.');return}
  const used=new Set([...rooms().map(room=>room.id),state().activeRoomId,...state().walls.map(wall=>wall.roomId)]);let index=1;while(used.has('room-'+index))index++;
  const id='room-'+index;
  bridge.changed(()=>{state().rooms.push({id,name,collapsed:false});state().activeRoomId=id});
  ui.roomNameInput.value='';ui.roomCreateRow.hidden=true;notify('Комната добавлена. Новые стены будут отнесены к ней.');
 }
 function appendWallRoomField(container,wall){
  const label=document.createElement('label');label.textContent='Комната';
  const select=document.createElement('select');select.dataset.wallRoom=wall.id;select.setAttribute('aria-label','Комната стены '+wall.name);roomOptions(select,wall.roomId);
  select.onchange=()=>{const next=select.value;if(next&&!roomFor(next)){roomOptions(select,wall.roomId);return}bridge.changed(()=>wall.roomId=next)};
  label.appendChild(select);container.appendChild(label);
 }
 function renderWalls(container,renderWallRow){
  const s=state(),known=new Set(rooms().map(room=>room.id));
  rooms().forEach(room=>{
   const list=s.walls.filter(wall=>wall.roomId===room.id),details=document.createElement('details');details.className='measurement-room';details.dataset.roomId=room.id;details.open=!room.collapsed;
   const summary=document.createElement('summary');summary.textContent=room.name+(list.length?' · '+list.length:'');details.appendChild(summary);
   const header=document.createElement('div');header.className='measurement-room-tools';
   const name=document.createElement('input');name.value=room.name;name.maxLength=160;name.dataset.roomName=room.id;name.setAttribute('aria-label','Название комнаты '+room.name);
   name.onchange=()=>{const value=name.value.trim();if(!validName(value)){name.value=room.name;notify('Введите название комнаты, не более 160 символов.');return}if(value!==room.name)bridge.changed(()=>room.name=value)};
   const remove=document.createElement('button');remove.type='button';remove.dataset.roomRemove=room.id;remove.textContent='Разгруппировать';remove.title='Оставить стены без комнаты';
   remove.onclick=()=>bridge.changed(()=>{state().walls.forEach(wall=>{if(wall.roomId===room.id)wall.roomId=''});state().rooms=rooms().filter(entry=>entry.id!==room.id);if(state().activeRoomId===room.id)state().activeRoomId=''});
   header.append(name,remove);details.appendChild(header);
   if(!list.length){const hint=document.createElement('p');hint.className='hint';hint.textContent='Выберите комнату в свойствах существующей стены или добавьте новые стены.';details.appendChild(hint)}
   list.forEach(wall=>details.appendChild(renderWallRow(wall,s.walls.indexOf(wall))));
   details.addEventListener('toggle',()=>{
    if(!details.isConnected||state()!==s||roomFor(room.id)!==room)return;
    const collapsed=!details.open;if(collapsed!==room.collapsed)bridge.changed(()=>room.collapsed=collapsed);
   });
   container.appendChild(details);
  });
  const unassigned=s.walls.filter(wall=>!wall.roomId||!known.has(wall.roomId));
  if(unassigned.length&&rooms().length){const heading=document.createElement('h4');heading.className='measurement-unassigned-title';heading.textContent='Без комнаты';container.appendChild(heading)}
  unassigned.forEach(wall=>container.appendChild(renderWallRow(wall,s.walls.indexOf(wall))));
 }
 function applyWallIds(el,ids){
  if(!el||el!==bridge.selected()||!el.isConnected)return;
  const unique=[...new Set(ids)],id=ensureMeasurementObjectId(el),s=state();
  if(!own(s.objects,id)&&Object.keys(s.objects).length>=2000){notify('В проекте слишком много настроек объектов.');return}
  try{S.normalize({...s,objects:{...s.objects,[id]:{...bridge.meta(el),wallIds:unique}}})}catch(error){notify('Не удалось сохранить выбор стен для этого объекта.');return}
  const before=selectedIds(bridge.meta(el));if(before.length===unique.length&&before.every(value=>unique.includes(value)))return;
  bridge.changed(()=>bridge.editMeta(el).wallIds=unique);
 }
 function renderObjectChoices(){
  const el=bridge.selected(),s=state();ui.objectWallTargets.hidden=!el;
  if(!el){ui.objectWallSummary.textContent='Не выбраны';ui.objectWallChoices.replaceChildren();choiceSignature='';choiceState=s;return}
  const ids=selectedIds(bridge.meta(el)),available=selectedWalls(bridge.meta(el)),missing=ids.length-available.length;
  ui.objectWallSummary.textContent=ids.length?'Выбрано стен: '+available.length+(missing?' · удалённых: '+missing:''):'Не выбраны';
  ui.objectWallsClearBtn.disabled=!ids.length;ui.objectWallsAllBtn.disabled=!s.walls.length;
  const signature=JSON.stringify([ensureMeasurementObjectId(el),ids,s.walls.map(wall=>[wall.id,wall.name,wall.roomId,wall.visible]),rooms().map(room=>[room.id,room.name])]);
  if(signature===choiceSignature&&choiceState===s)return;choiceSignature=signature;choiceState=s;ui.objectWallChoices.replaceChildren();
  if(!s.walls.length){const hint=document.createElement('p');hint.className='hint';hint.textContent='Сначала отметьте стены на плане.';ui.objectWallChoices.appendChild(hint);return}
  const selected=new Set(ids),known=new Set(rooms().map(room=>room.id));
  const groups=rooms().map(room=>({id:room.id,name:room.name,walls:s.walls.filter(wall=>wall.roomId===room.id)}));
  groups.push({id:'',name:'Без комнаты',walls:s.walls.filter(wall=>!wall.roomId||!known.has(wall.roomId))});
  groups.filter(group=>group.walls.length).forEach(group=>{
   const fieldset=document.createElement('div');fieldset.className='object-wall-room';fieldset.setAttribute('role','group');fieldset.setAttribute('aria-label',group.name);
   const label=document.createElement('label');label.className='wall-choice-group';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.roomTarget=group.id;
   const checked=group.walls.filter(wall=>selected.has(wall.id)).length;checkbox.checked=checked===group.walls.length;checkbox.indeterminate=checked>0&&!checkbox.checked;
   checkbox.onchange=()=>{const current=selectedIds(bridge.meta(el)),groupIds=new Set(group.walls.map(wall=>wall.id));applyWallIds(el,checkbox.checked?[...current,...groupIds]:current.filter(id=>!groupIds.has(id)))};
   label.append(checkbox,document.createTextNode(group.name));fieldset.appendChild(label);
   group.walls.forEach(wall=>{
    const label=document.createElement('label');label.className='object-wall-choice';const input=document.createElement('input');input.type='checkbox';input.dataset.wallTarget=wall.id;input.checked=selected.has(wall.id);
    input.onchange=()=>{const current=selectedIds(bridge.meta(el));applyWallIds(el,input.checked?[...current,wall.id]:current.filter(id=>id!==wall.id))};
    label.append(input,document.createTextNode(wall.name+(wall.visible?'':' — скрыта')));fieldset.appendChild(label);
   });
   ui.objectWallChoices.appendChild(fieldset);
  });
  if(missing){const hint=document.createElement('p');hint.className='hint';hint.textContent='Часть выбранных стен удалена. «Очистить» уберёт все связи.';ui.objectWallChoices.appendChild(hint)}
 }
 function syncControls(){
  if(!bridge)return;
  ui.wallRoomTargetRow.hidden=!rooms().length;roomOptions(ui.wallRoomTarget,state().activeRoomId);ui.roomAddBtn.disabled=rooms().length>=100;renderObjectChoices();
 }
 function attach(context){
  bridge=context;
  ui.roomAddBtn.addEventListener('click',()=>{ui.roomCreateRow.hidden=false;ui.roomNameInput.focus()});
  ui.roomCreateBtn.addEventListener('click',createRoom);ui.roomCreateCancelBtn.addEventListener('click',()=>{ui.roomCreateRow.hidden=true;ui.roomNameInput.value=''});
  ui.roomNameInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createRoom()}else if(event.key==='Escape'){ui.roomCreateRow.hidden=true;ui.roomNameInput.value=''}});
  ui.wallRoomTarget.addEventListener('change',()=>{const value=ui.wallRoomTarget.value;if(value&&!roomFor(value))return;if(value!==state().activeRoomId)bridge.changed(()=>state().activeRoomId=value)});
  ui.objectWallsClearBtn.addEventListener('click',()=>applyWallIds(bridge.selected(),[]));
  ui.objectWallsAllBtn.addEventListener('click',()=>applyWallIds(bridge.selected(),state().walls.map(wall=>wall.id)));
  syncControls();
 }
 window.VastuRooms={attach,syncControls,renderWalls,appendWallRoomField,selectedWallIds:selectedIds,selectedWalls,
  deleteWall(id){state().walls=state().walls.filter(wall=>wall.id!==id);Object.values(state().objects).forEach(meta=>{if(Array.isArray(meta.wallIds))meta.wallIds=meta.wallIds.filter(value=>value!==id)})},
  allocateWallId(){const used=new Set(state().walls.map(wall=>wall.id));Object.values(state().objects).forEach(meta=>selectedIds(meta).forEach(id=>used.add(id)));let index=1;while(used.has('wall-'+index))index++;return'wall-'+index},
  activeRoomId(){return roomFor(state().activeRoomId)?state().activeRoomId:''}
 };
})();
