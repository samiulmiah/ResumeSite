# Samiul Miah: Fracture Visualizer

Open `index.html` in a modern browser. All runtime libraries are bundled locally; no build or package installation is required. The original portfolio content, navigation, project assets, and resume are retained.

Enter **Fracture visualizer** from the skeleton viewport. Select a bone, pin one proximal and one distal support, and place the force on the specimen. Ten load increments lead to fracture. The pieces drop slightly and float for inspection. After separation, select t0-t3 to review a stage; select it again or t4 to restore the floating pieces. Returning to the skeleton removes the loose pieces while retaining attached bone remnants and saved damage. **Reset Skeleton** reconstructs the model. Export results downloads a JSON record.

## Implementation

- `lowpoly-skeleton.js`: articulated skeleton, individual ribs, selectable specimens, original pose controls.
- `beam-solver.js`: 40 cubic Hermite Euler-Bernoulli beam elements, SI units, Numeric.js linear solve, reactions, bending stress, displacement, and strain energy.
- `biomechanics-theater.js`: workflow, geometry, contours, crack review, floating separation, hierarchy damage, and local persistence.
- `attached-fragment.js`: trims original bone geometry without changing its body attachment or local transform.
- `biomechanics-theater.css`: visualizer layout and responsive controls.

Both sides of the femur, tibia, and humerus and ten individual ribs are selectable. The render mesh and computational beam mesh are separate. The mesh toggle includes the actual 41-node beam centerline and a surface triangulation overlay.

The previous screenshot references appear as the ten-step load line, the artistic/research propagation scale, and five time-indexed fracture stages. The DOCX's blue-to-red contour order, main-view/right-controls/bottom-information layout, force arrow, and persistent-damage rule are implemented.

## Engineering Scope

This is a working educational reduced model, not a validated anatomical fracture predictor. It solves small-displacement elastic bending of an idealized hollow circular straight beam, with two simple supports and a single nodal transverse load. Support and load positions snap to the 40-element mesh. The rib is rendered curved but solved as an equivalent straight beam. Dimensions are illustrative, not specimen measurements. Shear deformation, anisotropy, tissue variation, dynamic fracture mechanics, and stress redistribution after initiation are not solved.

The chosen assumed tensile strength determines failure force for each support/load configuration. Each click applies one tenth of that force, so click 10 reaches the threshold by construction. Long-bone examples use E = 17 GPa and strength = 115 MPa; the rib example uses E = 13.5 GPa and strength = 112 MPa. These are literature-informed demonstration assumptions, not patient-specific calibrations.

Deformation display scale is independent of numerical displacement. The 12-band field maps absolute axial bending stress around the section; it is not a von Mises solid-element field. Numerical results are frozen at crack initiation. A procedural circumferential crack is seeded near the highest-stress beam element. Matching jagged boundaries produce two separate capped hollow meshes, which move slightly apart and down before floating. This separation motion is illustrative, not a dynamics simulation. Stage review changes only the inspection view and never reverses saved damage.

The 3-point bone bending paper reports **1370 +/- 200 m/s for dry bovine ribs**. The speed marker is explicitly limited to that reference. At that marker, displayed path length divided by 1370 m/s gives a reference travel time and a visible playback dilation factor. Other slider settings control artistic playback only. No universal speed is assigned to human bones. Reload reconstructs attached remnants in the original bone geometry and restores missing structures from the damage log; no loose fragments are retained on the floor.

## Verification

Run the portable numerical checks with `node tests/beam.test.cjs` from this folder.
Run attachment regression checks with `node tests/attached-fragment.test.cjs`.

- Analytical checks passed for all four material/section examples: central-load deflection, bending stress, support reactions, strain energy, linear load scaling, and failure calibration.
- Asymmetric load/support tests passed equilibrium and free-degree-of-freedom residual checks.
- Browser workflows exercised all four bone families through all ten steps, fragmentation, return to skeleton, reload persistence, and reset.
- Desktop and mobile checks exercised force placement, mesh visibility, deformation scale, responsive framing, and asset loading.

## References

- [TU Delft: Euler-Bernoulli beam formulation](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html)
- [Cortical bone material properties](https://bionumbers.hms.harvard.edu/files/Mechanical%20properties%20of%20human%20cortical%20bone.pdf)
- [Human rib cortical tensile properties](https://arxiv.org/abs/1108.0390)
- Supplied study: `assets/docs/Three_Point_Bone_Bending_Paper.pdf`, "Novel direct assessment of bulk fracture propagation speed in bone."

## Bundled Libraries

Runtime: Three.js 0.128.0 and its OrbitControls; Numeric.js 1.2.6; Lucide 0.468.0. License files are in `vendor/`. The previously bundled Cannon.js file is retained but is no longer loaded.
