const assert=require('node:assert/strict');
globalThis.THREE=require('../vendor/three.min.js');
const T=globalThis.THREE,{create}=require('../attached-fragment.js');
const material=new T.MeshStandardMaterial({color:0xd8d5cb});
function check(record,cut){
  const fragment=create(record,cut);record.parent.add(fragment);record.parent.updateMatrixWorld(true);
  const original=record.meshes[0],part=fragment.children[0];
  assert.deepEqual(part.position.toArray(),original.position.toArray());
  assert.deepEqual(part.quaternion.toArray(),original.quaternion.toArray());
  assert.deepEqual(fragment.position.toArray(),[0,0,0]);
  const source=original.geometry.getAttribute('position'),uv=original.geometry.getAttribute('uv'),kept=part.geometry.getAttribute('position');
  const resultPoints=Array.from({length:kept.count},(_,i)=>new T.Vector3().fromBufferAttribute(kept,i).applyMatrix4(part.matrixWorld));
  let anchors=0;
  for(let i=0;i<source.count;i++){
    const t=record.type==='rib'?uv.getX(i):(source.getY(i)+original.geometry.parameters.height/2)/original.geometry.parameters.height;
    if(t>1e-6)continue;
    const point=new T.Vector3().fromBufferAttribute(source,i).applyMatrix4(original.matrixWorld);
    assert.ok(resultPoints.some(v=>v.distanceTo(point)<1e-6),record.id+' lost its body attachment');anchors++;
  }
  assert.ok(anchors>0);assert.ok(resultPoints.every(p=>p.toArray().every(Number.isFinite)));
  if(record.type!=='rib'){
    const limit=(cut-.5)*original.geometry.parameters.height;
    for(let i=0;i<kept.count;i++)assert.ok(kept.getY(i)<=limit+1e-6);
    assert.equal(fragment.children.length,2,'Proximal head must be retained');
  }
  console.log(record.id+' / '+cut+': original attachment and transforms preserved');
}
for(const type of ['femur','tibia','humerus','rib'])for(const side of [-1,1]){
  const parent=new T.Group();parent.position.set(side*.4,.8,-.2);parent.rotation.set(.3,-.4,.2);
  let shaft;
  if(type==='rib'){
    const points=[[.05,0,.15],[.3,-.05,.25],[.5,-.1,0],[.3,-.1,-.23],[.065,.03,-.15]].map(v=>new T.Vector3(v[0]*side,v[1],v[2]));
    shaft=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),14,.025,5,false),material);
  }else{
    shaft=new T.Mesh(new T.CylinderGeometry(.075,.08,1,7),material);shaft.position.set(.1,-.5,.04);shaft.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(.2,-1,.08).normalize());
  }
  const head=new T.Mesh(new T.IcosahedronGeometry(.1,1),material);parent.add(shaft,head);
  for(const cut of [.27,.4875,.73])check({id:type+'-'+side,type,parent,meshes:[shaft,head]},cut);
}
