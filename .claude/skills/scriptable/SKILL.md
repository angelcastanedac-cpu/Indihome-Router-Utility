---
name: scriptable
description: Referencia técnica de Scriptable (app iOS/iPadOS/macOS que corre JavaScript con APIs nativas) y cómo complementa Shortcuts — args, Script.setShortcutOutput, URL scheme scriptable://, CallbackURL/x-callback-url, widgets y automatizaciones.
---

# Scriptable — Guía técnica (complemento de Shortcuts)

## 1. Qué es y por qué complementa Shortcuts
Scriptable es una app de Apple que corre **JavaScript** con acceso a APIs nativas de iOS/iPadOS/macOS. No reemplaza a Shortcuts: lo **extiende**. Donde Shortcuts se queda corto (lógica compleja, parseo de JSON pesado, dibujar imágenes, HTTP con control fino, widgets a la medida), metes un script de Scriptable como una acción más dentro de tu shortcut.

Regla mental: **Shortcuts orquesta, Scriptable calcula.** El shortcut dispara (Siri, Automation, NFC, hora), le pasa datos al script, el script hace el trabajo pesado en JS y regresa el resultado al shortcut.

## 2. Integración con Shortcuts (el punto clave)
En la app Shortcuts hay una acción **"Run Script"** (Ejecutar script) provista por Scriptable. Por defecto cualquier script puede correrse desde ahí; para pasar/regresar datos necesitas unas líneas extra en el script.

### Recibir input desde Shortcuts → `args`
El módulo global `args` trae lo que el shortcut le mandó al script:
- `args.shortcutParameter` — el parámetro principal que pasas desde "Run Script". Puede ser **texto, lista, diccionario o archivo** (Shortcuts decide el tipo). Es lo más usado.
- `args.plainTexts` — array de textos.
- `args.urls` — array de URLs.
- `args.fileURLs` — array de rutas de archivo.
- `args.images` — array de imágenes.
- `args.queryParameters` — parámetros que llegaron por el URL scheme (ver §3).

### Regresar output a Shortcuts → `Script.setShortcutOutput`
```javascript
// Lee lo que mandó el shortcut
const entrada = args.shortcutParameter;   // texto / dict / lista / archivo

// ...tu lógica en JS...
const resultado = { ok: true, valor: 42 };

// Devuelve el resultado al shortcut (puede ser texto, número, dict, imagen, archivo)
Script.setShortcutOutput(resultado);
Script.complete();   // cierra el script y regresa el control a Shortcuts
```
El `output` queda disponible en el shortcut como resultado de la acción "Run Script", listo para encadenar a la siguiente acción.

## 3. URL scheme `scriptable://`
Igual que Shortcuts tiene `shortcuts://run-shortcut`, Scriptable expone su propio scheme para dispararse desde cualquier proceso que pueda abrir URLs:

```
scriptable:///run?scriptName=[nombre]          # correr un script (nombre URL-encoded)
scriptable:///run/[nombre]                      # variante con el nombre en el path
scriptable:///open?scriptName=[nombre]          # abrir el script en el editor
scriptable:///add?name=[nombre]&source=[código] # crear un script nuevo
```
- Los parámetros extra que agregues a la URL llegan al script en `args.queryParameters`.
- Esto es lo útil si quieres invocar Scriptable **desde tu servidor/otra app** (por ejemplo tu PatoCiber abriendo la URL), sin pasar por la UI de Scriptable.

## 4. x-callback-url en ambos sentidos
### a) Otra app llama a Scriptable y espera respuesta
Scriptable soporta x-callback-url: agrega `x-success`, `x-error`, `x-cancel` a la URL `scriptable:///run?...`. El script devuelve su resultado llamando `Script.complete()` (con lo que hayas puesto en `Script.setShortcutOutput`).

### b) Scriptable llama a un Shortcut (o a otra app) y espera respuesta — clase `CallbackURL`
Este es el complemento directo de la §4 del skill `ios-shortcuts`: desde JS puedes lanzar un shortcut y **leer su salida**.
```javascript
const cb = new CallbackURL("shortcuts://x-callback-url/run-shortcut");
cb.addParameter("name", "Nombre Del Shortcut");
cb.addParameter("input", "text");
cb.addParameter("text", "24.99");

// open() abre la app destino y ESPERA la respuesta (Promise con un dict)
const respuesta = await cb.open();   // p.ej. { result: "..." }
console.log(respuesta.result);
```
- `addParameter(name, value)` — el name/value se URL-encodean solos.
- **No agregues** `x-source/x-success/x-error/x-cancel` a mano: `CallbackURL` los pone por ti.
- `cb.getURL()` — devuelve la URL construida sin abrirla.

## 5. Widgets (lo que Shortcuts no hace)
Scriptable arma **widgets de Home Screen / Lock Screen** con `ListWidget`:
```javascript
const w = new ListWidget();
w.addText("Hola");
Script.setWidget(w);   // asigna el widget cuando corre en modo widget
Script.complete();
```
- Clases: `ListWidget`, `WidgetText`, `WidgetImage`, `WidgetStack`, `WidgetDate`, `WidgetSpacer`.
- `args.widgetParameter` — parámetro que configuras en el widget (para reusar un mismo script con distintos datos).
- Se refresca solo; no necesita que el usuario abra nada.

## 6. Detectar el contexto de ejecución → `config`
Un mismo script puede correr desde Shortcuts, widget, notificación, Siri o dentro de la app. `config` te dice dónde estás para ramificar:
- `config.runsInApp`, `config.runsInWidget`, `config.runsInAccessoryWidget`
- `config.runsInActionExtension`, `config.runsWithSiri`, `config.runsInNotification`
- `config.runsFromHomeScreen`
- `config.widgetFamily` — `small` / `medium` / `large` / etc.

## 7. Módulos/clases nativas más útiles
- **Red / datos**: `Request` (HTTP GET/POST, headers, body, `loadJSON()`, `loadImage()`, `loadString()`), `XMLParser`, `Data`, `Keychain` (guardar secretos).
- **Sistema/archivos**: `FileManager` (local e iCloud), `Pasteboard`, `Device`, `Location`, `Dictation`, `Speech`.
- **UI**: `Alert`, `UITable`/`UITableRow`/`UITableCell`, `WebView`, `Safari` (abrir in-app o normal), `QuickLook`, `ShareSheet`, `DatePicker`, `DocumentPicker`, `Photos`.
- **Apps de Apple**: `Calendar`/`CalendarEvent`, `Reminder`, `Contact`, `Mail`, `Message`.
- **Gráficos**: `Image`, `Color`, `Font`, `DrawContext`, `LinearGradient`, `Point`/`Rect`/`Size`.
- **Notificaciones**: `Notification` (programar locales, con `scriptName` para que al tocarla corra un script).
- **Fechas**: `DateFormatter`, `RelativeDateTimeFormatter`.
- **Global**: `args`, `config`, `Script`, `importModule()` + `module.exports` (reutilizar código entre scripts), `Timer`.

## 8. Patrón recomendado (con tu sistema tipo PatoCiber/NanoClaw)
1. **Shortcut** (Automation/Siri/NFC) recoge el input crudo (texto, ubicación, foto).
2. Acción **"Run Script"** → pasa ese input; el script lo lee con `args.shortcutParameter`.
3. El script usa `Request` para hablar con tu API local (POST/JSON con control total de headers), parsea la respuesta en JS.
4. `Script.setShortcutOutput(resultado)` + `Script.complete()` regresan el dato al shortcut, que sigue con notificación, TTS, guardar en Notas, etc.
5. Camino inverso: desde un script, `CallbackURL` → `shortcuts://x-callback-url/run-shortcut` para invocar un shortcut y leer su salida.
6. Para dispararlo sin tocar el teléfono: `scriptable:///run?scriptName=...` desde cualquier proceso; los params llegan en `args.queryParameters`.

## Fuentes
- Documentación oficial: docs.scriptable.app (también offline dentro de la app)
- `args` (input desde Shortcuts): docs.scriptable.app/args
- URL scheme: docs.scriptable.app/urlscheme
- `CallbackURL` (x-callback-url): docs.scriptable.app/callbackurl
- `Script` (setShortcutOutput / complete / setWidget): docs.scriptable.app/script
