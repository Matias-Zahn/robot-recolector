/**
 * Controlador del visualizador interactivo.
 * Importa directamente el reconocedor y simulador reales desde /src/runner.js
 * para mantener una única fuente de verdad entre CLI, pruebas e interfaz web.
 */

import {
  evaluateProgram,
  formatExecutionCSV,
  RESULTADOS,
} from "../src/runner.js";

const TEST_FILES = [
  { label: "01 · Solución completa Grupo 03 (MISION_RESUELTA)", path: "/pruebas/01_solucion_grupo03.txt" },
  { label: "02 · Regreso no inverso (RECHAZO_AP)", path: "/pruebas/02_regreso_inverso_incorrecto.txt" },
  { label: "03 · soltar antes de regresar (RECHAZO_AP)", path: "/pruebas/03_soltar_antes_de_regresar.txt" },
  { label: "04 · Viaje sin finviaje (RECHAZO_AP)", path: "/pruebas/04_viaje_sin_finviaje.txt" },
  { label: "05 · Segundo agarrar (RECHAZO_AP)", path: "/pruebas/05_segundo_agarrar.txt" },
  { label: "06 · Atravesar obstáculo (ERROR_FISICO)", path: "/pruebas/06_atravesar_obstaculo.txt" },
  { label: "07 · Agarrar en celda vacía (ERROR_FISICO)", path: "/pruebas/07_agarrar_celda_vacia.txt" },
  { label: "08 · Válido pero sin alcanzar meta (OBJETIVO_NO_ALCANZADO)", path: "/pruebas/08_valido_no_alcanza_meta.txt" },
  { label: "09 · Borde: token desconocido (ERROR_LEXICO)", path: "/pruebas/09_borde_token_desconocido.txt" },
  { label: "10 · Borde: entrada vacía (RECHAZO_AP)", path: "/pruebas/10_borde_entrada_vacia.txt" },
  { label: "11 · Borde: salida de la grilla (ERROR_FISICO)", path: "/pruebas/11_borde_salida_grilla.txt" },
];

const STACK_LABELS = {
  AR: "AR ↑",
  AB: "AB ↓",
  IZ: "IZ ←",
  DE: "DE →",
  Z0: "Z₀ (fondo)",
};

const STATE_NAMES = {
  q0: "q₀ · Fuera de viaje (0 viajes)",
  q1: "q₁ · Viaje en ida (apilando)",
  q2: "q₂ · Viaje en vuelta (desapilando)",
  q3: "q₃ · Esperando finviaje",
  q4: "q₄ · Fuera de viaje (estado final)",
};

// Elementos del DOM
const el = {
  testSelect: document.getElementById("testSelect"),
  fileInput: document.getElementById("fileInput"),
  btnEvaluate: document.getElementById("btnEvaluate"),
  btnRunEditor: document.getElementById("btnRunEditor"),
  statusBanner: document.getElementById("statusBanner"),
  statusBadge: document.getElementById("statusBadge"),
  statusMessage: document.getElementById("statusMessage"),
  gridContainer: document.getElementById("gridContainer"),
  btnFirst: document.getElementById("btnFirst"),
  btnPrev: document.getElementById("btnPrev"),
  btnPlay: document.getElementById("btnPlay"),
  btnNext: document.getElementById("btnNext"),
  btnLast: document.getElementById("btnLast"),
  stepSlider: document.getElementById("stepSlider"),
  stepCounter: document.getElementById("stepCounter"),
  speedSlider: document.getElementById("speedSlider"),
  speedLabel: document.getElementById("speedLabel"),
  metricToken: document.getElementById("metricToken"),
  metricPos: document.getElementById("metricPos"),
  metricMoves: document.getElementById("metricMoves"),
  metricStack: document.getElementById("metricStack"),
  pdaPhaseLabel: document.getElementById("pdaPhaseLabel"),
  stackTopHint: document.getElementById("stackTopHint"),
  stackVisual: document.getElementById("stackVisual"),
  stepDetailBox: document.getElementById("stepDetailBox"),
  tokenList: document.getElementById("tokenList"),
  programEditor: document.getElementById("programEditor"),
  logTableBody: document.getElementById("logTableBody"),
  btnDownloadCsv: document.getElementById("btnDownloadCsv"),
};

let instance = null;
let lastResult = null;
let frames = [];
let currentFrameIdx = 0;
let playTimer = null;

function keyOf(f, c) {
  return `${f},${c}`;
}

function stopPlayback() {
  if (playTimer !== null) {
    clearInterval(playTimer);
    playTimer = null;
  }
  el.btnPlay.textContent = "▶ Reproducir";
}

function startPlayback() {
  if (frames.length <= 1) return;
  if (currentFrameIdx >= frames.length - 1) {
    currentFrameIdx = 0;
    renderFrame(0);
  }
  el.btnPlay.textContent = "⏸ Pausar";
  const delay = Number(el.speedSlider.value);
  playTimer = setInterval(() => {
    if (currentFrameIdx < frames.length - 1) {
      currentFrameIdx += 1;
      renderFrame(currentFrameIdx);
    } else {
      stopPlayback();
    }
  }, delay);
}

/**
 * Construye los frames paso a paso tanto para programas aceptados por el AP
 * (con simulación física) como para programas rechazados por el AP (mostrando
 * la evolución del autómata y la pila hasta el punto de rechazo).
 */
function buildFrames(result) {
  const initialBoxes = instance.cajasIniciales.map(([f, c]) => [keyOf(f, c), `(${f},${c})`]);

  if (result.sim && result.sim.snapshots) {
    return result.sim.snapshots.map((snap, idx) => {
      const apStep = idx > 0 ? result.pda.trace[idx - 1] : null;
      return {
        step: idx,
        tokenIndex: snap.index,
        orden: snap.orden,
        prevState: apStep ? apStep.prevState : null,
        state: snap.estado_ap,
        stackStr: snap.pila,
        robot: snap.robot,
        boxes: snap.boxes,
        carryingOrigin: snap.carryingOrigin,
        movesEmpty: snap.movesEmpty,
        movesLoaded: snap.movesLoaded,
        tripPath: snap.tripPath,
        inTrip: snap.inTrip,
        physicalError: snap.physicalError || null,
        pdaRejection: null,
        lexError: null,
      };
    });
  }

  // Error léxico: solo frame inicial con diagnóstico
  if (result.status === RESULTADOS.ERROR_LEXICO) {
    return [
      {
        step: 0,
        tokenIndex: result.lex.error.index,
        orden: result.lex.error.lexeme,
        prevState: null,
        state: "q0",
        stackStr: "Z0",
        robot: instance.robotInicial,
        boxes: initialBoxes,
        carryingOrigin: null,
        movesEmpty: 0,
        movesLoaded: 0,
        tripPath: [],
        inTrip: false,
        physicalError: null,
        pdaRejection: null,
        lexError: result.lex.error,
      },
    ];
  }

  // Rechazo del AP: frame inicial + cada paso del AP + frame del rechazo
  const list = [
    {
      step: 0,
      tokenIndex: 0,
      orden: "(inicio)",
      prevState: null,
      state: "q0",
      stackStr: "Z0",
      robot: instance.robotInicial,
      boxes: initialBoxes,
      carryingOrigin: null,
      movesEmpty: 0,
      movesLoaded: 0,
      tripPath: [],
      inTrip: false,
      physicalError: null,
      pdaRejection: null,
      lexError: null,
    },
  ];

  for (const step of result.pda.trace) {
    list.push({
      step: list.length,
      tokenIndex: step.index,
      orden: step.orden,
      prevState: step.prevState,
      state: step.state,
      stackStr: step.stack,
      robot: instance.robotInicial,
      boxes: initialBoxes,
      carryingOrigin: null,
      movesEmpty: 0,
      movesLoaded: 0,
      tripPath: [],
      inTrip: false,
      physicalError: null,
      pdaRejection: null,
      lexError: null,
    });
  }

  if (result.pda.rejection) {
    const rej = result.pda.rejection;
    list.push({
      step: list.length,
      tokenIndex: rej.index,
      orden: rej.lexeme,
      prevState: rej.state,
      state: rej.state,
      stackStr: rej.stack,
      robot: instance.robotInicial,
      boxes: initialBoxes,
      carryingOrigin: null,
      movesEmpty: 0,
      movesLoaded: 0,
      tripPath: [],
      inTrip: false,
      physicalError: null,
      pdaRejection: rej,
      lexError: null,
    });
  }

  return list;
}

function renderStatus(result) {
  el.statusBadge.textContent = result.status;
  el.statusMessage.textContent = result.message;

  const clsMap = {
    [RESULTADOS.MISION_RESUELTA]: "status-ok",
    [RESULTADOS.OBJETIVO_NO_ALCANZADO]: "status-warn",
    [RESULTADOS.ERROR_FISICO]: "status-error",
    [RESULTADOS.RECHAZO_AP]: "status-error",
    [RESULTADOS.ERROR_LEXICO]: "status-lex",
  };
  el.statusBanner.className = `status-banner ${clsMap[result.status] || "status-neutral"}`;
}

function renderGridFrame(frame) {
  const obstacles = new Set(instance.obstaculos.map(([f, c]) => keyOf(f, c)));
  const targets = new Set(instance.destinos.map(([f, c]) => keyOf(f, c)));
  const boxesMap = new Map(frame.boxes);
  const trailSet = new Set((frame.tripPath || []).map(([f, c]) => keyOf(f, c)));
  const robotKey = keyOf(frame.robot[0], frame.robot[1]);
  const errorKey =
    frame.physicalError && frame.physicalError.destinoCoords
      ? keyOf(frame.physicalError.destinoCoords[0], frame.physicalError.destinoCoords[1])
      : null;

  el.gridContainer.innerHTML = "";
  for (let f = 1; f <= instance.filas; f++) {
    for (let c = 1; c <= instance.columnas; c++) {
      const k = keyOf(f, c);
      const cell = document.createElement("div");
      cell.className = "cell";

      const coord = document.createElement("span");
      coord.className = "cell-coord";
      coord.textContent = `${f},${c}`;
      cell.appendChild(coord);

      if (obstacles.has(k)) {
        cell.classList.add("cell-obstacle");
        cell.appendChild(document.createTextNode("X"));
      } else {
        const hasBox = boxesMap.has(k);
        const isTarget = targets.has(k);

        if (isTarget) {
          cell.classList.add(hasBox ? "cell-target-done" : "cell-target");
          const tag = document.createElement("span");
          tag.className = "target-tag";
          tag.textContent = hasBox ? "T✓" : "T";
          cell.appendChild(tag);
        } else if (trailSet.has(k)) {
          cell.classList.add(frame.carryingOrigin ? "cell-trail-vuelta" : "cell-trail-ida");
        }

        if (hasBox) {
          const box = document.createElement("div");
          box.className = "box-chip";
          box.title = `Caja con origen ${boxesMap.get(k)}`;
          box.textContent = `C ${boxesMap.get(k)}`;
          cell.appendChild(box);
        }

        if (k === robotKey) {
          const rob = document.createElement("div");
          rob.className = `robot-token${frame.carryingOrigin ? " carrying" : ""}`;
          rob.innerHTML = `<span>R</span>${
            frame.carryingOrigin ? `<span class="robot-cargo">${frame.carryingOrigin}</span>` : ""
          }`;
          cell.appendChild(rob);
        }
      }

      if (errorKey === k || (frame.physicalError && !obstacles.has(errorKey) && k === robotKey && errorKey && (frame.physicalError.destinoCoords[0] < 1 || frame.physicalError.destinoCoords[0] > 6 || frame.physicalError.destinoCoords[1] < 1 || frame.physicalError.destinoCoords[1] > 6))) {
        cell.classList.add("cell-error");
      }

      el.gridContainer.appendChild(cell);
    }
  }
}

function renderPdaFrame(frame) {
  // Limpiar estados y aristas activas
  document.querySelectorAll(".state-node").forEach((n) => {
    n.classList.remove("active", "rejected");
  });
  document.querySelectorAll(".edge").forEach((e) => {
    e.classList.remove("active");
    e.setAttribute("marker-end", "url(#arrow)");
  });

  const activeNode = document.getElementById(`node-${frame.state}`);
  if (activeNode) {
    activeNode.classList.add(frame.pdaRejection ? "rejected" : "active");
  }

  if (frame.prevState && !frame.pdaRejection) {
    const edge = document.getElementById(`edge-${frame.prevState}-${frame.state}`);
    if (edge) {
      edge.classList.add("active");
      edge.setAttribute("marker-end", "url(#arrow-active)");
    }
  }

  el.pdaPhaseLabel.textContent = STATE_NAMES[frame.state] || frame.state;

  // Renderizar pila LIFO visual (frame.stackStr tiene tope a la izquierda)
  const symbols = frame.stackStr.trim().split(/\s+/).filter(Boolean);
  el.stackTopHint.textContent = `Tope: ${symbols[0] || "Z0"}`;
  el.stackVisual.innerHTML = "";
  symbols.forEach((sym, idx) => {
    const div = document.createElement("div");
    div.className = `stack-item${sym === "Z0" ? " is-z0" : ""}${idx === 0 ? " is-top" : ""}`;
    div.textContent = STACK_LABELS[sym] || sym;
    el.stackVisual.appendChild(div);
  });
}

function renderTokensAndTable(result) {
  el.tokenList.innerHTML = "";
  const tokens = result.lex.tokens;

  if (tokens.length === 0 && !result.lex.error) {
    el.tokenList.innerHTML = `<span class="hint">(Entrada vacía — 0 tokens)</span>`;
  } else {
    for (const tok of tokens) {
      const btn = document.createElement("button");
      btn.className = "token-pill";
      if (tok.lexeme === "viaje" || tok.lexeme === "finviaje") btn.classList.add("kw-viaje");
      if (tok.lexeme === "agarrar" || tok.lexeme === "soltar") btn.classList.add("kw-pinza");
      btn.dataset.tokenIndex = String(tok.index);
      btn.textContent = `${tok.index}. ${tok.lexeme}`;
      btn.addEventListener("click", () => {
        stopPlayback();
        const target = frames.findIndex((f) => f.tokenIndex === tok.index);
        if (target >= 0) {
          currentFrameIdx = target;
          renderFrame(currentFrameIdx);
        }
      });
      el.tokenList.appendChild(btn);
    }

    if (result.lex.error) {
      const errBtn = document.createElement("span");
      errBtn.className = "token-pill failed";
      errBtn.textContent = `${result.lex.error.index}. ${result.lex.error.lexeme} ✗`;
      el.tokenList.appendChild(errBtn);
    }
  }

  // Tabla de registro
  el.logTableBody.innerHTML = "";
  const rows = result.sim ? result.sim.executionLog : [];
  if (rows.length > 0) {
    rows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.frameIdx = String(idx + 1);
      tr.innerHTML = `
        <td>${r.indice}</td>
        <td>${r.orden}</td>
        <td>${r.estado_ap}</td>
        <td>${r.pila}</td>
        <td>${r.posicion}</td>
        <td>${r.carga}</td>
      `;
      tr.addEventListener("click", () => {
        stopPlayback();
        currentFrameIdx = idx + 1;
        renderFrame(currentFrameIdx);
      });
      el.logTableBody.appendChild(tr);
    });
    el.btnDownloadCsv.disabled = false;
  } else {
    el.logTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:12px;">No hay registro de simulación física (entrada rechazada antes de simular).</td></tr>`;
    el.btnDownloadCsv.disabled = true;
  }
}

function renderFrame(idx) {
  const frame = frames[idx];
  if (!frame) return;

  el.stepSlider.value = String(idx);
  el.stepCounter.textContent = `Paso ${idx} / ${frames.length - 1}`;

  renderGridFrame(frame);
  renderPdaFrame(frame);

  // Métricas
  const stackHeight = Math.max(0, frame.stackStr.trim().split(/\s+/).length - 1);
  const maxStack = lastResult.pda ? lastResult.pda.maxStackHeight : 0;
  el.metricToken.textContent = frame.tokenIndex > 0 ? `#${frame.tokenIndex} · ${frame.orden}` : "(inicio)";
  el.metricPos.textContent = `(${frame.robot[0]},${frame.robot[1]}) · ${
    frame.carryingOrigin ? `Caja ${frame.carryingOrigin}` : "Vacía"
  }`;
  el.metricMoves.textContent = `${frame.movesEmpty} / ${frame.movesLoaded}`;
  el.metricStack.textContent = `${stackHeight} / ${maxStack}`;

  // Detalle textual del paso
  if (frame.lexError) {
    el.stepDetailBox.innerHTML = `<strong>Error léxico:</strong> ${frame.lexError.message}`;
  } else if (frame.pdaRejection) {
    el.stepDetailBox.innerHTML = `<strong>Rechazo del AP en token #${frame.pdaRejection.index} ("${frame.pdaRejection.lexeme}"):</strong> ${frame.pdaRejection.reason}`;
  } else if (frame.physicalError) {
    el.stepDetailBox.innerHTML = `<strong>Error físico en token #${frame.physicalError.index} ("${frame.physicalError.orden}"):</strong> ${frame.physicalError.reason}`;
  } else if (idx === 0) {
    el.stepDetailBox.innerHTML = `Estado inicial en <strong>q₀</strong>, pila <code>Z₀</code>, robot en <code>(${frame.robot[0]},${frame.robot[1]})</code> con pinza vacía. Presioná <strong>Reproducir</strong> o usá las flechas <strong>← / →</strong>.`;
  } else {
    el.stepDetailBox.innerHTML = `Token <strong>#${frame.tokenIndex} (${frame.orden})</strong>: transición <code>${frame.prevState} → ${frame.state}</code> · pila <code>${frame.stackStr}</code> · robot en <code>(${frame.robot[0]},${frame.robot[1]})</code>.`;
  }

  // Resaltar token pill actual
  el.tokenList.querySelectorAll(".token-pill").forEach((pill) => {
    const ti = Number(pill.dataset.tokenIndex);
    pill.classList.remove("current", "executed", "failed");
    if (!Number.isNaN(ti)) {
      if ((frame.pdaRejection || frame.physicalError) && ti === frame.tokenIndex) {
        pill.classList.add("failed");
      } else if (ti === frame.tokenIndex) {
        pill.classList.add("current");
      } else if (ti < frame.tokenIndex) {
        pill.classList.add("executed");
      }
    }
  });

  // Resaltar fila en tabla de log
  el.logTableBody.querySelectorAll("tr").forEach((tr) => {
    const fIdx = Number(tr.dataset.frameIdx);
    const isCurrent = fIdx === idx;
    tr.classList.toggle("current-row", isCurrent);
    if (isCurrent) {
      tr.scrollIntoView({ block: "nearest" });
    }
  });
}

function runEvaluation(sourceText) {
  stopPlayback();
  lastResult = evaluateProgram(sourceText, instance);
  frames = buildFrames(lastResult);
  currentFrameIdx = 0;

  el.stepSlider.max = String(Math.max(0, frames.length - 1));
  el.stepSlider.value = "0";

  renderStatus(lastResult);
  renderTokensAndTable(lastResult);

  // Si hubo rechazo/error en un solo paso, mostrarlo directamente; si no, arrancar en paso 0
  if (frames.length === 1) {
    renderFrame(0);
  } else {
    renderFrame(0);
  }
}

async function loadTestByPath(filePath) {
  const res = await fetch(filePath);
  const text = await res.text();
  el.programEditor.value = text;
  runEvaluation(text);
}

async function init() {
  const res = await fetch("/instancias/grupo03.json");
  instance = await res.json();

  // Poblar selector de pruebas
  TEST_FILES.forEach((tf, i) => {
    const opt = document.createElement("option");
    opt.value = tf.path;
    opt.textContent = tf.label;
    if (i === 0) opt.selected = true;
    el.testSelect.appendChild(opt);
  });

  // Eventos
  el.testSelect.addEventListener("change", () => loadTestByPath(el.testSelect.value));
  el.btnEvaluate.addEventListener("click", () => runEvaluation(el.programEditor.value));
  el.btnRunEditor.addEventListener("click", () => {
    runEvaluation(el.programEditor.value);
    document.querySelector('.tab-btn[data-tab="tokens"]').click();
  });

  el.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    el.programEditor.value = text;
    runEvaluation(text);
  });

  el.btnFirst.addEventListener("click", () => {
    stopPlayback();
    currentFrameIdx = 0;
    renderFrame(0);
  });
  el.btnPrev.addEventListener("click", () => {
    stopPlayback();
    if (currentFrameIdx > 0) {
      currentFrameIdx -= 1;
      renderFrame(currentFrameIdx);
    }
  });
  el.btnNext.addEventListener("click", () => {
    stopPlayback();
    if (currentFrameIdx < frames.length - 1) {
      currentFrameIdx += 1;
      renderFrame(currentFrameIdx);
    }
  });
  el.btnLast.addEventListener("click", () => {
    stopPlayback();
    currentFrameIdx = frames.length - 1;
    renderFrame(currentFrameIdx);
  });
  el.btnPlay.addEventListener("click", () => {
    if (playTimer !== null) stopPlayback();
    else startPlayback();
  });

  el.stepSlider.addEventListener("input", () => {
    stopPlayback();
    currentFrameIdx = Number(el.stepSlider.value);
    renderFrame(currentFrameIdx);
  });

  el.speedSlider.addEventListener("input", () => {
    el.speedLabel.textContent = `${el.speedSlider.value} ms`;
    if (playTimer !== null) {
      stopPlayback();
      startPlayback();
    }
  });

  // Atajos de teclado (flechas izquierda/derecha cuando no se edita texto)
  window.addEventListener("keydown", (e) => {
    if (document.activeElement === el.programEditor) return;
    if (e.key === "ArrowRight") el.btnNext.click();
    if (e.key === "ArrowLeft") el.btnPrev.click();
    if (e.key === " ") {
      e.preventDefault();
      el.btnPlay.click();
    }
  });

  // Tabs columna derecha
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Descargar CSV
  el.btnDownloadCsv.addEventListener("click", () => {
    if (!lastResult || !lastResult.sim) return;
    const csv = formatExecutionCSV(lastResult.sim.executionLog);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registro_ejecucion.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Cargar solución inicial
  await loadTestByPath(TEST_FILES[0].path);
}

init();
