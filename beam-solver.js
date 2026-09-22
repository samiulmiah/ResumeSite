(function (scope) {
  'use strict';
  const materials = {
    femur: { name: 'Femur', length: .44, outer: .014, inner: .007, E: 17e9, strength: 115e6 },
    tibia: { name: 'Tibia', length: .36, outer: .012, inner: .006, E: 17e9, strength: 115e6 },
    humerus: { name: 'Humerus', length: .31, outer: .011, inner: .0055, E: 17e9, strength: 115e6 },
    rib: { name: 'Rib', length: .18, outer: .005, inner: .003, E: 13.5e9, strength: 112e6 }
  };
  // Cubic Hermite Euler-Bernoulli elements; SI units throughout. Render geometry is independent.
  function solve({ length, outer, inner, E, supports = [0, 1], load = .5, force = 1, elements = 40 }) {
    if (!(length > 0 && outer > inner && inner >= 0 && E > 0)) throw Error('Invalid section or material');
    const n = elements, h = length / n, I = Math.PI * (outer ** 4 - inner ** 4) / 4;
    const count = 2 * (n + 1), K = Array.from({ length: count }, () => Array(count).fill(0));
    const f = Array(count).fill(0), ei = E * I, scale = ei / h ** 3;
    const k = [[12,6*h,-12,6*h],[6*h,4*h*h,-6*h,2*h*h],[-12,-6*h,12,-6*h],[6*h,2*h*h,-6*h,4*h*h]].map(r => r.map(v => v * scale));
    for (let e = 0; e < n; e++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[e*2+a][e*2+b] += k[a][b];
    const fixedNodes = [...new Set(supports.map(t => Math.round(t*n)))].sort((a,b) => a-b);
    if (fixedNodes.length !== 2 || fixedNodes[1] - fixedNodes[0] < 2) throw Error('Choose two separated supports');
    const loadNode = Math.round(load*n);
    if (loadNode <= fixedNodes[0] || loadNode >= fixedNodes[1]) throw Error('Load must lie between supports');
    f[loadNode*2] = -force;
    const fixed = new Set(fixedNodes.map(i => i*2)), free = Array.from({length:count},(_,i)=>i).filter(i=>!fixed.has(i));
    const matrix = free.map(i => free.map(j => K[i][j]));
    const solution = scope.numeric.solve(matrix, free.map(i=>f[i]), true);
    const u = Array(count).fill(0); free.forEach((d,i) => {u[d]=solution[i];});
    const residual = K.map((r,i) => r.reduce((s,v,j)=>s+v*u[j],0)-f[i]);
    const displacements = Array.from({length:n+1},(_,i)=>u[2*i]);
    const moments = [], stresses = [];
    for (let e=0;e<n;e++) {
      const end = k.map(row=>row.reduce((s,v,j)=>s+v*u[e*2+j],0));
      moments.push([-end[1],end[3]]);
      stresses.push(Math.max(Math.abs(end[1]),Math.abs(end[3]))*outer/I);
    }
    const peakStress = Math.max(...stresses), peakElement = stresses.indexOf(peakStress);
    const energy = .5 * u.reduce((s,v,i)=>s+v*f[i],0);
    return { I, h, elements:n, u, moments, stresses, displacements, peakStress, peakElement,
      maxDisplacement:Math.max(...displacements.map(Math.abs)), energy, force,
      reactions:fixedNodes.map(i=>residual[i*2]), supportNodes:fixedNodes, loadNode,
      residual:Math.max(...free.map(i=>Math.abs(residual[i]))),
      sample(t) {
        const e=Math.min(n-1,Math.floor(Math.max(0,t)*n)), q=Math.min(1,Math.max(0,t*n-e));
        const shape=[1-3*q*q+2*q**3,h*(q-2*q*q+q**3),3*q*q-2*q**3,h*(-q*q+q**3)];
        return { displacement:shape.reduce((s,v,j)=>s+v*u[e*2+j],0),
          moment:moments[e][0]*(1-q)+moments[e][1]*q };
      }
    };
  }
  scope.BeamFEA = { solve, materials };
  if (typeof module !== 'undefined') module.exports = scope.BeamFEA;
})(typeof window === 'undefined' ? globalThis : window);
