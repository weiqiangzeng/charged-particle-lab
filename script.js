const state = {
  charge: 1,
  mass: 1.5,
  electric: 3,
  magnetic: 0,
  speed: 8,
  angle: 0,
  mode: "custom",
  showGrid: true,
  showTrail: true,
  showVectors: true,
  demoMode: false,
  preserveTrailOnChange: false,
  timeScale: 1,
  previousTimeScale: 1,
  simulationTime: 0,
  maxSimulationTimeUs: 8,
  locks: {
    charge: false,
    mass: false,
    electric: false,
    magnetic: false,
    speed: false,
    angle: false
  },
  isRecording: false,
  running: false,
  paused: false
};

const modeConfigs = {
  custom: {
    title: "自定义调参"
  },
  "electric-only": {
    title: "仅电场",
    lock: "magnetic",
    lockedHint: "当前模式下磁场固定为 0"
  },
  "magnetic-only": {
    title: "仅磁场",
    lock: "electric",
    lockedHint: "当前模式下电场固定为 0"
  }
};

const MAGNETIC_MODE_DEFAULT_B = 1.0;

const refs = {
  chargeInput: document.getElementById("chargeInput"),
  massInput: document.getElementById("massInput"),
  electricInput: document.getElementById("electricInput"),
  magneticInput: document.getElementById("magneticInput"),
  speedInput: document.getElementById("speedInput"),
  angleInput: document.getElementById("angleInput"),
  chargeNumber: document.getElementById("chargeNumber"),
  massNumber: document.getElementById("massNumber"),
  electricNumber: document.getElementById("electricNumber"),
  magneticNumber: document.getElementById("magneticNumber"),
  speedNumber: document.getElementById("speedNumber"),
  angleNumber: document.getElementById("angleNumber"),
  chargeValue: document.getElementById("chargeValue"),
  massValue: document.getElementById("massValue"),
  electricValue: document.getElementById("electricValue"),
  magneticValue: document.getElementById("magneticValue"),
  speedValue: document.getElementById("speedValue"),
  angleValue: document.getElementById("angleValue"),
  startButton: document.getElementById("startButton"),
  pauseButton: document.getElementById("pauseButton"),
  resetButton: document.getElementById("resetButton"),
  canvas: document.getElementById("simCanvas"),
  presetTitle: document.getElementById("presetTitle"),
  presetButtons: Array.from(document.querySelectorAll(".preset-button")),
  electricHint: document.getElementById("electricHint"),
  magneticHint: document.getElementById("magneticHint"),
  metricsModeTitle: document.getElementById("metricsModeTitle"),
  electricForceMetric: document.getElementById("electricForceMetric"),
  magneticForceMetric: document.getElementById("magneticForceMetric"),
  speedMetric: document.getElementById("speedMetric"),
  netForceMetric: document.getElementById("netForceMetric"),
  stageSpeedMetric: document.getElementById("stageSpeedMetric"),
  stageElectricForceMetric: document.getElementById("stageElectricForceMetric"),
  stageMagneticForceMetric: document.getElementById("stageMagneticForceMetric"),
  stageNetForceMetric: document.getElementById("stageNetForceMetric"),
  radiusMetric: document.getElementById("radiusMetric"),
  periodMetric: document.getElementById("periodMetric"),
  timeMetric: document.getElementById("timeMetric"),
  maxTimeMetric: document.getElementById("maxTimeMetric"),
  metricsNote: document.getElementById("metricsNote"),
  equationTitle: document.getElementById("equationTitle"),
  equationNote: document.getElementById("equationNote"),
  equationLines: document.getElementById("equationLines"),
  showGridToggle: document.getElementById("showGridToggle"),
  showTrailToggle: document.getElementById("showTrailToggle"),
  showVectorsToggle: document.getElementById("showVectorsToggle"),
  demoModeToggle: document.getElementById("demoModeToggle"),
  preserveTrailToggle: document.getElementById("preserveTrailToggle"),
  speedButtons: Array.from(document.querySelectorAll(".speed-button")),
  maxTimeNumber: document.getElementById("maxTimeNumber"),
  overviewMode: document.getElementById("overviewMode"),
  overviewSpeed: document.getElementById("overviewSpeed"),
  demoBadge: document.getElementById("demoBadge"),
  lockChargeButton: document.getElementById("lockChargeButton"),
  lockMassButton: document.getElementById("lockMassButton"),
  lockElectricButton: document.getElementById("lockElectricButton"),
  lockMagneticButton: document.getElementById("lockMagneticButton"),
  lockSpeedButton: document.getElementById("lockSpeedButton"),
  lockAngleButton: document.getElementById("lockAngleButton"),
  exportPngButton: document.getElementById("exportPngButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  recordVideoButton: document.getElementById("recordVideoButton")
};

const logicalWidth = 980;
const logicalHeight = 640;
const dpr = window.devicePixelRatio || 1;
const ctx = refs.canvas.getContext("2d");

refs.canvas.width = logicalWidth * dpr;
refs.canvas.height = logicalHeight * dpr;
ctx.scale(dpr, dpr);

let animationFrame = 0;
let particle = null;
let path = [];
let mediaRecorder = null;
let recordedChunks = [];

const ELEMENTARY_CHARGE = 1.602176634e-19;
const ELECTRIC_FIELD_UNIT = 1e5;
const SPEED_UNIT = 1e6;
const MASS_UNIT = 1e-27;
const RECORDING_TIME_SCALE = 0.5;
const DEFAULT_VIEW = {
  minX: -4,
  maxX: 4,
  minY: -3,
  maxY: 3
};

function formatSigned(value) {
  const prefix = value > 0 ? "+" : value < 0 ? "" : "";
  return `${prefix}${value.toFixed(1)}`;
}

function formatSignedFixed(value, digits) {
  const prefix = value > 0 ? "+" : value < 0 ? "" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function setLockButtonState(button, locked) {
  button.textContent = locked ? "已锁" : "解锁";
  button.classList.toggle("active", locked);
}

function formatScientific(value, digits = 2, unit = "") {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value === 0) {
    return unit ? `0 ${unit}` : "0";
  }
  const [coefficient, exponentRaw] = value.toExponential(digits).split("e");
  const exponent = Number(exponentRaw);
  const text = `${coefficient}×10^${exponent}`;
  return unit ? `${text} ${unit}` : text;
}

function formatCoefficient(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value === 0) {
    return "0";
  }

  const abs = Math.abs(value);
  if (abs >= 1e3 || abs < 1e-2) {
    const [coefficient, exponentRaw] = value.toExponential(digits).split("e");
    return `${coefficient}×10^${Number(exponentRaw)}`;
  }

  if (abs >= 10) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
}

function getInitialVelocityComponents() {
  const radians = (state.angle * Math.PI) / 180;
  const speed = state.speed * SPEED_UNIT;
  return {
    vx0: speed * Math.cos(radians),
    vy0: speed * Math.sin(radians)
  };
}

function getScenarioKey() {
  const hasElectric = Math.abs(state.electric) > 1e-12;
  const hasMagnetic = Math.abs(state.magnetic) > 1e-12;
  if (hasElectric && hasMagnetic) return "combined";
  if (hasElectric) return "electric";
  if (hasMagnetic) return "magnetic";
  return "free";
}

function updateEquationPanel() {
  const { q, m, ey, bz } = getPhysicsParams();
  const { vx0, vy0 } = getInitialVelocityComponents();
  const omega = Math.abs(bz) > 1e-12 ? (q * bz) / m : 0;
  const drift = Math.abs(bz) > 1e-12 ? ey / bz : 0;
  const accel = (q * ey) / m;
  const scenario = getScenarioKey();

  refs.equationLines.innerHTML = "";

  function addLine(text) {
    const div = document.createElement("div");
    div.className = "equation-line";
    div.textContent = text;
    refs.equationLines.appendChild(div);
  }

  if (scenario === "free") {
    refs.equationTitle.textContent = "匀速直线运动";
    refs.equationNote.textContent = "当前电场和磁场都为 0，轨迹退化为匀速直线。";
    addLine(`x(t) = ${formatCoefficient(vx0)} t`);
    addLine(`y(t) = ${formatCoefficient(vy0)} t`);
    return;
  }

  if (scenario === "electric") {
    refs.equationTitle.textContent = "仅电场参数方程";
    refs.equationNote.textContent = "当前是匀强电场情形：x 方向匀速，y 方向匀加速。";
    addLine(`x(t) = ${formatCoefficient(vx0)} t`);
    addLine(`y(t) = ${formatCoefficient(vy0)} t + 1/2·(${formatCoefficient(accel)}) t²`);
    return;
  }

  if (scenario === "magnetic") {
    refs.equationTitle.textContent = "仅磁场参数方程";
    refs.equationNote.textContent = "当前是匀强磁场圆周运动的参数形式，ω = qB/m。";
    addLine(`ω = ${formatCoefficient(omega)} rad/s`);
    addLine(`x(t) = (${formatCoefficient(vx0 / omega)}) sin(ωt) - (${formatCoefficient(vy0 / omega)}) [cos(ωt) - 1]`);
    addLine(`y(t) = (${formatCoefficient(vy0 / omega)}) sin(ωt) + (${formatCoefficient(vx0 / omega)}) [cos(ωt) - 1]`);
    return;
  }

  refs.equationTitle.textContent = "电磁复合场参数方程";
  refs.equationNote.textContent = "当前是匀强电场与匀强磁场共存的参数形式，沿 x 方向存在漂移项。";
  addLine(`ω = ${formatCoefficient(omega)} rad/s`);
  addLine(`v_d = E/B = ${formatCoefficient(drift)} m/s`);
  addLine(`x(t) = (${formatCoefficient((vx0 - drift) / omega)}) sin(ωt) - (${formatCoefficient(vy0 / omega)}) [cos(ωt) - 1] + (${formatCoefficient(drift)}) t`);
  addLine(`y(t) = (${formatCoefficient(vy0 / omega)}) sin(ωt) + (${formatCoefficient((vx0 - drift) / omega)}) [cos(ωt) - 1]`);
}

function getInstantKinematics() {
  if (!particle) {
    return { speed: state.speed * SPEED_UNIT, vx: 0, vy: 0 };
  }
  return {
    speed: Math.hypot(particle.vx, particle.vy),
    vx: particle.vx,
    vy: particle.vy
  };
}

function getLiveVectorState() {
  const { q, ey, bz } = getPhysicsParams();
  const { speed, vx, vy } = getInstantKinematics();
  const electricForceVector = {
    x: 0,
    y: q * ey
  };
  const magneticForceVector = {
    x: q * vy * bz,
    y: -q * vx * bz
  };
  const netForceVector = {
    x: electricForceVector.x + magneticForceVector.x,
    y: electricForceVector.y + magneticForceVector.y
  };

  return {
    speed,
    velocityVector: { x: vx, y: vy },
    electricForceVector,
    magneticForceVector,
    netForceVector
  };
}

function computeLiveMetrics() {
  const { q, m, ey, bz } = getPhysicsParams();
  const { speed, velocityVector, electricForceVector, magneticForceVector, netForceVector } = getLiveVectorState();
  const electricForce = Math.abs(q * ey);
  const magneticForce = Math.abs(q * speed * bz);
  const netForce = Math.hypot(netForceVector.x, netForceVector.y);

  let radius = null;
  let period = null;
  let note = "当前显示的是单粒子在所选场景下的瞬时物理量。";

  if (state.mode === "magnetic-only" && Math.abs(q) > 0 && Math.abs(bz) > 1e-12) {
    radius = (m * speed) / (Math.abs(q) * Math.abs(bz));
    period = (2 * Math.PI * m) / (Math.abs(q) * Math.abs(bz));
    note = "仅磁场模式下，半径和周期具有稳定物理意义，可直接对应课本公式。";
  } else if (state.mode === "electric-only") {
    note = "仅电场模式下，粒子沿场方向做加速偏转，重点看电场力和速率变化。";
  }

  return {
    electricForce,
    magneticForce,
    netForce,
    speed,
    radius,
    period,
    note,
    velocityVector,
    electricForceVector,
    magneticForceVector,
    netForceVector
  };
}

function syncReadouts() {
  refs.chargeValue.textContent = `${state.charge > 0 ? "+" : ""}${state.charge.toFixed(0)} e`;
  refs.massValue.textContent = `${state.mass.toFixed(1)} ×10^-27 kg`;
  refs.electricValue.textContent = `${formatSigned(state.electric)} ×10^5 N/C`;
  refs.magneticValue.textContent = `${formatSignedFixed(state.magnetic, 2)} T`;
  refs.speedValue.textContent = `${state.speed.toFixed(1)} ×10^6 m/s`;
  refs.angleValue.textContent = `${state.angle.toFixed(0)}°`;
  refs.presetTitle.textContent = modeConfigs[state.mode].title;
  refs.presetButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
  refs.electricHint.textContent = state.mode === "magnetic-only" ? modeConfigs["magnetic-only"].lockedHint : "";
  refs.magneticHint.textContent = state.mode === "electric-only" ? modeConfigs["electric-only"].lockedHint : "";
  refs.metricsModeTitle.textContent = modeConfigs[state.mode].title;
  refs.overviewMode.textContent = modeConfigs[state.mode].title;
  refs.overviewSpeed.textContent = `${state.timeScale}x`;
  refs.startButton.textContent = state.running ? "运行中" : "开始";
  refs.startButton.classList.toggle("primary", !state.running);
  setLockButtonState(refs.lockChargeButton, state.locks.charge);
  setLockButtonState(refs.lockMassButton, state.locks.mass);
  setLockButtonState(refs.lockElectricButton, state.locks.electric);
  setLockButtonState(refs.lockMagneticButton, state.locks.magnetic);
  setLockButtonState(refs.lockSpeedButton, state.locks.speed);
  setLockButtonState(refs.lockAngleButton, state.locks.angle);
  refs.recordVideoButton.textContent = state.isRecording ? "停止录制" : "开始录制";
  refs.recordVideoButton.classList.toggle("recording", state.isRecording);

  const metrics = computeLiveMetrics();
  refs.electricForceMetric.textContent = formatScientific(metrics.electricForce, 2, "N");
  refs.magneticForceMetric.textContent = formatScientific(metrics.magneticForce, 2, "N");
  refs.speedMetric.textContent = formatScientific(metrics.speed, 2, "m/s");
  refs.netForceMetric.textContent = formatScientific(metrics.netForce, 2, "N");
  refs.stageElectricForceMetric.textContent = formatScientific(metrics.electricForce, 2, "N");
  refs.stageMagneticForceMetric.textContent = formatScientific(metrics.magneticForce, 2, "N");
  refs.stageSpeedMetric.textContent = formatScientific(metrics.speed, 2, "m/s");
  refs.stageNetForceMetric.textContent = formatScientific(metrics.netForce, 2, "N");
  refs.radiusMetric.textContent =
    metrics.radius == null ? "仅纯磁场圆周时适用" : formatScientific(metrics.radius, 2, "m");
  refs.periodMetric.textContent =
    metrics.period == null ? "仅纯磁场圆周时适用" : formatScientific(metrics.period, 2, "s");
  refs.timeMetric.textContent = `${state.simulationTime.toFixed(2)} μs`;
  refs.maxTimeMetric.textContent = `${state.maxSimulationTimeUs.toFixed(1)} μs`;
  refs.metricsNote.textContent = metrics.note;
  updateEquationPanel();
}

function syncInputs() {
  refs.chargeInput.value = state.charge;
  refs.massInput.value = state.mass;
  refs.electricInput.value = state.electric;
  refs.magneticInput.value = state.magnetic;
  refs.speedInput.value = state.speed;
  refs.angleInput.value = state.angle;
  refs.chargeNumber.value = state.charge;
  refs.massNumber.value = state.mass;
  refs.electricNumber.value = state.electric;
  refs.magneticNumber.value = state.magnetic;
  refs.speedNumber.value = state.speed;
  refs.angleNumber.value = state.angle;
  refs.maxTimeNumber.value = state.maxSimulationTimeUs;
  refs.chargeInput.disabled = state.locks.charge;
  refs.massInput.disabled = state.locks.mass;
  refs.speedInput.disabled = state.locks.speed;
  refs.angleInput.disabled = state.locks.angle;
  refs.electricInput.disabled = state.locks.electric || state.mode === "magnetic-only";
  refs.magneticInput.disabled = state.locks.magnetic || state.mode === "electric-only";
  refs.chargeNumber.disabled = state.locks.charge;
  refs.massNumber.disabled = state.locks.mass;
  refs.speedNumber.disabled = state.locks.speed;
  refs.angleNumber.disabled = state.locks.angle;
  refs.electricNumber.disabled = state.locks.electric || state.mode === "magnetic-only";
  refs.magneticNumber.disabled = state.locks.magnetic || state.mode === "electric-only";
  refs.showGridToggle.checked = state.showGrid;
  refs.showTrailToggle.checked = state.showTrail;
  refs.showVectorsToggle.checked = state.showVectors;
  refs.demoModeToggle.checked = state.demoMode;
  refs.preserveTrailToggle.checked = state.preserveTrailOnChange;
  refs.speedButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.speed) === state.timeScale);
  });
  document.body.classList.toggle("demo-mode", state.demoMode);
  refs.demoBadge.textContent = state.demoMode ? "教学演示中" : "";
}

function resetParticle() {
  const radians = (state.angle * Math.PI) / 180;
  const speed = state.speed * SPEED_UNIT;

  particle = {
    x: 0,
    y: 0,
    vx: speed * Math.cos(radians),
    vy: speed * Math.sin(radians)
  };
}

function clearTrajectory() {
  path = [{ x: 0, y: 0 }];
  state.simulationTime = 0;
  resetParticle();
}

function startSimulation() {
  state.running = true;
  state.paused = false;
  clearTrajectory();
  refs.pauseButton.textContent = "暂停";
  syncReadouts();
}

function resetSimulation() {
  state.running = false;
  state.paused = false;
  clearTrajectory();
  refs.pauseButton.textContent = "暂停";
  syncReadouts();
  renderScene();
}

function applyParameterChange() {
  if (state.mode === "electric-only") {
    state.magnetic = 0;
  }
  if (state.mode === "magnetic-only") {
    state.electric = 0;
  }

  if (state.preserveTrailOnChange && particle) {
    syncInputs();
    syncReadouts();
    renderScene();
    return;
  }

  resetSimulation();
}

function applyMode(modeKey) {
  state.mode = modeKey;
  if (modeKey === "electric-only") {
    state.magnetic = 0;
  }
  if (modeKey === "magnetic-only") {
    state.electric = 0;
    if (Math.abs(state.magnetic) < 1e-12) {
      state.magnetic = MAGNETIC_MODE_DEFAULT_B;
    }
  }
  syncInputs();
  resetSimulation();
}

function getPhysicsParams() {
  return {
    q: state.charge * ELEMENTARY_CHARGE,
    m: state.mass * MASS_UNIT,
    ex: 0,
    ey: state.electric * ELECTRIC_FIELD_UNIT,
    bz: state.magnetic
  };
}

function getStepConfig() {
  const { q, m, ey, bz } = getPhysicsParams();
  const speed = Math.max(state.speed * SPEED_UNIT, 1);
  let dtMag = Infinity;
  let dtElectric = Infinity;

  if (Math.abs(q) > 0 && Math.abs(bz) > 1e-12) {
    const period = (2 * Math.PI * m) / (Math.abs(q) * Math.abs(bz));
    dtMag = period / 720;
  }

  const accelY = Math.abs((q * ey) / m);
  if (accelY > 0) {
    dtElectric = (0.0025 * speed) / accelY;
  }

  const dt = Math.min(dtMag, dtElectric, 2e-10);
  const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 2e-13), 2e-10) : 1e-10;

  let steps = 14;
  if (Math.abs(bz) > 3) steps = 20;
  if (Math.abs(ey) > 8 * ELECTRIC_FIELD_UNIT) steps = Math.max(steps, 18);

  return { dt: safeDt, steps };
}

function borisAdvance(dt) {
  const { q, m, ex, ey, bz } = getPhysicsParams();

  if (q === 0) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    return;
  }

  const qm = q / m;
  const halfEx = qm * ex * dt * 0.5;
  const halfEy = qm * ey * dt * 0.5;

  let vxMinus = particle.vx + halfEx;
  let vyMinus = particle.vy + halfEy;

  const tz = qm * bz * dt * 0.5;
  const sz = (2 * tz) / (1 + tz * tz);

  const vxPrime = vxMinus + vyMinus * tz;
  const vyPrime = vyMinus - vxMinus * tz;

  const vxPlus = vxMinus + vyPrime * sz;
  const vyPlus = vyMinus - vxPrime * sz;

  particle.vx = vxPlus + halfEx;
  particle.vy = vyPlus + halfEy;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
}

function updateParticle() {
  const { dt, steps } = getStepConfig();
  const effectiveDt = dt * state.timeScale;
  const maxSimulationTimeUs = state.maxSimulationTimeUs;

  for (let step = 0; step < steps; step += 1) {
    borisAdvance(effectiveDt);
    state.simulationTime += effectiveDt * 1e6;

    if (!Number.isFinite(particle.x) || !Number.isFinite(particle.y)) {
      state.running = false;
      return;
    }

    path.push({ x: particle.x, y: particle.y });

    if (state.simulationTime >= maxSimulationTimeUs) {
      state.running = false;
      state.simulationTime = state.maxSimulationTimeUs;
      return;
    }
    if (path.length > 12000) {
      state.paused = true;
      refs.pauseButton.textContent = "继续";
      return;
    }
  }
}

function getBounds() {
  if (path.length <= 1) {
    return {
      minX: DEFAULT_VIEW.minX,
      maxX: DEFAULT_VIEW.maxX,
      minY: DEFAULT_VIEW.minY,
      maxY: DEFAULT_VIEW.maxY,
      spanX: DEFAULT_VIEW.maxX - DEFAULT_VIEW.minX,
      spanY: DEFAULT_VIEW.maxY - DEFAULT_VIEW.minY
    };
  }

  const points = [...path, { x: 0, y: 0 }];
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  let spanX = Math.max(maxX - minX, 0.8);
  let spanY = Math.max(maxY - minY, 0.8);

  const padX = Math.max(spanX * 0.18, 0.18);
  const padY = Math.max(spanY * 0.18, 0.18);

  minX -= padX;
  maxX += padX;
  minY -= padY;
  maxY += padY;

  spanX = maxX - minX;
  spanY = maxY - minY;

  return { minX, maxX, minY, maxY, spanX, spanY };
}

function worldToCanvas(point, bounds) {
  const padding = 56;
  const drawableWidth = logicalWidth - padding * 2;
  const drawableHeight = logicalHeight - padding * 2;
  const scale = Math.min(drawableWidth / bounds.spanX, drawableHeight / bounds.spanY);
  const offsetX = (logicalWidth - bounds.spanX * scale) / 2;
  const offsetY = (logicalHeight - bounds.spanY * scale) / 2;

  return {
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (bounds.maxY - point.y) * scale
  };
}

function niceStep(target) {
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;

  if (normalized < 1.5) return 1 * power;
  if (normalized < 3) return 2 * power;
  if (normalized < 7) return 5 * power;
  return 10 * power;
}

function drawAxisTicks(bounds, origin) {
  const stepX = niceStep(bounds.spanX / 8);
  const stepY = niceStep(bounds.spanY / 8);
  const labelFontSize = state.demoMode ? 15 : 11;
  const tickHalf = state.demoMode ? 7 : 5;

  ctx.strokeStyle = "rgba(18, 31, 36, 0.18)";
  ctx.fillStyle = "rgba(18, 31, 36, 0.58)";
  ctx.lineWidth = state.demoMode ? 1.8 : 1.2;
  ctx.font = `${labelFontSize}px "Avenir Next", "PingFang SC", sans-serif`;

  const startX = Math.ceil(bounds.minX / stepX) * stepX;
  for (let value = startX; value <= bounds.maxX + stepX * 0.25; value += stepX) {
    const point = worldToCanvas({ x: value, y: 0 }, bounds);
    if (point.x < 34 || point.x > logicalWidth - 34) continue;
    ctx.beginPath();
    ctx.moveTo(point.x, origin.y - tickHalf);
    ctx.lineTo(point.x, origin.y + tickHalf);
    ctx.stroke();
    if (Math.abs(value) > stepX * 0.1) {
      ctx.fillText(formatTick(value), point.x - 14, origin.y + 18);
    }
  }

  const startY = Math.ceil(bounds.minY / stepY) * stepY;
  for (let value = startY; value <= bounds.maxY + stepY * 0.25; value += stepY) {
    const point = worldToCanvas({ x: 0, y: value }, bounds);
    if (point.y < 18 || point.y > logicalHeight - 18) continue;
    ctx.beginPath();
    ctx.moveTo(origin.x - tickHalf, point.y);
    ctx.lineTo(origin.x + tickHalf, point.y);
    ctx.stroke();
    if (Math.abs(value) > stepY * 0.1) {
      ctx.fillText(formatTick(value), origin.x + 8, point.y + 4);
    }
  }
}

function formatTick(value) {
  const abs = Math.abs(value);

  if (abs >= 1000 || (abs > 0 && abs < 0.01)) {
    return value.toExponential(1).replace("+", "");
  }

  if (abs >= 10) {
    return value.toFixed(0);
  }

  if (abs >= 1) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}

function drawBackground(bounds) {
  const axisFontSize = state.demoMode ? 16 : 12;
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  if (!state.showGrid) {
    const origin = worldToCanvas({ x: 0, y: 0 }, bounds);

    ctx.strokeStyle = "rgba(18, 31, 36, 0.14)";
    ctx.lineWidth = state.demoMode ? 2.8 : 2;
    ctx.beginPath();
    ctx.moveTo(30, origin.y);
    ctx.lineTo(logicalWidth - 30, origin.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(origin.x, logicalHeight - 30);
    ctx.lineTo(origin.x, 30);
    ctx.stroke();

    ctx.fillStyle = "rgba(18, 31, 36, 0.6)";
    ctx.font = `${axisFontSize}px "Avenir Next", "PingFang SC", sans-serif`;
    ctx.fillText("x / m", logicalWidth - 46, origin.y - 10);
    ctx.fillText("y / m", origin.x + 12, 20);
    return;
  }

  const majorStepX = niceStep(bounds.spanX / 8);
  const majorStepY = niceStep(bounds.spanY / 8);
  const minorStepX = majorStepX / 2;
  const minorStepY = majorStepY / 2;

  ctx.strokeStyle = "rgba(18, 31, 36, 0.04)";
  ctx.lineWidth = 1;
  for (
    let value = Math.ceil(bounds.minX / minorStepX) * minorStepX;
    value <= bounds.maxX + minorStepX * 0.25;
    value += minorStepX
  ) {
    const point = worldToCanvas({ x: value, y: 0 }, bounds);
    if (point.x < 0 || point.x > logicalWidth) continue;
    ctx.beginPath();
    ctx.moveTo(point.x, 0);
    ctx.lineTo(point.x, logicalHeight);
    ctx.stroke();
  }
  for (
    let value = Math.ceil(bounds.minY / minorStepY) * minorStepY;
    value <= bounds.maxY + minorStepY * 0.25;
    value += minorStepY
  ) {
    const point = worldToCanvas({ x: 0, y: value }, bounds);
    if (point.y < 0 || point.y > logicalHeight) continue;
    ctx.beginPath();
    ctx.moveTo(0, point.y);
    ctx.lineTo(logicalWidth, point.y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(18, 31, 36, 0.08)";
  for (
    let value = Math.ceil(bounds.minX / majorStepX) * majorStepX;
    value <= bounds.maxX + majorStepX * 0.25;
    value += majorStepX
  ) {
    const point = worldToCanvas({ x: value, y: 0 }, bounds);
    if (point.x < 0 || point.x > logicalWidth) continue;
    ctx.beginPath();
    ctx.moveTo(point.x, 0);
    ctx.lineTo(point.x, logicalHeight);
    ctx.stroke();
  }
  for (
    let value = Math.ceil(bounds.minY / majorStepY) * majorStepY;
    value <= bounds.maxY + majorStepY * 0.25;
    value += majorStepY
  ) {
    const point = worldToCanvas({ x: 0, y: value }, bounds);
    if (point.y < 0 || point.y > logicalHeight) continue;
    ctx.beginPath();
    ctx.moveTo(0, point.y);
    ctx.lineTo(logicalWidth, point.y);
    ctx.stroke();
  }

  const origin = worldToCanvas({ x: 0, y: 0 }, bounds);

  ctx.strokeStyle = "rgba(18, 31, 36, 0.14)";
  ctx.lineWidth = state.demoMode ? 2.8 : 2;
  ctx.beginPath();
  ctx.moveTo(30, origin.y);
  ctx.lineTo(logicalWidth - 30, origin.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(origin.x, logicalHeight - 30);
  ctx.lineTo(origin.x, 30);
  ctx.stroke();

  drawAxisTicks(bounds, origin);

  ctx.fillStyle = "rgba(18, 31, 36, 0.6)";
  ctx.font = `${axisFontSize}px "Avenir Next", "PingFang SC", sans-serif`;
  ctx.fillText("x / m", logicalWidth - 46, origin.y - 10);
  ctx.fillText("y / m", origin.x + 12, 20);
}

function drawPath(bounds) {
  if (!state.showTrail || !path.length) return;

  ctx.strokeStyle = "rgba(210, 103, 41, 0.96)";
  ctx.lineWidth = 2.6;
  ctx.beginPath();

  const first = worldToCanvas(path[0], bounds);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < path.length; i += 1) {
    const point = worldToCanvas(path[i], bounds);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
}

function getPathExtent() {
  if (path.length <= 1) {
    return 0;
  }

  let minX = path[0].x;
  let maxX = path[0].x;
  let minY = path[0].y;
  let maxY = path[0].y;

  for (let i = 1; i < path.length; i += 1) {
    const point = path[i];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return Math.max(maxX - minX, maxY - minY);
}

function getDynamicArrowLength(magnitude, maxMagnitude, minLength, maxLength) {
  if (!Number.isFinite(magnitude) || magnitude < 1e-30) {
    return 0;
  }

  if (!Number.isFinite(maxMagnitude) || maxMagnitude < 1e-30) {
    return minLength;
  }

  const normalized = Math.min(1, magnitude / maxMagnitude);
  const eased = Math.sqrt(normalized);
  return minLength + (maxLength - minLength) * eased;
}

function drawArrow(start, vector, bounds, color, label, pixelLength) {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (!Number.isFinite(magnitude) || magnitude < 1e-30) {
    return;
  }
  const arrowScale = state.demoMode ? 1.9 : 1;
  const headLength = state.demoMode ? 12 : 8;
  const labelFontSize = state.demoMode ? 16 : 12;

  const startCanvas = worldToCanvas(start, bounds);
  const unitX = vector.x / magnitude;
  const unitY = vector.y / magnitude;
  const endCanvas = {
    x: startCanvas.x + unitX * pixelLength * arrowScale,
    y: startCanvas.y - unitY * pixelLength * arrowScale
  };

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = state.demoMode ? 3.4 : 2.2;
  ctx.beginPath();
  ctx.moveTo(startCanvas.x, startCanvas.y);
  ctx.lineTo(endCanvas.x, endCanvas.y);
  ctx.stroke();

  const angle = Math.atan2(endCanvas.y - startCanvas.y, endCanvas.x - startCanvas.x);
  ctx.beginPath();
  ctx.moveTo(endCanvas.x, endCanvas.y);
  ctx.lineTo(
    endCanvas.x - headLength * Math.cos(angle - Math.PI / 6),
    endCanvas.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    endCanvas.x - headLength * Math.cos(angle + Math.PI / 6),
    endCanvas.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.font = `${labelFontSize}px "Avenir Next", "PingFang SC", sans-serif`;
  ctx.fillText(label, endCanvas.x + (state.demoMode ? 10 : 8), endCanvas.y - (state.demoMode ? 10 : 8));
}

function drawVectors(bounds) {
  if (!state.showVectors || !particle) {
    return;
  }

  const metrics = computeLiveMetrics();
  const anchor = { x: particle.x, y: particle.y };
  const pathExtent = getPathExtent();
  const focusFactor = Math.max(0.18, Math.min(1, pathExtent / 3.2));

  const maxForceMagnitude = Math.max(
    Math.hypot(metrics.electricForceVector.x, metrics.electricForceVector.y),
    Math.hypot(metrics.magneticForceVector.x, metrics.magneticForceVector.y),
    Math.hypot(metrics.netForceVector.x, metrics.netForceVector.y),
    1e-30
  );
  const velocityMagnitude = Math.hypot(metrics.velocityVector.x, metrics.velocityVector.y);

  const forceMin = 12;
  const forceMax = 18 + 18 * focusFactor;
  const velocityMin = 18;
  const velocityMax = 26 + 14 * focusFactor;

  drawArrow(
    anchor,
    metrics.velocityVector,
    bounds,
    "#0d7168",
    "v",
    getDynamicArrowLength(velocityMagnitude, velocityMagnitude, velocityMin, velocityMax)
  );
  drawArrow(
    anchor,
    metrics.electricForceVector,
    bounds,
    "#1f78b4",
    "F_E",
    getDynamicArrowLength(Math.hypot(metrics.electricForceVector.x, metrics.electricForceVector.y), maxForceMagnitude, forceMin, forceMax)
  );
  drawArrow(
    anchor,
    metrics.magneticForceVector,
    bounds,
    "#c96b29",
    "F_B",
    getDynamicArrowLength(Math.hypot(metrics.magneticForceVector.x, metrics.magneticForceVector.y), maxForceMagnitude, forceMin, forceMax)
  );
  drawArrow(
    anchor,
    metrics.netForceVector,
    bounds,
    "#7b3fa0",
    "F合",
    getDynamicArrowLength(Math.hypot(metrics.netForceVector.x, metrics.netForceVector.y), maxForceMagnitude, forceMin, forceMax)
  );
}

function drawParticle(bounds) {
  const point = worldToCanvas(path.length ? path[path.length - 1] : { x: 0, y: 0 }, bounds);
  const particleRadius = state.demoMode ? 12 : 7;
  const chargeFontSize = state.demoMode ? 15 : 11;
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(point.x, point.y, particleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `${chargeFontSize}px "Avenir Next", "PingFang SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.charge >= 0 ? "+" : "-", point.x, point.y);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function renderScene() {
  const bounds = getBounds();
  drawBackground(bounds);
  drawPath(bounds);
  drawVectors(bounds);
  drawParticle(bounds);
}

function animate() {
  if (state.running && !state.paused) {
    updateParticle();
    syncReadouts();
  }

  renderScene();
  animationFrame = requestAnimationFrame(animate);
}

function bindInput(input, key) {
  input.addEventListener("input", (event) => {
    state[key] = Number(event.target.value);
    applyParameterChange();
  });
}

function bindNumberInput(input, key) {
  input.addEventListener("change", (event) => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      syncInputs();
      return;
    }
    const min = Number(input.min);
    const max = Number(input.max);
    state[key] = Math.min(max, Math.max(min, next));
    applyParameterChange();
  });
}

bindInput(refs.chargeInput, "charge");
bindInput(refs.massInput, "mass");
bindInput(refs.electricInput, "electric");
bindInput(refs.magneticInput, "magnetic");
bindInput(refs.speedInput, "speed");
bindInput(refs.angleInput, "angle");
bindNumberInput(refs.chargeNumber, "charge");
bindNumberInput(refs.massNumber, "mass");
bindNumberInput(refs.electricNumber, "electric");
bindNumberInput(refs.magneticNumber, "magnetic");
bindNumberInput(refs.speedNumber, "speed");
bindNumberInput(refs.angleNumber, "angle");

refs.startButton.addEventListener("click", () => {
  startSimulation();
});

refs.pauseButton.addEventListener("click", () => {
  if (!state.running) return;
  state.paused = !state.paused;
  refs.pauseButton.textContent = state.paused ? "已暂停" : "暂停";
});

refs.resetButton.addEventListener("click", () => {
  resetSimulation();
});

refs.showGridToggle.addEventListener("change", (event) => {
  state.showGrid = event.target.checked;
  renderScene();
});

refs.showTrailToggle.addEventListener("change", (event) => {
  state.showTrail = event.target.checked;
  renderScene();
});

refs.showVectorsToggle.addEventListener("change", (event) => {
  state.showVectors = event.target.checked;
  renderScene();
});

refs.demoModeToggle.addEventListener("change", (event) => {
  state.demoMode = event.target.checked;
  syncInputs();
  renderScene();
});

refs.preserveTrailToggle.addEventListener("change", (event) => {
  state.preserveTrailOnChange = event.target.checked;
  syncInputs();
});

refs.speedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.timeScale = Number(button.dataset.speed);
    syncInputs();
    syncReadouts();
  });
});

refs.maxTimeNumber.addEventListener("change", (event) => {
  const next = Number(event.target.value);
  if (!Number.isFinite(next)) {
    syncInputs();
    return;
  }
  state.maxSimulationTimeUs = Math.min(100, Math.max(0.5, next));
  syncInputs();
  syncReadouts();
});

refs.exportPngButton.addEventListener("click", () => {
  refs.canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "charged-particle-lab.png";
    link.click();
    URL.revokeObjectURL(url);
  });
});

refs.exportCsvButton.addEventListener("click", () => {
  const header = [
    "# charged-particle-lab export",
    `# mode,${state.mode}`,
    `# charge_e,${state.charge}`,
    `# mass_1e-27kg,${state.mass}`,
    `# electric_1e5N_per_C,${state.electric}`,
    `# magnetic_T,${state.magnetic}`,
    `# speed_1e6m_per_s,${state.speed}`,
    `# angle_deg,${state.angle}`,
    "index,x_m,y_m"
  ];
  const rows = path.map((point, index) => `${index},${point.x},${point.y}`);
  const csv = `${header.join("\n")}\n${rows.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "charged-particle-lab-data.csv";
  link.click();
  URL.revokeObjectURL(url);
});

function stopRecordingAndDownload() {
  if (!mediaRecorder) {
    return;
  }
  mediaRecorder.stop();
}

refs.recordVideoButton.addEventListener("click", () => {
  if (state.isRecording) {
    stopRecordingAndDownload();
    return;
  }

  if (typeof refs.canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    window.alert("当前浏览器暂不支持画布录制。");
    return;
  }

  const stream = refs.canvas.captureStream(30);
  recordedChunks = [];

  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  } catch {
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "charged-particle-lab-recording.webm";
    link.click();
    URL.revokeObjectURL(url);
    stream.getTracks().forEach((track) => track.stop());
    mediaRecorder = null;
    recordedChunks = [];
    state.isRecording = false;
    state.timeScale = state.previousTimeScale;
    syncReadouts();
    syncInputs();
  };

  state.previousTimeScale = state.timeScale;
  state.timeScale = RECORDING_TIME_SCALE;
  mediaRecorder.start();
  state.isRecording = true;
  syncInputs();
  syncReadouts();
});

function bindLockButton(button, key) {
  button.addEventListener("click", () => {
    state.locks[key] = !state.locks[key];
    syncInputs();
    syncReadouts();
  });
}

bindLockButton(refs.lockChargeButton, "charge");
bindLockButton(refs.lockMassButton, "mass");
bindLockButton(refs.lockElectricButton, "electric");
bindLockButton(refs.lockMagneticButton, "magnetic");
bindLockButton(refs.lockSpeedButton, "speed");
bindLockButton(refs.lockAngleButton, "angle");

if (window.matchMedia("(pointer: coarse)").matches) {
  Object.keys(state.locks).forEach((key) => {
    state.locks[key] = true;
  });
}

refs.presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyMode(button.dataset.mode);
  });
});

clearTrajectory();
syncInputs();
syncReadouts();
renderScene();
cancelAnimationFrame(animationFrame);
animationFrame = requestAnimationFrame(animate);
