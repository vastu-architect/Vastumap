/* Measurements use plan coordinates before rotation, in canvas pixels around (800, 600). */
(function(global){
 "use strict";
 const BAD_KEYS=new Set(["__proto__","prototype","constructor"]);
 const MAX_COORD=1000000,MAX_LENGTH_CM=1000000,MAX_WALLS=500,MAX_OBJECTS=2000,MAX_BRAHMASTHANS=200;
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 function fail(path,message){throw new Error("Измерения: поле «"+path+"» — "+message+".")}
 function safeTree(value,path="measurements",seen=new Set(),depth=0){
  if(!value||typeof value!=="object")return;
  if(depth>32||seen.has(value))fail(path,"недопустимая вложенность данных");
  const proto=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&proto!==null&&Object.getPrototypeOf(proto)!==null)fail(path,"ожидается обычный объект");
  seen.add(value);
  Object.keys(value).forEach(key=>{
   if(BAD_KEYS.has(key))fail(path+"."+key,"недопустимое имя поля");
   safeTree(value[key],path+"."+key,seen,depth+1);
  });
  seen.delete(value);
 }
 function record(value,path){
  if(!value||typeof value!=="object"||Array.isArray(value))fail(path,"ожидается объект");
  return value;
 }
 function number(value,path,{min=-Infinity,max=Infinity,positive=false,integer=false}={}){
  if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max||(positive&&value<=0)||(integer&&!Number.isInteger(value)))fail(path,"недопустимое число");
  return value;
 }
 function text(value,path,max=500){
  if(typeof value!=="string"||value.length>max||/[\u0000-\u001f]/.test(value))fail(path,"недопустимый текст");
  return value;
 }
 function id(value,path,{empty=false}={}){
  const result=text(value,path,128);
  if((!result&&empty))return result;
  if(!/^[a-z0-9][a-z0-9_.:-]*$/i.test(result)||BAD_KEYS.has(result))fail(path,"недопустимый идентификатор");
  return result;
 }
 function bool(value,path){if(typeof value!=="boolean")fail(path,"ожидается логическое значение");return value}
 function point(value,path){
  const p=record(value,path);
  return{x:number(p.x,path+".x",{min:-MAX_COORD,max:MAX_COORD}),y:number(p.y,path+".y",{min:-MAX_COORD,max:MAX_COORD})};
 }
 function endpoints(value,path){
  const a=point(value.a,path+".a"),b=point(value.b,path+".b");
  if(Math.hypot(a.x-b.x,a.y-b.y)<0.000001)fail(path,"начальная и конечная точки должны различаться");
  return{a,b};
 }
 function defaults(){
  return{version:1,calibration:null,walls:[],objects:{},brahmasthans:{},visible:true,showWalls:true,showObjects:true,showSectors:true,showCenter:false,showLabels:false,showGrid:false,gridStepCm:25,export:false,activeGridId:""};
 }
 function normalize(data){
  if(data===undefined)return defaults();
  safeTree(data);
  const source=record(data,"measurements"),result=defaults();
  if(own(source,"version")&&source.version!==1)fail("version","версия измерений не поддерживается");
  if(own(source,"calibration")&&source.calibration!==null){
   const calibration=record(source.calibration,"calibration");
   result.calibration={...endpoints(calibration,"calibration"),lengthCm:number(calibration.lengthCm,"calibration.lengthCm",{positive:true,max:MAX_LENGTH_CM})};
  }
  if(own(source,"walls")){
   if(!Array.isArray(source.walls)||source.walls.length>MAX_WALLS)fail("walls","ожидается список не более "+MAX_WALLS+" стен");
   const ids=new Set();
   result.walls=source.walls.map((wall,index)=>{
    const path="walls["+index+"]",entry=record(wall,path),wallId=id(entry.id,path+".id");
    if(ids.has(wallId))fail(path+".id","идентификатор стены повторяется");
    ids.add(wallId);
    return{id:wallId,name:own(entry,"name")?text(entry.name,path+".name"):"",...endpoints(entry,path),visible:own(entry,"visible")?bool(entry.visible,path+".visible"):true,actualCm:own(entry,"actualCm")&&entry.actualCm!==null?number(entry.actualCm,path+".actualCm",{positive:true,max:MAX_LENGTH_CM}):null};
   });
  }
  if(own(source,"objects")){
   const objects=record(source.objects,"objects"),entries=Object.entries(objects);
   if(entries.length>MAX_OBJECTS)fail("objects","слишком много объектов измерений");
   entries.forEach(([key,value])=>{
    const path="objects."+key,objectId=id(key,path),entry=record(value,path);
    result.objects[objectId]={visible:own(entry,"visible")?bool(entry.visible,path+".visible"):true,gridId:own(entry,"gridId")?id(entry.gridId,path+".gridId",{empty:true}):"",targetId:own(entry,"targetId")?id(entry.targetId,path+".targetId",{empty:true}):"",label:own(entry,"label")?text(entry.label,path+".label"):""};
   });
  }
  if(own(source,"brahmasthans")){
   const groups=record(source.brahmasthans,"brahmasthans"),entries=Object.entries(groups),rubyIds=new Set();
   if(entries.length>MAX_BRAHMASTHANS)fail("brahmasthans","слишком много сеток Брахмастана");
   entries.forEach(([key,value])=>{
    const path="brahmasthans."+key,gridId=id(key,path),entry=record(value,path);
    if(!Array.isArray(entry.rubies)||entry.rubies.length!==9)fail(path+".rubies","ожидается список из девяти мест для рубинов");
    const rubies=Array.from(entry.rubies,(ruby,index)=>{
     const rubyId=id(ruby,path+".rubies["+index+"]",{empty:true});
     if(rubyId&&rubyIds.has(rubyId))fail(path+".rubies["+index+"]","идентификатор рубина повторяется");
     if(rubyId)rubyIds.add(rubyId);
     return rubyId;
    });
    result.brahmasthans[gridId]={visible:own(entry,"visible")?bool(entry.visible,path+".visible"):true,rubies};
   });
  }
  ["visible","showWalls","showObjects","showSectors","showCenter","showLabels","showGrid","export"].forEach(key=>{if(own(source,key))result[key]=bool(source[key],key)});
  if(own(source,"gridStepCm"))result.gridStepCm=number(source.gridStepCm,"gridStepCm",{positive:true,max:MAX_LENGTH_CM});
  if(own(source,"activeGridId"))result.activeGridId=id(source.activeGridId,"activeGridId",{empty:true});
  return result;
 }
 let current=defaults();
 global.MeasurementState={defaults,normalize,get:()=>current,replace(data){const next=normalize(data);current=next;return current},serialize:()=>structuredClone(current)};
})(window);
