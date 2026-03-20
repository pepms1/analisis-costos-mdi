# Importación asistida Excel: heurísticas de medidas embebidas

## Patrones soportados
Se detectan patrones de 2 dimensiones en el concepto (`raw` + normalizado), por ejemplo:

- `60x60`
- `60 x 60`
- `60×60`
- `1.20x2.40`
- `15 cm x 20 cm`
- `600x600 mm`

## Inferencia de unidad
Reglas implementadas:

1. Si la expresión incluye `mm`, `cm` o `m`, se respeta esa unidad.
2. Si no hay unidad explícita y ambos valores son enteros mayores a 10, se infiere `cm`.
3. Si no hay unidad explícita y existe decimal, se infiere `m`.
4. Todo se normaliza a metros para cálculo interno (`lengthM`, `widthM`, `areaM2`).

## Heurística de unidad de aplicación
Sugerencia de `applicationUnit = m2` cuando el concepto parece de superficie:

- placa, tapa, loseta, piso, azulejo, panel, lámina/lamina, cristal, mármol/marmol, tablero.

Se evita sugerir `m2` para conceptos lineales/estructurales:

- PTR, tubo, viga, cable, polín/polin.

## Persistencia
- En staging (`ImportRow.rawJson.normalized`) se guarda `detectedDimensions` y `suggestedApplicationUnit`.
- En decisiones (`ImportRowDecision.finalMeasurementsJson`) se guardan los valores geométricos finales editables.
- En aplicación a históricos (`PriceRecord.attributes.importMeta.finalMeasurements`) se conserva la trazabilidad final usada al aplicar.
