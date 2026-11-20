(function(root){
 "use strict";

 // All coordinates use the same plan/scene space; display zoom is never an input.
 // Rectangles use CSS geometry: left/top before rotation around their own center.
 function finite(value,name){
  if(typeof value!=="number"||!Number.isFinite(value))throw new TypeError(name+" must be a finite number");
  return value;
 }
 function point(value,name="point"){
  if(!value||typeof value!=="object")throw new TypeError(name+" must contain x and y");
  return{x:finite(value.x,name+".x"),y:finite(value.y,name+".y")};
 }
 function rect(value){
  if(!value||typeof value!=="object")throw new TypeError("rect must be an object");
  const result={left:finite(value.left,"rect.left"),top:finite(value.top,"rect.top"),width:finite(value.width,"rect.width"),height:finite(value.height,"rect.height"),rotation:value.rotation===undefined?0:finite(value.rotation,"rect.rotation")};
  if(result.width<=0||result.height<=0)throw new RangeError("rect width and height must be positive");
  return result;
 }
 function resultPoint(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError("Geometry exceeds the supported coordinate range");
  return{x,y};
 }
 function distance(a,b){
  a=point(a,"a");b=point(b,"b");
  const length=Math.hypot(a.x-b.x,a.y-b.y);
  if(!Number.isFinite(length))throw new RangeError("Distance exceeds the supported coordinate range");
  return length;
 }
 function rotate(p,center,degrees){
  p=point(p);center=point(center,"center");finite(degrees,"degrees");
  const angle=(degrees%360)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  const dx=p.x-center.x,dy=p.y-center.y;
  return resultPoint(center.x+dx*cos-dy*sin,center.y+dx*sin+dy*cos);
 }
 function nearestOnSegment(p,a,b){
  p=point(p);a=point(a,"a");b=point(b,"b");
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length))throw new RangeError("Segment exceeds the supported coordinate range");
  if(length===0)return{point:{...a},distance:distance(p,a),t:0,atEndpoint:true};
  const ux=dx/length,uy=dy/length;
  const projection=((p.x-a.x)/length)*ux+((p.y-a.y)/length)*uy;
  if(Number.isNaN(projection))throw new RangeError("Projection exceeds the supported coordinate range");
  const t=Math.max(0,Math.min(1,projection));
  const nearest=t===0?{...a}:t===1?{...b}:resultPoint(a.x+t*dx,a.y+t*dy);
  return{point:nearest,distance:distance(p,nearest),t,atEndpoint:t===0||t===1};
 }
 // u/v are fractions of width/height. Finite values outside 0..1 allow extrapolation.
 function rectPoint(value,u,v){
  const r=rect(value);finite(u,"u");finite(v,"v");
  const center=resultPoint(r.left+r.width/2,r.top+r.height/2);
  return rotate(resultPoint(r.left+u*r.width,r.top+v*r.height),center,r.rotation);
 }
 function rectLocal(value,p){
  const r=rect(value),center=resultPoint(r.left+r.width/2,r.top+r.height/2);
  const unrotated=rotate(p,center,-r.rotation);
  return resultPoint(unrotated.x-r.left,unrotated.y-r.top);
 }
 // Offsets follow the rectangle's own axes: dx to its right, dy UP.
 // Values remain in scene pixels; calibration to centimeters belongs to the caller.
 function gridCenterOffset(value,p){
  const r=rect(value);p=point(p);
  const center=rectPoint(r,.5,.5),local=rectLocal(r,p);
  const tolerance=Number.EPSILON*16*Math.max(1,Math.abs(r.left),Math.abs(r.top),r.width,r.height,Math.abs(p.x),Math.abs(p.y));
  const clean=value=>Math.abs(value)<=tolerance?0:value;
  return{center,dx:clean(local.x-r.width/2),dy:clean(r.height/2-local.y),distance:distance(center,p)};
 }
 // Bounds and origin use UNROTATED plan coordinates. axis:x is a vertical line;
 // axis:y is horizontal. Integer indices are relative to origin, including negatives.
 // At most 400 lines are generated. Dense/unrepresentable grids allocate no lines.
 function metricGrid(bounds,origin,step,maxLines=400){
  const r=rect(bounds);origin=point(origin,"origin");finite(step,"step");
  if(step<=0)throw new RangeError("step must be positive");
  if(!Number.isInteger(maxLines)||maxLines<1||maxLines>400)throw new RangeError("maxLines must be an integer from 1 to 400");
  const right=finite(r.left+r.width,"bounds.right"),bottom=finite(r.top+r.height,"bounds.bottom");
  function range(min,max,offset){
   const lo=(min-offset)/step,hi=(max-offset)/step;
   const first=Math.ceil(lo-Number.EPSILON*8*Math.max(1,Math.abs(lo)))||0;
   const last=Math.floor(hi+Number.EPSILON*8*Math.max(1,Math.abs(hi)))||0;
   if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last))return null;
   return{first,count:Math.max(0,last-first+1)};
  }
  const xs=range(r.left,right,origin.x),ys=range(r.top,bottom,origin.y);
  if(!xs||!ys||xs.count+ys.count>maxLines)return{lines:[],tooDense:true};
  const lines=[];
  for(let i=0;i<xs.count;i++){
   const index=xs.first+i,x=Math.max(r.left,Math.min(right,origin.x+index*step));
   lines.push({a:resultPoint(x,r.top),b:resultPoint(x,bottom),index,axis:"x"});
  }
  for(let i=0;i<ys.count;i++){
   const index=ys.first+i,y=Math.max(r.top,Math.min(bottom,origin.y+index*step));
   lines.push({a:resultPoint(r.left,y),b:resultPoint(right,y),index,axis:"y"});
  }
  return{lines,tooDense:false};
 }
 const api=Object.freeze({distance,rotate,nearestOnSegment,rectPoint,rectLocal,gridCenterOffset,metricGrid});
 if(root)root.MeasurementGeometry=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null);
