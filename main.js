import * as THREE from 'three';

// -- Create sliders
const rotationSlider = document.createElement('input');
rotationSlider.type = 'range';
rotationSlider.min = '0.001';
rotationSlider.max = '0.08';
rotationSlider.step = '0.001';
rotationSlider.value = '0.01';
rotationSlider.style.position = 'fixed';
rotationSlider.style.top = '40px';
rotationSlider.style.right = '20px';
rotationSlider.style.zIndex = '100';
rotationSlider.style.width = '200px';
document.body.appendChild(rotationSlider);

const zoomSlider = document.createElement('input');
zoomSlider.type = 'range';
zoomSlider.min = '0.05';
zoomSlider.max = '5';
zoomSlider.step = '0.01';
zoomSlider.value = '1';
zoomSlider.style.position = 'fixed';
zoomSlider.style.top = '20px';
zoomSlider.style.right = '20px';
zoomSlider.style.zIndex = '100';
zoomSlider.style.width = '200px';
document.body.appendChild(zoomSlider);

// -- Basic Three.js setup --
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x808080);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -- Create BoxGeometry with multiple materials --
const geometry = new THREE.BoxGeometry(1, 1, 1); 
// By default, BoxGeometry will create 6 "groups", each assigned a unique material index.

const defaultColor = 0x00ff00;
const hoverColor = 0xff0000;
const materials = [
  new THREE.MeshBasicMaterial({ color: defaultColor }), // +X side
  new THREE.MeshBasicMaterial({ color: defaultColor }), // -X side
  new THREE.MeshBasicMaterial({ color: defaultColor }), // +Y side
  new THREE.MeshBasicMaterial({ color: defaultColor }), // -Y side
  new THREE.MeshBasicMaterial({ color: defaultColor }), // +Z side
  new THREE.MeshBasicMaterial({ color: defaultColor }), // -Z side
];

const cube = new THREE.Mesh(geometry, materials);
scene.add(cube);

// Optional wireframe
const wireframe = new THREE.WireframeGeometry(geometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
const lineSegments = new THREE.LineSegments(wireframe, lineMaterial);
cube.add(lineSegments);

// -- Sliders & Animation Control --
let rotationSpeed = 0.001;

rotationSlider.addEventListener('input', (e) => {
  rotationSpeed = parseFloat(e.target.value);
});

zoomSlider.addEventListener('input', (e) => {
  camera.zoom = parseFloat(e.target.value);
  camera.updateProjectionMatrix();
});

// -- Camera Movement with Mouse Edges --
const smoothing = 0.1;
const edgeThreshold = 0.1;
const maxOffset = 0.3;
let targetOffsetX = 0;
let targetOffsetY = 0;
const originalCameraPosition = new THREE.Vector3(0, 0, 4);

document.addEventListener('mousemove', (event) => {
  const mouseX = event.clientX / window.innerWidth;
  const mouseY = event.clientY / window.innerHeight;

  targetOffsetX = 0;
  targetOffsetY = 0;

  if (mouseX < edgeThreshold) {
    const strength = (edgeThreshold - mouseX) / edgeThreshold;
    targetOffsetX = -strength * maxOffset;
  } else if (mouseX > 1 - edgeThreshold) {
    const strength = (mouseX - (1 - edgeThreshold)) / edgeThreshold;
    targetOffsetX = strength * maxOffset;
  }

  if (mouseY < edgeThreshold) {
    const strength = (edgeThreshold - mouseY) / edgeThreshold;
    targetOffsetY = strength * maxOffset;
  } else if (mouseY > 1 - edgeThreshold) {
    const strength = (mouseY - (1 - edgeThreshold)) / edgeThreshold;
    targetOffsetY = -strength * maxOffset;
  }

  // For hover detection
  rayMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  rayMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('mouseleave', () => {
  targetOffsetX = 0;
  targetOffsetY = 0;
});

// -- Hover Detection with Raycaster --
const raycaster = new THREE.Raycaster();
const rayMouse = new THREE.Vector2();
let currentHoveredIndex = -1;

// This function finds which group the faceIndex belongs to, so we know which material index was hit.
function getMaterialIndexFromFaceIndex(geometry, faceIndex) {
  // Each 'face' is actually a triangle in the index buffer
  const indexPos = faceIndex * 3; // 3 vertices per triangle
  for (let i = 0; i < geometry.groups.length; i++) {
    const group = geometry.groups[i];
    // group.start is the starting index in the index buffer
    // group.count is how many indices belong to this group
    if (indexPos >= group.start && indexPos < group.start + group.count) {
      return group.materialIndex;
    }
  }
  return null;
}

function updateHover() {
  raycaster.setFromCamera(rayMouse, camera);
  const intersects = raycaster.intersectObject(cube);

  if (intersects.length > 0) {
    const intersect = intersects[0];
    const faceIndex = intersect.faceIndex; // The index of the triangle
    const materialIndex = getMaterialIndexFromFaceIndex(geometry, faceIndex);

    if (materialIndex !== null && materialIndex !== currentHoveredIndex) {
      // Reset the previously hovered face color
      if (currentHoveredIndex !== -1) {
        cube.material[currentHoveredIndex].color.set(defaultColor);
      }
      // Color the new hovered face
      currentHoveredIndex = materialIndex;
      cube.material[materialIndex].color.set(hoverColor);
    }
  } else {
    // Not hovering any face - reset
    if (currentHoveredIndex !== -1) {
      cube.material[currentHoveredIndex].color.set(defaultColor);
      currentHoveredIndex = -1;
    }
  }
}

// -- Animation Loop --
function animate() {
  // Rotate the cube
  cube.rotation.x += rotationSpeed;
  cube.rotation.y += rotationSpeed;

  
  // Smooth camera movement
  const targetX = originalCameraPosition.x + targetOffsetX;
  const targetY = originalCameraPosition.y + targetOffsetY;
  camera.position.x += (targetX - camera.position.x) * smoothing;
  camera.position.y += (targetY - camera.position.y) * smoothing;
  // Hover check
  updateHover();
  
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// -- Handle window resize --
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
