"use strict";
const SB_URL = "https://dfpwqgzinuwwjwzxrioq.supabase.co";
const SB_KEY = "sb_publishable_uFeo3pNENWlZBt0_gBIXtQ_YMzTyQjt";

async function rpc(fn, body){
  const res = await fetch(SB_URL + "/rest/v1/rpc/" + fn, {
    method:"POST",
    headers:{"apikey":SB_KEY,"Authorization":"Bearer "+SB_KEY,"Content-Type":"application/json"},
    body: JSON.stringify(body||{})
  });
  const txt = await res.text();
  if(!res.ok){
    let msg = txt;
    try{ const j = JSON.parse(txt); msg = j.message || j.hint || txt; }catch(e){}
    throw new Error(msg);
  }
  return txt ? JSON.parse(txt) : null;
}

const DIMS = [
  {id:"b1", ad:"Görev başarımı ve içerik", d:[
    "Görev yerine getirilmemiş; metin konu dışı ya da değerlendirilemeyecek kadar kısa.",
    "Görevin yalnızca küçük bir bölümü karşılanmış; içerik noktalarının çoğu eksik. Tür ve hedef okur gözetilmemiş.",
    "Görev kısmen karşılanmış; içerik noktalarının bir bölümü yüzeysel işlenmiş. Kayıt yer yer tutarsız.",
    "Görev büyük ölçüde karşılanmış; tüm içerik noktaları işlenmiş, çoğu yeterince geliştirilmiş.",
    "Görev tam olarak karşılanmış; içerik dengeli ve ayrıntılandırılarak geliştirilmiş."]},
  {id:"b2", ad:"Örgütleme ve tutarlılık", d:[
    "Tanımlanabilir bir örgütlenme yok; anlamsal bağıntı kurulamıyor.",
    "Cümleler ardışık sıralanmış; yalnızca en temel bağlaçlar, tekrarlı. Paragraf yapısı yok.",
    "Basit bir yapı seçiliyor; bağlayıcı çeşitliliği sınırlı, yer yer akış kopuyor.",
    "Açık yapı, işlevsel paragraflar; bağlayıcılar çeşitli ve çoğunlukla doğru.",
    "Net ve amaca uygun yapı; geçişler bilinçli, gönderim araçları fark edilmeden işliyor."]},
  {id:"b3", ad:"Sözcük dağarcığı", d:[
    "Değerlendirme yapılamayacak kadar sınırlı.",
    "Çok temel sözcükler, sık yineleme; sözcük seçimi anlamı çoğu yerde engelliyor.",
    "Günlük konularda yeterli; konu dışına çıkıldığında yetersizlik ve ana dilden aktarım.",
    "Konuya uygun ve yeterince çeşitli; eşdizimde ara sıra hata, anlam engellenmiyor.",
    "Geniş, konuya özgü ve deyimsel açıdan uygun; kayıt bilinçli seçilmiş."]},
  {id:"b4", ad:"Dilbilgisel doğruluk", d:[
    "Değerlendirme yapılamayacak düzeyde.",
    "Ezberlenmiş basit kalıplar; dizim, çekim ve durumda sistematik hata; anlam sık engelleniyor.",
    "Basit yapılar çoğunlukla doğru; yan cümle, durum ve zamanda sık hata.",
    "Basit ve karmaşık yapılar genel olarak doğru; hatalar sistematik değil.",
    "Karmaşık yapılarda tutarlı denetim; hatalar seyrek ve dikkatsizlik düzeyinde."]}
];

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad = n => String(n).padStart(2,"0");
const fmt = s => pad(Math.floor(s/60))+":"+pad(s%60);

const S = {token:null, kosul:null, plan:[], idx:0, timer:null, tStart:0, saved:[]};

function view(id){
  ["v-login","v-consent","v-calib","v-rate","v-done"].forEach(v=>$("#"+v).classList.toggle("hidden", v!==id));
  window.scrollTo(0,0);
}
function renderCalib(){
  const el = $("#calib-dims");
  if(!el) return;
  el.innerHTML = DIMS.map(d=>`<div class="dim"><h3>${d.ad}</h3>
    <div style="display:grid;gap:4px;margin-top:8px">${d.d.map((x,i)=>
      `<div class="small"><b class="mono" style="color:var(--accent-ink)">${i}</b> — ${x}</div>`).join("")}</div></div>`).join("");
}
function renderDims(){
  $("#dims").innerHTML = DIMS.map(d=>`<div class="dim" data-dim="${d.id}">
    <div class="dim-head"><h3>${d.ad}</h3>
      <button type="button" class="defs-btn" data-defs="${d.id}" aria-expanded="false">tanımlar</button></div>
    <div class="defs hidden" id="defs-${d.id}">
      ${d.d.map((x,i)=>`<div><b>${i}</b><span>${x}</span></div>`).join("")}
    </div>
    <p class="hint" id="hint-${d.id}">Bir puanın üzerine gelin, tanımı burada görünsün.</p>
    <div class="scale" role="group" aria-label="${d.ad}">
      ${[0,1,2,3,4].map(i=>`<button type="button" data-v="${i}" aria-pressed="false" title="${d.d[i].replace(/"/g,"&quot;")}">${i}</button>`).join("")}
    </div></div>`).join("");
  $$("#dims .defs-btn").forEach(b=>b.addEventListener("click",()=>{
    const open = b.getAttribute("aria-expanded")==="true";
    b.setAttribute("aria-expanded", open?"false":"true");
    $("#defs-"+b.dataset.defs).classList.toggle("hidden", open);
  }));
  $$("#dims .scale button").forEach(b=>{
    const box=b.closest(".dim"), dim=box.dataset.dim, v=+b.dataset.v;
    const hint=()=>$("#hint-"+dim);
    const goster=()=>{ hint().textContent = DIMS.find(d=>d.id===dim).d[v]; hint().classList.add("preview"); };
    const geri=()=>{
      const sec = box.querySelector('button[aria-pressed="true"]');
      hint().classList.remove("preview");
      hint().textContent = sec ? DIMS.find(d=>d.id===dim).d[+sec.dataset.v]
                               : "Bir puanın üzerine gelin, tanımı burada görünsün.";
    };
    b.addEventListener("mouseenter",goster);
    b.addEventListener("focus",goster);
    b.addEventListener("mouseleave",geri);
    b.addEventListener("blur",geri);
    b.addEventListener("click",()=>{
      box.querySelectorAll(".scale button").forEach(x=>x.setAttribute("aria-pressed", x===b?"true":"false"));
      hint().classList.remove("preview");
      hint().textContent = DIMS.find(d=>d.id===dim).d[v];
      ready();
    });
  });
  $$("#guven button").forEach(b=>b.addEventListener("click",()=>{
    $$("#guven button").forEach(x=>x.setAttribute("aria-pressed", x===b?"true":"false"));
  }));
  $$("#butuncul button").forEach((b,i)=>b.addEventListener("click",()=>{
    $$("#butuncul button").forEach((x,j)=>{
      x.setAttribute("aria-pressed", j===i?"true":"false");
      x.classList.toggle("dolu", j<i);
    });
    ready();
  }));
}
function scores(){
  const o={};
  DIMS.forEach(d=>{const s=document.querySelector(`.dim[data-dim="${d.id}"] button[aria-pressed="true"]`);o[d.id]=s?+s.dataset.v:null;});
  return o;
}
function guven(){ const s=document.querySelector('#guven button[aria-pressed="true"]'); return s?+s.dataset.v:null; }
function butuncul(){ const s=document.querySelector('#butuncul button[aria-pressed="true"]'); return s?+s.dataset.v:null; }
function ready(){
  const sc=scores(), un=$("#unscorable").checked;
  const eksik = Object.values(sc).filter(v=>v===null).length + (butuncul()===null?1:0);
  $("#btn-save").disabled = !un && eksik>0;
  const msg=$("#save-msg");
  if(!un && eksik>0){ msg.textContent = "Devam etmek için "+eksik+" ölçütü daha puanlayın."; msg.style.color="var(--ink-2)"; }
  else if(msg.textContent.startsWith("Devam etmek")){ msg.textContent=""; }
}
function timerStart(){
  clearInterval(S.timer);
  const t0=Date.now();
  $("#chip-timer").classList.remove("hidden");
  S.timer=setInterval(()=>{$("#chip-timer").textContent=fmt(Math.floor((Date.now()-t0)/1000));},1000);
}
function nextUnrated(){
  for(let i=0;i<S.plan.length;i++) if(!S.plan[i].puanlandi) return i;
  return S.plan.length;
}
function loadItem(){
  const it = S.plan[S.idx];
  $("#t-tags").innerHTML = `<b>${it.duzey}</b><b>${it.gorev_turu}</b><b>${it.atama_turu==="capa"?"çapa seti":"rastgele"}</b>`;
  $("#t-prompt").textContent = "Görev: " + it.gorev_metni;
  $("#t-text").textContent = it.metin;
  $("#t-pos").textContent = (S.idx+1)+" / "+S.plan.length;
  const rz=$("#chip-pos"); if(rz){ rz.textContent = "Metin "+(S.idx+1)+"/"+S.plan.length; rz.classList.remove("hidden"); }
  $("#t-id").textContent = it.metin_id;
  $("#bar").style.width = (S.idx/S.plan.length*100)+"%";
  if(it.gosterilen_ai === null || it.gosterilen_ai === undefined){
    $("#ai-box").classList.add("hidden");
  }else{
    $("#ai-box").classList.remove("hidden");
    $("#ai-score").textContent = Number(it.gosterilen_ai).toFixed(1);
    $("#ai-just").textContent = it.ai_gerekce || "";
  }
  $$("#dims .scale button").forEach(b=>b.setAttribute("aria-pressed","false"));
  DIMS.forEach(d=>{const h=$("#hint-"+d.id);h.classList.remove("preview");
    h.textContent="Bir puanın üzerine gelin, tanımı burada görünsün.";});
  $$("#guven button").forEach(b=>b.setAttribute("aria-pressed","false"));
  $$("#butuncul button").forEach(b=>{b.setAttribute("aria-pressed","false");b.classList.remove("dolu");});
  $("#unscorable").checked=false; $("#unscorable-why").classList.add("hidden");
  $("#note").value=""; $("#save-msg").textContent=""; $("#save-msg").style.color="";
  ready();
  window.scrollTo({top:0,behavior:"smooth"});
  S.tStart=Date.now();
}
async function save(){
  const it=S.plan[S.idx], sc=scores(), un=$("#unscorable").checked;
  $("#btn-save").disabled=true; $("#save-msg").textContent="Kaydediliyor…";
  try{
    const r = await rpc("puan_kaydet",{
      p_token:S.token, p_metin:it.metin_id,
      p_b1:sc.b1, p_b2:sc.b2, p_b3:sc.b3, p_b4:sc.b4,
      p_butuncul: butuncul(), p_puanlanamaz:un,
      p_gerekce: un ? $("#unscorable-why").value : null,
      p_guven: guven(), p_yorum: $("#note").value.trim() || null,
      p_sure: Math.round((Date.now()-S.tStart)/1000)
    });
    it.puanlandi = true;
    S.saved.push({butuncul: un?null:butuncul(), sure: Math.round((Date.now()-S.tStart)/1000), un});
    $("#save-msg").textContent = "✓ Kaydedildi ("+r.tamamlanan+"/"+S.plan.length+") — sıradaki metin yükleniyor.";
    $("#save-msg").style.color = "var(--accent-ink)";
    S.idx = nextUnrated();
    if(S.idx >= S.plan.length) finish(); else loadItem();
  }catch(e){
    $("#save-msg").textContent = "Kaydedilemedi: "+e.message+" — internet bağlantınızı denetleyip yeniden deneyin.";
    $("#btn-save").disabled=false;
  }
}
function finish(){
  clearInterval(S.timer);
  $("#bar").style.width="100%";
  const done=S.saved.filter(r=>!r.un);
  const ort = done.length ? (done.reduce((a,b)=>a+b.butuncul,0)/done.length).toFixed(1) : "–";
  $("#done-stats").innerHTML = `
    <div class="tile"><b>${S.plan.length}</b><span class="small muted">puanlanan metin</span></div>
    <div class="tile"><b>${fmt(S.saved.reduce((a,b)=>a+b.sure,0))}</b><span class="small muted">bu oturumdaki süre</span></div>
    <div class="tile"><b>${ort}</b><span class="small muted">ortalama bütüncül</span></div>
    <div class="tile"><b>${S.saved.filter(r=>r.un).length}</b><span class="small muted">puanlanamaz</span></div>`;
  view("v-done");
}

$("#btn-gen").addEventListener("click",()=>{$("#in-token").value="PK-"+String(1000+Math.floor(Math.random()*9000));});
$("#in-token").addEventListener("keydown",e=>{if(e.key==="Enter")$("#btn-login").click();});
$("#btn-login").addEventListener("click",async ()=>{
  const tok=$("#in-token").value.trim().toUpperCase();
  if(tok.length<3){$("#login-msg").textContent="Lütfen en az üç karakterli bir erişim kodu girin.";return;}
  $("#login-msg").textContent="Bağlanıyor…";
  try{
    const r = await rpc("oturum_baslat",{p_token:tok});
    S.token=r.token; S.kosul=r.kosul; S.plan=r.plan;
    $("#chip-token").textContent=S.token; $("#chip-token").classList.remove("hidden");
    $("#m-count").textContent = S.plan.length + " metin";
    $("#login-msg").textContent="";
    if(r.tamamlanan>0){
      S.idx = nextUnrated(); timerStart();
      if(S.idx>=S.plan.length){ finish(); return; }
      view("v-rate"); loadItem();
    }else{ view("v-consent"); }
  }catch(e){ $("#login-msg").textContent = "Bağlanılamadı: "+e.message; }
});
$("#ck1").addEventListener("change",()=>{$("#btn-consent").disabled=!$("#ck1").checked;});
$("#btn-consent").addEventListener("click",async ()=>{
  $("#btn-consent").disabled=true;
  try{
    const r = await rpc("oturum_baslat",{p_token:S.token, p_onam_ai:$("#ck2").checked});
    S.plan=r.plan; $("#consent-err").classList.add("hidden");
    renderCalib(); view("v-calib");
  }catch(e){
    $("#consent-err").textContent="Onam kaydedilemedi: "+e.message;
    $("#consent-err").classList.remove("hidden"); $("#btn-consent").disabled=false;
  }
});
$("#btn-start").addEventListener("click",()=>{S.idx=nextUnrated();timerStart();view("v-rate");loadItem();});
$("#unscorable").addEventListener("change",e=>{$("#unscorable-why").classList.toggle("hidden",!e.target.checked);ready();});
$("#btn-save").addEventListener("click",save);
$("#btn-pause").addEventListener("click",()=>{clearInterval(S.timer);view("v-login");
  $("#login-msg").textContent="Oturum duraklatıldı. Aynı kodla girdiğinizde kaldığınız yerden devam edersiniz.";});
$("#btn-restart").addEventListener("click",()=>location.reload());

renderDims();
