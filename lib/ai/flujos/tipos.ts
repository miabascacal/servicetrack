// Framework de datos requeridos por flujo conversacional.
// Cada flujo declara qué campos necesita el bot antes de ejecutar la acción final.
// El SYSTEM_PROMPT de cada bot usa esta estructura como guía.

export interface CampoFlujo {
  key:         string
  label:       string
  required:    boolean
  descripcion: string
}

export interface DefinicionFlujo {
  id:     string
  nombre: string
  campos: CampoFlujo[]
}
