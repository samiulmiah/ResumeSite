(function(){
  const canvas=document.getElementById('siteBackgroundCanvas');
  const panel=document.getElementById('backgroundGenerator');
  if(!canvas||!panel)return;

  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  const addButton=panel.querySelector('[data-bg-add]');
  const removeButton=panel.querySelector('[data-bg-remove]');
  const shuffleButton=panel.querySelector('[data-bg-shuffle]');
  const opacityInput=panel.querySelector('[data-bg-opacity]');
  const speedInput=panel.querySelector('[data-bg-speed]');
  const countLabel=panel.querySelector('[data-bg-count]');
  const collapseButton=panel.querySelector('#bgGeneratorCollapse');
  const sideNav=document.querySelector('.scroll-side-nav');
  const panelParent=panel.parentNode,panelNext=panel.nextSibling;
  collapseButton?.setAttribute('aria-label','Minimize background generator');

  let width=0,height=0,dpr=1;
  let waves=[];
  let running=true;
  let lastDraw=0;
  let baseHue=202;
  const anchorHues=[18,28,156,184,202,218,266,300,326,344];
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frameInterval=1000/30;

  function rand(min,max){return min+Math.random()*(max-min)}
  function wrapHue(h){return ((h%360)+360)%360}

  /* One coherent palette per generation: mostly near relatives, with a restrained complement. */
  function familyColor(index){
    const relatives=[0,8,-10,16,-18,25,-27,5];
    const complements=[180,170,190,175,185];
    const useComplement=index>1 && index%5===4;
    const hue=wrapHue(baseHue+(useComplement?complements[index%complements.length]:relatives[index%relatives.length]));
    const saturation=72+(index%3)*4;
    const lightness=64+(index%2)*5;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,1.1);
    width=window.innerWidth;
    height=window.innerHeight;
    canvas.width=Math.max(1,Math.floor(width*dpr));
    canvas.height=Math.max(1,Math.floor(height*dpr));
    canvas.style.width=width+'px';
    canvas.style.height=height+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function makeWave(index){
    return{
      amplitude:rand(18,48),
      spatial:rand(.005,.010),
      vertical:rand(.0028,.0062),
      speed:rand(.00034,.00064),
      phase:rand(0,Math.PI*2),
      color:familyColor(index)
    };
  }

  function recolor(){waves.forEach((w,i)=>w.color=familyColor(i))}
  function resetWaves(count=4){
    baseHue=anchorHues[Math.floor(Math.random()*anchorHues.length)];
    waves=Array.from({length:count},(_,i)=>makeWave(i));
    updateCount();
  }
  function updateCount(){if(countLabel)countLabel.textContent=String(waves.length)}
  function addWave(){if(waves.length>=8)return;waves.push(makeWave(waves.length));recolor();updateCount()}
  function removeWave(){if(waves.length<=1)return;waves.pop();recolor();updateCount()}

  function lineOffset(baseX,y,time,speedScale){
    let offset=0;
    for(let i=0;i<waves.length;i++){
      const w=waves[i];
      const motion=reduced?0:time*w.speed*speedScale;
      const phase=baseX*w.spatial-motion+y*w.vertical+w.phase;
      /* Broad tide + slower secondary swell: fewer, thicker lines carry the shape. */
      offset += Math.sin(phase)*w.amplitude;
      offset += Math.sin(phase*.43+w.phase*.8)*(w.amplitude*.28);
    }
    return offset/Math.sqrt(Math.max(1,waves.length));
  }

  function draw(time){
    ctx.clearRect(0,0,width,height);
    const presence=(+opacityInput.value/100);
    const speedScale=(+speedInput.value/100);

    /* Lower density and bolder strokes, reminiscent of thick contour bands. */
    const spacing=Math.max(46,Math.min(68,width/24));
    const margin=110;
    const lineCount=Math.ceil((width+margin*2)/spacing);
    const yStep=14;

    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.lineCap='round';
    ctx.lineJoin='round';

    for(let i=0;i<lineCount;i++){
      const baseX=-margin+i*spacing;
      ctx.beginPath();
      let first=true;
      for(let y=-60;y<=height+60;y+=yStep){
        const x=baseX+lineOffset(baseX,y,time,speedScale);
        if(first){ctx.moveTo(x,y);first=false}else ctx.lineTo(x,y);
      }

      const color=waves.length?waves[i%waves.length].color:familyColor(0);

      /* Dark under-stroke makes each colored line read like a graphic contour band. */
      ctx.strokeStyle='rgba(4,6,8,.78)';
      ctx.globalAlpha=.72;
      ctx.lineWidth=5.4+presence*2.2;
      ctx.stroke();

      ctx.strokeStyle=color;
      ctx.globalAlpha=.22+presence*.52;
      ctx.lineWidth=2.8+presence*1.55;
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now){
    requestAnimationFrame(frame);
    if(!running)return;
    if(now-lastDraw<frameInterval)return;
    lastDraw=now;
    draw(now);
  }

  addButton&&addButton.addEventListener('click',addWave);
  removeButton&&removeButton.addEventListener('click',removeWave);
  shuffleButton&&shuffleButton.addEventListener('click',()=>resetWaves(4));
  collapseButton&&collapseButton.addEventListener('click',()=>{
    const collapsed=panel.classList.toggle('is-collapsed');
    collapseButton.textContent=collapsed?'+':'−';
    collapseButton.setAttribute('aria-expanded',String(!collapsed));
    collapseButton.setAttribute('aria-label',collapsed?'Expand background generator':'Minimize background generator');
    if(collapsed&&sideNav)sideNav.prepend(panel);
    else panelParent.insertBefore(panel,panelNext);
  });

  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{running=!document.hidden;if(running)lastDraw=0});

  resize();
  resetWaves(4);
  draw(0);
  requestAnimationFrame(frame);
})();
