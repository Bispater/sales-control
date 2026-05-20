export interface RegistroVenta {
  tipoMovimiento: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaEmision: string;
  trackingNumber: string;
  fechaHoraVenta: string;
  sucursal: string;
  vendedor: string;
  nombreCliente: string;
  clienteRut: string;
  emailCliente: string;
  clienteDireccion: string;
  clienteComuna: string;
  clienteCiudad: string;
  listaPrecio: string;
  tipoEntrega: string;
  moneda: string;
  tipoProducto: string;
  sku: string;
  producto: string;
  variante: string;
  otrosAtributos: string;
  marca: string;
  detallePack: string;
  precioLista: number;
  precioNetoUnitario: number;
  precioBrutoUnitario: number;
  cantidad: number;
  ventaTotalNeta: number;
  totalImpuestos: number;
  ventaTotalBruta: number;
  nombreDescuento: string;
  descuentoNeto: number;
  descuentoBruto: number;
  pctDescuento: number;
  costoNetoUnitario: number;
  costoTotalNeto: number;
  margen: number;
  pctMargen: number;
  // Derivados desde fechaEmision en la ingesta para facilitar agregaciones.
  anio: number;
  mes: number;
  dia: number;
}

export interface DatasetInfo {
  anio: number;
  totalFilas: number;
  ultimaCarga: string;
}

export interface ProgresoCarga {
  fase: 'parseando' | 'comprimiendo' | 'subiendo' | 'completado';
  pct: number;
  filasProcesadas?: number;
  totalFilas?: number;
  chunkActual?: number;
  totalChunks?: number;
  mensaje?: string;
}

export interface ClienteCategoria {
  rut: string;
  nombre: string;
  categoria: string;
}

export interface MetaVendedor {
  vendedor: string;
  anio: number;
  mes: number;
  metaClp: number;
  categoria: string;
}

export const MESES_CSV = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

export const COLUMNAS_CSV: Record<string, keyof RegistroVenta> = {
  'Tipo Movimiento': 'tipoMovimiento',
  'Tipo de Documento': 'tipoDocumento',
  'Numero del documento': 'numeroDocumento',
  'Fecha de Emisión': 'fechaEmision',
  'Tracking number': 'trackingNumber',
  'Fecha y Hora Venta': 'fechaHoraVenta',
  'Sucursal': 'sucursal',
  'Vendedor': 'vendedor',
  'Nombre Cliente': 'nombreCliente',
  'Cliente RUT': 'clienteRut',
  'Email Cliente': 'emailCliente',
  'Cliente Dirección': 'clienteDireccion',
  'Cliente Comuna': 'clienteComuna',
  'Cliente Ciudad': 'clienteCiudad',
  'Lista de Precio': 'listaPrecio',
  'Tipo de entrega': 'tipoEntrega',
  'Moneda': 'moneda',
  'Tipo de Producto / Servicio': 'tipoProducto',
  'SKU': 'sku',
  'Producto / Servicio': 'producto',
  'Variante': 'variante',
  'Otros Atributos': 'otrosAtributos',
  'Marca': 'marca',
  'Detalle de Productos/Servicios Pack/Promo': 'detallePack',
  'Precio de Lista': 'precioLista',
  'Precio Neto Unitario': 'precioNetoUnitario',
  'Precio Bruto Unitario': 'precioBrutoUnitario',
  'Cantidad': 'cantidad',
  'Venta Total Neta': 'ventaTotalNeta',
  'Total Impuestos': 'totalImpuestos',
  'Venta Total Bruta': 'ventaTotalBruta',
  'Nombre de dcto': 'nombreDescuento',
  'Descuento Neto': 'descuentoNeto',
  'Descuento Bruto': 'descuentoBruto',
  '% Descuento': 'pctDescuento',
  'Costo neto unitario': 'costoNetoUnitario',
  'Costo Total Neto': 'costoTotalNeto',
  'Margen': 'margen',
  '% Margen': 'pctMargen',
};

export const CAMPOS_NUMERICOS: (keyof RegistroVenta)[] = [
  'precioLista', 'precioNetoUnitario', 'precioBrutoUnitario', 'cantidad',
  'ventaTotalNeta', 'totalImpuestos', 'ventaTotalBruta',
  'descuentoNeto', 'descuentoBruto', 'pctDescuento',
  'costoNetoUnitario', 'costoTotalNeto', 'margen', 'pctMargen',
];
