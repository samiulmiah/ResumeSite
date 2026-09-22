(function () {
  'use strict';
  const api=window.skeletonAPI;
  if(!api || !window.numeric) return;
  const {scene,camera,controls,rig,canvas,stage,boneRecords}=api;
  const colors=['#174cf5','#137ef5','#00bafa','#12dfdc','#2ad68c','#63da40','#b8e02f','#f5e52c','#ffb528','#ff7326','#ef3427','#b90d26'];
  const storageKey='san-theater-damage-v1'; // Retain existing saved damage across the label change.
  const store={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}},write(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}};
  const state={open:false,phase:'WELCOME',selected:null,supports:[],load:null,step:0,result:null,unit:null,force:0,scale:10,speed:42,progress:0,fracturing:false,busy:false,broken:[],missing:new Set(),wireframe:false,reviewFrame:null};
  const phaseNames={WELCOME:'Welcome',SELECT:'Select bone',CONSTRAINTS:'Place constraints',READY:'Ready to load',RUNNING:'FEA running',FAILURE:'Approaching failure',CRACK:'Crack propagation',RESULTS:'Post-fracture results'};
  const phaseCopy={WELCOME:'Explore how a supported bone carries load, reaches failure, and separates over time.',SELECT:'Select an available bone to begin a new experiment. Previous fractures remain in the skeleton.',CONSTRAINTS:'Pin two highlighted support regions, then choose a force point between them.',READY:'The support and load positions are set. Each increment adds one tenth of this model\'s calculated failure load.',RUNNING:'Solving elastic bending equilibrium for the current force and support configuration.',FAILURE:'The peak bending stress is nearing the demonstration threshold. The tenth increment initiates a fracture.',CRACK:'A procedural crack grows from the high-stress region. The elastic field is held at initiation; the crack path is an artistic interpretation.',RESULTS:'The cross-section has separated. The two pieces settle slightly apart and float for inspection. Returning to the skeleton removes the fragments while preserving the damage.'};
  const theater=document.createElement('section');
  theater.id='biomechanicsTheater';theater.className='bt';theater.hidden=true;theater.setAttribute('aria-label','Fracture visualizer');
  theater.innerHTML=`
    <header class="bt-head"><div><p class="bt-kicker">Fracture visualizer / Biomechanics</p><h2 data-specimen>Articulated skeleton</h2><p class="bt-subtitle" data-viewlabel>16 available specimens</p></div>
      <div class="bt-head-actions"><button class="bt-icon" data-reset aria-label="Reset Skeleton"><i data-lucide="rotate-ccw"></i></button><button class="bt-icon" data-exit aria-label="Exit visualizer"><i data-lucide="minimize-2"></i></button></div></header>
    <div class="bt-workspace"><div class="bt-viewport">
      <div class="bt-legend" hidden><span>HIGH</span><div class="bt-legend-strip">${colors.map(c=>`<span style="background:${c}"></span>`).join('')}</div><span>LOW</span><span>0 MPa</span><span data-legendmax></span></div>
      <div class="bt-state" role="status" aria-live="polite" data-status>Welcome</div>
      <div class="bt-view-tools"><button class="bt-icon" data-home aria-label="Front view"><i data-lucide="scan"></i></button><button class="bt-icon" data-back aria-label="Return to skeleton"><i data-lucide="accessibility"></i></button></div>
    </div><aside class="bt-panel" aria-label="Analysis controls">
      <div class="bt-group"><span class="bt-label">01 / specimen</span><h3 data-paneltitle>Select a bone</h3><div class="bt-bones">${Object.entries(BeamFEA.materials).map(([id,b])=>`<button type="button" data-bone="${id}" aria-pressed="false">${b.name}<small data-count="${id}"></small></button>`).join('')}</div><select aria-label="Specimen location" data-location></select></div>
      <div class="bt-group" data-setup><span class="bt-label">02 / boundary conditions</span><div class="bt-supports">${[.1,.225,.775,.9].map((v,i)=>`<button type="button" data-support="${v}" aria-pressed="false">${i<2?'Proximal':'Distal'} ${i%2+1}</button>`).join('')}</div><label class="bt-switch">Load point <output data-loadpoint>Not set</output></label><input type="range" min="25" max="75" value="50" step="2.5" aria-label="Force application point" data-loadpoint-input><button class="bt-secondary" data-place>Place force at center</button><p class="bt-small" data-setup-note>Two supports required.</p></div>
      <div class="bt-group" data-loading><span class="bt-label">03 / applied load</span><ol class="bt-loadline">${Array.from({length:10},(_,i)=>`<li>${String(i+1).padStart(2,'0')}</li>`).join('')}</ol><div class="bt-failure-label">10 / FAILURE</div><button class="bt-primary" data-increment>Apply load +1</button><button class="bt-secondary" data-reconfigure>Reconfigure experiment</button></div>
      <div class="bt-group"><span class="bt-label">04 / propagation</span><div class="bt-range-labels"><span>VERY SLOW<br>ARTISTIC</span><span>INSTANT<br>ARTISTIC</span></div><div class="bt-speed-track"><input type="range" min="0" max="100" value="42" aria-label="Propagation playback speed" data-speed><button class="bt-research-marker" data-research title="Use dry-bovine-rib research reference">RESEARCH<br>1370 m/s</button></div><p class="bt-small" data-timing>Research reference / time dilated</p><details class="bt-propagation-help"><summary>Propagation help</summary><p>Propagation is the movement of a crack through the bone after it begins. The 3-point bone bending paper tracks that movement frame by frame, rather than treating failure as instantaneous.</p><p>The study reports 1370 +/- 200 m/s in dry bovine ribs. The research marker uses 1370 m/s as a reference and slows playback so the crack can be seen. It is not a universal speed for every bone.</p><p>Very slow gives more time to inspect crack growth. Instant compresses the same sequence into a brief transition. These artistic settings change playback duration, not the calculated failure load or the fracture path.</p></details></div>
      <div class="bt-group"><span class="bt-label">05 / field display</span><label class="bt-switch">FE mesh + surface <input type="checkbox" data-wire></label><label class="bt-switch">Deformation scale <output data-scale-label>10x</output></label><input type="range" min="1" max="30" value="10" aria-label="Deformation display scale" data-scale><button class="bt-secondary" data-export>Export results</button></div>
      <div class="bt-group bt-group-wide"><span class="bt-label">Damage log</span><p class="bt-small" data-ledger>No fractures recorded.</p></div>
    </aside></div>
    <div class="bt-bottom"><div><p class="bt-kicker" data-chapter>BODY / BONE</p><h3 data-info-title>From structure to separation.</h3><p class="bt-context" data-context></p>
      <div class="bt-fracture-frames" aria-label="Fracture progression"><button data-frame="0" aria-pressed="false">t0 / before<code>  ( . )  </code></button><button data-frame="1" aria-pressed="false">t1 / initiation<code> (( . )) </code></button><button data-frame="2" aria-pressed="false">t2 / growing<code>((( ./ )))</code></button><button data-frame="3" aria-pressed="false">t3 / through<code>(( ./\\ ))</code></button><button data-frame="4" aria-pressed="false">t4 / separated<code> ( /  \\ )</code></button></div>
      <details class="bt-step-help" open><summary>Step information &amp; help</summary><h4 data-help-title></h4><p data-help-copy></p></details>
    </div><div><span class="bt-label">Live analysis / SI units</span><div class="bt-metrics">
      <div class="bt-metric"><span>Applied force</span><output data-force>0 N</output></div><div class="bt-metric"><span>Peak bending stress</span><output data-stress>0 MPa</output></div><div class="bt-metric"><span>Actual displacement</span><output data-displacement>0 mm</output></div><div class="bt-metric"><span>Elastic strain energy</span><output data-energy>0 J</output></div><div class="bt-metric"><span>Support reactions</span><output data-reactions>--</output></div><div class="bt-metric"><span>Fracture playback</span><output data-playback>--</output></div>
    </div><details style="margin-top:20px"><summary>Model assumptions &amp; sources</summary><p>40 linear Euler-Bernoulli beam elements, two simple supports, one transverse nodal force. Idealized hollow circular sections and homogeneous elastic material. Rib curvature is visual; the solver uses a straight equivalent beam. End flares are visual only.</p><p data-material></p><p>Failure force is calibrated so peak outer-fiber bending stress reaches the assumed strength at step 10. Display deformation is exaggerated independently. This is an educational reduced model, not a specimen-specific or clinical prediction. Post-initiation stresses are frozen, not recomputed. Crack paths and the floating separation display are simplified.</p><p><a href="https://teachbooks.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html" target="_blank" rel="noopener">Beam formulation / TU Delft</a><br><a href="https://bionumbers.hms.harvard.edu/files/Mechanical%20properties%20of%20human%20cortical%20bone.pdf" target="_blank" rel="noopener">Cortical material reference</a><br><a href="https://arxiv.org/abs/1108.0390" target="_blank" rel="noopener">Human rib tensile properties</a><br><a href="assets/docs/Three_Point_Bone_Bending_Paper.pdf" target="_blank" rel="noopener">open 3-point bone bending paper</a></p><p>The dry-bovine-rib speed is a research reference. It is not a universal speed for ribs, femurs, tibias, or humeri. The displayed path time is a reference conversion, not a prediction.</p></details></div></div>`;
  document.querySelector('#work').before(theater);
  const q=s=>theater.querySelector(s), qa=s=>[...theater.querySelectorAll(s)];
  const originalParent=stage.parentNode, originalNext=stage.nextSibling, viewport=q('.bt-viewport');
  const analysis=new THREE.Group(), persistent=new THREE.Group();scene.add(analysis,persistent);
  let boneMesh=null, wire=null, beamMesh=null, pins=[], arrow=null, crack=null, crackPoints=[], analysisFragments=[], originalCamera=null, transition=null, floatElapsed=0, hovered=null;
  const rigPosition=rig.position.clone(),rigScale=rig.scale.clone();
  rig.traverse(o=>{if(o.isMesh)o.material=o.material.clone()});
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),pickStart={x:0,y:0};
  function icons(){if(window.lucide)lucide.createIcons()}
  icons();
  function setPhase(phase){state.phase=phase;updateUI()}
  function available(r){return !state.missing.has(r.id)}
  function visibleInHierarchy(obj){for(let o=obj;o;o=o.parent)if(!o.visible)return false;return true}
  function fadeRig(faded){
    highlight(null);rig.position.copy(rigPosition);rig.scale.copy(rigScale);
    if(faded){rig.position.x-=1.15;rig.position.z-=3.5;rig.scale.multiplyScalar(.72)}
    rig.traverse(o=>{if(o.isMesh){o.material.transparent=faded;o.material.opacity=faded?.035:1;o.material.depthWrite=!faded;o.castShadow=!faded}});rig.updateMatrixWorld(true);
  }
  function highlight(record){
    if(hovered===record)return;
    if(hovered)hovered.meshes.forEach(m=>{m.material.emissive.setHex(0);m.material.emissiveIntensity=1});
    hovered=record;canvas.style.cursor=record?'pointer':'';
    if(record)record.meshes.forEach(m=>{m.material.emissive.setHex(0x327cdb);m.material.emissiveIntensity=.45});
    canvas.dataset.hoveredBone=record?.id||'';
  }
  function view(target,position){transition={from:camera.position.clone(),to:new THREE.Vector3(...position),start:performance.now(),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...target)};}
  function front(){
    const aspect=Math.max(.25,stage.clientWidth/Math.max(1,stage.clientHeight));
    const distance=state.selected?Math.max(6.8,2.15/(Math.tan(Math.PI/9)*aspect)):Math.max(7.6,2.05/(Math.tan(Math.PI/9)*aspect));
    view(state.selected?[0,.12,0]:[0,-.1,0],state.selected?[0,distance*.16,distance]:[.25,distance*.05,distance]);
  }
  function release(group){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of [o.material].flat())m.dispose()}});group.clear()}
  function clearAnalysis(){
    release(analysis);boneMesh=null;wire=null;beamMesh=null;pins=[];arrow=null;crack=null;analysisFragments=[];crackPoints=[];state.reviewFrame=null;floatElapsed=0;
  }
  function open(){
    state.open=true;api.root.dataset.theaterActive='true';document.body.classList.add('theater-open');
    originalCamera={position:camera.position.clone(),target:controls.target.clone(),min:controls.minDistance,max:controls.maxDistance};
    theater.hidden=false;viewport.prepend(stage);api.root.hidden=true;api.root.style.display='none';
    controls.minDistance=3.2;controls.maxDistance=22;controls.enabled=true;state.phase='WELCOME';front();updateUI();api.resize();
    theater.scrollIntoView({behavior:'smooth',block:'start'});q('[data-bone="femur"]').focus({preventScroll:true});
  }
  function close(){
    if(state.fracturing) return;
    back(false);state.open=false;api.root.dataset.theaterActive='false';document.body.classList.remove('theater-open');
    originalParent.insertBefore(stage,originalNext);api.root.hidden=false;api.root.style.display='';theater.hidden=true;transition=null;
    if(originalCamera){camera.position.copy(originalCamera.position);controls.target.copy(originalCamera.target);controls.minDistance=originalCamera.min;controls.maxDistance=originalCamera.max}api.resize();
    document.querySelector('#enterTheater').focus({preventScroll:true});api.root.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function back(move=true){
    if(state.fracturing||state.busy)return;
    clearAnalysis();state.selected=null;state.result=null;state.unit=null;state.step=0;state.force=0;state.progress=0;state.supports=[];state.load=null;
    persistent.visible=true;fadeRig(false);setPhase('SELECT');if(move)front();
  }
  function select(record){
    if(!record||!available(record)||state.fracturing||state.busy)return;
    clearAnalysis();state.selected=record;state.step=0;state.supports=[];state.load=null;state.result=null;state.unit=null;state.force=0;state.progress=0;
    persistent.visible=false;fadeRig(true);buildAnalysis();setPhase('CONSTRAINTS');front();
  }
  function shapeAt(t){
    const type=state.selected.type;
    const curve=type==='rib'?.48*Math.sin(Math.PI*t):.025*Math.sin(Math.PI*t*2);
    const displacement=state.result?state.result.sample(t).displacement:0;
    const length=BeamFEA.materials[type].length;
    return new THREE.Vector3((t-.5)*3.4,.12+curve+displacement*3.4/length*state.scale,0);
  }
  function radiusAt(t){return state.selected.type==='rib'?.085:.115+.095*(Math.exp(-((t/.12)**2))+Math.exp(-(((1-t)/.12)**2)))}
  function cutAt(angle){return fractureT()+.016*Math.sin(angle*3)+.008*Math.sin(angle*7+.6)}
  function fractureT(){return state.result?THREE.MathUtils.clamp((state.result.peakElement+.5)/state.result.elements,.27,.73):.5}
  // Both fragment boundaries use the same jagged ring, so the visible crack becomes a real cut.
  function geometry(start=0,end=1,cutStart=false,cutEnd=false){
    const rings=64,sides=16,positions=[],indices=[],vertexColors=[],ts=[],angles=[];
    const params=BeamFEA.materials[state.selected.type];
    for(let layer=0;layer<2;layer++)for(let i=0;i<=rings;i++)for(let j=0;j<sides;j++){
      const angle=j/sides*Math.PI*2;
      const a=cutStart?cutAt(angle):start,b=cutEnd?cutAt(angle):end,t=a+(b-a)*i/rings;
      const center=shapeAt(t),r=radiusAt(t)*(layer?.55:1);
      positions.push(center.x,center.y+Math.sin(angle)*r,Math.cos(angle)*r);ts.push(t);angles.push(angle);
      const moment=state.result?state.result.sample(t).moment:0;
      const stress=Math.abs(moment*params.outer*Math.sin(angle)/(state.result?.I||1));
      const band=Math.min(11,Math.floor(stress/params.strength*12));
      const c=new THREE.Color(colors[band]).convertSRGBToLinear();vertexColors.push(c.r,c.g,c.b);
    }
    const layerSize=(rings+1)*sides;
    for(let layer=0;layer<2;layer++)for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
      const a=layer*layerSize+i*sides+j,b=layer*layerSize+i*sides+(j+1)%sides,c=a+sides,d=b+sides;
      if(!layer)indices.push(a,c,b,b,c,d);else indices.push(a,b,c,b,d,c);
    }
    for(const i of [0,rings])for(let j=0;j<sides;j++){
      const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+layerSize,d=b+layerSize;
      if(i===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(vertexColors,3));g.setIndex(indices);g.computeVertexNormals();g.userData={ts,angles};return g;
  }
  function fieldMaterial(){return new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})}
  function buildAnalysis(){
    boneMesh=new THREE.Mesh(geometry(),fieldMaterial());boneMesh.castShadow=true;analysis.add(boneMesh);
    wire=new THREE.Mesh(boneMesh.geometry,new THREE.MeshBasicMaterial({color:0xd4eee8,wireframe:true,transparent:true,opacity:.19}));wire.visible=state.wireframe;analysis.add(wire);
    const points=Array.from({length:41},(_,i)=>shapeAt(i/40));
    beamMesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffffff,depthTest:false}));
    beamMesh.add(new THREE.Points(beamMesh.geometry,new THREE.PointsMaterial({color:0xffffff,size:3,sizeAttenuation:false,depthTest:false})));beamMesh.visible=state.wireframe;analysis.add(beamMesh);
    for(const t of [.1,.225,.775,.9]){
      const pin=new THREE.Mesh(new THREE.OctahedronGeometry(.105,0),new THREE.MeshBasicMaterial({color:0x778590,transparent:true,opacity:.65}));pin.userData.support=t;analysis.add(pin);pins.push(pin);
    }
    updateGeometry();
  }
  function updateGeometry(){
    if(!boneMesh||state.phase==='RESULTS')return;
    const previous=boneMesh.geometry;boneMesh.geometry=geometry();wire.geometry=boneMesh.geometry;previous.dispose();
    beamMesh.geometry.dispose();beamMesh.geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:41},(_,i)=>shapeAt(i/40)));beamMesh.children[0].geometry=beamMesh.geometry;
    pins.forEach(p=>{const pinned=state.supports.includes(p.userData.support);p.position.copy(shapeAt(p.userData.support));p.position.y-=radiusAt(p.userData.support)+.17;p.material.color.set(pinned?0xff794d:0x778590);p.material.opacity=pinned?1:.65;p.scale.setScalar(pinned?1.15:1);p.visible=state.step<10});
    if(arrow){analysis.remove(arrow);arrow.line.material.dispose();arrow.cone.material.dispose();arrow=null}
    if(state.load!==null&&state.step<10){const p=shapeAt(state.load);p.y+=.9;arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),p,.73,0xf5d988,.17,.105);analysis.add(arrow)}
  }
  function pinSupport(t){
    if(!state.selected||state.step>0||state.busy||state.fracturing)return;
    if(state.supports.includes(t))state.supports=state.supports.filter(v=>v!==t);
    else {state.supports=state.supports.filter(v=>(v<.5)!==(t<.5));state.supports.push(t);state.supports.sort((a,b)=>a-b)}
    state.load=null;state.result=null;state.unit=null;setPhase('CONSTRAINTS');updateGeometry();
  }
  function placeLoad(t){
    if(!state.selected||state.supports.length!==2||state.step>0||state.busy)return;
    const [a,b]=state.supports;t=Math.round(t*40)/40;
    if(t<=a||t>=b){q('[data-setup-note]').textContent='Choose a point strictly between the supports.';return}
    state.load=t;const params=BeamFEA.materials[state.selected.type];
    state.unit=BeamFEA.solve({...params,supports:state.supports,load:t,force:1});
    state.force=params.strength/state.unit.peakStress;state.result=BeamFEA.solve({...params,supports:state.supports,load:t,force:0});
    setPhase('READY');updateGeometry();
  }
  function increment(){
    if(!state.selected||!state.unit||state.step>=10||state.busy||state.fracturing)return;
    state.busy=true;setPhase('RUNNING');
    window.setTimeout(()=>{
      try{
        state.step++;const params=BeamFEA.materials[state.selected.type];
        state.result=BeamFEA.solve({...params,supports:state.supports,load:state.load,force:state.force*state.step/10});
        updateGeometry();state.busy=false;
        if(state.step===10)startFracture();else setPhase(state.step>=8?'FAILURE':'READY');
      }catch(error){state.busy=false;state.phase='READY';updateUI();q('[data-context]').textContent='Analysis error: '+error.message;console.error(error)}
    },100);
  }
  function crackDuration(){return state.speed===100?.18:8*Math.pow(.07,state.speed/100)}
  function createCrack(){
    crackPoints=[];
    for(let i=0;i<=128;i++){
      const angle=-Math.PI/2+i/128*Math.PI*2,t=cutAt(angle),p=shapeAt(t),r=radiusAt(t)*1.018;
      p.y+=Math.sin(angle)*r;p.z=Math.cos(angle)*r;crackPoints.push(p);
    }
    const g=new THREE.BufferGeometry().setFromPoints(crackPoints);g.setDrawRange(0,0);
    crack=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xfff2c0,depthTest:false}));crack.renderOrder=5;analysis.add(crack);
  }
  let fractureElapsed=0;
  function startFracture(){state.fracturing=true;state.progress=0;fractureElapsed=0;createCrack();setPhase('CRACK')}
  function floatingPiece(mesh,direction){
    mesh.geometry.computeBoundingBox();const center=mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    mesh.geometry.translate(-center.x,-center.y,-center.z);
    const group=new THREE.Group();group.position.copy(center);group.userData={origin:center,direction};group.add(mesh);analysis.add(group);return group;
  }
  function finishFracture(){
    state.fracturing=false;state.progress=1;
    const left=new THREE.Mesh(geometry(0,fractureT(),false,true),fieldMaterial()),right=new THREE.Mesh(geometry(fractureT(),1,true,false),fieldMaterial());
    analysis.add(left,right);left.castShadow=true;right.castShadow=true;
    boneMesh.visible=false;wire.visible=false;beamMesh.visible=false;crack.visible=false;pins.forEach(p=>p.visible=false);
    analysis.remove(left,right);analysisFragments=[floatingPiece(left,-1),floatingPiece(right,1)];floatElapsed=0;
    fadeRig(false);recordDamage(state.selected,fractureT());fadeRig(true);setPhase('RESULTS');
  }
  function reviewFrame(frame){
    if(state.phase!=='RESULTS')return;
    state.reviewFrame=frame===4||state.reviewFrame===frame?null:frame;
    const reviewing=state.reviewFrame!==null;
    boneMesh.visible=reviewing;wire.visible=reviewing&&state.wireframe;beamMesh.visible=false;
    analysisFragments.forEach(part=>part.visible=!reviewing);
    crack.visible=reviewing&&state.reviewFrame>0;
    if(crack.visible)crack.geometry.setDrawRange(0,Math.ceil([0,.10,.5,1][state.reviewFrame]*crackPoints.length));
    updateProgress();updateHelp();
  }
  const remnants=[];
  function recordDamage(record,cut,save=true){
    if(state.missing.has(record.id))return;
    const proximal=AttachedFragments.create(record,cut);record.parent.add(proximal);
    remnants.push(proximal);
    record.meshes.forEach(m=>m.visible=false);state.missing.add(record.id);
    if(record.dependent){
      record.dependent.visible=false;
      for(const candidate of boneRecords){for(let p=candidate.parent;p;p=p.parent)if(p===record.dependent)state.missing.add(candidate.id)}
    }
    state.broken.push({id:record.id,cut});if(save)store.write(storageKey,state.broken);
  }
  function reset(){
    state.fracturing=false;state.busy=false;clearAnalysis();
    release(persistent);
    for(const m of remnants){if(m.parent)m.parent.remove(m);release(m)}remnants.length=0;
    boneRecords.forEach(r=>{r.meshes.forEach(m=>m.visible=true);if(r.dependent)r.dependent.visible=true});
    state.broken=[];state.missing.clear();store.write(storageKey,[]);api.resetPose();back();
  }
  function updateUI(){
    const selected=state.selected,params=selected?BeamFEA.materials[selected.type]:null,locked=state.busy||state.fracturing;
    theater.setAttribute('aria-busy',String(state.busy));
    q('[data-status]').textContent=phaseNames[state.phase];q('[data-info-title]').textContent=selected?params.name+' / '+phaseNames[state.phase].toLowerCase():'From structure to separation.';
    q('[data-context]').textContent=phaseCopy[state.phase];
    q('[data-chapter]').textContent=state.phase==='RESULTS'?'FRACTURE / SEPARATION':state.phase==='CRACK'?'FAILURE / CRACK PROPAGATION':selected?'CONSTRAINTS + FORCE / FEA':'BODY / BONE';
    q('[data-specimen]').textContent=selected?params.name+' / '+selected.side+(selected.type==='rib'?' '+(Number(selected.id.split('-')[2])+1):''):'Articulated skeleton';
    q('[data-viewlabel]').textContent=selected?'40 beam elements / '+(params.length*1000).toFixed(0)+' mm / idealized section':boneRecords.filter(available).length+' available specimens';
    q('[data-paneltitle]').textContent=selected?params.name:'Select a bone';
    qa('[data-bone]').forEach(b=>{const count=boneRecords.filter(r=>r.type===b.dataset.bone&&available(r)).length;b.disabled=locked||!count;b.setAttribute('aria-pressed',String(selected?.type===b.dataset.bone));b.querySelector('small').textContent=count+' available'});
    const candidates=boneRecords.filter(r=>(!selected||r.type===selected.type)&&available(r));
    q('[data-location]').innerHTML=(!selected?'<option value="" disabled selected>Choose a specimen</option>':'')+candidates.map(r=>`<option value="${r.id}" ${r===selected?'selected':''}>${r.side} ${r.type}${r.type==='rib'?' '+(Number(r.id.split('-')[2])+1):''}</option>`).join('');
    q('[data-location]').disabled=locked||!candidates.length;
    qa('[data-support]').forEach(b=>{b.disabled=!selected||state.step>0||locked;b.setAttribute('aria-pressed',String(state.supports.includes(Number(b.dataset.support))))});
    q('[data-loadpoint-input]').disabled=!selected||state.supports.length!==2||state.step>0||locked;
    q('[data-place]').disabled=q('[data-loadpoint-input]').disabled;
    q('[data-loadpoint]').textContent=state.load===null?'Not set':Math.round(state.load*100)+'% span';
    if(state.load!==null)q('[data-loadpoint-input]').value=state.load*100;
    q('[data-setup-note]').textContent=state.supports.length<2?'Select one proximal and one distal support.':state.load===null?'Select the force point on the bone or set its span position.':'Supports and load point fixed for this run.';
    q('[data-increment]').disabled=!state.unit||state.step>=10||locked;
    q('[data-increment]').textContent=state.busy?'Solving...':state.step===10?'Failure reached':`Apply load +1 (${state.step}/10)`;
    q('[data-reconfigure]').disabled=!selected||locked||state.step===10;
    q('[data-speed]').disabled=locked||state.step===10;q('[data-research]').disabled=locked||state.step===10;
    q('[data-scale]').disabled=!selected||locked||state.step===10;q('[data-wire]').disabled=!selected||state.step===10;
    q('[data-export]').disabled=!state.result;q('[data-back]').disabled=locked||!selected;q('[data-exit]').disabled=locked;
    q('[data-reset]').disabled=state.busy;
    qa('.bt-loadline li').forEach((li,i)=>li.classList.toggle('done',i<state.step));
    q('.bt-legend').hidden=!selected;q('[data-legendmax]').textContent=params?(params.strength/1e6)+' MPa':'';
    const result=state.result;
    q('[data-force]').textContent=(result?.force||0).toFixed(1)+' N';q('[data-stress]').textContent=((result?.peakStress||0)/1e6).toFixed(2)+' MPa';
    q('[data-displacement]').textContent=((result?.maxDisplacement||0)*1000).toFixed(3)+' mm';q('[data-energy]').textContent=(result?.energy||0).toFixed(4)+' J';
    q('[data-reactions]').textContent=result?result.reactions.map(r=>r.toFixed(1)).join(' / ')+' N':'--';
    q('[data-ledger]').textContent=state.broken.length?state.broken.length+' fractured; '+state.missing.size+' specimens unavailable. Damage is saved on this device.':'No fractures recorded.';
    q('[data-material]').textContent=params?`Assumed ${params.name.toLowerCase()} section: length ${params.length*1000} mm, outer radius ${params.outer*1000} mm, inner radius ${params.inner*1000} mm; E = ${params.E/1e9} GPa; strength = ${params.strength/1e6} MPa. Dimensions are illustrative, not measured anatomy.`:'';
    qa('[data-frame]').forEach(button=>button.disabled=state.phase!=='RESULTS');
    updateTiming();updateProgress();updateHelp();
  }
  function pathLength(){let length=0;for(let i=1;i<crackPoints.length;i++)length+=crackPoints[i].distanceTo(crackPoints[i-1]);return state.selected?length*BeamFEA.materials[state.selected.type].length/3.4:0}
  function updateTiming(){
    const duration=crackDuration(),physical=pathLength()/1370;
    q('[data-timing]').textContent=state.speed===42?'1370 +/- 200 m/s / dry bovine rib reference. '+duration.toFixed(2)+' s playback.':duration.toFixed(2)+' s artistic playback / no physical speed assigned.';
    q('[data-playback]').textContent=state.speed===42&&physical>0?(physical*1e6).toFixed(1)+' us / '+Math.round(duration/physical).toLocaleString()+'x slower':duration.toFixed(2)+' s';
  }
  function updateProgress(){
    const frame=state.phase==='RESULTS'?(state.reviewFrame??4):state.fracturing?Math.min(3,1+Math.floor(state.progress*3)):0;
    qa('[data-frame]').forEach((el,i)=>{el.classList.toggle('active',i===frame);el.setAttribute('aria-pressed',String(i===frame));});
    if(state.phase==='RESULTS')q('[data-status]').textContent=state.reviewFrame===null?'Separated / floating':'Review / t'+state.reviewFrame+' / '+['before','initiation','growing','through'][state.reviewFrame];
    if(state.fracturing)q('[data-status]').textContent='Crack propagation / '+Math.round(state.progress*100)+'%';
  }
  function updateHelp(){
    let title='Choose a bone',copy='Hover over an available bone for a blue highlight, then select it. You can also choose a specimen from the controls. Bones already lost to a fracture remain unavailable until Reset Skeleton.';
    if(state.selected){
      if(state.phase==='RESULTS'){
        title=state.reviewFrame===null?'Inspect the separation':'Reviewing t'+state.reviewFrame;
        copy='Select t0 to see the intact bone before cracking, t1 for initiation, t2 for a growing crack, or t3 for the completed crack line. Select the same stage again, or t4, to return to the separated floating pieces. These views do not undo damage. Returning to the skeleton removes the floating pieces; Reset Skeleton rebuilds the model.';
      }else if(state.fracturing){title='The crack is travelling';copy='The crack starts near the peak bending-stress region and advances around the section. The propagation setting controls how long this takes to watch. The numerical field stays at the failure load. When separation finishes, t0-t4 become available for review.';
      }else if(state.supports.length<2){title='Set the supports';copy='Select one proximal point and one distal point. Pinned points turn orange; unused points stay gray. The supports resist transverse movement while allowing rotation. A wider support span generally bends more at the same applied force.';
      }else if(state.load===null){title='Choose where the force acts';copy='Both supports are pinned. Select a point directly on the bone between them, move the load-point slider, or use Place force at center. A load midway between the supports shares the reactions evenly; moving it toward one support increases that support\'s reaction and moves the peak bending region. The model recalculates the failure force for your selection.';
      }else{title=state.step>=8?'Approaching separation':'Apply the load';copy='The arrow marks your force point. Each click adds one tenth of the calculated failure force for this arrangement. Colors show increasing bending stress; actual displacement appears in the results, independently of the display scale. Step 10 starts the crack. Reconfigure experiment changes the supports or load point and restarts this intact specimen.';}
    }
    q('[data-help-title]').textContent=title;q('[data-help-copy]').textContent=copy;
  }
  function exportResults(){
    if(!state.result)return;
    const report={specimen:state.selected.id,model:'40-element Euler-Bernoulli equivalent straight hollow beam',material:BeamFEA.materials[state.selected.type],supports:state.supports,loadPosition:state.load,step:state.step,forceN:state.result.force,peakStressPa:state.result.peakStress,displacementM:state.result.displacements,reactionsN:state.result.reactions,energyJ:state.result.energy,freeDOFResidual:state.result.residual,displayScale:state.scale,fracturePath:'Procedural; stress-biased, not an FE prediction',speedReference:state.speed===42?'1370 +/- 200 m/s, dry bovine ribs only':'Artistic',damage:state.broken};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fracture-'+state.selected.id+'-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelector('#enterTheater').addEventListener('click',open);
  q('[data-exit]').addEventListener('click',close);q('[data-back]').addEventListener('click',()=>back());q('[data-home]').addEventListener('click',front);q('[data-reset]').addEventListener('click',reset);
  qa('[data-bone]').forEach(b=>b.addEventListener('click',()=>select(boneRecords.find(r=>r.type===b.dataset.bone&&available(r)))));
  q('[data-location]').addEventListener('change',e=>select(boneRecords.find(r=>r.id===e.target.value)));
  qa('[data-support]').forEach(b=>b.addEventListener('click',()=>pinSupport(Number(b.dataset.support))));
  q('[data-place]').addEventListener('click',()=>placeLoad(.5));q('[data-loadpoint-input]').addEventListener('input',e=>placeLoad(Number(e.target.value)/100));
  q('[data-increment]').addEventListener('click',increment);q('[data-reconfigure]').addEventListener('click',()=>select(state.selected));
  q('[data-speed]').addEventListener('input',e=>{state.speed=Number(e.target.value);updateTiming()});q('[data-research]').addEventListener('click',()=>{state.speed=42;q('[data-speed]').value=42;updateTiming()});
  q('[data-scale]').addEventListener('input',e=>{state.scale=Number(e.target.value);q('[data-scale-label]').textContent=state.scale+'x';updateGeometry()});
  q('[data-wire]').addEventListener('change',e=>{state.wireframe=e.target.checked;if(wire)wire.visible=state.wireframe;if(beamMesh)beamMesh.visible=state.wireframe});
  q('[data-export]').addEventListener('click',exportResults);
  qa('[data-frame]').forEach(button=>button.addEventListener('click',()=>reviewFrame(Number(button.dataset.frame))));
  function pickBone(e){
    const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
    const hit=ray.intersectObjects(boneRecords.filter(available).flatMap(r=>r.meshes)).find(h=>visibleInHierarchy(h.object));
    return hit?boneRecords.find(r=>r.id===hit.object.userData.boneId):null;
  }
  canvas.addEventListener('pointermove',e=>{if(state.open&&!state.selected&&!e.buttons)highlight(pickBone(e));else highlight(null)});
  canvas.addEventListener('pointerleave',()=>highlight(null));
  canvas.addEventListener('pointerdown',e=>{pickStart.x=e.clientX;pickStart.y=e.clientY});
  canvas.addEventListener('pointerup',e=>{
    if(!state.open||state.fracturing||state.busy||Math.hypot(e.clientX-pickStart.x,e.clientY-pickStart.y)>6)return;
    const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
    if(!state.selected){const hits=ray.intersectObjects(boneRecords.filter(available).flatMap(r=>r.meshes)).filter(h=>visibleInHierarchy(h.object));if(hits.length)select(boneRecords.find(r=>r.id===hits[0].object.userData.boneId));return}
    if(state.step>0)return;
    const supports=ray.intersectObjects(pins);if(supports.length){pinSupport(supports[0].object.userData.support);return}
    const hit=ray.intersectObject(boneMesh);if(hit.length)placeLoad((hit[0].point.x+1.7)/3.4);
  });
  let lastTime=0;
  let lastAspect=0;
  new ResizeObserver(()=>{const aspect=stage.clientWidth/Math.max(1,stage.clientHeight);if(state.open&&Math.abs(lastAspect-aspect)>.025){lastAspect=aspect;front()}}).observe(stage);
  api.tick=time=>{
    const delta=lastTime?Math.min((time-lastTime)/1000,.05):1/60;lastTime=time;
    if(transition){const u=Math.min(1,(performance.now()-transition.start)/650),s=u*u*(3-2*u);camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,s);if(u===1)transition=null}
    if(analysisFragments.length){
      floatElapsed+=delta;const u=Math.min(1,floatElapsed/.85),ease=1-(1-u)**3;
      analysisFragments.forEach(part=>{const {origin,direction}=part.userData;part.position.copy(origin);part.position.x+=direction*.15*ease;part.position.y-=(direction<0?.17:.23)*ease;part.rotation.z=direction*.055*ease;});
    }
    if(state.fracturing){fractureElapsed+=delta;state.progress=Math.min(1,fractureElapsed/crackDuration());crack.geometry.setDrawRange(0,Math.max(2,Math.floor(state.progress*crackPoints.length)));updateProgress();if(state.progress>=1)finishFracture()}
  };
  // Restore previous damage through the same geometry/hierarchy path as an interactive fracture.
  const saved=store.read(storageKey,[]);
  if(Array.isArray(saved))for(const item of saved){const record=boneRecords.find(r=>r.id===item.id);if(record&&available(record)){state.selected=record;state.result=null;const cut=typeof item.cut==='number'?THREE.MathUtils.clamp(item.cut,.27,.73):.5;state.result={peakElement:cut*40-.5,elements:40,sample:()=>({displacement:0,moment:0}),I:1};recordDamage(record,cut,false)}}
  state.selected=null;state.result=null;fadeRig(false);updateUI();
  window.biomechanicsTheater={state,open,close,select,reset,back,api,analysis,persistent,get crackPoints(){return crackPoints},get fragments(){return analysisFragments},pinSupport,placeLoad,increment,reviewFrame};
})();
