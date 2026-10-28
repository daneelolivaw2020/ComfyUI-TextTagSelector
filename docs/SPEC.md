# Especificación inicial

## Estado de las decisiones

Documento de trabajo del 26 de octubre de 2026. Existe una primera implementación
de prueba v0.1.2; consultar `VALIDATION.md` para distinguir comprobaciones locales
de la integración real pendiente. Este documento distingue los requisitos del plan
original, las decisiones confirmadas y los detalles propuestos pendientes de
validación. La existencia de esta especificación no implica que las pruebas
técnicas hayan pasado.

Confirmado por el usuario:

1. La fuente externa inicial puede ser el nodo nativo **Text (Multiline)**.
2. Los duplicados se conservan por orden de aparición, aceptando su ambigüedad.
3. El editor interno debe poder plegarse para dejar espacio al muro.
4. Desarrollo conectado con GitHub desde el comienzo, en un repositorio
   independiente y público.
5. Tras probar v0.1.0, el usuario pide permitir otros nodos además del nativo:
   intentar fuentes legibles sin bloquearlas por tipo y conservar el estado si
   alguna no se puede leer. v0.1.1 añade lecturas experimentales y un adaptador
   para la salida concatenada de Crystools List of strings.

## Texto y secciones

- Campo interno `STRING` multilineal editable. Una fuente externa compatible
  conectada tiene prioridad al pulsar Reload.
- Cada línea real no vacía produce exactamente una cápsula; el ajuste visual
  de línea no divide fragmentos.
- Comas, puntuación, mayúsculas y contenido se conservan.
- Un encabezado `--- Nombre` crea una sección y no participa en la salida.
- Los fragmentos sin encabezado pertenecen a una sección general.
- Secciones plegables; contraer una sección no desactiva sus fragmentos.
- Ninguna función depende de acceder al documento padre del iframe de Colab.

## Muro de cápsulas

- Distribución horizontal con `flex-wrap` y anchura natural de cada cápsula.
- Los fragmentos largos se ajustan dentro de una única cápsula, sin superar
  el ancho disponible.
- Clic para alternar ON/OFF, con estados visuales claramente distintos.
- Multiselección; concatenación siempre en orden documental.
- `Maximum characters`: propuesta inicial 100; 0 significa sin truncamiento.
- El límite afecta solo a la etiqueta visual, que termina en `…` si se trunca.
  Tooltip con el texto completo; nunca truncar la salida.
- Nodo redimensionable en ambos ejes, con scroll vertical dentro del muro.
- Interacción con cápsulas y editor sin arrastrar accidentalmente el nodo.
- Sin contador, presets, exclusión mutua ni vista previa grande de salida.
- Editor plegable; guardar también su estado de expansión si la integración
  lo permite.

## Reload e identidad

Reload es una operación manual del frontend:

1. Obtener el texto de la fuente prioritaria.
2. Analizarlo y construir el nuevo estado por completo.
3. Emparejar fragmentos por texto completo exacto y número de aparición global
   en orden documental, sin usar la posición de línea como identidad.
4. Conservar los estados emparejados; crear fragmentos nuevos en OFF.
5. Sustituir el estado anterior solo cuando la operación termina correctamente.

Reordenar fragmentos distintos no pierde selecciones. Editar su contenido crea
un fragmento nuevo. Se permiten duplicados intencionales independientes, que
tienen una limitación aceptada: insertar o borrar una aparición idéntica puede
reasignar selecciones entre esas apariciones. El contenido por sí solo no permite
identificar cuál fue editada o eliminada.

Un error al obtener el texto muestra un aviso y conserva el último estado válido.
Una fuente incompatible nunca provoca sustitución silenciosa por el texto interno.
Se admite texto nativo, primitivas string de Crystools, concatenación Crystools
con entradas legibles y reroutes clásicos. Otros nodos se intentan por sus campos
de texto, con aviso explícito de lectura experimental: no se ejecuta Python para
reproducir una transformación desconocida. No se promete leer cualquier STRING.

## Sincronización y salida

La última carga correcta es una instantánea autosuficiente y la fuente de verdad:

- Editar el borrador o conectar, desconectar o eliminar la fuente no cambia los
  fragmentos cargados hasta Reload.
- Alternar cápsulas actualiza la selección de esa instantánea.
- Python recibe esa selección y los parámetros actuales al encolar la ejecución.
- La ejecución no vuelve a analizar el texto externo ni combina texto nuevo con
  selecciones antiguas.
- El workflow debe poder restaurarse sin la fuente original y sin Reload.

Una salida `STRING`. Para los fragmentos seleccionados, en orden:

```text
resultado = unir(fragmentos, Separator + ("\n" si Use new lines)) + Suffix
```

Sin selección, devolver `""` y no añadir Suffix. No insertar espacios implícitos.
Suffix se añade una única vez. Separator no aparece después del último fragmento.
Cambiar los parámetros de concatenación no requiere Reload.

Ejemplos con `Blonde`, `Blue hair`, `Smiling` activos:

| Separator | Use new lines | Suffix | Resultado |
| --- | --- | --- | --- |
| `, ` | OFF | `.` | `Blonde, Blue hair, Smiling.` |
| `,` | ON | `.` | `Blonde,\nBlue hair,\nSmiling.` |
| vacío | OFF | vacío | `BlondeBlue hairSmiling` |

La segunda fila representa saltos de línea reales en el resultado.

## Persistencia

Guardar contenido completo cargado, selecciones individuales, orden y secciones;
Use new lines, Separator, Suffix y Maximum characters; tamaño del nodo y, cuando
sea viable, estado de expansión de secciones y editor.

La restauración debe reproducir la misma selección sin Reload. Duplicar o copiar
el nodo debe crear estado independiente. Guardado de workflow y exportación del
prompt para Python son rutas diferentes y ambas deben verificarse.

Propuesta técnica: estado con versión de esquema, transportado mediante un input
declarado para ejecución, con separación explícita de los detalles visuales.
Python debe validar el estado; una representación corrupta no debe convertirse
silenciosamente en una salida vacía.

## Detalles propuestos por cerrar o comprobar

- Ignorar líneas de solo espacios/tabulaciones y conservar espacios de los
  fragmentos restantes; reconocer LF y CRLF.
- Encabezados en primera columna con `---` seguido de espacio y título no vacío;
  secciones de igual nombre permanecen separadas.
- Definir cómo introducir un fragmento literal que comience con un encabezado.
- Reload con texto vacío leído correctamente produce una instantánea vacía;
  debe distinguirse de un fallo de lectura.
- Interpretar únicamente `\n`, `\t` y `\\` en Separator/Suffix, una sola vez;
  preservar otras secuencias y el texto introducido al guardar.
- Contar caracteres visuales sin partir emojis o combinaciones Unicode.
- Valores iniciales propuestos: Maximum characters 100, Use new lines OFF,
  Separator `, ` y Suffix vacío. No están confirmados todos los valores.
- v0.1.1 añade seguimiento de conexiones y reroutes clásicos. Los subgrafos y
  resultados arbitrarios calculados en Python siguen fuera del alcance probado.
- Integrar cambios con el guardado y deshacer/rehacer de ComfyUI.
- Indicación discreta de borrador pendiente de Reload, sin vista previa grande.

## Fuera del alcance inicial

Texto dinámico producido durante la ejecución, lectura genérica de fuentes
arbitrarias, hot reload del código, presets y modos de exclusión mutua.
La API podrá ejecutar un estado ya preparado, pero no generar cápsulas mediante
el frontend sin una sesión de interfaz.
