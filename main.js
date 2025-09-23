import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1326);
scene.fog = new THREE.Fog(0x0c1326, 40, 120);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 8, 14);

const ambient = new THREE.AmbientLight(0x6f7bff, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xf0f7ff, 1.1);
sun.position.set(12, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const hemisphere = new THREE.HemisphereLight(0x4a7dff, 0x0a1a26, 0.35);
scene.add(hemisphere);

const groundGeometry = new THREE.PlaneGeometry(48, 48);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x123249,
  roughness: 0.8,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.receiveShadow = true;
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const arenaBorder = new THREE.GridHelper(48, 24, 0x5176ff, 0x1b2a4d);
arenaBorder.position.y = 0.01;
scene.add(arenaBorder);

const WORLD_HALF = 20;

const playerGeometry = new THREE.BoxGeometry(1, 1.25, 1);
const playerMaterial = new THREE.MeshStandardMaterial({
  color: 0x73d1ff,
  emissive: 0x162a52,
  metalness: 0.25,
  roughness: 0.3,
});
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.castShadow = true;
player.position.y = 0.62;
scene.add(player);

const orbitRingGeometry = new THREE.TorusGeometry(0.8, 0.05, 16, 64);
const orbitRingMaterial = new THREE.MeshBasicMaterial({
  color: 0x9fe0ff,
  transparent: true,
  opacity: 0.35,
});
const orbitRing = new THREE.Mesh(orbitRingGeometry, orbitRingMaterial);
player.add(orbitRing);

const skyParticles = (() => {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 600;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const radius = 60 + Math.random() * 120;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius * 0.5 + 20;
    positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
  }
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  const starMaterial = new THREE.PointsMaterial({
    color: 0x86b3ff,
    size: 1.2,
    sizeAttenuation: true,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
  return stars;
})();

const clock = new THREE.Clock();

const CONTROL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "KeyZ",
]);

const keys = {};
window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (CONTROL_KEYS.has(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Enter" && gameOver) {
    resetGame();
  }
});
window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
  if (CONTROL_KEYS.has(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const scoreElement = document.getElementById("score");
const timeElement = document.getElementById("time");
const statusElement = document.getElementById("status");

let coins = [];
const targetScore = 20;
let score = 0;
let timeRemaining = 60;
let gameOver = false;
let verticalVelocity = 0;
const GRAVITY = -22;
const JUMP_VELOCITY = 9.5;
const MOVE_SPEED = 8.5;

function randomPosition() {
  return (Math.random() * 2 - 1) * (WORLD_HALF - 2);
}

function createCoin() {
  const geometry = new THREE.IcosahedronGeometry(0.45, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffe176,
    emissive: 0x332b05,
    emissiveIntensity: 1.6,
    metalness: 0.7,
    roughness: 0.2,
  });
  const coin = new THREE.Mesh(geometry, material);
  coin.castShadow = true;
  coin.position.set(randomPosition(), 0.6 + Math.random() * 2.5, randomPosition());
  coin.userData.floatOffset = Math.random() * Math.PI * 2;
  scene.add(coin);
  coins.push(coin);
}

function spawnInitialCoins() {
  for (let i = 0; i < 14; i++) {
    createCoin();
  }
}

function clearCoins() {
  coins.forEach((coin) => scene.remove(coin));
  coins = [];
}

function resetGame() {
  score = 0;
  timeRemaining = 60;
  gameOver = false;
  verticalVelocity = 0;
  player.position.set(0, 0.62, 0);
  statusElement.textContent = "";
  statusElement.classList.add("hidden");
  statusElement.classList.remove("win", "lose");
  clearCoins();
  spawnInitialCoins();
  updateUI();
  clock.start();
}

function updateUI() {
  scoreElement.textContent = score.toString();
  timeElement.textContent = Math.ceil(timeRemaining).toString();
}

function updatePlayer(delta) {
  const direction = new THREE.Vector3();
  if (keys["ArrowUp"] || keys["KeyW"]) direction.z -= 1;
  if (keys["ArrowDown"] || keys["KeyS"]) direction.z += 1;
  if (keys["ArrowLeft"] || keys["KeyA"]) direction.x -= 1;
  if (keys["ArrowRight"] || keys["KeyD"]) direction.x += 1;

  if (direction.lengthSq() > 0) {
    direction.normalize();
    player.position.x += direction.x * MOVE_SPEED * delta;
    player.position.z += direction.z * MOVE_SPEED * delta;
    const angle = Math.atan2(direction.x, direction.z);
    player.rotation.y = angle;
  }

  player.position.x = THREE.MathUtils.clamp(
    player.position.x,
    -WORLD_HALF + 1,
    WORLD_HALF - 1
  );
  player.position.z = THREE.MathUtils.clamp(
    player.position.z,
    -WORLD_HALF + 1,
    WORLD_HALF - 1
  );

  const isGrounded = player.position.y <= 0.62 + 0.001;
  if ((keys["Space"] || keys["KeyZ"]) && isGrounded) {
    verticalVelocity = JUMP_VELOCITY;
  }

  verticalVelocity += GRAVITY * delta;
  player.position.y += verticalVelocity * delta;

  if (player.position.y <= 0.62) {
    player.position.y = 0.62;
    verticalVelocity = 0;
  }
}

function animateCoins(elapsedTime, delta) {
  coins.forEach((coin) => {
    coin.rotation.y += delta * 1.5;
    coin.position.y =
      1.3 + Math.sin(elapsedTime * 2 + coin.userData.floatOffset) * 0.75;
  });
}

function checkCollisions() {
  coins = coins.filter((coin) => {
    const distance = player.position.distanceTo(coin.position);
    if (distance < 0.9) {
      scene.remove(coin);
      score += 1;
      updateUI();
      return false;
    }
    return true;
  });

  if (coins.length < 12) {
    createCoin();
  }
}

function updateCamera() {
  const targetPosition = new THREE.Vector3(
    player.position.x,
    player.position.y + 5,
    player.position.z + 9
  );
  camera.position.lerp(targetPosition, 0.1);
  camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
}

function updateTimer(delta) {
  if (gameOver) return;
  timeRemaining -= delta;
  if (timeRemaining <= 0) {
    timeRemaining = 0;
    finishGame();
  }
  updateUI();
}

function finishGame() {
  gameOver = true;
  const isWin = score >= targetScore;
  statusElement.textContent = isWin
    ? `クリア！${score} 個のオーブを集めました！`
    : `時間切れ… ${targetScore} 個以上集めてクリアしよう！`;
  statusElement.classList.remove("hidden");
  statusElement.classList.toggle("win", isWin);
  statusElement.classList.toggle("lose", !isWin);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (!gameOver) {
    updatePlayer(delta);
    checkCollisions();
    updateTimer(delta);
  }
  animateCoins(elapsed, delta);
  updateCamera();
  orbitRing.rotation.z += delta * 1.5;
  skyParticles.rotation.y += delta * 0.05;
  renderer.render(scene, camera);
}

spawnInitialCoins();
updateUI();
clock.start();
animate();
