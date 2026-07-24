/** Digito verificador de CUIT/CUIL argentino (algoritmo modulo 11 de AFIP). */
export function cuitValido(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const limpio = cuit.replace(/\D/g, "");
  if (limpio.length !== 11) return false;

  const digitos = limpio.split("").map(Number);
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = multiplicadores.reduce((acumulado, multiplicador, indice) => acumulado + multiplicador * digitos[indice], 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;

  return verificador === digitos[10];
}
