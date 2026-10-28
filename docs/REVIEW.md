# Revisión de código — 27 de octubre de 2026

Versión revisada: v0.1.1 (`255079b`). Resultado: correcciones publicables como
v0.1.2, sin cambiar el formato del estado de ejecución ni las selecciones guardadas.

## Hallazgos corregidos

| Prioridad | Hallazgo y condición | Corrección |
| --- | --- | --- |
| P2 | Separator y Suffix se guardaban solo en `change`. Exportar o consultar el prompt por código mientras el campo seguía enfocado podía tomar la configuración anterior. | Guardar en cada evento `input`; prueba de navegador que lee el estado antes de perder el foco y lo entrega a Python. |
| P2 | Una propiedad visual `tts_ui` con tipo incorrecto, o un mapa de secciones inválido, podía lanzar una excepción al restaurar un workflow y bloquear la interfaz con un estado de ejecución válido. | Normalizar únicamente las preferencias visuales, copiar sus valores y conservar el JSON de fragmentos intacto. |
| P2 | La coerción de índices convertía `null`, `false` o cadena vacía en salida 0; los lectores genéricos tampoco rechazaban una salida fuera de rango. Una conexión dañada podía cargar un texto distinto del esperado. | Validar índices como enteros no negativos y comprobar que la salida existe cuando hay metadatos disponibles. |
| P2 | El instalador ejecutaba `pull origin main` sobre la rama activa, aunque fuese otra, o sobre un checkout sin rama. Podía mezclar main con un checkout distinto del solicitado. | Exigir explícitamente la rama main antes de actualizar; conservar las otras ramas y checkouts sin rama con un error explicativo. |

Se actualizaron las versiones de imports del frontend para que las dependencias
corregidas se vuelvan a solicitar al actualizar la interfaz.

## Evidencia

Las regresiones de campos enfocados, slots inválidos y otra rama fallaron contra
la versión anterior. Tras corregirlos pasan 15 pruebas Python, 19 pruebas de
JavaScript y la prueba de navegador con DOM/CSS real y entrega del estado a Python.
Esta última usa un grafo y anfitrión de widgets simulados.

## Límites de esta revisión

No se ejecutó una sesión nueva de Colab ni el frontend completo de ComfyUI.
La caché real, la serialización del prompt del frontend y deshacer/rehacer
mantienen las comprobaciones pendientes descritas en `VALIDATION.md`.
Leer campos de nodos arbitrarios sigue siendo experimental: no reproduce
transformaciones desconocidas de Python. No se modificó la puntuación original.

## Instalación

Clonar este repositorio dentro de `ComfyUI/custom_nodes` instala el código del
nodo y su extensión web. No hay dependencias adicionales que instalar con pip.
Hay que arrancar o reiniciar ComfyUI y refrescar su interfaz después de instalar
o actualizar. `git clone` se usa para una carpeta nueva; una copia existente se
actualiza con el instalador o con `git pull --ff-only` desde main.
