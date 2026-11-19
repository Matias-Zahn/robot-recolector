#!/usr/bin/env node
/**
 * Ejecutor de la batería completa de 11 pruebas (8 pruebas mínimas + 3 casos de borde).
 * Verifica que cada entrada produzca exactamente la categoría de resultado esperada.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateProgram, RESULTADOS } from "./runner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const instance = JSON.parse(
  fs.readFileSync(path.join(ROOT, "instancias/grupo03.json"), "utf8")
);

const CASOS = [
  {
    id: 1,
    nombre: "Solución completa correcta (Grupo 03)",
    archivo: "pruebas/01_solucion_grupo03.txt",
    esperado: RESULTADOS.MISION_RESUELTA,
  },
  {
    id: 2,
    nombre: "Regreso con orden que no corresponde al camino inverso",
    archivo: "pruebas/02_regreso_inverso_incorrecto.txt",
    esperado: RESULTADOS.RECHAZO_AP,
  },
  {
    id: 3,
    nombre: "soltar antes de terminar el regreso",
    archivo: "pruebas/03_soltar_antes_de_regresar.txt",
    esperado: RESULTADOS.RECHAZO_AP,
  },
  {
    id: 4,
    nombre: "Viaje sin cierre finviaje",
    archivo: "pruebas/04_viaje_sin_finviaje.txt",
    esperado: RESULTADOS.RECHAZO_AP,
  },
  {
    id: 5,
    nombre: "Segundo agarrar en el mismo viaje",
    archivo: "pruebas/05_segundo_agarrar.txt",
    esperado: RESULTADOS.RECHAZO_AP,
  },
  {
    id: 6,
    nombre: "Programa admitido por el AP que intenta atravesar un obstáculo",
    archivo: "pruebas/06_atravesar_obstaculo.txt",
    esperado: RESULTADOS.ERROR_FISICO,
  },
  {
    id: 7,
    nombre: "Programa admitido por el AP que intenta agarrar en una celda vacía",
    archivo: "pruebas/07_agarrar_celda_vacia.txt",
    esperado: RESULTADOS.ERROR_FISICO,
  },
  {
    id: 8,
    nombre: "Programa admitido por el AP y físicamente ejecutable que no alcanza la meta",
    archivo: "pruebas/08_valido_no_alcanza_meta.txt",
    esperado: RESULTADOS.OBJETIVO_NO_ALCANZADO,
  },
  {
    id: 9,
    nombre: "Caso de borde: token desconocido",
    archivo: "pruebas/09_borde_token_desconocido.txt",
    esperado: RESULTADOS.ERROR_LEXICO,
  },
  {
    id: 10,
    nombre: "Caso de borde: entrada vacía",
    archivo: "pruebas/10_borde_entrada_vacia.txt",
    esperado: RESULTADOS.RECHAZO_AP,
  },
  {
    id: 11,
    nombre: "Caso de borde: salida de la grilla",
    archivo: "pruebas/11_borde_salida_grilla.txt",
    esperado: RESULTADOS.ERROR_FISICO,
  },
];

let passed = 0;
console.log("======================================================================");
console.log(`BATERÍA DE PRUEBAS — ${instance.grupo}`);
console.log("======================================================================\n");

for (const caso of CASOS) {
  const fullPath = path.join(ROOT, caso.archivo);
  const source = fs.readFileSync(fullPath, "utf8");
  const res = evaluateProgram(source, instance);
  const ok = res.status === caso.esperado;
  if (ok) passed += 1;

  console.log(
    `[${ok ? "OK" : "FAIL"}] Prueba ${String(caso.id).padStart(2, "0")}: ${caso.nombre}`
  );
  console.log(`       Archivo:   ${caso.archivo}`);
  console.log(`       Esperado:  ${caso.esperado}`);
  console.log(`       Obtenido:  ${res.status}`);
  console.log(`       Detalle:   ${res.message}\n`);
}

console.log("======================================================================");
console.log(`Resumen: ${passed}/${CASOS.length} pruebas superadas.`);
console.log("======================================================================");

if (passed !== CASOS.length) {
  process.exit(1);
}
