/**
 * Autómata de Pila Determinista (APD) del protocolo del Robot Recolector.
 *
 * Definición formal M = (Q, Σ, Γ, δ, q0, Z0, F):
 *   Q  = { q0, q1, q2, q3, q4 }
 *   Σ  = { arriba, abajo, izquierda, derecha, agarrar, soltar, viaje, finviaje }
 *   Γ  = { Z0, AR, AB, IZ, DE }
 *   q0 = q0  (fuera de viaje, aún sin viajes completados)
 *   Z0 = Z0  (marcador de fondo de pila)
 *   F  = { q4 } (aceptación por estado final; exige al menos un viaje)
 *
 * Convención de escritura de la pila en los registros: tope a la izquierda.
 */

export const MOVIMIENTOS = new Set(["arriba", "abajo", "izquierda", "derecha"]);
export const ESTADOS_FINALES = new Set(["q4"]);
export const MARCADOR_FONDO = "Z0";

const SIMBOLO_PILA_IDA = {
  arriba: "AR",
  abajo: "AB",
  izquierda: "IZ",
  derecha: "DE",
};

const ESPERADO_VUELTA = {
  AR: "abajo",
  AB: "arriba",
  IZ: "derecha",
  DE: "izquierda",
};

/**
 * Función de transición δ(estado, simbolo, tope) -> { nextState, stackAction, pushSymbol? } | null
 * Implementa exactamente la tabla de transiciones formal del diseño.
 */
export function delta(state, symbol, top) {
  // q0 y q4: fuera de viaje (pila debe tener Z0 en el tope)
  if ((state === "q0" || state === "q4") && top === MARCADOR_FONDO) {
    if (MOVIMIENTOS.has(symbol)) {
      return { nextState: state, stackAction: "keep" };
    }
    if (symbol === "viaje") {
      return { nextState: "q1", stackAction: "keep" };
    }
    return null;
  }

  // q1: fase de ida (apila movimiento o transita a vuelta con agarrar)
  if (state === "q1") {
    if (MOVIMIENTOS.has(symbol)) {
      return {
        nextState: "q1",
        stackAction: "push",
        pushSymbol: SIMBOLO_PILA_IDA[symbol],
      };
    }
    if (symbol === "agarrar") {
      return { nextState: "q2", stackAction: "keep" };
    }
    return null;
  }

  // q2: fase de vuelta (desapila solo si el movimiento es el inverso del tope;
  //     solo admite soltar cuando el tope vuelve a ser Z0)
  if (state === "q2") {
    if (top !== MARCADOR_FONDO && ESPERADO_VUELTA[top] === symbol) {
      return { nextState: "q2", stackAction: "pop" };
    }
    if (symbol === "soltar" && top === MARCADOR_FONDO) {
      return { nextState: "q3", stackAction: "keep" };
    }
    return null;
  }

  // q3: cierre obligatorio del bloque con finviaje
  if (state === "q3" && top === MARCADOR_FONDO) {
    if (symbol === "finviaje") {
      return { nextState: "q4", stackAction: "keep" };
    }
    return null;
  }

  return null;
}

/**
 * Formatea la pila explícita con el tope a la izquierda (ej: "DE AR AR AR Z0").
 * Internamente stack[stack.length - 1] es el tope.
 */
export function formatStack(stack) {
  return [...stack].reverse().join(" ");
}

/**
 * Explica el motivo del rechazo para diagnóstico claro en pruebas e informe.
 */
function describeRejection(state, token, top) {
  const sym = token.lexeme;
  if (state === "q0" || state === "q4") {
    if (sym === "agarrar" || sym === "soltar" || sym === "finviaje") {
      return `La orden "${sym}" no está permitida fuera de un bloque viaje.`;
    }
  }
  if (state === "q1") {
    if (sym === "viaje") return "No se permiten viajes anidados dentro de otro viaje.";
    if (sym === "soltar") return 'No se puede ejecutar "soltar" antes de "agarrar".';
    if (sym === "finviaje") return 'No se puede cerrar con "finviaje" sin completar agarrar y soltar.';
  }
  if (state === "q2") {
    if (sym === "agarrar") return 'No se permite un segundo "agarrar" dentro del mismo viaje.';
    if (sym === "soltar" && top !== MARCADOR_FONDO) {
      return `Se intentó "soltar" antes de completar el camino inverso (tope de pila: ${top}, se esperaba "${ESPERADO_VUELTA[top]}").`;
    }
    if (MOVIMIENTOS.has(sym) && top !== MARCADOR_FONDO) {
      return `Movimiento de regreso "${sym}" no corresponde al inverso esperado "${ESPERADO_VUELTA[top]}" (tope de pila: ${top}).`;
    }
    if (MOVIMIENTOS.has(sym) && top === MARCADOR_FONDO) {
      return `Movimiento extra "${sym}" al volver cuando el camino inverso ya terminó (se esperaba "soltar").`;
    }
    if (sym === "finviaje") return 'No se puede cerrar con "finviaje" antes de ejecutar "soltar".';
    if (sym === "viaje") return "No se permiten viajes anidados durante el regreso.";
  }
  if (state === "q3") {
    return `Después de "soltar" debe ejecutarse obligatoriamente "finviaje", pero se leyó "${sym}".`;
  }
  return `No existe transición definida para δ(${state}, ${sym}, ${top}).`;
}

/**
 * Ejecuta el APD completo sobre la secuencia de tokens usando una pila explícita.
 * @param {Array<{ index: number, lexeme: string, line: number, column: number }>} tokens
 */
export function runPDA(tokens) {
  let state = "q0";
  const stack = [MARCADOR_FONDO];
  const trace = [];
  let maxStackHeight = 0;

  for (const token of tokens) {
    const prevState = state;
    const prevTop = stack[stack.length - 1];
    const transition = delta(state, token.lexeme, prevTop);

    if (!transition) {
      return {
        accepted: false,
        finalState: state,
        finalStack: formatStack(stack),
        maxStackHeight,
        trace,
        rejection: {
          index: token.index,
          lexeme: token.lexeme,
          line: token.line,
          column: token.column,
          state: prevState,
          top: prevTop,
          stack: formatStack(stack),
          reason: describeRejection(prevState, token, prevTop),
        },
      };
    }

    if (transition.stackAction === "push") {
      stack.push(transition.pushSymbol);
    } else if (transition.stackAction === "pop") {
      stack.pop();
    }
    state = transition.nextState;

    const currentHeight = stack.length - 1; // sin contar Z0
    if (currentHeight > maxStackHeight) {
      maxStackHeight = currentHeight;
    }

    trace.push({
      index: token.index,
      orden: token.lexeme,
      prevState,
      prevTop,
      state,
      stack: formatStack(stack),
      stackHeight: currentHeight,
    });
  }

  if (!ESTADOS_FINALES.has(state)) {
    let reason;
    if (tokens.length === 0) {
      reason = "Entrada vacía: el lenguaje exige al menos un viaje completo (terminó en estado no final q0).";
    } else if (state === "q0") {
      reason = "Fin de entrada sin haber realizado ningún viaje (el lenguaje exige al menos un viaje completo).";
    } else if (state === "q1") {
      reason = 'Fin de entrada dentro de un viaje en fase de ida (faltan "agarrar", regreso, "soltar" y "finviaje").';
    } else if (state === "q2") {
      reason = 'Fin de entrada dentro de un viaje en fase de vuelta (faltan completar regreso, "soltar" y "finviaje").';
    } else if (state === "q3") {
      reason = 'Viaje sin cierre obligatorio "finviaje" al finalizar la entrada.';
    } else {
      reason = `Fin de entrada en estado no final ${state}.`;
    }

    return {
      accepted: false,
      finalState: state,
      finalStack: formatStack(stack),
      maxStackHeight,
      trace,
      rejection: {
        index: tokens.length + 1,
        lexeme: "<EOF>",
        line: tokens.length > 0 ? tokens[tokens.length - 1].line : 1,
        column: tokens.length > 0 ? tokens[tokens.length - 1].column : 1,
        state,
        top: stack[stack.length - 1],
        stack: formatStack(stack),
        reason,
      },
    };
  }

  return {
    accepted: true,
    finalState: state,
    finalStack: formatStack(stack),
    maxStackHeight,
    trace,
    rejection: null,
  };
}
