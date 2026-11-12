import * as THREE from "three";

/** Original procedural facade tile: dimensioned UVs repeat one window bay every 3 m / floor every 3.2 m. */
export function facadeTexture(){
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
  const c=canvas.getContext("2d")!;
  c.fillStyle="#ffffff";c.fillRect(0,0,128,128);
  c.fillStyle="#b6bab7";c.fillRect(29,24,70,74);
  const g=c.createLinearGradient(0,24,0,94);g.addColorStop(0,"#4b697b");g.addColorStop(.55,"#7d9da8");g.addColorStop(1,"#425761");
  c.fillStyle=g;c.fillRect(33,28,62,66);
  c.fillStyle="#c5ccca";c.fillRect(62,28,3,66);c.fillRect(33,60,62,3);
  c.fillStyle="#ecece7";c.fillRect(26,98,76,5);
  c.fillStyle="#d6d6d0";c.fillRect(0,126,128,2);
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return texture;
}
export function waterTexture(){
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const c=canvas.getContext("2d")!;
  c.fillStyle="#e4eeee";c.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=12){c.strokeStyle=y%24===0?"#b4d1d6":"#f4faf9";c.lineWidth=1;c.beginPath();for(let x=0;x<=256;x+=4){const yy=y+Math.sin(x*.05+y)*1.7;if(x)c.lineTo(x,yy);else c.moveTo(x,yy);}c.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
