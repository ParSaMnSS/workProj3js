import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/Addons.js';

// -- Create sliders (unchanged)
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

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// -- Cursor Trail Setup (Shader-based) --
const clock = new THREE.Clock();
let mouse2D = { x: 0, y: 0 };
let mousePositionsBuffer = [];
let trailPoints = [];
let trailGeometry = new THREE.BufferGeometry();
let trailLine = null;

document.addEventListener('mousemove', (event) => {
  // Update current mouse coordinates
  mouse2D.x = event.clientX;
  mouse2D.y = event.clientY;

  // Convert mouse coords to normalized device coordinates (NDC)
  const mouse = new THREE.Vector2(
    (mouse2D.x / window.innerWidth) * 2 - 1,
    -(mouse2D.y / window.innerHeight) * 2 + 1
  );

  // Unproject to 3D world space
  const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));

  // Push the new position and current time into the buffer
  mousePositionsBuffer.push({
    position: pos.clone(),
    time: clock.getElapsedTime()
  });
}, false);

// Trail Shader Material – note that we use an attribute "alpha" to fade out the trail
const trailMaterial = new THREE.ShaderMaterial({
  vertexShader: `
    attribute float alpha;
    varying float vAlpha;
    void main() {
      vAlpha = alpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 0.0, vAlpha);
    }
  `,
  transparent: true,
  linewidth: 2
});

// -- Lighting and Object Setup --

// Directional Light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
scene.add(directionalLight);

// Ambient Light
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Cube with different materials for each face (hover effect will change these colors)
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

const defaultColor = 0x00ff00;
const hoverColor = 0xff0000;
const materials = [
  new THREE.MeshStandardMaterial({ color: defaultColor }), // +X
  new THREE.MeshStandardMaterial({ color: defaultColor }), // -X
  new THREE.MeshStandardMaterial({ color: defaultColor }), // +Y
  new THREE.MeshStandardMaterial({ color: defaultColor }), // -Y
  new THREE.MeshStandardMaterial({ color: defaultColor }), // +Z
  new THREE.MeshStandardMaterial({ color: defaultColor }), // -Z
];

const cube = new THREE.Mesh(boxGeometry, materials);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

// Add a wireframe to the cube for extra detail
const wireframe = new THREE.WireframeGeometry(boxGeometry);
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
const lineSegments = new THREE.LineSegments(wireframe, lineMaterial);
cube.add(lineSegments);

// Ground Plane
const planeGeometry = new THREE.PlaneGeometry(10, 10);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1.5;
plane.receiveShadow = true;
scene.add(plane);

// -- Slider Event Listeners --
let rotationSpeed = 0.001;
rotationSlider.addEventListener('input', (e) => {
  rotationSpeed = parseFloat(e.target.value);
});

zoomSlider.addEventListener('input', (e) => {
  camera.zoom = parseFloat(e.target.value);
  camera.updateProjectionMatrix();
});

// -- Camera Smoothing and Mouse Edge Offset --
const smoothing = 0.1;
const edgeThreshold = 0.1;
const maxOffset = 0.3;
let targetOffsetX = 0;
let targetOffsetY = 0;
const originalCameraPosition = new THREE.Vector3(0, 0, 4);

const raycaster = new THREE.Raycaster();
const rayMouse = new THREE.Vector2();
let currentHoveredIndex = -1;

// Update target offsets and rayMouse for hover detection
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

  rayMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  rayMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('mouseleave', () => {
  targetOffsetX = 0;
  targetOffsetY = 0;
});

// -- Hover Detection on Cube Faces --
function getMaterialIndexFromFaceIndex(geometry, faceIndex) {
  const indexPos = faceIndex * 3;
  for (let i = 0; i < geometry.groups.length; i++) {
    const group = geometry.groups[i];
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
    const faceIndex = intersect.faceIndex;
    const materialIndex = getMaterialIndexFromFaceIndex(boxGeometry, faceIndex);

    if (materialIndex !== null && materialIndex !== currentHoveredIndex) {
      // Reset previous hover
      if (currentHoveredIndex !== -1) {
        cube.material[currentHoveredIndex].color.set(defaultColor);
      }
      currentHoveredIndex = materialIndex;
      cube.material[materialIndex].color.set(hoverColor);
    }
  } else {
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
  cube.rotation.z += rotationSpeed;

  // Smoothly update camera position based on mouse edge offsets
  const targetX = originalCameraPosition.x + targetOffsetX;
  const targetY = originalCameraPosition.y + targetOffsetY;
  camera.position.x += (targetX - camera.position.x) * smoothing;
  camera.position.y += (targetY - camera.position.y) * smoothing;

  // --- Update Cursor Trail (Shader-based) ---
  const elapsedTime = clock.getElapsedTime();
  const fadeDuration = 1.0; // seconds until fully faded

  // Interpolate between buffered mouse positions for a smoother trail
  if (mousePositionsBuffer.length >= 2) {
    for (let i = 0; i < mousePositionsBuffer.length - 1; i++) {
      const p1 = mousePositionsBuffer[i];
      const p2 = mousePositionsBuffer[i + 1];
      const distance = p1.position.distanceTo(p2.position);
      const stepSize = 0.02; // adjust for density
      const numSteps = Math.ceil(distance / stepSize);

      for (let j = 0; j <= numSteps; j++) {
        const t = j / numSteps;
        const interpolatedPos = p1.position.clone().lerp(p2.position, t);
        const interpolatedTime = p1.time + t * (p2.time - p1.time);
        trailPoints.push({ position: interpolatedPos, time: interpolatedTime });
      }
    }
    // Keep the last point for the next interpolation step
    mousePositionsBuffer = [mousePositionsBuffer.pop()];
  }

  // Remove points that have faded out
  while (trailPoints.length > 0 && elapsedTime - trailPoints[0].time > fadeDuration) {
    trailPoints.shift();
  }

  // Update (or create) the trail geometry if we have enough points
  if (trailPoints.length >= 2) {
    const positions = new Float32Array(trailPoints.length * 3);
    const alphas = new Float32Array(trailPoints.length);

    trailPoints.forEach((p, i) => {
      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
      alphas[i] = 1.0 - (elapsedTime - p.time) / fadeDuration;
    });

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    trailGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    trailGeometry.attributes.position.needsUpdate = true;
    trailGeometry.attributes.alpha.needsUpdate = true;

    if (!trailLine) {
      trailLine = new THREE.Line(trailGeometry, trailMaterial);
      scene.add(trailLine);
    }
  } else if (trailLine) {
    scene.remove(trailLine);
    trailLine = null;
  }

  updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
