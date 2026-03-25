/**
 * BMD (Binary Model Data) parser for MU Online 3D models.
 * Ported from xulek/muonline-bmd-viewer (TypeScript) to vanilla JS.
 * Supports versions 0 (unencrypted), 12 (FileCryptor), 15 (LEA-256).
 */

//----------------------------------------------------------
//  Crypto: FileCryptor (XOR-based)
//----------------------------------------------------------
const MAP_XOR_KEY = new Uint8Array([
  0xD1, 0x73, 0x52, 0xF6, 0xD2, 0x9A, 0xCB, 0x27,
  0x3E, 0xAF, 0x59, 0x31, 0x37, 0xB3, 0xE7, 0xA2,
]);

function decryptFileCryptor(src) {
  const dst = new Uint8Array(src.length);
  let mapKey = 0x5E;
  for (let i = 0; i < src.length; i++) {
    dst[i] = ((src[i] ^ MAP_XOR_KEY[i & 15]) - mapKey) & 0xFF;
    mapKey = (src[i] + 0x3D) & 0xFF;
  }
  return dst;
}

//----------------------------------------------------------
//  Crypto: LEA-256 ECB
//----------------------------------------------------------
const KEY_DELTA = new Uint32Array([
  0xc3efe9db, 0x44626b02, 0x79e27c8a, 0x78df30ec,
  0x715ea49e, 0xc785da0a, 0xe04ef22a, 0xe5c40957
]);

const rol = (x, n) => ((x << (n & 31)) | (x >>> (32 - (n & 31)))) >>> 0;
const ror = (x, n) => ((x >>> (n & 31)) | (x << (32 - (n & 31)))) >>> 0;

function leaKeySchedule(keyWords) {
  const rk = new Uint32Array(192);
  const T = new Uint32Array(keyWords);
  for (let i = 0; i < 32; i++) {
    const d = KEY_DELTA[i & 7];
    const s = (i * 6) & 7;
    T[(s+0)&7] = rol((T[(s+0)&7] + rol(d, i  )) >>> 0,  1);
    T[(s+1)&7] = rol((T[(s+1)&7] + rol(d, i+1)) >>> 0,  3);
    T[(s+2)&7] = rol((T[(s+2)&7] + rol(d, i+2)) >>> 0,  6);
    T[(s+3)&7] = rol((T[(s+3)&7] + rol(d, i+3)) >>> 0, 11);
    T[(s+4)&7] = rol((T[(s+4)&7] + rol(d, i+4)) >>> 0, 13);
    T[(s+5)&7] = rol((T[(s+5)&7] + rol(d, i+5)) >>> 0, 17);
    rk.set([T[(s+0)&7], T[(s+1)&7], T[(s+2)&7], T[(s+3)&7], T[(s+4)&7], T[(s+5)&7]], i * 6);
  }
  return rk;
}

function createLeaDecrypt(key) {
  const keyWords = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    keyWords[i] = (key[i*4+3] << 24) | (key[i*4+2] << 16) | (key[i*4+1] << 8) | key[i*4];
  }
  const RK = leaKeySchedule(keyWords);
  const state = new Uint32Array(4);
  const next = new Uint32Array(4);
  const rk6 = new Uint32Array(6);

  return function(cipher) {
    if (cipher.length % 16 !== 0) throw new Error('LEA-ECB: data must be multiple of 16');
    const out = cipher.slice();
    const dv = new DataView(out.buffer, out.byteOffset);
    for (let off = 0; off < out.length; off += 16) {
      for (let i = 0; i < 4; i++) state[i] = dv.getUint32(off + i * 4, true);
      for (let r = 0; r < 32; r++) {
        rk6.set(RK.subarray((31 - r) * 6, (32 - r) * 6));
        next[0] = state[3];
        next[1] = (ror(state[0], 9) - (next[0] ^ rk6[0]) ^ rk6[1]) >>> 0;
        next[2] = (rol(state[1], 5) - (next[1] ^ rk6[2]) ^ rk6[3]) >>> 0;
        next[3] = (rol(state[2], 3) - (next[2] ^ rk6[4]) ^ rk6[5]) >>> 0;
        state.set(next);
      }
      for (let i = 0; i < 4; i++) dv.setUint32(off + i * 4, state[i], true);
    }
    return out;
  };
}

const LEA_KEY = new Uint8Array([
  0xcc, 0x50, 0x45, 0x13, 0xc2, 0xa6, 0x57, 0x4e,
  0xd6, 0x9a, 0x45, 0x89, 0xbf, 0x2f, 0xbc, 0xd9,
  0x39, 0xb3, 0xb3, 0xbd, 0x50, 0xbd, 0xcc, 0xb6,
  0x85, 0x46, 0xd1, 0xd6, 0x16, 0x54, 0xe0, 0x87
]);
const leaDecrypt = createLeaDecrypt(LEA_KEY);

//----------------------------------------------------------
//  Binary struct reading
//----------------------------------------------------------
const Sizes = { int16: 2, uint16: 2, uint8: 1, float32: 4 };
const Readers = {
  int16:   (v, o) => v.getInt16(o, true),
  uint16:  (v, o) => v.getUint16(o, true),
  uint8:   (v, o) => v.getUint8(o),
  float32: (v, o) => v.getFloat32(o, true),
};

function layoutSize(layout) {
  let s = 0;
  for (const [, type] of layout) s += Sizes[type];
  return s;
}

function readStructArray(view, layout, offset, count) {
  const sz = layoutSize(layout);
  if (offset + sz * count > view.byteLength) return null;
  const results = [];
  let off = offset;
  for (let i = 0; i < count; i++) {
    const obj = {};
    for (const [name, type] of layout) {
      if (!name.startsWith('__')) obj[name] = Readers[type](view, off);
      off += Sizes[type];
    }
    results.push(obj);
  }
  return { data: results, newOffset: off };
}

//----------------------------------------------------------
//  Struct layouts
//----------------------------------------------------------
// Vertex: node(2) + pad(2) + xyz(12) = 16 bytes
const VertexLayout = [
  ['node', 'int16'], ['__p0', 'int16'],
  ['x', 'float32'], ['y', 'float32'], ['z', 'float32'],
];
// Normal: node(2) + pad(2) + nxyz(12) + bindVertex(2) + pad(2) = 20 bytes
const NormalLayout = [
  ['node', 'int16'], ['__p0', 'int16'],
  ['nx', 'float32'], ['ny', 'float32'], ['nz', 'float32'],
  ['bindVertex', 'int16'], ['__p1', 'int16'],
];
// TexCoord: uv = 8 bytes
const TexCoordLayout = [
  ['u', 'float32'], ['v', 'float32'],
];

//----------------------------------------------------------
//  Quaternion from Euler
//----------------------------------------------------------
function eulerToQuat(e) {
  const hx = e.x * 0.5, hy = e.y * 0.5, hz = e.z * 0.5;
  const sx = Math.sin(hx), cx = Math.cos(hx);
  const sy = Math.sin(hy), cy = Math.cos(hy);
  const sz = Math.sin(hz), cz = Math.cos(hz);
  const w = cx*cy*cz + sx*sy*sz;
  const x = sx*cy*cz - cx*sy*sz;
  const y = cx*sy*cz + sx*cy*sz;
  const z = cx*cy*sz - sx*sy*cz;
  const len = Math.sqrt(x*x + y*y + z*z + w*w) || 1;
  return { x: x/len, y: y/len, z: z/len, w: w/len };
}

//----------------------------------------------------------
//  BMDParser
//----------------------------------------------------------
class BMDParser {

  static readString(view, offset, length) {
    if (offset + length > view.byteLength) return '';
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    const zp = bytes.indexOf(0);
    return new TextDecoder('ascii').decode(zp !== -1 ? bytes.subarray(0, zp) : bytes);
  }

  /**
   * Parse a BMD buffer into a data structure.
   * Returns { version, name, meshes[], bones[], actions[] }
   */
  static parse(buffer) {
    const work = buffer.slice(0);
    const view = new DataView(work);

    const id = new TextDecoder('ascii').decode(work.slice(0, 3));
    if (id !== 'BMD') throw new Error('Invalid BMD header');

    const version = view.getUint8(3);

    let dataOffset = 4;
    if (version === 12 || version === 15) {
      const size = view.getInt32(4, true);
      const enc = new Uint8Array(work, 8, size);
      const dec = version === 12 ? decryptFileCryptor(enc) : leaDecrypt(enc);
      new Uint8Array(work, 8, size).set(dec);
      dataOffset = 8;
    }

    let off = dataOffset;
    const readS16 = () => { const v = view.getInt16(off, true); off += 2; return v; };
    const readU16 = () => { const v = view.getUint16(off, true); off += 2; return v; };
    const readF32 = () => { const v = view.getFloat32(off, true); off += 4; return v; };

    const name = this.readString(view, off, 32); off += 32;
    const meshCount = readU16();
    const boneCount = readU16();
    const actionCount = readU16();

    const bmd = { version, name, meshes: [], bones: [], actions: [] };

    // Meshes
    for (let m = 0; m < meshCount; m++) {
      const numVertices = readS16();
      const numNormals = readS16();
      const numTexCoords = readS16();
      const numTriangles = readS16();
      const textureIndex = readS16();

      const vRes = readStructArray(view, VertexLayout, off, numVertices);
      if (!vRes) continue;
      off = vRes.newOffset;
      const vertices = vRes.data.map(v => ({ node: v.node, position: { x: v.x, y: v.y, z: v.z } }));

      const nRes = readStructArray(view, NormalLayout, off, numNormals);
      if (!nRes) continue;
      off = nRes.newOffset;
      const normals = nRes.data.map(n => ({ node: n.node, normal: { x: n.nx, y: n.ny, z: n.nz }, bindVertex: n.bindVertex }));

      const tRes = readStructArray(view, TexCoordLayout, off, numTexCoords);
      if (!tRes) continue;
      off = tRes.newOffset;

      const triangles = [];
      for (let t = 0; t < numTriangles; t++) {
        const s = off;
        triangles.push({
          polygon: view.getUint8(s),
          vertexIndex:   [0,1,2,3].map(i => view.getInt16(s + 2 + i*2, true)),
          normalIndex:   [0,1,2,3].map(i => view.getInt16(s + 10 + i*2, true)),
          texCoordIndex: [0,1,2,3].map(i => view.getInt16(s + 18 + i*2, true)),
        });
        off += 64;
      }

      const texturePath = this.readString(view, off, 32); off += 32;

      bmd.meshes.push({
        texture: textureIndex,
        numVertices, numNormals, numTexCoords, numTriangles,
        vertices, normals, texCoords: tRes.data, triangles, texturePath
      });
    }

    // Actions
    for (let a = 0; a < actionCount; a++) {
      const numKeys = readS16();
      const lockPos = view.getUint8(off) > 0; off += 1;
      const action = { numAnimationKeys: numKeys, lockPositions: lockPos, positions: [] };
      if (lockPos) {
        for (let k = 0; k < numKeys; k++) {
          action.positions.push({ x: readF32(), y: readF32(), z: readF32() });
        }
      }
      bmd.actions.push(action);
    }

    // Bones
    for (let b = 0; b < boneCount; b++) {
      const isDummy = view.getUint8(off) > 0; off += 1;
      if (isDummy) {
        bmd.bones.push({ name: `dummy_${b}`, parent: -1, isDummy: true, matrixes: [] });
        continue;
      }

      const boneName = this.readString(view, off, 32); off += 32;
      const parent = readS16();
      const bone = { name: boneName, parent, isDummy: false, matrixes: [] };

      for (let a = 0; a < actionCount; a++) {
        const keys = bmd.actions[a].numAnimationKeys;
        if (keys === 0) {
          bone.matrixes.push({
            position: [{ x: 0, y: 0, z: 0 }],
            rotation: [{ x: 0, y: 0, z: 0 }],
            quaternion: [{ x: 0, y: 0, z: 0, w: 1 }]
          });
          continue;
        }

        const mat = { position: [], rotation: [], quaternion: [] };
        for (let k = 0; k < keys; k++) mat.position.push({ x: readF32(), y: readF32(), z: readF32() });
        for (let k = 0; k < keys; k++) mat.rotation.push({ x: readF32(), y: readF32(), z: readF32() });
        mat.rotation.forEach(r => mat.quaternion.push(eulerToQuat(r)));
        bone.matrixes.push(mat);
      }

      bmd.bones.push(bone);
    }

    return bmd;
  }

  /**
   * Extract geometry arrays from a BMD mesh for Three.js
   */
  static extractGeometry(mesh) {
    const positions = [], normals = [], uvs = [], skinIndices = [], skinWeights = [];

    const push = (vIdx, nIdx, tIdx) => {
      if (vIdx < 0 || vIdx >= mesh.vertices.length ||
          nIdx < 0 || nIdx >= mesh.normals.length ||
          tIdx < 0 || tIdx >= mesh.texCoords.length) return false;
      const v = mesh.vertices[vIdx];
      const n = mesh.normals[nIdx];
      const t = mesh.texCoords[tIdx];
      positions.push(v.position.x, v.position.y, v.position.z);
      normals.push(n.normal.x, n.normal.y, n.normal.z);
      uvs.push(t.u, t.v);
      skinIndices.push(v.node, 0, 0, 0);
      skinWeights.push(1, 0, 0, 0);
      return true;
    };

    for (const tri of mesh.triangles) {
      const v = tri.vertexIndex, n = tri.normalIndex, t = tri.texCoordIndex;
      push(v[0], n[0], t[0]);
      push(v[2], n[2], t[2]);
      push(v[1], n[1], t[1]);
      if (tri.polygon === 4) {
        push(v[0], n[0], t[0]);
        push(v[2], n[2], t[2]);
        push(v[3], n[3], t[3]);
      }
    }
    return { positions, normals, uvs, skinIndices, skinWeights };
  }

  /**
   * Build Three.js group with SkinnedMesh from parsed BMD data.
   * Requires THREE to be available globally or passed in.
   */
  static buildScene(bmd, THREE) {
    const group = new THREE.Group();
    group.name = bmd.name;

    // Build bones
    const bones = bmd.bones.map(b => {
      const bone = new THREE.Bone();
      bone.name = b.name;
      return bone;
    });

    const rootBones = [];
    bones.forEach((bone, i) => {
      const parentIdx = bmd.bones[i].parent;
      if (parentIdx >= 0 && parentIdx < bones.length) {
        bones[parentIdx].add(bone);
      } else {
        rootBones.push(bone);
      }
    });
    rootBones.forEach(rb => group.add(rb));

    const skeleton = new THREE.Skeleton(bones);

    const defaultMaterial = new THREE.MeshPhongMaterial({
      color: 0x8888aa,
      specular: 0x222233,
      shininess: 30,
      side: THREE.DoubleSide,
    });

    // Build meshes
    let totalVertices = 0;
    bmd.meshes.forEach((bmdMesh, idx) => {
      const { positions, normals, uvs, skinIndices, skinWeights } = this.extractGeometry(bmdMesh);
      if (positions.length === 0) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

      const mesh = new THREE.SkinnedMesh(geometry, defaultMaterial);
      mesh.name = `mesh_${idx}`;
      mesh.bind(skeleton);
      group.add(mesh);

      totalVertices += positions.length / 3;
    });

    // Apply bind pose
    bmd.bones.forEach((bmdBone, i) => {
      if (bmdBone.isDummy || !bmdBone.matrixes || !bmdBone.matrixes.length) return;
      const bind = bmdBone.matrixes[0];
      const p = bind.position[0] || { x: 0, y: 0, z: 0 };
      const q = bind.quaternion[0] || { x: 0, y: 0, z: 0, w: 1 };
      bones[i].position.set(p.x, p.y, p.z);
      bones[i].quaternion.set(q.x, q.y, q.z, q.w);
    });

    // Build animations
    const animations = [];
    const FPS = 24;
    for (let a = 0; a < bmd.actions.length; a++) {
      const action = bmd.actions[a];
      if (action.numAnimationKeys <= 1) continue;
      const duration = (action.numAnimationKeys - 1) / FPS;
      const tracks = [];

      for (let b = 0; b < bmd.bones.length; b++) {
        const bmdBone = bmd.bones[b];
        if (bmdBone.isDummy || !bmdBone.matrixes[a]) continue;
        const matrix = bmdBone.matrixes[a];
        const times = [], pos = [], quats = [];
        for (let k = 0; k < action.numAnimationKeys; k++) {
          times.push(k / FPS);
          const p = matrix.position[k];
          const q = matrix.quaternion[k];
          pos.push(p.x, p.y, p.z);
          quats.push(q.x, q.y, q.z, q.w);
        }
        tracks.push(new THREE.VectorKeyframeTrack(`${bones[b].name}.position`, times, pos));
        tracks.push(new THREE.QuaternionKeyframeTrack(`${bones[b].name}.quaternion`, times, quats));
      }

      if (tracks.length) {
        animations.push(new THREE.AnimationClip(`action_${a}`, duration, tracks));
      }
    }
    group.animations = animations;

    // Rotate to standard orientation
    group.rotation.x = -Math.PI / 2;

    return {
      group,
      stats: {
        meshes: bmd.meshes.length,
        vertices: totalVertices,
        bones: bmd.bones.filter(b => !b.isDummy).length,
        animations: animations.length,
      }
    };
  }
}
