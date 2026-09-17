---
name: ios-shortcuts
description: Referencia técnica para crear, ejecutar e integrar Shortcuts de Apple (iOS/iPadOS/macOS) desde otros sistemas — URL scheme, x-callback-url, automatizaciones, CLI en Mac.
---

# iOS/macOS Shortcuts — Guía técnica

## 1. Qué es
App nativa de Apple (antes "Workflow") para encadenar acciones sin código: cada acción toma un input, hace algo, y pasa un output a la siguiente. Corre en iPhone, iPad y Mac (Shortcuts.app), y también hay una versión CLI en Mac.

## 2. Crear un shortcut (en la app)
- Se arma arrastrando **acciones** en secuencia (como bloques). Cada app del sistema o de terceros que soporte Shortcuts expone sus propias acciones (ej. Mensajes, Calendario, Notas, Home).
- Tipos de acciones clave:
  - **Scripting**: If/Else, Repeat, Choose from Menu, Wait, Get Variable, Set Variable, Run Shortcut (llamar otro shortcut), Run Script Over SSH, Get Contents of URL (llamadas HTTP/API).
  - **Texto/datos**: Text, Number, Dictionary, Get Dictionary Value, Combine Text, Split Text — útil para armar JSON y mandarlo a una API.
  - **Sistema**: Set Wallpaper, Adjust Volume, Toggle Wi-Fi, Take Screenshot, Shortcuts propios de HomeKit.
- **Get Contents of URL** es la acción central si quieres que un shortcut hable con un servidor tuyo (tu PatoCiber, por ejemplo): permite método (GET/POST), headers y body (JSON, form, file).

## 3. Ejecutar un shortcut desde fuera de la app (URL scheme)
Cualquier app o sistema puede disparar un shortcut abriendo una URL:

```
shortcuts://run-shortcut?name=[nombre]&input=[input]&text=[texto]
```

- `name` (requerido): nombre exacto del shortcut, URL-encoded.
- `input` (opcional): `text` o `clipboard`.
- `text` (opcional): el texto que se usa como input si `input=text`.

Ejemplo real:
```
shortcuts://run-shortcut?name=Calculate%20Tip&input=text&text=24.99
```

En Mac funciona igual con la misma URL scheme, y también hay comando de terminal:
```bash
shortcuts run "Nombre del shortcut" --input-path archivo.txt --output-path salida.txt
shortcuts list
shortcuts view "Nombre del shortcut"
```
Esto es lo más útil si quieres correr shortcuts **desde scripts/automatizaciones en tu Mac** (cron, launchd, tu sistema NanoClaw) sin tocar la UI.

## 4. x-callback-url (recibir respuesta del shortcut)
Si necesitas que el shortcut avise cuándo terminó (éxito/cancelado/error) y con qué resultado:

```
shortcuts://x-callback-url/run-shortcut?name=Calculate%20Tip&input=text&text=24.99&x-success=miapp://ok&x-cancel=miapp://cancel&x-error=miapp://error
```

- `x-success`: URL que se abre al terminar bien. Le agrega `?result=<salida del shortcut>`.
- `x-cancel`: URL que se abre si el usuario cancela.
- `x-error`: URL que se abre si falla. Le agrega `?errorMessage=<descripción>`.

Esto es la base para encadenar un shortcut con otra app/servidor tuyo esperando el resultado.

## 5. Automatizaciones (correr solo, sin abrir la app)
Shortcuts tiene una pestaña **Automation** separada de la de shortcuts manuales:
- Disparadores: hora del día, llegar/salir de una ubicación, abrir una app, conectar a Wi-Fi/Bluetooth, NFC tag, batería baja, recibir un correo/mensaje con criterio, etc.
- Se puede poner a correr **sin confirmar** ("Run Immediately") — clave para que sea realmente automático.
- En Mac también existen automatizaciones basadas en eventos del sistema (login, conexión, etc.), aunque el set de triggers es más chico que en iOS.

## 6. Compartir / exportar un shortcut
- Botón compartir → genera un link de iCloud que cualquiera puede abrir e importar.
- También se puede exportar como archivo `.shortcut` (binario plist) — se puede mandar por AirDrop, correo, etc.
- No hay un formato de texto plano editable (no es JSON legible a mano); la edición real solo es vía la app.

## 7. Integrar apps de terceros
Si una app no tiene acciones nativas de Shortcuts, se puede invocar por su **URL scheme propio** con la acción "URL" + "Open URLs" o "Open x-callback-url" — construyendo la URL a mano con los parámetros que documente esa app (esto es contrato de cada app, no de Apple).

## 8. Patrón útil para integrarlo con un sistema propio (tipo PatoCiber/NanoClaw)
1. El shortcut recibe un input (texto, ubicación, foto, lo que sea) por Automation o por Siri.
2. Usa **Get Contents of URL** para mandar ese input como POST/JSON a tu servidor/API local.
3. Tu servidor responde JSON; el shortcut lo parsea con **Get Dictionary Value** y actúa (notificación, TTS con "Speak Text", guardar en Notas, etc.).
4. Si necesitas dispararlo desde tu sistema (no desde el teléfono), usa el CLI `shortcuts run` en el Mac, o el URL scheme `shortcuts://run-shortcut` desde cualquier proceso que pueda abrir URLs.

## Fuentes
- Guía oficial Shortcuts (Apple Support): support.apple.com/guide/shortcuts
- Run a shortcut using a URL scheme: support.apple.com/guide/shortcuts/apd624386f42
- x-callback-url con Shortcuts: support.apple.com/guide/shortcuts/apdcd7f20a6f
