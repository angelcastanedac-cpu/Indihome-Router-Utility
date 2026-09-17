---
name: actions-app
description: Referencia técnica de "Actions" (app gratis y open source de Sindre Sorhus que agrega +180 acciones nativas a la app Shortcuts en iOS/iPadOS/macOS/visionOS) — qué acciones aporta, agrupadas por categoría, y cómo complementa Shortcuts.
---

# Actions (Sindre Sorhus) — Guía técnica (complemento de Shortcuts)

## 1. Qué es y por qué complementa Shortcuts
"Actions" es una app **gratuita y open source (MIT)** que agrega **+180 acciones nativas** a la app Shortcuts de Apple. Rellena huecos del set de acciones que trae Apple: manejar JSON/CSV, colores, listas, fechas, URLs, estado del dispositivo, variables globales, etc.

Diferencia con Scriptable: no escribes código. Son **acciones nativas de Shortcuts** — aparecen en la barra lateral de Shortcuts bajo "Actions" y las arrastras como cualquier otra. Elección práctica:
- **Actions** → cuando falta una acción concreta (parsear JSON5, generar UUID, filtrar lista). Cero código.
- **Scriptable** → cuando necesitas lógica libre en JavaScript.

## 2. Instalación y funcionamiento
- Se instala del App Store (iOS/iPadOS/macOS/visionOS). Es gratis.
- **No tiene interfaz ni necesita estar corriendo**: instálala, abre Shortcuts, crea/edita un shortcut y busca "Actions" en la barra lateral derecha.
- Al ser open source, la lista canónica de acciones sale del sitio del autor y de su gist público.

## 3. Acciones que aporta (agrupadas por categoría)

### Texto
Ask for Text with Timeout · Transform Text · Transform Text with JavaScript · Write or Edit Text · Trim Whitespace · Truncate Text · Get Paragraphs from Text · Get Sentences from Text · Remove Duplicate Lines · Remove Empty Lines · Remove Non-Printable Characters · Reverse Lines · Get Related Words · Get Emojis · Remove Emojis · Generate Random Text · Hex Encode

### Listas
Add to List · Remove from List · Combine Lists · Filter List · Transform Lists · Sort List · Shuffle List · Reverse List · Truncate List · Remove Duplicates from List · Get Index of List Item · Choose from List (Extended)

### Diccionarios / JSON / CSV
Merge Dictionaries · Pretty Print Dictionaries · Get Values Using JSONPath · Parse JSON5 · Generate CSV · Parse CSV

### Números / matemáticas
Clamp Number · Round Number to Multiple · Truncate Number · Spell Out Number · Format Number as Ordinal · Format Number — Compact · Format Currency · Get Random Floating-Point Number · Get Random Number from Seed

### Booleanos
Boolean · Toggle Boolean · Get Boolean from Input · Get Random Boolean

### Fechas / tiempo
Convert Date to Unix Time · Convert Unix Time to Date · Format Date Difference · Format Duration · Get Random Date and Time · Sort Months · Is Day · Is Time · Is Time In Range · Wait Milliseconds · Get High-Resolution Timestamp

### URLs / red
Create URL · Edit URL · Get Title of URL · Get Query Item Value from URL · Get Query Items from URL · Get Query Items from URL as Dictionary · Open URLs in Safari · Open URLs with App · Download File · Is Host Reachable · Is Web Server Reachable · Is Online

### Colores / imágenes
Color · Pick Color · Create Color Image · Get Random Color · Get Average Color · Get Average Color of Image · Get Dominant Colors of Image · Sample Color from Screen · Blur Images · Invert Images · Get SF Symbol Image · Get File Icon · Get Map Image of Location · Scan QR Codes in Image · Get Image Capture Date · Set Image Capture Date · Apply Capture Date · Get Image Location · Set Image Location

### Archivos
Get File Path · Overwrite File · Download File · Encrypt File · Set Creation and Modification Date of File · Get Uniform Type Identifier · Set Uniform Type Identifier · Is Conforming to Uniform Type Identifier · Scan Documents

### Dispositivo / estado del sistema
Get Device Details (Extended) · Get Device Orientation · Is Device Orientation · Get Device Motion Data · Is Device Moving · Is Shaking Device · Get Compass Heading · Get Battery State · Is Low Power Mode On · Is Dark Mode On · Is Device Locked · Is Screen Locked · Is Silent Mode On · Get Audio Playback Destination · Is Audio Playing · Is Call Active · Is Camera On · Is Microphone On · Get Modifier Key State · Is Accessibility Feature On · Get Running Apps · Get User Details

### Conectividad
Is Wi-Fi On · Join Wi-Fi · Is Bluetooth On · Get Bluetooth Device · Get Bluetooth Devices · Is Cellular Data On · Is Cellular Low Data Mode On · Is Connected to VPN

### Variables globales (persisten entre shortcuts)
Global Variable: Set Text/Number/Boolean · Global Variable: Get Text/Number/Boolean · Global Variable: Get All · Global Variable: Delete

### Portapapeles con nombre (varios "clipboards")
Named Clipboard: Set Text/Data · Named Clipboard: Get Text/Data · Named Clipboard: Clear

### Notificaciones / feedback / UI
Show Notification · Remove Notifications · Create Notification Action · Create Menu Item · Generate Haptic Feedback · Play Alert Sound · Flash Screen · Hide Shortcuts App

### Seguridad / datos
Authenticate · Encrypt Text · Encrypt File · Generate UUID · Generate Random Data · Get Random Emoticon

### Ubicación
Convert Coordinates to Location · Convert Location to Geo URI · Get Map Image of Location

### Impresión / otros
Get Default Printer · Set Default Printer · Calculate with Soulver · Format Person Name · Transcribe Audio (Legacy) · Combine Videos · Get Music Playlists · Get Actions App Version · Send Feedback

> Nota: la lista exacta crece con cada versión (+180 acciones). Fuente canónica: sitio del autor y gist público (ver Fuentes).

## 4. Cómo encaja con los otros dos skills
- **`ios-shortcuts`**: base — orquestación, URL scheme, x-callback-url, automatizaciones.
- **`scriptable`**: lógica libre en JavaScript cuando ninguna acción alcanza.
- **`actions-app`** (este): acciones nativas listas para arrastrar cuando falta una pieza puntual, sin escribir código.

Patrón típico: arma el flujo en Shortcuts, cubre huecos con acciones de **Actions** (JSON, listas, fechas, estado del dispositivo), y solo baja a **Scriptable** cuando de plano necesitas programar.

## Fuentes
- Sitio oficial (lista completa): sindresorhus.com/actions
- App Store (Actions, gratis): apps.apple.com/us/app/actions/id1586435171
- Gist oficial con la lista de acciones: gist.github.com/sindresorhus/fbba65a774fb9da915e624807a02a6d2
