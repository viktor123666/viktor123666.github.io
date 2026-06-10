// SCALELIST UNIVERSE — Aurora Borealis Cursor Trail
// Include this script on any page. Requires NO dependencies.
// Auto-creates canvas + cursor dot elements.
(function(){
  // Skip on touch-only devices
  if('ontouchstart' in window && !window.matchMedia('(pointer:fine)').matches) return;

  // Inject CSS
  const style=document.createElement('style');
  style.textContent=`
    canvas.su-aurora{position:fixed;top:0;left:0;width:100%;height:100%;z-index:9998;pointer-events:none}
    .su-cursor-dot{position:fixed;width:6px;height:6px;background:#c9a84c;border-radius:50%;z-index:9999;pointer-events:none;mix-blend-mode:screen;box-shadow:0 0 15px #c9a84c,0 0 30px rgba(201,168,76,.4);transform:translate(-3px,-3px)}
    body{cursor:none!important}
    a,button,input,select,textarea,[onclick]{cursor:none!important}
  `;
  document.head.appendChild(style);

  // Create elements
  const canvas=document.createElement('canvas');
  canvas.className='su-aurora';
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d');

  const dot=document.createElement('div');
  dot.className='su-cursor-dot';
  document.body.appendChild(dot);

  function resize(){canvas.width=innerWidth;canvas.height=innerHeight}
  resize();
  window.addEventListener('resize',resize);

  const TRAIL=18;
  const trail=[];
  for(let i=0;i<TRAIL;i++) trail.push({x:-100,y:-100});
  let mx=-100,my=-100;

  document.addEventListener('mousemove',e=>{
    mx=e.clientX;my=e.clientY;
    dot.style.left=mx+'px';dot.style.top=my+'px';
  });
  document.addEventListener('mouseleave',()=>{mx=-200;my=-200});

  const colors=[
    {r:201,g:168,b:76},
    {r:218,g:185,b:80},
    {r:180,g:190,b:70},
    {r:120,g:200,b:140},
    {r:60,g:190,b:170},
    {r:40,g:180,b:190},
    {r:30,g:160,b:180}
  ];

  function lerp(t){
    const idx=t*(colors.length-1),i=Math.floor(idx),f=idx-i;
    const a=colors[Math.min(i,colors.length-1)],b=colors[Math.min(i+1,colors.length-1)];
    return{r:Math.round(a.r+(b.r-a.r)*f),g:Math.round(a.g+(b.g-a.g)*f),b:Math.round(a.b+(b.b-a.b)*f)};
  }

  const layers=[
    {w:12,a:.18,off:0},
    {w:6,a:.35,off:0},
    {w:16,a:.06,off:3}
  ];

  function draw(){
    trail[0].x+=(mx-trail[0].x)*.35;
    trail[0].y+=(my-trail[0].y)*.35;
    for(let i=1;i<TRAIL;i++){
      trail[i].x+=(trail[i-1].x-trail[i].x)*.3;
      trail[i].y+=(trail[i-1].y-trail[i].y)*.3;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(mx<-50){requestAnimationFrame(draw);return}

    layers.forEach(L=>{
      for(let s=0;s<TRAIL-2;s++){
        const t=s/(TRAIL-1),fade=Math.pow(1-t,1.5),c=lerp(t),alpha=L.a*fade;
        if(alpha<.005)continue;
        const p0=trail[s],p1=trail[s+1],p2=trail[s+2];
        ctx.beginPath();
        ctx.moveTo(p0.x+L.off,p0.y+L.off);
        ctx.quadraticCurveTo(p1.x+L.off,p1.y+L.off,(p1.x+p2.x)/2+L.off,(p1.y+p2.y)/2+L.off);
        ctx.strokeStyle=`rgba(${c.r},${c.g},${c.b},${alpha})`;
        ctx.lineWidth=L.w*(1-t*.6);
        ctx.lineCap='round';ctx.lineJoin='round';
        ctx.stroke();
      }
    });

    const h=trail[0];
    const g=ctx.createRadialGradient(h.x,h.y,0,h.x,h.y,22);
    g.addColorStop(0,'rgba(201,168,76,0.3)');
    g.addColorStop(.4,'rgba(160,200,140,0.12)');
    g.addColorStop(1,'rgba(40,180,190,0)');
    ctx.beginPath();ctx.arc(h.x,h.y,22,0,Math.PI*2);
    ctx.fillStyle=g;ctx.fill();

    requestAnimationFrame(draw);
  }
  draw();
})();
