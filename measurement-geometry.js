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
 // Angles follow plan coordinates (positive clockwise because y increases down).
 function wallDirection(degrees){
  finite(degrees,"angle");
  const angle=((degrees%360)+360)%360;
  if(angle===0)return{x:1,y:0};
  if(angle===90)return{x:0,y:1};
  if(angle===180)return{x:-1,y:0};
  if(angle===270)return{x:0,y:-1};
  const radians=angle*Math.PI/180;
  return{x:Math.cos(radians),y:Math.sin(radians)};
 }
 function wallAngle(a,b){
  a=point(a,"a");b=point(b,"b");
  if(distance(a,b)===0)throw new RangeError("Wall endpoints must differ");
  const degrees=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  return degrees===-180?180:degrees===0?0:degrees;
 }
 function wallPointAtAngle(a,length,degrees){
  a=point(a,"a");finite(length,"length");
  if(length<0)throw new RangeError("length must not be negative");
  const direction=wallDirection(degrees);
  return resultPoint(a.x+length*direction.x,a.y+length*direction.y);
 }
 // Editing can keep an existing direction; new walls choose the nearest base axis.
 function constrainWallPoint(a,p,{free=false,baseAngle=0,directionAngle=null}={}){
  a=point(a,"a");p=point(p);distance(a,p);
  if(typeof free!=="boolean")throw new TypeError("free must be a boolean");
  finite(baseAngle,"baseAngle");
  if(directionAngle!==null)finite(directionAngle,"directionAngle");
  if(free)return p;
  const direction=wallDirection(directionAngle===null?baseAngle:directionAngle),dx=p.x-a.x,dy=p.y-a.y;
  const along=dx*direction.x+dy*direction.y,across=-dx*direction.y+dy*direction.x;
  if(directionAngle!==null||Math.abs(along)>=Math.abs(across))return resultPoint(a.x+along*direction.x,a.y+along*direction.y);
  return resultPoint(a.x-across*direction.y,a.y+across*direction.x);
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
 // Cell ownership follows the grid's local axes, even when the grid is rotated.
 // Internal edges belong to the cell on their right/below; outer edges are included.
 function sectorAt(value,p){
  const r=rect(value);p=point(p);
  const local=rectLocal(r,p),tolerance=Number.EPSILON*32*Math.max(1,Math.abs(r.left),Math.abs(r.top),r.width,r.height,Math.abs(p.x),Math.abs(p.y));
  if(local.x < -tolerance||local.y < -tolerance||local.x > r.width+tolerance||local.y > r.height+tolerance)return null;
  const snap=(position,size)=>{
   let result=Math.max(0,Math.min(size,position));
   for(let i=1;i<3;i++){const cut=size*i/3;if(Math.abs(result-cut)<=tolerance)result=cut}
   return result;
  };
  const x=snap(local.x,r.width),y=snap(local.y,r.height);
  const column=x<r.width/3?0:x<r.width*2/3?1:2,row=y<r.height/3?0:y<r.height*2/3?1:2;
  const tl=rectPoint(r,column/3,row/3),tr=rectPoint(r,(column+1)/3,row/3),br=rectPoint(r,(column+1)/3,(row+1)/3),bl=rectPoint(r,column/3,(row+1)/3);
  const edges=[['top',tl,tr],['right',tr,br],['bottom',br,bl],['left',bl,tl]].map(([side,a,b])=>{
   const nearest=nearestOnSegment(p,a,b);
   return{side,a,b,point:nearest.point,distance:nearest.distance<=tolerance?0:nearest.distance};
  });
  return{index:row*3+column,row,column,center:rectPoint(r,(column+.5)/3,(row+.5)/3),edges};
 }
 // A 3x3 guide belongs only to the middle ninth of the parent grid.
 function brahmasthanLayout(value){
  const r=rect(value),lines=[],centers=[];
  for(let i=1;i<3;i++){
   const cut=1/3+i/9;
   lines.push({a:rectPoint(r,cut,1/3),b:rectPoint(r,cut,2/3)});
   lines.push({a:rectPoint(r,1/3,cut),b:rectPoint(r,2/3,cut)});
  }
  for(let row=0;row<3;row++)for(let column=0;column<3;column++)centers.push(rectPoint(r,1/3+(column+.5)/9,1/3+(row+.5)/9));
  const tl=rectPoint(r,1/3,1/3),tr=rectPoint(r,2/3,1/3),br=rectPoint(r,2/3,2/3),bl=rectPoint(r,1/3,2/3);
  return{lines,centers,outline:[{a:tl,b:tr},{a:tr,b:br},{a:br,b:bl},{a:bl,b:tl}],center:rectPoint(r,.5,.5)};
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
 const api=Object.freeze({distance,rotate,nearestOnSegment,wallAngle,wallPointAtAngle,constrainWallPoint,rectPoint,rectLocal,gridCenterOffset,sectorAt,brahmasthanLayout,metricGrid});
 if(root)root.MeasurementGeometry=api;
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:null);
