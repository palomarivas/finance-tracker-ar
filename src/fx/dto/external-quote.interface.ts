/** Shape of one quote from dolarapi.com `GET /v1/dolares`. Prices are pesos (floats). */
export interface DolarApiQuote {
  casa: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string;
}

/** Shape from ArgentinaDatos `GET /v1/cotizaciones/dolares/{casa}/{YYYY/MM/DD}`. */
export interface ArgentinaDatosQuote {
  casa: string;
  nombre?: string;
  compra: number | null;
  venta: number | null;
  fecha: string;
}
