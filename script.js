let sel=null,selType="",gridCounter=0,labelCounter=0,footnoteCounter=0,stickerCounter=0,axisCounter=0,overlayCounter=0,purushaCounter=0,correctionCounter=0,captionGroupCounter=0,correctionGroups={},planData="",lastPlanRot=0,drag=null,zoomLevel=1,historyStack=[],redoStack=[],isRestoring=false,projectBaseName="vastu-project",exportBaseName="vastu-map";
const canvas=document.getElementById("canvas"),plan=document.getElementById("planImage");
plan.dataset.visible="true";
const PROJECT_VERSION="4.4";
let planDataRefCounter=0;
const planDataRefs=new Map();
const planDataIds=new Map();
const names=["Северо-Запад","Север","Северо-Восток","Запад","Брахмастан","Восток","Юго-Запад","Юг","Юго-Восток"];
function nd(v){v=parseFloat(v)||0;return((v%360)+360)%360}
function num(v,fallback){if(v===undefined||v===null||v==="")return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback}
function fmtDeg(v){const n=nd(v),rounded=Math.round(n);return Math.abs(n-rounded)<.001?String(rounded===360?0:rounded):String(Math.round(n*100)/100)}
function planDataRef(data){
 if(!data)return "";
 if(planDataIds.has(data))return planDataIds.get(data);
 const id="plan-"+(++planDataRefCounter);
 planDataIds.set(data,id);
 planDataRefs.set(id,data);
 return id;
}
function resolvePlanData(project){
 if(typeof project.planImageData==="string")return project.planImageData;
 if(project.planImageRef&&planDataRefs.has(project.planImageRef))return planDataRefs.get(project.planImageRef);
 return "";
}
function clearSel(){document.querySelectorAll(".selected").forEach(e=>e.classList.remove("selected"));sel=null;selType="";showProperties("");refreshLayers()}
function isLayerVisible(el){return !el.dataset||el.dataset.visible!=="false"}
function applyLayerVisibility(el,type=""){
 if(type==="correction"||el.classList?.contains("correction-object")){applyCorrectionGroup(el);return;}
 el.hidden=!isLayerVisible(el);
}
function setLayerVisibility(el,type,visible){
 pushHistory();
 el.dataset.visible=visible?"true":"false";
 applyLayerVisibility(el,type);
 if(type==="correction"||el.classList?.contains("correction-object"))refreshAllCorrectionCaptionGroups();
 if(!visible&&sel===el)clearSel();else refreshLayers();
}
function projectLayerItems(){
 return [
  {el:plan,type:"plan"},
  ...[...document.querySelectorAll(".vastu-grid")].map(el=>({el,type:"grid"})),
  ...[...document.querySelectorAll(".purusha-grid")].map(el=>({el,type:"purusha"})),
  ...[...document.querySelectorAll(".axis-group")].map(el=>({el,type:"axis"})),
  ...[...document.querySelectorAll(".overlay-wrap")].map(el=>({el,type:"overlay"})),
  ...[...document.querySelectorAll(".correction-object")].map(el=>({el,type:"correction"})),
  ...[...document.querySelectorAll(".text-label")].map(el=>({el,type:"label"})),
  ...[...document.querySelectorAll(".footnote")].map(el=>({el,type:"footnote"})),
  ...[...document.querySelectorAll(".sticker")].map(el=>({el,type:"sticker"}))
 ];
}
function setAllLayersVisibility(visible){
 pushHistory();
 if(visible)Object.values(correctionGroups).forEach(group=>group.visible=true);
 projectLayerItems().forEach(layer=>{
  if(!layer.el)return;
 layer.el.dataset.visible=visible?"true":"false";
  applyLayerVisibility(layer.el,layer.type);
 });
 refreshAllCorrectionCaptionGroups();
 if(visible)renderCorrectionLibrary(correctionSearch.value);
 if(!visible)clearSel();else refreshLayers();
}
function hideAllLayers(){setAllLayersVisibility(false)}
function showAllLayers(){setAllLayersVisibility(true)}
function historySnapshot(){return JSON.stringify(collect({includePlanData:false}))}
function pushHistory(){
 if(isRestoring) return;
 try {
  const state=historySnapshot();
  if(historyStack[historyStack.length-1]!==state) historyStack.push(state);
  if(historyStack.length>30) historyStack.shift();
  redoStack=[];
 } catch(e) {}
}
function undoLast(){
 if(!historyStack.length){ alert("Нет действия для отмены"); return; }
 try { redoStack.push(historySnapshot()); } catch(e) {}
 const prev=JSON.parse(historyStack.pop());
 isRestoring = true;
 loadProject(prev);
 isRestoring = false;
}
function redoLast(){
 if(!redoStack.length){ alert("Нет действия для повтора"); return; }
 try { historyStack.push(historySnapshot()); } catch(e) {}
 const next=JSON.parse(redoStack.pop());
 isRestoring=true;
 loadProject(next);
 isRestoring=false;
}
function applyZoom(){canvas.style.transformOrigin="top center";canvas.style.transform=`scale(${zoomLevel})`;zoomTxt.innerText=Math.round(zoomLevel*100)}
function zoomAll(delta){pushHistory();zoomLevel=Math.max(0.25,Math.min(3,zoomLevel+delta));applyZoom()}
function togglePanel(){document.querySelector(".layout").classList.toggle("panel-hidden")}
function toggleCorrectionFocus(){
 const active=document.body.classList.toggle("correction-focus");
 if(typeof focusModeBtn!=="undefined")focusModeBtn.innerText=active?"Фокус: вкл":"Фокус: выкл";
}
imageInput.onchange=e=>{let f=e.target.files[0];if(!f)return;pushHistory();let r=new FileReader();r.onload=x=>{planData=x.target.result;plan.src=planData;selectPlan()};r.readAsDataURL(f)}
overlayInput.onchange=e=>{let f=e.target.files[0];if(!f)return;pushHistory();let r=new FileReader();r.onload=x=>addOverlayImage({src:x.target.result});r.readAsDataURL(f)}
planRot.onfocus=()=>pushHistory();planRot.oninput=()=>setPlanRot(planRot.value);planOpacity.onfocus=()=>pushHistory();planOpacity.oninput=e=>{plan.style.opacity=e.target.value/100;planOpacityTxt.innerText=e.target.value};
function setPlanRot(v){
 let n=nd(v),delta=n-lastPlanRot;
 plan.dataset.rotation=n;
 planRot.value=fmtDeg(n);
 planDegTxt.innerText=fmtDeg(n);
 plan.style.transform=`translate(-50%,-50%) rotate(${n}deg)`;
 document.querySelectorAll(".vastu-grid").forEach(g=>{
  if(g.dataset.locked==="true"){
   let d=nd((+g.dataset.rot||0)+delta);
   g.dataset.rot=d;
   g.style.transform=`rotate(${d}deg)`;
   if(g===sel)updGridPanel();
  }
 });
 document.querySelectorAll(".axis-group").forEach(g=>{
  if(g.dataset.locked==="true"){
   let d=nd((+g.dataset.rotation||0)+delta);
   g.dataset.rotation=d;
   g.style.transform=`rotate(${d}deg)`;
   if(g===sel)updAxisPanel();
  }
 });
 lastPlanRot=n;
}
function stepPlan(x){pushHistory();setPlanRot((+planRot.value||0)+x)}
function updateGridTypography(grid){
 if(!grid)return 15;
 const width=parseFloat(grid.style.width)||grid.offsetWidth||480;
 const padding=width<230?2:width<360?4:6;
 const sample=grid.querySelector(".cell input");
 const fallbackWidth=(width/3-padding*2-3)*.9;
 const available=Math.max(10,(sample&&sample.clientWidth?sample.clientWidth:fallbackWidth)-8);
 const probe=document.createElement("canvas").getContext("2d");
 const family=sample?getComputedStyle(sample).fontFamily:"Arial, sans-serif";
 let size=15;
 const text=[...grid.querySelectorAll(".cell input")].map(input=>input.value||"");
 while(size>3.5){
  probe.font=`600 ${size}px ${family}`;
  if(text.every(value=>probe.measureText(value).width<=available))break;
  size-=.5;
 }
 grid.style.setProperty("--grid-font-size",size+"px");
 grid.style.setProperty("--grid-cell-padding",padding+"px");
 return size;
}
function addGrid(d={}){
 if(!isRestoring&&Object.keys(d).length===0)pushHistory();
 gridCounter++;
 const g=document.createElement("div");
 g.className="vastu-grid";
 g.dataset.gridId=d.gridId||("grid-"+gridCounter);
 g.dataset.rot=d.rotation??0;g.dataset.op=d.opacity??62;g.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";g.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
 g.style.left=(d.left??520+gridCounter*20)+"px";g.style.top=(d.top??330+gridCounter*20)+"px";g.style.width=(d.width??480)+"px";g.style.height=(d.height??480)+"px";g.style.transform=`rotate(${g.dataset.rot}deg)`;
 g.classList.toggle("locked",g.dataset.locked==="true");
 (d.directions??names).forEach((t,i)=>{
  const c=document.createElement("div"),inp=document.createElement("input");
  c.className="cell p"+(i+1);c.style.opacity=g.dataset.op/100;
  inp.value=t;inp.onfocus=()=>pushHistory();inp.oninput=()=>{updateGridTypography(g);buildInputs()};
  c.appendChild(inp);g.appendChild(c);
 });
 ["nw","n","ne","e","se","s","sw","w"].forEach(p=>{const h=document.createElement("div");h.className="handle "+p;h.onmousedown=startResize;h.ontouchstart=startResize;g.appendChild(h)});
 const rh=document.createElement("div");rh.className="rotate-handle";rh.onmousedown=startRot;rh.ontouchstart=startRot;g.appendChild(rh);
 g.onmousedown=startDrag;g.ontouchstart=startDrag;g.onclick=e=>{e.stopPropagation();select(g,"grid")};
 canvas.appendChild(g);updateGridTypography(g);applyLayerVisibility(g,"grid");select(g,"grid");
}
function select(e,t){clearSel();sel=e;selType=t;e.classList.add("selected");showProperties(t);if(t==="grid")updGridPanel();if(t==="label")updLabelPanel();if(t==="footnote")updFootnotePanel();if(t==="axis")updAxisPanel();if(t==="overlay")updOverlayPanel();if(t==="purusha")updPurushaPanel();if(t==="correction")updCorrectionPanel();refreshLayers()}
function updGridPanel(){
 if(!sel||selType!="grid")return;
 updateGridTypography(sel);
 const locked=sel.dataset.locked==="true";
 sel.classList.toggle("locked", locked);
 gridRot.value=fmtDeg(sel.dataset.rot||0);
 gridDeg.innerText=gridRot.value;
 gridOp.value=sel.dataset.op||62;
 gridOpTxt.innerText=gridOp.value;
 gridSize.value=sel.offsetWidth;
 gridSizeTxt.innerText=sel.offsetWidth+"x"+sel.offsetHeight;
 if(typeof gridWidth!=="undefined"){gridWidth.value=sel.offsetWidth;gridWidthTxt.innerText=sel.offsetWidth;}
 if(typeof gridHeight!=="undefined"){gridHeight.value=sel.offsetHeight;gridHeightTxt.innerText=sel.offsetHeight;}
 lockGrid.checked=locked;
 buildInputs();
}
function setGridRot(v){if(selType!="grid")return;if(sel.dataset.locked==="true")return;v=nd(v);sel.dataset.rot=v;sel.style.transform=`rotate(${v}deg)`;updGridPanel()}function stepGrid(x){pushHistory();setGridRot((+gridRot.value||0)+x)}
gridRot.onfocus=()=>pushHistory();gridRot.oninput=e=>setGridRot(e.target.value);lockGrid.onchange=e=>{if(selType=="grid"){pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked", e.target.checked);refreshLayers()}};gridOp.onfocus=()=>pushHistory();gridOp.oninput=e=>{if(selType!="grid")return;sel.dataset.op=e.target.value;sel.querySelectorAll(".cell").forEach(c=>c.style.opacity=e.target.value/100);gridOpTxt.innerText=e.target.value};gridSize.onfocus=()=>pushHistory();
gridSize.oninput=e=>{
 if(selType!="grid")return;
 if(sel.dataset.locked==="true"){updGridPanel();return;}
 sel.style.width=e.target.value+"px";
 sel.style.height=e.target.value+"px";
 updateGridTypography(sel);
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
  updateGridTypography(sel);
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
  updateGridTypography(sel);
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
function buildInputs(){directionInputs.innerHTML="";if(selType!="grid")return;updateGridTypography(sel);sel.querySelectorAll(".cell input").forEach((inp,i)=>{let d=document.createElement("div");d.className="control";d.style.marginBottom="7px";d.innerHTML='<label>Ячейка '+(i+1)+'</label>';let ed=document.createElement("input");ed.value=inp.value;ed.onfocus=()=>pushHistory();ed.oninput=()=>{inp.value=ed.value;updateGridTypography(sel)};d.appendChild(ed);directionInputs.appendChild(d)})}
function point(e){const p=e.touches?.[0]??e;const r=canvas.getBoundingClientRect();return{x:(p.clientX-r.left)/zoomLevel,y:(p.clientY-r.top)/zoomLevel}}function bind(){document.addEventListener("mousemove",move);document.addEventListener("mouseup",stop);document.addEventListener("touchmove",move,{passive:false});document.addEventListener("touchend",stop)}
function startDrag(e){
 if(e.target.classList.contains("handle")||e.target.classList.contains("rotate-handle")||e.target.tagName==="INPUT")return;
 const g=e.currentTarget;
 e.preventDefault();e.stopPropagation();
 select(g,"grid");
 if(g.dataset.locked==="true"){drag=null;return;}
 pushHistory();
 let p=point(e);drag={type:"drag",el:g,x:p.x,y:p.y,l:parseFloat(g.style.left),t:parseFloat(g.style.top)};bind()}
function startRot(e){e.preventDefault();e.stopPropagation();let g=e.target.closest(".vastu-grid");select(g,"grid");if(g.dataset.locked==="true"){drag=null;return;}pushHistory();drag={type:"rot",el:g,cx:parseFloat(g.style.left)+g.offsetWidth/2,cy:parseFloat(g.style.top)+g.offsetHeight/2};bind()}
function stop(){const finished=drag;drag=null;document.removeEventListener("mousemove",move);document.removeEventListener("mouseup",stop);document.removeEventListener("touchmove",move);document.removeEventListener("touchend",stop);if(finished?.type==="correction-caption")mergeCorrectionCaptionAtDrop(finished.el)}

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
 wrap.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
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
 applyLayerVisibility(wrap,"purusha");
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
 purushaRot.value=fmtDeg(sel.dataset.rotation||0);
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
lockPurusha.onchange=e=>{if(selType!=="purusha")return;pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked",e.target.checked);refreshLayers()};
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
function addOverlayImage(d={}){
 overlayCounter++;
 const wrap=document.createElement("div");
 wrap.className="overlay-wrap";
 wrap.dataset.src=d.src||"";
 wrap.dataset.opacity=d.opacity??100;
 wrap.dataset.width=d.width??420;
 wrap.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";
 wrap.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
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
 applyLayerVisibility(wrap,"overlay");
 select(wrap,"overlay");
}
function updOverlayPanel(){
 if(selType!=="overlay") return;
 lockOverlay.checked=sel.dataset.locked==="true";
 overlaySize.value=parseFloat(sel.style.width)||sel.offsetWidth||420;
 overlaySizeTxt.innerText=Math.round(parseFloat(sel.style.width)||sel.offsetWidth||420);
 overlayOp.value=sel.dataset.opacity||100;
 overlayOpTxt.innerText=sel.dataset.opacity||100;
 overlayRot.value=fmtDeg(sel.dataset.rotation||0);
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
lockOverlay.onchange=e=>{if(selType!=="overlay")return;pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked",e.target.checked);refreshLayers()};
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
const CORRECTIONS=window.CORRECTION_LIBRARY;
function correctionCategory(id){return CORRECTIONS.categories.find(category=>category.id===id)}
function correctionDefinition(categoryId,itemId){const category=correctionCategory(categoryId);return category&&category.items.find(item=>item.id===itemId)}
function getCorrectionMaterial(id){return CORRECTIONS.materials.find(material=>material.id===id)||CORRECTIONS.materials[0]}
function correctionShapeName(id){const shape=CORRECTIONS.spiralShapes.find(item=>item.id===id);return shape?shape.name:id}
function correctionArrangementName(id){const arrangement=CORRECTIONS.spiralArrangements.find(item=>item.id===id);return arrangement?arrangement.name:id}
function correctionTitle(data,def){return (data.caption||"").trim()||def.name}
function isGroupableCorrection(def){return def&&def.groupable===true}
function correctionParameterText(data,def){
 if(def.visual==="spiral"){
  let detail=getCorrectionMaterial(data.material).name+", "+correctionShapeName(data.shape)+", "+data.quantity+" шт.";
  return detail;
 }
 if(isGroupableCorrection(def)){
  const parts=[];
  if(num(data.quantity,1)>1)parts.push(num(data.quantity,1)+" шт.");
  if(isMeasuredCorrection(def)&&data.showWeight)parts.push(data.weight+" "+data.unit);
  return parts.join(", ");
 }
 if(isMeasuredCorrection(def)&&data.showWeight)return data.weight+" "+data.unit;
 return "";
}
function correctionCaptionValue(data,def){
 const detail=correctionParameterText(data,def);
 return detail?correctionTitle(data,def)+" · "+detail:correctionTitle(data,def);
}
function initCorrectionGroups(saved={}){
 CORRECTIONS.categories.forEach(category=>{
  const group=saved[category.id]||{};
  correctionGroups[category.id]={visible:group.visible!==false,opacity:num(group.opacity,100)};
 });
}
function svgData(svg){return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)}
function correctionSpiralPath(shape){
 if(shape==="square"){
  return "M92 94V6H6V94H77V21H21V79H63V36H36V65H52V49H47";
 }
 if(shape==="triangle"){
  return "M4 94L50 6L96 94H14L50 25L85 86H27L50 43L73 78H39L50 58L62 72H50";
 }
 const points=[];
 const turns=4;
 const total=turns*44;
 const start=Math.PI/3;
 for(let i=0;i<=total;i++){
  const p=i/total,angle=start+p*turns*Math.PI*2,radius=3+p*44;
  points.push((50+Math.cos(angle)*radius).toFixed(1)+","+(50+Math.sin(angle)*radius).toFixed(1));
 }
 return "M"+points.join("L");
}
function correctionSpiralLayout(quantity,arrangement="compact"){
 if(arrangement==="line"&&quantity>1){
  const gap=2,pad=3,size=(100-pad*2-gap*(quantity-1))/quantity;
  return Array.from({length:quantity},(_,index)=>({x:pad+index*(size+gap),y:(100-size)/2,s:size/100}));
 }
 if(quantity===5)return [{x:35,y:35,s:.3},{x:8,y:8,s:.3},{x:62,y:8,s:.3},{x:8,y:62,s:.3},{x:62,y:62,s:.3}];
 if(quantity===7)return [{x:36,y:36,s:.28},{x:36,y:5,s:.28},{x:63,y:20,s:.28},{x:63,y:53,s:.28},{x:36,y:67,s:.28},{x:9,y:53,s:.28},{x:9,y:20,s:.28}];
 if(quantity===9)return [3,35,67].flatMap(y=>[3,35,67].map(x=>({x,y,s:.3})));
 return [{x:5,y:5,s:.9}];
}
function correctionSpiralArt(data,def,color){
 const path=correctionSpiralPath(data.shape||def.shape);
 const quantity=num(data.quantity,num(data.turns,def.quantity||1));
 return correctionSpiralLayout(quantity,data.arrangement||def.arrangement||"compact").map(item=>`<g transform="translate(${item.x} ${item.y}) scale(${item.s})"><path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="miter"/><path d="${path}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="miter"/></g>`).join("");
}
function correctionGroupLayout(quantity){
 const q=Math.max(1,num(quantity,1));
 if(q===3)return [{x:22,y:50},{x:50,y:50},{x:78,y:50}];
 if(q===4)return [{x:28,y:28},{x:72,y:28},{x:28,y:72},{x:72,y:72}];
 if(q===5)return [{x:50,y:50},{x:22,y:22},{x:78,y:22},{x:22,y:78},{x:78,y:78}];
 if(q===7)return [{x:50,y:50},{x:50,y:16},{x:78,y:32},{x:78,y:68},{x:50,y:84},{x:22,y:68},{x:22,y:32}];
 if(q===9)return [20,50,80].flatMap(y=>[20,50,80].map(x=>({x,y})));
 return [{x:50,y:50}];
}
function correctionPebbleArt(data,def,color){
 const quantity=Math.max(1,num(data.quantity,def.quantity||1));
 const stone=`<path d="M-13 2C-14-8-5-15 6-14C17-13 23-4 21 7C19 17 10 23-2 21C-12 20-18 12-13 2Z" fill="url(#g)" stroke="${color}" stroke-width="2"/>`;
 const items=correctionGroupLayout(quantity).map((point,index)=>{
  const rot=(index%5-2)*8;
  const scale=quantity>1?.78:1.65;
  return `<g transform="translate(${point.x} ${point.y}) rotate(${rot}) scale(${scale})">${stone}</g>`;
 }).join("");
 return `<defs><radialGradient id="g" cx="30%" cy="22%"><stop stop-color="#fff"/><stop offset=".24" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".75"/></radialGradient></defs>${items}`;
}
function correctionToiletCorrectionArt(data,def,color){
 const accent=def.accent||"#6b837f";
 const beads=[[18,22],[18,36],[18,56],[18,70],[82,22],[82,36],[82,56],[82,70],[42,88],[58,88]]
  .map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i>7?4:3.4}" fill="${i%2?accent:color}" opacity=".82"/>`).join("");
 return `<g opacity=".92"><rect x="34" y="11" width="32" height="18" rx="5" fill="#f5f7f8" stroke="#cbd2d6"/><path d="M33 33C35 21 65 21 67 33C71 54 64 82 50 86C36 82 29 54 33 33Z" fill="#f5f7f8" stroke="#cbd2d6" stroke-width="2"/><ellipse cx="50" cy="47" rx="14" ry="18" fill="#e7edf0" stroke="#cbd2d6"/></g>${beads}`;
}
function correctionToiletTrianglesArt(data,def,color){
 const accent=def.accent||"#e07b39";
 const toilet=correctionToiletCorrectionArt(data,{...def,accent:color},color);
 const triangles=[[18,23],[82,23],[18,57],[82,57],[50,85]].map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M0-9L9 8H-9Z" fill="${color}" stroke="#8f745f" stroke-width="1.5"/><circle cx="0" cy="2" r="3" fill="${accent}"/></g>`).join("");
 return toilet+triangles;
}
function correctionBrahmasthanArt(data,def,color){
 const accent=def.accent||"#9a7a31";
 let grid=`<rect x="18" y="18" width="64" height="64" fill="#fff" fill-opacity=".35" stroke="#9d9488" stroke-width="2"/>`;
 [39.3,60.7].forEach(v=>{grid+=`<line x1="${v}" y1="18" x2="${v}" y2="82" stroke="#9d9488" stroke-width="1"/><line x1="18" y1="${v}" x2="82" y2="${v}" stroke="#9d9488" stroke-width="1"/>`;});
 const dots=[26,50,74].flatMap(y=>[26,50,74].map(x=>`<circle cx="${x}" cy="${y}" r="4.4" fill="${color}"/><circle cx="${x+3}" cy="${y+4}" r="3.2" fill="${accent}" opacity=".78"/>`)).join("");
 return grid+dots;
}
function correctionRatnaDhyayiArt(data,def,color){
 const accent=def.accent||"#4a8a6a";
 let body=`<rect x="12" y="12" width="76" height="76" fill="#fff" fill-opacity=".22" stroke="#777" stroke-width="2"/><path d="M12 37H88M12 63H88M37 12V88M63 12V88" stroke="#777" stroke-width="1.3" opacity=".75"/><path d="M12 12L88 88M88 12L12 88" stroke="#777" stroke-width="1" opacity=".35"/>`;
 const stones=[
  [34,36,"#345f9e"],[50,36,accent],[66,36,"#7fc9dc"],
  [34,52,"#345f9e"],[50,52,color],[66,52,"#cc503d"],
  [34,68,"#345f9e"],[50,68,accent],[66,68,"#d8a538"]
 ];
 stones.forEach(([x,y,c])=>{body+=`<circle cx="${x}" cy="${y}" r="4" fill="${c}" stroke="#fff" stroke-width="1"/>`;});
 return body;
}
function correctionArt(data){
 const def=correctionDefinition(data.category,data.item);
 if(!def)return "";
 const color=def.color||getCorrectionMaterial(data.material||def.material).color;
 const dark="#3d3a35",light="#fff";
 let body="";
 if(def.visual==="stone") body=`<defs><radialGradient id="g" cx="35%" cy="25%"><stop stop-color="${light}" stop-opacity=".8"/><stop offset=".26" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".62"/></radialGradient></defs><polygon points="50,7 77,20 92,48 73,81 50,94 25,82 8,48 24,21" fill="url(#g)" stroke="${color}" stroke-width="3"/><path d="M24 21L50 35 77 20M50 35V94M8 48H92" stroke="${light}" opacity=".35"/>`;
 if(def.visual==="pebble") body=correctionPebbleArt(data,def,color);
 if(def.visual==="pearl") body=`<defs><radialGradient id="g" cx="30%" cy="25%"><stop stop-color="#fff"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="#b9b3ab"/></radialGradient></defs><circle cx="50" cy="50" r="38" fill="url(#g)" stroke="#d2ccc3" stroke-width="2"/>`;
 if(def.visual==="coral") body=`<path d="M48 90V47M48 55L30 36V18M48 68L70 48V27M30 39L18 29M70 50L83 37M48 42L56 28V12" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"/><path d="M48 90V47M48 55L30 36M48 68L70 48" fill="none" stroke="#ee8271" stroke-width="3" opacity=".55"/>`;
 if(def.visual==="spiral") body=correctionSpiralArt(data,def,color);
 if(def.visual==="wire") body=`<path d="M5 53H95" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><path d="M8 49H92" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`;
 if(def.visual==="metal") body=`<defs><linearGradient id="g"><stop stop-color="#fff" stop-opacity=".65"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".65"/></linearGradient></defs><rect x="15" y="20" width="70" height="60" rx="9" fill="url(#g)" stroke="${dark}" stroke-opacity=".38" stroke-width="2"/><path d="M25 35H75M25 45H63" stroke="#fff" stroke-opacity=".35"/>`;
 if(def.visual==="lingam") body=`<defs><linearGradient id="g"><stop stop-color="#fff" stop-opacity=".7"/><stop offset=".3" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".7"/></linearGradient></defs><ellipse cx="50" cy="84" rx="36" ry="9" fill="${color}" opacity=".6"/><path d="M34 76V36C34 16 66 16 66 36V76Z" fill="url(#g)" stroke="${dark}" stroke-opacity=".3" stroke-width="2"/><ellipse cx="50" cy="76" rx="29" ry="8" fill="${color}"/>`;
 if(def.visual==="pyramid") body=`<defs><linearGradient id="g"><stop stop-color="#fff" stop-opacity=".42"/><stop offset=".2" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".63"/></linearGradient></defs><path d="M50 10L92 82H8Z" fill="url(#g)" stroke="${dark}" stroke-opacity=".35" stroke-width="2"/><path d="M50 10V82M8 82H92" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>`;
 if(def.visual==="film") body=`<rect x="9" y="18" width="82" height="64" rx="5" fill="${color}" opacity=".46" stroke="${color}" stroke-width="3"/><path d="M16 30H84M16 43H84M16 56H84M16 69H84" stroke="#fff" stroke-opacity=".45"/>`;
 if(def.visual==="curtain") body=`<path d="M15 12H85V88H15Z" fill="${color}"/><path d="M23 15C17 36 28 64 22 86M39 15C33 36 44 64 38 86M56 15C50 36 61 64 55 86M73 15C67 36 78 64 72 86" stroke="#fff" stroke-opacity=".32" stroke-width="4"/>`;
 if(def.visual==="fire") body=`<path d="M52 92C28 92 18 76 25 57C30 44 41 39 39 21C55 29 57 40 59 45C65 36 70 29 69 19C89 39 86 55 84 64C82 81 68 92 52 92Z" fill="${color}" stroke="#ae4329" stroke-width="2"/><path d="M51 83C42 83 38 75 41 68C43 62 49 58 49 51C58 56 64 65 63 72C62 79 57 83 51 83Z" fill="#ffc45a"/>`;
 if(def.visual==="kitchen") body=`<rect x="10" y="16" width="80" height="68" rx="6" fill="${color}" opacity=".25" stroke="${color}" stroke-width="3"/><rect x="17" y="24" width="35" height="53" rx="3" fill="${color}" opacity=".65"/><circle cx="28" cy="38" r="8" fill="none" stroke="${light}" stroke-width="2"/><circle cx="42" cy="61" r="7" fill="none" stroke="${light}" stroke-width="2"/><rect x="59" y="26" width="23" height="23" rx="5" fill="none" stroke="${color}" stroke-width="3"/><path d="M65 35H77M71 29V41M59 62H82" stroke="${color}" stroke-width="3"/>`;
 if(def.visual==="bed") body=`<rect x="9" y="17" width="82" height="66" rx="7" fill="${color}" opacity=".36" stroke="${color}" stroke-width="3"/><rect x="13" y="20" width="23" height="60" rx="5" fill="${color}"/><rect x="18" y="28" width="13" height="19" rx="5" fill="${light}" opacity=".75"/><path d="M40 25H84M40 76H84" stroke="${color}" stroke-width="3"/>`;
 if(def.visual==="toilet") body=`<rect x="33" y="12" width="34" height="23" rx="5" fill="${color}" opacity=".55" stroke="${color}" stroke-width="3"/><ellipse cx="50" cy="60" rx="25" ry="30" fill="${light}" stroke="${color}" stroke-width="4"/><ellipse cx="50" cy="57" rx="15" ry="20" fill="${color}" opacity=".28" stroke="${color}" stroke-width="2"/><circle cx="60" cy="20" r="2.5" fill="${dark}"/>`;
 if(def.visual==="sink") body=`<rect x="13" y="18" width="74" height="64" rx="14" fill="${color}" opacity=".22" stroke="${color}" stroke-width="3"/><ellipse cx="50" cy="53" rx="26" ry="20" fill="${light}" stroke="${color}" stroke-width="3"/><circle cx="50" cy="54" r="4" fill="${color}"/><path d="M50 32V25C50 17 65 17 65 25V34" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
 if(def.visual==="wardrobe") body=`<rect x="18" y="8" width="64" height="84" rx="3" fill="${color}" opacity=".3" stroke="${color}" stroke-width="4"/><path d="M50 10V90M25 19H44M56 19H75" stroke="${color}" stroke-width="2"/><circle cx="45" cy="51" r="3" fill="${color}"/><circle cx="55" cy="51" r="3" fill="${color}"/>`;
 if(def.visual==="sofa") body=`<rect x="9" y="22" width="82" height="57" rx="13" fill="${color}" opacity=".38" stroke="${color}" stroke-width="3"/><rect x="18" y="30" width="64" height="40" rx="9" fill="${color}" opacity=".72"/><path d="M18 52H82M50 31V69" stroke="${light}" stroke-opacity=".5" stroke-width="2"/><rect x="9" y="33" width="10" height="35" rx="4" fill="${color}"/><rect x="81" y="33" width="10" height="35" rx="4" fill="${color}"/>`;
 if(def.visual==="table") body=`<circle cx="50" cy="50" r="27" fill="${color}" opacity=".7" stroke="${color}" stroke-width="3"/><rect x="40" y="8" width="20" height="13" rx="3" fill="${color}" opacity=".4"/><rect x="40" y="79" width="20" height="13" rx="3" fill="${color}" opacity=".4"/><rect x="8" y="40" width="13" height="20" rx="3" fill="${color}" opacity=".4"/><rect x="79" y="40" width="13" height="20" rx="3" fill="${color}" opacity=".4"/>`;
 if(def.visual==="table-rect") body=`<rect x="15" y="25" width="70" height="50" rx="5" fill="${color}" opacity=".72" stroke="${color}" stroke-width="3"/><rect x="24" y="8" width="20" height="13" rx="3" fill="${color}" opacity=".42"/><rect x="56" y="8" width="20" height="13" rx="3" fill="${color}" opacity=".42"/><rect x="24" y="79" width="20" height="13" rx="3" fill="${color}" opacity=".42"/><rect x="56" y="79" width="20" height="13" rx="3" fill="${color}" opacity=".42"/><path d="M28 31H72M28 69H72" stroke="#fff" stroke-opacity=".38" stroke-width="2"/>`;
 if(def.visual==="tv") body=`<rect x="9" y="16" width="82" height="55" rx="5" fill="${dark}" stroke="${color}" stroke-width="4"/><rect x="16" y="23" width="68" height="39" rx="3" fill="#dceef3" opacity=".72"/><path d="M22 57L77 28" stroke="#fff" stroke-width="3" opacity=".45"/><path d="M50 72V84M33 86H67" stroke="${dark}" stroke-width="6" stroke-linecap="round"/><path d="M40 72H60" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
 if(def.visual==="window") body=`<rect x="5" y="30" width="90" height="40" rx="3" fill="#eaf6fb" stroke="${color}" stroke-width="4"/><path d="M50 31V69M9 50H91M14 36L42 64M58 36L86 64" stroke="${color}" stroke-width="2" opacity=".72"/>`;
 if(def.visual==="shower") body=`<rect x="12" y="12" width="76" height="76" rx="10" fill="${color}" opacity=".2" stroke="${color}" stroke-width="4"/><circle cx="50" cy="50" r="24" fill="#fff" fill-opacity=".45" stroke="${color}" stroke-width="2"/><circle cx="50" cy="50" r="5" fill="${color}"/><path d="M18 82L82 18M18 18L82 82" stroke="${color}" stroke-width="2" opacity=".58"/>`;
 if(def.visual==="fridge") body=`<rect x="24" y="6" width="52" height="88" rx="5" fill="${color}" opacity=".25" stroke="${color}" stroke-width="4"/><path d="M25 39H75M66 17V32M66 50V83" stroke="${color}" stroke-width="4" stroke-linecap="round"/><path d="M34 16H56M34 51H56" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>`;
 if(def.visual==="washer") body=`<rect x="10" y="10" width="80" height="80" rx="7" fill="${color}" opacity=".22" stroke="${color}" stroke-width="4"/><circle cx="50" cy="56" r="25" fill="#eaf4f7" stroke="${color}" stroke-width="4"/><circle cx="50" cy="56" r="16" fill="${color}" opacity=".28"/><circle cx="25" cy="24" r="4" fill="${color}"/><path d="M39 24H76" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
 if(def.visual==="cabinet") body=`<rect x="19" y="7" width="62" height="86" rx="3" fill="${color}" opacity=".32" stroke="${color}" stroke-width="4"/><path d="M50 9V91M25 24H44M56 24H75M25 75H44M56 75H75" stroke="${color}" stroke-width="2"/><circle cx="44" cy="51" r="3" fill="${color}"/><circle cx="56" cy="51" r="3" fill="${color}"/>`;
 if(def.visual==="door") body=`<path d="M12 85H88M16 85V19H55" fill="none" stroke="${dark}" stroke-width="5"/><path d="M16 20H75V84H16Z" fill="${color}" opacity=".42" stroke="${color}" stroke-width="3"/><path d="M16 84A59 59 0 0 0 75 25" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 3"/><circle cx="67" cy="55" r="3" fill="${dark}"/>`;
 if(def.visual==="powder") body=`<path d="M16 73C17 46 33 29 51 28C69 27 85 44 86 73Z" fill="${color}"/><ellipse cx="51" cy="73" rx="36" ry="9" fill="#c98725"/><circle cx="39" cy="42" r="3" fill="#f3ce63"/><circle cx="59" cy="47" r="2" fill="#f3ce63"/>`;
 if(def.visual==="plant") body=`<path d="M50 87V33M48 51C26 47 21 27 22 20C40 19 51 30 50 47M51 60C73 57 80 39 79 31C60 29 50 41 50 57" fill="${color}" stroke="${color}" stroke-width="4"/><path d="M31 85H69L64 96H36Z" fill="#b7784b"/>`;
 if(def.visual==="bottle") body=`<path d="M42 15H58V27L64 35V84C64 90 36 90 36 84V35L42 27Z" fill="${color}" opacity=".82" stroke="#285575" stroke-width="2"/><rect x="42" y="9" width="16" height="7" rx="2" fill="#284d6e"/><path d="M43 40V74" stroke="#fff" opacity=".45" stroke-width="4"/>`;
 if(def.visual==="chime") body=`<path d="M27 29H73L62 18H38Z" fill="${color}" stroke="${dark}" stroke-opacity=".32"/><path d="M35 31V73M48 31V82M61 31V73" stroke="${color}" stroke-width="5"/><circle cx="48" cy="87" r="5" fill="${color}"/>`;
 if(def.visual==="bowl") body=`<path d="M13 44C17 76 32 87 50 87C68 87 83 76 87 44Z" fill="${color}" opacity=".6" stroke="#81afbd" stroke-width="3"/><ellipse cx="50" cy="43" rx="37" ry="9" fill="#dff3f6" stroke="#81afbd" stroke-width="3"/>`;
 if(def.visual==="yantra") body=`<rect x="12" y="12" width="76" height="76" fill="#fbf1cd" stroke="${color}" stroke-width="3"/><circle cx="50" cy="50" r="29" fill="none" stroke="${color}" stroke-width="2"/><path d="M50 20L75 68H25ZM50 80L25 33H75Z" fill="none" stroke="${color}" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="${color}"/>`;
 if(def.visual==="mirror") body=`<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".35" stop-color="${color}"/><stop offset=".7" stop-color="#effbff"/></linearGradient></defs><ellipse cx="50" cy="47" rx="33" ry="40" fill="url(#g)" stroke="#a58d63" stroke-width="5"/><path d="M40 87H60V96H40Z" fill="#a58d63"/><path d="M34 31L58 17" stroke="#fff" stroke-width="5" opacity=".75"/>`;
 if(def.visual==="cosmic-necklace-triangle") body=`<path d="M50 5L95 91H5Z" fill="${color}"/><circle cx="50" cy="61" r="14" fill="${def.accent}"/>`;
 if(def.visual==="cosmic-necklace-pair") body=`<circle cx="50" cy="34" r="27" fill="${color}"/><circle cx="50" cy="70" r="27" fill="${def.accent}"/>`;
 if(def.visual==="toilet-correction") body=correctionToiletCorrectionArt(data,def,color);
 if(def.visual==="toilet-triangles") body=correctionToiletTrianglesArt(data,def,color);
 if(def.visual==="brahmasthan-grid") body=correctionBrahmasthanArt(data,def,color);
 if(def.visual==="ratna-dhyayi") body=correctionRatnaDhyayiArt(data,def,color);
 return svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`);
}
function isMeasuredCorrection(def){return def.measurable!==false&&def.weight!==undefined}
function correctionState(el){
 return {category:el.dataset.category,item:el.dataset.item,left:parseFloat(el.style.left),top:parseFloat(el.style.top),width:num(el.dataset.width,80),height:num(el.dataset.height,80),rotation:num(el.dataset.rotation,0),opacity:num(el.dataset.opacity,100),locked:el.dataset.locked||"false",visible:isLayerVisible(el),keepRatio:el.dataset.keepRatio!=="false",weight:num(el.dataset.weight,0),unit:el.dataset.unit||"г",showWeight:el.dataset.showWeight!=="false",showCaption:el.dataset.showCaption!=="false",caption:el.dataset.caption||"",captionDx:num(el.dataset.captionDx,0),captionDy:num(el.dataset.captionDy,0),captionRotation:num(el.dataset.captionRotation,0),captionGroup:el.dataset.captionGroup||"",captionHost:el.dataset.captionHost==="true",captionTargetX:num(el.dataset.captionTargetX,null),captionTargetY:num(el.dataset.captionTargetY,null),material:el.dataset.material||"",shape:el.dataset.shape||"",quantity:num(el.dataset.quantity,1),arrangement:el.dataset.arrangement||"compact"};
}
function applyCorrectionGroup(el){
 const group=correctionGroups[el.dataset.category]||{visible:true,opacity:100};
 el.hidden=!isLayerVisible(el)||!group.visible;
 el.style.opacity=(num(el.dataset.opacity,100)*num(group.opacity,100)/10000).toFixed(3);
}
function correctionCaptionGroupMembers(el){
 const group=el.dataset.captionGroup;
 if(!group)return[el];
 return[...document.querySelectorAll(".correction-object")].filter(item=>item.dataset.captionGroup===group);
}
function correctionCaptionIsVisible(el){
 const group=correctionGroups[el.dataset.category]||{visible:true};
 return el.dataset.showCaption!=="false"&&isLayerVisible(el)&&group.visible!==false;
}
function correctionLocalToWorld(el,x,y){
 const width=num(el.dataset.width,el.offsetWidth||80),height=num(el.dataset.height,el.offsetHeight||80);
 const cx=parseFloat(el.style.left)+width/2,cy=parseFloat(el.style.top)+height/2,angle=num(el.dataset.rotation,0)*Math.PI/180;
 const dx=x-width/2,dy=y-height/2;
 return{x:cx+dx*Math.cos(angle)-dy*Math.sin(angle),y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
function correctionWorldToLocal(el,x,y){
 const width=num(el.dataset.width,el.offsetWidth||80),height=num(el.dataset.height,el.offsetHeight||80);
 const cx=parseFloat(el.style.left)+width/2,cy=parseFloat(el.style.top)+height/2,angle=-num(el.dataset.rotation,0)*Math.PI/180;
 const dx=x-cx,dy=y-cy;
 return{x:width/2+dx*Math.cos(angle)-dy*Math.sin(angle),y:height/2+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
function correctionCaptionWorldCenter(el){
 const caption=el.querySelector(".correction-caption");
 const width=num(el.dataset.width,el.offsetWidth||80),height=num(el.dataset.height,el.offsetHeight||80);
 return correctionLocalToWorld(el,width/2+num(el.dataset.captionDx,0),height+7+num(el.dataset.captionDy,0)+(caption?.offsetHeight||22)/2);
}
function correctionCaptionGroupTarget(members,host){
 const x=num(host.dataset.captionTargetX,null),y=num(host.dataset.captionTargetY,null);
 if(x!==null&&y!==null)return{x,y};
 const target=correctionCaptionWorldCenter(host);
 members.forEach(member=>{member.dataset.captionTargetX=target.x;member.dataset.captionTargetY=target.y;});
 return target;
}
function setCorrectionCaptionGroupTarget(members,target){
 members.forEach(member=>{member.dataset.captionTargetX=target.x;member.dataset.captionTargetY=target.y;});
}
function clearCorrectionCaptionGroupData(el){
 delete el.dataset.captionGroup;
 delete el.dataset.captionHost;
 delete el.dataset.captionTargetX;
 delete el.dataset.captionTargetY;
}
function setIndependentCorrectionCaptionTarget(el,target){
 const caption=el.querySelector(".correction-caption");
 const width=num(el.dataset.width,el.offsetWidth||80),height=num(el.dataset.height,el.offsetHeight||80);
 const local=correctionWorldToLocal(el,target.x,target.y);
 el.dataset.captionDx=Math.round(local.x-width/2);
 el.dataset.captionDy=Math.round(local.y-height-7-(caption?.offsetHeight||22)/2);
}
function detachCorrectionCaption(el){
 if(!el.dataset.captionGroup)return;
 const members=correctionCaptionGroupMembers(el);
 const host=members.find(member=>member.dataset.captionHost==="true")||members[0]||el;
 const target=correctionCaptionGroupTarget(members,host);
 clearCorrectionCaptionGroupData(el);
 setIndependentCorrectionCaptionTarget(el,target);
 const remaining=members.filter(member=>member!==el);
 if(remaining.length===1){
  clearCorrectionCaptionGroupData(remaining[0]);
  setIndependentCorrectionCaptionTarget(remaining[0],target);
  updateSingleCorrectionCaptionPosition(remaining[0]);
 }else if(remaining.length>1){
  refreshCorrectionCaptionGroup(remaining[0]);
 }
 updateSingleCorrectionCaptionPosition(el);
}
function ensureCorrectionCaptionGroupConsistency(el){
 if(!el.dataset.captionGroup)return;
 const text=el.querySelector(".correction-caption")?.innerText.trim()||"";
 const mismatch=correctionCaptionGroupMembers(el).some(member=>member!==el&&(member.querySelector(".correction-caption")?.innerText.trim()||"")!==text);
 if(mismatch)detachCorrectionCaption(el);
}
function mergeCorrectionCaptions(source,target){
 if(!source||!target||source===target)return;
 const sourceText=source.querySelector(".correction-caption")?.innerText.trim()||"";
 const targetText=target.querySelector(".correction-caption")?.innerText.trim()||"";
 if(!sourceText||sourceText!==targetText)return;
 const sourceMembers=correctionCaptionGroupMembers(source),targetMembers=correctionCaptionGroupMembers(target);
 if(source.dataset.captionGroup&&source.dataset.captionGroup===target.dataset.captionGroup)return;
 const targetHost=targetMembers.find(member=>member.dataset.captionHost==="true"&&correctionCaptionIsVisible(member))||targetMembers.find(correctionCaptionIsVisible)||target;
 const targetPoint=target.dataset.captionGroup?correctionCaptionGroupTarget(targetMembers,targetHost):correctionCaptionWorldCenter(target);
 const group=target.dataset.captionGroup||source.dataset.captionGroup||"caption-"+Date.now()+"-"+(++captionGroupCounter);
 const members=[...new Set([...sourceMembers,...targetMembers])];
 members.forEach(member=>{
  member.dataset.captionGroup=group;
  member.dataset.captionHost=member===targetHost?"true":"false";
 });
 setCorrectionCaptionGroupTarget(members,targetPoint);
 refreshCorrectionCaptionGroup(targetHost);
}
function correctionCaptionRectsOverlap(a,b,gap=10){
 return !(a.right+gap<b.left||b.right+gap<a.left||a.bottom+gap<b.top||b.bottom+gap<a.top);
}
function mergeCorrectionCaptionAtDrop(source){
 if(!source?.isConnected)return;
 const caption=source.querySelector(".correction-caption");
 if(!caption||caption.hidden)return;
 const rect=caption.getBoundingClientRect(),text=caption.innerText.trim();
 if(!text)return;
 const candidates=[...document.querySelectorAll(".correction-object .correction-caption")]
  .filter(candidate=>candidate!==caption&&!candidate.hidden&&candidate.innerText.trim()===text&&correctionCaptionRectsOverlap(rect,candidate.getBoundingClientRect()))
  .sort((a,b)=>{
   const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
   return Math.hypot(ar.left-rect.left,ar.top-rect.top)-Math.hypot(br.left-rect.left,br.top-rect.top);
  });
 if(candidates.length)mergeCorrectionCaptions(source,candidates[0].closest(".correction-object"));
}
function setCorrectionCaptionLineVisible(el,visible){
 const link=el.querySelector(".correction-link");
 if(!link)return;
 link.hidden=!visible;
 link.style.display=visible?"":"none";
}
function updateSingleCorrectionCaptionPosition(el){
 const caption=el.querySelector(".correction-caption"),link=el.querySelector(".correction-link"),line=link&&link.querySelector("line");
 if(!caption||!link||!line)return;
 caption.hidden=!correctionCaptionIsVisible(el);
 const width=num(el.dataset.width,el.offsetWidth||80),height=num(el.dataset.height,el.offsetHeight||80);
 const dx=num(el.dataset.captionDx,0),dy=num(el.dataset.captionDy,0);
 const captionRotation=num(el.dataset.captionRotation,0)-num(el.dataset.rotation,0);
 caption.style.transform=`translateX(calc(-50% + ${dx}px)) translateY(${dy}px) rotate(${captionRotation}deg)`;
 link.setAttribute("width",width);
 link.setAttribute("height",height);
 line.setAttribute("x1",width/2);
 line.setAttribute("y1",height/2);
 line.setAttribute("x2",width/2+dx);
 line.setAttribute("y2",height+7+dy+(caption.offsetHeight||22)/2);
 setCorrectionCaptionLineVisible(el,!caption.hidden);
}
function refreshCorrectionCaptionGroup(el){
 const members=correctionCaptionGroupMembers(el);
 const visible=members.filter(correctionCaptionIsVisible);
 let host=visible.find(member=>member.dataset.captionHost==="true")||visible[0]||null;
 if(!host){
  members.forEach(member=>{member.querySelector(".correction-caption").hidden=true;setCorrectionCaptionLineVisible(member,false);});
  return;
 }
 members.forEach(member=>member.dataset.captionHost=member===host?"true":"false");
 const target=correctionCaptionGroupTarget(members,host);
 members.forEach(member=>{
  const caption=member.querySelector(".correction-caption"),link=member.querySelector(".correction-link"),line=link.querySelector("line");
  const width=num(member.dataset.width,member.offsetWidth||80),height=num(member.dataset.height,member.offsetHeight||80);
  const local=correctionWorldToLocal(member,target.x,target.y);
  const dx=local.x-width/2,dy=local.y-height-7-(caption.offsetHeight||22)/2;
  const captionRotation=num(member.dataset.captionRotation,0)-num(member.dataset.rotation,0);
  caption.style.transform=`translateX(calc(-50% + ${dx}px)) translateY(${dy}px) rotate(${captionRotation}deg)`;
  caption.hidden=member!==host;
  line.setAttribute("x1",width/2);line.setAttribute("y1",height/2);line.setAttribute("x2",local.x);line.setAttribute("y2",local.y);
  setCorrectionCaptionLineVisible(member,correctionCaptionIsVisible(member));
 });
}
function refreshAllCorrectionCaptionGroups(){
 const done=new Set();
 document.querySelectorAll(".correction-object").forEach(el=>{
  const key=el.dataset.captionGroup||el;
  if(done.has(key))return;
  done.add(key);
  if(el.dataset.captionGroup)refreshCorrectionCaptionGroup(el);else updateSingleCorrectionCaptionPosition(el);
 });
}
function updateCorrectionCaptionPosition(el){
 if(el.dataset.captionGroup)refreshCorrectionCaptionGroup(el);else updateSingleCorrectionCaptionPosition(el);
}
function updateCorrectionArt(el){
 const data=correctionState(el),def=correctionDefinition(data.category,data.item),img=el.querySelector("img");
 img.src=correctionArt(data);
 const caption=el.querySelector(".correction-caption");
 caption.innerText=correctionCaptionValue(data,def);
 caption.hidden=!data.showCaption;
 ensureCorrectionCaptionGroupConsistency(el);
 updateCorrectionCaptionPosition(el);
 requestAnimationFrame(()=>{if(el.isConnected)updateCorrectionCaptionPosition(el)});
 applyCorrectionGroup(el);
}
function correctionDetail(el){
 const data=correctionState(el),def=correctionDefinition(data.category,data.item);
 const detail=correctionParameterText(data,def);
 if(detail)return detail;
 return correctionCategory(data.category).name;
}
function applyCorrectionGroups(){
 document.querySelectorAll(".correction-object").forEach(applyCorrectionGroup);
 refreshAllCorrectionCaptionGroups();
 refreshLayers();
}
function renderCorrectionLibrary(search=""){
 if(!correctionCategories)return;
 const query=search.trim().toLowerCase();
 correctionCategories.innerHTML="";
 CORRECTIONS.categories.forEach((category,index)=>{
  const items=category.items.filter(item=>!query||item.name.toLowerCase().includes(query)||category.name.toLowerCase().includes(query));
  if(!items.length)return;
  const group=correctionGroups[category.id]||{visible:true,opacity:100};
  const block=document.createElement("details");
  block.className="correction-category";
  block.dataset.category=category.id;
  block.open=!!query||index<2;
  const summary=document.createElement("summary");
  summary.innerHTML=`<span>${category.name}</span><small>${items.length}</small>`;
  block.appendChild(summary);
  const controls=document.createElement("div");
  controls.className="correction-group-controls";
  const visible=document.createElement("label");
  visible.title="Показать или скрыть весь раздел";
  visible.innerHTML=`<input type="checkbox" ${group.visible?"checked":""}> Показать`;
  visible.querySelector("input").onchange=e=>{
   pushHistory();
   correctionGroups[category.id].visible=e.target.checked;
   if(!e.target.checked&&selType==="correction"&&sel.dataset.category===category.id)clearSel();
   applyCorrectionGroups();
  };
  const opacity=document.createElement("label");
  opacity.className="category-opacity";
  opacity.innerHTML=`<span>${group.opacity}%</span><input type="range" min="0" max="100" value="${group.opacity}">`;
  const slider=opacity.querySelector("input"),amount=opacity.querySelector("span");
  slider.onfocus=()=>pushHistory();
  slider.oninput=e=>{
   correctionGroups[category.id].opacity=+e.target.value;
   amount.innerText=e.target.value+"%";
   applyCorrectionGroups();
  };
  controls.append(visible,opacity);
  block.appendChild(controls);
  const choices=document.createElement("div");
  choices.className="correction-choices";
  items.forEach(item=>{
   const button=document.createElement("button");
   button.type="button";
   button.className="correction-choice";
   button.dataset.category=category.id;
   button.dataset.item=item.id;
   const preview=document.createElement("img");
   preview.src=correctionArt({category:category.id,item:item.id,material:item.material,shape:item.shape,quantity:item.quantity,arrangement:item.arrangement});
   preview.alt="";
   const name=document.createElement("span");
   name.innerText=item.name;
   button.append(preview,name);
   button.onclick=()=>addCorrection(category.id,item.id);
   choices.appendChild(button);
  });
  block.appendChild(choices);
  correctionCategories.appendChild(block);
 });
}
function initCorrectionLibrary(){
 initCorrectionGroups();
 correctionMaterial.innerHTML=CORRECTIONS.materials.map(item=>`<option value="${item.id}">${item.name}</option>`).join("");
 correctionShape.innerHTML=CORRECTIONS.spiralShapes.map(item=>`<option value="${item.id}">${item.name}</option>`).join("");
 correctionQuantity.innerHTML=CORRECTIONS.spiralQuantities.map(item=>`<option value="${item}">${item} шт.</option>`).join("");
 correctionArrangement.innerHTML=CORRECTIONS.spiralArrangements.map(item=>`<option value="${item.id}">${item.name}</option>`).join("");
 if(typeof correctionStoneQuantity!=="undefined")correctionStoneQuantity.innerHTML=CORRECTIONS.stoneGroupQuantities.map(item=>`<option value="${item}">${item} шт.</option>`).join("");
 correctionSearch.oninput=e=>renderCorrectionLibrary(e.target.value);
 renderCorrectionLibrary();
}
function addCorrection(categoryId,itemId,d={}){
 const def=correctionDefinition(categoryId,itemId);
 if(!def)return;
 if(!isRestoring&&Object.keys(d).length===0)pushHistory();
 correctionCounter++;
 const wrap=document.createElement("div");
 const width=d.width??def.size??80,ratio=def.aspect??1,height=d.height??Math.round(width/ratio);
 wrap.className="correction-object";
 wrap.dataset.category=categoryId;wrap.dataset.item=itemId;
 wrap.dataset.width=width;wrap.dataset.height=height;wrap.dataset.rotation=d.rotation??0;wrap.dataset.opacity=d.opacity??100;
 wrap.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";wrap.dataset.keepRatio=d.keepRatio===false||d.keepRatio==="false"||(!("keepRatio" in d)&&def.keepRatio===false)?"false":"true";
 wrap.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
 wrap.dataset.weight=d.weight??def.weight??0;wrap.dataset.unit=d.unit||"г";wrap.dataset.showWeight=d.showWeight===false||d.showWeight==="false"?"false":"true";wrap.dataset.showCaption=d.showCaption===false||d.showCaption==="false"?"false":"true";wrap.dataset.caption=d.caption??def.caption??def.name;wrap.dataset.material=d.material||def.material||"copper";wrap.dataset.shape=d.shape||def.shape||"circle";wrap.dataset.quantity=d.quantity??d.turns??def.quantity??1;wrap.dataset.arrangement=d.arrangement||def.arrangement||"compact";
 wrap.dataset.captionDx=d.captionDx??0;wrap.dataset.captionDy=d.captionDy??0;wrap.dataset.captionRotation=d.captionRotation??0;
 if(d.captionGroup)wrap.dataset.captionGroup=d.captionGroup;
 if(d.captionHost===true||d.captionHost==="true")wrap.dataset.captionHost="true";
 if(d.captionTargetX!==undefined&&d.captionTargetX!==null)wrap.dataset.captionTargetX=d.captionTargetX;
 if(d.captionTargetY!==undefined&&d.captionTargetY!==null)wrap.dataset.captionTargetY=d.captionTargetY;
 const place=defaultPlacement(width,height,correctionCounter-1);
 wrap.style.left=(d.left??place.left)+"px";wrap.style.top=(d.top??place.top)+"px";wrap.style.width=width+"px";wrap.style.height=height+"px";wrap.style.transform=`rotate(${wrap.dataset.rotation}deg)`;
 wrap.classList.toggle("locked",wrap.dataset.locked==="true");
 const link=document.createElementNS("http://www.w3.org/2000/svg","svg");link.classList.add("correction-link");
 const line=document.createElementNS("http://www.w3.org/2000/svg","line");link.appendChild(line);wrap.appendChild(link);
 const img=document.createElement("img");img.alt=def.name;wrap.appendChild(img);
 const caption=document.createElement("span");caption.className="correction-caption";caption.onmousedown=startCorrectionCaptionDrag;caption.ontouchstart=startCorrectionCaptionDrag;wrap.appendChild(caption);
 ["nw","n","ne","e","se","s","sw","w"].forEach(pos=>{const h=document.createElement("div");h.className="correction-handle "+pos;h.onmousedown=startCorrectionResize;h.ontouchstart=startCorrectionResize;wrap.appendChild(h)});
 const rotate=document.createElement("div");rotate.className="correction-rotate-handle";rotate.onmousedown=startCorrectionRot;rotate.ontouchstart=startCorrectionRot;wrap.appendChild(rotate);
 prepGeneric(wrap,"correction");canvas.appendChild(wrap);updateCorrectionArt(wrap);select(wrap,"correction");
}
function updCorrectionPanel(){
 if(selType!=="correction")return;
 const data=correctionState(sel),def=correctionDefinition(data.category,data.item),category=correctionCategory(data.category);
 correctionName.innerText=def.name;correctionCategoryName.innerText=category.name;correctionPreview.src=correctionArt(data);
 lockCorrection.checked=data.locked==="true";correctionOp.value=data.opacity;correctionOpTxt.innerText=data.opacity;correctionRot.value=fmtDeg(data.rotation);correctionRotTxt.innerText=correctionRot.value;
 correctionShowCaption.checked=data.showCaption;correctionCaptionText.value=data.caption||def.name;
 correctionCaptionRot.value=fmtDeg(data.captionRotation);correctionCaptionRotTxt.innerText=correctionCaptionRot.value;
 correctionKeepRatio.checked=data.keepRatio;correctionWidth.value=Math.round(data.width);correctionHeight.value=Math.round(data.height);correctionSize.value=Math.min(600,Math.round(data.width));correctionSizeTxt.innerText=Math.round(data.width);
 correctionMeasurement.hidden=!isMeasuredCorrection(def);correctionShowWeight.checked=data.showWeight;correctionWeightFields.hidden=!data.showWeight;correctionWeight.value=data.weight;correctionWeightUnit.value=data.unit;
 spiralControls.hidden=def.visual!=="spiral";correctionMaterial.value=data.material;correctionShape.value=data.shape;correctionQuantity.value=String(data.quantity);correctionArrangement.value=data.arrangement;spiralArrangementField.hidden=data.quantity<=1;
 if(typeof stoneGroupControls!=="undefined"){
  stoneGroupControls.hidden=!isGroupableCorrection(def);
  if(isGroupableCorrection(def))correctionStoneQuantity.value=String(data.quantity);
 }
}
function setCorrectionRotation(value){if(selType!=="correction")return;if(sel.dataset.locked==="true"){updCorrectionPanel();return;}const rotation=nd(value);sel.dataset.rotation=rotation;sel.style.transform=`rotate(${rotation}deg)`;updateCorrectionCaptionPosition(sel);updCorrectionPanel()}
function stepCorrectionRot(delta){pushHistory();setCorrectionRotation(num(correctionRot.value,0)+delta)}
function setCorrectionCaptionRotation(value){if(selType!=="correction")return;if(sel.dataset.locked==="true"){updCorrectionPanel();return;}const rotation=nd(value);sel.dataset.captionRotation=rotation;updateCorrectionCaptionPosition(sel);updCorrectionPanel()}
function stepCorrectionCaptionRot(delta){pushHistory();setCorrectionCaptionRotation(num(correctionCaptionRot.value,0)+delta)}
function updateCorrectionDimensions(width,height){
 if(selType!=="correction"||sel.dataset.locked==="true")return;
 const w=Math.max(8,Math.min(2000,num(width,80))),h=Math.max(8,Math.min(2000,num(height,80)));
 sel.dataset.width=w;sel.dataset.height=h;sel.style.width=w+"px";sel.style.height=h+"px";updateCorrectionArt(sel);updCorrectionPanel();
}
function duplicateCorrection(){if(selType!=="correction")return;pushHistory();const data=correctionState(sel);data.left+=24;data.top+=24;delete data.captionGroup;delete data.captionHost;delete data.captionTargetX;delete data.captionTargetY;addCorrection(data.category,data.item,data)}
function startCorrectionResize(e){
 e.preventDefault();e.stopPropagation();const el=e.target.closest(".correction-object");select(el,"correction");if(el.dataset.locked==="true")return;pushHistory();
 const p=point(e),handle=[...e.target.classList].find(c=>["nw","n","ne","e","se","s","sw","w"].includes(c))||"se";
 drag={type:"correction-resize",el,handle,x:p.x,y:p.y,w:el.offsetWidth,h:el.offsetHeight,l:parseFloat(el.style.left),t:parseFloat(el.style.top),ratio:el.offsetWidth/el.offsetHeight};
 bind();
}
function startCorrectionRot(e){
 e.preventDefault();e.stopPropagation();const el=e.target.closest(".correction-object");select(el,"correction");if(el.dataset.locked==="true")return;pushHistory();
 drag={type:"correction-rot",el,cx:parseFloat(el.style.left)+el.offsetWidth/2,cy:parseFloat(el.style.top)+el.offsetHeight/2};bind();
}
function startCorrectionCaptionDrag(e){
 e.preventDefault();e.stopPropagation();
 const el=e.target.closest(".correction-object");
 select(el,"correction");
 if(el.dataset.locked==="true")return;
 pushHistory();
 const p=point(e);
 const members=correctionCaptionGroupMembers(el),target=el.dataset.captionGroup?correctionCaptionGroupTarget(members,el):null;
 drag={type:"correction-caption",el,x:p.x,y:p.y,dx:num(el.dataset.captionDx,0),dy:num(el.dataset.captionDy,0),rot:num(el.dataset.rotation,0)*Math.PI/180,targetX:target?.x,targetY:target?.y};
 bind();
}
lockCorrection.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.locked=e.target.checked?"true":"false";sel.classList.toggle("locked",e.target.checked);refreshLayers()};
correctionOp.onfocus=()=>pushHistory();
correctionOp.oninput=e=>{if(selType!=="correction")return;sel.dataset.opacity=e.target.value;correctionOpTxt.innerText=e.target.value;applyCorrectionGroup(sel)};
correctionRot.onfocus=()=>pushHistory();
correctionRot.oninput=e=>setCorrectionRotation(e.target.value);
correctionKeepRatio.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.keepRatio=e.target.checked?"true":"false"};
correctionWidth.onfocus=()=>pushHistory();
correctionWidth.oninput=e=>{
 if(selType!=="correction")return;
 const data=correctionState(sel),width=num(e.target.value,data.width);
 const height=data.keepRatio?width*data.height/data.width:data.height;
 updateCorrectionDimensions(width,height);
};
correctionHeight.onfocus=()=>pushHistory();
correctionHeight.oninput=e=>{
 if(selType!=="correction")return;
 const data=correctionState(sel),height=num(e.target.value,data.height);
 const width=data.keepRatio?height*data.width/data.height:data.width;
 updateCorrectionDimensions(width,height);
};
correctionSize.onfocus=()=>pushHistory();
correctionSize.oninput=e=>{
 if(selType!=="correction")return;
 const data=correctionState(sel),width=num(e.target.value,data.width);
 updateCorrectionDimensions(width,width*data.height/data.width);
};
correctionWeight.onfocus=()=>pushHistory();
correctionWeight.oninput=e=>{if(selType!=="correction")return;sel.dataset.weight=e.target.value||0;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionShowWeight.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.showWeight=e.target.checked?"true":"false";updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionWeightUnit.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.unit=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionShowCaption.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.showCaption=e.target.checked?"true":"false";updateCorrectionArt(sel);refreshLayers()};
correctionCaptionText.onfocus=()=>pushHistory();
correctionCaptionText.oninput=e=>{if(selType!=="correction")return;sel.dataset.caption=e.target.value;updateCorrectionArt(sel);refreshLayers()};
correctionCaptionRot.onfocus=()=>pushHistory();
correctionCaptionRot.oninput=e=>setCorrectionCaptionRotation(e.target.value);
correctionMaterial.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.material=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionShape.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.shape=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionQuantity.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.quantity=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
correctionArrangement.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.arrangement=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
if(typeof correctionStoneQuantity!=="undefined")correctionStoneQuantity.onchange=e=>{if(selType!=="correction")return;pushHistory();sel.dataset.quantity=e.target.value;updateCorrectionArt(sel);updCorrectionPanel();refreshLayers()};
function addTextLabel(d={}){if(!isRestoring && Object.keys(d).length===0) pushHistory();labelCounter++;let l=document.createElement("div");l.className="text-label";l.dataset.rot=d.rotation??0;l.dataset.fs=d.fontSize??22;l.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";l.innerText=d.text??"Надпись";const place=defaultPlacement(120,38,labelCounter-1);l.style.left=(d.left??place.left)+"px";l.style.top=(d.top??place.top)+"px";l.style.fontSize=l.dataset.fs+"px";l.style.transform=`rotate(${l.dataset.rot}deg)`;prepGeneric(l,"label");canvas.appendChild(l);applyLayerVisibility(l,"label");select(l,"label");updLabelPanel()}
function duplicateTextLabel(){if(selType!=="label")return;pushHistory();addTextLabel({left:parseFloat(sel.style.left)+24,top:parseFloat(sel.style.top)+24,text:sel.innerText,rotation:num(sel.dataset.rot,0),fontSize:num(sel.dataset.fs,22),visible:isLayerVisible(sel)})}
function updLabelPanel(){if(selType!="label")return;labelText.value=sel.innerText;fontSize.value=sel.dataset.fs;fontTxt.innerText=sel.dataset.fs;labelRot.value=fmtDeg(sel.dataset.rot||0);labelDeg.innerText=labelRot.value}
labelText.onfocus=()=>pushHistory();labelText.oninput=e=>{if(selType=="label")sel.innerText=e.target.value||" "};fontSize.onfocus=()=>pushHistory();fontSize.oninput=e=>{if(selType=="label"){sel.dataset.fs=e.target.value;sel.style.fontSize=e.target.value+"px";fontTxt.innerText=e.target.value}};labelRot.onfocus=()=>pushHistory();labelRot.oninput=e=>{if(selType=="label"){const rot=nd(e.target.value);sel.dataset.rot=rot;sel.style.transform=`rotate(${rot}deg)`;labelDeg.innerText=fmtDeg(rot)}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function footnoteState(el){
 return {left:parseFloat(el.style.left),top:parseFloat(el.style.top),width:num(el.dataset.width,240),height:num(el.dataset.height,160),title:el.dataset.title||"Сноска "+(el.dataset.index||""),text:el.dataset.text||"",fontSize:num(el.dataset.fontSize,14),format:el.dataset.format||"paragraphs",visible:isLayerVisible(el)};
}
function formattedFootnoteHTML(text,format){
 const raw=String(text||"").trim();
 if(!raw)return "<p>Комментарий по коррекциям</p>";
 if(format==="numbered"){
  return raw.split(/\n+/).map(line=>line.trim()).filter(Boolean).map((line,index)=>`<p>${index+1}. ${esc(line)}</p>`).join("");
 }
 if(format==="bullets"){
  return raw.split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>`<p>• ${esc(line)}</p>`).join("");
 }
 return raw.split(/\n{2,}/).map(block=>`<p>${esc(block.trim()).replaceAll("\n","<br>")}</p>`).join("");
}
function fitFootnoteText(el){
 requestAnimationFrame(()=>{
  if(!el.isConnected)return;
  const body=el.querySelector(".footnote-body");
  if(!body)return;
  let size=num(el.dataset.fontSize,14);
  body.style.fontSize=size+"px";
  body.style.lineHeight="1.38";
  while(size>9&&(body.scrollHeight>body.clientHeight+1||body.scrollWidth>body.clientWidth+1)){
   size-=.5;
   body.style.fontSize=size+"px";
  }
 });
}
function updateFootnote(el){
 const data=footnoteState(el);
 el.dataset.width=data.width;el.dataset.height=data.height;
 el.style.width=data.width+"px";el.style.height=data.height+"px";
 el.querySelector(".footnote-title").innerText=data.title||"Сноска";
 el.querySelector(".footnote-body").innerHTML=formattedFootnoteHTML(data.text,data.format);
 fitFootnoteText(el);
}
function addFootnote(d={}){
 if(!isRestoring&&Object.keys(d).length===0)pushHistory();
 footnoteCounter++;
 const wrap=document.createElement("div");
 const width=d.width??240,height=d.height??160;
 wrap.className="footnote";
 wrap.dataset.index=footnoteCounter;
 wrap.dataset.title=d.title||"Сноска "+footnoteCounter;
 wrap.dataset.text=d.text||"";
 wrap.dataset.fontSize=d.fontSize??14;
 wrap.dataset.format=d.format||"paragraphs";
 wrap.dataset.width=width;wrap.dataset.height=height;
 wrap.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
 const place=defaultPlacement(width,height,footnoteCounter-1);
 wrap.style.left=(d.left??place.left)+"px";wrap.style.top=(d.top??place.top)+"px";
 const header=document.createElement("div");header.className="footnote-header";
 const title=document.createElement("span");title.className="footnote-title";header.appendChild(title);
 const body=document.createElement("div");body.className="footnote-body";
 wrap.append(header,body);
 ["nw","n","ne","e","se","s","sw","w"].forEach(pos=>{const h=document.createElement("div");h.className="footnote-handle "+pos;h.onmousedown=startFootnoteResize;h.ontouchstart=startFootnoteResize;wrap.appendChild(h)});
 prepGeneric(wrap,"footnote");canvas.appendChild(wrap);updateFootnote(wrap);applyLayerVisibility(wrap,"footnote");select(wrap,"footnote");
}
function duplicateFootnote(){
 if(selType!=="footnote")return;
 pushHistory();
 const data=footnoteState(sel);
 data.left+=24;data.top+=24;data.title=data.title+" копия";
 addFootnote(data);
}
function updFootnotePanel(){
 if(selType!=="footnote")return;
 const data=footnoteState(sel);
 footnoteTitle.value=data.title;footnoteText.value=data.text;footnoteFormat.value=data.format;
 footnoteFontSize.value=data.fontSize;footnoteFontTxt.innerText=data.fontSize;
 footnoteWidth.value=Math.round(data.width);footnoteHeight.value=Math.round(data.height);
}
function updateFootnoteDimensions(width,height){
 if(selType!=="footnote")return;
 sel.dataset.width=clamp(num(width,240),120,900);
 sel.dataset.height=clamp(num(height,160),80,700);
 updateFootnote(sel);updFootnotePanel();
}
function startFootnoteResize(e){
 e.preventDefault();e.stopPropagation();
 const el=e.target.closest(".footnote");
 select(el,"footnote");
 pushHistory();
 const p=point(e);
 const handle=[...e.target.classList].find(c=>["nw","n","ne","e","se","s","sw","w"].includes(c))||"se";
 drag={type:"footnote-resize",el,handle,x:p.x,y:p.y,w:el.offsetWidth,h:el.offsetHeight,l:parseFloat(el.style.left),t:parseFloat(el.style.top)};
 bind();
}
footnoteTitle.onfocus=()=>pushHistory();
footnoteTitle.oninput=e=>{if(selType!=="footnote")return;sel.dataset.title=e.target.value||"Сноска";updateFootnote(sel);refreshLayers()};
footnoteText.onfocus=()=>pushHistory();
footnoteText.oninput=e=>{if(selType!=="footnote")return;sel.dataset.text=e.target.value;updateFootnote(sel);};
footnoteFormat.onchange=e=>{if(selType!=="footnote")return;pushHistory();sel.dataset.format=e.target.value;updateFootnote(sel);};
footnoteFontSize.onfocus=()=>pushHistory();
footnoteFontSize.oninput=e=>{if(selType!=="footnote")return;sel.dataset.fontSize=e.target.value;footnoteFontTxt.innerText=e.target.value;updateFootnote(sel);};
footnoteWidth.onfocus=()=>pushHistory();
footnoteWidth.oninput=e=>{if(selType==="footnote")updateFootnoteDimensions(e.target.value,sel.dataset.height)};
footnoteHeight.onfocus=()=>pushHistory();
footnoteHeight.oninput=e=>{if(selType==="footnote")updateFootnoteDimensions(sel.dataset.width,e.target.value)};
function workingAreaCenter(){
 const selectedGrid=selType==="grid"&&sel&&isLayerVisible(sel)?sel:null;
 const grid=selectedGrid||document.querySelector(".vastu-grid:not([hidden])");
 if(grid)return{x:parseFloat(grid.style.left)+grid.offsetWidth/2,y:parseFloat(grid.style.top)+grid.offsetHeight/2};
 return{x:canvas.clientWidth/2,y:canvas.clientHeight/2};
}
function defaultPlacement(width=80,height=80,index=0){
 const anchor=workingAreaCenter();
 const offsets=[
  {x:-width/2,y:-height/2},
  {x:40,y:-height/2},
  {x:-width-40,y:-height/2},
  {x:-width/2,y:38},
  {x:-width/2,y:-height-38},
  {x:40,y:38},
  {x:-width-40,y:38},
  {x:40,y:-height-38},
  {x:-width-40,y:-height-38}
 ];
 const offset=offsets[index%offsets.length];
 return{
  left:Math.round(Math.max(0,Math.min(1600-width,anchor.x+offset.x))),
  top:Math.round(Math.max(0,Math.min(1200-height,anchor.y+offset.y)))
 };
}
function addSticker(color,d={}){
 if(!isRestoring&&Object.keys(d).length===0)pushHistory();
 stickerCounter++;
 const s=document.createElement("div");
 const size=d.size??38;
 const anchor=workingAreaCenter();
 const offsets=[{x:0,y:0},{x:34,y:0},{x:0,y:34},{x:-34,y:0},{x:0,y:-34},{x:34,y:34},{x:-34,y:34},{x:-34,y:-34},{x:34,y:-34}];
 const offset=offsets[(stickerCounter-1)%offsets.length];
 s.className="sticker";s.dataset.color=d.color??color;s.dataset.size=size;s.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
 s.innerText="★";s.style.color=s.dataset.color==="green"?"#18a558":"#d62828";
 s.style.left=(d.left??Math.round(anchor.x-size/2+offset.x))+"px";s.style.top=(d.top??Math.round(anchor.y-size/2+offset.y))+"px";s.style.fontSize=size+"px";
 prepGeneric(s,"sticker");canvas.appendChild(s);applyLayerVisibility(s,"sticker");select(s,"sticker");
}
function resizeSticker(n){if(selType!="sticker")return;pushHistory();let sz=Math.max(12,(+sel.dataset.size||38)+n*4);sel.dataset.size=sz;sel.style.fontSize=sz+"px"}
function duplicateSticker(){
 if(selType!="sticker")return;
 pushHistory();
 addSticker(sel.dataset.color,{left:parseFloat(sel.style.left)+24,top:parseFloat(sel.style.top)+24,color:sel.dataset.color,size:num(sel.dataset.size,38),visible:true});
}
const MAX_AXIS_GROUPS=2;
function currentAxis(){return selType==="axis"?sel:null}
function addAxes(d={}){
 const existing=[...document.querySelectorAll(".axis-group")];
 if(!isRestoring&&Object.keys(d).length===0&&existing.length>=MAX_AXIS_GROUPS){
  alert("Можно добавить до двух наборов осей.");
  select(existing[existing.length-1],"axis");
  return;
 }
 if(!isRestoring&&Object.keys(d).length===0) pushHistory();
 axisCounter++;
 const len=num(d.len,1800);
 const selectedGrid=selType==="grid"&&sel&&isLayerVisible(sel)?sel:null;
 const anchor=workingAreaCenter();
 let wrap=document.createElement("div");
 wrap.className="axis-group axis";
 wrap.dataset.locked=(d.locked==="true"||d.locked===true)?"true":"false";
 wrap.dataset.visible=d.visible===false||d.visible==="false"?"false":"true";
 wrap.dataset.len=len;
 wrap.dataset.opacity=d.opacity??100;
 wrap.dataset.rotation=d.rotation??0;
 wrap.dataset.axisIndex=d.axisIndex??axisCounter;
 wrap.dataset.targetGridId=d.targetGridId||selectedGrid?.dataset.gridId||"";
 wrap.style.left=(d.left??Math.round(anchor.x-len/2))+"px";
 wrap.style.top=(d.top??Math.round(anchor.y))+"px";
 wrap.style.width=len+"px";
 wrap.style.height="2px";
 wrap.style.background="transparent";
 wrap.style.transform=`rotate(${wrap.dataset.rotation}deg)`;
 wrap.classList.toggle("locked",wrap.dataset.locked==="true");
 [90,0,45,135].forEach(rot=>{
   let a=document.createElement("div");
   a.className="axis-line";
   a.dataset.rot=rot;
   a.style.position="absolute";
   a.style.left="0";
   a.style.top="0";
   a.style.width=len+"px";
   a.style.height="2px";
   a.style.background="#111";
   a.style.opacity="1";
   a.style.transformOrigin=(len/2)+"px center";
   a.style.transform=`rotate(${rot}deg)`;
   wrap.appendChild(a);
 });
 wrap.onmousedown=startAxisDrag;
 wrap.ontouchstart=startAxisDrag;
 wrap.onclick=e=>{e.stopPropagation();select(wrap,"axis")};
 canvas.appendChild(wrap);
 updateAxisVisual(wrap);
 applyLayerVisibility(wrap,"axis");
 select(wrap,"axis");
}
function updateAxisVisual(g){
 if(!g) return;
 const len=+g.dataset.len||1800;
 const op=(+g.dataset.opacity||100)/100;
 g.style.width=len+"px";
 g.style.height="2px";
 g.style.transform=`rotate(${g.dataset.rotation||0}deg)`;
 g.classList.toggle("locked",g.dataset.locked==="true");
 g.querySelectorAll(".axis-line").forEach(line=>{
   line.style.width=len+"px";
   line.style.transformOrigin=(len/2)+"px center";
   line.style.opacity=op;
 });
}
function updAxisPanel(){
 if(selType!=="axis") return;
 lockAxes.checked=sel.dataset.locked==="true";
 buildAxisTargetOptions(sel);
 axisRot.value=fmtDeg(sel.dataset.rotation||0);
 axisRotTxt.innerText=axisRot.value;
 axisLen.value=sel.dataset.len||1800;
 axisLenTxt.innerText=sel.dataset.len||1800;
 axisOp.value=sel.dataset.opacity||100;
 axisOpTxt.innerText=sel.dataset.opacity||100;
}
function buildAxisTargetOptions(axis){
 if(typeof axisTargetGrid==="undefined")return;
 const grids=[...document.querySelectorAll(".vastu-grid")];
 axisTargetGrid.innerHTML='<option value="">Авто: ближайшая сетка</option>';
 grids.forEach((grid,index)=>{
  if(!grid.dataset.gridId)grid.dataset.gridId="grid-"+(index+1);
  const option=document.createElement("option");
  option.value=grid.dataset.gridId;
  option.textContent="Сетка "+(index+1);
  axisTargetGrid.appendChild(option);
 });
 axisTargetGrid.value=axis.dataset.targetGridId||"";
}
function gridCenter(grid){
 return{
  x:parseFloat(grid.style.left)+grid.offsetWidth/2,
  y:parseFloat(grid.style.top)+grid.offsetHeight/2
 };
}
function axisCenter(axis){
 const len=num(axis.dataset.len,axis.offsetWidth||1800);
 return{x:parseFloat(axis.style.left)+len/2,y:parseFloat(axis.style.top)+1};
}
function findGridForAxis(axis){
 const allGrids=[...document.querySelectorAll(".vastu-grid")];
 const linked=axis.dataset.targetGridId&&allGrids.find(grid=>grid.dataset.gridId===axis.dataset.targetGridId);
 if(linked)return linked;
 const grids=allGrids.filter(isLayerVisible);
 if(!grids.length)return null;
 const center=axisCenter(axis);
 const nearest=grids.reduce((best,grid)=>{
  const gCenter=gridCenter(grid);
  const distance=(gCenter.x-center.x)**2+(gCenter.y-center.y)**2;
  return !best||distance<best.distance?{grid,distance}:best;
 },null)?.grid||null;
 if(nearest)axis.dataset.targetGridId=nearest.dataset.gridId||"";
 return nearest;
}
function brahmasthanCenter(axis=null){
 const selectedGrid=selType==="grid"&&sel&&isLayerVisible(sel)?sel:null;
 const grid=selectedGrid||(axis?findGridForAxis(axis):document.querySelector(".vastu-grid:not([hidden])"));
 return grid?gridCenter(grid):null;
}
function centerAxisOnBrahmasthan(){
 const g=currentAxis();
 if(!g)return;
 if(g.dataset.locked==="true"){updAxisPanel();return;}
 const center=brahmasthanCenter(g);
 if(!center){alert("Сначала добавьте сетку 3x3: центр Брахмастана берётся из её центральной ячейки.");return;}
 pushHistory();
 const len=num(g.dataset.len,1800);
 g.style.left=(center.x-len/2)+"px";
 g.style.top=(center.y-1)+"px";
 updateAxisVisual(g);
 updAxisPanel();
 refreshLayers();
}
function setAxisRot(value){
 const g=currentAxis();
 if(!g||g.dataset.locked==="true"){updAxisPanel();return;}
 const rotation=nd(value);
 g.dataset.rotation=rotation;
 updateAxisVisual(g);
 updAxisPanel();
}
function stepAxisRot(delta){
 if(selType!=="axis")return;
 pushHistory();
 setAxisRot((+axisRot.value||0)+delta);
}
function setAxisLength(value){
 const g=currentAxis();
 if(!g||g.dataset.locked==="true"){updAxisPanel();return;}
 const oldLen=num(g.dataset.len,1800);
 const newLen=Math.max(200,Math.min(2400,+value||oldLen));
 const center=parseFloat(g.style.left)+oldLen/2;
 g.dataset.len=newLen;
 g.style.left=(center-newLen/2)+"px";
 axisLenTxt.innerText=newLen;
 updateAxisVisual(g);
}
axisRot.onfocus=()=>pushHistory();
axisRot.oninput=e=>setAxisRot(e.target.value);
if(typeof axisTargetGrid!=="undefined"){
 axisTargetGrid.onchange=e=>{const g=currentAxis();if(!g)return;pushHistory();g.dataset.targetGridId=e.target.value;};
}
axisLen.onfocus=()=>pushHistory();
axisLen.oninput=e=>setAxisLength(e.target.value);
axisOp.onfocus=()=>pushHistory();
axisOp.oninput=e=>{const g=currentAxis();if(!g)return;g.dataset.opacity=e.target.value;axisOpTxt.innerText=e.target.value;updateAxisVisual(g);};

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
lockAxes.onchange=e=>{const g=currentAxis(); if(g){pushHistory();g.dataset.locked=e.target.checked?"true":"false";g.classList.toggle("locked",e.target.checked);refreshLayers()}};

function prepGeneric(el,type){el.onmousedown=e=>{e.preventDefault();e.stopPropagation();select(el,type);if((type==="overlay"||type==="purusha"||type==="correction")&&el.dataset.locked==="true"){drag=null;return;}pushHistory();let p=point(e);drag={type:"generic",el,x:p.x,y:p.y,l:parseFloat(el.style.left),t:parseFloat(el.style.top)};bind()};el.ontouchstart=el.onmousedown;el.onclick=e=>{e.stopPropagation();select(el,type)}}
function delSel(){if(!sel)return;pushHistory();if(selType==="plan"){planData="";plan.removeAttribute("src");planOpacity.value=85;plan.style.opacity=.85;planOpacityTxt.innerText="85";lastPlanRot=0;setPlanRot(0)}else{sel.remove();refreshAllCorrectionCaptionGroups()}clearSel()}canvas.onclick=clearSel;
function collect(options={}){
 const includePlanData=options.includePlanData!==false;
 const currentPlanRef=planDataRef(planData);
 let grids=[...document.querySelectorAll(".vastu-grid")].map(g=>({gridId:g.dataset.gridId||"",left:parseFloat(g.style.left),top:parseFloat(g.style.top),width:g.offsetWidth,height:g.offsetHeight,rotation:num(g.dataset.rot,0),opacity:num(g.dataset.op,62),fontSize:updateGridTypography(g),locked:g.dataset.locked||"false",visible:isLayerVisible(g),directions:[...g.querySelectorAll(".cell input")].map(i=>i.value)}));
 let labels=[...document.querySelectorAll(".text-label")].map(l=>({left:parseFloat(l.style.left),top:parseFloat(l.style.top),text:l.innerText,rotation:num(l.dataset.rot,0),fontSize:num(l.dataset.fs,22),visible:isLayerVisible(l)}));
 let footnotes=[...document.querySelectorAll(".footnote")].map(footnoteState);
 let stickers=[...document.querySelectorAll(".sticker")].map(s=>({left:parseFloat(s.style.left),top:parseFloat(s.style.top),color:s.dataset.color,size:num(s.dataset.size,38),visible:isLayerVisible(s)}));
 let axes=[...document.querySelectorAll(".axis-group")].map(a=>({left:parseFloat(a.style.left),top:parseFloat(a.style.top),locked:a.dataset.locked||"false",visible:isLayerVisible(a),len:num(a.dataset.len,1800),opacity:num(a.dataset.opacity,100),rotation:num(a.dataset.rotation,0),axisIndex:num(a.dataset.axisIndex,1),targetGridId:a.dataset.targetGridId||""}));
 let overlays=[...document.querySelectorAll(".overlay-wrap")].map(o=>({left:parseFloat(o.style.left),top:parseFloat(o.style.top),src:o.dataset.src,width:num(o.dataset.width,parseFloat(o.style.width)||420),height:o.offsetHeight,opacity:num(o.dataset.opacity,100),locked:o.dataset.locked||"false",visible:isLayerVisible(o),rotation:num(o.dataset.rotation,0)}));
 let purushas=[...document.querySelectorAll(".purusha-grid")].map(o=>{let p={left:parseFloat(o.style.left),top:parseFloat(o.style.top),width:num(o.dataset.width,parseFloat(o.style.width)||PURUSHA_DEFAULT_WIDTH),height:num(o.dataset.height,parseFloat(o.style.height)||PURUSHA_DEFAULT_HEIGHT),opacity:num(o.dataset.opacity,100),locked:o.dataset.locked||"false",visible:isLayerVisible(o),rotation:num(o.dataset.rotation,0)};if(o.dataset.src&&o.dataset.src!==PURUSHA_GRID_SRC)p.src=o.dataset.src;return p});
 let corrections=[...document.querySelectorAll(".correction-object")].map(correctionState);
 let groups=Object.fromEntries(Object.entries(correctionGroups).map(([key,value])=>[key,{visible:value.visible,opacity:value.opacity}]));
 return{version:PROJECT_VERSION,planImageData:includePlanData?planData:undefined,planImageRef:currentPlanRef,planVisible:isLayerVisible(plan),planRotation:num(plan.dataset.rotation,planRot.value),planOpacity:num(planOpacity.value,85),zoomLevel,grids,labels,footnotes,stickers,axes,overlays,purushas,corrections,correctionGroups:groups};
}
function cleanFileBaseName(value,fallback){
 const cleaned=String(value||"").trim().replace(/\.(json|png|pdf)$/i,"").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim();
 return cleaned||fallback;
}
function askFileBaseName(message,fallback){
 const value=window.prompt(message,fallback);
 return value===null?null:cleanFileBaseName(value,fallback);
}
function pngExportScale(){
 const value=typeof pngQuality!=="undefined"?pngQuality.value:1;
 return Math.max(1,Math.min(3,Number(value)||1));
}
function saveProject(){
 const name=askFileBaseName("Название файла проекта",projectBaseName);
 if(!name)return;
 projectBaseName=name;
 download(new Blob([JSON.stringify(collect(),null,2)],{type:"application/json"}),name+".json");
}
projectInput.onchange=e=>{let f=e.target.files[0];if(!f)return;projectBaseName=cleanFileBaseName(f.name,projectBaseName);let r=new FileReader();r.onload=x=>{try{const p=JSON.parse(x.target.result);pushHistory();isRestoring=true;loadProject(p);isRestoring=false;}catch(err){isRestoring=false;alert("Не удалось открыть проект: файл поврежден или имеет неверный формат.");}};r.readAsText(f)}
function listFromProject(project,key){return Array.isArray(project[key])?project[key]:[]}
function migrateProject(project={}){
 return{
  ...project,
  version:project.version||"legacy",
  grids:listFromProject(project,"grids").map((grid,index)=>({...grid,gridId:grid.gridId||"grid-"+(index+1)})),
  labels:listFromProject(project,"labels"),
  footnotes:listFromProject(project,"footnotes"),
  stickers:listFromProject(project,"stickers"),
  axes:listFromProject(project,"axes").slice(0,MAX_AXIS_GROUPS),
  overlays:listFromProject(project,"overlays"),
  purushas:listFromProject(project,"purushas"),
  corrections:listFromProject(project,"corrections"),
  correctionGroups:project.correctionGroups||{}
 };
}
function clearProjectElements(){
 document.querySelectorAll(".vastu-grid,.text-label,.footnote,.sticker,.axis,.overlay-wrap,.overlay-img,.purusha-grid,.correction-object").forEach(x=>x.remove());
 clearSel();
}
function restorePlanState(project){
 planData=resolvePlanData(project);
 planDataRef(planData);
 if(planData)plan.src=planData;else plan.removeAttribute("src");
 plan.dataset.visible=project.planVisible===false?"false":"true";
 applyLayerVisibility(plan,"plan");
 planOpacity.value=project.planOpacity??85;
 planOpacityTxt.innerText=planOpacity.value;
 plan.style.opacity=planOpacity.value/100;
 lastPlanRot=0;
 setPlanRot(project.planRotation??0);
 zoomLevel=project.zoomLevel??1;
 applyZoom();
}
function restoreProjectItems(project){
 project.grids.forEach(addGrid);
 project.labels.forEach(addTextLabel);
 project.footnotes.forEach(addFootnote);
 project.stickers.forEach(sticker=>addSticker(sticker.color,sticker));
 project.axes.forEach(addAxes);
 project.overlays.forEach(addOverlayImage);
 project.purushas.forEach(addPurushaGrid);
 project.corrections.forEach(correction=>addCorrection(correction.category,correction.item,correction));
}
function loadProject(project){
 const p=migrateProject(project);
 clearProjectElements();
 restorePlanState(p);
 initCorrectionGroups(p.correctionGroups);
 renderCorrectionLibrary(correctionSearch.value);
 restoreProjectItems(p);
 applyCorrectionGroups();
}
async function exportPDF(){
 const name=askFileBaseName("Название PDF-файла",exportBaseName);
 if(!name)return;
 try{
  const canvas=await renderExportCanvas();
  exportBaseName=name;
  download(canvasToPDFBlob(canvas),name+".pdf");
 }catch(err){
  alert("Не удалось создать PDF. Проверь, что страница загружена полностью.");
 }
}
function download(blob,name){let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function exportPNG(){
 const name=askFileBaseName("Название PNG-файла",exportBaseName);
 if(!name)return;
 try{exportBaseName=name;await html2canvasLike(name+".png",pngExportScale())}catch(err){alert("Не удалось создать PNG. Проверь, что страница загружена полностью.")}
}
async function asDataURL(src){
 if(!src||src.startsWith("data:"))return src;
 const response=await fetch(src);
 if(!response.ok)throw new Error("Image not found");
 const blob=await response.blob();
 return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
}
async function displayedPlanFrame(){
 if(planData&&!plan.complete)await new Promise(resolve=>{plan.addEventListener("load",resolve,{once:true});plan.addEventListener("error",resolve,{once:true})});
 let width=plan.offsetWidth,height=plan.offsetHeight;
 if(!width||!height){
  const naturalWidth=plan.naturalWidth||1050,naturalHeight=plan.naturalHeight||780;
  const scale=Math.min(1,1050/naturalWidth,780/naturalHeight);
  width=naturalWidth*scale;height=naturalHeight*scale;
 }
 return{left:800-width/2,top:600-height/2,width,height,cx:800,cy:600};
}
function includeExportRect(bounds,x,y,width,height,rotation=0){
 const angle=rotation*Math.PI/180,cx=x+width/2,cy=y+height/2;
 const points=[[x,y],[x+width,y],[x+width,y+height],[x,y+height]].map(([px,py])=>({
  x:cx+(px-cx)*Math.cos(angle)-(py-cy)*Math.sin(angle),
  y:cy+(px-cx)*Math.sin(angle)+(py-cy)*Math.cos(angle)
 }));
 points.forEach(point=>{
  bounds.left=Math.min(bounds.left,point.x);bounds.top=Math.min(bounds.top,point.y);
  bounds.right=Math.max(bounds.right,point.x);bounds.bottom=Math.max(bounds.bottom,point.y);
 });
}
function includeExportPoint(bounds,x,y,padding=0){
 bounds.left=Math.min(bounds.left,x-padding);
 bounds.top=Math.min(bounds.top,y-padding);
 bounds.right=Math.max(bounds.right,x+padding);
 bounds.bottom=Math.max(bounds.bottom,y+padding);
}
function includeExportLine(bounds,x1,y1,x2,y2,rotation=0,cx=(x1+x2)/2,cy=(y1+y2)/2,padding=2){
 const angle=rotation*Math.PI/180;
 [[x1,y1],[x2,y2]].forEach(([px,py])=>{
  includeExportPoint(
   bounds,
   cx+(px-cx)*Math.cos(angle)-(py-cy)*Math.sin(angle),
   cy+(px-cx)*Math.sin(angle)+(py-cy)*Math.cos(angle),
   padding
  );
 });
}
function exportArea(p,planFrame,labels=[]){
 const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
 if(planFrame&&p.planVisible!==false)includeExportRect(bounds,planFrame.left,planFrame.top,planFrame.width,planFrame.height,p.planRotation);
 (p.grids||[]).forEach(g=>{if(g.visible!==false)includeExportRect(bounds,g.left,g.top,g.width,g.height,g.rotation)});
 (p.axes||[]).forEach(a=>{
  if(a.visible===false)return;
  const len=num(a.len,1800),y=num(a.top,0)+1,cx=num(a.left,0)+len/2,base=num(a.rotation,0);
  [90,0,45,135].forEach(rot=>includeExportLine(bounds,a.left,y,a.left+len,y,base+rot,cx,y,3));
 });
 (p.purushas||[]).forEach(o=>{if(o.visible!==false)includeExportRect(bounds,o.left,o.top,o.width,o.height,o.rotation)});
 (p.overlays||[]).forEach(o=>{if(o.visible!==false)includeExportRect(bounds,o.left,o.top,o.width,o.height,o.rotation)});
 (p.corrections||[]).forEach(o=>{
  const group=p.correctionGroups[o.category]||{visible:true};
  if(o.visible!==false&&group.visible)includeExportRect(bounds,o.left,o.top,o.width,o.height+(o.showCaption===false?0:20),o.rotation);
 });
 (p.labels||[]).forEach(l=>{if(l.visible!==false)includeExportRect(bounds,l.left,l.top,Math.max(20,l.text.length*l.fontSize*.62),l.fontSize*1.35,l.rotation)});
 (p.footnotes||[]).forEach(n=>{if(n.visible!==false)includeExportRect(bounds,n.left,n.top,n.width,n.height)});
 (p.stickers||[]).forEach(s=>{if(s.visible!==false)includeExportRect(bounds,s.left,s.top,s.size,s.size)});
 labels.forEach(label=>includeExportRect(bounds,label.x,label.y,label.width,label.height,label.rotation||0));
 if(!Number.isFinite(bounds.left))return{left:0,top:0,width:1600,height:1200};
 const padding=42;
 const left=Math.max(0,Math.floor(bounds.left-padding)),top=Math.max(0,Math.floor(bounds.top-padding));
 const right=Math.min(1600,Math.ceil(bounds.right+padding)),bottom=Math.min(1200,Math.ceil(bounds.bottom+padding));
 return{left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}
function exportTextWidth(text,fontSize){return String(text).length*fontSize*.56}
function wrapExportLabel(text,maxWidth=168,fontSize=12,maxLines=2){
 const words=String(text).split(/\s+/).filter(Boolean),lines=[];
 let line="";
 words.forEach(word=>{
  const next=line?line+" "+word:word;
  if(exportTextWidth(next,fontSize)<=maxWidth||!line)line=next;
  else{lines.push(line);line=word;}
 });
 if(line)lines.push(line);
 const clipped=lines.slice(0,maxLines);
 if(lines.length>maxLines){
  let last=clipped[clipped.length-1]||"";
  while(last.length>4&&exportTextWidth(last+"...",fontSize)>maxWidth)last=last.slice(0,-1);
  clipped[clipped.length-1]=last.trim()+"...";
 }
 return clipped.length?clipped:[""];
}
function rectOverlap(a,b,gap=4){return !(a.x+a.width+gap<=b.x||b.x+b.width+gap<=a.x||a.y+a.height+gap<=b.y||b.y+b.height+gap<=a.y)}
function estimateExportLabel(text){
 const fontSize=12,padX=7,padY=5,lineHeight=15,lines=wrapExportLabel(text,168,fontSize,2);
 const width=Math.min(182,Math.max(44,...lines.map(line=>exportTextWidth(line,fontSize)))+padX*2);
 const height=lines.length*lineHeight+padY*2;
 return{fontSize,padX,padY,lineHeight,lines,width,height};
}
function placeExportLabel(anchor,metrics,placed){
 const gap=8,cx=anchor.x+anchor.width/2,cy=anchor.y+anchor.height/2;
 const candidates=[
  {x:cx-metrics.width/2,y:anchor.y+anchor.height+gap},
  {x:cx-metrics.width/2,y:anchor.y-metrics.height-gap},
  {x:anchor.x+anchor.width+gap,y:cy-metrics.height/2},
  {x:anchor.x-metrics.width-gap,y:cy-metrics.height/2},
  {x:anchor.x+anchor.width+gap,y:anchor.y+anchor.height+gap},
  {x:anchor.x-metrics.width-gap,y:anchor.y+anchor.height+gap},
  {x:anchor.x+anchor.width+gap,y:anchor.y-metrics.height-gap},
  {x:anchor.x-metrics.width-gap,y:anchor.y-metrics.height-gap}
 ];
 for(let radius=28;radius<=240;radius+=24){
  [-1,0,1].forEach(dx=>[-1,0,1].forEach(dy=>{
   if(dx||dy)candidates.push({x:cx-metrics.width/2+dx*radius,y:cy-metrics.height/2+dy*radius});
  }));
 }
 const fits=box=>box.x>=0&&box.y>=0&&box.x+box.width<=1600&&box.y+box.height<=1200;
 for(const candidate of candidates){
  const box={...metrics,x:Math.round(candidate.x),y:Math.round(candidate.y)};
  if(fits(box)&&!placed.some(other=>rectOverlap(box,other)))return box;
 }
 const fallback={...metrics,x:Math.max(0,Math.min(1600-metrics.width,Math.round(cx-metrics.width/2))),y:Math.max(0,Math.min(1200-metrics.height,Math.round(anchor.y+anchor.height+gap)))};
 return fallback;
}
function correctionExportCaptionVisible(o,p){
 const group=(p.correctionGroups||{})[o.category]||{visible:true};
 return o.visible!==false&&o.visible!=="false"&&group.visible!==false&&o.showCaption!==false&&o.showCaption!=="false";
}
function correctionExportManualCenter(o,metrics){
 const dx=num(o.captionDx,0),dy=num(o.captionDy,0),rotation=num(o.rotation,0)*Math.PI/180;
 const cx=o.left+o.width/2,cy=o.top+o.height/2,localY=o.height/2+7+dy+metrics.height/2;
 return{x:cx+dx*Math.cos(rotation)-localY*Math.sin(rotation),y:cy+dx*Math.sin(rotation)+localY*Math.cos(rotation)};
}
function correctionExportCenteredBox(target,metrics){
 return{...metrics,x:Math.max(0,Math.min(1600-metrics.width,Math.round(target.x-metrics.width/2))),y:Math.max(0,Math.min(1200-metrics.height,Math.round(target.y-metrics.height/2)))};
}
function correctionExportAnchor(o){
 return{x:o.left+o.width/2,y:o.top+o.height/2};
}
function layoutExportCorrectionLabels(p){
 const corrections=p.corrections||[],placed=[],labels=[],doneGroups=new Set();
 corrections.forEach(o=>{
  if(!correctionExportCaptionVisible(o,p))return;
  const def=correctionDefinition(o.category,o.item);
  if(!def)return;
  if(o.captionGroup){
   if(doneGroups.has(o.captionGroup))return;
   doneGroups.add(o.captionGroup);
   const members=corrections.filter(member=>member.captionGroup===o.captionGroup&&correctionExportCaptionVisible(member,p));
   if(!members.length)return;
   const host=members.find(member=>member.captionHost)||members[0];
   const hostDef=correctionDefinition(host.category,host.item);
   if(!hostDef)return;
   const text=correctionCaptionValue(host,hostDef),metrics=estimateExportLabel(text);
   const targetX=num(host.captionTargetX,null),targetY=num(host.captionTargetY,null);
   const target=targetX!==null&&targetY!==null?{x:targetX,y:targetY}:correctionExportManualCenter(host,metrics);
   const box=correctionExportCenteredBox(target,metrics);
   const hostGroup=(p.correctionGroups||{})[host.category]||{opacity:100};
   placed.push(box);
   labels.push({...box,text,anchors:members.map(correctionExportAnchor),rotation:num(host.captionRotation,0),opacity:num(host.opacity,100)*num(hostGroup.opacity,100)/10000});
   return;
  }
  const group=(p.correctionGroups||{})[o.category]||{visible:true,opacity:100};
  const text=correctionCaptionValue(o,def);
  const metrics=estimateExportLabel(text);
  const dx=num(o.captionDx,0),dy=num(o.captionDy,0);
  const manual=Math.abs(dx)>1||Math.abs(dy)>1;
  const manualCenter=correctionExportManualCenter(o,metrics);
  const box=manual
   ?correctionExportCenteredBox(manualCenter,metrics)
   :placeExportLabel({x:o.left,y:o.top,width:o.width,height:o.height},metrics,placed);
  placed.push(box);
  labels.push({...box,text,anchors:[correctionExportAnchor(o)],rotation:num(o.captionRotation,0),opacity:num(o.opacity,100)*num(group.opacity,100)/10000});
 });
 return labels;
}
function exportLabelSVG(label){
 const textX=label.x+label.width/2,textY=label.y+label.padY+label.fontSize;
 const cx=label.x+label.width/2,cy=label.y+label.height/2;
 const lines=(label.anchors||[]).map(anchor=>`<line x1="${anchor.x}" y1="${anchor.y}" x2="${cx}" y2="${cy}" stroke="#6b6961" stroke-width="1" stroke-dasharray="3 3" opacity=".35"/>`).join("");
 const tspans=label.lines.map((lineText,index)=>`<tspan x="${textX}" dy="${index?label.lineHeight:0}">${esc(lineText)}</tspan>`).join("");
 return `${lines}<g opacity="${Math.min(1,Math.max(.25,label.opacity))}" transform="rotate(${label.rotation||0} ${cx} ${cy})"><rect x="${label.x}" y="${label.y}" width="${label.width}" height="${label.height}" rx="8" fill="#fff" fill-opacity=".9" stroke="#d7d0c6" stroke-width="1"/><text x="${textX}" y="${textY}" text-anchor="middle" font-size="${label.fontSize}" font-weight="600" fill="#3f3d38">${tspans}</text></g>`;
}
function footnoteExportItems(note){
 const raw=String(note.text||"").trim();
 if(!raw)return["Комментарий по коррекциям"];
 if(note.format==="numbered")return raw.split(/\n+/).map(line=>line.trim()).filter(Boolean).map((line,index)=>`${index+1}. ${line}`);
 if(note.format==="bullets")return raw.split(/\n+/).map(line=>line.trim()).filter(Boolean).map(line=>`• ${line}`);
 return raw.split(/\n{2,}/).flatMap((block,index,blocks)=>{
  const lines=block.split(/\n/).map(line=>line.trim()).filter(Boolean);
  return index<blocks.length-1?[...lines,""]:lines;
 });
}
function wrapFootnoteLine(text,maxWidth,fontSize){
 const words=String(text).split(/\s+/).filter(Boolean),lines=[];
 let line="";
 words.forEach(word=>{
  const next=line?line+" "+word:word;
  if(exportTextWidth(next,fontSize)<=maxWidth||!line)line=next;
  else{lines.push(line);line=word;}
 });
 if(line)lines.push(line);
 return lines.length?lines:[""];
}
function footnoteExportLayout(note){
 const padX=14,padTop=45,padBottom=14,maxWidth=Math.max(20,note.width-padX*2),bodyHeight=Math.max(20,note.height-padTop-padBottom);
 let fontSize=num(note.fontSize,14),lines=[],lineHeight=fontSize*1.38;
 while(fontSize>=9){
  lines=footnoteExportItems(note).flatMap(item=>item===""?[""]:wrapFootnoteLine(item,maxWidth,fontSize));
  lineHeight=fontSize*1.38;
  if(lines.length*lineHeight<=bodyHeight+1)break;
  fontSize-=.5;
 }
 return{padX,padTop,padBottom,fontSize,lineHeight,lines};
}
function exportFootnoteSVG(note){
 if(note.visible===false)return"";
 const x=note.left,y=note.top,w=note.width,h=note.height,layout=footnoteExportLayout(note);
 const shadow=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#2f2b24" opacity=".10" transform="translate(0 12)"/>`;
 const title=esc(note.title||"Сноска");
 const body=layout.lines.map((line,index)=>`<tspan x="${x+layout.padX}" dy="${index?layout.lineHeight:0}">${esc(line)}</tspan>`).join("");
 return `${shadow}<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fff" fill-opacity=".92" stroke="#d2ccc3"/><path d="M${x} ${y+34}H${x+w}" stroke="#dad5cd"/><path d="M${x+18} ${y}H${x+w-18}Q${x+w} ${y} ${x+w} ${y+18}V${y+34}H${x}V${y+18}Q${x} ${y} ${x+18} ${y}Z" fill="#f4f1ec" fill-opacity=".88"/><text x="${x+14}" y="${y+22}" font-size="13" font-weight="700" fill="#302f2b">${title}</text><text x="${x+layout.padX}" y="${y+layout.padTop}" font-size="${layout.fontSize}" fill="#302f2b">${body}</text></g>`;
}
async function renderExportCanvas(scale=1){
 scale=Math.max(1,Math.min(3,Number(scale)||1));
 const result=await buildSVG();
 const img=new Image();
 const url=URL.createObjectURL(new Blob([result.svg],{type:"image/svg+xml"}));
 try{
  await new Promise((resolve,reject)=>{
   img.onload=resolve;
   img.onerror=reject;
   img.src=url;
  });
  const c=document.createElement("canvas");
  c.width=Math.round(result.width*scale);
  c.height=Math.round(result.height*scale);
  const ctx=c.getContext("2d");
  ctx.fillStyle="white";
  ctx.fillRect(0,0,c.width,c.height);
  ctx.drawImage(img,0,0,c.width,c.height);
  return c;
 }finally{
  URL.revokeObjectURL(url);
 }
}
async function html2canvasLike(filename="vastu-map.png",scale=1){
 const c=await renderExportCanvas(scale);
 await new Promise((resolve,reject)=>c.toBlob(blob=>{
  if(!blob){reject(new Error("PNG canvas is too large"));return;}
  download(blob,filename);
  resolve();
 },"image/png"));
}
async function showExportPreview(){
 previewModal.hidden=false;
 previewLoading.hidden=false;
 previewImage.hidden=true;
 previewImage.removeAttribute("src");
 try{
  const c=await renderExportCanvas();
  previewImage.src=c.toDataURL("image/png");
  previewImage.hidden=false;
 }catch(err){
  previewLoading.innerText="Не удалось подготовить предпросмотр.";
  return;
 }
 previewLoading.hidden=true;
 previewLoading.innerText="Подготавливаю изображение...";
}
function closeExportPreview(){previewModal.hidden=true}
function canvasToPDFBlob(canvas){
 const landscape=canvas.width>canvas.height;
 const pageW=landscape?841.89:595.28,pageH=landscape?595.28:841.89,margin=24;
 const scale=Math.min((pageW-margin*2)/canvas.width,(pageH-margin*2)/canvas.height);
 const drawW=canvas.width*scale,drawH=canvas.height*scale;
 const x=(pageW-drawW)/2,y=(pageH-drawH)/2;
 const jpg=canvas.toDataURL("image/jpeg",.92).split(",")[1];
 const binary=atob(jpg),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const content=`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
 const parts=[];let offset=0;const offsets=[0];
 const add=part=>{parts.push(part);offset+=typeof part==="string"?part.length:part.length};
 const obj=(id,content)=>{offsets[id]=offset;add(`${id} 0 obj\n`);add(content);add("\nendobj\n")};
 add("%PDF-1.3\n");
 obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
 obj(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
 obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
 offsets[4]=offset;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);add(bytes);add("\nendstream\nendobj\n");
 obj(5,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
 const xref=offset;
 add("xref\n0 6\n0000000000 65535 f \n");
 for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,"0")+" 00000 n \n");
 add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
 return new Blob(parts,{type:"application/pdf"});
}
function esc(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;")}
async function buildSVG(){
 const p=collect();
 const frame=p.planImageData&&p.planVisible!==false?await displayedPlanFrame():null;
 const exportLabels=layoutExportCorrectionLabels(p);
 const area=exportArea(p,frame,exportLabels);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${area.width}" height="${area.height}" viewBox="${area.left} ${area.top} ${area.width} ${area.height}"><rect x="${area.left}" y="${area.top}" width="${area.width}" height="${area.height}" fill="white"/>`;
 if(frame){
  svg+=`<image href="${p.planImageData}" x="${frame.left}" y="${frame.top}" width="${frame.width}" height="${frame.height}" opacity="${p.planOpacity/100}" preserveAspectRatio="none" transform="rotate(${p.planRotation} ${frame.cx} ${frame.cy})"/>`;
 }
 for(const o of p.purushas||[]){
  if(o.visible===false) continue;
  const src=await asDataURL(o.src||PURUSHA_GRID_SRC);
  svg+=`<image href="${src}" x="${o.left}" y="${o.top}" width="${o.width}" height="${o.height}" opacity="${o.opacity/100}" preserveAspectRatio="none" transform="rotate(${o.rotation} ${o.left+o.width/2} ${o.top+o.height/2})"/>`;
 }
 for(const o of p.overlays||[]){
  if(o.visible!==false&&o.src) svg+=`<image href="${o.src}" x="${o.left}" y="${o.top}" width="${o.width}" height="${o.height}" opacity="${o.opacity/100}" preserveAspectRatio="none" transform="rotate(${o.rotation} ${o.left+o.width/2} ${o.top+o.height/2})"/>`;
 }
 p.grids.forEach(g=>{
  if(g.visible===false)return;
  const cx=g.left+g.width/2,cy=g.top+g.height/2,cw=g.width/3,ch=g.height/3,fontSize=num(g.fontSize,15);
  const cols=["#daeef1","#f2f5ee","#f4efef","#eceff8","#fff","#f4f4f0","#f1edf0","#faf1f0","#f7eff8"];
  svg+=`<g transform="rotate(${g.rotation} ${cx} ${cy})">`;
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){
   const i=r*3+c;
   svg+=`<rect x="${g.left+c*cw}" y="${g.top+r*ch}" width="${cw}" height="${ch}" fill="${cols[i]}" opacity="${g.opacity/100}" stroke="black"/><text x="${g.left+c*cw+cw/2}" y="${g.top+r*ch+ch/2}" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="middle">${esc(g.directions[i]||"")}</text>`;
  }
  svg+=`</g>`;
 });
 p.axes.forEach(a=>{
 if(a.visible===false)return;
  const len=a.len,op=a.opacity/100,base=num(a.rotation,0);
  const y=num(a.top,0)+1;
  [90,0,45,135].forEach(rot=>{svg+=`<line x1="${a.left}" y1="${y}" x2="${a.left+len}" y2="${y}" stroke="black" stroke-width="2" opacity="${op}" transform="rotate(${base+rot} ${a.left+len/2} ${y})"/>`;});
 });
 (p.corrections||[]).forEach(o=>{
 const group=p.correctionGroups[o.category]||{visible:true,opacity:100};
  if(o.visible===false||!group.visible)return;
  const opacity=o.opacity*group.opacity/10000,def=correctionDefinition(o.category,o.item),src=correctionArt(o);
  svg+=`<image href="${src}" x="${o.left}" y="${o.top}" width="${o.width}" height="${o.height}" opacity="${opacity}" transform="rotate(${o.rotation} ${o.left+o.width/2} ${o.top+o.height/2})"/>`;
 });
 exportLabels.forEach(label=>svg+=exportLabelSVG(label));
 p.labels.forEach(l=>{if(l.visible!==false)svg+=`<text x="${l.left}" y="${l.top+l.fontSize}" font-size="${l.fontSize}" font-weight="700" transform="rotate(${l.rotation} ${l.left} ${l.top+l.fontSize})">${esc(l.text)}</text>`;});
 (p.footnotes||[]).forEach(note=>svg+=exportFootnoteSVG(note));
 p.stickers.forEach(s=>{if(s.visible!==false)svg+=`<text x="${s.left}" y="${s.top+s.size*.9}" font-size="${s.size}" fill="${s.color==='green'?'#18a558':'#d62828'}">★</text>`;});
 return{svg:svg+"</svg>",width:area.width,height:area.height};
}

const propertyNames={grid:"Сетка направлений",purusha:"Пуруша-мандала",axis:"Оси направлений",overlay:"Дополнительная картинка",label:"Надпись",footnote:"Сноска",sticker:"Метка анализа",correction:"Коррекция",plan:"План квартиры"};
function showProperties(type){
 document.querySelectorAll(".property-group").forEach(group=>group.classList.toggle("active",group.dataset.properties===type));
 propertyTitle.innerText=propertyNames[type]||"Выберите слой";
 document.querySelector(".delete-layer").style.display=type?"block":"none";
}
function selectPlan(){
 clearSel();
 sel=plan;
 selType="plan";
 showProperties("plan");
 refreshLayers();
}
function refreshLayers(){
 const list=document.getElementById("layersList");
 if(!list)return;
 list.innerHTML="";
 let activeButton=null;
 const layers=[{el:plan,type:"plan",name:"План квартиры",detail:planData?"Загружен":"Не загружен",icon:"P",hidden:!isLayerVisible(plan)}];
 document.querySelectorAll(".vastu-grid").forEach((el,i)=>layers.push({el,type:"grid",name:"Сетка направлений",detail:"Сетка "+(i+1),icon:"#",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".purusha-grid").forEach((el,i)=>layers.push({el,type:"purusha",name:"Пуруша-мандала",detail:"Слой "+(i+1),icon:"M",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".axis-group").forEach((el,i)=>layers.push({el,type:"axis",name:"Оси",detail:"Набор "+(i+1),icon:"+",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".overlay-wrap").forEach((el,i)=>layers.push({el,type:"overlay",name:"Доп. картинка",detail:"Слой "+(i+1),icon:"I",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".correction-object").forEach(el=>{
  const def=correctionDefinition(el.dataset.category,el.dataset.item);
  const group=correctionGroups[el.dataset.category]||{visible:true};
  layers.push({el,type:"correction",name:correctionTitle(correctionState(el),def),detail:correctionDetail(el),icon:"C",hidden:!isLayerVisible(el)||!group.visible,groupHidden:!group.visible});
 });
 document.querySelectorAll(".text-label").forEach((el,i)=>layers.push({el,type:"label",name:"Надпись",detail:"Текст "+(i+1),icon:"T",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".footnote").forEach((el,i)=>layers.push({el,type:"footnote",name:el.dataset.title||"Сноска",detail:"Сноска "+(i+1),icon:"N",hidden:!isLayerVisible(el)}));
 document.querySelectorAll(".sticker").forEach((el,i)=>layers.push({el,type:"sticker",name:el.dataset.color==="green"?"Ресурс":"Проблема",detail:"Метка "+(i+1),icon:"*",hidden:!isLayerVisible(el)}));
 layers.forEach(layer=>{
  const button=document.createElement("button");
  button.type="button";
  button.className="layer-item"+(sel===layer.el&&selType===layer.type?" active":"");
  if(sel===layer.el&&selType===layer.type)activeButton=button;
  const dot=document.createElement("span");
  dot.className="layer-dot";
  dot.innerText=layer.icon;
  const copy=document.createElement("span");
  copy.className="layer-copy";
  const name=document.createElement("strong");
  name.innerText=layer.name;
  const detail=document.createElement("small");
  detail.innerText=layer.detail;
  copy.append(name,detail);
  button.append(dot,copy);
  if(layer.el.dataset&&layer.el.dataset.locked==="true"){
   const locked=document.createElement("span");
   locked.className="layer-lock";
   locked.innerText="lock";
   button.appendChild(locked);
  }
  if(layer.hidden){
   const hidden=document.createElement("span");
   hidden.className="layer-hidden";
   hidden.innerText=layer.groupHidden?"раздел скрыт":"скрыт";
   button.appendChild(hidden);
  }
  const visibility=document.createElement("span");
  const layerVisible=isLayerVisible(layer.el);
  visibility.className="layer-visibility"+(layerVisible?"":" off");
  visibility.title=layerVisible?"Скрыть слой":"Показать слой";
  visibility.setAttribute("role","button");
  visibility.setAttribute("tabindex","0");
  visibility.setAttribute("aria-label",visibility.title);
  visibility.innerHTML="&#128065;";
  const toggleVisibility=e=>{
   e.preventDefault();e.stopPropagation();
   setLayerVisibility(layer.el,layer.type,!isLayerVisible(layer.el));
  };
  visibility.onclick=toggleVisibility;
  visibility.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){toggleVisibility(e);}};
  button.appendChild(visibility);
  button.onclick=()=>layer.type==="plan"?selectPlan():select(layer.el,layer.type);
  list.appendChild(button);
 });
 if(activeButton)requestAnimationFrame(()=>activeButton.scrollIntoView({block:"nearest"}));
}
function centerWorkspace(){
 const viewport=document.querySelector(".workspace");
 if(!viewport)return;
 viewport.scrollLeft=Math.max(0,(canvas.offsetWidth*zoomLevel-viewport.clientWidth)/2);
 viewport.scrollTop=Math.max(0,(canvas.offsetHeight*zoomLevel-viewport.clientHeight)/2);
}
initCorrectionLibrary();
isRestoring=true;
applyZoom();
addGrid();
isRestoring=false;
requestAnimationFrame(centerWorkspace);

document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!previewModal.hidden){closeExportPreview();return;}
 if(!(e.ctrlKey||e.metaKey)) return;
 const key=e.key.toLowerCase();
 if(key==="z"&&!e.shiftKey){e.preventDefault();undoLast();}
 if(key==="y"||(key==="z"&&e.shiftKey)){e.preventDefault();redoLast();}
});
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

// 3×3 сетка меняется за 8 точек: углы меняют ширину и высоту, стороны — только одну ось.
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

// Пуруша-сетка тоже получает 8 точек.
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
   let left=drag.l+(p.x-drag.x),top=drag.t+(p.y-drag.y);
   if(drag.el.classList?.contains("footnote")){
     left=clamp(left,0,1600-drag.el.offsetWidth);
     top=clamp(top,0,1200-drag.el.offsetHeight);
   }
   drag.el.style.left=left+"px";
   drag.el.style.top=top+"px";
   if(drag.el.classList?.contains("correction-object"))updateCorrectionCaptionPosition(drag.el);
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
   updateGridTypography(drag.el);
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

 if(drag.type=="correction-caption"){
   if(drag.el.dataset.locked==="true")return;
   const dx=p.x-drag.x,dy=p.y-drag.y;
   if(drag.el.dataset.captionGroup){
     setCorrectionCaptionGroupTarget(correctionCaptionGroupMembers(drag.el),{x:drag.targetX+dx,y:drag.targetY+dy});
   }else{
     const cos=Math.cos(-drag.rot),sin=Math.sin(-drag.rot);
     const localX=dx*cos-dy*sin,localY=dx*sin+dy*cos;
     drag.el.dataset.captionDx=Math.round(drag.dx+localX);
     drag.el.dataset.captionDy=Math.round(drag.dy+localY);
   }
   updateCorrectionCaptionPosition(drag.el);
 }

 if(drag.type=="correction-resize"){
   if(drag.el.dataset.locked==="true")return;
   let dx=p.x-drag.x,dy=p.y-drag.y,newW=drag.w,newH=drag.h,newL=drag.l,newT=drag.t;
   if(drag.el.dataset.keepRatio!=="false"){
     let delta=drag.handle.includes("e")?dx:-dx;
     if(Math.abs(dy)>Math.abs(dx))delta=drag.handle.includes("s")?dy*drag.ratio:-dy*drag.ratio;
     newW=Math.max(8,drag.w+delta);
     newH=newW/drag.ratio;
   }else{
     if(drag.handle.includes("e"))newW=Math.max(8,drag.w+dx);
     if(drag.handle.includes("s"))newH=Math.max(8,drag.h+dy);
     if(drag.handle.includes("w"))newW=Math.max(8,drag.w-dx);
     if(drag.handle.includes("n"))newH=Math.max(8,drag.h-dy);
   }
   if(drag.handle.includes("w"))newL=drag.l+(drag.w-newW);
   if(drag.handle.includes("n"))newT=drag.t+(drag.h-newH);
   drag.el.style.width=newW+"px";drag.el.style.height=newH+"px";drag.el.style.left=newL+"px";drag.el.style.top=newT+"px";
   drag.el.dataset.width=Math.round(newW);drag.el.dataset.height=Math.round(newH);
   updateCorrectionArt(drag.el);
   if(drag.el===sel)updCorrectionPanel();
 }

 if(drag.type=="footnote-resize"){
   let dx=p.x-drag.x,dy=p.y-drag.y,newW=drag.w,newH=drag.h,newL=drag.l,newT=drag.t;
   if(drag.handle.includes("e"))newW=Math.max(120,drag.w+dx);
   if(drag.handle.includes("s"))newH=Math.max(80,drag.h+dy);
   if(drag.handle.includes("w")){newW=Math.max(120,drag.w-dx);newL=drag.l+(drag.w-newW);}
   if(drag.handle.includes("n")){newH=Math.max(80,drag.h-dy);newT=drag.t+(drag.h-newH);}
   newW=Math.min(newW,900);newH=Math.min(newH,700);
   newL=clamp(newL,0,1600-newW);newT=clamp(newT,0,1200-newH);
   drag.el.style.left=newL+"px";drag.el.style.top=newT+"px";
   drag.el.dataset.width=Math.round(newW);drag.el.dataset.height=Math.round(newH);
   updateFootnote(drag.el);
   if(drag.el===sel)updFootnotePanel();
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

 if(drag.type=="correction-rot"){
   if(drag.el.dataset.locked==="true")return;
   let deg=Math.round(nd(Math.atan2(p.y-drag.cy,p.x-drag.cx)*180/Math.PI+90));
   drag.el.dataset.rotation=deg;
   drag.el.style.transform=`rotate(${deg}deg)`;
   updateCorrectionCaptionPosition(drag.el);
   if(drag.el===sel)updCorrectionPanel();
 }
}
