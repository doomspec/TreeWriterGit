Updated [outline.md](/Users/iyakavets/Documents/Github/TreeWriterGit/model/papers/roboculture/asdresults/roboculture-design/outline.md) to reflect the manuscript draft as written.

It now captures the actual section emphasis: Franka-based workstation setup, AprilTag-based localization of static hardware, recalibration after layout changes, the higher-precision exception for well plates, and the validation arc from component optimization to the 15-hour autonomous yeast culture experiment. I also preserved the `@olson2011tags` citation and added a revision note that the current draft is less about “modular design rationale” than the old overview implied.
e from a central home pose under the camera.
- When the workspace layout changes, a calibration procedure is run to measure pixel offsets between each AprilTag and the desired end-effector pose for each object, enabling accurate motion between hardware items.
- AprilTags are presented as sufficient for static equipment that does not require high precision.
- Well plates are treated as a special case: they require substantially higher positioning accuracy, so AprilTags are not placed on the plate.
- The section closes by framing the platform validation story: the team first optimized individual robotic capabilities (pipetting, vision-based control, optical-density perception) and then demonstrated the full system in a 15-hour autonomous yeast culturing experiment on a 96-well plate.

Citations to preserve:
- AprilTags citation: `@olson2011tags`

Revision note:
- The current draft emphasizes localization, calibration, and the precision distinction between static hardware and well plates more than a component-by-component modular design rationale. Future revisions should keep the description aligned with that actual emphasis unless new manuscript text is added.
