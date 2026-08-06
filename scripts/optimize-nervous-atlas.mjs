import fs from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";

class NodeFileReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader ??= NodeFileReader;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/optimize-nervous-atlas.mjs <input.glb> <output.glb>");
  process.exit(1);
}

await MeshoptSimplifier.ready;

function simplifyAndCompact(geometry, ratio, errorLimit) {
  const positionsOnly = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const attribute of Object.keys(positionsOnly.attributes)) {
    if (attribute !== "position") positionsOnly.deleteAttribute(attribute);
  }
  const welded = mergeVertices(positionsOnly, 0.000001);
  positionsOnly.dispose();

  const sourceIndices = welded.getIndex().array;
  const targetIndexCount = Math.max(3, Math.floor((sourceIndices.length * ratio) / 3) * 3);
  const [simplified] = MeshoptSimplifier.simplify(
    sourceIndices,
    welded.getAttribute("position").array,
    3,
    targetIndexCount,
    errorLimit,
    ["Permissive"],
  );

  const compactIndices = new Uint32Array(simplified);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(compactIndices);
  const sourcePositions = welded.getAttribute("position").array;
  const positions = new Float32Array(vertexCount * 3);
  const missing = 2 ** 32 - 1;
  for (let sourceIndex = 0; sourceIndex < remap.length; sourceIndex += 1) {
    const targetIndex = remap[sourceIndex];
    if (targetIndex === missing) continue;
    positions[targetIndex * 3] = sourcePositions[sourceIndex * 3];
    positions[targetIndex * 3 + 1] = sourcePositions[sourceIndex * 3 + 1];
    positions[targetIndex * 3 + 2] = sourcePositions[sourceIndex * 3 + 2];
  }

  welded.dispose();
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  result.setIndex(new THREE.BufferAttribute(compactIndices, 1));
  result.computeVertexNormals();
  return result;
}

function quantizeMesh(mesh) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const range = max.clone().sub(min);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const quantizedPositions = new Uint16Array(positions.count * 3);
  const quantizedNormals = new Int8Array(normals.count * 3);

  for (let index = 0; index < positions.count; index += 1) {
    quantizedPositions[index * 3] = Math.round(((positions.getX(index) - min.x) / range.x) * 65535);
    quantizedPositions[index * 3 + 1] = Math.round(((positions.getY(index) - min.y) / range.y) * 65535);
    quantizedPositions[index * 3 + 2] = Math.round(((positions.getZ(index) - min.z) / range.z) * 65535);
    quantizedNormals[index * 3] = Math.round(THREE.MathUtils.clamp(normals.getX(index), -1, 1) * 127);
    quantizedNormals[index * 3 + 1] = Math.round(THREE.MathUtils.clamp(normals.getY(index), -1, 1) * 127);
    quantizedNormals[index * 3 + 2] = Math.round(THREE.MathUtils.clamp(normals.getZ(index), -1, 1) * 127);
  }

  geometry.setAttribute("position", new THREE.Uint16BufferAttribute(quantizedPositions, 3, true));
  geometry.setAttribute("normal", new THREE.Int8BufferAttribute(quantizedNormals, 3, true));
  mesh.scale.copy(range);
  mesh.position.copy(min);
}

const sourceBuffer = fs.readFileSync(inputPath);
const sourceArrayBuffer = sourceBuffer.buffer.slice(sourceBuffer.byteOffset, sourceBuffer.byteOffset + sourceBuffer.byteLength);
const source = await new GLTFLoader().parseAsync(sourceArrayBuffer, "");
source.scene.updateMatrixWorld(true);

const scene = new THREE.Scene();
scene.name = "Human nervous system — scientific educational medical atlas";
scene.userData = {
  source: "Z-Anatomy human male atlas",
  license: "Creative Commons Attribution-ShareAlike 4.0 International",
  sourceUrl: "https://github.com/Z-Anatomy/Models-of-human-anatomy",
  anatomy: "268 central and 273 peripheral named atlas structures",
  processing: "Merged into central/peripheral layers, topology-preserving simplification, 16-bit position and 8-bit normal quantization",
};

const meshes = [];
source.scene.traverse((object) => {
  if (!object.isMesh) return;
  const isPeripheral = /peripheral/i.test(object.name);
  const geometry = object.geometry.clone();
  geometry.applyMatrix4(object.matrixWorld);
  const optimized = simplifyAndCompact(geometry, isPeripheral ? 0.85 : 0.52, isPeripheral ? 0.0015 : 0.0035);
  geometry.dispose();

  const material = new THREE.MeshPhysicalMaterial({
    name: isPeripheral ? "Peripheral nerves" : "Central neural tissue",
    color: isPeripheral ? 0xf2ac1a : 0xb3476b,
    roughness: isPeripheral ? 0.62 : 0.68,
    metalness: 0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.7,
  });
  const mesh = new THREE.Mesh(optimized, material);
  mesh.name = isPeripheral ? "Peripheral nervous system" : "Central nervous system";
  mesh.userData = object.userData;
  quantizeMesh(mesh);
  meshes.push(mesh);
  scene.add(mesh);
});

if (meshes.length !== 2) throw new Error(`Expected two atlas layers, received ${meshes.length}`);

const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: false });
fs.writeFileSync(outputPath, Buffer.from(result));

const triangles = meshes.reduce((sum, mesh) => sum + mesh.geometry.getIndex().count / 3, 0);
const vertices = meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count, 0);
console.log(`${outputPath}: ${meshes.length} layers, ${Math.round(triangles).toLocaleString()} triangles, ${vertices.toLocaleString()} vertices, ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
