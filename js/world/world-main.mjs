import * as THREE from 'three';
import { SPAWN, SOLID_OBJECTS, LANDMARKS, advance, closestInteraction } from './world-core.mjs';

const container = document.getElementById('world-scene');
const loading = document.getElementById('loading');
const objective = document.getElementById('objective');
const nearName = document.getElementById('near-name');
const proximity = document.getElementById('proximity');
const dialog = document.getElementById('dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogBody = document.getElementById('dialog-body');
const dialogActions = document.getElementById('dialog-actions');
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dd8dd);
scene.fog = new THREE.FogExp2(0x9dd8dd, 0.009);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
container.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd6f9ff, 0x466b56, 1.35));
const sun = new THREE.DirectionalLight(0xffedca, 1.8);
sun.position.set(-18, 38, 20); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
scene.add(sun);
const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: .86 });
const green = material(0x78ad79), grass2 = material(0x689c6f), water = material(0x45bac3);
const stones = [material(0xf6ccad),material(0xc6b4a3),material(0xf3dbb0)];
const shadowMaterial = material(0x3d6c55);
function box(parent, x,y,z, w,h,d, mat, cast=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function ball(parent,x,y,z,r,mat){const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function cylinder(parent,x,y,z,top,bottom,h,mat){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,8),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
const terrain=new THREE.Mesh(new THREE.PlaneGeometry(102,102),green);terrain.rotation.x=-Math.PI/2;terrain.receiveShadow=true;scene.add(terrain);
// Stylized river running along the west side of the historical center.
box(scene,-44,.015,0,6,.03,102,water,false);
const riverEdge=material(0x9ed9af);
box(scene,-40.5,.025,0,.8,.05,102,riverEdge,false);
box(scene,-47.5,.025,0,.7,.05,102,riverEdge,false);
// Main promenade and diagonal footpaths, walkable in this prototype.
const path=material(0xc6b8a2);
box(scene,-18,.03,0,8,.06,96,path,false);
box(scene,8,.035,-18,65,.07,7,path,false);
box(scene,6,.04,18,70,.08,6,path,false);
box(scene,13,.045,0,6,.09,35,path,false);
for(let n=-43;n<46;n+=6){box(scene,-18,.073,n,7,.012,.08,material(0xf5edd2),false);}
// Buildings occupy exactly the collision footprints defined in world-core.
const facades=[material(0xe6aa80),material(0xf6d6a6),material(0xaac1bb),material(0xd9ba99),material(0xedc09d)];
const roofs=[material(0xa65f56),material(0x8a5550),material(0xa46f60)];
SOLID_OBJECTS.forEach((s,i)=>{
  const x=(s.minX+s.maxX)/2,z=(s.minZ+s.maxZ)/2;
  const w=s.maxX-s.minX,d=s.maxZ-s.minZ,h=4+(i*7%6);
  box(scene,x,h/2,z,w,h,d,facades[i%facades.length]);
  const roof=box(scene,x,h+.65,z,w+.9,1.3,d+.9,roofs[i%roofs.length]);
  roof.rotation.y=(i%2)*.02;
  for(let j=-1;j<=1;j++){
    box(scene,x+j*w/4,2.1,z+d/2+.028,.85,1.15,.07,material(0x456b78),false);
  }
});
// Palm trees and park foliage.
const trunk=material(0x967451),leaf=material(0x397965),leaf2=material(0x59a77c);
for(let i=0;i<45;i++){
  const x=-38+(i*37%82),z=-45+(i*29%88);
  if(SOLID_OBJECTS.some(s=>x>s.minX-3&&x<s.maxX+3&&z>s.minZ-3&&z<s.maxZ+3))continue;
  if(Math.abs(x+18)<7 || Math.abs(z+18)<5 || Math.abs(z-18)<5)continue;
  cylinder(scene,x,1.8,z,.13,.22,3.6,trunk);
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5; ball(scene,x+Math.sin(a)*1.1,3.9,z+Math.cos(a)*1.1,.9,k%2?leaf:leaf2);}
}
// Small landmarks and signage: a place-inspired prototype, not a geospatial reconstruction.
function sign(text,x,z){const c=document.createElement('canvas');c.width=512;c.height=120;const cx=c.getContext('2d');cx.fillStyle='#0b3838';cx.fillRect(0,0,512,120);cx.strokeStyle='#87ffbf';cx.lineWidth=7;cx.strokeRect(4,4,504,112);cx.fillStyle='#ecfff7';cx.font='bold 34px system-ui';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(text,256,60);const tx=new THREE.CanvasTexture(c);const p=new THREE.Mesh(new THREE.PlaneGeometry(7.5,1.76),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide}));p.position.set(x,4,z);scene.add(p);return p;}
sign('BULEVAR DEL RÍO',-19,-16);
sign('PLAZOLETA',14,-15);
const bench=material(0x9f6555);
for(const [x,z] of [[-28,-16],[-8,-16],[1,18]]) {box(scene,x,.5,z,3,.25,.7,bench);box(scene,x,.8,z-.3,3,.9,.15,bench);}

function makePet(species='Salamander'){
 const root=new THREE.Group();const isWater=species==='Neptuno',isEarth=species==='Tierrudo';
 const bodyMat=material(isWater?0x34bdde:isEarth?0x80b454:0xf78b48);
 const lighter=material(isWater?0x84eaf2:isEarth?0xbad96c:0xffd28c);
 const eye=material(0x182a33);
 ball(root,0,.97,0,.72,bodyMat);ball(root,0,1.58,-.24,.55,bodyMat);
 ball(root,-.23,1.71,-.66,.115,eye);ball(root,.23,1.71,-.66,.115,eye);
 ball(root,0,1.45,-.75,.22,lighter);
 for(const x of [-.5,.5])for(const z of [-.42,.42])ball(root,x,.42,z,.29,bodyMat);
 // Distinctive crest for each species.
 for(let i=-1;i<=1;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.23,.75,5),lighter);spike.position.set(i*.37,1.93,-.09);root.add(spike);}
 const tail=ball(root,0,.94,.79,.35,lighter);tail.scale.set(.6,.6,2.3);
 return root;
}
let species='Salamander';
const player=makePet(species);player.position.set(SPAWN.x,.08,SPAWN.z);scene.add(player);
const npcs=[];
const trainer=makePet('Neptuno');trainer.scale.setScalar(.88);trainer.position.set(-11,0,13);trainer.rotation.y=1.2;scene.add(trainer);npcs.push(trainer);
const wildlife=makePet('Tierrudo');wildlife.scale.setScalar(.82);wildlife.position.set(24,0,20);wildlife.rotation.y=-.7;scene.add(wildlife);npcs.push(wildlife);
for(const [i,x,z] of [[0,-14,-25],[1,33,22],[2,-26,17]]){const pet=makePet(['Neptuno','Tierrudo','Salamander'][i]);pet.scale.setScalar(.68);pet.position.set(x,0,z);pet.rotation.y=.5*i;scene.add(pet);npcs.push(pet);}
const keys=new Set();let yaw=0,dragging=false,lastMouseX=0,interacting=false,phase=0,experience=0;
const entry=document.getElementById('dialog');
function showDialog(title,text,actions){interacting=true;keys.clear();dialogTitle.textContent=title;dialogBody.textContent=text;dialogActions.replaceChildren();actions.forEach(([label,fn,primary])=>{const b=document.createElement('button');b.textContent=label;b.className=primary?'primary':'';b.addEventListener('click',fn);dialogActions.append(b);});entry.hidden=false;}
function closeDialog(){entry.hidden=true;interacting=false;}
function act(){if(interacting)return;const target=closestInteraction({x:player.position.x,z:player.position.z});if(!target)return;
 if(target.id==='trainer'){showDialog('Lucía · Entrenadora','¡Bienvenido a Cali! Tu mascota lleva la aventura. Explora los caminos y encuentra a la criatura que vive cerca de la zona verde.',[['¡A explorar!',()=>{phase=Math.max(phase,1);objective.textContent='Objetivo: encuentra la criatura silvestre al este.';closeDialog();},true]]);}
 else if(target.id==='wild'){showDialog('Encuentro silvestre','Un Tierrudo curioso aparece entre los árboles. Esta es la primera interacción del mundo: observa a la criatura o participa en un encuentro de prueba. El combate autoritativo se integrará en un bloque posterior.',[['Saludar',()=>{phase=2;experience+=10;objective.textContent=`Encuentro completado · +10 XP de demostración · Total ${experience} XP. Explora libremente.`;closeDialog();},true],['Alejarme',closeDialog,false]]);}
 else showDialog(target.label,'Has descubierto un lugar inspirado en Cali. En próximas iteraciones incorporaremos calles, edificios y actividades más detalladas.',[['Continuar explorando',closeDialog,true]]);
}
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)act();if(e.code==='Escape'&&interacting)closeDialog();});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0){dragging=true;lastMouseX=e.clientX;document.body.classList.add('dragging');}});
addEventListener('pointerup',()=>{dragging=false;document.body.classList.remove('dragging');});
addEventListener('pointermove',e=>{if(dragging&&!interacting){yaw+=(e.clientX-lastMouseX)*.006;lastMouseX=e.clientX;}});
for(const button of document.querySelectorAll('[data-move]')){const key='Key'+button.dataset.move.toUpperCase();button.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);});['pointerup','pointercancel','pointerleave'].forEach(ev=>button.addEventListener(ev,()=>keys.delete(key)));}
document.getElementById('mobile-interact').addEventListener('click',act);
document.getElementById('change-pet').addEventListener('click',()=>showDialog('Tu mascota protagonista','Elige quién recorrerá este primer barrio de Cali.',[['Salamander',()=>choose('Salamander'),true],['Neptuno',()=>choose('Neptuno'),false],['Tierrudo',()=>choose('Tierrudo'),false]]));
function choose(name){species=name;const next=makePet(name);player.clear();while(next.children.length)player.add(next.children[0]);document.getElementById('pet-name').textContent=name;closeDialog();}
const camLook=new THREE.Vector3(),desiredCam=new THREE.Vector3();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.1);const t=clock.elapsedTime;
 if(!interacting){let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
 let z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 const wx=x*Math.cos(yaw)+z*Math.sin(yaw),wz=-x*Math.sin(yaw)+z*Math.cos(yaw);
 const moved=advance({x:player.position.x,z:player.position.z},{x:wx,z:wz},keys.has('ShiftLeft')||keys.has('ShiftRight')?13:7,dt);
 const walking=Math.abs(wx)+Math.abs(wz)>.01;player.position.x=moved.x;player.position.z=moved.z;player.position.y=.07+(walking?Math.abs(Math.sin(t*11))*.15:Math.sin(t*2)*.025);
 if(walking)player.rotation.y=Math.atan2(-wx,-wz);
 }
 const target=closestInteraction({x:player.position.x,z:player.position.z});proximity.hidden=!target||interacting;if(target)nearName.textContent=target.label;
 npcs.forEach((npc,i)=>npc.position.y=Math.sin(t*1.8+i)*.05);
 desiredCam.set(player.position.x+Math.sin(yaw)*11,8.8,player.position.z+Math.cos(yaw)*11);
 camera.position.lerp(desiredCam,Math.min(1,dt*6));camLook.set(player.position.x,1.25,player.position.z);camera.lookAt(camLook);
 renderer.render(scene,camera);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
loading.hidden=true;animate();
