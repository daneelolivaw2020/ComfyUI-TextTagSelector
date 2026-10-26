# Entorno observado y arquitectura propuesta

## Evidencia disponible

Inspección del notebook de muestra `base_24_oct_workflow_director.ipynb`, el
26 de octubre de 2026, sin ejecutarlo ni modificarlo:

- Directorio de ejecución: `/content/ComfyUI`.
- Instalación desde el repositorio oficial Comfy-Org/ComfyUI.
- `COMFY_VERSION = None`: consulta la última release estable al crear un entorno
  nuevo; si el directorio existe, reutiliza la instalación existente.
- Una salida guardada de la instalación muestra **v0.42.1**. Es evidencia de esa
  ejecución, no una comprobación del runtime de Colab actualmente abierto.
- Instala los requirements del checkout. Los requirements oficiales de v0.42.1
  fijan `comfyui-frontend-package==1.55.18`; no se ha consultado la versión
  instalada en una sesión viva.
- ComfyUI escucha en `127.0.0.1:8188` y se muestra mediante
  `output.serve_kernel_port_as_iframe(PORT, height=1100)`.
- La orden de arranque incluye `--cache-none`. El nodo deberá probarse también
  con la caché estándar, aunque el entorno personal la desactive.
- El notebook no fija explícitamente la preferencia de diseño clásico frente
  a Nodes 2.0. No inferir el modo activo.
- Incluye otros custom nodes y WorkflowDirector; el selector tendrá repositorio
  y extensión propios.

El notebook personal no se copia al repositorio. No se necesitan credenciales
de descargas de modelos ni la configuración personal de otros proyectos.

## Fuente externa inicial

El código oficial de v0.42.1 declara:

- Clase de nodo: `PrimitiveStringMultiline`.
- Nombre mostrado: `Text (Multiline)`.
- Categoría: `utilities/primitive`.
- Campo de entrada: `value`, STRING multilineal.
- Una salida STRING; `execute()` devuelve `value` sin transformación.

Esto respalda usar ese nodo como fuente estática. Falta probar la lectura de su
widget en el frontend real y el seguimiento de la conexión. No se debe localizar
el campo por su posición o por ser el primer STRING de un nodo arbitrario.

## Arquitectura candidata

Backend Python para validar el estado cargado y concatenar. Extensión JavaScript
para editor, muro DOM, Reload y sincronización del estado serializado. Evitar
dependencias de Python adicionales salvo necesidad demostrada.

El mecanismo definitivo de widgets se escogerá después de probar el frontend
objetivo. La carga conectada es una operación de edición, no una nueva fuente
de verdad en la ejecución. Hay que comprobar si una entrada lazy permite mantener
la conexión sin exigir ejecutar su fuente cuando solo se usa la instantánea.

No confundir persistencia del workflow con envío del prompt: el frontend documenta
controles diferentes para ambas rutas. La caché debe observar los inputs efectivos
de ejecución; no se propone desactivarla globalmente para resolver sincronización.

## Referencias oficiales verificadas

- [Nodo nativo en v0.42.1](https://github.com/Comfy-Org/ComfyUI/blob/v0.42.1/comfy_extras/nodes_primitive.py)
- [Requirements en v0.42.1](https://github.com/Comfy-Org/ComfyUI/blob/v0.42.1/requirements.txt)
- [Serialización de widgets](https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/WIDGET_SERIALIZATION.md)
- [Evaluación diferida](https://docs.comfy.org/custom-nodes/backend/lazy_evaluation)

Las referencias a `main` describen el estado consultado, no una API fijada para
todas las versiones. Las pruebas deben registrar backend, frontend y modo de nodos.
