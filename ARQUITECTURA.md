# Facturas AR IA — Documento de Arquitectura

Versión 1.0 — 2026-07-24

## 1. Objetivo

Aplicación web para que personal administrativo suba facturas argentinas (PDF o imagen) y el sistema:

1. Lea automáticamente cada comprobante con IA (OCR + extracción estructurada).
2. Extraiga todos los datos disponibles (emisor, receptor, comprobante, impuestos, productos).
3. Los muestre para revisión y corrección manual.
4. Los guarde en base de datos.
5. Permita exportar todo a un Excel profesional (Compras, Ventas, Productos, Errores).

**No es un ERP.** No hay compras/ventas como proceso de negocio, no hay stock, no hay clientes/proveedores como entidades de gestión, no hay contabilidad. Solo carga → lectura → revisión → guardado → export. Cualquier campo que no forme parte de ese camino no entra en el alcance del MVP.

## 2. Arquitectura

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   Browser    │◄────►│  Next.js (Vercel)     │◄────►│ Supabase          │
│  Next.js UI  │      │  App Router + API     │      │ - Postgres        │
│  React/TS    │      │  Route Handlers       │      │ - Storage         │
│  Tailwind    │      │                       │      │ - Auth (opcional) │
│  shadcn/ui   │      └──────────┬────────────┘      └─────────────────┘
└─────────────┘                 │
                                 ▼
                        ┌─────────────────┐
                        │   OpenAI API     │
                        │ - Vision (lectura)│
                        │ - GPT (estructura)│
                        └─────────────────┘
```

- **Un solo deploy** (Next.js en Vercel): la UI y el backend viven en el mismo proyecto (Route Handlers de `app/api/*`), sin servicio backend separado.
- **Supabase Postgres** guarda todo el dato estructurado. **Supabase Storage** guarda los archivos originales (PDF/imagen) con nombre normalizado.
- **OpenAI Vision** convierte cada página del comprobante en texto/estructura legible; **GPT** (con salida JSON estructurada — `response_format: json_schema`) arma el objeto final validando contra el modelo de datos.
- El procesamiento de cada archivo es **asincrónico por archivo, pero secuencial dentro de un lote** para no disparar cientos de llamados a OpenAI en paralelo y quedarse sin rate limit; el usuario ve una barra de progreso por archivo.

### Decisiones de arquitectura clave

| Decisión | Por qué |
|---|---|
| Route Handlers de Next.js en vez de backend separado (Express/Nest) | Un solo repo, un solo deploy, menos infraestructura — coherente con "no es un ERP", hay que poder mantenerlo con poco esfuerzo. |
| Supabase (Postgres + Storage) en vez de un ORM+DB propios | Auth, Storage y Postgres integrados de fábrica, con RLS para aislar datos por usuario sin escribir esa capa a mano. |
| GPT con `json_schema` estructurado en vez de parsear texto libre | Elimina una clase entera de bugs de parseo; el modelo devuelve exactamente el shape que la base espera, campo por campo, o `null` si no encuentra el dato (nunca inventa). |
| Un archivo = una factura (1:1) | Simplifica el modelo. Si mañana aparece el caso de "un PDF con 3 facturas adentro" se resuelve como mejora incremental, no de entrada. |
| Sin motor de reglas configurable | A diferencia del proyecto de conciliación bancaria, acá las reglas de validación (CUIT, IVA, duplicados) son fijas y conocidas de antemano (son reglas de AFIP), no hace falta que el usuario las configure. |
| **Supabase Auth en vez de `password_hash` propio** (ajustado en el paso 3, ver §3) | Manejar contraseñas a mano (hashing, reseteo, expiración de sesión) es una superficie de riesgo de seguridad enorme para un beneficio nulo — Supabase Auth ya lo resuelve, probado en producción por miles de proyectos. `public.usuarios` pasa a ser una tabla de **perfil** (nombre, rol) que referencia `auth.users`, no la tabla de login. |

## 3. Base de datos (Supabase Postgres)

Cuatro tablas, como pediste, más una tabla de soporte (`sesiones_carga`) para agrupar un lote de subida — necesaria para poder aplicar "¿Compras o Ventas?" a todo un lote de una sola vez sin repetir la pregunta por archivo.

### `usuarios`

Tabla de **perfil**, no de login: la autenticación (contraseña, sesión, tokens) la maneja Supabase Auth (`auth.users`), que ya viene con el proyecto de Supabase. `public.usuarios.id` referencia `auth.users.id` 1:1, y se crea automáticamente via trigger cuando alguien se registra.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK, FK → auth.users | |
| email | text | copiado de auth.users para no tener que hacer join al listar |
| nombre | text | |
| rol | text | `admin` \| `operador` (alcanza con dos roles) |
| activo | boolean | default true |
| creado_en | timestamptz | default now() |

### `sesiones_carga`

Agrupa los archivos subidos juntos (un "lote"), para guardar la clasificación Compras/Ventas elegida una sola vez.

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| usuario_id | uuid FK → usuarios | quién subió |
| clasificacion | text | `compra` \| `venta` |
| creado_en | timestamptz | |

### `archivos`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| sesion_carga_id | uuid FK → sesiones_carga | |
| nombre_original | text | nombre tal cual lo subió el usuario |
| nombre_normalizado | text | `AAAA-MM-DD - Tipo - Proveedor - PtoVta-Numero.pdf` (se completa recién cuando termina la extracción; hasta entonces usa un nombre temporal) |
| ruta_storage | text | path en Supabase Storage |
| tipo_mime | text | `application/pdf`, `image/jpeg`, etc. |
| tamano_bytes | integer | |
| estado | text | `pendiente` \| `procesando` \| `procesado` \| `error` |
| error_mensaje | text nullable | si `estado = error` |
| creado_en | timestamptz | |

### `facturas`

Una fila por comprobante procesado. Todos los campos de emisor/receptor/comprobante/impuestos van acá (desnormalizado a propósito — no hay tabla de "proveedores" ni "clientes": esto no es un ERP, y un proveedor puede escribir su razón social distinto en cada factura sin que eso sea un problema a resolver).

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| archivo_id | uuid FK → archivos, unique | 1:1 |
| sesion_carga_id | uuid FK → sesiones_carga | denormalizado para filtrar rápido por compra/venta |
| **Comprobante** | | |
| tipo_comprobante | text | `factura_a`, `factura_b`, `factura_c`, `factura_m`, `factura_e`, `nc_a`, `nc_b`, `nc_c`, `nd_a`, `nd_b`, `nd_c`, `recibo`, `ticket`, `otro` |
| letra | text | `A`,`B`,`C`,`M`,`E`, nullable |
| codigo_afip | text | código de comprobante AFIP (referencia, ver §9) |
| punto_venta | text | |
| numero | text | |
| fecha_emision | date | |
| fecha_pago | date nullable | |
| periodo_desde | date nullable | |
| periodo_hasta | date nullable | |
| moneda | text | `ARS`, `USD`, etc. |
| condicion_venta | text | contado / cta cte / etc. |
| **Emisor** | | |
| emisor_razon_social | text | |
| emisor_nombre_comercial | text nullable | |
| emisor_cuit | text | |
| emisor_direccion | text nullable | |
| emisor_localidad | text nullable | |
| emisor_provincia | text nullable | |
| emisor_codigo_postal | text nullable | |
| emisor_condicion_iva | text nullable | |
| emisor_ingresos_brutos | text nullable | |
| emisor_fecha_inicio_actividades | date nullable | |
| **Receptor (Cliente)** | | |
| cliente_razon_social | text nullable | |
| cliente_cuit | text nullable | |
| cliente_direccion | text nullable | |
| cliente_localidad | text nullable | |
| cliente_provincia | text nullable | |
| cliente_condicion_iva | text nullable | |
| **Datos fiscales** | | |
| cae | text nullable | |
| cae_vencimiento | date nullable | |
| qr_data | text nullable | contenido crudo del QR (para trazabilidad/futura verificación contra AFIP) |
| **Impuestos** (todos `numeric(14,2)` nullable — vacío si no existe, nunca 0 inventado) | | |
| importe_neto_gravado | numeric | |
| iva_27, iva_21, iva_105, iva_5, iva_25 | numeric | |
| iva_exento, iva_no_gravado | numeric | |
| percepcion_iva, percepcion_iibb, percepcion_municipal | numeric | |
| impuestos_internos | numeric | |
| otros_tributos | numeric | |
| descuentos | numeric | |
| total | numeric | |
| **Meta-datos de procesamiento** | | |
| confianza_porcentaje | integer | 0–100 |
| estado | text | `revision` \| `validada` \| `error` |
| duplicada | boolean | default false |
| errores_detectados | jsonb | array de `{codigo, mensaje}` (ver §8) |
| extraccion_raw | jsonb | salida cruda de GPT, para auditoría/debug sin volver a llamar a la IA |
| observaciones | text nullable | campo libre editable por el usuario |
| creado_en, actualizado_en | timestamptz | |

Índices: `(emisor_cuit, tipo_comprobante, punto_venta, numero)` para detectar duplicados; `fecha_emision`; `sesion_carga_id`.

### `productos`

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| factura_id | uuid FK → facturas | |
| orden | integer | posición en la factura, para mantener el orden original |
| codigo | text nullable | |
| descripcion | text | |
| cantidad | numeric nullable | |
| unidad | text nullable | |
| precio_unitario | numeric nullable | |
| bonificacion_pct | numeric nullable | |
| bonificacion_monto | numeric nullable | |
| alicuota_iva | numeric nullable | |
| subtotal | numeric nullable | |
| subtotal_con_iva | numeric nullable | |

### RLS (Row Level Security)

Todas las tablas con policy `usuario_id = auth.uid()` (a través de `sesiones_carga.usuario_id`, con join implícito) para que cada usuario solo vea lo que subió — excepto rol `admin`, que ve todo. Se define en la migración SQL de Supabase, no en el código de la app.

## 4. Pantallas

1. **Login** — email/usuario + contraseña, botón "Ingresar". Sin registro público (los usuarios los crea un admin).
2. **Dashboard** — botón grande "Cargar Facturas", botón "Exportar Excel", tabla de últimas facturas procesadas con filtros (fecha, proveedor, tipo, número, estado) y badge de confianza por fila.
3. **Carga de Facturas** — dropzone (arrastrar/seleccionar PDFs e imágenes, múltiples), pregunta "¿Compras o Ventas?" antes de confirmar la carga, barra de progreso por archivo, botón cancelar. Al terminar cada archivo, redirige a Revisión (o a una lista de "pendientes de revisión" si subió varios).
4. **Revisión** — dos paneles: vista previa del PDF/imagen a la izquierda, formulario editable con todos los datos detectados a la derecha (agrupados en secciones: Comprobante, Emisor, Receptor, Impuestos, Productos), badge de confianza y de errores de validación arriba, botón "Guardar".

## 5. Flujo end-to-end

```
1. Usuario entra a "Cargar Facturas"
2. Elige Compras o Ventas → crea sesiones_carga
3. Arrastra N archivos → cada uno sube a Supabase Storage → crea fila en archivos (estado=pendiente)
4. Por cada archivo (secuencial):
   a. estado=procesando
   b. Vision (OpenAI) convierte la/s pagina/s en texto+layout
   c. GPT (json_schema) estructura los datos → objeto factura + productos[]
   d. Validaciones (§8) corren sobre el objeto → errores_detectados[]
   e. Calculo de confianza (§7)
   f. Se guarda factura + productos en Postgres
   g. Se renombra el archivo en Storage (nombre_normalizado)
   h. estado=procesado (o error si Vision/GPT fallan)
5. Usuario es llevado a Revisión de cada factura procesada
6. Usuario corrige lo que haga falta → Guardar → estado=validada
7. Desde el Dashboard, "Exportar Excel" → genera el .xlsx con las 4 hojas
```

## 6. Modelo de datos (TypeScript)

Los tipos de `facturas`/`productos`/`archivos` se generan con `supabase gen types typescript` a partir del schema SQL (fuente de verdad = la base, no un archivo de tipos escrito a mano que se puede desincronizar). El documento de tipos "de referencia" que se comparte con el frontend vive en `src/lib/tipos.ts` y son alias sobre los tipos generados, para no importar el archivo generado (larguísimo) desde todos lados.

```ts
export type TipoComprobante =
  | "factura_a" | "factura_b" | "factura_c" | "factura_m" | "factura_e"
  | "nc_a" | "nc_b" | "nc_c" | "nd_a" | "nd_b" | "nd_c"
  | "recibo" | "ticket" | "otro";

export type EstadoFactura = "revision" | "validada" | "error";
export type Clasificacion = "compra" | "venta";

export interface ErrorValidacion {
  codigo: string;       // "CUIT_INVALIDO", "TOTAL_INCORRECTO", ...
  mensaje: string;       // texto para mostrar al usuario
  campo?: string;        // que campo del formulario resaltar, si aplica
}
```

## 7. Cálculo de confianza

Fórmula transparente (no "caja negra"), para que el usuario entienda por qué una factura quedó en rojo:

- Se parte de 100.
- Por cada **campo crítico** vacío (CUIT emisor, tipo de comprobante, fecha de emisión, número, total) → **-15**.
- Por cada **campo secundario** vacío que normalmente existe en ese tipo de comprobante (ej. CAE en una factura electrónica) → **-5**.
- Por cada **error de validación** de §8 detectado → **-10** (duplicada pesa más, ver abajo).
- Factura duplicada detectada → directamente confianza tope en **40** (no importa cuánto sume lo demás, tiene que llamar la atención).
- Resultado con piso en 0 y techo en 100.

Semáforo: **95–100 verde**, **80–94 amarillo**, **<80 rojo** (regla ya definida por el usuario).

## 8. Validaciones

| Código | Chequeo |
|---|---|
| `CUIT_INVALIDO` | Dígito verificador del CUIT (algoritmo módulo 11 de AFIP) no cierra |
| `FACTURA_DUPLICADA` | Ya existe una factura con mismo `emisor_cuit` + `tipo_comprobante` + `punto_venta` + `numero` |
| `IMAGEN_BORROSA` | Vision reporta confianza de lectura baja, o el archivo es una imagen de muy baja resolución (< umbral de px) |
| `CAMPOS_FALTANTES` | Falta algún campo obligatorio para ese tipo de comprobante |
| `TOTAL_INCORRECTO` | `total` ≠ `neto_gravado + suma(IVAs) + percepciones + otros_tributos - descuentos` (tolerancia $1 por redondeo) |
| `IVA_INCORRECTO` | Alícuota de IVA de algún producto no corresponde al importe de IVA discriminado en el encabezado |
| `FACTURA_INCOMPLETA` | Vision no pudo leer todas las páginas o el PDF parece cortado |
| `DATOS_INCONSISTENTES` | Ej. fecha de vencimiento CAE anterior a la fecha de emisión |

Todas corren en el backend, en `src/lib/validaciones/*`, después de la extracción y antes de guardar. El resultado queda en `facturas.errores_detectados` y también decide el `estado` inicial (si hay errores críticos, arranca en `revision` obligatoria aunque la confianza sea alta).

## 9. Tipos de comprobante y código AFIP

Tabla de referencia (se valida contra la tabla oficial de AFIP al implementar, esto es la base):

| Comprobante | Letra | Código AFIP (referencia) |
|---|---|---|
| Factura | A | 001 |
| Nota de Débito | A | 002 |
| Nota de Crédito | A | 003 |
| Factura | B | 006 |
| Nota de Débito | B | 007 |
| Nota de Crédito | B | 008 |
| Factura | C | 011 |
| Nota de Débito | C | 012 |
| Nota de Crédito | C | 013 |
| Factura | M | 051 |
| Nota de Débito | M | 052 |
| Nota de Crédito | M | 053 |
| Factura | E (exportación) | 019 |
| Recibo / Ticket | — | según punto de venta/controlador fiscal |

Vive como constante en `src/lib/comprobantes.ts`; el LLM recibe esta tabla en el prompt para poder inferir `codigo_afip` a partir de la letra/tipo que lea, sin tener que "adivinarlo" desde cero.

## 10. APIs (Route Handlers de Next.js)

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/auth/login` | Login, setea cookie de sesión |
| POST | `/api/auth/logout` | Cierra sesión |
| POST | `/api/sesiones-carga` | Crea una sesión de carga (compra/venta) |
| POST | `/api/sesiones-carga/[id]/archivos` | Sube uno o más archivos a Storage + crea filas en `archivos` |
| POST | `/api/archivos/[id]/procesar` | Dispara Vision+GPT para un archivo, guarda `factura`+`productos` |
| GET | `/api/facturas` | Lista con filtros (`fecha`, `proveedor`, `tipo`, `numero`, `estado`, `clasificacion`) + paginación |
| GET | `/api/facturas/[id]` | Detalle completo (factura + productos + url firmada del archivo) |
| PATCH | `/api/facturas/[id]` | Edición manual de campos en Revisión |
| POST | `/api/facturas/[id]/validar` | Marca `estado = validada` |
| DELETE | `/api/facturas/[id]` | Borrado (soft-delete a evaluar según necesidad real) |
| GET | `/api/export/excel` | Genera y descarga el `.xlsx` (con los mismos filtros que el listado) |

## 11. Organización de carpetas

```
facturas-ar-ia/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── cargar/page.tsx
│   │   │   └── facturas/[id]/page.tsx        # Revisión
│   │   └── api/
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── sesiones-carga/route.ts
│   │       ├── sesiones-carga/[id]/archivos/route.ts
│   │       ├── archivos/[id]/procesar/route.ts
│   │       ├── facturas/route.ts
│   │       ├── facturas/[id]/route.ts
│   │       ├── facturas/[id]/validar/route.ts
│   │       └── export/excel/route.ts
│   ├── components/
│   │   ├── ui/                                # shadcn/ui
│   │   ├── dashboard/TablaFacturas.tsx
│   │   ├── dashboard/FiltrosFacturas.tsx
│   │   ├── carga/Dropzone.tsx
│   │   ├── carga/ProgresoCarga.tsx
│   │   ├── revision/VistaPrevia.tsx
│   │   ├── revision/FormularioFactura.tsx
│   │   ├── revision/TablaProductos.tsx
│   │   └── shared/BadgeConfianza.tsx
│   ├── lib/
│   │   ├── supabase/cliente.ts
│   │   ├── supabase/servidor.ts
│   │   ├── openai/vision.ts
│   │   ├── openai/extraccion.ts
│   │   ├── openai/prompts.ts
│   │   ├── excel/generar.ts
│   │   ├── validaciones/cuit.ts
│   │   ├── validaciones/duplicados.ts
│   │   ├── validaciones/totales.ts
│   │   ├── comprobantes.ts
│   │   └── tipos.ts
│   └── hooks/
│       ├── useFacturas.ts
│       └── useCarga.ts
├── supabase/
│   └── migrations/
│       └── 0001_init.sql
├── public/
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 12. Roadmap de construcción

1. ✅ Documento de arquitectura (este documento).
2. Estructura de carpetas + setup (Next.js + TS + Tailwind + shadcn, variables de entorno).
3. Base de datos: migración SQL en Supabase (tablas §3 + RLS) + generación de tipos.
4. Backend: rutas de auth, upload a Storage, CRUD de facturas, endpoint de export (esqueleto sin IA todavía, para poder probar el resto sin gastar tokens).
5. Frontend: Login, Dashboard, Carga, Revisión — con datos mockeados/reales de la base, sin IA todavía.
6. Integración OpenAI Vision + GPT: reemplaza el esqueleto de extracción por la lectura real, prompts con `json_schema`.
7. Validaciones (§8) + cálculo de confianza (§7).
8. Exportación Excel: 4 hojas, formato profesional (encabezados, filtros, formato moneda/fecha, autoancho).
9. Pulido final: manejo de errores, estados de carga, responsive, variables de entorno de producción, deploy a Vercel + Supabase.

## 13. Notas de compatibilidad — Next.js 16

Este proyecto se creó con **Next.js 16**, más nuevo que la mayoría de los ejemplos que circulan dando vueltas. Diferencias relevantes detectadas contra `node_modules/next/dist/docs` (fuente de verdad, no asumir por versiones anteriores):

- **`middleware.ts` fue renombrado a `proxy.ts`** (función exportada `proxy` en vez de `middleware`). El guard de autenticación de las rutas `(app)/*` en el paso de backend/frontend se implementa como `src/proxy.ts`, no `middleware.ts`.
- Los `params` de `page.tsx` y `route.ts` dinámicos son **`Promise`** (hay que `await`-earlos) — ya aplicado en los stubs creados en el paso 2.
- Ante cualquier duda de API durante los próximos pasos, revisar primero `node_modules/next/dist/docs/01-app/` del propio proyecto antes de asumir comportamiento de versiones anteriores.
- **shadcn/ui en este proyecto genera componentes sobre Base UI, no Radix UI.** El patrón `asChild` (Radix) no existe acá: para renderizar un `Button` (u otro componente) como otro elemento (`<Link>`, `<a>`) se usa la prop **`render`**: `<Button render={<Link href="/x" />}>Texto</Button>`. Aplica a cualquier componente nuevo de shadcn que se agregue (`Dialog`, `Select`, etc. pueden tener la misma diferencia — revisar el `.tsx` generado antes de asumir la API de Radix).
  - Ademas, si el elemento de `render` **no** es un `<button>` real (por ejemplo `<Link>`/`<a>`), Base UI tira un error en consola a menos que se agregue **`nativeButton={false}`**: `<Button render={<Link href="/x" />} nativeButton={false}>Texto</Button>`.

---

Este documento es la referencia para todo lo que sigue. Cualquier cambio de alcance (agregar un campo, un tipo de comprobante nuevo, una validación) se refleja acá primero y después en el código.
