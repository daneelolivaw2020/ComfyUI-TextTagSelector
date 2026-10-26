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

## Arquitectura implementada en v0.1.1

Backend Python sin dependencias adicionales para validar el estado cargado y
concatenar. Extensión JavaScript para editor, muro DOM, Reload y sincronización
del estado serializado. Mapeo clásico de custom nodes de ComfyUI y `WEB_DIRECTORY`.

Un widget STRING declarado `state_json` transporta una instantánea con versión,
secciones, fragmentos y opciones. El frontend lo oculta y crea un único DOM widget
para los controles. El DOM widget no se serializa al prompt; el STRING sí.
El borrador, truncamiento y estado plegado se guardan en `node.properties.tts_ui`.
La fuente externa `source` es opcional y lazy; `check_lazy_status` no solicita su
valor, ya que Reload lee las fuentes disponibles en el navegador. Debe comprobarse este
comportamiento con el motor y el frontend reales antes de darlo por validado.

No confundir persistencia del workflow con envío del prompt: el frontend documenta
controles diferentes para ambas rutas. La selección cambia el input `state_json`,
sin forzar `IS_CHANGED` ni desactivar la caché. Su funcionamiento con la caché real
está pendiente de comprobación.

El usuario confirmó funcionamiento básico en Colab de v0.1.0 y compartió una
captura con secciones, cápsulas y salida. No se recibió una versión real de
frontend ni una verificación exhaustiva de caché o deshacer/rehacer.

En v0.1.1, `web/source.js` resuelve fuentes de texto nativas y Crystools, sigue sus
enlaces y reproduce la salida concatenada de Crystools List of strings. Las
lecturas de otros tipos de nodo son experimentales y muestran el campo importado;
no se presume que un widget de entrada equivalga a una transformación de Python.
Los fallos, ambigüedades y ciclos conservan la instantánea previa.

Se revisaron [los nombres de nodo de Crystools](https://github.com/crystian/ComfyUI-Crystools/blob/main/nodes/_names.py),
sus [primitivas](https://github.com/crystian/ComfyUI-Crystools/blob/main/nodes/primitive.py)
y la implementación de [CListString.execute](https://github.com/crystian/ComfyUI-Crystools/blob/main/nodes/list.py).
Su delimitador se aplica literalmente, sin interpretar escapes adicionales.

## Referencias oficiales verificadas

- [Nodo nativo en v0.42.1](https://github.com/Comfy-Org/ComfyUI/blob/v0.42.1/comfy_extras/nodes_primitive.py)
- [Requirements en v0.42.1](https://github.com/Comfy-Org/ComfyUI/blob/v0.42.1/requirements.txt)
- [Serialización de widgets](https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/WIDGET_SERIALIZATION.md)
- [Evaluación diferida](https://docs.comfy.org/custom-nodes/backend/lazy_evaluation)

Las referencias a `main` describen el estado consultado, no una API fijada para
todas las versiones. Las pruebas deben registrar backend, frontend y modo de nodos.
