import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const grid = document.getElementById('file-grid');
const modal = document.getElementById('modal');
const viewport = document.getElementById('fbx-viewport');
const modalInfo = document.getElementById('modal-info');
const modalClose = document.getElementById('modal-close');
const modalFilename = document.getElementById('modal-filename');

let renderer, scene, camera, controls, animationId;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);

  camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 10000);
  camera.position.set(0, 100, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.innerHTML = '';
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(200, 300, 200);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x7fbbff, 0.4);
  dirLight2.position.set(-200, 100, -200);
  scene.add(dirLight2);

  // Grid helper
  const gridHelper = new THREE.GridHelper(500, 50, 0x2a3a5c, 0x1a1a2e);
  scene.add(gridHelper);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraZ = maxDim / (2 * Math.tan(fov / 2));
  cameraZ *= 1.5;

  camera.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.3, center.z + cameraZ);
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

function loadGLB(filePath) {
  const loader = new GLTFLoader();
  const url = 'serve_file.php?file=' + encodeURIComponent(filePath);

  viewport.innerHTML = '<div class="fbx-loading">Loading model...</div>';

  initThree();

  loader.load(
    url,
    (gltf) => {
      const object = gltf.scene;

      let meshCount = 0;
      let vertexCount = 0;
      let materialCount = new Set();

      object.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          vertexCount += child.geometry.attributes.position?.count || 0;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => materialCount.add(m.name || m.uuid));
            } else {
              materialCount.add(child.material.name || child.material.uuid);
            }
          }
        }
      });

      scene.add(object);
      fitCameraToObject(object);
      animate();

      modalInfo.innerHTML = `
        <span>Meshes: ${meshCount}</span>
        <span>Vertices: ${vertexCount.toLocaleString()}</span>
        <span>Materials: ${materialCount.size}</span>
      `;
    },
    (progress) => {
      if (progress.total) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        const loadingEl = viewport.querySelector('.fbx-loading');
        if (loadingEl) loadingEl.textContent = `Loading... ${pct}%`;
      }
    },
    (error) => {
      viewport.innerHTML = `<div class="fbx-loading fbx-error-msg">Error loading: ${error.message}</div>`;
      console.error('GLB load error:', error);
    }
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function closeModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
  stopAnimation();
}

if (grid) {
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.glb-card');
    if (!card) return;

    const filePath = card.dataset.file;
    modalFilename.textContent = filePath;
    modalInfo.innerHTML = `<span>${formatSize(parseInt(card.dataset.size))}</span>`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    loadGLB(filePath);
  });
}

modalClose?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

window.addEventListener('resize', () => {
  if (renderer && camera && viewport) {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  }
});

initGroupToggle('file-grid', '.glb-card');
initSelection('file-grid', '.glb-card');
