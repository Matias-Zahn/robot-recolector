# Robot Recolector — Grupo 03 (*Bloque de pedido*)

Implementación en **JavaScript (Node.js)** del analizador léxico, reconocedor basado en **Autómata de Pila Determinista (APD) con pila explícita** y simulador del mundo $6 \times 6$ para el Trabajo Práctico de Promoción de *Fundamentos Teóricos de la Informática*.

## Requisitos
* **Node.js** 18 o superior (sin dependencias externas).

## Estructura del proyecto
* `instancias/grupo03.json`: definición parametrizable de la grilla del Grupo 03 (puede reemplazarse por cualquier otra instancia sin editar el código).
* `src/lexer.js`: validación de palabras reservadas y ubicación exacta del primer error léxico.
* `src/pda.js`: tabla de transiciones formal $\delta(q, a, X)$ y ejecución del APD con pila explícita (`Z0`, `AR`, `AB`, `IZ`, `DE`).
* `src/simulator.js`: simulación física del depósito $6 \times 6$ y verificación de meta.
* `src/runner.js`: orquestador en 3 fases separadas (`ERROR_LEXICO`, `RECHAZO_AP`, `ERROR_FISICO`, `OBJETIVO_NO_ALCANZADO`, `MISION_RESUELTA`) y exportadores CSV/TXT.
* `src/main.js`: interfaz CLI para evaluar cualquier programa de entrada.
* `src/run_tests.js`: ejecutor automático de las 11 pruebas obligatorias.
* `pruebas/`: 11 archivos de entrada (8 pruebas mínimas + 3 casos de borde).
* `registros/`: registro de ejecución completo de la solución del Grupo 03 en formatos CSV y TXT.

## Cómo reproducir la ejecución

Desde la carpeta `ROBOT/`:

### 1. Ejecutar la solución completa del Grupo 03 y regenerar los registros (CSV y TXT)
```bash
npm run solucion
```
*(Equivalente a: `node src/main.js pruebas/01_solucion_grupo03.txt --instancia instancias/grupo03.json --csv registros/solucion_grupo03.csv --txt registros/solucion_grupo03.txt`)*

### 2. Ejecutar la batería completa de 11 pruebas (8 mínimas + 3 casos de borde)
```bash
npm test
```
*(Equivalente a: `node src/run_tests.js`)*

### 3. Abrir el visualizador web interactivo (grilla 6×6 + APD + pila LIFO en vivo)
```bash
npm run web
```
Luego abrí **`http://localhost:3000`** en tu navegador. Permite reproducir paso a paso los 11 casos de prueba, editar o subir programas `.txt`, ver la pila explícita y el diagrama del APD animarse en tiempo real y descargar el registro en CSV.

### 4. Probar cualquier otro programa o instancia sin editar el código
```bash
node src/main.js ruta/al/programa.txt --instancia instancias/grupo03.json --csv salida.csv
```
