# Facturas AR IA

Aplicación web para leer facturas argentinas automáticamente con IA (PDF o imagen), revisar los datos extraídos, y exportarlos a un Excel profesional.

Ver [`ARQUITECTURA.md`](./ARQUITECTURA.md) para el documento técnico completo (modelo de datos, flujo, APIs, roadmap).

## Stack

Next.js · React · TypeScript · TailwindCSS · shadcn/ui · Supabase (Postgres + Storage) · OpenAI (Vision + GPT) · Vercel.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar con las claves reales
npm run dev
```

Abrir `http://localhost:3000`.

## Estado

En construcción, siguiendo el roadmap de `ARQUITECTURA.md` §12. Paso actual: estructura de carpetas y setup inicial.
