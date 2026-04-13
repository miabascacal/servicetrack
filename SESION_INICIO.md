# FRASE DE INICIO DE SESIÓN — ServiceTrack
# Copia esto COMPLETO al inicio de cada sesión de Claude Code
# Guarda este archivo en un lugar fácil — lo usas cada vez que abres Claude Code

---

Lee estos archivos en este orden ANTES de escribir cualquier código:

1. CLAUDE.md                          ← identidad, módulos, reglas, estado actual
2. AGENTS.md                          ← reglas Next.js y contexto de agentes
3. PRODUCT_MASTER.md                  ← los 26 flujos completos del producto
4. IMPLEMENTATION_PLAN.md             ← los 11 sprints con tareas detalladas
5. PENDIENTES.md                      ← qué está hecho y qué falta exactamente
6. SUPABASE_SCHEMA.sql                ← las 14 tablas con RLS y triggers
7. TECH_STACK.md                      ← stack, estructura de carpetas, convenciones
8. N8N_WORKFLOWS.md                   ← automatizaciones (implementadas como código nativo)

---

## REGLAS SOBRE QUÉ ARCHIVOS TOCAR Y CUÁNDO

### Archivos que NUNCA modificas sin que yo lo pida explícitamente:
- CLAUDE.md
- AGENTS.md
- PRODUCT_MASTER.md
- IMPLEMENTATION_PLAN.md
- SUPABASE_SCHEMA.sql
- TECH_STACK.md
- N8N_WORKFLOWS.md
- INSTRUCCIONES_PROYECTO_CLAUDE.md
- SESION_INICIO.md

### Archivos que SÍ actualizas automáticamente:
- **PENDIENTES.md** → actualizar AL FINAL de cada sesión con:
  - ✅ Lo que se completó en esta sesión
  - 🔴 Lo que quedó pendiente
  - 🐛 Bugs encontrados durante el desarrollo
  - ⚠️ Decisiones técnicas tomadas que afecten al proyecto

### Frases exactas para actualizar cada archivo:
- "actualiza el CLAUDE.md con esto" → actualizar CLAUDE.md
- "agrega esto al PRODUCT_MASTER" → actualizar PRODUCT_MASTER.md
- "actualiza el schema" → actualizar SUPABASE_SCHEMA.sql
- "actualiza el plan de implementación" → actualizar IMPLEMENTATION_PLAN.md
- "actualiza el tech stack" → actualizar TECH_STACK.md
- "actualiza el workflow" → actualizar N8N_WORKFLOWS.md

### Cuándo SUGERIRME actualizar un archivo (sin hacerlo solo):
- Si encontraste que un flujo del producto necesita cambiar → sugiéreme: "¿Actualizo PRODUCT_MASTER.md con este cambio?"
- Si se necesita una tabla nueva en BD → sugiéreme: "¿Actualizo SUPABASE_SCHEMA.sql con esta tabla?"
- Si cambiamos una decisión técnica → sugiéreme: "¿Actualizo TECH_STACK.md con esta decisión?"
- Si un sprint se completó → sugiéreme: "¿Actualizo IMPLEMENTATION_PLAN.md marcando este sprint como completo?"
- Si hay un nuevo workflow de automatización → sugiéreme: "¿Actualizo N8N_WORKFLOWS.md con este workflow?"

---

## ANÁLISIS REAL DEL PROYECTO — HACER ESTO PRIMERO

Antes de arrancar con código, haz un análisis real del estado del proyecto
leyendo el CÓDIGO, no solo los archivos MD:

1. Revisa cada carpeta en app/ — ¿qué rutas existen realmente?
2. Revisa components/ — ¿qué componentes están construidos?
3. Revisa lib/ — ¿qué funciones están implementadas?
4. Revisa supabase/migrations/ — ¿qué tablas existen realmente en BD?
5. Revisa .claude/ — ¿qué skills y agentes están configurados?
6. Para cada módulo evalúa:
   - ¿Está conectado a Supabase o solo tiene UI estática?
   - ¿Tiene validaciones reales o solo el form?
   - ¿Fue probado o solo construido?

Con eso dime:
- Porcentaje real de avance por sprint (basado en código, no en documentación)
- Lista exacta de lo que falta por sprint
- Si PENDIENTES.md está desactualizado, dime qué cambiarías

---

## REGLAS DE CÓDIGO — SIEMPRE

- Nunca romper funcionalidad existente — solo agregar o mejorar
- TypeScript estricto — prohibido usar `any`
- shadcn/ui como base de componentes
- Dark theme — fondo base #0d1117
- RLS activo en todas las tablas de Supabase
- Automatizaciones como código nativo (lib/ + api/) — NO agregar n8n
- Antes de crear un archivo nuevo, verifica que no existe algo similar
- Antes de enviar WA o email, verificar horario del bot (8am–7:30pm hora México)

---

## AL TERMINAR CADA SESIÓN — SIEMPRE, SIN EXCEPCIÓN

1. Actualiza PENDIENTES.md con lo que se hizo y lo que queda
2. Si algo cambió en el producto o en la arquitectura, sugiéreme qué archivo MD actualizar
3. Haz commit de todos los cambios con un mensaje descriptivo así:
   "feat: [módulo] - [qué se hizo]"
   Ejemplos:
   - "feat: crm - campos obligatorios en form de crear cliente"
   - "fix: taller - flujo de OT corregido y probado"
   - "feat: citas - timer 15 min implementado"
4. Haz push a GitHub
5. Dime la URL de Vercel para verificar que el deploy funcionó
6. Dame un resumen de 3 líneas: qué se hizo, qué falta, qué sigue

---

## ANTES DE ARRANCAR — DIME ESTO:

1. ¿Qué archivos leíste?
2. ¿Qué skills y agentes tienes activos en .claude/?
3. Basándote en el CÓDIGO REAL (no en los MD):
   - ¿En qué sprint estamos?
   - ¿Qué está realmente funcional vs solo construido?
   - ¿Hay algo roto que deba arreglarse antes de continuar?
4. ¿Qué construimos en esta sesión?