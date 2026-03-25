import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const grid = document.getElementById('file-grid');
const modal = document.getElementById('modal');
const viewport = document.getElementById('fbx-viewport');
const modalInfo = document.getElementById('modal-info');
const modalClose = document.getElementById('modal-close');
const modalFilename = document.getElementById('modal-filename');

let renderer, scene, camera, controls, animationId, mixer;

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);

  camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 10000);
  camera.position.set(0, 100, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewport.innerHTML = '';
  viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(200, 300, 200);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x7fbbff, 0.3);
  dirLight2.position.set(-200, 100, -200);
  scene.add(dirLight2);

  const gridHelper = new THREE.GridHelper(500, 50, 0x2a3a5c, 0x1a1a2e);
  scene.add(gridHelper);

  mixer = null;
}

const clock = new THREE.Clock();

function animate() {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
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
  if (maxDim === 0) return;

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

async function loadBMD(filePath) {
  viewport.innerHTML = '<div class="fbx-loading">Loading model...</div>';

  initThree();

  try {
    const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const bmd = BMDParser.parse(buffer);
    const result = BMDParser.buildScene(bmd, THREE);

    scene.add(result.group);
    fitCameraToObject(result.group);

    // Play first animation if available
    if (result.group.animations.length > 0) {
      mixer = new THREE.AnimationMixer(result.group);
      const action = mixer.clipAction(result.group.animations[0]);
      action.play();
    }

    animate();

    const stats = result.stats;
    modalInfo.innerHTML = `
      <span>Meshes: ${stats.meshes}</span>
      <span>Vertices: ${stats.vertices.toLocaleString()}</span>
      <span>Bones: ${stats.bones}</span>
      <span>Animations: ${stats.animations}</span>
    `;
  } catch (error) {
    viewport.innerHTML = `<div class="fbx-loading fbx-error-msg">Error loading: ${error.message}</div>`;
    console.error('BMD load error:', error);
  }
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
    const card = e.target.closest('.bmd-card');
    if (!card) return;

    const filePath = card.dataset.file;
    modalFilename.textContent = filePath;
    modalInfo.innerHTML = `<span>${formatSize(parseInt(card.dataset.size))}</span>`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    loadBMD(filePath);
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
