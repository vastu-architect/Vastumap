let sel=null,selType="",gridCounter=0,labelCounter=0,stickerCounter=0,axisCounter=0,overlayCounter=0,purushaCounter=0,planData="",lastPlanRot=0,drag=null,zoomLevel=1,historyStack=[],redoStack=[],isRestoring=false;
const canvas=document.getElementById("canvas"),plan=document.getElementById("planImage");
const names=["Северо-Запад","Север","Северо-Восток","Запад","Брахмастан","Восток","Юго-Запад","Юг","Юго-Восток"];
function nd(v){v=parseFloat(v)||0;return((v%360)+360)%360}
function num(v,fallback){if(v===undefined||v===null||v==="")return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback}
function clearSel(){document.querySelectorAll(".selected").forEach(e=>e.classList.remove("selected"));sel=null;selType=""}
function pushHistory(){
 if(isRestoring) return;
 try {
  const state=JSON.stringify(collect());
  if(historyStack[historyStack.length-1]!==state) historyStack.push(state);
  if(historyStack.length>30) historyStack.shift();
  redoStack=[];
 } catch(e) {}
}
function undoLast(){
 if(!historyStack.length){ alert("Нет действия для отмены"); return; }
 try { redoStack.push(JSON.stringify(collect())); } catch(e) {}
 const prev=JSON.parse(historyStack.pop());
 isRestoring = true;
 loadProject(prev);
 isRestoring = false;
}
function redoLast(){
 if(!redoStack.length){ alert("Нет действия для повтора"); return; }
 try { historyStack.push(JSON.stringify(collect())); } catch(e) {}
 const next=JSON.parse(redoStack.pop());
 isRestoring=true;
 loadProject(next);
 isRestoring=false;
}
function applyZoom(){canvas.style.transformOrigin="top center";canvas.style.transform=`scale(${zoomLevel})`;zoomTxt.innerText=Math.round(zoomLevel*100)}
function zoomAll(delta){pushHistory();zoomLevel=Math.max(0.25,Math.min(3,zoomLevel+delta));applyZoom()}
function togglePanel(){document.querySelector(".layout").classList.toggle("panel-hidden")}
imageInput.onchange=e=>{let f=e.target.files[0];if(!f)return;pushHistory();let r=new FileReader();r.onload=x=>{planData=x.target.result;plan.src=planData};r.readAsDataURL(f)}
overlayInput.onchange=e=>{let f=e.target.files[0];if(!f)return;pushHistory();let r=new FileReader();r.onload=x=>addOverlayImage({src:x.target.result});r.readAsDataURL(f)}
planRot.onfocus=()=>pushHistory();planRot.oninput=()=>setPlanRot(planRot.value);planOpacity.onfocus=()=>pushHistory();planOpacity.oninput=e=>plan.style.opacity=e.target.value/100;
function setPlanRot(v){let n=nd(v),delta=n-lastPlanRot;planRot.value=Math.round(n);plan.style.transform=`translate(-50%,-50%) rotate(${n}deg)`;document.querySelectorAll(".vastu-grid").forEach(g=>{if(g.dataset.locked==="true"){let d=nd((+g.dataset.rot||0)+delta);g.dataset.rot=d;g.style.transform=`rotate(${d}deg)`;if(g===sel)updGridPanel()}});lastPlanRot=n}function stepPlan(x){pushHistory();setPlanRot((+planRot.value||0)+x)}
function addGrid(d={}){if(!isRestoring && Object.keys(d).length===0) pushHistory();gridCounter++;let g=document.createElement("div");g.className="vastu-grid";g.dataset.rot=d.rotation??0;g.dataset.op=d.opacity??62;g.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";g.style.left=(d.left??520+gridCounter*20)+"px";g.style.top=(d.top??330+gridCounter*20)+"px";g.style.width=(d.width??480)+"px";g.style.height=(d.height??480)+"px";g.style.transform=`rotate(${g.dataset.rot}deg)`;g.classList.toggle("locked", g.dataset.locked==="true");(d.directions??names).forEach((t,i)=>{let c=document.createElement("div");c.className="cell p"+(i+1);c.style.opacity=g.dataset.op/100;let inp=document.createElement("input");inp.value=t;inp.onfocus=()=>pushHistory();inp.oninput=buildInputs;c.appendChild(inp);g.appendChild(c)});["nw","n","ne","e","se","s","sw","w"].forEach(p=>{let h=document.createElement("div");h.className="handle "+p;h.onmousedown=startResize;h.ontouchstart=startResize;g.appendChild(h)});let rh=document.createElement("div");rh.className="rotate-handle";rh.onmousedown=startRot;rh.ontouchstart=startRot;g.appendChild(rh);g.onmousedown=startDrag;g.ontouchstart=startDrag;g.onclick=e=>{e.stopPropagation();select(g,"grid")};canvas.appendChild(g);select(g,"grid")}
function select(e,t){clearSel();sel=e;selType=t;e.classList.add("selected");if(t==="grid")updGridPanel();if(t==="label")updLabelPanel();if(t==="axis")updAxisPanel();if(t==="overlay")updOverlayPanel();if(t==="purusha")updPurushaPanel();}
function updGridPanel(){
 if(!sel||selType!="grid")return;
 const locked=sel.dataset.locked==="true";
 sel.classList.toggle("locked", locked);
 gridRot.value=Math.round(+sel.dataset.rot||0);
 gridDeg.innerText=gridRot.value;
 gridOp.value=sel.dataset.op||62;
 gridOpTxt.innerText=gridOp.value;
 gridSize.value=sel.offsetWidth;
 gridSizeTxt.innerText=sel.offsetWidth;
 lockGrid.checked=locked;
 buildInputs();
}
function setGridRot(v){if(selType!="grid")return;if(sel.dataset.locked==="true")return;v=nd(v);sel.dataset.rot=v;sel.style.transform=`rotate(${v}deg)`;updGridPanel()}function stepGrid(x){pushHistory();setGridRot((+gridRot.value||0)+x)}
gridRot.onfocus=()=>pushHistory();gridRot.oninput=e=>setGridRot(e.target.value);lockGrid.onchange=e=>{if(selType=="grid"){pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked", e.target.checked);}};gridOp.onfocus=()=>pushHistory();gridOp.oninput=e=>{if(selType!="grid")return;sel.dataset.op=e.target.value;sel.querySelectorAll(".cell").forEach(c=>c.style.opacity=e.target.value/100);gridOpTxt.innerText=e.target.value};gridSize.onfocus=()=>pushHistory();
gridSize.oninput=e=>{
 if(selType!="grid")return;
 if(sel.dataset.locked==="true"){updGridPanel();return;}
 sel.style.width=e.target.value+"px";
 sel.style.height=e.target.value+"px";
 gridSizeTxt.innerText=e.target.value+"×"+e.target.value;
 if(typeof gridWidth!=="undefined"){gridWidth.value=e.target.value;gridWidthTxt.innerText=e.target.value;}
 if(typeof gridHeight!=="undefined"){gridHeight.value=e.target.value;gridHeightTxt.innerText=e.target.value;}
};
if(typeof gridWidth!=="undefined"){
 gridWidth.onfocus=()=>pushHistory();
 gridWidth.oninput=e=>{
  if(selType!="grid")return;
  if(sel.dataset.locked==="true"){updGridPanel();return;}
  sel.style.width=e.target.value+"px";
  gridWidthTxt.innerText=e.target.value;
  gridSizeTxt.innerText=sel.offsetWidth+"×"+sel.offsetHeight;
 };
}
if(typeof gridHeight!=="undefined"){
 gridHeight.onfocus=()=>pushHistory();
 gridHeight.oninput=e=>{
  if(selType!="grid")return;
  if(sel.dataset.locked==="true"){updGridPanel();return;}
  sel.style.height=e.target.value+"px";
  gridHeightTxt.innerText=e.target.value;
  gridSizeTxt.innerText=sel.offsetWidth+"×"+sel.offsetHeight;
 };
}
function autoDirections(){
 if(selType!="grid"){alert("Сначала выбери сетку кликом");return;}
 pushHistory();
 const presets={
  "0":["Север","Северо-Восток","Восток","Северо-Запад","Брахмастан","Юго-Восток","Запад","Юго-Запад","Юг"],
  "1":["Северо-Запад","Север","Северо-Восток","Запад","Брахмастан","Восток","Юго-Запад","Юг","Юго-Восток"],
  "2":["Запад","Северо-Запад","Север","Юго-Запад","Брахмастан","Северо-Восток","Юг","Юго-Восток","Восток"],
  "3":["Северо-Восток","Восток","Юго-Восток","Север","Брахмастан","Юг","Северо-Запад","Запад","Юго-Запад"],
  "5":["Юго-Запад","Запад","Северо-Запад","Юг","Брахмастан","Север","Юго-Восток","Восток","Северо-Восток"],
  "6":["Восток","Юго-Восток","Юг","Северо-Восток","Брахмастан","Юго-Запад","Север","Северо-Запад","Запад"],
  "7":["Юго-Запад","Юг","Юго-Восток","Запад","Брахмастан","Восток","Северо-Запад","Север","Северо-Восток"],
  "8":["Юг","Юго-Запад","Запад","Юго-Восток","Брахмастан","Северо-Запад","Восток","Северо-Восток","Север"]
 };
 const arr=presets[String(northCell.value)];
 if(!arr){alert("Выбери ячейку, где находится Север");return;}
 const inputs=sel.querySelectorAll(".cell input");
 if(inputs.length!==9){alert("В сетке должно быть 9 ячеек");return;}
 inputs.forEach((input,index)=>input.value=arr[index]);
 buildInputs();
}
function buildInputs(){directionInputs.innerHTML="";if(selType!="grid")return;sel.querySelectorAll(".cell input").forEach((inp,i)=>{let d=document.createElement("div");d.className="control";d.style.marginBottom="7px";d.innerHTML='<label>Ячейка '+(i+1)+'</label>';let ed=document.createElement("input");ed.value=inp.value;ed.onfocus=()=>pushHistory();ed.oninput=()=>inp.value=ed.value;d.appendChild(ed);directionInputs.appendChild(d)})}
function point(e){const p=e.touches?.[0]??e;const r=canvas.getBoundingClientRect();return{x:(p.clientX-r.left)/zoomLevel,y:(p.clientY-r.top)/zoomLevel}}function bind(){document.addEventListener("mousemove",move);document.addEventListener("mouseup",stop);document.addEventListener("touchmove",move,{passive:false});document.addEventListener("touchend",stop)}
function startDrag(e){
 if(e.target.classList.contains("handle")||e.target.classList.contains("rotate-handle")||e.target.tagName==="INPUT")return;
 const g=e.currentTarget;
 e.preventDefault();e.stopPropagation();
 select(g,"grid");
 if(g.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 let p=point(e);drag={type:"drag",el:g,x:p.x,y:p.y,l:parseFloat(g.style.left),t:parseFloat(g.style.top)};bind()}
function startResize(e){
 e.preventDefault();e.stopPropagation();
 let g=e.target.closest(".vastu-grid");
 select(g,"grid");
 if(g.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 let p=point(e);
 let handle=[...e.target.classList].find(c=>["nw","ne","sw","se"].includes(c)) || "se";
 const l=parseFloat(g.style.left), t=parseFloat(g.style.top), w=g.offsetWidth, h=g.offsetHeight;
 const rot=(+g.dataset.rot||0) * Math.PI / 180;
 const cx=l+w/2, cy=t+h/2;
 function toWorld(localX, localY){
   return {
     x: cx + localX*Math.cos(rot) - localY*Math.sin(rot),
     y: cy + localX*Math.sin(rot) + localY*Math.cos(rot)
   };
 }
 const sx = handle.includes("e") ? 1 : -1;
 const sy = handle.includes("s") ? 1 : -1;
 const fixedLocal = {x:-sx*w/2, y:-sy*h/2};
 const movingLocal = {x:sx*w/2, y:sy*h/2};
 drag={
   type:"resize",
   el:g,
   handle,
   sx, sy,
   rot,
   fixedWorld:toWorld(fixedLocal.x, fixedLocal.y),
   startMovingWorld:toWorld(movingLocal.x, movingLocal.y),
   min:150
 };
 bind();
}
function startRot(e){e.preventDefault();e.stopPropagation();let g=e.target.closest(".vastu-grid");select(g,"grid");if(g.dataset.locked==="true"){drag=null;return;}pushHistory();drag={type:"rot",el:g,cx:parseFloat(g.style.left)+g.offsetWidth/2,cy:parseFloat(g.style.top)+g.offsetHeight/2};bind()}
function move(e){if(!drag)return;e.preventDefault();let p=point(e);if(drag.type=="drag"||drag.type=="generic"){if(drag.el.classList&&drag.el.classList.contains("vastu-grid")&&drag.el.dataset.locked==="true")return;drag.el.style.left=drag.l+(p.x-drag.x)+"px";drag.el.style.top=drag.t+(p.y-drag.y)+"px"}if(drag.type=="resize"){
 if(drag.el.dataset.locked==="true")return;

 // Resize в локальных координатах повернутой сетки.
 // Фиксируем противоположный угол в мировых координатах, поэтому при любом повороте
 // незатрагиваемые стороны/противоположный угол визуально остаются на месте.
 const cos=Math.cos(-drag.rot), sin=Math.sin(-drag.rot);
 const vx=p.x-drag.fixedWorld.x;
 const vy=p.y-drag.fixedWorld.y;
 const localX=vx*cos - vy*sin;
 const localY=vx*sin + vy*cos;

 let newW=Math.max(drag.min, Math.abs(localX));
 let newH=Math.max(drag.min, Math.abs(localY));

 const centerLocalX=drag.sx*newW/2;
 const centerLocalY=drag.sy*newH/2;
 const rot=drag.rot;
 const centerWorld={
   x:drag.fixedWorld.x + centerLocalX*Math.cos(rot) - centerLocalY*Math.sin(rot),
   y:drag.fixedWorld.y + centerLocalX*Math.sin(rot) + centerLocalY*Math.cos(rot)
 };

 drag.el.style.width=newW+"px";
 drag.el.style.height=newH+"px";
 drag.el.style.left=(centerWorld.x-newW/2)+"px";
 drag.el.style.top=(centerWorld.y-newH/2)+"px";
 if(drag.el===sel)updGridPanel();
}
if(drag.type=="overlay-resize"){
 if(drag.el.dataset.locked==="true")return;
 let dx=p.x-drag.x, dy=p.y-drag.y;
 const aspect=drag.w/drag.h;
 let delta=0;
 if(drag.handle.includes("e")) delta=dx;
 if(drag.handle.includes("w")) delta=-dx;
 if(Math.abs(dy)>Math.abs(delta)){
   if(drag.handle.includes("s")) delta=dy*aspect;
   if(drag.handle.includes("n")) delta=-dy*aspect;
 }
 let newW=Math.max(50, drag.w+delta);
 let newH=newW/aspect;
 let newL=drag.l, newT=drag.t;
 if(drag.handle.includes("w")) newL=drag.l+(drag.w-newW);
 if(drag.handle.includes("n")) newT=drag.t+(drag.h-newH);
 drag.el.style.width=newW+"px";
 drag.el.style.left=newL+"px";
 drag.el.style.top=newT+"px";
 drag.el.dataset.width=Math.round(newW);
 if(drag.el===sel)updOverlayPanel();
}
if(drag.type=="purusha-resize"){
 if(drag.el.dataset.locked==="true")return;
 let dx=p.x-drag.x, dy=p.y-drag.y;
 let newW=drag.w, newH=drag.h, newL=drag.l, newT=drag.t;

 if(drag.handle.includes("e")) newW=Math.max(80, drag.w+dx);
 if(drag.handle.includes("s")) newH=Math.max(80, drag.h+dy);
 if(drag.handle.includes("w")) { newW=Math.max(80, drag.w-dx); newL=drag.l+(drag.w-newW); }
 if(drag.handle.includes("n")) { newH=Math.max(80, drag.h-dy); newT=drag.t+(drag.h-newH); }

 drag.el.style.width=newW+"px";
 drag.el.style.height=newH+"px";
 drag.el.style.left=newL+"px";
 drag.el.style.top=newT+"px";
 drag.el.dataset.width=Math.round(newW);
 drag.el.dataset.height=Math.round(newH);
 if(drag.el===sel)updPurushaPanel();
}if(drag.type=="rot"){if(drag.el.dataset.locked==="true")return;let deg=Math.round(nd(Math.atan2(p.y-drag.cy,p.x-drag.cx)*180/Math.PI+90));drag.el.dataset.rot=deg;drag.el.style.transform=`rotate(${deg}deg)`;if(drag.el===sel)updGridPanel()}}
function stop(){drag=null;document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",stop);document.removeEventListener("touchmove",move);document.removeEventListener("touchend",stop)}

const PURUSHA_GRID_SRC = "purusha-grid.jpg";
const PURUSHA_DEFAULT_WIDTH = 520;
const PURUSHA_DEFAULT_HEIGHT = 485;
function addPurushaGrid(d={}){
 if(!isRestoring && Object.keys(d).length===0) pushHistory();
 purushaCounter++;
 const wrap=document.createElement("div");
 wrap.className="purusha-grid";
 wrap.dataset.src=d.src||PURUSHA_GRID_SRC;
 wrap.dataset.opacity=d.opacity??100;
 wrap.dataset.width=d.width??PURUSHA_DEFAULT_WIDTH;
 wrap.dataset.height=d.height??PURUSHA_DEFAULT_HEIGHT;
 wrap.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";
 wrap.dataset.rotation=d.rotation??0;
 wrap.style.left=(d.left??360+purushaCounter*20)+"px";
 wrap.style.top=(d.top??260+purushaCounter*20)+"px";
 wrap.style.width=wrap.dataset.width+"px";
 wrap.style.height=wrap.dataset.height+"px";
 wrap.style.opacity=(+wrap.dataset.opacity)/100;
 wrap.style.transform=`rotate(${wrap.dataset.rotation}deg)`;
 wrap.classList.toggle("locked", wrap.dataset.locked==="true");

 const img=document.createElement("img");
 img.src=wrap.dataset.src;
 wrap.appendChild(img);

 ["nw","n","ne","e","se","s","sw","w"].forEach(pos=>{
   const h=document.createElement("div");
   h.className="purusha-handle "+pos;
   h.onmousedown=startPurushaResize;
   h.ontouchstart=startPurushaResize;
   wrap.appendChild(h);
 });

 prepGeneric(wrap,"purusha");
 canvas.appendChild(wrap);
 select(wrap,"purusha");
}
function updPurushaPanel(){
 if(selType!=="purusha") return;
 lockPurusha.checked=sel.dataset.locked==="true";
 const w=Math.round(parseFloat(sel.style.width)||sel.offsetWidth||PURUSHA_DEFAULT_WIDTH);
 const h=Math.round(parseFloat(sel.style.height)||sel.offsetHeight||PURUSHA_DEFAULT_HEIGHT);
 purushaSize.value=Math.round((w+h)/2);
 purushaSizeTxt.innerText=w+"×"+h;
 if(typeof purushaWidth!=="undefined"){purushaWidth.value=w;purushaWidthTxt.innerText=w;}
 if(typeof purushaHeight!=="undefined"){purushaHeight.value=h;purushaHeightTxt.innerText=h;}
 purushaOp.value=sel.dataset.opacity||100;
 purushaOpTxt.innerText=sel.dataset.opacity||100;
 purushaRot.value=Math.round(+sel.dataset.rotation||0);
 purushaRotTxt.innerText=purushaRot.value;
}
function setPurushaRot(v){
 if(selType!=="purusha") return;
 if(sel.dataset.locked==="true"){updPurushaPanel();return;}
 v=nd(v);
 sel.dataset.rotation=v;
 sel.style.transform=`rotate(${v}deg)`;
 updPurushaPanel();
}
function stepPurushaRot(n){pushHistory();setPurushaRot((+purushaRot.value||0)+n)}
lockPurusha.onchange=e=>{if(selType!=="purusha")return;pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked",e.target.checked);};
purushaSize.onfocus=()=>pushHistory();
purushaSize.oninput=e=>{
 if(selType!=="purusha")return;
 if(sel.dataset.locked==="true"){updPurushaPanel();return;}
 sel.dataset.width=e.target.value;
 sel.dataset.height=e.target.value;
 sel.style.width=e.target.value+"px";
 sel.style.height=e.target.value+"px";
 purushaSizeTxt.innerText=e.target.value+"×"+e.target.value;
 if(typeof purushaWidth!=="undefined"){purushaWidth.value=e.target.value;purushaWidthTxt.innerText=e.target.value;}
 if(typeof purushaHeight!=="undefined"){purushaHeight.value=e.target.value;purushaHeightTxt.innerText=e.target.value;}
};
if(typeof purushaWidth!=="undefined"){
 purushaWidth.onfocus=()=>pushHistory();
 purushaWidth.oninput=e=>{
  if(selType!=="purusha")return;
  if(sel.dataset.locked==="true"){updPurushaPanel();return;}
  sel.dataset.width=e.target.value;
  sel.style.width=e.target.value+"px";
  purushaWidthTxt.innerText=e.target.value;
  purushaSizeTxt.innerText=sel.offsetWidth+"×"+sel.offsetHeight;
 };
}
if(typeof purushaHeight!=="undefined"){
 purushaHeight.onfocus=()=>pushHistory();
 purushaHeight.oninput=e=>{
  if(selType!=="purusha")return;
  if(sel.dataset.locked==="true"){updPurushaPanel();return;}
  sel.dataset.height=e.target.value;
  sel.style.height=e.target.value+"px";
  purushaHeightTxt.innerText=e.target.value;
  purushaSizeTxt.innerText=sel.offsetWidth+"×"+sel.offsetHeight;
 };
}
purushaOp.onfocus=()=>pushHistory();
purushaOp.oninput=e=>{if(selType!=="purusha")return;sel.dataset.opacity=e.target.value;sel.style.opacity=e.target.value/100;purushaOpTxt.innerText=e.target.value;};
purushaRot.onfocus=()=>pushHistory();
purushaRot.oninput=e=>setPurushaRot(e.target.value);
function startPurushaResize(e){
 e.preventDefault();e.stopPropagation();
 const wrap=e.target.closest(".purusha-grid");
 select(wrap,"purusha");
 if(wrap.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 const p=point(e);
 const handle=[...e.target.classList].find(c=>["nw","n","ne","e","se","s","sw","w"].includes(c)) || "se";
 drag={type:"purusha-resize",el:wrap,handle,x:p.x,y:p.y,w:wrap.offsetWidth,h:wrap.offsetHeight,l:parseFloat(wrap.style.left),t:parseFloat(wrap.style.top)};
 bind();
}
function addOverlayImage(d={}){
 overlayCounter++;
 const wrap=document.createElement("div");
 wrap.className="overlay-wrap";
 wrap.dataset.src=d.src||"";
 wrap.dataset.opacity=d.opacity??100;
 wrap.dataset.width=d.width??420;
 wrap.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";
 wrap.dataset.rotation=d.rotation??0;
 wrap.style.left=(d.left??300+overlayCounter*20)+"px";
 wrap.style.top=(d.top??250+overlayCounter*20)+"px";
 wrap.style.width=wrap.dataset.width+"px";
 wrap.style.opacity=(+wrap.dataset.opacity)/100;
 wrap.style.transform=`rotate(${wrap.dataset.rotation}deg)`;
 wrap.classList.toggle("locked", wrap.dataset.locked==="true");

 const img=document.createElement("img");
 img.src=wrap.dataset.src;
 wrap.appendChild(img);

 ["nw","ne","sw","se"].forEach(pos=>{
   const h=document.createElement("div");
   h.className="overlay-handle "+pos;
   h.onmousedown=startOverlayResize;
   h.ontouchstart=startOverlayResize;
   wrap.appendChild(h);
 });

 prepGeneric(wrap,"overlay");
 canvas.appendChild(wrap);
 select(wrap,"overlay");
}
function updOverlayPanel(){
 if(selType!=="overlay") return;
 lockOverlay.checked=sel.dataset.locked==="true";
 overlaySize.value=parseFloat(sel.style.width)||sel.offsetWidth||420;
 overlaySizeTxt.innerText=Math.round(parseFloat(sel.style.width)||sel.offsetWidth||420);
 overlayOp.value=sel.dataset.opacity||100;
 overlayOpTxt.innerText=sel.dataset.opacity||100;
 overlayRot.value=Math.round(+sel.dataset.rotation||0);
 overlayRotTxt.innerText=overlayRot.value;
}
function setOverlayRot(v){
 if(selType!=="overlay") return;
 if(sel.dataset.locked==="true"){updOverlayPanel();return;}
 v=nd(v);
 sel.dataset.rotation=v;
 sel.style.transform=`rotate(${v}deg)`;
 updOverlayPanel();
}
function stepOverlayRot(n){pushHistory();setOverlayRot((+overlayRot.value||0)+n)}
lockOverlay.onchange=e=>{if(selType!=="overlay")return;pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked",e.target.checked);};
overlaySize.onfocus=()=>pushHistory();
overlaySize.oninput=e=>{if(selType!=="overlay")return;if(sel.dataset.locked==="true"){updOverlayPanel();return;}sel.dataset.width=e.target.value;sel.style.width=e.target.value+"px";overlaySizeTxt.innerText=e.target.value;};
overlayOp.onfocus=()=>pushHistory();
overlayOp.oninput=e=>{if(selType!=="overlay")return;sel.dataset.opacity=e.target.value;sel.style.opacity=e.target.value/100;overlayOpTxt.innerText=e.target.value;};
overlayRot.onfocus=()=>pushHistory();
overlayRot.oninput=e=>setOverlayRot(e.target.value);
function startOverlayResize(e){
 e.preventDefault();e.stopPropagation();
 const wrap=e.target.closest(".overlay-wrap");
 select(wrap,"overlay");
 if(wrap.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 const p=point(e);
 const handle=[...e.target.classList].find(c=>["nw","ne","sw","se"].includes(c)) || "se";
 drag={type:"overlay-resize",el:wrap,handle,x:p.x,y:p.y,w:wrap.offsetWidth,h:wrap.offsetHeight,l:parseFloat(wrap.style.left),t:parseFloat(wrap.style.top)};
 bind();
}
function addTextLabel(d={}){if(!isRestoring && Object.keys(d).length===0) pushHistory();labelCounter++;let l=document.createElement("div");l.className="text-label";l.dataset.rot=d.rotation??0;l.dataset.fs=d.fontSize??22;l.innerText=d.text??"Надпись";l.style.left=(d.left??120+labelCounter*20)+"px";l.style.top=(d.top??120+labelCounter*20)+"px";l.style.fontSize=l.dataset.fs+"px";l.style.transform=`rotate(${l.dataset.rot}deg)`;prepGeneric(l,"label");canvas.appendChild(l);select(l,"label");updLabelPanel()}
function updLabelPanel(){if(selType!="label")return;labelText.value=sel.innerText;fontSize.value=sel.dataset.fs;fontTxt.innerText=sel.dataset.fs;labelRot.value=sel.dataset.rot;labelDeg.innerText=sel.dataset.rot}
labelText.onfocus=()=>pushHistory();labelText.oninput=e=>{if(selType=="label")sel.innerText=e.target.value||" "};fontSize.onfocus=()=>pushHistory();fontSize.oninput=e=>{if(selType=="label"){sel.dataset.fs=e.target.value;sel.style.fontSize=e.target.value+"px";fontTxt.innerText=e.target.value}};labelRot.onfocus=()=>pushHistory();labelRot.oninput=e=>{if(selType=="label"){sel.dataset.rot=e.target.value;sel.style.transform=`rotate(${e.target.value}deg)`;labelDeg.innerText=e.target.value}}
function addSticker(color,d={}){if(!isRestoring && Object.keys(d).length===0) pushHistory();stickerCounter++;let s=document.createElement("div");s.className="sticker";s.dataset.color=d.color??color;s.dataset.size=d.size??38;s.innerText="★";s.style.color=s.dataset.color==="green"?"#18a558":"#d62828";s.style.left=(d.left??170+stickerCounter*24)+"px";s.style.top=(d.top??170+stickerCounter*24)+"px";s.style.fontSize=s.dataset.size+"px";prepGeneric(s,"sticker");canvas.appendChild(s);select(s,"sticker")}function resizeSticker(n){if(selType!="sticker")return;pushHistory();let sz=Math.max(12,(+sel.dataset.size||38)+n*4);sel.dataset.size=sz;sel.style.fontSize=sz+"px"}
function addAxes(){
 if(document.querySelector(".axis-group")) return;
 if(!isRestoring) pushHistory();
 let wrap=document.createElement("div");
 wrap.className="axis-group axis";
 wrap.dataset.locked="false";
 wrap.dataset.len="1800";
 wrap.dataset.opacity="100";
 wrap.style.left="-100px";
 wrap.style.top="600px";
 wrap.style.width="1800px";
 wrap.style.height="2px";
 wrap.style.background="transparent";
 wrap.style.transform="none";
 [90,0,45,135].forEach(rot=>{
   let a=document.createElement("div");
   a.className="axis-line";
   a.dataset.rot=rot;
   a.style.position="absolute";
   a.style.left="0";
   a.style.top="0";
   a.style.width="1800px";
   a.style.height="2px";
   a.style.background="#111";
   a.style.opacity="1";
   a.style.transformOrigin="900px center";
   a.style.transform=`rotate(${rot}deg)`;
   wrap.appendChild(a);
 });
 wrap.onmousedown=startAxisDrag;
 wrap.ontouchstart=startAxisDrag;
 wrap.onclick=e=>{e.stopPropagation();select(wrap,"axis")};
 canvas.appendChild(wrap);
 select(wrap,"axis");
}
function updateAxisVisual(g){
 if(!g) return;
 const len=+g.dataset.len||1800;
 const op=(+g.dataset.opacity||100)/100;
 g.style.width=len+"px";
 g.querySelectorAll(".axis-line").forEach(line=>{
   line.style.width=len+"px";
   line.style.transformOrigin=(len/2)+"px center";
   line.style.opacity=op;
 });
}
function updAxisPanel(){
 if(selType!=="axis") return;
 lockAxes.checked=sel.dataset.locked==="true";
 axisLen.value=sel.dataset.len||1800;
 axisLenTxt.innerText=sel.dataset.len||1800;
 axisOp.value=sel.dataset.opacity||100;
 axisOpTxt.innerText=sel.dataset.opacity||100;
}
axisLen.onfocus=()=>pushHistory();
axisLen.oninput=e=>{const g=document.querySelector(".axis-group");if(!g)return;g.dataset.len=e.target.value;axisLenTxt.innerText=e.target.value;updateAxisVisual(g);};
axisOp.onfocus=()=>pushHistory();
axisOp.oninput=e=>{const g=document.querySelector(".axis-group");if(!g)return;g.dataset.opacity=e.target.value;axisOpTxt.innerText=e.target.value;updateAxisVisual(g);};
function addAxis(d={}){}

function startAxisDrag(e){
 e.preventDefault();
 e.stopPropagation();
 const wrap=e.currentTarget;
 select(wrap,"axis");
 if(wrap.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 let p=point(e);
 drag={type:"generic",el:wrap,x:p.x,y:p.y,l:parseFloat(wrap.style.left),t:parseFloat(wrap.style.top)};
 bind();
}
lockAxes.onchange=e=>{const g=document.querySelector(".axis-group"); if(g){pushHistory();g.dataset.locked=e.target.checked?"true":"false";}};

function prepGeneric(el,type){el.onmousedown=e=>{e.preventDefault();e.stopPropagation();select(el,type);if((type==="overlay"||type==="purusha")&&el.dataset.locked==="true"){drag=null;return;}pushHistory();let p=point(e);drag={type:"generic",el,x:p.x,y:p.y,l:parseFloat(el.style.left),t:parseFloat(el.style.top)};bind()};el.ontouchstart=el.onmousedown;el.onclick=e=>{e.stopPropagation();select(el,type)}}
function delSel(){if(sel){pushHistory();sel.remove();}clearSel()}canvas.onclick=clearSel;
function collect(){let grids=[...document.querySelectorAll(".vastu-grid")].map(g=>({left:parseFloat(g.style.left),top:parseFloat(g.style.top),width:g.offsetWidth,height:g.offsetHeight,rotation:num(g.dataset.rot,0),opacity:num(g.dataset.op,62),locked:g.dataset.locked||"false",directions:[...g.querySelectorAll(".cell input")].map(i=>i.value)}));let labels=[...document.querySelectorAll(".text-label")].map(l=>({left:parseFloat(l.style.left),top:parseFloat(l.style.top),text:l.innerText,rotation:num(l.dataset.rot,0),fontSize:num(l.dataset.fs,22)}));let stickers=[...document.querySelectorAll(".sticker")].map(s=>({left:parseFloat(s.style.left),top:parseFloat(s.style.top),color:s.dataset.color,size:num(s.dataset.size,38)}));let axes=[]; const ag=document.querySelector(".axis-group"); if(ag){axes=[{left:parseFloat(ag.style.left),top:parseFloat(ag.style.top),locked:ag.dataset.locked||"false",len:num(ag.dataset.len,1800),opacity:num(ag.dataset.opacity,100)}]};
let overlays=[...document.querySelectorAll(".overlay-wrap")].map(o=>({left:parseFloat(o.style.left),top:parseFloat(o.style.top),src:o.dataset.src,width:num(o.dataset.width,parseFloat(o.style.width)||420),height:o.offsetHeight,opacity:num(o.dataset.opacity,100),locked:o.dataset.locked||"false",rotation:num(o.dataset.rotation,0)}));
let purushas=[...document.querySelectorAll(".purusha-grid")].map(o=>{let p={left:parseFloat(o.style.left),top:parseFloat(o.style.top),width:num(o.dataset.width,parseFloat(o.style.width)||PURUSHA_DEFAULT_WIDTH),height:num(o.dataset.height,parseFloat(o.style.height)||PURUSHA_DEFAULT_HEIGHT),opacity:num(o.dataset.opacity,100),locked:o.dataset.locked||"false",rotation:num(o.dataset.rotation,0)};if(o.dataset.src&&o.dataset.src!==PURUSHA_GRID_SRC)p.src=o.dataset.src;return p});
return{version:"3.0",planImageData:planData,planRotation:num(planRot.value,0),planOpacity:num(planOpacity.value,85),zoomLevel,grids,labels,stickers,axes,overlays,purushas}}
function saveProject(){download(new Blob([JSON.stringify(collect(),null,2)],{type:"application/json"}),"vastu-project.json")}projectInput.onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=x=>{try{const p=JSON.parse(x.target.result);pushHistory();isRestoring=true;loadProject(p);isRestoring=false;}catch(err){isRestoring=false;alert("Не удалось открыть проект: файл поврежден или имеет неверный формат.");}};r.readAsText(f)}
function loadProject(p){document.querySelectorAll(".vastu-grid,.text-label,.sticker,.axis,.overlay-wrap,.overlay-img,.purusha-grid").forEach(x=>x.remove());clearSel();planData=p.planImageData||"";plan.src=planData;planOpacity.value=p.planOpacity??85;plan.style.opacity=planOpacity.value/100;lastPlanRot=0;setPlanRot(p.planRotation??0);zoomLevel=p.zoomLevel??1;applyZoom();(p.grids||[]).forEach(addGrid);(p.labels||[]).forEach(addTextLabel);(p.stickers||[]).forEach(s=>addSticker(s.color,s));(p.axes||[]).forEach(ax=>{addAxes(); const g=document.querySelector(".axis-group"); if(g){g.style.left=ax.left+"px"; g.style.top=ax.top+"px"; g.dataset.locked=ax.locked||"false"; g.dataset.len=ax.len??1800; g.dataset.opacity=ax.opacity??100; lockAxes.checked=g.dataset.locked==="true"; updateAxisVisual(g);}});(p.overlays||[]).forEach(addOverlayImage);(p.purushas||[]).forEach(addPurushaGrid)}
function exportPDF(){document.body.classList.add("exporting");const done=()=>document.body.classList.remove("exporting");window.addEventListener("afterprint",done,{once:true});window.print();setTimeout(done,1500)}function download(blob,name){let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function exportPNG(){
 try{await html2canvasLike()}catch(err){alert("Не удалось создать PNG. Проверь, что страница загружена полностью.")}
}
async function asDataURL(src){
 if(!src||src.startsWith("data:"))return src;
 const response=await fetch(src);
 if(!response.ok)throw new Error("Image not found");
 const blob=await response.blob();
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
}
async function html2canvasLike(){let svg=await buildSVG(),img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));img.onload=()=>{let c=document.createElement("canvas");c.width=1600;c.height=1200;let ctx=c.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,1600,1200);ctx.drawImage(img,0,0);c.toBlob(b=>download(b,"vastu-map.png"));URL.revokeObjectURL(url)};img.onerror=()=>{URL.revokeObjectURL(url);alert("Не удалось подготовить изображение для PNG.")};img.src=url}
function esc(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;")}
async function buildSVG(){let p=collect(),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="white"/>`;if(p.planImageData)svg+=`<g transform="translate(800 600) rotate(${p.planRotation})"><image href="${p.planImageData}" x="-525" y="-390" width="1050" height="780" opacity="${p.planOpacity/100}" preserveAspectRatio="xMidYMid meet"/></g>`;for(const o of p.purushas||[]){const src=await asDataURL(o.src||PURUSHA_GRID_SRC);svg+=`<image href="${src}" x="${o.left}" y="${o.top}" width="${o.width}" height="${o.height}" opacity="${o.opacity/100}" preserveAspectRatio="none" transform="rotate(${o.rotation} ${o.left+o.width/2} ${o.top+o.height/2})"/>`;}for(const o of p.overlays||[]){if(o.src)svg+=`<image href="${o.src}" x="${o.left}" y="${o.top}" width="${o.width}" height="${o.height}" opacity="${o.opacity/100}" preserveAspectRatio="none" transform="rotate(${o.rotation} ${o.left+o.width/2} ${o.top+o.height/2})"/>`;}p.grids.forEach(g=>{let cx=g.left+g.width/2,cy=g.top+g.height/2,cw=g.width/3,ch=g.height/3,cols=["#daeef1","#f2f5ee","#f4efef","#eceff8","#fff","#f4f4f0","#f1edf0","#faf1f0","#f7eff8"];svg+=`<g transform="rotate(${g.rotation} ${cx} ${cy})">`;for(let r=0;r<3;r++)for(let c=0;c<3;c++){let i=r*3+c;svg+=`<rect x="${g.left+c*cw}" y="${g.top+r*ch}" width="${cw}" height="${ch}" fill="${cols[i]}" opacity="${g.opacity/100}" stroke="black"/><text x="${g.left+c*cw+cw/2}" y="${g.top+r*ch+ch/2}" font-size="18" font-weight="700" text-anchor="middle" dominant-baseline="middle">${esc(g.directions[i]||"")}</text>`}svg+=`</g>`});p.axes.forEach(a=>{let len=a.len,op=a.opacity/100;[90,0,45,135].forEach(rot=>{svg+=`<line x1="${a.left}" y1="${a.top}" x2="${a.left+len}" y2="${a.top}" stroke="black" stroke-width="2" opacity="${op}" transform="rotate(${rot} ${a.left+len/2} ${a.top})"/>`;});});p.labels.forEach(l=>svg+=`<text x="${l.left}" y="${l.top}" font-size="${l.fontSize}" font-weight="700" transform="rotate(${l.rotation} ${l.left} ${l.top})">${esc(l.text)}</text>`);p.stickers.forEach(s=>svg+=`<text x="${s.left}" y="${s.top}" font-size="${s.size}" fill="${s.color==='green'?'#18a558':'#d62828'}">★</text>`);return svg+"</svg>"}
isRestoring=true;
applyZoom();
addGrid();
isRestoring=false;

document.addEventListener("keydown",e=>{
 if(!(e.ctrlKey||e.metaKey)) return;
 const key=e.key.toLowerCase();
 if(key==="z"&&!e.shiftKey){e.preventDefault();undoLast();}
 if(key==="y"||(key==="z"&&e.shiftKey)){e.preventDefault();redoLast();}
});


(function(){
  function installTwoRowsButton(){
    let btn = document.getElementById('twoRowsBtn');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'twoRowsBtn';
      btn.className = 'two-rows-btn';
      btn.type = 'button';
      btn.textContent = '2 ряда';
      document.body.appendChild(btn);
    }
    btn.onclick = function(){
      document.body.classList.toggle('toolbar-two-rows');
      btn.textContent = document.body.classList.contains('toolbar-two-rows') ? '1 ряд' : '2 ряда';
    };
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', installTwoRowsButton);
  }else{
    installTwoRowsButton();
  }
})();

/* ===== VastuMap stability + 8-point resize upgrade ===== */
(function(){
  const EIGHT_POINTS = ["nw","n","ne","e","se","s","sw","w"];

  function ensureEightHandles(selector, handleClass, resizeHandler){
    document.querySelectorAll(selector).forEach(el=>{
      EIGHT_POINTS.forEach(pos=>{
        if(!el.querySelector("." + handleClass + "." + pos)){
          const h=document.createElement("div");
          h.className=handleClass + " " + pos;
          h.onmousedown=resizeHandler;
          h.ontouchstart=resizeHandler;
          el.appendChild(h);
        }
      });
    });
  }

  window.refreshVastuHandles = function(){
    if(typeof startResize === "function"){
      ensureEightHandles(".vastu-grid", "handle", startResize);
    }
    if(typeof startPurushaResize === "function"){
      ensureEightHandles(".purusha-grid", "purusha-handle", startPurushaResize);
    }
  };

  // Upgrade current and future elements after page actions.
  const oldAddGrid = window.addGrid;
  window.addGrid = function(d={}){
    const result = oldAddGrid.apply(this, arguments);
    window.refreshVastuHandles();
    return result;
  };

  const oldAddPurushaGrid = window.addPurushaGrid;
  window.addPurushaGrid = function(d={}){
    const result = oldAddPurushaGrid.apply(this, arguments);
    window.refreshVastuHandles();
    return result;
  };

  const oldLoadProject = window.loadProject;
  if(typeof oldLoadProject === "function"){
    window.loadProject = function(){
      const result = oldLoadProject.apply(this, arguments);
      window.refreshVastuHandles();
      return result;
    };
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", window.refreshVastuHandles);
  }else{
    window.refreshVastuHandles();
  }
})();

// Перезаписываем startResize: теперь 3×3 сетка меняется за 8 точек.
// Углы меняют ширину и высоту, стороны — только одну ось.
function startResize(e){
 e.preventDefault();e.stopPropagation();
 const g=e.target.closest(".vastu-grid");
 select(g,"grid");
 if(g.dataset.locked==="true"){drag=null;return;}
 pushHistory();

 const p=point(e);
 const handle=[...e.target.classList].find(c=>["nw","n","ne","e","se","s","sw","w"].includes(c)) || "se";
 const l=parseFloat(g.style.left), t=parseFloat(g.style.top), w=g.offsetWidth, h=g.offsetHeight;
 const rot=(+g.dataset.rot||0) * Math.PI / 180;
 const cx=l+w/2, cy=t+h/2;

 const sx = handle.includes("e") ? 1 : (handle.includes("w") ? -1 : 0);
 const sy = handle.includes("s") ? 1 : (handle.includes("n") ? -1 : 0);
 const affectsX = sx !== 0;
 const affectsY = sy !== 0;

 function toWorld(localX, localY){
   return {
     x: cx + localX*Math.cos(rot) - localY*Math.sin(rot),
     y: cy + localX*Math.sin(rot) + localY*Math.cos(rot)
   };
 }

 const fixedLocal = {
   x: affectsX ? -sx*w/2 : 0,
   y: affectsY ? -sy*h/2 : 0
 };

 drag={
   type:"resize",
   el:g,
   handle,
   sx, sy,
   affectsX, affectsY,
   rot,
   fixedWorld:toWorld(fixedLocal.x, fixedLocal.y),
   startW:w,
   startH:h,
   min:120
 };
 bind();
}

// Перезаписываем startPurushaResize: Пуруша-сетка тоже получает 8 точек.
function startPurushaResize(e){
 e.preventDefault();e.stopPropagation();
 const wrap=e.target.closest(".purusha-grid");
 select(wrap,"purusha");
 if(wrap.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 const p=point(e);
 const handle=[...e.target.classList].find(c=>["nw","n","ne","e","se","s","sw","w"].includes(c)) || "se";
 drag={type:"purusha-resize",el:wrap,handle,x:p.x,y:p.y,w:wrap.offsetWidth,h:wrap.offsetHeight,l:parseFloat(wrap.style.left),t:parseFloat(wrap.style.top)};
 bind();
}

// Единый обработчик движения с более стабильным resize.
function move(e){
 if(!drag)return;
 e.preventDefault();
 const p=point(e);

 if(drag.type=="drag"||drag.type=="generic"){
   if(drag.el.classList&&drag.el.classList.contains("vastu-grid")&&drag.el.dataset.locked==="true")return;
   drag.el.style.left=drag.l+(p.x-drag.x)+"px";
   drag.el.style.top=drag.t+(p.y-drag.y)+"px";
 }

 if(drag.type=="resize"){
   if(drag.el.dataset.locked==="true")return;

   const cos=Math.cos(-drag.rot), sin=Math.sin(-drag.rot);
   const vx=p.x-drag.fixedWorld.x;
   const vy=p.y-drag.fixedWorld.y;
   const localX=vx*cos - vy*sin;
   const localY=vx*sin + vy*cos;

   let newW = drag.affectsX ? Math.max(drag.min, Math.abs(localX)) : drag.startW;
   let newH = drag.affectsY ? Math.max(drag.min, Math.abs(localY)) : drag.startH;

   const centerLocalX = drag.affectsX ? drag.sx*newW/2 : 0;
   const centerLocalY = drag.affectsY ? drag.sy*newH/2 : 0;
   const rot=drag.rot;
   const centerWorld={
     x:drag.fixedWorld.x + centerLocalX*Math.cos(rot) - centerLocalY*Math.sin(rot),
     y:drag.fixedWorld.y + centerLocalX*Math.sin(rot) + centerLocalY*Math.cos(rot)
   };

   drag.el.style.width=newW+"px";
   drag.el.style.height=newH+"px";
   drag.el.style.left=(centerWorld.x-newW/2)+"px";
   drag.el.style.top=(centerWorld.y-newH/2)+"px";
   if(drag.el===sel)updGridPanel();
 }

 if(drag.type=="overlay-resize"){
   if(drag.el.dataset.locked==="true")return;
   let dx=p.x-drag.x, dy=p.y-drag.y;
   const aspect=drag.w/drag.h;
   let delta=0;
   if(drag.handle.includes("e")) delta=dx;
   if(drag.handle.includes("w")) delta=-dx;
   if(Math.abs(dy)>Math.abs(delta)){
     if(drag.handle.includes("s")) delta=dy*aspect;
     if(drag.handle.includes("n")) delta=-dy*aspect;
   }
   let newW=Math.max(50, drag.w+delta);
   let newH=newW/aspect;
   let newL=drag.l, newT=drag.t;
   if(drag.handle.includes("w")) newL=drag.l+(drag.w-newW);
   if(drag.handle.includes("n")) newT=drag.t+(drag.h-newH);
   drag.el.style.width=newW+"px";
   drag.el.style.left=newL+"px";
   drag.el.style.top=newT+"px";
   drag.el.dataset.width=Math.round(newW);
   if(drag.el===sel)updOverlayPanel();
 }

 if(drag.type=="purusha-resize"){
   if(drag.el.dataset.locked==="true")return;
   let dx=p.x-drag.x, dy=p.y-drag.y;
   let newW=drag.w, newH=drag.h, newL=drag.l, newT=drag.t;

   if(drag.handle.includes("e")) newW=Math.max(80, drag.w+dx);
   if(drag.handle.includes("s")) newH=Math.max(80, drag.h+dy);
   if(drag.handle.includes("w")) { newW=Math.max(80, drag.w-dx); newL=drag.l+(drag.w-newW); }
   if(drag.handle.includes("n")) { newH=Math.max(80, drag.h-dy); newT=drag.t+(drag.h-newH); }

   drag.el.style.width=newW+"px";
   drag.el.style.height=newH+"px";
   drag.el.style.left=newL+"px";
   drag.el.style.top=newT+"px";
   drag.el.dataset.width=Math.round(newW);
   drag.el.dataset.height=Math.round(newH);
   if(drag.el===sel)updPurushaPanel();
 }

 if(drag.type=="rot"){
   if(drag.el.dataset.locked==="true")return;
   let deg=Math.round(nd(Math.atan2(p.y-drag.cy,p.x-drag.cx)*180/Math.PI+90));
   if(drag.el.classList && drag.el.classList.contains("purusha-grid")){
     drag.el.dataset.rotation=deg;
   }else{
     drag.el.dataset.rot=deg;
   }
   drag.el.style.transform=`rotate(${deg}deg)`;
   if(drag.el===sel && selType==="grid")updGridPanel();
   if(drag.el===sel && selType==="purusha")updPurushaPanel();
 }
}
