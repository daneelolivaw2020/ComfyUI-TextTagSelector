# ComfyUI Text Tag Selector

Custom node en desarrollo para convertir líneas de texto en un muro horizontal
de cápsulas seleccionables y concatenar la selección en una salida `STRING`.

**Estado: especificación inicial. Todavía no contiene un nodo instalable.**

## Comportamiento previsto

- Texto interno multilineal, con editor plegable, o conexión desde el nodo
  nativo **Text (Multiline)** (`PrimitiveStringMultiline`).
- Carga manual mediante **Reload**, sin ejecutar el workflow ni recargar ComfyUI.
- Una cápsula por línea, secciones `--- Nombre` y multiselección.
- Muro horizontal adaptable al ancho, con scroll vertical interno.
- Salida en el orden del texto original, usando el contenido completo.
- Conservación de selección por texto exacto y orden de aparición de duplicados.
- Fragmentos cargados, selecciones y configuración guardados en el workflow.

## Documentación

- [Especificación y decisiones](docs/SPEC.md)
- [Entorno observado y arquitectura propuesta](docs/ENVIRONMENT.md)
- [Pruebas de viabilidad y aceptación](docs/VALIDATION.md)

La primera instalación objetivo será ComfyUI en Google Colab, mostrado en un
iframe. El notebook personal se utiliza como referencia y no forma parte de este
repositorio. Las instrucciones de instalación se añadirán cuando exista una
versión funcional.
