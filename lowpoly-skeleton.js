(function(){
  const roots=document.querySelectorAll('[data-lowpoly-skeleton]');
  if(!roots.length)return;
  function boot(root){
    if(!window.THREE||!THREE.OrbitControls){ root.innerHTML='<div style="padding:24px">3D library failed to load. Check your internet connection.</div>'; return; }
    const canvas=root.querySelector('.skeleton-canvas');
    const stage=root.querySelector('.skeleton-stage');
    const toggles=[...root.querySelectorAll('.skeleton-menu-toggle')];
    const hint=root.querySelector('.skeleton-hint');
    const modeX=root.querySelector('[data-mode="x"]');
    const modeY=root.querySelector('[data-mode="y"]');
    const jointLabel=root.querySelector('[data-joint]');
    const modeLabel=root.querySelector('[data-mode-label]');
    const xLabel=root.querySelector('[data-xrot]');
    const yLabel=root.querySelector('[data-yrot]');
    const yaw=root.querySelector('[data-yaw]');
    const pitch=root.querySelector('[data-pitch]');
    const zoom=root.querySelector('[data-zoom]');
    const resetJoint=root.querySelector('[data-reset-joint]');
    const resetAll=root.querySelector('[data-reset-all]');
    let axisMode='x',selectedJoint=null,selectedMarker=null,dragMode=null,last={x:0,y:0};

    function setMenu(open){
      root.classList.toggle('menu-open',open);
      toggles.forEach(btn=>{
        if(btn.classList.contains('skeleton-menu-toggle-panel')) btn.textContent='Hide';
        else btn.textContent=open?'Hide':'Menu';
        btn.setAttribute('aria-expanded',open?'true':'false');
      });
      setTimeout(resize,260);
    }
    toggles.forEach(btn=>btn.addEventListener('click',()=>setMenu(!root.classList.contains('menu-open'))));
    if(hint){
      const dismissHint=()=>hint.classList.add('is-dismissed');
      hint.addEventListener('click',dismissHint);
      hint.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dismissHint();}});
    }
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=THREE.sRGBEncoding;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#15191f');scene.fog=new THREE.Fog('#111419',11,30);
    const camera=new THREE.PerspectiveCamera(40,1,.1,100);
    const controls=new THREE.OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.target.set(0,-.12,0);controls.minDistance=3.2;controls.maxDistance=13;
    scene.add(new THREE.HemisphereLight(0xcfe1ff,0x1a1d22,1.15));
    const key=new THREE.DirectionalLight(0xffffff,1.2);key.position.set(4,7,6);key.castShadow=true;scene.add(key);
    const rim=new THREE.DirectionalLight(0x84a7ff,.38);rim.position.set(-5,3,-4);scene.add(rim);

    const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshPhongMaterial({color:0x1a1e25,shininess:8}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.35;floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(24,38,0x5c6673,0x2f3742);grid.position.y=-2.34;scene.add(grid);

    const boneMat=new THREE.MeshStandardMaterial({color:0xd8d5cb,roughness:.72,metalness:.01,flatShading:true});
    const boneAlt=new THREE.MeshStandardMaterial({color:0xc8c3b8,roughness:.78,metalness:.01,flatShading:true});
    const darkMat=new THREE.MeshStandardMaterial({color:0x292b30,roughness:.95,flatShading:true});
    const jointMat=new THREE.MeshStandardMaterial({color:0xece8df,roughness:.55,flatShading:true});
    const selMat=new THREE.MeshStandardMaterial({color:0xff826b,emissive:0x4d1d17,roughness:.42,flatShading:true});

    const rig=new THREE.Group();rig.position.set(0,.08,0);scene.add(rig);const markers=[],ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
    function joint(name,parent,pos){const g=new THREE.Group();g.name=name;g.position.copy(pos);(parent||rig).add(g);const m=new THREE.Mesh(new THREE.IcosahedronGeometry(.085,1),jointMat.clone());m.userData.joint=g;m.castShadow=true;g.add(m);markers.push(m);return g}
    function bone(parent,child,r1,r2,mat=boneMat,sides=8){const v=child.position.clone(),L=v.length();const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,L,sides,1,false),mat);m.position.copy(v.clone().multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
    function polySphere(r,detail=1,mat=boneMat){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail),mat);m.castShadow=true;return m}
    const boneRecords=[];
    function capsuleBone(parent,child,r=.075,type=null,side=null){const shaft=bone(parent,child,r*.92,r,boneMat,7);const a=polySphere(r*1.3,1,boneAlt),b=polySphere(r*1.35,1,boneAlt);a.position.set(0,0,0);b.position.copy(child.position);parent.add(a);parent.add(b);if(type){const record={id:side+'-'+type,type,side,meshes:[shaft,a,b],dependent:child,parent,child,radius:r};record.meshes.forEach(m=>m.userData.boneId=record.id);boneRecords.push(record)}}

    const pelvis=joint('pelvis',null,new THREE.Vector3(0,0,0));
    const spineL=joint('spineLower',pelvis,new THREE.Vector3(0,.55,0));
    const spineU=joint('spineUpper',spineL,new THREE.Vector3(0,.58,0));
    const neck=joint('neck',spineU,new THREE.Vector3(0,.36,0));
    const head=joint('head',neck,new THREE.Vector3(0,.34,0));
    const lShoulder=joint('leftShoulder',spineU,new THREE.Vector3(-.52,.18,0));
    const lElbow=joint('leftElbow',lShoulder,new THREE.Vector3(-.60,-.54,.04));
    const lWrist=joint('leftWrist',lElbow,new THREE.Vector3(-.49,-.53,-.02));
    const lHand=joint('leftHand',lWrist,new THREE.Vector3(-.17,-.11,.05));
    const rShoulder=joint('rightShoulder',spineU,new THREE.Vector3(.52,.18,0));
    const rElbow=joint('rightElbow',rShoulder,new THREE.Vector3(.60,-.54,.04));
    const rWrist=joint('rightWrist',rElbow,new THREE.Vector3(.49,-.53,-.02));
    const rHand=joint('rightHand',rWrist,new THREE.Vector3(.17,-.11,.05));
    const lHip=joint('leftHip',pelvis,new THREE.Vector3(-.26,-.18,0));
    const lKnee=joint('leftKnee',lHip,new THREE.Vector3(0,-1.02,.03));
    const lAnkle=joint('leftAnkle',lKnee,new THREE.Vector3(.03,-.98,-.03));
    const lFoot=joint('leftFoot',lAnkle,new THREE.Vector3(.05,-.13,.34));
    const rHip=joint('rightHip',pelvis,new THREE.Vector3(.26,-.18,0));
    const rKnee=joint('rightKnee',rHip,new THREE.Vector3(0,-1.02,.03));
    const rAnkle=joint('rightAnkle',rKnee,new THREE.Vector3(-.03,-.98,-.03));
    const rFoot=joint('rightFoot',rAnkle,new THREE.Vector3(-.05,-.13,.34));
    const joints=[pelvis,spineL,spineU,neck,head,lShoulder,lElbow,lWrist,lHand,rShoulder,rElbow,rWrist,rHand,lHip,lKnee,lAnkle,lFoot,rHip,rKnee,rAnkle,rFoot];

    capsuleBone(pelvis,spineL,.10);capsuleBone(spineL,spineU,.105);capsuleBone(spineU,neck,.09);capsuleBone(neck,head,.07);
    capsuleBone(lShoulder,lElbow,.07,'humerus','left');capsuleBone(lElbow,lWrist,.055);capsuleBone(lWrist,lHand,.035);
    capsuleBone(rShoulder,rElbow,.07,'humerus','right');capsuleBone(rElbow,rWrist,.055);capsuleBone(rWrist,rHand,.035);
    capsuleBone(lHip,lKnee,.09,'femur','left');capsuleBone(lKnee,lAnkle,.07,'tibia','left');capsuleBone(lAnkle,lFoot,.045);
    capsuleBone(rHip,rKnee,.09,'femur','right');capsuleBone(rKnee,rAnkle,.07,'tibia','right');capsuleBone(rAnkle,rFoot,.045);

    // Low-poly skull: rounded faceted cranium + angular facial planes, sockets and open mandible.
    const skull=new THREE.Mesh(new THREE.DodecahedronGeometry(.30,0),boneMat);
    skull.scale.set(1.06,1.12,.98);skull.position.set(0,.20,-.015);head.add(skull);

    const brow=new THREE.Mesh(new THREE.BoxGeometry(.31,.075,.13),boneAlt);
    brow.position.set(0,.145,.155);brow.rotation.x=-.08;head.add(brow);

    const maxilla=new THREE.Mesh(new THREE.CylinderGeometry(.115,.165,.20,5,1,false),boneAlt);
    maxilla.rotation.x=Math.PI/2;maxilla.rotation.z=Math.PI/5;maxilla.position.set(0,.015,.155);head.add(maxilla);

    const cheekL=new THREE.Mesh(new THREE.BoxGeometry(.12,.085,.12),boneAlt);
    cheekL.position.set(-.145,.025,.145);cheekL.rotation.z=.42;cheekL.rotation.y=-.10;head.add(cheekL);
    const cheekR=cheekL.clone();cheekR.position.x=.145;cheekR.rotation.z=-.42;cheekR.rotation.y=.10;head.add(cheekR);

    function socket(x,y,z,sx,sy){const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.068,0),darkMat);m.scale.set(sx,sy,.48);m.position.set(x,y,z);head.add(m)}
    socket(-.098,.12,.218,1.22,.92);socket(.098,.12,.218,1.22,.92);

    const nose=new THREE.Mesh(new THREE.ConeGeometry(.045,.105,4),darkMat);
    nose.position.set(0,.025,.225);nose.rotation.x=Math.PI;head.add(nose);

    const jawL=new THREE.Mesh(new THREE.BoxGeometry(.075,.235,.095),boneAlt);
    jawL.position.set(-.115,-.135,.075);jawL.rotation.z=-.26;jawL.rotation.x=.06;head.add(jawL);
    const jawR=jawL.clone();jawR.position.x=.115;jawR.rotation.z=.26;head.add(jawR);
    const chin=new THREE.Mesh(new THREE.BoxGeometry(.19,.07,.10),boneAlt);
    chin.position.set(0,-.235,.09);head.add(chin);
    const jawBackL=new THREE.Mesh(new THREE.BoxGeometry(.065,.15,.09),boneAlt);jawBackL.position.set(-.155,-.075,.02);jawBackL.rotation.z=.10;head.add(jawBackL);
    const jawBackR=jawBackL.clone();jawBackR.position.x=.155;jawBackR.rotation.z=-.10;head.add(jawBackR);

    // Pelvis reworked to be more boxy / planar and less bulbous.
    const pelvisCore=new THREE.Mesh(new THREE.BoxGeometry(.38,.28,.24),boneAlt);pelvisCore.position.set(0,-.03,-.01);pelvis.add(pelvisCore);
    const hipL=new THREE.Mesh(new THREE.BoxGeometry(.28,.20,.22),boneAlt);hipL.position.set(-.25,-.03,.01);hipL.rotation.z=.18;pelvis.add(hipL);
    const hipR=hipL.clone();hipR.position.x=.25;hipR.rotation.z=-.18;pelvis.add(hipR);
    const iliacL=new THREE.Mesh(new THREE.BoxGeometry(.25,.14,.18),boneAlt);iliacL.position.set(-.20,.08,0);iliacL.rotation.z=-.25;pelvis.add(iliacL);
    const iliacR=iliacL.clone();iliacR.position.x=.20;iliacR.rotation.z=.25;pelvis.add(iliacR);
    const sacrum=new THREE.Mesh(new THREE.BoxGeometry(.15,.36,.16),boneAlt);sacrum.position.set(0,.04,-.02);sacrum.rotation.x=.10;pelvis.add(sacrum);

    // Clavicles and sternum.
    const clavL=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.52,6),boneAlt);clavL.rotation.z=Math.PI/2;clavL.position.set(-.24,.17,.045);spineU.add(clavL);
    const clavR=clavL.clone();clavR.position.x=.24;spineU.add(clavR);
    const sternum=new THREE.Mesh(new THREE.BoxGeometry(.11,.96,.11),boneAlt);sternum.position.set(0,-.16,.16);spineU.add(sternum);

    // Individually selectable curved ribs preserve the separated low-poly silhouette.
    let ribIndex=0;
    function ribPair(y,halfWidth,backZ,frontZ,drop){
      for(const side of ['left','right']){
        const sign=side==='left'?-1:1;
        const pts=[[.055,y,frontZ],[halfWidth*.65,y-drop*.4,frontZ+.12],[halfWidth,y-drop,-.02],[halfWidth*.7,y-drop,-.23],[.065,y+.03,-.15]].map(p=>new THREE.Vector3(p[0]*sign,p[1],p[2]));
        const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),14,.025,5,false),boneMat);
        const id=side+'-rib-'+ribIndex;mesh.userData.boneId=id;spineU.add(mesh);
        boneRecords.push({id,type:'rib',side,meshes:[mesh],parent:spineU,radius:.025});
      }
      ribIndex++;
      const bridge=new THREE.Mesh(new THREE.BoxGeometry(.12,.03,.07),boneAlt);bridge.position.set(0,y,frontZ-.01);spineU.add(bridge);
    }
    [
      {y:.12,w:.40,b:.00,f:.13,d:.02},
      {y:0,w:.45,b:-.01,f:.15,d:.04},
      {y:-.12,w:.49,b:-.02,f:.17,d:.07},
      {y:-.24,w:.50,b:-.03,f:.17,d:.09},
      {y:-.35,w:.46,b:-.04,f:.15,d:.10}
    ].forEach(r=>ribPair(r.y,r.w,r.b,r.f,r.d));
    for(let i=0;i<9;i++){const v=new THREE.Mesh(new THREE.CylinderGeometry(.10,.11,.075,6),boneAlt);v.position.set(0,-.47+i*.105,-.105);spineU.add(v)}

    function hand(j,dir){const palm=new THREE.Mesh(new THREE.BoxGeometry(.15,.065,.16),boneAlt);palm.position.set(.05*dir,-.02,.05);j.add(palm);for(let i=-2;i<=2;i++){const f=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.18,6),boneMat);f.rotation.z=Math.PI/2;f.position.set(.10*dir,-.045+i*.025,.06+i*.01);j.add(f)}}
    hand(lHand,-1);hand(rHand,1);
    function foot(j){const f=new THREE.Mesh(new THREE.BoxGeometry(.18,.075,.42),boneAlt);f.position.set(0,-.01,.16);f.rotation.x=-.07;j.add(f)}foot(lFoot);foot(rFoot);
    rig.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});

    function select(marker){if(selectedMarker)selectedMarker.material=jointMat.clone();selectedMarker=marker;selectedJoint=marker?marker.userData.joint:null;if(selectedMarker)selectedMarker.material=selMat.clone();readout()}
    function readout(){jointLabel.textContent=selectedJoint?selectedJoint.name:'none';modeLabel.textContent=axisMode==='x'?'X axis rotation':'Y axis rotation';xLabel.textContent=selectedJoint?THREE.MathUtils.radToDeg(selectedJoint.rotation.x).toFixed(0)+'°':'0°';yLabel.textContent=selectedJoint?THREE.MathUtils.radToDeg(selectedJoint.rotation.y).toFixed(0)+'°':'0°'}
    function setMode(m){axisMode=m;modeX.classList.toggle('active',m==='x');modeY.classList.toggle('active',m==='y');readout()}
    modeX.addEventListener('click',()=>setMode('x'));modeY.addEventListener('click',()=>setMode('y'));select(markers[0]);setMode('x');

    function pointer(e){const r=canvas.getBoundingClientRect();ptr.x=((e.clientX-r.left)/r.width)*2-1;ptr.y=-((e.clientY-r.top)/r.height)*2+1}
    canvas.addEventListener('pointerdown',e=>{if(root.dataset.theaterActive==='true')return;last={x:e.clientX,y:e.clientY};pointer(e);ray.setFromCamera(ptr,camera);const hits=ray.intersectObjects(markers,false);if(hits.length){select(hits[0].object);dragMode='joint';controls.enabled=false}else{dragMode='orbit';controls.enabled=true}});
    window.addEventListener('pointermove',e=>{if(dragMode!=='joint'||!selectedJoint)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};if(axisMode==='x')selectedJoint.rotation.x=THREE.MathUtils.clamp(selectedJoint.rotation.x-dy*.01,THREE.MathUtils.degToRad(-120),THREE.MathUtils.degToRad(120));else selectedJoint.rotation.y=THREE.MathUtils.clamp(selectedJoint.rotation.y+dx*.01,THREE.MathUtils.degToRad(-140),THREE.MathUtils.degToRad(140));readout()});
    window.addEventListener('pointerup',()=>{if(dragMode==='joint')controls.enabled=true;dragMode=null});

    function camFromUI(){const ya=THREE.MathUtils.degToRad(+yaw.value),pi=THREE.MathUtils.degToRad(+pitch.value),r=+zoom.value,t=new THREE.Vector3(0,-.12,0);camera.position.set(t.x+r*Math.cos(pi)*Math.sin(ya),t.y+r*Math.sin(pi),t.z+r*Math.cos(pi)*Math.cos(ya));controls.target.copy(t);controls.update()}
    yaw.addEventListener('input',camFromUI);pitch.addEventListener('input',camFromUI);zoom.addEventListener('input',camFromUI);
    controls.addEventListener('change',()=>{const o=camera.position.clone().sub(controls.target),r=o.length();yaw.value=THREE.MathUtils.radToDeg(Math.atan2(o.x,o.z)).toFixed(0);pitch.value=THREE.MathUtils.radToDeg(Math.asin(o.y/r)).toFixed(0);zoom.value=r.toFixed(1)});
    resetJoint.addEventListener('click',()=>{if(selectedJoint){selectedJoint.rotation.set(0,0,0);readout()}});
    resetAll.addEventListener('click',()=>{joints.forEach(j=>j.rotation.set(0,0,0));yaw.value=18;pitch.value=-3;zoom.value=6.3;camFromUI();readout()});
    function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}window.addEventListener('resize',resize);resize();camFromUI();
    const api={root,stage,canvas,renderer,scene,camera,controls,rig,boneRecords,joints,resize,resetPose:()=>{joints.forEach(j=>j.rotation.set(0,0,0));readout()},tick:null};
    window.skeletonAPI=api;
    new ResizeObserver(resize).observe(stage);
    (function animate(time){requestAnimationFrame(animate);if(api.tick)api.tick(time||0);controls.update();renderer.render(scene,camera)})();
  }
  roots.forEach(boot);
})();
