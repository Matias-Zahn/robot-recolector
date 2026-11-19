/**
 * Analizador léxico para el lenguaje del Robot Recolector.
 * Valida las 8 palabras reservadas ignorando espacios y saltos de línea,
 * y reporta la ubicación exacta (índice, línea, columna) del primer error léxico.
 */

export const PALABRAS_RESERVADAS = new Set([
  "arriba",
  "abajo",
  "izquierda",
  "derecha",
  "agarrar",
  "soltar",
  "viaje",
  "finviaje",
]);

/**
 * Tokeniza el texto fuente preservando línea, columna e índice (1-based).
 * @param {string} source
 * @returns {{
 *   ok: boolean,
 *   tokens: Array<{ index: number, lexeme: string, line: number, column: number }>,
 *   error: { index: number, lexeme: string, line: number, column: number, message: string } | null
 * }}
 */
export function tokenize(source) {
  const tokens = [];
  const lines = source.split(/\r?\n/);
  let tokenIndex = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx];
    const regex = /\S+/g;
    let match;

    while ((match = regex.exec(lineText)) !== null) {
      tokenIndex += 1;
      const lexeme = match[0];
      const line = lineIdx + 1;
      const column = match.index + 1;

      if (!PALABRAS_RESERVADAS.has(lexeme)) {
        return {
          ok: false,
          tokens,
          error: {
            index: tokenIndex,
            lexeme,
            line,
            column,
            message: `Token desconocido "${lexeme}" en token #${tokenIndex} (línea ${line}, columna ${column}).`,
          },
        };
      }

      tokens.push({ index: tokenIndex, lexeme, line, column });
    }
  }

  return { ok: true, tokens, error: null };
}
