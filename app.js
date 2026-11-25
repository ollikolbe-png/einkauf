(function(){
"use strict";
var $=function(id){return document.getElementById(id)};
var EUR=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"});
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function norm(s){return String(s||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," ").trim()}
function parsePrice(v){var n=parseFloat(String(v).replace(/[^0-9,.\-]/g,"").replace(",","."));return isFinite(n)&&n>=0?Math.round(n*100)/100:null}
function validEan(s){return /^\d{8,14}$/.test(String(s||""))}

var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var CROSS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
var ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

/* ---------- Gespeicherter Zustand (nur auf diesem Gerät) ---------- */
var LS="einkaufshelfer.v1";
var S={list:[],cart:[],known:{}};
try{var raw=localStorage.getItem(LS);if(raw){var p=JSON.parse(raw);if(p&&Array.isArray(p.list)&&Array.isArray(p.cart))S={list:p.list,cart:p.cart,known:p.known||{}}}}catch(e){}
function persist(){try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}

/* ---------- Prospekte ---------- */
var STORES=[
  {short:"Pe",name:"Penny",note:"Am Pfaffensteg 3, Mücke",src:"https://www.penny.de/angebote/"},
  {short:"Ne",name:"Netto",note:"Merlauer Str. 59, Mücke-Niederohmen",src:"https://www.netto-online.de/filialangebote?stores_id=3552"},
  {short:"Ed",name:"Edeka Sohl",note:"Bahnhofstr. 44, Mücke-Merlau",src:"https://www.edeka.de/maerkte/060364/prospekte"},
  {short:"Re",name:"REWE Brückner",note:"Flensunger Weg 77, Mücke-Merlau",src:"https://www.rewe.de/angebote/muecke-merlau/1465472/rewe-flensunger-weg-77/"},
  {short:"Li",name:"Lidl",note:"Aktuelle Prospekte",src:"https://www.lidl.de/c/online-prospekte/s10005610"},
  {short:"AS",name:"Aldi Süd",note:"Wochenangebote",src:"https://www.aldi-sued.de/produkte/wochenangebote/k/1588161426582123"},
  {short:"AN",name:"Aldi Nord",note:"Wochenangebote",src:"https://www.aldi-nord.de/angebote.html"},
  {short:"Ac",name:"Action",note:"Wochenangebote, Mi. bis Di.",src:"https://www.action.com/de-de/wochenangebote/"},
  {short:"dm",name:"dm Grünberg",note:"Göbelnröder Straße 3, Grünberg",src:"https://www.dm.de/store/d53l/gruenberg/goebelnroeder-strasse-3"}
];
$("store-list").innerHTML=STORES.map(function(s){
  return '<a class="store" href="'+esc(s.src)+'" target="_blank" rel="noopener"><span class="logo">'+esc(s.short)+'</span><span class="txt" style="flex:1;min-width:0"><span class="name" style="display:block;font-weight:600">'+esc(s.name)+'</span><span class="sub" style="display:block;font-size:13px;color:var(--muted)">'+esc(s.note)+'</span></span><span class="arrow">'+ARROW+"</span></a>";
}).join("");

/* ---------- Einkaufsliste ---------- */
function renderList(){
  var box=$("list-rows"),foot=$("list-foot");
  if(!S.list.length){box.innerHTML='<div class="empty">Deine Liste ist leer. Trag oben ein, was du brauchst.</div>';foot.innerHTML="";return}
  var sorted=S.list.filter(function(i){return !i.done}).concat(S.list.filter(function(i){return i.done}));
  box.innerHTML='<div class="rows">'+sorted.map(function(i){
    return '<div class="row'+(i.done?" done":"")+'"><button type="button" class="check" data-toggle="'+esc(i.id)+'" role="checkbox" aria-checked="'+!!i.done+'" aria-label="'+esc(i.name)+' abhaken">'+CHECK+'</button>'
      +'<div class="txt"><div class="name">'+esc(i.name)+"</div></div>"
      +'<button type="button" class="icon-btn ghost" data-del="'+esc(i.id)+'" aria-label="'+esc(i.name)+' löschen">'+CROSS+"</button></div>";
  }).join("")+"</div>";
  var open=S.list.filter(function(i){return !i.done}).length,done=S.list.length-open;
  foot.innerHTML="<span>"+open+" offen"+(done?" · "+done+" erledigt":"")+"</span><span class=\"btns\">"
    +(navigator.share&&open?'<button type="button" class="btn" id="share-list">Teilen</button>':"")
    +(done?'<button type="button" class="btn" id="clear-done">Erledigte weg</button>':"")+"</span>";
}
$("list-form").addEventListener("submit",function(e){
  e.preventDefault();var inp=$("list-input"),v=inp.value.trim();if(!v)return;
  S.list.unshift({id:uid(),name:v.slice(0,80),done:false});inp.value="";persist();renderAll();inp.focus();
});
$("v-liste").addEventListener("click",function(e){
  var t=e.target.closest("[data-toggle]"),d=e.target.closest("[data-del]");
  if(t){var it=S.list.find(function(i){return i.id===t.dataset.toggle});if(it){it.done=!it.done;persist();renderAll()}}
  else if(d){S.list=S.list.filter(function(i){return i.id!==d.dataset.del});persist();renderAll()}
  else if(e.target.id==="clear-done"){S.list=S.list.filter(function(i){return !i.done});persist();renderAll()}
  else if(e.target.id==="share-list"){
    var txt=S.list.filter(function(i){return !i.done}).map(function(i){return "• "+i.name}).join("\n");
    navigator.share({title:"Einkaufsliste",text:"Einkaufsliste\n"+txt}).catch(function(){});
  }
});

/* ---------- Warenkorb ---------- */
var clearArmed=false,clearTimer=null;
function cartTotal(){return Math.round(S.cart.reduce(function(a,i){return a+i.price*i.qty},0)*100)/100}
function renderCart(){
  var n=S.cart.reduce(function(a,i){return a+i.qty},0);
  $("cart-sum").textContent=EUR.format(cartTotal());
  $("cart-count").textContent=n===1?"1 Artikel":n+" Artikel";
  var box=$("cart-rows"),foot=$("cart-foot");
  if(!S.cart.length){box.innerHTML='<div class="empty">Noch nichts im Warenkorb. Scanne das erste Produkt, sobald es im Wagen liegt.</div>';foot.innerHTML="";return}
  box.innerHTML='<div class="rows">'+S.cart.map(function(i){
    return '<div class="row"><div class="txt"><div class="name">'+esc(i.name)+'</div><div class="sub">'+EUR.format(i.price)+" pro Stück</div></div>"
      +'<div class="qty"><button type="button" data-dec="'+esc(i.id)+'" aria-label="Eins weniger von '+esc(i.name)+'">−</button><span>'+i.qty+'</span><button type="button" data-inc="'+esc(i.id)+'" aria-label="Eins mehr von '+esc(i.name)+'">+</button></div>'
      +'<div class="line">'+EUR.format(i.price*i.qty)+"</div></div>";
  }).join("")+"</div>";
  foot.innerHTML='<span>Pfand nur, wenn du es mit einträgst.</span><button type="button" class="btn danger" id="cart-clear">'+(clearArmed?"Wirklich alles weg?":"Warenkorb leeren")+"</button>";
}
$("v-warenkorb").addEventListener("click",function(e){
  var inc=e.target.closest("[data-inc]"),dec=e.target.closest("[data-dec]");
  if(inc||dec){
    var id=(inc||dec).dataset[inc?"inc":"dec"],it=S.cart.find(function(i){return i.id===id});if(!it)return;
    it.qty+=inc?1:-1;if(it.qty<1)S.cart=S.cart.filter(function(i){return i.id!==id});if(it.qty>99)it.qty=99;
    persist();renderAll();
  }else if(e.target.id==="cart-clear"){
    if(!clearArmed){clearArmed=true;renderCart();clearTimeout(clearTimer);clearTimer=setTimeout(function(){clearArmed=false;renderCart()},4000)}
    else{clearArmed=false;clearTimeout(clearTimer);S.cart=[];persist();renderAll();toast("Warenkorb geleert")}
  }
});
function addToCart(name,price,qty,ean){
  var same=S.cart.find(function(i){return(ean&&i.ean===ean)||(norm(i.name)===norm(name)&&i.price===price)});
  if(same){same.qty=Math.min(99,same.qty+qty);same.price=price}else S.cart.unshift({id:uid(),name:name,price:price,qty:qty,ean:ean||null});
  if(ean)S.known[ean]={name:name,price:price};
  var n=norm(name),hit=S.list.find(function(i){var m=norm(i.name);return !i.done&&m.length>2&&(n.indexOf(m)>=0||m.indexOf(n)>=0)});
  if(hit){hit.done=true;toast("„"+hit.name+"“ auf der Liste abgehakt")}else toast("Im Warenkorb: "+name);
  persist();renderAll();
}

/* ---------- Produkt-Dialog ---------- */
var lookupCtl=null;
function openSheet(title,data){
  $("sheet-title").textContent=title;$("p-name").value=data.name||"";
  $("p-price").value=data.price!=null?data.price.toFixed(2).replace(".",","):"";
  $("p-qty").value=1;$("p-ean").value=data.ean||"";
  setStatus("");$("overlay").hidden=false;
}
function closeSheet(){if(lookupCtl){lookupCtl.abort();lookupCtl=null}$("overlay").hidden=true}
function setStatus(t){$("sheet-status").textContent=t}
$("sheet-cancel").addEventListener("click",closeSheet);
$("overlay").addEventListener("click",function(e){if(e.target===$("overlay"))closeSheet()});
$("manual-btn").addEventListener("click",function(){openSheet("Von Hand eintragen",{});$("p-name").focus()});
$("sheet").addEventListener("submit",function(e){
  e.preventDefault();
  var name=$("p-name").value.trim(),price=parsePrice($("p-price").value),qty=Math.max(1,Math.min(99,parseInt($("p-qty").value,10)||1));
  var ean=$("p-ean").value.replace(/\D/g,"");if(!validEan(ean))ean=null;
  if(!name){setStatus("Bitte einen Produktnamen eintragen.");$("p-name").focus();return}
  if(price==null){setStatus("Bitte den Preis eintragen, zum Beispiel 1,99.");$("p-price").focus();return}
  closeSheet();addToCart(name.slice(0,80),price,qty,ean);
});

/* Produktname aus der freien Datenbank Open Food Facts (ohne Preise) */
function lookupName(ean){
  if(!navigator.onLine||!window.fetch)return Promise.resolve(null);
  lookupCtl=new AbortController();var ctl=lookupCtl;
  var t=setTimeout(function(){ctl.abort()},6000);
  return fetch("https://world.openfoodfacts.org/api/v2/product/"+ean+".json?fields=product_name_de,product_name,brands,quantity",{signal:ctl.signal})
    .then(function(r){return r.ok?r.json():null})
    .then(function(j){
      clearTimeout(t);if(!j||j.status!==1||!j.product)return null;
      var p=j.product,nm=p.product_name_de||p.product_name||"";if(!nm)return null;
      var brand=(p.brands||"").split(",")[0].trim();
      if(brand&&norm(nm).indexOf(norm(brand))<0)nm=brand+" "+nm;
      if(p.quantity)nm+=" "+p.quantity;
      return nm.slice(0,80);
    },function(){clearTimeout(t);return null});
}
function handleEan(ean){
  var k=S.known[ean];
  if(k){openSheet("Produkt erkannt",{name:k.name,price:k.price,ean:ean});setStatus("Schon einmal gekauft. Stimmt der Preis noch?");return}
  openSheet("Neues Produkt",{ean:ean});setStatus("Produkt wird nachgeschlagen …");
  lookupName(ean).then(function(nm){
    if($("overlay").hidden)return;
    if(nm&&!$("p-name").value){$("p-name").value=nm;setStatus("Trag noch den Preis vom Regal ein. Beim nächsten Mal kennt die App ihn.");$("p-price").focus()}
    else if(!$("p-name").value){setStatus("Produkt nicht gefunden. Trag Name und Preis einmal ein.");$("p-name").focus()}
  });
}

/* ---------- Barcode-Scanner (Live-Kamera, eigene Leseschleife) ---------- */
var scanning=false,stream=null,loopTimer=null,mfr=null,tick=0,canvas=document.createElement("canvas");
function scanMsg(t){$("scan-msg").textContent=t}
function getReader(){
  if(mfr)return mfr;
  var Z=window.ZXing,hints=new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E]);
  hints.set(Z.DecodeHintType.TRY_HARDER,true);
  mfr=new Z.MultiFormatReader();mfr.setHints(hints);return mfr;
}
/* Ein Bildausschnitt -> Ziffern oder null. Versucht beide Binarisierer, optional gedreht. */
function decodeRegion(src,sx,sy,sw,sh,maxW,rot,binIdx){
  var Z=window.ZXing,s=Math.min(1,maxW/Math.max(sw,sh)),cw=Math.max(1,Math.round(sw*s)),ch=Math.max(1,Math.round(sh*s)),g=canvas.getContext("2d",{willReadFrequently:true});
  if(rot){canvas.width=ch;canvas.height=cw;g.setTransform(1,0,0,1,0,0);g.translate(ch/2,cw/2);g.rotate(Math.PI/2);g.drawImage(src,sx,sy,sw,sh,-cw/2,-ch/2,cw,ch);g.setTransform(1,0,0,1,0,0)}
  else{canvas.width=cw;canvas.height=ch;g.drawImage(src,sx,sy,sw,sh,0,0,cw,ch)}
  var lum=new Z.HTMLCanvasElementLuminanceSource(canvas);
  var bins=binIdx==null?[0,1]:[binIdx];
  for(var i=0;i<bins.length;i++){
    try{
      var bb=new Z.BinaryBitmap(bins[i]?new Z.GlobalHistogramBinarizer(lum):new Z.HybridBinarizer(lum));
      var r=getReader().decode(bb),t=r&&r.getText();
      if(validEan(t))return t;
    }catch(e){}
  }
  return null;
}
function stopScan(){
  scanning=false;clearTimeout(loopTimer);
  if(stream){stream.getTracks().forEach(function(t){t.stop()});stream=null}
  var v=$("video");v.srcObject=null;
  $("scanner").hidden=true;
}
function found(code){
  if(navigator.vibrate)navigator.vibrate(60);
  stopScan();handleEan(code);
}
function scanLoop(){
  if(!scanning)return;
  var v=$("video"),vw=v.videoWidth,vh=v.videoHeight;
  if(vw&&vh&&v.readyState>=2){
    tick++;
    var code=null;
    try{
      /* Sichtbaren Rahmen auf die Kamerapixel umrechnen (Video ist mit object-fit:cover beschnitten) */
      var vr=v.getBoundingClientRect(),fr=document.querySelector("#scanner .frame").getBoundingClientRect();
      var sc=Math.max(vr.width/vw,vr.height/vh),ox=(vw*sc-vr.width)/2,oy=(vh*sc-vr.height)/2;
      var fx=(fr.left-vr.left+ox)/sc,fy=(fr.top-vr.top+oy)/sc,fw=fr.width/sc,fh=fr.height/sc;
      /* etwas großzügiger als der Rahmen */
      var mx=fw*0.08,my=fh*0.6;fx=Math.max(0,fx-mx);fy=Math.max(0,fy-my);fw=Math.min(vw-fx,fw+2*mx);fh=Math.min(vh-fy,fh+2*my);
      var phase=tick%4;
      if(phase===0)code=decodeRegion(v,fx,fy,fw,fh,1000,false,0);
      else if(phase===1)code=decodeRegion(v,fx,fy,fw,fh,700,false,1);
      else if(phase===2)code=decodeRegion(v,0,0,vw,vh,1100,false,0);
      else code=decodeRegion(v,0,0,vw,vh,1100,true,0);
    }catch(e){}
    if(code){found(code);return}
    if(tick===40)scanMsg("Noch nichts erkannt: etwas weiter weg halten (ca. 15–20 cm), bis der Strichcode scharf ist.");
  }
  loopTimer=setTimeout(scanLoop,60);
}
function startScan(){
  if(!window.ZXing){toast("Der Barcode-Leser lädt noch. Bitte kurz warten und noch einmal tippen.");return}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    toast("Live-Kamera nicht verfügbar. Nimm „Foto“.");$("scanner").hidden=false;scanMsg("Tippe auf „Foto“ und fotografiere den Barcode.");return;
  }
  $("scanner").hidden=false;scanMsg("Kamera startet …");scanning=true;tick=0;
  navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}}).then(function(s){
    if(!scanning){s.getTracks().forEach(function(t){t.stop()});return}
    stream=s;var v=$("video");v.setAttribute("playsinline","");v.muted=true;v.srcObject=s;
    var p=v.play();if(p&&p.catch)p.catch(function(){});
    /* Etwas Zoom und Dauerfokus, wo das Gerät es kann (hilft bei iPhones, die nah unscharf sind) */
    try{
      var tr=s.getVideoTracks()[0],caps=tr.getCapabilities?tr.getCapabilities():{},adv={};
      if(caps.focusMode&&caps.focusMode.indexOf("continuous")>=0)adv.focusMode="continuous";
      if(caps.zoom&&caps.zoom.max>=1.5)adv.zoom=Math.min(caps.zoom.max,2);
      if(Object.keys(adv).length)tr.applyConstraints({advanced:[adv]}).catch(function(){});
    }catch(e){}
    scanMsg("Barcode quer in den Rahmen halten");
    scanLoop();
  },function(err){
    scanning=false;
    var denied=err&&(err.name==="NotAllowedError"||err.name==="SecurityError");
    scanMsg(denied?"Kein Kamerazugriff. Erlaube ihn unter Einstellungen › Safari › Kamera, oder nimm „Foto“.":"Die Kamera ließ sich nicht starten. Nimm „Foto“.");
  });
}
/* Foto statt Live-Kamera */
function decodeFile(file){
  return new Promise(function(resolve){
    var url=URL.createObjectURL(file),im=new Image();
    im.onerror=function(){URL.revokeObjectURL(url);resolve(null)};
    im.onload=function(){
      URL.revokeObjectURL(url);
      var W=im.naturalWidth,H=im.naturalHeight,res=null;
      var tries=[[0,0,1,1600,0],[0.15,0.15,0.7,1600,0],[0,0,1,1000,0],[0,0,1,1600,1],[0.15,0.15,0.7,1000,1],[0,0,1,2400,0],[0.25,0.3,0.5,900,0],[0,0,1,700,0]],i=0;
      (function next(){
        if(res||i>=tries.length){resolve(res);return}
        var t=tries[i++];res=decodeRegion(im,W*t[0],H*t[1],W*t[2],H*(t[0]===0?1:t[2]),t[3],!!t[4],null);
        setTimeout(next,0);
      })();
    };
    im.src=url;
  });
}
$("scan-photo").addEventListener("change",function(e){
  var f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  stopScan();
  if(!window.ZXing){toast("Der Barcode-Leser ist noch nicht geladen.");return}
  toast("Barcode wird gesucht …");
  decodeFile(f).then(function(code){
    if(code){found(code);return}
    openSheet("Barcode eintippen",{});$("p-ean").focus();
    setStatus("Kein Barcode auf dem Foto erkannt. Tipp die Ziffern unter dem Strichcode ein oder versuch ein schärferes Foto.");
  });
});
$("scan-btn").addEventListener("click",startScan);
$("scan-close").addEventListener("click",stopScan);
$("scan-manual").addEventListener("click",function(){stopScan();openSheet("Barcode eintippen",{});$("p-ean").focus();setStatus("Tipp die Ziffern unter dem Strichcode ein.")});
$("p-ean").addEventListener("change",function(e){
  var ean=e.target.value.replace(/\D/g,"");
  if(validEan(ean)&&!$("p-name").value){var k=S.known[ean];if(k){$("p-name").value=k.name;$("p-price").value=k.price.toFixed(2).replace(".",",");setStatus("Schon einmal gekauft. Stimmt der Preis noch?")}else lookupName(ean).then(function(nm){if(nm&&!$("p-name").value){$("p-name").value=nm;$("p-price").focus()}})}
});
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;if(!$("scanner").hidden)stopScan();else if(!$("overlay").hidden)closeSheet()});
document.addEventListener("visibilitychange",function(){if(document.hidden&&!$("scanner").hidden)stopScan()});

/* ---------- Navigation, Toast ---------- */
var TABS=["liste","warenkorb","prospekte"];
function route(){
  var h=location.hash.replace("#","");if(TABS.indexOf(h)<0)h="liste";
  TABS.forEach(function(t){$("v-"+t).hidden=t!==h});
  document.querySelectorAll("nav.tabs a").forEach(function(a){if(a.dataset.tab===h)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("main").scrollTop=0;
}
window.addEventListener("hashchange",route);
var toastTimer=null;
function toast(t){var el=$("toast");el.textContent=t;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.hidden=true},2800)}
function renderAll(){
  renderList();renderCart();
  var open=S.list.filter(function(i){return !i.done}).length,n=S.cart.reduce(function(a,i){return a+i.qty},0);
  $("b-liste").textContent=open||"";$("b-korb").textContent=n||"";
}
route();renderAll();

/* Offline-Fähigkeit */
if("serviceWorker" in navigator&&location.protocol==="https:"){navigator.serviceWorker.register("sw.js").catch(function(){})}
})();
