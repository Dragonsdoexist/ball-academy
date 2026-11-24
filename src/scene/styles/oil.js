import * as THREE from 'three';
import { randomSequence, texture, matte } from './tools.js';

// Each curved dab is laid across the form, then split into a few bristle ridges.
function paint(ctx, width, height, ground = false) {
  const random = randomSequence(ground ? 921 : 9157);
  const palette = ground
    ? [[33,27,36],[58,40,45],[88,54,54],[129,77,55],[160,103,65]]
    : [[53,41,63],[99,48,55],[157,66,48],[200,104,57],[233,158,88],[250,207,140],[255,229,178]];
  ctx.fillStyle = ground ? '#533f41' : '#ad6748';
  ctx.fillRect(0,0,width,height);
  for (const [count, scale] of [[3600,1.8],[8100,.9],[5700,.43]]) {
    for (let i=0; i < count; i++) {
      const u=random(), v=random(), longitude=u*Math.PI*2, latitude=v*Math.PI;
      const nx=-Math.cos(longitude)*Math.sin(latitude), ny=Math.cos(latitude), nz=Math.sin(longitude)*Math.sin(latitude);
      const value = ground
        ? .38 + .18*Math.sin(u*5+v*6) + .13*Math.cos(u*8-v*3)
        : .42 + .59*(-.76*nx+.46*ny+.33*nz) + .04*Math.sin(17*nx+9*ny);
      const a = Math.max(0,Math.min(palette.length-1.01, (value + (random()-.5)*.20)*(palette.length-1)));
      const lower = Math.floor(a), mix=a-lower;
      const rgb=palette[lower].map((c,j) => Math.round(c*(1-mix)+palette[lower+1][j]*mix));
      const hue = 'rgb('+rgb.join(',')+')';
      const x=u*width, y=v*height;
      const length=(9+random()*21)*scale, thickness=(3+random()*6)*scale;
      const tilt=ground ? -.25+.48*Math.sin(v*5+u*3) : .19 + .7*nx - .38*ny + .16*Math.sin(v*16+u*8);
      const lengthX=Math.cos(tilt)*length, lengthY=Math.sin(tilt)*length;
      ctx.lineCap='round';
      for (const wrap of x+lengthX>=width ? [0,-width] : [0]) {
        const start=x+wrap;
        ctx.strokeStyle=hue;
        ctx.lineWidth=thickness;
        ctx.beginPath();ctx.moveTo(start,y);ctx.quadraticCurveTo(start+lengthX*.45,y+lengthY*.22-1,start+lengthX,y+lengthY);ctx.stroke();
        ctx.strokeStyle=i%3===0?'rgba(255,230,173,.23)':'rgba(66,26,41,.16)';
        ctx.lineWidth=Math.max(.55,thickness*.12);
        ctx.beginPath();ctx.moveTo(start+1,y-thickness*.25);ctx.quadraticCurveTo(start+lengthX*.48,y+lengthY*.22-1.4,start+lengthX*.9,y+lengthY*.89-thickness*.25);ctx.stroke();
      }
    }
  }
  // Linen is visible in the gaps between strokes.
  ctx.fillStyle='rgba(45,30,36,.06)';
  for (let x=0;x<width;x+=3) ctx.fillRect(x,0,.65,height);
}

export function oil() {
  const scene = new THREE.Group();
  const map = texture(1024,512,paint);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1,96,56),matte('#ffffff',{map}));
  const groundMap = texture(640,384,(ctx,w,h)=>paint(ctx,w,h,true));
  scene.userData.backdrop = groundMap;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30),
    matte('#a16f70',{map:groundMap,side:THREE.DoubleSide}));
  floor.rotation.x = -Math.PI/2;
  floor.position.y=-1.04;
  const shadowMap = texture(256, 160, (ctx, w, h) => {
    const shadowRng = randomSequence(312);
    ctx.scale(w, h);
    const pool = ctx.createRadialGradient(.43, .5, .045, .49, .5, .49);
    pool.addColorStop(0, 'rgba(29,18,29,.92)');
    pool.addColorStop(.42, 'rgba(46,24,36,.70)');
    pool.addColorStop(.72, 'rgba(56,28,39,.33)');
    pool.addColorStop(1, 'rgba(50,25,36,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, 1, 1);
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 360; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(116,66,63,.17)' : 'rgba(61,35,51,.26)';
      ctx.fillRect(shadowRng(), shadowRng(), .025 + shadowRng() * .10, .007);
    }
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.1,1.8),
    matte('#ffffff', { map: shadowMap, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(.39,-1.025,-.09);
  scene.add(floor,shadow,sphere);
  return scene;
}
