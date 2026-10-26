# Pruebas de viabilidad y aceptación

**v0.1.0: pruebas locales completadas; integración real ComfyUI/Colab pendiente.**

## Resultados locales del 26 de octubre de 2026

- 13 pruebas Python: salida exacta, escapes, Unicode, selección y estado inválido;
  importación de la extensión y clonación/actualización con Git de la celda de
  instalación, incluyendo conservación de cambios locales.
- 10 pruebas JavaScript: parsing, duplicados por aparición, recarga repetida,
  truncamiento por grafemas, restauración y lectura de fuente nativa.
- Prueba de navegador en Chrome headless: ancho natural y muro horizontal,
  envío del JSON real de la interfaz a Python, restauración/clonación, borrador
  independiente de la instantánea, fuente nativa simulada y error sin pérdida de
  estado; 200 cápsulas, scroll y ajuste al reducir el ancho.
- Inspección de la captura de pantalla producida por esa prueba.

El anfitrión de widgets y el grafo del navegador están simulados. No se ejecutó el
frontend completo ni el motor de ejecución de ComfyUI. Las pruebas siguientes
siguen siendo necesarias en la instalación real, en especial serialización del
prompt, deshacer/rehacer, modo de nodos, evaluación lazy y caché.

## Puerta de viabilidad

Antes de desarrollar todas las opciones:

1. Registrar versión real de backend, frontend y modo clásico/Nodes 2.0.
2. Mostrar 20 cápsulas cortas y largas, secciones, editor plegable y selección.
3. Comprobar anchura natural, wrapping, scroll y redimensionamiento en ambos ejes.
4. Alternar cápsulas y verificar el estado del prompt y la salida Python.
5. Guardar y restaurar el workflow sin Reload; duplicar/copiar sin compartir estado.
6. Leer `PrimitiveStringMultiline.value` mediante Reload sin encolar una ejecución.
7. Cambiar el texto externo después de Reload y verificar que la salida sigue
   correspondiendo a la instantánea mostrada.
8. Verificar que la conexión no obliga a ejecutar fuentes para reconstruir el
   contenido cargado. Registrar cualquier limitación antes de ampliar soporte.

## Pruebas funcionales

- LF/CRLF, Unicode, líneas vacías, espacios significativos, comas y encabezados.
- Duplicados con estados distintos, reordenación, inserción y eliminación.
- Texto externo incompatible o ilegible conserva el último estado válido.
- Texto vacío válido se diferencia de un error de lectura.
- Truncamiento exclusivamente visual, incluido Maximum characters 0.
- Concatenación exacta: ninguna selección, una, varias, separador vacío, new lines,
  suffix único y escapes literales frente a caracteres de control.
- Deshacer/rehacer; cambios de selección detectados por guardado manual/automático.
- Restauración con editor/secciones plegados y fuente desconectada.
- Cola: los clics posteriores no alteran el prompt ya encolado.
- Caché normal: seleccionar A, ejecutar; seleccionar B, ejecutar; comprobar ambas
  salidas. Repetir con opciones de concatenación y sin editar el texto fuente.
- API: ejecutar el estado exportado sin depender de JavaScript para concatenarlo.
- Estado corrupto o versión de esquema no soportada: error explícito.

## Interfaz y entorno real

- 100-200 cápsulas de longitudes mixtas, incluyendo palabras sin espacios.
- Zoom del lienzo, arrastre, rueda, plegado, tamaño mínimo y tooltips.
- Ningún clic sobre cápsulas arrastra el nodo ni ejecuta el workflow.
- Comprobación dentro del iframe real de Colab con los custom nodes habituales.
- Anotar versión/commit probado y resultado, sin presentar pruebas locales como
  validación de Colab.
