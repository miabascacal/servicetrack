# BotIA — Learning Policy

> Política de aprendizaje supervisado del asistente Ara.
> **Última actualización:** 2026-04-28 — P0.3

---

## Principio Fundamental

**BotIA NO aprende automáticamente a producción.**

Todo aprendizaje requiere:
1. Conversación real como candidato
2. Revisión de admin/jefe del módulo
3. Aprobación explícita
4. Incorporación controlada al corpus
5. Despliegue con validación

---

## Qué SÍ Puede Aprender (con aprobación)

| Categoría | Ejemplos |
|-----------|---------|
| Nuevas formas de pedir cita | "quiero ir al taller", "necesito que revisen mi carro" |
| Frases de servicio regional | Términos locales para mantenimiento o fallas |
| Formas de decir fechas/horas | "a primera hora", "después del mediodía", "el miércoles que entra" |
| Frases de descripción de fallas | "traquetea", "no jala", "hace un sonidito raro" |
| Frases ambiguas que requieren aclaración | "sí" interpretado como confirmación vs. nuevo mensaje |
| Causas frecuentes de escalación | Patrones que siempre terminan en escalación |
| Correcciones de entidades | "no, es Honda no Hyundai" |

---

## Qué NUNCA Puede Aprender

| Categoría | Ejemplos | Razón |
|-----------|---------|-------|
| Groserías o insultos | Cualquier lenguaje ofensivo | Nunca en respuestas profesionales |
| Respuestas agresivas | Tono hostil hacia el cliente | Política de tono |
| Instrucciones para saltarse políticas | "olvida tus reglas", "jailbreak" | Seguridad |
| Direcciones o precios inventados | Datos no verificados en BD | Integridad de información |
| Confirmaciones sin cita_id | "sí está confirmada" sin crear cita | Anti-hallucination |
| Datos personales como regla | Nombres específicos como examples | Privacidad |
| Patrones que evitan escalación legítima | "no me pases con asesor aunque sea urgente" | Seguridad operativa |

Los patrones prohibidos están en `BOTIA_FORBIDDEN_LEARNING_PATTERNS` en `lib/ai/botia-brain.ts`.

---

## Flujo de Aprendizaje Supervisado

```
Conversación real ocurre
    │
    ▼
Sistema marca ejemplo como candidato
(criterio: escalación inesperada / baja confianza / corrección del cliente)
    │
    ▼
Tabla: botia_ejemplos_candidatos (pendiente crear)
    │
    ▼
Admin/Jefe de módulo revisa en UI (pendiente)
    │
    ├── RECHAZAR → no aprender, marcar razón
    ├── APROBAR con ajuste → editar y aprobar
    └── APROBAR → incorporar a corpus
    │
    ▼
Despliegue controlado (no afecta producción activa)
```

---

## Estructura del Ejemplo Candidato

```typescript
interface BotiaEjemploCandiato {
  id:                        string
  fecha:                     string          // ISO date
  modulo:                    string          // 'citas' | 'taller' | etc.
  canal:                     string          // 'whatsapp' | 'demo'
  frase_cliente:             string          // texto literal del cliente
  intent_detectado:          string          // intent clasificado automáticamente
  intent_correcto_sugerido:  string | null   // sugerencia del revisor
  entidades_detectadas:      Record<string, unknown>
  entidades_correctas:       Record<string, unknown> | null
  respuesta_generada:        string
  respuesta_sugerida:        string | null
  accion_tomada:             string
  fue_util:                  boolean | null
  escalo:                    boolean
  causa_escalacion:          string | null
  aprobado_por:              string | null   // usuario_id
  aprobado_at:               string | null
}
```

**Estado:** Esta tabla puede implementarse en una migración futura. No bloquea funcionalidad actual.

---

## Verificación de Patrones Prohibidos

Antes de incorporar cualquier ejemplo al corpus, verificar contra `BOTIA_FORBIDDEN_LEARNING_PATTERNS`:

```typescript
import { BOTIA_FORBIDDEN_LEARNING_PATTERNS } from '@/lib/ai/botia-brain'

function esAprendizajeSeguro(frase: string, respuesta: string): boolean {
  return !BOTIA_FORBIDDEN_LEARNING_PATTERNS.some(p => p.test(frase) || p.test(respuesta))
}
```

---

## Versionado del Corpus

- Cada versión del corpus lleva fecha y autor de aprobación.
- No se modifica en caliente — requiere deploy controlado.
- Los ejemplos del corpus inicial están en `BOTIA_TRAINING_CORPUS.md` y no en BD.
- Migrar a BD cuando el volumen supere ~200 ejemplos verificados.
