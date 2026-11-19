/**
 * Simulador del mundo 6x6 del Robot Recolector.
 * Controla únicamente las reglas físicas (límites, obstáculos, cajas, pinza)
 * y la comprobación de la meta final. El protocolo sintáctico lo controla el AP.
 */

const DELTA_DIR = {
  arriba: [-1, 0],
  abajo: [1, 0],
  izquierda: [0, -1],
  derecha: [0, 1],
};

function keyOf(f, c) {
  return `${f},${c}`;
}

function posStr(f, c) {
  return `(${f},${c})`;
}

/**
 * Renderiza la grilla en formato textual legible.
 * Símbolos: R (robot), X (obstáculo), C (caja), T (destino vacío),
 * C/T (caja en destino), R/C, R/T, R/C/T si coinciden.
 */
export function renderGrid(instance, robotPos, boxesMap) {
  const obstacles = new Set(instance.obstaculos.map(([f, c]) => keyOf(f, c)));
  const targets = new Set(instance.destinos.map(([f, c]) => keyOf(f, c)));
  const robotKey = keyOf(robotPos[0], robotPos[1]);

  const header =
    "     " +
    Array.from({ length: instance.columnas }, (_, i) => String(i + 1).padStart(3, " ") + "  ").join("");
  const sep = "    +" + "----+".repeat(instance.columnas);
  const lines = [header, sep];

  for (let f = 1; f <= instance.filas; f++) {
    let row = `  ${f} |`;
    for (let c = 1; c <= instance.columnas; c++) {
      const k = keyOf(f, c);
      let cell = ".";
      if (obstacles.has(k)) {
        cell = "X";
      } else {
        const parts = [];
        if (k === robotKey) parts.push("R");
        if (boxesMap.has(k)) parts.push("C");
        if (targets.has(k)) parts.push("T");
        cell = parts.length > 0 ? parts.join("/") : ".";
      }
      row += cell.padStart(3, " ").padEnd(4, " ") + "|";
    }
    lines.push(row);
    lines.push(sep);
  }
  return lines.join("\n");
}

/**
 * Simula la ejecución física de una secuencia de tokens ya aceptada por el AP.
 * @param {object} instance - Configuración de la instancia (grilla, cajas, obstáculos, destinos).
 * @param {Array<{ index: number, lexeme: string, line: number, column: number }>} tokens
 * @param {Array<{ index: number, orden: string, state: string, stack: string, stackHeight: number }>} pdaTrace
 */
export function simulateWorld(instance, tokens, pdaTrace) {
  const obstacles = new Set(instance.obstaculos.map(([f, c]) => keyOf(f, c)));
  const targets = new Set(instance.destinos.map(([f, c]) => keyOf(f, c)));

  // Mapa celda "f,c" -> origen original "(f0,c0)" de la caja
  const boxes = new Map();
  for (const [f, c] of instance.cajasIniciales) {
    boxes.set(keyOf(f, c), posStr(f, c));
  }

  const initialGrid = renderGrid(instance, instance.robotInicial, new Map(boxes));

  let [fila, col] = instance.robotInicial;
  let carryingOrigin = null; // null = pinza vacía; string = origen de la caja cargada
  let movesEmpty = 0;
  let movesLoaded = 0;
  const executionLog = [];
  const trips = [];
  let currentTrip = null;
  let tripPath = []; // celdas recorridas en el viaje activo para visualización

  const makeSnapshot = (extra = {}) => ({
    robot: [fila, col],
    boxes: [...boxes.entries()],
    carryingOrigin,
    movesEmpty,
    movesLoaded,
    tripPath: [...tripPath],
    inTrip: currentTrip !== null,
    ...extra,
  });

  const snapshots = [makeSnapshot({ index: 0, orden: "(inicio)", estado_ap: "q0", pila: "Z0" })];

  const makePhysicalErrorResult = (physicalError) => {
    snapshots.push(
      makeSnapshot({
        index: physicalError.index,
        orden: physicalError.orden,
        estado_ap: pdaTrace[physicalError.index - 1]?.state ?? "q0",
        pila: pdaTrace[physicalError.index - 1]?.stack ?? "Z0",
        physicalError,
      })
    );
    return {
      physicalError,
      goalReached: false,
      goalDetails: null,
      executionLog,
      snapshots,
      initialGrid,
      finalGrid: renderGrid(instance, [fila, col], boxes),
      finalPosition: [fila, col],
      carrying: carryingOrigin !== null,
      movesEmpty,
      movesLoaded,
      trips,
    };
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const apStep = pdaTrace[i];
    const cmd = token.lexeme;

    if (DELTA_DIR[cmd]) {
      const [df, dc] = DELTA_DIR[cmd];
      const nf = fila + df;
      const nc = col + dc;

      if (nf < 1 || nf > instance.filas || nc < 1 || nc > instance.columnas) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoIntentado: posStr(nf, nc),
          destinoCoords: [nf, nc],
          reason: `Salida de la grilla ${instance.filas}x${instance.columnas} al ejecutar "${cmd}" desde ${posStr(fila, col)} hacia ${posStr(nf, nc)}.`,
        });
      }

      if (obstacles.has(keyOf(nf, nc))) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoIntentado: posStr(nf, nc),
          destinoCoords: [nf, nc],
          reason: `Intento de atravesar un obstáculo en ${posStr(nf, nc)} al ejecutar "${cmd}" desde ${posStr(fila, col)}.`,
        });
      }

      fila = nf;
      col = nc;
      if (carryingOrigin !== null) {
        movesLoaded += 1;
        if (currentTrip) {
          currentTrip.pasosVuelta += 1;
          if (tripPath.length > 1) tripPath.pop();
        }
      } else {
        movesEmpty += 1;
        if (currentTrip) {
          currentTrip.pasosIda += 1;
          tripPath.push([fila, col]);
        }
      }
    } else if (cmd === "viaje") {
      currentTrip = {
        numero: trips.length + 1,
        celdaInicioDestino: posStr(fila, col),
        celdaCaja: null,
        origenCaja: null,
        pasosIda: 0,
        pasosVuelta: 0,
      };
      tripPath = [[fila, col]];
    } else if (cmd === "agarrar") {
      const k = keyOf(fila, col);
      if (carryingOrigin !== null) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoCoords: [fila, col],
          reason: `No se puede ejecutar "agarrar" en ${posStr(fila, col)} porque la pinza ya transporta una caja.`,
        });
      }
      if (!boxes.has(k)) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoCoords: [fila, col],
          reason: `No se puede ejecutar "agarrar" en ${posStr(fila, col)} porque la celda está vacía (no hay caja).`,
        });
      }
      carryingOrigin = boxes.get(k);
      boxes.delete(k);
      if (currentTrip) {
        currentTrip.celdaCaja = posStr(fila, col);
        currentTrip.origenCaja = carryingOrigin;
      }
    } else if (cmd === "soltar") {
      const k = keyOf(fila, col);
      if (carryingOrigin === null) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoCoords: [fila, col],
          reason: `No se puede ejecutar "soltar" en ${posStr(fila, col)} porque la pinza está vacía.`,
        });
      }
      if (boxes.has(k)) {
        return makePhysicalErrorResult({
          index: token.index,
          orden: cmd,
          line: token.line,
          column: token.column,
          posicion: posStr(fila, col),
          destinoCoords: [fila, col],
          reason: `No se puede ejecutar "soltar" en ${posStr(fila, col)} porque ya existe una caja en esa celda (no se apilan cajas).`,
        });
      }
      boxes.set(k, carryingOrigin);
      carryingOrigin = null;
    } else if (cmd === "finviaje") {
      if (currentTrip) {
        trips.push(currentTrip);
        currentTrip = null;
        tripPath = [];
      }
    }

    executionLog.push({
      indice: token.index,
      orden: cmd,
      estado_ap: apStep.state,
      pila: apStep.stack,
      posicion: posStr(fila, col),
      carga: carryingOrigin !== null ? "con_caja" : "vacia",
    });

    snapshots.push(
      makeSnapshot({
        index: token.index,
        orden: cmd,
        estado_ap: apStep.state,
        pila: apStep.stack,
      })
    );
  }

  // Comprobación de la meta final
  const missingTargets = [...targets].filter((t) => !boxes.has(t));
  const extraBoxes = [...boxes.keys()].filter((b) => !targets.has(b));
  const robotAtFinal = fila === instance.robotFinal[0] && col === instance.robotFinal[1];
  const gripperEmpty = carryingOrigin === null;
  const goalReached =
    missingTargets.length === 0 &&
    extraBoxes.length === 0 &&
    robotAtFinal &&
    gripperEmpty;

  const issues = [];
  if (missingTargets.length > 0) {
    issues.push(`Destinos sin caja: ${missingTargets.map((k) => `(${k})`).join(", ")}.`);
  }
  if (extraBoxes.length > 0) {
    issues.push(`Cajas fuera de destino: ${extraBoxes.map((k) => `(${k})`).join(", ")}.`);
  }
  if (!robotAtFinal) {
    issues.push(
      `El robot terminó en ${posStr(fila, col)} y debía terminar en ${posStr(
        instance.robotFinal[0],
        instance.robotFinal[1]
      )}.`
    );
  }
  if (!gripperEmpty) {
    issues.push("El robot terminó con una caja en la pinza.");
  }

  return {
    physicalError: null,
    goalReached,
    goalDetails: goalReached
      ? "Todas las cajas están en los destinos obligatorios, el robot regresó a la posición final y la pinza está vacía."
      : issues.join(" "),
    executionLog,
    snapshots,
    initialGrid,
    finalGrid: renderGrid(instance, [fila, col], boxes),
    finalPosition: [fila, col],
    carrying: carryingOrigin !== null,
    movesEmpty,
    movesLoaded,
    trips,
  };
}
