/**
 * Orquestador en 3 fases estrictamente separadas:
 *   1. Validación léxica -> ERROR_LEXICO
 *   2. Reconocimiento sintáctico mediante el AP con pila explícita -> RECHAZO_AP
 *   3. Simulación física del mundo y comprobación de meta ->
 *      ERROR_FISICO | OBJETIVO_NO_ALCANZADO | MISION_RESUELTA
 *
 * Decisión arquitectónica: primero se valida toda la sintaxis con el AP para
 * aislar el protocolo formal de las condiciones físicas del mundo; solo los
 * programas aceptados por el AP se ejecutan en el simulador.
 */

import { tokenize } from "./lexer.js";
import { runPDA } from "./pda.js";
import { simulateWorld } from "./simulator.js";

export const RESULTADOS = {
  ERROR_LEXICO: "ERROR_LEXICO",
  RECHAZO_AP: "RECHAZO_AP",
  ERROR_FISICO: "ERROR_FISICO",
  OBJETIVO_NO_ALCANZADO: "OBJETIVO_NO_ALCANZADO",
  MISION_RESUELTA: "MISION_RESUELTA",
};

export function evaluateProgram(source, instance) {
  // Fase 1: Análisis léxico
  const lex = tokenize(source);
  if (!lex.ok) {
    return {
      status: RESULTADOS.ERROR_LEXICO,
      message: lex.error.message,
      lex,
      pda: null,
      sim: null,
    };
  }

  // Fase 2: Reconocimiento por el Autómata de Pila (protocolo completo)
  const pda = runPDA(lex.tokens);
  if (!pda.accepted) {
    return {
      status: RESULTADOS.RECHAZO_AP,
      message: `Rechazo del AP en token #${pda.rejection.index} ("${pda.rejection.lexeme}", estado ${pda.rejection.state}, tope ${pda.rejection.top}): ${pda.rejection.reason}`,
      lex,
      pda,
      sim: null,
    };
  }

  // Fase 3: Simulación del mundo 6x6 y verificación de meta
  const sim = simulateWorld(instance, lex.tokens, pda.trace);
  if (sim.physicalError) {
    return {
      status: RESULTADOS.ERROR_FISICO,
      message: `Error físico en token #${sim.physicalError.index} ("${sim.physicalError.orden}", posición ${sim.physicalError.posicion}): ${sim.physicalError.reason}`,
      lex,
      pda,
      sim,
    };
  }

  if (!sim.goalReached) {
    return {
      status: RESULTADOS.OBJETIVO_NO_ALCANZADO,
      message: `Programa válido y físicamente ejecutable, pero no alcanzó la meta. ${sim.goalDetails}`,
      lex,
      pda,
      sim,
    };
  }

  return {
    status: RESULTADOS.MISION_RESUELTA,
    message: sim.goalDetails,
    lex,
    pda,
    sim,
  };
}

/**
 * Serializa el registro de ejecución por token en formato CSV.
 */
export function formatExecutionCSV(executionLog) {
  const header = "indice,orden,estado_ap,pila,posicion,carga";
  const rows = executionLog.map(
    (r) => `${r.indice},${r.orden},${r.estado_ap},"${r.pila}","${r.posicion}",${r.carga}`
  );
  return [header, ...rows].join("\n") + "\n";
}

/**
 * Serializa el informe completo de una ejecución en texto plano legible.
 */
export function formatExecutionTXT(result, instance, programName = "") {
  const lines = [];
  lines.push("======================================================================");
  lines.push(`ROBOT RECOLECTOR — ${instance.grupo}`);
  if (programName) lines.push(`Programa:  ${programName}`);
  lines.push(`Resultado: ${result.status}`);
  lines.push(`Detalle:   ${result.message}`);
  lines.push("======================================================================");

  if (result.pda) {
    lines.push(
      `Tokens leídos: ${result.lex.tokens.length} | Estado final AP: ${result.pda.finalState} | Altura máx. pila (sin Z0): ${result.pda.maxStackHeight}`
    );
  }

  if (result.sim) {
    lines.push(
      `Movimientos sin carga: ${result.sim.movesEmpty} | Movimientos con carga: ${result.sim.movesLoaded} | Total movimientos: ${result.sim.movesEmpty + result.sim.movesLoaded}`
    );
    lines.push("");
    lines.push("--- Grilla Inicial ---");
    lines.push(result.sim.initialGrid);
    lines.push("");
    lines.push("--- Grilla Final ---");
    lines.push(result.sim.finalGrid);
    lines.push("");
    lines.push("--- Registro por token ---");
    lines.push("Idx | Orden      | Est | Pila (tope a izq.)          | Pos   | Carga");
    lines.push("----+------------+-----+-----------------------------+-------+---------");
    for (const r of result.sim.executionLog) {
      lines.push(
        `${String(r.indice).padStart(3)} | ${r.orden.padEnd(10)} | ${r.estado_ap.padEnd(3)} | ${r.pila.padEnd(27)} | ${r.posicion.padEnd(5)} | ${r.carga}`
      );
    }
  } else if (result.pda && result.pda.trace.length > 0) {
    lines.push("");
    lines.push("--- Traza del AP hasta el rechazo ---");
    lines.push("Idx | Orden      | Est | Pila (tope a izq.)");
    lines.push("----+------------+-----+-----------------------------");
    for (const r of result.pda.trace) {
      lines.push(
        `${String(r.index).padStart(3)} | ${r.orden.padEnd(10)} | ${r.state.padEnd(3)} | ${r.stack}`
      );
    }
  }

  return lines.join("\n") + "\n";
}
