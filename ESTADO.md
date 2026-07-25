# Estado del proyecto — Facturas AR IA

Registro de todo el procedimiento hecho hasta ahora. Se actualiza a medida que se avanza. Ver también [`ARQUITECTURA.md`](./ARQUITECTURA.md) para el diseño técnico completo.

## Qué es

Aplicación web para que personal administrativo suba facturas argentinas (PDF o foto) y el sistema las lea automáticamente con IA, muestre los datos para revisión, los guarde, y permita exportar todo a un Excel profesional. No es un ERP: solo carga → lectura → revisión → guardado → export.

## Cómo correrla

```bash
cd C:\Users\Usuario\Documents\facturas-ar-ia
npm run dev
```

Abrir **http://localhost:3000**. Login: `admin@facturas.test` / `Prueba123!`.

Si algún día no arranca, revisar que `.env.local` tenga cargadas las 4 claves (Supabase x3 + Gemini) — están en esa máquina, no en git.

## Procedimiento seguido, paso a paso

### 1. Documento de arquitectura
Se escribió `ARQUITECTURA.md` completo (objetivo, modelo de datos, pantallas, flujo, APIs, roadmap) **antes** de escribir código, a pedido explícito del usuario. Aprobado antes de seguir.

### 2. Estructura de carpetas y setup
Next.js 16 + TypeScript + TailwindCSS + shadcn/ui, con esqueleto de todas las páginas y endpoints (devolviendo "no implementado" hasta llenarlos en los pasos siguientes).

**Hallazgo importante**: este proyecto usa **Next.js 16**, donde `middleware.ts` se renombró a `proxy.ts`, y shadcn/ui genera componentes sobre **Base UI** (no Radix) — el patrón `asChild` no existe, se usa la prop `render` (con `nativeButton={false}` si el elemento renderizado no es un `<button>`). Documentado en `ARQUITECTURA.md` §13.

### 3. Base de datos (Supabase)
Migración SQL (`supabase/migrations/0001_init.sql`) con 5 tablas: `usuarios` (perfil sobre Supabase Auth, no contraseña propia), `sesiones_carga` (agrupa un lote de subida por Compras/Ventas), `archivos`, `facturas`, `productos`. Row Level Security en todas: cada usuario ve solo lo que subió, admin ve todo. Bucket privado de Storage `facturas`.

Aplicada a mano por el usuario en el SQL Editor de Supabase (pegando el contenido del archivo de migración).

### 4. Backend
Rutas de autenticación (Supabase Auth), subida de archivos a Storage con validación de tipo/tamaño, y CRUD de facturas (listado con filtros y paginación, detalle con URL firmada de vista previa, edición restringida a campos editables, borrado en cascada archivo→factura→productos). `proxy.ts` protege las páginas; cada ruta de API valida su propia sesión.

### 5. Frontend
Pantallas de Login, Dashboard (tabla + filtros), Cargar (arrastrar archivos, elegir Compras/Ventas, progreso, cancelar) y Revisión (vista previa del PDF + formulario editable con todos los campos + tabla de productos).

### 6. Lectura con IA
**Cambio de stack**: se reemplazó OpenAI por **Google Gemini** (`gemini-flash-latest`) a pedido explícito del usuario ("no quiero pagar nada"). Un solo llamado multimodal (la imagen/PDF entra, el JSON estructurado sale) reemplaza el esquema de dos pasos que se había planeado con OpenAI. Clave gratuita sacada en aistudio.google.com, sin tarjeta.

La pantalla de Carga dispara el procesamiento automáticamente apenas termina de subir cada archivo — el usuario no aprieta ningún botón extra.

### 7. Validaciones y confianza
CUIT inválido (dígito verificador AFIP), factura duplicada (mismo emisor+tipo+punto de venta+número), total incorrecto, fechas inconsistentes. Fórmula de confianza transparente (100 menos penalidades por campo faltante o error), con semáforo verde/amarillo/rojo.

**Bug real encontrado y corregido**: el chequeo de "total incorrecto" daba falso positivo en facturas de monotributista (Factura C), que legítimamente no discriminan IVA — el total ya ES el neto. Se corrigió para que ese chequeo solo corra cuando el comprobante realmente trae un desglose de neto/IVA para comparar.

### 8. Exportación a Excel
`GET /api/export/excel` genera un `.xlsx` con 4 hojas (Compras, Ventas, Productos, Errores), encabezados con color y autofiltro, fechas como fecha real (no texto, con formato dd/mm/yyyy), montos con formato moneda. El nombre de archivo original se normaliza al formato `AAAA-MM-DD - Tipo - Proveedor - PtoVta-Numero.ext`.

## Pruebas reales hechas

Todo se probó con HTTP real contra el proyecto de Supabase y la API de Gemini — no con datos simulados:

- Login, logout, redirect sin sesión.
- Subida de un archivo real (factura de `GEDIKIAN ALEXIA ALINE` a `Dental Medrano S.A.`, Factura C).
- Gemini extrajo razón social, CUIT, dirección, condición IVA, CAE, vencimiento de CAE, producto y total — **100% de confianza** en la primera pasada.
- Se subió el mismo archivo una segunda vez: el sistema lo detectó como **duplicado** (confianza baja a 40, marcado en rojo) — funciona correctamente.
- Exportación a Excel: las 4 hojas se generan bien, con el nombre de archivo en el formato pedido.
- Edición manual de una factura (PATCH) y marcado como validada.
- Borrado de una factura (limpia archivo + Storage + productos sin dejar nada huérfano).

## Decisiones tomadas (y por qué)

| Decisión | Motivo |
|---|---|
| Google Gemini en vez de OpenAI | El usuario pidió no pagar nada; Gemini tiene nivel gratuito real, sin tarjeta. |
| Supabase Auth en vez de contraseña propia | Evita reinventar seguridad de contraseñas/sesiones. |
| `sesiones_carga` como tabla extra (no pedida originalmente) | Permite preguntar "¿Compras o Ventas?" una sola vez por lote, no por archivo. |
| Un archivo = una factura (1:1) | Simplifica el modelo; el caso "un PDF con varias facturas" queda para más adelante si hace falta. |
| Procesamiento automático tras la subida | El usuario pidió velocidad: subir y ver el resultado, sin pasos manuales de por medio. |

## Pendiente

- **Deploy a Vercel** (paso 9 del roadmap): no se hizo todavía. El usuario confirmó que por ahora alcanza con correrla en esta PC (`localhost:3000`); avisar cuando haga falta un link público.
- Revisión visual completa en navegador real por parte del usuario (lo que se probó desde este lado fue por HTTP directo).
- Pulido general de la interfaz (responsive, loading states más finos) si el uso real lo pide.

## Credenciales de prueba

- App: `admin@facturas.test` / `Prueba123!`
- Repo: `github.com/darongedi2/Facturacion-Dental-Medrano` (rama `main`)
- Supabase, Gemini: claves en `.env.local` de esta máquina (no están en git)
