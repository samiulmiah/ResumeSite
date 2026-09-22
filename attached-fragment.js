(function(scope){
  'use strict';
  const T=scope.THREE;
  // Trim the original render triangles, preserving their local coordinates and attachment transform.
  function trim(source,fraction,isRib){
    const g=source.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv'),index=g.index;
    const height=g.parameters.height,positions=[],boundary=[];
    function vertex(i){return {point:new T.Vector3().fromBufferAttribute(p,i),t:isRib?uv.getX(i):(p.getY(i)+height/2)/height}}
    function triangle(a,b,c){positions.push(...a.toArray(),...b.toArray(),...c.toArray())}
    const count=index?index.count:p.count;
    for(let i=0;i<count;i+=3){
      const input=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)),polygon=[];
      for(let j=0;j<3;j++){
        const a=input[j],b=input[(j+1)%3],insideA=a.t<=fraction,insideB=b.t<=fraction;
        if(insideA)polygon.push(a.point);
        if(insideA!==insideB){const point=a.point.clone().lerp(b.point,(fraction-a.t)/(b.t-a.t));polygon.push(point);boundary.push(point)}
      }
      for(let j=1;j+1<polygon.length;j++)triangle(polygon[0],polygon[j],polygon[j+1]);
    }
    const unique=[...new Map(boundary.map(v=>[v.toArray().map(n=>n.toFixed(7)).join(','),v])).values()];
    if(unique.length>=3){
      const center=unique.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(1/unique.length);
      const normal=isRib?g.parameters.path.getTangentAt(fraction).normalize():new T.Vector3(0,1,0);
      const u=new T.Vector3().crossVectors(normal,Math.abs(normal.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).normalize();
      const v=new T.Vector3().crossVectors(normal,u);
      unique.sort((a,b)=>{const da=a.clone().sub(center),db=b.clone().sub(center);return Math.atan2(da.dot(v),da.dot(u))-Math.atan2(db.dot(v),db.dot(u))});
      unique.forEach((point,i)=>triangle(center,point,unique[(i+1)%unique.length]));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
  }
  function create(record,fraction){
    const group=new T.Group();group.name='attached-'+record.id;
    const sources=record.type==='rib'?[record.meshes[0]]:[record.meshes[0],record.meshes[1]];
    sources.forEach((source,i)=>{
      const geometry=i===0?trim(source,fraction,record.type==='rib'):source.geometry.clone();
      const material=source.material.clone();material.transparent=false;material.opacity=1;material.depthWrite=true;material.emissive.setHex(0);
      const mesh=new T.Mesh(geometry,material);mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    });
    return group;
  }
  scope.AttachedFragments={create,trim};
  if(typeof module!=='undefined')module.exports=scope.AttachedFragments;
})(typeof window==='undefined'?globalThis:window);
