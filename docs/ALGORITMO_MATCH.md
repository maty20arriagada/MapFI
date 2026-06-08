# 🎯 Algoritmo de Match — Calculador de Compatibilidad y Alcance

Especificación del motor que evalúa qué tan viable es una fecha/hora propuesta para un evento, estima su alcance real y sugiere mejores bloques. Implementado en [`js/services/matchService.js`](../js/services/matchService.js) como **servicio puro** (sin I/O, 100 % testeable).

> Corresponde al requisito **§3.C** de `Descripcion_MapFI.txt`.

---

## 1. Contrato del servicio

```js
matchService.evaluar(propuesta, contexto, params?) → Resultado
```

### Entrada

```js
propuesta = {
  inicio: Date,            // fecha/hora propuesta
  fin: Date,
  publico: [               // segmentos objetivo
    { carreraId: 3, nivel: 2 },
    { carreraId: 3, nivel: 3 },
  ],
}

contexto = {              // datos ya consultados por los DAO
  feriados: [Date, ...],
  bloques: [ { carreraId, nivel, diaSemana, horaInicio, horaFin, tipo } ],
  actividades: [ { inicio, fin, publico:[{carreraId,nivel}], tipo, estado } ],
  poblacion: { '3-2': 120, '3-3': 110 },   // alumnos por segmento
}
```

### Salida

```js
Resultado = {
  compatibilidad_pct: 0..100,
  alcance_estimado: int,                 // beneficiarios libres de tope
  nivel: 'ALTO' | 'MEDIO' | 'BAJO',      // semáforo
  conflictos: [ { tipo, detalle, peso } ],
  sugerencias: [                         // top-3 si compatibilidad < umbral
    { inicio, fin, compatibilidad_pct, alcance_estimado },
  ],
}
```

---

## 2. Pipeline de cálculo

El puntaje parte en **100** y se descuenta por factores ponderados.

### Paso 0 — Descartes duros (cronología, §4)

| Condición | Efecto |
|-----------|--------|
| La fecha cae en **sábado o domingo** | `compatibilidad = 0`, conflicto `FIN_DE_SEMANA` |
| La fecha es **feriado / sándwich** | `compatibilidad ≤ 10`, conflicto `FERIADO` |

Los fines de semana se excluyen por defecto: el cálculo se centra en la jornada universitaria Lun–Vie.

### Paso 1 — Choque con malla académica

Para cada segmento objetivo, se busca solapamiento entre `[inicio, fin]` y los `bloque_horario` de ese `(carrera, nivel)` en ese día de la semana:

| Tipo de bloque solapado | Penalización |
|-------------------------|--------------|
| `CLASE` | −`P_CLASE` por segmento afectado |
| `PROTEGIDO` (ej. bloque protegido institucional) | −`P_PROTEGIDO` (alto) |
| `LIBRE` | 0 (ideal) |

### Paso 2 — Choque con exámenes

Si existe una `actividad` de tipo `EXAMEN` que solapa la ventana y comparte segmento → penalización fuerte `−P_EXAMEN`, conflicto `EXAMEN`.

### Paso 3 — Saturación (densidad, §3.B)

Otros eventos **confirmados** dirigidos al mismo segmento en la **misma semana** (y especialmente el mismo bloque/día) reducen el puntaje y el alcance:

```
penalización_saturacion = P_SATURACION × eventos_mismo_segmento_semana
```

Esto evita 3 eventos masivos al mismo público en una semana.

### Paso 4 — Cómputo del puntaje

```
compatibilidad_pct = clamp(100 − Σ penalizaciones, 0, 100)
nivel = ALTO   si ≥ 75
        MEDIO  si 45–74
        BAJO   si < 45
```

### Paso 5 — Alcance estimado

```
poblacion_total = Σ poblacion[segmento]
fraccion_bloqueada = proporción de segmentos×tiempo con tope (clase/examen/saturación)
alcance_estimado  = round( poblacion_total × (1 − fraccion_bloqueada) )
```

### Paso 6 — Sugerencias (si compatibilidad < `UMBRAL_SUGERENCIA`)

Se evalúan todos los bloques candidatos de **esa semana** (Lun–Vie, dentro de ventanas razonables / `LIBRE`), se recalcula la compatibilidad de cada uno y se devuelven los **3 mejores** ordenados por `compatibilidad_pct` y luego por `alcance_estimado`. Maximiza rango horario y elige el mejor día.

---

## 3. Parámetros configurables

Centralizados para poder ajustarlos sin tocar la lógica (y, a futuro, moverlos a BD):

```js
const PARAMS = {
  P_CLASE: 12,
  P_PROTEGIDO: 30,
  P_EXAMEN: 45,
  P_SATURACION: 10,
  UMBRAL_SUGERENCIA: 70,   // bajo esto, se generan sugerencias
  DURACION_BLOQUE_MIN: 90, // para discretizar la semana en sugerencias
};
```

> **Nota de diseño:** que el servicio sea puro y parametrizado permite calibrar los pesos con datos reales más adelante sin reescribir el algoritmo.

---

## 4. Casos de prueba (Jest)

Cobertura mínima esperada en `__tests__/services/matchService.test.js`:

- ✅ Fin de semana → compatibilidad 0.
- ✅ Feriado → compatibilidad ≤ 10.
- ✅ Choque total con clase de todos los segmentos → BAJO + alcance reducido.
- ✅ Bloque libre sin conflictos → ALTO + alcance ≈ población total.
- ✅ Saturación: N eventos previos al mismo segmento → penalización creciente.
- ✅ Sugerencias: devuelve exactamente 3, ordenadas, todas Lun–Vie y mejores que la propuesta.
- ✅ Público vacío → error de validación controlado.

---

## 5. Pseudocódigo de referencia

```
función evaluar(propuesta, contexto, params):
    si esFinDeSemana(propuesta.inicio): return resultado(0, ...)
    si esFeriado(propuesta.inicio, contexto.feriados): return resultado(≤10, ...)

    penal = 0; conflictos = []
    para cada seg en propuesta.publico:
        para cada b en bloquesDe(seg, contexto):
            si solapa(propuesta, b):
                penal += pesoPorTipo(b.tipo, params); registrar conflicto

    para cada act en contexto.actividades:
        si act.tipo == EXAMEN y solapa y comparteSegmento: penal += P_EXAMEN
        si act.estado == CONFIRMADA y mismaSemana y comparteSegmento:
            penal += P_SATURACION

    compat = clamp(100 - penal, 0, 100)
    alcance = round(poblacion(propuesta.publico) * (1 - fraccionBloqueada))

    sugerencias = []
    si compat < params.UMBRAL_SUGERENCIA:
        sugerencias = top3( evaluarBloquesDeLaSemana(propuesta, contexto, params) )

    return { compatibilidad_pct: compat, alcance_estimado: alcance,
             nivel: semaforo(compat), conflictos, sugerencias }
```

---

*Implementación: [`js/services/matchService.js`](../js/services/matchService.js). El mapa de calor reutiliza la misma noción de saturación — ver [`heatmapService.js`](../js/services/heatmapService.js).*
