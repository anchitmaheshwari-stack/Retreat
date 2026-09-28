// @ts-nocheck
// Renders the dashboard into the markup from lib/markup.ts. Plain DOM code, driven by one snapshot.
export function initDashboard(SNAP){
const TYPES=SNAP.types;
const MONTHS=SNAP.months;
const MK=Object.fromEntries(MONTHS.map(m=>[m.k,m]));
const D=SNAP.rows;
const PERIODS=[];for(let i=MONTHS.length-1;i>0;i--)PERIODS.push({id:MONTHS[i].k+"-"+MONTHS[i-1].k,cur:MONTHS[i].k,prev:MONTHS[i-1].k,label:`${MONTHS[i].label} vs ${MONTHS[i-1].label} (MoM)`});
for(let i=MONTHS.length-1;i>=0;i--)PERIODS.push({id:MONTHS[i].k,cur:MONTHS[i].k,prev:null,label:MONTHS[i].name+" only"});
const S={type:"All",perDay:false,metric:"c",sort:"c",dir:-1,q:"",only:true,period:PERIODS[0].id};
try{const t=localStorage.getItem("crs-type");if(t&&(t==="All"||TYPES.includes(t)))S.type=t;const p=localStorage.getItem("crs-period");if(PERIODS.some(x=>x.id===p))S.period=p;}catch(e){}
const P=()=>PERIODS.find(p=>p.id===S.period);
const $=id=>document.getElementById(id);
const fmt=(v,d=0)=>v==null?"–":v.toLocaleString("en-IN",{maximumFractionDigits:d,minimumFractionDigits:d});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function rows(){return S.type==="All"?D:D.filter(r=>r.type===S.type)}
function agg(rs,mk){const o={n:rs.length,c:0,i:0,l:0,o:0,w:0,u:0};
  for(const r of rs){const x=r.m[mk];o.c+=x.c;o.i+=x.i;o.l+=x.l;o.o+=x.o;if(x.p!=null&&x.i)o.w+=x.p*x.i;if(x.c||x.i)o.u++;}
  o.p=o.i?o.w/o.i:null;return o;}
const adj=(v,mk)=>S.perDay&&v!=null?v/MK[mk].days:v;
const hasData=(r,mk)=>{const x=r.m[mk];return x.c||x.i||x.l||x.o};
function pill(a,b,{lowerBetter=false,dec=0,pct=true}={}){
  if(a==null||b==null)return '<span class="pill flat">–</span>';
  const d=b-a;if(Math.abs(d)<1e-9)return '<span class="pill flat">± 0</span>';
  const good=lowerBetter?d<0:d>0;const arrow=d>0?"▲":"▼";
  const txt=pct&&a>0?(d>0?"+":"")+Math.round(d/a*100)+"%":(d>0?"+":"")+fmt(d,dec);
  return `<span class="pill ${good?"up":"down"}" title="${good?"Improved":"Declined"}">${arrow} ${txt}</span>`;}
function controls(){
  $("chips").innerHTML=["All",...TYPES].map(t=>`<button class="chip" aria-pressed="${S.type===t}" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  $("period").innerHTML=PERIODS.map(p=>`<option value="${p.id}"${p.id===S.period?" selected":""}>${esc(p.label)}</option>`).join("");
  $("b-total").setAttribute("aria-pressed",!S.perDay);$("b-day").setAttribute("aria-pressed",S.perDay);
  const p=P();$("rangeNote").innerHTML=p.prev?`Comparing <b>${MK[p.cur].range}</b> with <b>${MK[p.prev].range}</b>.`:`Showing <b>${MK[p.cur].range}</b> only.`;
  const part=[p.cur,p.prev].filter(Boolean).map(k=>MK[k]).find(m=>m.partial);
  $("partial").hidden=!part||S.perDay||!p.prev;
  if(part)$("partial").innerHTML=`<b>${esc(part.name)} is partial.</b> Search Console data runs ${esc(part.range)} (${part.days} days). Switch to <b>Per day</b> for a like-for-like comparison.`;}
function kpis(){const p=P(),rs=rows(),b=agg(rs,p.cur),a=p.prev?agg(rs,p.prev):null;const u=S.perDay?" / day":"";const dp=S.perDay?1:0,dl=S.perDay?2:0;
  const k=[["Clicks"+u,"c",{dec:dp}],["Impressions"+u,"i",{dec:dp}],["Avg position","p",{dec:1,lowerBetter:true,pct:false,raw:true}],["Leads"+u,"l",{dec:dl}],["Onboardings"+u,"o",{dec:dl}]];
  $("kpis").innerHTML=k.map(([l,f,op])=>{const vb=op.raw?b[f]:adj(b[f],p.cur);const va=a?(op.raw?a[f]:adj(a[f],p.prev)):null;
    const foot=a?`<span class="from">${MK[p.prev].label} ${fmt(va,op.dec)}</span>${pill(va,vb,op)}`:`<span class="from">${MK[p.cur].range}</span>`;
    return `<div class="kpi"><div class="lbl">${l}</div><div class="v">${fmt(vb,op.dec)}</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${foot}</div></div>`}).join("");}
const METRICS={c:"Clicks",i:"Impressions",l:"Leads",o:"Onboardings"};
function metricSeg(){$("metricSeg").innerHTML=Object.entries(METRICS).map(([k,n])=>`<button data-m="${k}" aria-pressed="${S.metric===k}">${n}</button>`).join("");}
const tip=$("tip");
function showTip(e,html){tip.innerHTML=html;tip.hidden=false;const w=tip.offsetWidth,h=tip.offsetHeight;let x=e.clientX+14,y=e.clientY+14;if(x+w>innerWidth-8)x=e.clientX-w-14;if(y+h>innerHeight-8)y=e.clientY-h-14;tip.style.left=x+"px";tip.style.top=y+"px";}
function hideTip(){tip.hidden=true}
function niceMax(v){if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;return [1,1.2,1.6,2,2.4,3,4,6,8,10].find(k=>n<=k)*p;}
function bar(x,y,w,h){if(w<=0)return "";const r=Math.min(4,w,h/2);return `M${x},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x}Z`;}
function barChart(){const p=P(),f=S.metric,name=METRICS[f];const dec=S.perDay?(f==="c"||f==="i"?1:2):0;
  $("barLegend").innerHTML=(p.prev?`<span><i style="background:var(--aug)"></i>${MK[p.prev].label}</span>`:"")+`<span><i style="background:var(--sep)"></i>${MK[p.cur].label}</span>`;
  const types=S.type==="All"?TYPES:[S.type];
  const data=types.map(t=>{const rs=D.filter(r=>r.type===t);return{t,a:p.prev?adj(agg(rs,p.prev)[f],p.prev):null,s:adj(agg(rs,p.cur)[f],p.cur)}}).sort((x,y)=>y.s-x.s||(y.a||0)-(x.a||0));
  const two=!!p.prev,W=560,lw=150,rw=16,bh=two?9:14,gap=2,rowH=34,top=8,H=top+data.length*rowH+24;
  const mx=niceMax(Math.max(...data.map(d=>Math.max(d.a||0,d.s)),0));const x=v=>lw+(W-lw-rw)*v/mx;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${name} by page type">`;
  for(let i=0;i<=4;i++){const v=mx*i/4,xx=x(v);s+=`<line x1="${xx}" x2="${xx}" y1="${top-4}" y2="${H-20}" stroke="var(--line2)" stroke-width="1"/><text x="${xx}" y="${H-6}" font-size="10.5" fill="var(--muted)" text-anchor="${i===0?"start":i===4?"end":"middle"}">${fmt(v,v%1?1:0)}</text>`;}
  data.forEach((d,i)=>{const y=top+i*rowH,y0=y+(rowH-(two?2*bh+gap:bh))/2;const wa=two?x(d.a)-lw:0,ws=x(d.s)-lw;const ys=two?y0+bh+gap:y0;
    s+=`<g class="hit" data-i="${i}"><rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>`+
    `<text x="${lw-10}" y="${y+rowH/2+4}" font-size="12" fill="var(--ink2)" text-anchor="end">${esc(d.t)}</text>`+
    (two?`<path d="${bar(lw,y0,wa,bh)}" fill="var(--aug)"/>`:"")+`<path d="${bar(lw,ys,ws,bh)}" fill="var(--sep)"/>`+
    `<text x="${lw+Math.max(wa,ws)+6}" y="${ys+bh/2+4}" font-size="10.5" fill="var(--ink2)" font-family="IBM Plex Mono,monospace">${fmt(d.s,dec)}</text></g>`;});
  s+=`<line x1="${lw}" x2="${lw}" y1="${top-4}" y2="${H-20}" stroke="var(--muted)" stroke-width="1"/></svg>`;
  const el=$("barChart");el.innerHTML=s;
  el.querySelectorAll(".hit").forEach(g=>{const d=data[+g.dataset.i];g.onmousemove=e=>showTip(e,`<b>${esc(d.t)}</b><br>${name}${S.perDay?" / day":""}<br><span class="m">${two?`${MK[p.prev].label} ${fmt(d.a,dec)} → `:""}${MK[p.cur].label} ${fmt(d.s,dec)}</span>`);g.onmouseleave=hideTip;});}
function dumbbell(){const p=P(),el=$("dumbbell"),c=p.cur,v=p.prev;
  $("dbTitle").textContent=v?"Position movement, top pages":"Best-ranking top pages";
  $("dbDesc").textContent=v?`The 12 pages with the most ${MK[c].name} impressions that ranked in both months. Lower is better.`:`Average position of the 12 pages with the most ${MK[c].name} impressions. Lower is better.`;
  $("dbLegend").innerHTML=(v?`<span><i style="background:var(--aug);border-radius:50%"></i>${MK[v].label} position</span>`:"")+`<span><i style="background:var(--sep);border-radius:50%"></i>${MK[c].label} position</span>`;
  const rs=rows().filter(r=>r.m[c].p!=null&&(!v||r.m[v].p!=null)).sort((a,b)=>b.m[c].i-a.m[c].i).slice(0,12);
  if(!rs.length){el.innerHTML=`<p class="dim">No page in this selection has position data for ${v?"both months":"this month"}.</p>`;return;}
  const W=460,lw=190,rw=14,rowH=28,top=6,H=top+rs.length*rowH+24;
  const mx=Math.max(10,Math.ceil(Math.max(...rs.map(r=>Math.max(r.m[c].p,v?r.m[v].p:0)))/5)*5);const x=q=>lw+(W-lw-rw)*(q-1)/(mx-1);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Average position by page">`;
  [1,...Array.from({length:Math.floor(mx/5)},(_,i)=>(i+1)*5)].forEach(t=>{s+=`<line x1="${x(t)}" x2="${x(t)}" y1="${top-2}" y2="${H-20}" stroke="var(--line2)"/><text x="${x(t)}" y="${H-6}" font-size="10.5" fill="var(--muted)" text-anchor="${t===1?"start":t===mx?"end":"middle"}">${t}</text>`;});
  rs.forEach((r,i)=>{const y=top+i*rowH+rowH/2;const lab=r.url.split("/").pop()||r.url;const pc=r.m[c].p,pv=v?r.m[v].p:null;
    s+=`<g class="hit" data-i="${i}"><rect x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" fill="transparent"/><text x="${lw-10}" y="${y+4}" font-size="11.5" fill="var(--ink2)" text-anchor="end">${esc(lab.length>26?lab.slice(0,25)+"…":lab)}</text>`+
    (v?`<line x1="${x(pv)}" x2="${x(pc)}" y1="${y}" y2="${y}" stroke="${pc<pv?"var(--good)":"var(--bad)"}" stroke-width="2"/><circle cx="${x(pv)}" cy="${y}" r="5" fill="var(--aug)" stroke="var(--surface)" stroke-width="2"/>`:`<line x1="${x(1)}" x2="${x(pc)}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="2"/>`)+
    `<circle cx="${x(pc)}" cy="${y}" r="5" fill="var(--sep)" stroke="var(--surface)" stroke-width="2"/></g>`;});
  el.innerHTML=s+"</svg>";
  el.querySelectorAll(".hit").forEach(g=>{const r=rs[+g.dataset.i];g.onmousemove=e=>showTip(e,`<b>${esc(r.url)}</b><br><span class="m">Position ${v?fmt(r.m[v].p,1)+" → ":""}${fmt(r.m[c].p,1)}</span><br><span class="m">Impr ${v?fmt(r.m[v].i)+" → ":""}${fmt(r.m[c].i)}</span>`);g.onmouseleave=hideTip;});}
function typeTbl(){const p=P(),c=p.cur,v=p.prev,types=S.type==="All"?TYPES:[S.type];const dp=S.perDay?1:0,dl=S.perDay?2:0;const C=MK[c].label,V=v&&MK[v].label;
  const pair=(a,b,d)=>v?`${fmt(a,d)} → ${fmt(b,d)}`:fmt(b,d);
  const line=(label,rs,cls="")=>{const b=agg(rs,c),a=v?agg(rs,v):null;
    return `<tr class="${cls}"><td class="l">${esc(label)}</td><td>${b.n}</td><td>${pair(a&&a.u,b.u,0)}</td>`+
    (v?`<td>${fmt(adj(a.c,v),dp)}</td>`:"")+`<td>${fmt(adj(b.c,c),dp)}</td>`+(v?`<td>${pill(adj(a.c,v),adj(b.c,c))}</td>`:"")+
    `<td>${fmt(adj(b.i,c),dp)}</td>`+(v?`<td>${pill(adj(a.i,v),adj(b.i,c))}</td>`:"")+
    `<td>${pair(a&&a.p,b.p,1)}</td><td>${pair(a&&adj(a.l,v),adj(b.l,c),dl)}</td><td>${pair(a&&adj(a.o,v),adj(b.o,c),dl)}</td></tr>`;};
  const list=types.map(t=>[t,D.filter(r=>r.type===t)]).sort((x,y)=>agg(y[1],c).c-agg(x[1],c).c);
  let h=`<thead><tr><th class="l">Page type</th><th>URLs</th><th>URLs w/ data</th>`+(v?`<th>Clicks ${V}</th>`:"")+`<th>Clicks ${C}</th>`+(v?`<th>Clicks Δ</th>`:"")+`<th>Impr ${C}</th>`+(v?`<th>Impr Δ</th>`:"")+`<th>Avg pos</th><th>Leads</th><th>Onboardings</th></tr></thead><tbody>`;
  list.forEach(([t,rs])=>h+=line(t,rs));if(types.length>1)h+=line("Total",D,"grp");
  $("typeTbl").innerHTML=h+"</tbody>";}
function kwTbl(){const p=P(),c=p.cur,v=p.prev;const rs=rows().filter(r=>r.m[c].kp!=null||(v&&r.m[v].kp!=null)).sort((a,b)=>(a.m[c].kp??99)-(b.m[c].kp??99));
  if(!rs.length){$("kwTbl").innerHTML='<tbody><tr><td class="l dim">No exact-match primary keyword data for this selection.</td></tr></tbody>';return;}
  $("kwTbl").innerHTML=`<thead><tr><th class="l">Primary keyword</th><th class="l">URL</th><th class="l">Type</th>${v?`<th>${MK[v].label}</th>`:""}<th>${MK[c].label}</th>${v?"<th>Change</th>":""}</tr></thead><tbody>`+
  rs.map(r=>{const b=r.m[c].kp,a=v?r.m[v].kp:null;const ch=!v?"":`<td>${a!=null&&b!=null?pill(a,b,{lowerBetter:true,pct:false,dec:1}):(a==null?'<span class="pill flat">new</span>':'<span class="pill flat">lost</span>')}</td>`;
    return `<tr><td class="l">${esc(r.kw)}</td><td class="l url"><a href="https://www.skydo.com${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></td><td class="l type">${esc(r.type)}</td>${v?`<td>${fmt(a,1)}</td>`:""}<td>${fmt(b,1)}</td>${ch}</tr>`}).join("")+"</tbody>";}
function urlTbl(){const p=P(),c=p.cur,v=p.prev,C=MK[c].label,V=v&&MK[v].label;
  const cols=[["url","URL","l"],["type","Type","l"]];
  if(v)cols.push(["pc","Clicks "+V]);cols.push(["c","Clicks "+C]);if(v)cols.push(["dc","Δ"]);
  if(v)cols.push(["pi","Impr "+V]);cols.push(["i","Impr "+C]);if(v)cols.push(["pp","Pos "+V]);cols.push(["p","Pos "+C],["l","Leads "+C],["o","Onb. "+C]);
  if(!cols.some(k=>k[0]===S.sort)){S.sort="c";S.dir=-1;}
  let rs=rows();if(S.only)rs=rs.filter(r=>hasData(r,c)||(v&&hasData(r,v)));
  const q=S.q.trim().toLowerCase();if(q)rs=rs.filter(r=>r.url.toLowerCase().includes(q)||r.kw.toLowerCase().includes(q));
  const val=r=>{const k=S.sort,b=r.m[c],a=v?r.m[v]:null;return k==="url"?r.url:k==="type"?r.type:k==="dc"?b.c-a.c:k==="pc"?a.c:k==="pi"?a.i:k==="pp"?a.p:b[k];};
  rs=[...rs].sort((a,b)=>{const x=val(a),y=val(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return typeof x==="string"?x.localeCompare(y)*S.dir:(x-y)*S.dir;});
  const arrow=k=>S.sort===k?(S.dir<0?" ↓":" ↑"):"";
  $("urlTbl").innerHTML=`<thead><tr>${cols.map(([k,l,cl])=>`<th class="${cl||""}"><button data-k="${k}">${l}${arrow(k)}</button></th>`).join("")}</tr></thead><tbody>`+
  rs.map(r=>{const b=r.m[c],a=v?r.m[v]:null;return `<tr><td class="l url" title="${esc(r.kw)}"><a href="https://www.skydo.com${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></td><td class="l type">${esc(r.type)}</td>`+
    (v?`<td>${fmt(a.c)}</td>`:"")+`<td>${fmt(b.c)}</td>`+(v?`<td>${pill(a.c,b.c,{pct:false})}</td><td>${fmt(a.i)}</td>`:"")+`<td>${fmt(b.i)}</td>`+(v?`<td>${fmt(a.p,1)}</td>`:"")+`<td>${fmt(b.p,1)}</td><td>${fmt(b.l)}</td><td>${fmt(b.o)}</td></tr>`}).join("")+"</tbody>";
  $("urlTbl").querySelectorAll("th button").forEach(bt=>bt.onclick=()=>{const k=bt.dataset.k;if(S.sort===k)S.dir*=-1;else{S.sort=k;S.dir=(k==="url"||k==="type"||k==="p"||k==="pp")?1:-1;}urlTbl();});
  $("urlCount").textContent=`${rs.length} of ${rows().length} URLs shown`;}
function render(){controls();kpis();metricSeg();barChart();dumbbell();typeTbl();kwTbl();urlTbl();}
$("subline").textContent=`${D.length} URLs across ${TYPES.length} page types. ${MONTHS.length>1?MONTHS[0].name+" to "+MONTHS[MONTHS.length-1].name:MONTHS[0].name}, with leads and onboardings.`;
$("updated").textContent=(SNAP.source==="sample"?"Sample data · ":"")+"Updated "+new Date(SNAP.generatedAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"})+" IST";
$("warnings").innerHTML=(SNAP.warnings||[]).map(w=>`<div class="warn">${esc(w)}</div>`).join("");
$("chips").onclick=e=>{const b=e.target.closest(".chip");if(!b)return;S.type=b.dataset.t;try{localStorage.setItem("crs-type",S.type)}catch(e){}render();};
$("period").onchange=e=>{S.period=e.target.value;try{localStorage.setItem("crs-period",S.period)}catch(e){}render();};
$("metricSeg").onclick=e=>{const b=e.target.closest("button");if(!b)return;S.metric=b.dataset.m;render();};
$("b-total").onclick=()=>{S.perDay=false;render()};$("b-day").onclick=()=>{S.perDay=true;render()};
$("q").oninput=e=>{S.q=e.target.value;urlTbl()};$("onlyData").onchange=e=>{S.only=e.target.checked;urlTbl()};
render();
}
