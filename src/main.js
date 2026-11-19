#!/usr/bin/env node
/**
 * Punto de entrada por línea de comandos (CLI).
 * Permite evaluar cualquier archivo de entrada e instancia JSON sin editar el reconocedor.
 *
 * Uso:
 *   node src/main.js <archivo_programa.txt> [--instancia instancias/grupo03.json] [--csv salida.csv] [--txt salida.txt]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateProgram,
  formatExecutionCSV,
  formatExecutionTXT,
} from "./runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INSTANCE = path.resolve(__dirname, "../instancias/grupo03.json");

function parseArgs(argv) {
  const args = { program: null, instance: DEFAULT_INSTANCE, csv: null, txt: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--instancia" && argv[i + 1]) {
      args.instance = argv[++i];
    } else if (a === "--csv" && argv[i + 1]) {
      args.csv = argv[++i];
    } else if (a === "--txt" && argv[i + 1]) {
      args.txt = argv[++i];
    } else if (!a.startsWith("--") && !args.program) {
      args.program = a;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.program) {
  console.error(
    "Uso: node src/main.js <archivo_programa.txt> [--instancia instancias/grupo03.json] [--csv salida.csv] [--txt salida.txt]"
  );
  process.exit(1);
}

const source = fs.readFileSync(args.program, "utf8");
const instance = JSON.parse(fs.readFileSync(args.instance, "utf8"));
const result = evaluateProgram(source, instance);

const txtReport = formatExecutionTXT(result, instance, args.program);
console.log(txtReport);

if (args.txt) {
  fs.mkdirSync(path.dirname(path.resolve(args.txt)), { recursive: true });
  fs.writeFileSync(args.txt, txtReport, "utf8");
  console.log(`Registro TXT guardado en: ${args.txt}`);
}

if (args.csv) {
  if (result.sim) {
    fs.mkdirSync(path.dirname(path.resolve(args.csv)), { recursive: true });
    fs.writeFileSync(args.csv, formatExecutionCSV(result.sim.executionLog), "utf8");
    console.log(`Registro CSV guardado en: ${args.csv}`);
  } else {
    console.log("No se generó CSV de ejecución porque la entrada no fue aceptada por el AP.");
  }
}
