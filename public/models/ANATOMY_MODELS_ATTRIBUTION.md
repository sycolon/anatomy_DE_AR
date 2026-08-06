# Medical-atlas 3D model attribution

The `skeleton.glb` and `muscular-system.glb` assets are derived from
**BodyParts3D version 4.0**, a medically organized human-anatomy dataset
provided by The Database Center for Life Science (DBCLS).

> BodyParts3D, (c) The Database Center for Life Science licensed under Creative
> Commons Attribution-ShareAlike 2.1 Japan.

- Source: https://lifesciencedb.jp/bp3d/info/index.html
- Download archive: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html

The `nervous-system.glb` asset is derived from the **Z-Anatomy human male
atlas**, licensed under Creative Commons Attribution-ShareAlike 4.0
International.

- Source: https://github.com/Z-Anatomy/Models-of-human-anatomy
- Project: https://www.z-anatomy.com/
- License: https://creativecommons.org/licenses/by-sa/4.0/

## Changes made for this application

- Bone and skeletal-muscle structures were combined into system-level models.
- Geometry was welded, coordinate-normalized, re-oriented to Y-up, and exported
  as binary glTF for interactive educational use.
- Materials were replaced with non-metallic medical-atlas colors.
- The nervous-system model contains 268 central and 273 peripheral named atlas
  structures, including the brain, spinal cord, cranial nerves, sympathetic
  trunks, plexuses, and named nerves of the upper and lower limbs.
- Neural geometry was merged into two rendering layers, simplified with a
  topology-preserving error limit, and quantized for interactive performance.

Each derived asset remains available under the share-alike license of its
respective source.
