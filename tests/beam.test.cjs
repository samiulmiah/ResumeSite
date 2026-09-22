const assert=require('node:assert/strict');
globalThis.numeric=require('../vendor/numeric.min.js');
const {solve,materials}=require('../beam-solver.js');
function near(actual,expected,tolerance=1e-7){assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} vs ${expected}`)}
for(const [name,p] of Object.entries(materials)){
  const force=100,result=solve({...p,force}),expected=force*p.length**3/(48*p.E*result.I);
  near(result.maxDisplacement,expected,1e-10);
  near(result.reactions[0],50);near(result.reactions[1],50);
  near(result.peakStress,force*p.length/4*p.outer/result.I);
  near(result.energy,.5*force*expected,1e-9);
  const shifted=solve({...p,force,supports:[.1,.9],load:.35});
  near(shifted.reactions[0],force*(.9-.35)/.8);near(shifted.reactions[1],force*(.35-.1)/.8);
  assert.ok(shifted.residual<1e-6);
  const unit=solve({...p,force:1,supports:[.1,.9],load:.35});
  const failure=solve({...p,force:p.strength/unit.peakStress,supports:[.1,.9],load:.35});near(failure.peakStress,p.strength);
  const half=solve({...p,force:50});near(half.maxDisplacement,result.maxDisplacement/2,1e-10);
  assert.throws(()=>solve({...p,load:.1,supports:[.1,.9]}));
  console.log(name+': analytical displacement, stress, energy, equilibrium, load scaling, failure calibration PASS');
}
