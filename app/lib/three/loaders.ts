import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { disposeObject } from "./dispose";

/** Edge length of the cube every organ is normalised into, so hotspot
 *  coordinates authored in `anatomy-data` mean the same thing for each model. */
export const FIT_SIZE = 3.8;

const CACHE_LIMIT = 3;

export type LoadedOrgan = {
  url: string;
  /** Hotspot space: the fitted model, centred on the origin, spanning FIT_SIZE. */
  pivot: THREE.Group;
  meshes: THREE.Mesh[];
  mixer: THREE.AnimationMixer | null;
};

export class AnatomyAssetManager {
  private loader: GLTFLoader;
  private cache = new Map<string, LoadedOrgan>();
  private inflight = new Map<string, Promise<LoadedOrgan>>();
  private current: LoadedOrgan | null = null;
  private maxAnisotropy: number;

  constructor(renderer: THREE.WebGLRenderer) {
    // Anisotropy is what stops the texture detail from crawling at grazing
    // angles, which is most of the shimmer on a rotating organ.
    this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }

  get hasAnimation() {
    return Boolean(this.current?.mixer);
  }

  /** Warms the HTTP cache so switching organs feels instant. */
  prefetch(url: string) {
    if (url.startsWith("procedural:")) return;
    if (this.cache.has(url) || this.inflight.has(url)) return;
    void fetch(url, { priority: "low" } as RequestInit).catch(() => {});
  }

  async load(url: string, onProgress?: (progress: number) => void): Promise<LoadedOrgan> {
    // Organs without a .glb file use a synthetic URL like "procedural:skeleton".
    if (url.startsWith("procedural:")) {
      const cached = this.cache.get(url);
      if (cached) { this.cache.delete(url); this.cache.set(url, cached); this.current = cached; onProgress?.(1); return cached; }
      onProgress?.(0.5);
      const organ = this.buildProceduralOrgan(url.slice("procedural:".length));
      this.cache.set(url, organ);
      this.evict();
      this.current = organ;
      onProgress?.(1);
      return organ;
    }

    const cached = this.cache.get(url);
    if (cached) {
      this.cache.delete(url);
      this.cache.set(url, cached);
      this.resetMaterials(cached);
      onProgress?.(1);
      this.current = cached;
      return cached;
    }

    const pending = this.inflight.get(url) ?? this.parse(url, onProgress);
    this.inflight.set(url, pending);
    try {
      const organ = await pending;
      this.cache.set(url, organ);
      this.evict();
      this.current = organ;
      return organ;
    } finally {
      this.inflight.delete(url);
    }
  }

  private async parse(url: string, onProgress?: (progress: number) => void): Promise<LoadedOrgan> {
    const gltf = await this.loader.loadAsync(url, (event) => {
      if (event.total > 0) onProgress?.(event.loaded / event.total);
    });

    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = FIT_SIZE / Math.max(size.x, size.y, size.z, 0.001);
    model.scale.setScalar(scale);
    model.position.copy(center.multiplyScalar(-scale));

    // The pivot is what the viewer animates and what hotspots are parented to,
    // so hotspot coordinates stay in the normalised FIT_SIZE space.
    const pivot = new THREE.Group();
    pivot.name = "organ-pivot";
    pivot.add(model);
    pivot.rotation.set(0.05, -0.28, 0);

    const meshes: THREE.Mesh[] = [];
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshes.push(child);
      // One mesh per organ, always centred in frame — culling can only ever
      // cost a wrong answer here, never save work.
      child.frustumCulled = false;
      // Real-time shadow casting is replaced by a baked contact shadow, which
      // saves a full extra pass over the mesh every frame.
      child.castShadow = false;
      child.receiveShadow = false;
      this.forEachMaterial(child, (material) => {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.depthTest = true;
        material.side = THREE.FrontSide;
        if (material instanceof THREE.MeshStandardMaterial) {
          // A tighter specular lobe sparkles on any surface with normal detail;
          // holding roughness a little higher keeps highlights stable while the
          // model turns.
          material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.5, 0.42, 0.62);
          material.metalness = 0;
          material.envMapIntensity = 0.32;
          material.emissive.set(0x000000);
          material.emissiveIntensity = 0;
          if ("clearcoat" in material) {
            const physical = material as THREE.MeshPhysicalMaterial;
            // A second, sharper specular lobe is the main source of crawling
            // highlights, so keep it faint and broad.
            physical.clearcoat = Math.min(Math.max(physical.clearcoat, 0.08), 0.12);
            physical.clearcoatRoughness = 0.62;
            // Volume/transmission are per-pixel expensive and invisible here.
            physical.transmission = 0;
            physical.thickness = 0;
          }
          if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
          if (material.normalMap) material.normalScale.multiplyScalar(0.62);
          // Every sampled map needs anisotropy, not just the base colour —
          // an aliasing normal or roughness map shimmers just as badly.
          for (const map of [
            material.map,
            material.normalMap,
            material.roughnessMap,
            material.metalnessMap,
            material.aoMap,
            material.emissiveMap,
          ]) {
            if (!map) continue;
            map.anisotropy = this.maxAnisotropy;
            map.generateMipmaps = true;
            map.minFilter = THREE.LinearMipmapLinearFilter;
            map.magFilter = THREE.LinearFilter;
            map.needsUpdate = true;
          }
        }
        material.needsUpdate = true;
      });
    });

    let mixer: THREE.AnimationMixer | null = null;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => mixer?.clipAction(clip).play());
    }

    return { url, pivot, meshes, mixer };
  }

  /**
   * Generates a procedural Three.js geometry for organs that have no .glb file.
   * The resulting LoadedOrgan is compatible with every viewer feature (hotspots,
   * cross-section, isolate, layers, fade-in animation).
   */
  private buildProceduralOrgan(type: string): LoadedOrgan {
    const pivot = new THREE.Group();
    pivot.name = "organ-pivot";
    pivot.rotation.set(0.05, -0.28, 0);

    const meshes: THREE.Mesh[] = [];
    const url = `procedural:${type}`;

    const addMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, pos?: [number, number, number], rot?: [number, number, number], scale?: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      if (pos) mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      if (scale !== undefined) mesh.scale.setScalar(scale);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      pivot.add(mesh);
      meshes.push(mesh);
      return mesh;
    };

    const addEllipsoid = (
      radii: [number, number, number],
      mat: THREE.Material,
      pos: [number, number, number],
      rot?: [number, number, number],
      segments = 24,
    ) => {
      const geo = new THREE.SphereGeometry(1, segments, Math.max(12, Math.round(segments * 0.7)));
      geo.scale(...radii);
      return addMesh(geo, mat, pos, rot);
    };

    const addCapsuleBetween = (
      start: [number, number, number],
      end: [number, number, number],
      radius: number,
      mat: THREE.Material,
      radialSegments = 12,
    ) => {
      const a = new THREE.Vector3(...start);
      const b = new THREE.Vector3(...end);
      const direction = b.clone().sub(a);
      const length = direction.length();
      const mesh = addMesh(
        new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 6, radialSegments),
        mat,
        [0, 0, 0],
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      return mesh;
    };

    const addTube = (points: Array<[number, number, number]>, radius: number, mat: THREE.Material) => {
      const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, "centripetal");
      return addMesh(new THREE.TubeGeometry(curve, Math.max(10, points.length * 6), radius, 7, false), mat);
    };

    if (type === "nervous-system") {
      const brainMat = new THREE.MeshPhysicalMaterial({ color: 0xc98f9d, roughness: 0.64, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.72, envMapIntensity: 0.24 });
      const cerebellumMat = new THREE.MeshStandardMaterial({ color: 0xb87887, roughness: 0.72, metalness: 0, envMapIntensity: 0.2 });
      const cordMat = new THREE.MeshStandardMaterial({ color: 0xe7c3aa, roughness: 0.65, metalness: 0, envMapIntensity: 0.22 });
      const nerveMat = new THREE.MeshStandardMaterial({ color: 0xd9a544, roughness: 0.62, metalness: 0, envMapIntensity: 0.24 });
      const fineNerveMat = new THREE.MeshStandardMaterial({ color: 0xe8bd63, roughness: 0.68, metalness: 0, envMapIntensity: 0.2 });

      // Paired cerebral hemispheres and cerebellum read as anatomy instead of a sphere.
      addEllipsoid([0.39, 0.48, 0.34], brainMat, [-0.2, 1.62, 0.02], [0.03, 0.05, -0.04], 30);
      addEllipsoid([0.39, 0.48, 0.34], brainMat, [0.2, 1.62, 0.02], [0.03, -0.05, 0.04], 30);
      addEllipsoid([0.38, 0.23, 0.29], cerebellumMat, [0, 1.31, -0.19], [-0.18, 0, 0], 26);
      addCapsuleBetween([0, 1.34, 0], [0, -0.75, 0], 0.07, cordMat, 14);

      // Segmental spinal nerves form the intercostal and trunk network.
      for (let i = 0; i < 10; i += 1) {
        const y = 1.1 - i * 0.16;
        const reach = 0.43 + Math.sin((i / 9) * Math.PI) * 0.2;
        for (const side of [-1, 1]) {
          addTube([[0, y, 0], [side * 0.22, y - 0.015, 0.05], [side * reach, y - 0.06, 0.1]], 0.018, fineNerveMat);
        }
      }

      // Major peripheral pathways, branching naturally at shoulder, elbow, hip and knee.
      for (const side of [-1, 1]) {
        addTube([[side * 0.06, 0.92, 0], [side * 0.42, 0.92, 0.05], [side * 0.86, 0.68, 0.06], [side * 1.14, 0.24, 0.05], [side * 1.3, -0.24, 0.08]], 0.032, nerveMat);
        addTube([[side * 0.76, 0.72, 0.04], [side * 1.03, 0.31, 0.12], [side * 1.18, -0.17, 0.16], [side * 1.36, -0.57, 0.1]], 0.022, fineNerveMat);
        for (let finger = 0; finger < 4; finger += 1) {
          const offset = (finger - 1.5) * 0.045;
          addTube([[side * 1.3, -0.24, 0.08], [side * (1.36 + offset), -0.45, 0.08], [side * (1.4 + offset), -0.68, 0.06]], 0.009, fineNerveMat);
        }

        addTube([[side * 0.08, -0.45, 0], [side * 0.32, -0.7, 0.04], [side * 0.4, -1.2, 0.05], [side * 0.43, -1.75, 0.03], [side * 0.42, -2.28, 0.04]], 0.038, nerveMat);
        addTube([[side * 0.26, -0.72, -0.02], [side * 0.52, -1.15, -0.12], [side * 0.55, -1.7, -0.1], [side * 0.57, -2.22, -0.03]], 0.024, fineNerveMat);
        for (let toe = 0; toe < 4; toe += 1) {
          const spread = (toe - 1.5) * 0.035;
          addTube([[side * 0.42, -2.28, 0.04], [side * (0.45 + spread), -2.43, 0.16], [side * (0.5 + spread), -2.52, 0.28]], 0.008, fineNerveMat);
        }
      }
    } else if (type === "muscular-system") {
      const muscleMat = new THREE.MeshPhysicalMaterial({ color: 0xa94142, roughness: 0.58, metalness: 0, clearcoat: 0.07, clearcoatRoughness: 0.7, envMapIntensity: 0.24 });
      const lightMuscleMat = new THREE.MeshStandardMaterial({ color: 0xcf6260, roughness: 0.64, metalness: 0, envMapIntensity: 0.22 });
      const tendonMat = new THREE.MeshStandardMaterial({ color: 0xe9dbc8, roughness: 0.76, metalness: 0, envMapIntensity: 0.18 });

      // Head, neck and layered torso.
      addEllipsoid([0.34, 0.44, 0.3], lightMuscleMat, [0, 1.72, 0], [0, 0, 0], 26);
      addCapsuleBetween([-0.12, 1.38, 0], [-0.28, 1.03, 0.04], 0.1, muscleMat);
      addCapsuleBetween([0.12, 1.38, 0], [0.28, 1.03, 0.04], 0.1, muscleMat);
      addEllipsoid([0.67, 0.82, 0.34], muscleMat, [0, 0.55, -0.02], [0, 0, 0], 28);
      addEllipsoid([0.38, 0.27, 0.2], lightMuscleMat, [-0.34, 0.83, 0.32], [0.08, -0.08, -0.08]);
      addEllipsoid([0.38, 0.27, 0.2], lightMuscleMat, [0.34, 0.83, 0.32], [0.08, 0.08, 0.08]);
      for (let row = 0; row < 3; row += 1) {
        const y = 0.47 - row * 0.23;
        addEllipsoid([0.16, 0.15, 0.13], lightMuscleMat, [-0.18, y, 0.37], [0, 0.06, 0]);
        addEllipsoid([0.16, 0.15, 0.13], lightMuscleMat, [0.18, y, 0.37], [0, -0.06, 0]);
      }

      for (const side of [-1, 1]) {
        addEllipsoid([0.26, 0.29, 0.25], lightMuscleMat, [side * 0.74, 0.9, 0.02], [0, 0, side * 0.12]);
        addCapsuleBetween([side * 0.79, 0.75, 0], [side * 1.03, 0.12, 0.02], 0.18, muscleMat, 16);
        addCapsuleBetween([side * 0.88, 0.68, 0.18], [side * 1.09, 0.13, 0.2], 0.11, lightMuscleMat, 14);
        addCapsuleBetween([side * 1.03, 0.06, 0], [side * 1.2, -0.55, 0.02], 0.15, muscleMat, 16);
        addCapsuleBetween([side * 1.02, 0.04, 0.16], [side * 1.16, -0.5, 0.18], 0.085, lightMuscleMat, 12);
        addEllipsoid([0.17, 0.11, 0.24], tendonMat, [side * 1.22, -0.69, 0.07], [0.1, 0, 0]);

        addEllipsoid([0.3, 0.35, 0.29], muscleMat, [side * 0.31, -0.38, -0.02], [0, 0, side * 0.06]);
        addCapsuleBetween([side * 0.31, -0.47, 0.05], [side * 0.36, -1.32, 0.08], 0.24, muscleMat, 18);
        addCapsuleBetween([side * 0.22, -0.52, 0.22], [side * 0.28, -1.3, 0.25], 0.12, lightMuscleMat, 14);
        addEllipsoid([0.19, 0.14, 0.15], tendonMat, [side * 0.36, -1.48, 0.13]);
        addCapsuleBetween([side * 0.36, -1.53, 0], [side * 0.38, -2.22, 0.02], 0.16, muscleMat, 16);
        addCapsuleBetween([side * 0.47, -1.58, -0.08], [side * 0.48, -2.08, -0.1], 0.11, lightMuscleMat, 14);
        addCapsuleBetween([side * 0.34, -1.63, 0.19], [side * 0.35, -2.28, 0.2], 0.055, tendonMat, 10);
        addEllipsoid([0.21, 0.1, 0.34], tendonMat, [side * 0.38, -2.4, 0.15], [0.1, 0, 0]);
      }
    } else if (type === "skeleton") {
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dfc4, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.35 });
      const jointMat = new THREE.MeshStandardMaterial({ color: 0xd4c8a8, roughness: 0.68, metalness: 0, envMapIntensity: 0.3 });

      // Skull
      const skullGeo = new THREE.SphereGeometry(0.48, 24, 18);
      skullGeo.scale(1, 1.12, 0.9);
      addMesh(skullGeo, boneMat, [0, 1.65, 0]);

      // Mandible
      const jawGeo = new THREE.SphereGeometry(0.28, 16, 10);
      jawGeo.scale(1, 0.52, 0.88);
      addMesh(jawGeo, boneMat, [0, 1.25, 0.22]);

      // Spine (vertebrae as a series of small discs)
      const vertebraMat = boneMat;
      for (let i = 0; i < 8; i++) {
        const y = 0.95 - i * 0.24;
        const r = 0.052 + (i < 3 ? 0 : i < 6 ? 0.01 : 0.02);
        addMesh(new THREE.CylinderGeometry(r + 0.09, r + 0.09, 0.13, 14), vertebraMat, [0, y, 0]);
      }

      // Ribcage (8 pairs of ribs, torus arcs)
      for (let i = 0; i < 7; i++) {
        const y = 0.75 - i * 0.165;
        const rw = 0.52 + (i < 3 ? i * 0.055 : (6 - i) * 0.04);
        const ribGeo = new THREE.TorusGeometry(rw, 0.048, 8, 22, Math.PI * 1.06);
        addMesh(ribGeo, boneMat, [0, y, -0.02], [-0.12, Math.PI * 0.5, 0]);
      }

      // Sternum
      addMesh(new THREE.CapsuleGeometry(0.075, 0.62, 6, 12), boneMat, [0, 0.58, 0.5]);

      // Clavicles
      addMesh(new THREE.CapsuleGeometry(0.055, 0.58, 6, 12), boneMat, [ 0.44, 1.05, 0.12], [0, 0,  1.05]);
      addMesh(new THREE.CapsuleGeometry(0.055, 0.58, 6, 12), boneMat, [-0.44, 1.05, 0.12], [0, 0, -1.05]);

      // Shoulder joints
      addMesh(new THREE.SphereGeometry(0.12, 12, 10), jointMat, [ 0.86, 0.98, 0]);
      addMesh(new THREE.SphereGeometry(0.12, 12, 10), jointMat, [-0.86, 0.98, 0]);

      // Humeri (upper arm bones)
      addMesh(new THREE.CapsuleGeometry(0.085, 0.68, 6, 14), boneMat, [ 1.02, 0.5, 0],  [0, 0,  0.52]);
      addMesh(new THREE.CapsuleGeometry(0.085, 0.68, 6, 14), boneMat, [-1.02, 0.5, 0],  [0, 0, -0.52]);

      // Elbow joints
      addMesh(new THREE.SphereGeometry(0.095, 10, 8), jointMat, [ 1.32, 0.04, 0]);
      addMesh(new THREE.SphereGeometry(0.095, 10, 8), jointMat, [-1.32, 0.04, 0]);

      // Radius/Ulna (forearm)
      addMesh(new THREE.CapsuleGeometry(0.065, 0.58, 6, 12), boneMat, [ 1.38, -0.38, 0], [0, 0,  0.65]);
      addMesh(new THREE.CapsuleGeometry(0.065, 0.58, 6, 12), boneMat, [-1.38, -0.38, 0], [0, 0, -0.65]);

      // Pelvis
      const pelvisGeo = new THREE.SphereGeometry(0.62, 20, 14);
      pelvisGeo.scale(1, 0.48, 0.82);
      addMesh(pelvisGeo, boneMat, [0, -0.78, 0]);

      // Hip joints
      addMesh(new THREE.SphereGeometry(0.14, 12, 10), jointMat, [ 0.48, -0.92, 0]);
      addMesh(new THREE.SphereGeometry(0.14, 12, 10), jointMat, [-0.48, -0.92, 0]);

      // Femurs
      addMesh(new THREE.CapsuleGeometry(0.11, 0.82, 6, 16), boneMat, [ 0.42, -1.52, 0]);
      addMesh(new THREE.CapsuleGeometry(0.11, 0.82, 6, 16), boneMat, [-0.42, -1.52, 0]);

      // Knee joints
      addMesh(new THREE.SphereGeometry(0.12, 10, 8), jointMat, [ 0.42, -2.06, 0]);
      addMesh(new THREE.SphereGeometry(0.12, 10, 8), jointMat, [-0.42, -2.06, 0]);

      // Tibiae
      addMesh(new THREE.CapsuleGeometry(0.085, 0.76, 6, 14), boneMat, [ 0.42, -2.6, 0]);
      addMesh(new THREE.CapsuleGeometry(0.085, 0.76, 6, 14), boneMat, [-0.42, -2.6, 0]);

      // Fibulae, ankles, feet and toes complete the lower limb silhouette.
      for (const side of [-1, 1]) {
        addCapsuleBetween([side * 0.53, -2.14, -0.02], [side * 0.5, -3.0, -0.02], 0.045, boneMat, 10);
        addEllipsoid([0.12, 0.1, 0.12], jointMat, [side * 0.43, -3.06, 0]);
        addCapsuleBetween([side * 0.43, -3.05, 0], [side * 0.43, -3.16, 0.32], 0.065, boneMat, 10);
        for (let toe = 0; toe < 5; toe += 1) {
          const x = side * (0.31 + toe * 0.055);
          addCapsuleBetween([x, -3.16, 0.3], [x + side * 0.025, -3.16, 0.53 - toe * 0.018], 0.025, boneMat, 8);
        }

        // Carpals, metacarpals and fingers are kept slender but individually readable.
        const wrist: [number, number, number] = [side * 1.58, -0.72, 0];
        addEllipsoid([0.11, 0.09, 0.1], jointMat, wrist);
        for (let finger = 0; finger < 5; finger += 1) {
          const spread = (finger - 2) * 0.055;
          const base: [number, number, number] = [side * (1.58 + spread), -0.78, 0.01];
          const tip: [number, number, number] = [side * (1.64 + spread * 1.35), -1.08 + Math.abs(finger - 2) * 0.025, 0.02];
          addCapsuleBetween(base, tip, 0.024, boneMat, 8);
        }
      }

      // Orbital rims and nasal opening give the skull a recognisable facial structure.
      const socketMat = new THREE.MeshStandardMaterial({ color: 0x5b4937, roughness: 0.9, metalness: 0, envMapIntensity: 0.08 });
      addEllipsoid([0.115, 0.1, 0.035], socketMat, [-0.17, 1.73, 0.4]);
      addEllipsoid([0.115, 0.1, 0.035], socketMat, [0.17, 1.73, 0.4]);
      addEllipsoid([0.07, 0.1, 0.03], socketMat, [0, 1.52, 0.43], [0, 0, 0]);
    }

    // Normalise to FIT_SIZE so hotspot coords stay consistent.
    const box = new THREE.Box3().setFromObject(pivot);
    const size = box.getSize(new THREE.Vector3());
    const scaleFactor = FIT_SIZE / Math.max(size.x, size.y, size.z, 0.001);
    pivot.scale.setScalar(scaleFactor);
    const center = box.getCenter(new THREE.Vector3());
    pivot.position.copy(center.multiplyScalar(-scaleFactor));

    return { url, pivot, meshes, mixer: null };
  }

  /** Undoes viewer tools (wireframe, clipping, fade) before a cached organ returns. */
  private resetMaterials(organ: LoadedOrgan) {
    organ.pivot.rotation.set(0.05, -0.28, 0);
    organ.pivot.position.set(0, 0, 0);
    organ.meshes.forEach((mesh) => {
      this.forEachMaterial(mesh, (material) => {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.clippingPlanes = null;
        material.clipShadows = false;
        if (material instanceof THREE.MeshStandardMaterial) material.wireframe = false;
        material.needsUpdate = true;
      });
    });
  }

  private forEachMaterial(mesh: THREE.Mesh, fn: (material: THREE.Material) => void) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(fn);
  }

  private evict() {
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) return;
      const organ = this.cache.get(oldest);
      this.cache.delete(oldest);
      if (organ && organ !== this.current) this.destroy(organ);
    }
  }

  private destroy(organ: LoadedOrgan) {
    organ.mixer?.stopAllAction();
    organ.mixer?.uncacheRoot(organ.pivot);
    organ.pivot.removeFromParent();
    disposeObject(organ.pivot);
  }

  update(delta: number) {
    this.current?.mixer?.update(delta);
  }

  /** Detaches from the scene but keeps the organ warm for the next visit. */
  release(organ: LoadedOrgan | null = this.current) {
    if (!organ) return;
    organ.mixer?.stopAllAction();
    organ.pivot.removeFromParent();
    if (organ === this.current) this.current = null;
  }

  dispose() {
    this.release();
    this.cache.forEach((organ) => this.destroy(organ));
    this.cache.clear();
  }
}
