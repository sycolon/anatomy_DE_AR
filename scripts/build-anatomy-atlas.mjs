import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;
      this.onloadend?.();
    });
  }
}

globalThis.FileReader ??= NodeFileReader;

const sourceDirectory = process.argv[2];
const elementPartsPath = process.argv[3];
const outputDirectory = process.argv[4] ?? path.resolve("public/models");

if (!sourceDirectory || !elementPartsPath) {
  console.error("Usage: node scripts/build-anatomy-atlas.mjs <BodyParts3D OBJ directory> <isa_element_parts.txt> [output directory]");
  process.exit(1);
}

const objLoader = new OBJLoader();
await MeshoptSimplifier.ready;
const rotateToYUp = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const availableFiles = new Set(fs.readdirSync(sourceDirectory).filter((file) => file.endsWith(".obj")));
const mappingRows = fs
  .readFileSync(elementPartsPath, "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split("\t"));

function idsForConcept(conceptName) {
  return [...new Set(
    mappingRows
      .filter(([, name]) => name.toLowerCase() === conceptName.toLowerCase())
      .map(([, , id]) => `${id}.obj`)
      .filter((file) => availableFiles.has(file)),
  )];
}

function readEnglishName(fileName) {
  const source = fs.readFileSync(path.join(sourceDirectory, fileName), "utf8");
  return {
    source,
    name: source.match(/^# English name : (.*)$/m)?.[1]?.trim() ?? fileName,
  };
}

function simplifyGeometry(geometry, ratio) {
  const sourceIndices = geometry.getIndex().array;
  if (sourceIndices.length < 600 || ratio >= 1) return geometry;

  const targetIndexCount = Math.max(3, Math.floor((sourceIndices.length * ratio) / 3) * 3);
  const [simplified] = MeshoptSimplifier.simplify(
    sourceIndices,
    geometry.getAttribute("position").array,
    3,
    targetIndexCount,
    0.005,
    ["Permissive"],
  );
  const compactIndices = new Uint32Array(simplified);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(compactIndices);
  const sourcePositions = geometry.getAttribute("position").array;
  const positions = new Float32Array(vertexCount * 3);
  const missing = 2 ** 32 - 1;
  for (let sourceIndex = 0; sourceIndex < remap.length; sourceIndex += 1) {
    const targetIndex = remap[sourceIndex];
    if (targetIndex === missing) continue;
    positions[targetIndex * 3] = sourcePositions[sourceIndex * 3];
    positions[targetIndex * 3 + 1] = sourcePositions[sourceIndex * 3 + 1];
    positions[targetIndex * 3 + 2] = sourcePositions[sourceIndex * 3 + 2];
  }

  const simplifiedGeometry = new THREE.BufferGeometry();
  simplifiedGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  simplifiedGeometry.setIndex(new THREE.BufferAttribute(compactIndices, 1));
  geometry.dispose();
  return simplifiedGeometry;
}

function normalizedGeometry(geometry, ratio) {
  let prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const attribute of Object.keys(prepared.attributes)) {
    if (attribute !== "position") prepared.deleteAttribute(attribute);
  }
  prepared.applyMatrix4(rotateToYUp);
  const indexed = mergeVertices(prepared, 0.001);
  prepared.dispose();
  const simplified = simplifyGeometry(indexed, ratio);
  simplified.computeVertexNormals();
  return simplified;
}

function geometriesFromObj(fileName, ratio = 1) {
  const { source, name } = readEnglishName(fileName);
  const parsed = objLoader.parse(source);
  const geometries = [];
  parsed.traverse((node) => {
    if (!node.isMesh || !node.geometry?.getAttribute("position")) return;
    const geometry = normalizedGeometry(node.geometry, ratio);
    geometry.name = name;
    geometries.push(geometry);
  });
  return geometries;
}

function mergeOrThrow(geometries, label) {
  const geometry = mergeGeometries(geometries, false);
  if (!geometry) throw new Error(`Could not merge ${label} geometries`);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  for (const source of geometries) source.dispose();
  return geometry;
}

function createMaterial({ color, roughness, clearcoat = 0, emissive = 0x000000, emissiveIntensity = 0 }) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.65,
    emissive,
    emissiveIntensity,
    side: THREE.DoubleSide,
  });
}

function quantizeMesh(mesh) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const range = max.clone().sub(min);
  const positions = geometry.getAttribute("position");
  const quantizedPositions = new Uint16Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    quantizedPositions[index * 3] = Math.round(((positions.getX(index) - min.x) / range.x) * 65535);
    quantizedPositions[index * 3 + 1] = Math.round(((positions.getY(index) - min.y) / range.y) * 65535);
    quantizedPositions[index * 3 + 2] = Math.round(((positions.getZ(index) - min.z) / range.z) * 65535);
  }

  const normals = geometry.getAttribute("normal");
  const quantizedNormals = new Int8Array(normals.count * 3);
  for (let index = 0; index < normals.count; index += 1) {
    quantizedNormals[index * 3] = Math.round(THREE.MathUtils.clamp(normals.getX(index), -1, 1) * 127);
    quantizedNormals[index * 3 + 1] = Math.round(THREE.MathUtils.clamp(normals.getY(index), -1, 1) * 127);
    quantizedNormals[index * 3 + 2] = Math.round(THREE.MathUtils.clamp(normals.getZ(index), -1, 1) * 127);
  }

  geometry.setAttribute("position", new THREE.Uint16BufferAttribute(quantizedPositions, 3, true));
  geometry.setAttribute("normal", new THREE.Int8BufferAttribute(quantizedNormals, 3, true));
  mesh.scale.copy(range);
  mesh.position.copy(min);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

async function exportScene(fileName, meshes, metadata) {
  const scene = new THREE.Scene();
  scene.name = metadata.title;
  scene.userData = metadata;
  for (const mesh of meshes) {
    quantizeMesh(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const result = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    trs: false,
  });
  fs.mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, fileName);
  fs.writeFileSync(outputPath, Buffer.from(result));

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const triangles = meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute("position").count / 3, 0);
  console.log(`${fileName}: ${meshes.length} meshes, ${Math.round(triangles).toLocaleString()} triangles, ${size.toArray().map((value) => value.toFixed(1)).join(" × ")} mm, ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
}

const attribution = {
  source: "BodyParts3D version 4.0",
  copyright: "BodyParts3D, (c) The Database Center for Life Science",
  license: "Creative Commons Attribution-ShareAlike 2.1 Japan",
  licenseUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
  processing: "Combined, coordinate-normalized and optimized for interactive scientific education",
};

const boneGeometries = idsForConcept("bone organ").flatMap((fileName) => geometriesFromObj(fileName, 0.55));
await exportScene(
  "skeleton.glb",
  [new THREE.Mesh(mergeOrThrow(boneGeometries, "skeleton"), createMaterial({ color: 0xeadfc5, roughness: 0.72, clearcoat: 0.08 }))],
  { ...attribution, title: "Human skeleton — medical atlas model", anatomy: "203 bone-organ meshes" },
);

const muscleGeometries = idsForConcept("muscle organ").flatMap((fileName) => geometriesFromObj(fileName, 0.36));
await exportScene(
  "muscular-system.glb",
  [new THREE.Mesh(mergeOrThrow(muscleGeometries, "muscular system"), createMaterial({ color: 0x9f322f, roughness: 0.76, clearcoat: 0.04 }))],
  { ...attribution, title: "Human muscular system — medical atlas model", anatomy: "323 muscle-organ meshes" },
);
