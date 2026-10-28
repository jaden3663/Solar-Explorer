const G = 6.674e-11, GM_SUN = 1.32712440018e20, AU = 1.495978707e11;
const EARTH_M = 5.972e24, EARTH_R = 6371000;

const planets = [
 {name:"수성", mass:3.3011e23, radius:2439.7e3, dist:0.387, periodDays:88.0, rot:1407.6, temp:167, L0:252.25},
 {name:"금성", mass:4.8675e24, radius:6051.8e3, dist:0.723, periodDays:224.7, rot:5832.5, temp:464, L0:181.98},
 {name:"지구", mass:5.972e24,  radius:6371e3,   dist:1.000, periodDays:365.25,rot:23.93, temp:15,  L0:100.47},
 {name:"화성", mass:6.4171e23, radius:3389.5e3, dist:1.524, periodDays:687.0, rot:24.62, temp:-65, L0:355.43},
 {name:"목성", mass:1.8982e27, radius:69911e3,  dist:5.203, periodDays:4331,  rot:9.93,  temp:-110,L0:34.35},
 {name:"토성", mass:5.6834e26, radius:58232e3,  dist:9.537, periodDays:10747, rot:10.7,  temp:-140,L0:50.08},
 {name:"천왕성",mass:8.6810e25, radius:25362e3,  dist:19.191,periodDays:30589, rot:17.24, temp:-195,L0:314.20},
 {name:"해왕성",mass:1.02413e26,radius:24622e3,  dist:30.07, periodDays:59800, rot:16.11, temp:-200,L0:304.22},
];
planets.forEach(p=>{
  p.g = G*p.mass/(p.radius*p.radius);
  p.ve = Math.sqrt(2*G*p.mass/p.radius);
});
let virtualPlanet = null; // 가상 행성 (시뮬레이터에서 생성)
function getBodies(){ return virtualPlanet ? planets.concat([virtualPlanet]) : planets; }
function daysSinceJ2000(){ return (Date.now() - Date.UTC(2000,0,1,12,0,0))/86400000; }

function fmt(n,d=2){return Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d})}

// tabs
document.querySelectorAll('#tabs button').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.t).classList.add('active');
    if(btn.dataset.t==='compare') drawCompare();
    if(btn.dataset.t==='kepler') drawKepler();
  };
});

// 1. explore — 실제 축척 + 실시간 위치 + 배속 재생 + 줌
const expWrap = document.getElementById('explorePlanets');
const colors = ['#b5b0a8','#e8c27e','#6ea8ff','#d97a5a','#e0b087','#f0d9a8','#9fd8e8','#6a8fe0','#c77dff'];
const CX=300, CY=300, MAXPX=272;
let selectedIdx = 2;
let orbitPxArr = [];
let speedDaysPerSec = 1;   // 배속: 1 = 하루/초
let simDays = 0;
let baseDotR = [];
const baseSunR = 3; // 내행성 궤도를 감싸지 않도록 실제 비율에 가깝게 축소
let currentScale = 1; // px per AU (기본 전체보기 축척)
let oortMode = false;
const belts = [
  {key:'asteroid', name:'소행성대', icon:'🪨', innerAU:2.1, outerAU:3.3},
  {key:'kuiper',   name:'카이퍼 벨트', icon:'❄️', innerAU:30, outerAU:50},
  {key:'oort',     name:'오르트 구름', icon:'☁️', innerAU:2000, outerAU:100000},
];

function buildButtons(){
  expWrap.innerHTML='';
  getBodies().forEach((p,i)=>{
    const b=document.createElement('button');
    b.className='planet-btn'+(i===selectedIdx?' active':'')+(p.isVirtual?' virtual':'');
    b.textContent=(p.isVirtual?'🧪 ':'')+p.name;
    b.onclick=()=>selectPlanet(i);
    expWrap.appendChild(b);
  });
}

function buildSystem(){
  oortMode = false;
  const bodies = getBodies();
  const maxDist = Math.max(...bodies.map(b=>b.dist));
  const scale = MAXPX/maxDist;
  currentScale = scale;
  orbitPxArr = bodies.map(b=>b.dist*scale);
  const dotR = bodies.map((b,i)=> b.isVirtual?8:[2.5,3.5,4,3.5,9,8,6,6][i]);
  baseDotR = dotR;
  let svg = `<svg id="sysSvg" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<circle id="sunCircle" cx="${CX}" cy="${CY}" r="${baseSunR}" fill="#ffcf6e"/>`;
  orbitPxArr.forEach(r=>{ svg += `<circle class="orbit-ring" cx="${CX}" cy="${CY}" r="${r}"/>`; });
  const ab=belts[0];
  svg += `<circle class="belt-ring" id="asteroidRing" cx="${CX}" cy="${CY}" r="${(ab.innerAU+ab.outerAU)/2*scale}" stroke-width="${(ab.outerAU-ab.innerAU)*scale}"/>`;
  bodies.forEach((p,i)=>{
    const cx0=CX+orbitPxArr[i];
    svg += `<circle class="hit-dot" data-i="${i}" id="hit-${i}" cx="${cx0}" cy="${CY}" r="14"><title>${p.name} · ${fmt(p.dist,2)} AU</title></circle>`;
    svg += `<circle class="planet-dot${i===selectedIdx?' selected':''}" data-i="${i}" id="dot-${i}"
      cx="${cx0}" cy="${CY}" r="${dotR[i]}" fill="${colors[i]}"></circle>`;
  });
  svg += `</svg>`;
  document.getElementById('systemDiagram').innerHTML = svg;
  document.querySelectorAll('.hit-dot').forEach(el=>{
    el.addEventListener('click', ()=>selectPlanet(parseInt(el.dataset.i)));
  });
  updatePositions();
  applyZoomSizing(600);
}

function updatePositions(){
  const bodies = getBodies();
  const now = daysSinceJ2000();
  bodies.forEach((p,i)=>{
    const ang = ((p.L0 + 360*(now+simDays)/p.periodDays)%360)*Math.PI/180;
    const x=CX+orbitPxArr[i]*Math.cos(ang), y=CY+orbitPxArr[i]*Math.sin(ang);
    const el = document.getElementById('dot-'+i);
    const hit = document.getElementById('hit-'+i);
    if(el){ el.setAttribute('cx',x); el.setAttribute('cy',y); }
    if(hit){ hit.setAttribute('cx',x); hit.setAttribute('cy',y); }
  });
}

// 확대 시 태양은 화면상 크기를 거의 그대로 유지(노란 배경 방지),
// 행성 점은 색이 또렷이 보이도록 어느 정도 커지되(겹침 방지용 상한 2.5배) 간격만큼 커지진 않게 함
function applyZoomSizing(vbWidth){
  const sunFactor = vbWidth/600;
  const sunEl = document.getElementById('sunCircle');
  if(sunEl) sunEl.setAttribute('r', baseSunR*sunFactor);
  const boost = Math.min(Math.sqrt(600/vbWidth), 2.5);
  getBodies().forEach((p,i)=>{
    const rUser = (baseDotR[i]||6) * (vbWidth/600) * boost;
    const el = document.getElementById('dot-'+i);
    const hit = document.getElementById('hit-'+i);
    if(el) el.setAttribute('r', rUser);
    if(hit) hit.setAttribute('r', Math.max(rUser*2.5, vbWidth*0.025));
  });
  updateStrokeWidths();
}

// 테두리 두께를 점 크기에 비례해서 계산 — 작은 내행성 점을 테두리가 뒤덮지 않도록 함
function updateStrokeWidths(){
  document.querySelectorAll('.planet-dot').forEach(el=>{
    const r = parseFloat(el.getAttribute('r'))||1;
    const sel = el.classList.contains('selected');
    const w = sel ? Math.max(r*0.22, 0.4) : Math.max(r*0.14, 0.25);
    el.setAttribute('stroke-width', w);
  });
}

function zoomTo(i){
  const svgEl=document.getElementById('sysSvg'); if(!svgEl) return;
  // 해왕성처럼 이미 전체보기 가장자리에 있는 행성은 줌 창이 전체보기보다 커지지 않게 상한을 둠
  const r = Math.min(Math.max(orbitPxArr[i]*2.2, 16), 300);
  svgEl.setAttribute('viewBox', `${CX-r} ${CY-r} ${r*2} ${r*2}`);
  applyZoomSizing(r*2);
  const kr=document.getElementById('kuiperRingDynamic'); if(kr) kr.remove();
  markBeltActive(null);
  document.getElementById('diagramNote').textContent = '거리 비율은 실제 AU 기준 축척 (행성 크기는 보기 쉽게 과장됨) · 아래 버튼을 누르면 해당 행성으로 확대';
}
function resetZoom(){
  if(oortMode){ buildSystem(); buildButtons(); showExplore(getBodies()[selectedIdx]||planets[2]); }
  const svgEl=document.getElementById('sysSvg'); if(!svgEl) return;
  svgEl.setAttribute('viewBox','0 0 600 600');
  applyZoomSizing(600);
  const kr=document.getElementById('kuiperRingDynamic'); if(kr) kr.remove();
  markBeltActive(null);
  document.getElementById('diagramNote').textContent = '거리 비율은 실제 AU 기준 축척 (행성 크기는 보기 쉽게 과장됨) · 아래 버튼을 누르면 해당 행성으로 확대';
}

function selectPlanet(i){
  selectedIdx = i;
  if(oortMode){ buildSystem(); buildButtons(); }
  document.querySelectorAll('#explorePlanets .planet-btn').forEach((x,idx)=>x.classList.toggle('active',idx===i));
  document.querySelectorAll('.planet-dot').forEach((x,idx)=>x.classList.toggle('selected',idx===i));
  showExplore(getBodies()[i]);
  zoomTo(i);
}

// 배속 컨트롤
const speedOptions = [{l:'⏸ 정지',v:0},{l:'1일/초',v:1},{l:'1주/초',v:7},{l:'1달/초',v:30},{l:'1년/초',v:365},{l:'10년/초',v:3650}];
const speedBar = document.getElementById('speedBar');
speedOptions.forEach(o=>{
  const b=document.createElement('button');
  b.textContent=o.l; b.className=o.v===1?'active':'';
  b.onclick=()=>{ speedDaysPerSec=o.v; document.querySelectorAll('.speedbar button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); };
  speedBar.appendChild(b);
});

let lastT=null;
function animate(ts){
  if(lastT==null) lastT=ts;
  const dt=(ts-lastT)/1000; lastT=ts;
  simDays += dt*speedDaysPerSec;
  if(document.getElementById('explore').classList.contains('active')) updatePositions();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

function showExplore(p){
  document.getElementById('exploreCard').innerHTML = `
    <div class="datagrid">
      <div><div class="label">질량</div><div class="value">${fmt(p.mass/1e24)} × 10²⁴ kg</div></div>
      <div><div class="label">반지름</div><div class="value">${fmt(p.radius/1000,0)} km</div></div>
      <div><div class="label">태양 평균거리</div><div class="value">${fmt(p.dist,3)} AU</div></div>
      <div><div class="label">공전주기</div><div class="value">${fmt(p.periodDays,1)} 일</div></div>
      <div><div class="label">자전주기</div><div class="value">${p.rot!=null?fmt(p.rot,1)+' 시간':'—'}</div></div>
      <div><div class="label">평균 표면온도</div><div class="value">${p.temp!=null?p.temp+' °C':'—'}</div></div>
      <div><div class="label">표면중력</div><div class="value">${fmt(p.g)} m/s²</div></div>
      <div><div class="label">탈출속도</div><div class="value">${fmt(p.ve/1000)} km/s</div></div>
      ${p.vOrbit!=null?`<div><div class="label">공전속도</div><div class="value">${fmt(p.vOrbit/1000)} km/s</div></div>`:''}
    </div>`;
}
function buildBeltButtons(){
  const wrap=document.getElementById('beltButtons');
  wrap.innerHTML='';
  belts.forEach(bl=>{
    const b=document.createElement('button');
    b.className='belt-btn'; b.id='belt-'+bl.key;
    b.textContent=bl.icon+' '+bl.name;
    b.onclick=()=>selectBelt(bl.key);
    wrap.appendChild(b);
  });
}
function markBeltActive(key){
  document.querySelectorAll('.belt-btn').forEach(b=>b.classList.toggle('active', b.id==='belt-'+key));
  if(key) document.querySelectorAll('#explorePlanets .planet-btn').forEach(b=>b.classList.remove('active'));
}

function selectBelt(key){
  if(key==='oort'){ enterOortMode(); markBeltActive('oort'); return; }
  if(oortMode) buildSystem(); // 오르트 모드였다면 행성들을 먼저 복원
  zoomToBelt(key);
  markBeltActive(key);
}

function zoomToBelt(key){
  const bl = belts.find(b=>b.key===key);
  const svgEl=document.getElementById('sysSvg'); if(!svgEl||!bl) return;
  const innerPx=bl.innerAU*currentScale, outerPx=bl.outerAU*currentScale;
  const r = outerPx*1.35;
  svgEl.setAttribute('viewBox', `${CX-r} ${CY-r} ${r*2} ${r*2}`);
  applyZoomSizing(r*2);
  let kr=document.getElementById('kuiperRingDynamic');
  if(key==='kuiper'){
    if(!kr){
      kr=document.createElementNS('http://www.w3.org/2000/svg','circle');
      kr.setAttribute('class','kuiper-ring'); kr.id='kuiperRingDynamic';
      svgEl.insertBefore(kr, svgEl.firstChild.nextSibling);
    }
    kr.setAttribute('cx',CX); kr.setAttribute('cy',CY);
    kr.setAttribute('r',(bl.innerAU+bl.outerAU)/2*currentScale);
    kr.setAttribute('stroke-width',(bl.outerAU-bl.innerAU)*currentScale);
  } else if(kr){ kr.remove(); }
  document.getElementById('exploreCard').innerHTML = `
    <div class="datagrid">
      <div><div class="label">영역</div><div class="value">${bl.name}</div></div>
      <div><div class="label">안쪽 경계</div><div class="value">${fmt(bl.innerAU,2)} AU</div></div>
      <div><div class="label">바깥쪽 경계</div><div class="value">${fmt(bl.outerAU,2)} AU</div></div>
    </div>`;
}

// 오르트 구름: 행성 탐색과 '같은 실제 AU 축척(currentScale)'을 그대로 확장해서 그림.
// 해왕성 궤도 안쪽은 이 축척에서 사실상 한 점이라 하나로 합쳐 표시하되, 점 크기만 보기 쉽게 과장.
function enterOortMode(){
  oortMode = true;
  const ob = belts.find(b=>b.key==='oort');
  const outerPx = ob.outerAU*currentScale, innerPx = ob.innerAU*currentScale;
  const vb = outerPx*1.08;
  // 화면상 1px에 해당하는 user 단위 — 실제 렌더링된 폭을 재서 계산 (모바일 등 좁은 화면 대응)
  const dispW = (document.getElementById('systemDiagram').clientWidth) || 380;
  const pxToUser = (vb*2)/dispW;
  const strokeW = 1*pxToUser;
  // 중심점은 원래 해왕성 궤도(30AU)만큼 작아야 하지만(이 축척에서는 사실상 0px) 완전히 안 보이면
  // 곤란하므로 최소한만 과장 — 오르트 구름 안쪽 경계선보다 뚜렷이 작게 유지
  const dotR = 2*pxToUser;
  let svg = `<svg id="sysSvg" viewBox="${CX-vb} ${CY-vb} ${vb*2} ${vb*2}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<circle class="oort-shell" cx="${CX}" cy="${CY}" r="${outerPx}"/>`;
  svg += `<circle class="oort-inner-line" cx="${CX}" cy="${CY}" r="${innerPx}" style="stroke-width:${strokeW}px"/>`;
  svg += `<circle id="sunCircle" cx="${CX}" cy="${CY}" r="${dotR}" fill="#ffcf6e"/>`;
  svg += `</svg>`;
  // SVG 내부 글자는 확대 비율에 따라 크기가 같이 깨지므로, 라벨은 캡션과 똑같은 일반 HTML 텍스트로 겹쳐 표시
  document.getElementById('systemDiagram').innerHTML = `
    <div style="position:relative">
      ${svg}
      <div class="oort-overlay-label" style="top:4%">오르트 구름 (2,000~100,000 AU)</div>
      <div class="oort-overlay-label" style="top:52%">🪐 태양계 전체 (해왕성 궤도까지)</div>
    </div>`;
  document.getElementById('diagramNote').textContent = '거리 비율은 행성 탐색과 동일한 실제 AU 축척 — 오르트 구름까지 그대로 확장 (중심점 크기만 보기 쉽게 과장)';
  document.getElementById('exploreCard').innerHTML = `
    <div class="datagrid">
      <div><div class="label">영역</div><div class="value">오르트 구름</div></div>
      <div><div class="label">안쪽 경계</div><div class="value">약 ${fmt(ob.innerAU,0)} AU</div></div>
      <div><div class="label">바깥쪽 경계</div><div class="value">약 ${fmt(ob.outerAU,0)} AU</div></div>
      <div><div class="label">해왕성 거리 대비</div><div class="value">약 ${fmt(ob.outerAU/30.07,0)}배</div></div>
    </div>
    <p class="muted">지금 보이는 전체 화면이 실제 비율 그대로예요 — 태양계(해왕성 궤도까지)는 이 거대한 오르트 구름 앞에서 중심의 점 하나에 불과해요.</p>`;
}

buildButtons();
buildBeltButtons();
buildSystem();
showExplore(planets[2]);

// 2. compare
const varOptions = [
  {k:'mass',l:'질량 (kg)'},{k:'radius',l:'반지름 (m)'},{k:'dist',l:'태양거리 (AU)'},
  {k:'periodDays',l:'공전주기 (일)'},{k:'rot',l:'자전주기 (시간)'},{k:'temp',l:'표면온도 (°C)'},
  {k:'g',l:'표면중력 (m/s²)'},{k:'ve',l:'탈출속도 (m/s)'}
];
['xVar','yVar'].forEach((id,idx)=>{
  const sel=document.getElementById(id);
  varOptions.forEach(o=>{const op=document.createElement('option');op.value=o.k;op.textContent=o.l;sel.appendChild(op)});
  sel.value = idx===0?'dist':'periodDays';
  sel.onchange=drawCompare;
});
function drawCompare(){
  const xk=document.getElementById('xVar').value, yk=document.getElementById('yVar').value;
  Plotly.newPlot('compareChart',[{
    x:planets.map(p=>p[xk]), y:planets.map(p=>p[yk]), text:planets.map(p=>p.name),
    mode:'markers+text', textposition:'top center',
    marker:{size:12,color:'#6ea8ff'}, type:'scatter'
  }],{
    paper_bgcolor:'transparent', plot_bgcolor:'transparent', font:{color:'#e8ecff'},
    xaxis:{title:varOptions.find(o=>o.k===xk).l, gridcolor:'#2a3358'},
    yaxis:{title:varOptions.find(o=>o.k===yk).l, gridcolor:'#2a3358'},
    margin:{t:20}
  },{responsive:true,displayModeBar:false});
}

// 3. calc
const calcSel=document.getElementById('calcPlanet');
planets.forEach((p,i)=>{const op=document.createElement('option');op.value=i;op.textContent=p.name;calcSel.appendChild(op)});
calcSel.value=2; calcSel.onchange=drawCalc;
function drawCalc(){
  const p=planets[calcSel.value];
  document.getElementById('calcResult').innerHTML=`
    <div class="result-line"><span>입력값</span><span>M = ${p.mass.toExponential(3)} kg, R = ${p.radius.toExponential(3)} m</span></div>
    <div class="result-line"><span>표면중력 g</span><span>${fmt(p.g)} m/s²</span></div>
    <div class="result-line"><span>탈출속도 v_e</span><span>${fmt(p.ve/1000)} km/s</span></div>
    <p class="muted">G = 6.674×10⁻¹¹ N·m²/kg² 사용</p>`;
}
drawCalc();

// 4. kepler
function drawKepler(){
  const a3=planets.map(p=>Math.pow(p.dist,3));
  const t2=planets.map(p=>Math.pow(p.periodDays/365.25,2));
  Plotly.newPlot('keplerChart',[{
    x:a3, y:t2, text:planets.map(p=>p.name), mode:'markers+text', textposition:'top center',
    marker:{size:12,color:'#ffb86e'}, type:'scatter'
  },{x:[0,Math.max(...a3)],y:[0,Math.max(...a3)],mode:'lines',line:{dash:'dot',color:'#8b93b8'},name:'T²=a³'}],{
    paper_bgcolor:'transparent', plot_bgcolor:'transparent', font:{color:'#e8ecff'}, showlegend:false,
    xaxis:{title:'a³ (AU³)', gridcolor:'#2a3358'}, yaxis:{title:'T² (년²)', gridcolor:'#2a3358'}, margin:{t:20}
  },{responsive:true,displayModeBar:false});
  let rows='<tr><th>행성</th><th>a (AU)</th><th>T (년)</th><th>T²/a³</th></tr>';
  planets.forEach(p=>{
    const T=p.periodDays/365.25;
    rows+=`<tr><td>${p.name}</td><td>${fmt(p.dist,3)}</td><td>${fmt(T,3)}</td><td>${fmt(T*T/Math.pow(p.dist,3),4)}</td></tr>`;
  });
  document.getElementById('keplerTable').innerHTML=rows;
}

// 5. simulator
function runSim(fromUser){
  const mE=parseFloat(document.getElementById('simMass').value)||0;
  const rE=parseFloat(document.getElementById('simRadius').value)||0;
  const aAU=parseFloat(document.getElementById('simDist').value)||0;
  const M=mE*EARTH_M, R=rE*EARTH_R, a=aAU*AU;
  const g=G*M/(R*R), ve=Math.sqrt(2*G*M/R);
  const Tyears=Math.sqrt(Math.pow(aAU,3));
  const vOrbit=Math.sqrt(GM_SUN/a);
  document.getElementById('simResult').innerHTML=`
    <div class="result-line"><span>표면중력</span><span>${fmt(g)} m/s² (지구의 ${fmt(g/9.81)}배)</span></div>
    <div class="result-line"><span>탈출속도</span><span>${fmt(ve/1000)} km/s</span></div>
    <div class="result-line"><span>공전주기</span><span>${fmt(Tyears,2)} 년 (T²=a³ 적용)</span></div>
    <div class="result-line"><span>공전속도</span><span>${fmt(vOrbit/1000)} km/s</span></div>
    <p class="muted">태양 질량 기준 GM☉=1.327×10²⁰ m³/s² 로 계산${fromUser?" · '행성 탐색' 탭 태양계 모형에 반영됨":''}</p>`;

  if(fromUser){
    virtualPlanet = {
      name:'가상행성', isVirtual:true, mass:M, radius:R, dist:aAU,
      periodDays:Tyears*365.25, L0:0, g:g, ve:ve, vOrbit:vOrbit, rot:null, temp:null
    };
    buildButtons();
    buildSystem();
    selectPlanet(getBodies().length-1);
  }
}
runSim(false);
