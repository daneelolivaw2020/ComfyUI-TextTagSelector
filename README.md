# ComfyUI Text Tag Selector

Custom node en desarrollo para convertir líneas de texto en un muro horizontal
de cápsulas seleccionables y concatenar la selección en una salida `STRING`.

**Estado: v0.1.0, primera versión de prueba instalable.** Backend y pruebas locales
comprobados; la integración completa con ComfyUI y el iframe real de Colab está
pendiente. No requiere dependencias de Python adicionales.

## Instalación en tu notebook de Colab

Añade una celda **después de instalar ComfyUI y antes de la celda que lo arranca**:

```python
from urllib.request import urlopen

installer = "https://raw.githubusercontent.com/daneelolivaw2020/ComfyUI-TextTagSelector/main/examples/colab_install.py"
exec(compile(urlopen(installer).read(), installer, "exec"))
```

La celda ejecuta el [instalador del repositorio](examples/colab_install.py), que
clona el nodo en `/content/ComfyUI/custom_nodes/ComfyUI-TextTagSelector`. Las
siguientes ejecuciones actualizan mediante `git pull --ff-only`. Si hay cambios
locales, los conserva y muestra un error. No necesita token ni Colab Secret.

Si ComfyUI ya estaba funcionando, detenlo y arráncalo de nuevo después de la
instalación. Después actualiza el iframe para cargar el JavaScript nuevo.
En el notebook de muestra, ejecutar otra vez la celda de arranque sin detener el
servidor únicamente vuelve a conectar el iframe: no carga el Python recién instalado.

Para una instalación local: clona este repositorio dentro de `ComfyUI/custom_nodes`
y reinicia ComfyUI y su interfaz.

## Primer uso

1. Busca **Text Tag Selector** en el menú de nodos, categoría **Luis/Text**.
2. Abre **Edit text**, pega una línea por fragmento y pulsa **Reload**.
3. Activa las cápsulas deseadas y conecta la salida **text** a un input STRING.
4. Opcional: conecta **Text (Multiline)** nativo a **source** y pulsa Reload para
   importar su contenido. Conexión directa, con su campo `value` editable.

Reload no ejecuta el workflow. Editar el texto fuente no modifica los fragmentos
ya cargados hasta el siguiente Reload. Contraer una sección no desactiva sus tags.
Los fragmentos nuevos empiezan OFF. Guardar el workflow conserva el contenido
cargado, las selecciones y la configuración sin tener que repetir Reload.

## Funciones de esta versión

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

## Límites y comprobaciones

La fuente externa inicial admite exclusivamente el nodo nativo multilineal
conectado directamente. No admite texto calculado por otros nodos, subgrafos o
nodos de reroute. La salida usa siempre la instantánea guardada, incluso si se
recibe otro texto mediante la entrada `source` durante una ejecución por API.

Los encabezados `--- Título` están reservados; no se ofrece aún un escape para
introducir una línea literal con ese formato. Se ignoran líneas de solo espacios.
Separator y Suffix interpretan `\n`, `\t` y `\\` una sola vez; las otras secuencias
se conservan. El resto del contenido conserva su puntuación y espacios.

Se probaron Python, el instalador con un remoto Git local, las funciones de estado
JavaScript y la interfaz real de navegador en un anfitrión de widgets simulado.
Esa prueba no demuestra compatibilidad con el frontend completo de ComfyUI,
su deshacer/rehacer, la caché real o el iframe de Colab; siguen pendientes.

## Pruebas de desarrollo

```text
python -m unittest discover -s tests -v
node --test tests/state.test.js
```

Prueba opcional DOM/CSS + salida Python: `node tests/browser_smoke.cjs`.
Requiere Playwright y Chromium. Admite las variables `TTS_CHROMIUM` para la ruta
del navegador y `TTS_PYTHON` para la del intérprete. Sus imágenes y fixtures se
guardan en `.test-runtime/`, excluido de Git.
