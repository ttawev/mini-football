import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const canvas = document.querySelector("#gameCanvas");
const scoreText = document.querySelector("#scoreText");
const timerText = document.querySelector("#timerText");
const statusText = document.querySelector("#statusText");
const stick = document.querySelector("#stick");
const stickKnob = document.querySelector("#stickKnob");
const kickButton = document.querySelector("#kickButton");
const switchButton = document.querySelector("#switchButton");

const FIELD = { width: 30, length: 46, goalWidth: 8, goalDepth: 2.8 };
const TEAM_HOME = "home";
const TEAM_AWAY = "away";
const PLAYER_RADIUS = 0.62;
const BALL_RADIUS = 0.34;
const MATCH_SECONDS = 120;
const CAMERA_Y = 36;
const CAMERA_Z = -28;
const CAMERA_X = 0;

const keys = new Set();
const input = { x: 0, y: 0, kick: false };
const keyboardInput = { x: 0, y: 0 };
const stickInput = { x: 0, y: 0 };
const score = { home: 0, away: 0 };
let selectedIndex = 2;
let matchClock = MATCH_SECONDS;
let lastTimestamp = performance.now();
let statusTimer = 2;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x90bed6);
scene.fog = new THREE.Fog(0x90bed6, 46, 82);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.up.set(0, 1, 0);
camera.position.set(CAMERA_X, CAMERA_Y, CAMERA_Z);
camera.lookAt(0, 0, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0x476b5a, 2.3);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 2.7);
sun.position.set(-14, 28, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -36;
sun.shadow.camera.right = 36;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
scene.add(sun);

const materials = {
  turf: new THREE.MeshStandardMaterial({ color: 0x339c58, roughness: 0.9 }),
  turfAlt: new THREE.MeshStandardMaterial({ color: 0x2b8d4f, roughness: 0.95 }),
  line: new THREE.MeshBasicMaterial({ color: 0xf4f7ee }),
  home: new THREE.MeshStandardMaterial({ color: 0x1d9fff, roughness: 0.5 }),
  away: new THREE.MeshStandardMaterial({ color: 0xff4f53, roughness: 0.5 }),
  keeperHome: new THREE.MeshStandardMaterial({ color: 0x19d4b2, roughness: 0.48 }),
  keeperAway: new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.48 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xffd1a1, roughness: 0.55 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xf9faf8, roughness: 0.42 }),
  goal: new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.35 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x07110d, transparent: true, opacity: 0.18 }),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeVec(x = 0, z = 0) {
  return new THREE.Vector2(x, z);
}

function addBox(width, height, depth, colorMaterial, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), colorMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addFieldBox(width, height, depth, colorMaterial, x, y, z) {
  return addBox(depth, height, width, colorMaterial, z, y, x);
}

function createField() {
  for (let i = 0; i < 8; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(FIELD.length / 8, 0.12, FIELD.width),
      i % 2 === 0 ? materials.turf : materials.turfAlt,
    );
    stripe.position.x = -FIELD.length / 2 + FIELD.length / 16 + (FIELD.length / 8) * i;
    stripe.receiveShadow = true;
    scene.add(stripe);
  }

  addFieldBox(FIELD.width, 0.08, 0.12, materials.line, 0, 0.09, 0);
  addFieldBox(0.12, 0.08, FIELD.length, materials.line, -FIELD.width / 2, 0.1, 0);
  addFieldBox(0.12, 0.08, FIELD.length, materials.line, FIELD.width / 2, 0.1, 0);
  addFieldBox(FIELD.width, 0.08, 0.12, materials.line, 0, 0.1, -FIELD.length / 2);
  addFieldBox(FIELD.width, 0.08, 0.12, materials.line, 0, 0.1, FIELD.length / 2);

  const circle = new THREE.Mesh(
    new THREE.RingGeometry(3.8, 3.92, 80).rotateX(-Math.PI / 2),
    materials.line,
  );
  circle.position.y = 0.13;
  scene.add(circle);

  addFieldBox(6, 0.08, 0.12, materials.line, -FIELD.width / 2 + 3, 0.13, -FIELD.length / 2 + 7);
  addFieldBox(6, 0.08, 0.12, materials.line, FIELD.width / 2 - 3, 0.13, -FIELD.length / 2 + 7);
  addFieldBox(6, 0.08, 0.12, materials.line, -FIELD.width / 2 + 3, 0.13, FIELD.length / 2 - 7);
  addFieldBox(6, 0.08, 0.12, materials.line, FIELD.width / 2 - 3, 0.13, FIELD.length / 2 - 7);
  addFieldBox(0.12, 0.08, 14, materials.line, -FIELD.width / 2 + 6, 0.13, -FIELD.length / 2 + 7);
  addFieldBox(0.12, 0.08, 14, materials.line, FIELD.width / 2 - 6, 0.13, -FIELD.length / 2 + 7);
  addFieldBox(0.12, 0.08, 14, materials.line, -FIELD.width / 2 + 6, 0.13, FIELD.length / 2 - 7);
  addFieldBox(0.12, 0.08, 14, materials.line, FIELD.width / 2 - 6, 0.13, FIELD.length / 2 - 7);

  createGoal(0, -FIELD.length / 2 - FIELD.goalDepth / 2, 1);
  createGoal(0, FIELD.length / 2 + FIELD.goalDepth / 2, -1);

  const outside = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD.length + 14, 0.05, FIELD.width + 10),
    new THREE.MeshStandardMaterial({ color: 0x243641, roughness: 0.85 }),
  );
  outside.position.y = -0.08;
  outside.receiveShadow = true;
  scene.add(outside);
}

function createGoal(x, z, direction) {
  const backZ = z + direction * FIELD.goalDepth / 2;
  addFieldBox(FIELD.goalWidth, 1.2, 0.14, materials.goal, x, 0.7, backZ);
  addFieldBox(0.14, 1.2, FIELD.goalDepth, materials.goal, -FIELD.goalWidth / 2, 0.7, z);
  addFieldBox(0.14, 1.2, FIELD.goalDepth, materials.goal, FIELD.goalWidth / 2, 0.7, z);
  addFieldBox(FIELD.goalWidth, 0.14, FIELD.goalDepth, materials.goal, x, 1.35, z);
}

function createPlayerMesh(team, isKeeper) {
  const group = new THREE.Group();
  const bodyMat =
    team === TEAM_HOME ? (isKeeper ? materials.keeperHome : materials.home) : isKeeper ? materials.keeperAway : materials.away;

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.74, 28).rotateX(-Math.PI / 2), materials.shadow);
  shadow.position.y = 0.13;
  group.add(shadow);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 5, 12), bodyMat);
  body.position.y = 0.86;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), materials.skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  marker.rotation.x = Math.PI / 2;
  marker.position.y = 0.18;
  marker.visible = false;
  group.add(marker);
  group.marker = marker;

  scene.add(group);
  return group;
}

function createBallMesh() {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 18), materials.ball);
  ball.position.y = BALL_RADIUS;
  ball.castShadow = true;
  group.add(ball);

  const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_RADIUS * 0.9, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: 0x10151b }));
  seam.position.y = BALL_RADIUS;
  seam.rotation.x = Math.PI / 2;
  group.add(seam);
  scene.add(group);
  return group;
}

createField();

const players = [
  { team: TEAM_HOME, role: "keeper", home: makeVec(0, -19.8), pos: makeVec(0, -19.8), vel: makeVec(), speed: 9, mesh: createPlayerMesh(TEAM_HOME, true) },
  { team: TEAM_HOME, role: "defender", home: makeVec(-6, -8), pos: makeVec(-6, -8), vel: makeVec(), speed: 10, mesh: createPlayerMesh(TEAM_HOME) },
  { team: TEAM_HOME, role: "mid", home: makeVec(5, -2), pos: makeVec(5, -2), vel: makeVec(), speed: 10.5, mesh: createPlayerMesh(TEAM_HOME) },
  { team: TEAM_HOME, role: "forward", home: makeVec(0, 8), pos: makeVec(0, 8), vel: makeVec(), speed: 10.8, mesh: createPlayerMesh(TEAM_HOME) },
  { team: TEAM_AWAY, role: "keeper", home: makeVec(0, 19.8), pos: makeVec(0, 19.8), vel: makeVec(), speed: 9, mesh: createPlayerMesh(TEAM_AWAY, true) },
  { team: TEAM_AWAY, role: "defender", home: makeVec(6, 8), pos: makeVec(6, 8), vel: makeVec(), speed: 9.8, mesh: createPlayerMesh(TEAM_AWAY) },
  { team: TEAM_AWAY, role: "mid", home: makeVec(-5, 2), pos: makeVec(-5, 2), vel: makeVec(), speed: 10, mesh: createPlayerMesh(TEAM_AWAY) },
  { team: TEAM_AWAY, role: "forward", home: makeVec(0, -8), pos: makeVec(0, -8), vel: makeVec(), speed: 10.3, mesh: createPlayerMesh(TEAM_AWAY) },
];

players.forEach((player, index) => {
  player.aiSeed = index * 1.71;
  player.touchCooldown = 0;
  player.facing = makeVec(0, player.team === TEAM_HOME ? 1 : -1);
});

const ball = {
  pos: makeVec(0, 0),
  vel: makeVec(0, 0),
  ownerIndex: null,
  lastOwnerIndex: null,
  releaseCooldown: 0,
  mesh: createBallMesh(),
};

function setStatus(text, seconds = 2) {
  statusText.textContent = text;
  statusTimer = seconds;
}

function resetPositions(scoredBy = null) {
  players.forEach((player) => {
    player.pos.copy(player.home);
    player.vel.set(0, 0);
    player.facing.set(0, player.team === TEAM_HOME ? 1 : -1);
    player.touchCooldown = 0;
  });
  ball.ownerIndex = null;
  ball.lastOwnerIndex = null;
  ball.releaseCooldown = 0;
  ball.pos.set(0, 0);
  ball.vel.set(0, scoredBy === TEAM_HOME ? -4 : scoredBy === TEAM_AWAY ? 4 : 0);
}

function updateInputFromKeys() {
  let screenX = 0;
  let screenY = 0;
  if (keys.has("arrowleft") || keys.has("a")) screenX -= 1;
  if (keys.has("arrowright") || keys.has("d")) screenX += 1;
  if (keys.has("arrowup") || keys.has("w")) screenY += 1;
  if (keys.has("arrowdown") || keys.has("s")) screenY -= 1;
  if (screenX || screenY) {
    const length = Math.hypot(screenX, screenY);
    keyboardInput.x = screenX / length;
    keyboardInput.y = screenY / length;
  } else {
    keyboardInput.x = 0;
    keyboardInput.y = 0;
  }

  const useKeyboard = Math.hypot(keyboardInput.x, keyboardInput.y) > 0;
  const source = useKeyboard ? keyboardInput : stickInput;
  input.x = source.y;
  input.y = source.x;
}

function updateSelectedPlayer() {
  players.forEach((player) => {
    player.mesh.marker.visible = false;
  });
  players[selectedIndex].mesh.marker.visible = true;
}

function switchPlayer() {
  let bestIndex = selectedIndex;
  let bestDistance = Infinity;
  players.forEach((player, index) => {
    if (player.team !== TEAM_HOME || player.role === "keeper") return;
    const distance = player.pos.distanceToSquared(ball.pos);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  selectedIndex = bestIndex;
  updateSelectedPlayer();
}

function steerToward(player, target, speedScale, dt) {
  const toTarget = target.clone().sub(player.pos);
  const distance = toTarget.length();
  const desired = makeVec();
  if (distance > 0.05) {
    const arrive = clamp(distance / 4, 0.25, 1);
    desired.copy(toTarget.normalize()).multiplyScalar(player.speed * speedScale * arrive);
  }

  const acceleration = desired.sub(player.vel);
  const maxAcceleration = player.speed * 4.8 * dt;
  if (acceleration.length() > maxAcceleration) {
    acceleration.setLength(maxAcceleration);
  }
  player.vel.add(acceleration);
  player.vel.multiplyScalar(Math.pow(0.92, dt));
}

function getClosestPlayerIndex(team, includeKeeper = false) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  players.forEach((player, index) => {
    if (player.team !== team || (!includeKeeper && player.role === "keeper")) return;
    const distance = player.pos.distanceToSquared(ball.pos);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function updatePlayerAI(player, index, dt) {
  if (index === selectedIndex) return;

  player.touchCooldown = Math.max(0, player.touchCooldown - dt);

  const target = player.home.clone();
  const distanceToBall = player.pos.distanceTo(ball.pos);
  const attackDirection = player.team === TEAM_HOME ? 1 : -1;
  const closestIndex = getClosestPlayerIndex(player.team);
  const isClosest = closestIndex === index;
  const ballInReachZone = player.team === TEAM_HOME ? ball.pos.y > -17 : ball.pos.y < 17;
  const canChase = player.role !== "keeper" && isClosest && ballInReachZone && distanceToBall < 14;

  if (player.role === "keeper") {
    target.x = clamp(ball.pos.x * 0.45, -FIELD.goalWidth / 2 + 0.7, FIELD.goalWidth / 2 - 0.7);
    target.y = player.team === TEAM_HOME ? -20.2 : 20.2;
    if (distanceToBall < 5.5 && Math.sign(ball.pos.y) === Math.sign(player.home.y)) {
      target.y = clamp(ball.pos.y - attackDirection * 1.2, -21, 21);
    }
  } else if (canChase) {
    target.copy(ball.pos).add(ball.vel.clone().multiplyScalar(0.12));
    target.y -= attackDirection * 0.75;
  } else {
    const roleLane = player.role === "defender" ? -6 * attackDirection : player.role === "mid" ? 0 : 7 * attackDirection;
    target.x = player.home.x * 0.55 + clamp(ball.pos.x * 0.32, -3.6, 3.6);
    target.x += Math.sin(performance.now() * 0.0015 + player.aiSeed) * 0.75;
    target.y = roleLane + clamp(ball.pos.y * 0.22, -4, 4);
    if (ball.pos.y * attackDirection > 2) {
      target.y += attackDirection * (player.role === "forward" ? 2.5 : 1.2);
    }
  }

  steerToward(player, target, canChase ? 0.92 : 0.58, dt);
}

function updateControlledPlayer(dt) {
  const player = players[selectedIndex];
  const desired = makeVec(input.x, input.y).multiplyScalar(player.speed);
  player.vel.copy(desired);
  if (desired.lengthSq() > 0.05) {
    player.facing.copy(desired).normalize();
  }
}

function tryKick() {
  const player = players[selectedIndex];
  if (ball.ownerIndex !== selectedIndex && player.pos.distanceTo(ball.pos) > 1.7) return;

  const aim = makeVec(input.x, input.y);
  if (aim.lengthSq() < 0.08) aim.copy(player.facing);
  aim.normalize();
  ball.ownerIndex = null;
  ball.lastOwnerIndex = selectedIndex;
  ball.releaseCooldown = 0.18;
  ball.pos.copy(player.pos).add(aim.clone().multiplyScalar(PLAYER_RADIUS + BALL_RADIUS + 0.22));
  ball.vel.copy(aim.multiplyScalar(22));
  setStatus("Удар!");
}

function opponentKick(player) {
  const attackDirection = player.team === TEAM_HOME ? 1 : -1;
  const teammates = players.filter((teammate) => teammate.team === player.team && teammate !== player && teammate.role !== "keeper");
  const passTarget = teammates
    .filter((teammate) => teammate.pos.y * attackDirection > player.pos.y * attackDirection - 2)
    .sort((a, b) => b.pos.y * attackDirection - a.pos.y * attackDirection)[0];
  const shouldPass = passTarget && Math.random() < 0.42 && Math.abs(player.pos.x) > 3;
  const target = shouldPass ? passTarget.pos.clone() : makeVec(clamp(-player.pos.x * 0.25, -2.8, 2.8), (FIELD.length / 2) * attackDirection);
  const direction = target.sub(ball.pos).normalize();
  ball.ownerIndex = null;
  ball.lastOwnerIndex = players.indexOf(player);
  ball.releaseCooldown = 0.18;
  ball.pos.copy(player.pos).add(direction.clone().multiplyScalar(PLAYER_RADIUS + BALL_RADIUS + 0.22));
  ball.vel.copy(direction.multiplyScalar(shouldPass ? 13.5 : 18));
  player.touchCooldown = 0.42;
}

function getCarryPosition(player) {
  return player.pos.clone().add(player.facing.clone().multiplyScalar(PLAYER_RADIUS + BALL_RADIUS + 0.18));
}

function isFrontTouch(player, index) {
  if (ball.releaseCooldown > 0 && index === ball.lastOwnerIndex) return false;
  const toBall = ball.pos.clone().sub(player.pos);
  const distance = toBall.length();
  if (distance > PLAYER_RADIUS + BALL_RADIUS + 0.38 || distance < 0.001) return false;
  return toBall.normalize().dot(player.facing) > 0.42;
}

function takePossession(index) {
  ball.ownerIndex = index;
  ball.lastOwnerIndex = index;
  ball.releaseCooldown = 0;
  ball.vel.set(0, 0);
  ball.pos.copy(getCarryPosition(players[index]));
  if (index !== selectedIndex) {
    players[index].touchCooldown = Math.max(players[index].touchCooldown, 0.45);
  }
}

function updatePossession(dt) {
  ball.releaseCooldown = Math.max(0, ball.releaseCooldown - dt);

  if (ball.ownerIndex !== null) {
    const owner = players[ball.ownerIndex];
    ball.pos.copy(getCarryPosition(owner));
    ball.vel.copy(owner.vel);

    players.forEach((player, index) => {
      if (index !== ball.ownerIndex && isFrontTouch(player, index)) {
        takePossession(index);
      }
    });
    return true;
  }

  const frontTouchIndex = players.findIndex((player, index) => isFrontTouch(player, index));
  if (frontTouchIndex !== -1) {
    takePossession(frontTouchIndex);
    return true;
  }

  return false;
}

function scoreGoal(team) {
  if (team === TEAM_HOME) {
    score.home += 1;
    setStatus("\u0413\u043e\u043b \u0441\u0438\u043d\u0438\u0445!", 3);
    resetPositions(TEAM_HOME);
  } else {
    score.away += 1;
    setStatus("\u0413\u043e\u043b \u043a\u0440\u0430\u0441\u043d\u044b\u0445!", 3);
    resetPositions(TEAM_AWAY);
  }
}

function checkGoal(previousPos = null) {
  const inGoalMouth = Math.abs(ball.pos.x) < FIELD.goalWidth / 2;
  if (previousPos) {
    const topGoalLine = FIELD.length / 2;
    const bottomGoalLine = -FIELD.length / 2;
    const crossedTop = previousPos.y <= topGoalLine && ball.pos.y >= topGoalLine;
    const crossedBottom = previousPos.y >= bottomGoalLine && ball.pos.y <= bottomGoalLine;

    if (crossedTop || crossedBottom) {
      const goalLine = crossedTop ? topGoalLine : bottomGoalLine;
      const progress = (goalLine - previousPos.y) / (ball.pos.y - previousPos.y || 1);
      const crossingX = previousPos.x + (ball.pos.x - previousPos.x) * progress;
      if (Math.abs(crossingX) < FIELD.goalWidth / 2) {
        scoreGoal(crossedTop ? TEAM_HOME : TEAM_AWAY);
        return true;
      }
    }
  }

  if (ball.pos.y < -FIELD.length / 2 - BALL_RADIUS && inGoalMouth) {
    scoreGoal(TEAM_AWAY);
    return true;
  }
  if (ball.pos.y > FIELD.length / 2 + BALL_RADIUS && inGoalMouth) {
    scoreGoal(TEAM_HOME);
    return true;
  }
  return false;
}

function resolvePlayers(dt) {
  players.forEach((player, index) => {
    if (index !== selectedIndex) updatePlayerAI(player, index, dt);
  });
  updateControlledPlayer(dt);

  players.forEach((player) => {
    player.pos.addScaledVector(player.vel, dt);
    player.pos.x = clamp(player.pos.x, -FIELD.width / 2 + PLAYER_RADIUS, FIELD.width / 2 - PLAYER_RADIUS);
    player.pos.y = clamp(player.pos.y, -FIELD.length / 2 + PLAYER_RADIUS, FIELD.length / 2 - PLAYER_RADIUS);
    if (player.vel.lengthSq() > 0.08) {
      player.facing.copy(player.vel).normalize();
    }
  });

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i];
      const b = players[j];
      const delta = a.pos.clone().sub(b.pos);
      const distance = delta.length();
      const overlap = PLAYER_RADIUS * 2 - distance;
      if (overlap > 0 && distance > 0.001) {
        delta.normalize().multiplyScalar(overlap * 0.5);
        a.pos.add(delta);
        b.pos.sub(delta);
      }
    }
  }
}

function resolveBall(dt) {
  if (updatePossession(dt)) {
    if (checkGoal()) return;
    const owner = players[ball.ownerIndex];
    if (owner && ball.ownerIndex !== selectedIndex && owner.touchCooldown <= 0) {
      opponentKick(owner);
    }
    return;
  }

  const previousBallPos = ball.pos.clone();
  ball.pos.addScaledVector(ball.vel, dt);
  ball.vel.multiplyScalar(Math.pow(0.18, dt));

  if (Math.abs(ball.pos.x) > FIELD.width / 2 - BALL_RADIUS) {
    ball.pos.x = clamp(ball.pos.x, -FIELD.width / 2 + BALL_RADIUS, FIELD.width / 2 - BALL_RADIUS);
    ball.vel.x *= -0.72;
  }

  if (checkGoal(previousBallPos)) return;

  const inGoalMouth = Math.abs(ball.pos.x) < FIELD.goalWidth / 2;
  if (ball.pos.y < -FIELD.length / 2 - BALL_RADIUS && inGoalMouth) {
    score.away += 1;
    setStatus("Гол красных!", 3);
    resetPositions(TEAM_AWAY);
  } else if (ball.pos.y > FIELD.length / 2 + BALL_RADIUS && inGoalMouth) {
    score.home += 1;
    setStatus("Гол синих!", 3);
    resetPositions(TEAM_HOME);
  } else if (Math.abs(ball.pos.y) > FIELD.length / 2 - BALL_RADIUS) {
    ball.pos.y = clamp(ball.pos.y, -FIELD.length / 2 + BALL_RADIUS, FIELD.length / 2 - BALL_RADIUS);
    ball.vel.y *= -0.72;
  }

  players.forEach((player) => {
    const delta = ball.pos.clone().sub(player.pos);
    const distance = delta.length();
    const minDistance = PLAYER_RADIUS + BALL_RADIUS;
    if (distance < minDistance && distance > 0.001) {
      delta.normalize();
      ball.pos.copy(player.pos.clone().add(delta.multiplyScalar(minDistance)));
      ball.vel.add(delta.multiplyScalar(6)).add(player.vel.clone().multiplyScalar(0.75));
    }
  });
}

function updateMeshes() {
  players.forEach((player) => {
    player.mesh.position.set(player.pos.y, 0, player.pos.x);
    if (player.vel.lengthSq() > 0.2) {
      player.mesh.rotation.y = Math.atan2(player.vel.y, player.vel.x);
    }
  });

  ball.mesh.position.set(ball.pos.y, 0, ball.pos.x);
  ball.mesh.children[0].rotation.x += ball.vel.x * 0.02;
  ball.mesh.children[0].rotation.z -= ball.vel.y * 0.02;
}

function updateHud(dt) {
  matchClock = Math.max(0, matchClock - dt);
  const minutes = Math.floor(matchClock / 60);
  const seconds = Math.floor(matchClock % 60);
  timerText.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  scoreText.textContent = `${score.home} : ${score.away}`;

  statusTimer -= dt;
  if (matchClock <= 0) {
    statusText.textContent = score.home === score.away ? "Ничья" : score.home > score.away ? "Победа синих" : "Победа красных";
  } else if (statusTimer <= 0) {
    statusText.textContent = "Играем 4 на 4";
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const forceLandscape = width < height && width <= 760;
  const renderWidth = forceLandscape ? height : width;
  const renderHeight = forceLandscape ? width : height;
  renderer.setSize(renderWidth, renderHeight, false);
  camera.aspect = renderWidth / renderHeight;
  camera.up.set(0, 1, 0);
  camera.position.set(CAMERA_X, renderHeight < 520 ? 34 : CAMERA_Y, renderHeight < 520 ? -26 : CAMERA_Z);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.033);
  lastTimestamp = timestamp;
  updateInputFromKeys();
  if (input.kick) {
    tryKick();
    input.kick = false;
  }
  if (matchClock > 0) {
    resolvePlayers(dt);
    resolveBall(dt);
  }
  updateMeshes();
  updateHud(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function setupStick() {
  let pointerId = null;

  function setStickFromEvent(event) {
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width * 0.32;
    const dx = clamp(event.clientX - centerX, -max, max);
    const dy = clamp(event.clientY - centerY, -max, max);
    const length = Math.hypot(dx, dy);
    const normalized = length > max ? max / length : 1;
    const x = dx * normalized;
    const y = dy * normalized;
    stickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    stickInput.x = x / max;
    stickInput.y = -y / max;
  }

  stick.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    stick.setPointerCapture(pointerId);
    setStickFromEvent(event);
  });

  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) setStickFromEvent(event);
  });

  function release(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    stickInput.x = 0;
    stickInput.y = 0;
    stickKnob.style.transform = "translate(-50%, -50%)";
  }

  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === " ") {
    event.preventDefault();
    input.kick = true;
  }
  if (event.key.toLowerCase() === "q") switchPlayer();
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

kickButton.addEventListener("pointerdown", () => {
  input.kick = true;
});
switchButton.addEventListener("pointerdown", switchPlayer);

setupStick();
resize();
updateSelectedPlayer();
resetPositions();
requestAnimationFrame(loop);
