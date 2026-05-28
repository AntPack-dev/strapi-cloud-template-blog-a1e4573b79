# User Article Creation — Frontend Integration Guide

Guía completa para integrar el flujo de creación de artículos por usuarios lectores desde el frontend. Cubre todo el ciclo: i18n (español/inglés), subir imágenes, crear borrador, auto-guardar, enviar a revisión, retirar revisión, ver el historial de eventos y eliminar historia.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Internacionalización (i18n)](#2-internacionalización-i18n)
3. [Autenticación](#3-autenticación)
4. [Flujo de estados](#4-flujo-de-estados)
5. [Subir imagen](#5-subir-imagen)
6. [Crear artículo](#6-crear-artículo)
7. [Tipos de bloques](#7-tipos-de-bloques)
8. [Auto-guardar (PATCH)](#8-auto-guardar-patch)
9. [Enviar a revisión](#9-enviar-a-revisión)
10. [Retirar revisión](#10-retirar-revisión)
11. [Eliminar historia](#11-eliminar-historia)
12. [Ver / previsualizar un artículo](#12-ver--previsualizar-un-artículo)
13. [Mis artículos](#13-mis-artículos)
14. [Feed público de historias aprobadas](#14-feed-público-de-historias-aprobadas)
15. [Selectores de categorías y países](#15-selectores-de-categorías-y-países)
16. [Detalles de la revisión y historial](#16-detalles-de-la-revisión-y-historial)
17. [Manejo de errores](#17-manejo-de-errores)
18. [Flujo completo paso a paso](#18-flujo-completo-paso-a-paso)
19. [Consideraciones importantes](#19-consideraciones-importantes)
20. [Cambios respecto a versiones anteriores](#20-cambios-respecto-a-versiones-anteriores)

---

## 1. Visión general

Los usuarios autenticados (lectores) pueden crear sus propias historias desde una interfaz externa sin acceder al panel de administración de Strapi. El flujo es:

```
Usuario escribe → guarda borrador → envía a revisión → equipo editorial revisa → aprobado o requiere ajustes
```

Los artículos creados por usuarios:
- Viven en su **propia colección** (`/api/user-articles`) — completamente separados de los artículos editoriales
- Empiezan siempre en estado `draft`
- Requieren aprobación del equipo editorial para aparecer en el feed público
- Identifican al autor con los datos del perfil del usuario (`firstName`, `lastName`, `imageUrl`)
- Soportan **multi-idioma**: el usuario crea su versión en el idioma activo del frontend; el editor decide si crea las traducciones
- Llevan un **historial de eventos** auditable (colección `user-article-events`) por idioma

> **Importante**: los artículos de usuarios NO están en `/api/articles`. El feed de historias aprobadas se obtiene desde `/api/user-articles` con filtro de estado.

---

## 2. Internacionalización (i18n)

El proyecto está configurado con dos locales: **`es-US`** (español) y **`en`** (inglés).

### Reglas del flujo

- **El usuario solo crea su historia en el idioma activo del frontend.** Si está navegando en español, la historia se crea en `es-US`. Si está en inglés, en `en`.
- **El usuario NO crea traducciones.** El editor decide si crear la versión en el otro idioma desde el admin panel.
- **Cada versión tiene su propio estado de revisión.** Aprobar la versión en español no aprueba la versión en inglés. Cada locale se revisa independientemente.
- **Cada versión tiene su propio historial de eventos.** Lo que pasa en la versión en español no aparece en el historial de la versión en inglés.

### Cómo se pasa el locale

En **todas** las llamadas al API, hay que pasar `?locale=es-US` o `?locale=en` según el idioma activo. Si no se pasa, Strapi usa el locale por defecto del sistema (configurado en Settings → Internationalization).

```
GET /api/user-articles/my-articles?locale=es-US
POST /api/user-articles/create-article?locale=es-US
PATCH /api/user-articles/lipig6h289w7jphr4rulzpez?locale=es-US
```

### Identificador en las URLs: `documentId`

Las URLs del API usan el **`documentId`** (UUID, único entre locales) en lugar del `id` numérico. El `documentId` es un identificador conceptual del "documento" — todas las versiones (es-US, en) del mismo artículo comparten el mismo `documentId`.

```
PATCH /api/user-articles/{documentId}?locale=es-US
GET /api/user-articles/{documentId}?locale=es-US
```

Cuando el frontend hace `GET /api/user-articles/my-articles?locale=es-US`, cada artículo en la lista trae su `documentId` (string UUID). Ese es el valor a usar en las URLs.

### Campos localizados vs compartidos

Cuando un campo es **localizado**, cada versión (es-US, en) tiene su propio valor. Cuando es **compartido**, el valor es el mismo entre todas las versiones.

| Campo | Localizado | Razón |
|---|---|---|
| `title`, `slug`, `description` | ✅ Sí | Texto traducible |
| `blocks`, `seo` | ✅ Sí | Contenido editorial traducible |
| `readingTime`, `wordCount` | ✅ Sí | Calculado del contenido localizado |
| `currentStatus`, `reviewer`, `reviewComments` | ✅ Sí | Cada versión se revisa por separado |
| `events` (historial) | ✅ Sí | Cada versión tiene su propio audit trail |
| `cover`, `imageCard` | ❌ Compartido | Misma imagen para todos los idiomas |
| `userAuthor` | ❌ Compartido | El autor original es uno solo |
| `main_category`, `sub_categories`, `countries` | ❌ Compartido | Clasificación lógica idéntica |
| `creationDate` | ❌ Compartido | Fecha de creación original es única |

> Si el usuario edita un campo compartido (ej. cambia la imagen de cover), se aplica a todas las versiones del documento.

---

## 3. Autenticación

Todos los endpoints de creación/edición requieren el JWT del usuario autenticado.

```
Authorization: Bearer <jwt>
```

El JWT se obtiene al hacer login. Ver `OAUTH_FRONTEND_GUIDE.md` y `USER_PROFILE_SERVICE.md` para el flujo de autenticación completo.

---

## 4. Flujo de estados

```
draft ──► in-review ──► approved
  ▲            │
  │◄───────────┘ (withdraw)
  ▲            │
  └────────────┘
        requires-changes
```

| Estado | Quién lo asigna | El usuario puede editar | El usuario puede retirar |
|---|---|---|---|
| `draft` | Backend al crear | ✅ Sí | — |
| `in-review` | Usuario al solicitar revisión | ❌ No | ✅ Sí |
| `requires-changes` | Equipo editorial | ✅ Sí | — |
| `approved` | Equipo editorial | ❌ No | ❌ No |

**Regla clave**: `PATCH` y `POST .../submit` solo funcionan cuando el artículo está en `draft` o `requires-changes`. Intentar editar o enviar un artículo `in-review` o `approved` devuelve `403 Forbidden`.

**El estado es por idioma.** Si la versión en `es-US` está `approved` pero el editor aún no terminó la versión en `en`, los estados son independientes.

**Transición a `requires-changes` (validación server-side):** cuando el editor (desde el admin panel) intenta pasar un artículo a `requires-changes`, el backend valida que el artículo tenga **reviewer asignado** y **`reviewComments` no vacío**. Si falta cualquiera de los dos, el update se rechaza con un error de aplicación. Esta validación protege al flujo: no se le pueden pedir cambios al usuario sin indicarle qué arreglar ni quién es el responsable.

---

## 5. Subir imagen

Las imágenes deben subirse **antes** de crear o actualizar el artículo. Se obtiene un `id` de archivo que se usa como referencia en los campos `cover` y dentro de los bloques de tipo imagen.

### Endpoint

```
POST /api/image-uploads/user-upload
Authorization: Bearer <jwt>
Content-Type: multipart/form-data
```

### Body

| Campo | Tipo | Descripción |
|---|---|---|
| `file` | File | Imagen a subir. Formatos: JPG, PNG, WEBP. Máximo 5MB. |

### Respuesta exitosa `201 Created`

```json
{
  "data": {
    "id": 42,
    "name": "mi-portada.jpg",
    "url": "https://cdn.example.com/mi-portada.jpg",
    "mime": "image/jpeg",
    "size": 245678
  }
}
```

El `id` de la respuesta (`42` en el ejemplo) es el valor que se envía como `cover` al crear o actualizar el artículo, y como `file` dentro de bloques de tipo imagen.

> Las imágenes son **compartidas** entre locales. Subir una imagen no requiere especificar locale, y al asignarla a un artículo se ve en todas las versiones.

---

## 6. Crear artículo

Crea un artículo nuevo en estado `draft`, en el locale especificado. El slug, el tiempo de lectura y el conteo de palabras se calculan automáticamente.

### Endpoint

```
POST /api/user-articles/create-article?locale=es-US
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | string | ✅ | Título del artículo |
| `cover` | number | ✅ | ID del archivo de portada (compartido entre locales) |
| `description` | string | ❌ | Subtítulo / descripción corta. Máximo 80 caracteres. |
| `main_category` | string \| number | ❌ | documentId UUID (recomendado) o id numérico de `/api/main-categories` |
| `sub_categories` | (string \| number)[] | ❌ | Array de documentIds o ids de `/api/user-sub-categories` |
| `countries` | number[] | ❌ | Array de IDs de países (lo asigna el editor, en general) |
| `blocks` | array | ❌ | Bloques de contenido. Ver [sección 7](#7-tipos-de-bloques). |
| `creationDate` | string (YYYY-MM-DD) | ❌ | Fecha de creación visible (compartida entre locales) |

### Ejemplo de request

```http
POST /api/user-articles/create-article?locale=es-US
```

```json
{
  "title": "Mi primera historia",
  "cover": 42,
  "description": "Un subtítulo de máximo 80 caracteres.",
  "main_category": "lipig6h289w7jphr4rulzpez",
  "sub_categories": ["zl1b0b8cs8bf9fagdmummq02"],
  "creationDate": "2026-05-25",
  "blocks": [
    {
      "__component": "shared.rich-text",
      "body": "Este es el primer párrafo de mi historia."
    },
    {
      "__component": "shared.subtitle",
      "text": "Un subtítulo dentro del cuerpo"
    },
    {
      "__component": "shared.media",
      "file": 43
    },
    {
      "__component": "shared.user-quote",
      "body": "El texto de la cita va aquí.",
      "source": "Nombre del autor (opcional)"
    }
  ]
}
```

### Respuesta exitosa `201 Created`

```json
{
  "data": {
    "id": 101,
    "documentId": "abc123xyz",
    "locale": "es-US",
    "title": "Mi primera historia",
    "slug": "mi-primera-historia",
    "description": "Un subtítulo de máximo 80 caracteres.",
    "currentStatus": "draft",
    "readingTime": 3,
    "wordCount": 542,
    "creationDate": "2026-05-25",
    "cover": { "id": 42, "url": "https://cdn.example.com/mi-portada.jpg" },
    "imageCard": { "id": 42, "url": "https://cdn.example.com/mi-portada.jpg" },
    "userAuthor": {
      "id": 7,
      "firstName": "Sebastián",
      "lastName": "Meneses",
      "imageUrl": "https://cdn.example.com/avatar.jpg"
    },
    "reviewer": null,
    "reviewComments": null,
    "main_category": { "id": 32, "name": "El Feed que Importa", "slug": "el-feed-que-importa", "backgroundColor": "#E3F2FD" },
    "sub_categories": [
      { "id": 2, "name": "Actualidad", "slug": "actualidad", "description": "..." }
    ],
    "countries": [],
    "blocks": [ "..." ]
  }
}
```

**Notas:**
- El `documentId` devuelto es el identificador que se usa en todas las URLs posteriores (PATCH, GET, DELETE, submit, withdraw).
- El `locale` confirma el idioma de la versión creada.
- `readingTime` y `wordCount` se calculan automáticamente — **no enviarlos en el payload**.

---

## 7. Tipos de bloques

Cada bloque del cuerpo del artículo requiere el campo `__component` para identificar su tipo.

### `shared.rich-text` — Bloque de texto

```json
{
  "__component": "shared.rich-text",
  "body": "Contenido del párrafo en texto plano o markdown."
}
```

### `shared.subtitle` — Subtítulo

```json
{
  "__component": "shared.subtitle",
  "text": "Título de sección dentro del artículo"
}
```

### `shared.media` — Imagen

```json
{
  "__component": "shared.media",
  "file": 43
}
```

La imagen se sube primero con el [endpoint de upload](#5-subir-imagen) y el `id` resultante va aquí.

### `shared.user-quote` — Cita

```json
{
  "__component": "shared.user-quote",
  "body": "El texto de la cita va aquí.",
  "source": "Nombre del autor o fuente"
}
```

> Usar siempre `shared.user-quote`, nunca `shared.quote`. El componente `shared.quote` es para uso editorial interno.

---

## 8. Auto-guardar (PATCH)

Actualiza un artículo existente en su locale. Todos los campos son opcionales — solo se actualizan los que se envían.

### Endpoint

```
PATCH /api/user-articles/{documentId}?locale=es-US
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` en ese locale es `draft` o `requires-changes`
- Devuelve `403` si el artículo está `in-review` o `approved` en ese locale

### Body

Mismos campos que el [create](#6-crear-artículo), todos opcionales.

```json
{
  "title": "Título actualizado",
  "main_category": "ru934h8oknep455kwixbro06",
  "sub_categories": ["kak2g6ygzkm96if5t0xh8rdt"],
  "blocks": [
    { "__component": "shared.rich-text", "body": "Nuevo contenido..." }
  ]
}
```

> **Atención con los bloques**: al enviar `blocks`, se reemplaza el array completo. Siempre enviar el array entero con todos los bloques actuales.

### Respuesta exitosa `200 OK`

Misma estructura que el create, con los datos actualizados.

---

## 9. Enviar a revisión

Cambia el estado de `draft` o `requires-changes` a `in-review` en el locale especificado. Corresponde al botón "Solicitar aprobación" de la UI. **Genera automáticamente un evento `submitted` en el historial de ese locale.**

### Endpoint

```
POST /api/user-articles/{documentId}/submit?locale=es-US
Authorization: Bearer <jwt>
```

No requiere body.

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` en ese locale es `draft` o `requires-changes`
- El artículo debe tener título; si no, devuelve `400`

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "documentId": "abc123xyz",
    "locale": "es-US",
    "currentStatus": "in-review",
    "cover": { "..." },
    "main_category": { "..." }
  }
}
```

---

## 10. Retirar revisión

Saca el artículo del proceso de revisión y lo regresa a `draft` en el locale especificado. **Genera automáticamente un evento `withdrawn`.**

### Endpoint

```
POST /api/user-articles/{documentId}/withdraw?locale=es-US
Authorization: Bearer <jwt>
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` en ese locale es `in-review`
- Devuelve `400` si el artículo no está en revisión

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "documentId": "abc123xyz",
    "locale": "es-US",
    "currentStatus": "draft"
  }
}
```

---

## 11. Eliminar historia

Elimina **la versión en el locale especificado**, junto con sus eventos del historial (cascade delete). Si solo existe esa versión, el documento entero queda sin entradas.

### Endpoint

```
DELETE /api/user-articles/{documentId}?locale=es-US
Authorization: Bearer <jwt>
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` en ese locale es `draft` o `requires-changes`
- Devuelve `403` si el artículo está `in-review` o `approved` en ese locale

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "message": "Historia eliminada correctamente"
  }
}
```

> El delete es irreversible. Mostrar un modal de confirmación en la UI antes de llamar al endpoint. Si el documento tiene versiones en otros locales (creadas por el editor), esas otras versiones **NO** se eliminan — solo la del locale especificado.

---

## 12. Ver / previsualizar un artículo

Devuelve el artículo completo en el locale especificado. Solo accesible por el propietario.

### Endpoint

```
GET /api/user-articles/{documentId}?locale=es-US
Authorization: Bearer <jwt>
```

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "documentId": "abc123xyz",
    "locale": "es-US",
    "title": "Mi primera historia",
    "slug": "mi-primera-historia",
    "description": "Un subtítulo de máximo 80 caracteres.",
    "currentStatus": "requires-changes",
    "readingTime": 3,
    "wordCount": 542,
    "creationDate": "2026-05-25",
    "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
    "imageCard": { "..." },
    "userAuthor": {
      "id": 7,
      "firstName": "Sebastián",
      "lastName": "Meneses",
      "imageUrl": "https://cdn.example.com/avatar.jpg"
    },
    "reviewer": {
      "id": 3,
      "firstname": "Ana",
      "lastname": "García"
    },
    "reviewComments": "El artículo necesita más desarrollo en la sección de conclusiones.",
    "main_category": { "id": 32, "name": "El Feed que Importa", "slug": "el-feed-que-importa", "backgroundColor": "#E3F2FD" },
    "sub_categories": [
      { "id": 2, "name": "Actualidad", "slug": "actualidad" }
    ],
    "countries": [
      { "id": 1, "name": "Colombia", "slug": "colombia" }
    ],
    "blocks": [
      { "id": 1, "__component": "shared.rich-text", "body": "Contenido..." },
      { "id": 2, "__component": "shared.subtitle", "text": "Un subtítulo" },
      { "id": 3, "__component": "shared.media", "file": { "id": 43, "url": "https://cdn.example.com/imagen.jpg" } },
      { "id": 4, "__component": "shared.user-quote", "body": "La cita.", "source": "Autor" }
    ]
  }
}
```

> `reviewer` usa `firstname` y `lastname` en **minúscula** (viene de `admin::user`). `userAuthor` usa `firstName` y `lastName` en **camelCase** (viene de `users-permissions.user`). No confundir.

---

## 13. Mis artículos

Lista paginada de los artículos del usuario autenticado **en el locale especificado**.

### Endpoint

```
GET /api/user-articles/my-articles?locale=es-US
Authorization: Bearer <jwt>
```

### Query params

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `locale` | string | locale default del sistema | `es-US` o `en` |
| `page` | number | `1` | Página actual |
| `pageSize` | number | `10` | Artículos por página (máximo 50) |
| `currentStatus` | string | — | Filtrar: `draft`, `in-review`, `requires-changes`, `approved` |

### Ejemplos

```
GET /api/user-articles/my-articles?locale=es-US
GET /api/user-articles/my-articles?locale=en&currentStatus=requires-changes
GET /api/user-articles/my-articles?locale=es-US&page=2&pageSize=5
```

### Respuesta exitosa `200 OK`

```json
{
  "data": [
    {
      "id": 101,
      "documentId": "abc123xyz",
      "locale": "es-US",
      "title": "Mi primera historia",
      "slug": "mi-primera-historia",
      "description": "Un subtítulo...",
      "currentStatus": "requires-changes",
      "readingTime": 3,
      "wordCount": 542,
      "creationDate": "2026-05-25",
      "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
      "imageCard": { "..." },
      "main_category": { "id": 32, "name": "El Feed que Importa", "slug": "el-feed-que-importa" }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 3,
      "pageCount": 1
    }
  }
}
```

> La lista no incluye `blocks`, `reviewComments` ni `sub_categories` por performance. Para cargar el contenido completo usar `GET /api/user-articles/{documentId}?locale=...`.

---

## 14. Feed público de historias aprobadas

Devuelve los artículos de usuarios aprobados, filtrados por idioma. No requiere autenticación.

### Endpoint base

```
GET /api/user-articles?filters[currentStatus][$eq]=approved&locale=es-US
```

### Filtrar por sección (`main_category`)

```
GET /api/user-articles
  ?filters[currentStatus][$eq]=approved
  &filters[main_category][slug][$eq]=el-feed-que-importa
  &locale=es-US
  &populate[cover]=true
  &populate[main_category]=true
  &populate[sub_categories]=true
  &populate[userAuthor][fields][0]=firstName
  &populate[userAuthor][fields][1]=lastName
  &populate[userAuthor][fields][2]=imageUrl
```

**Importante para la UI**: si `data.length === 0`, **no mostrar la sección**.

### Respuesta exitosa `200 OK`

```json
{
  "data": [
    {
      "id": 101,
      "documentId": "abc123xyz",
      "locale": "es-US",
      "title": "Mi primera historia",
      "slug": "mi-primera-historia",
      "description": "Un subtítulo...",
      "currentStatus": "approved",
      "readingTime": 3,
      "wordCount": 542,
      "creationDate": "2026-05-25",
      "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
      "userAuthor": {
        "id": 7,
        "firstName": "Sebastián",
        "lastName": "Meneses",
        "imageUrl": "https://cdn.example.com/avatar.jpg"
      },
      "main_category": { "id": 32, "name": "El Feed que Importa", "slug": "el-feed-que-importa" },
      "sub_categories": [
        { "id": 2, "name": "Actualidad", "slug": "actualidad" }
      ]
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 15. Selectores de categorías y países

Endpoints públicos para poblar los dropdowns del formulario. **Pasar siempre el locale.**

### Categoría principal (`main_category`)

```
GET /api/main-categories?locale=es-US
```

```json
{
  "data": [
    {
      "id": 32,
      "documentId": "lipig6h289w7jphr4rulzpez",
      "locale": "es-US",
      "name": "El Feed que Importa",
      "slug": "el-feed-que-importa",
      "backgroundColor": "#E3F2FD"
    }
  ]
}
```

> Enviar `documentId` como `main_category` al crear/actualizar (recomendado), o el `id` numérico.

### Subcategorías (`sub_categories`)

```
GET /api/user-sub-categories?locale=es-US
```

```json
{
  "data": [
    { "id": 2, "documentId": "zl1b0b8cs8bf9fagdmummq02", "locale": "es-US", "name": "Actualidad", "slug": "actualidad", "description": "..." }
  ]
}
```

> Enviar `documentId` (recomendado) o `id` como elementos del array `sub_categories`.

### Países

```
GET /api/countries
```

> Los países NO son localizados. No requiere `?locale=`.

---

## 16. Detalles de la revisión y historial

El historial es **por idioma**. Solo trae eventos del locale del artículo en cuestión.

### Cómo obtener el historial

**Opción 1 — populate desde el artículo** (recomendado, una sola request):

```
GET /api/user-articles/{documentId}?locale=es-US
  &populate[events][sort]=createdAt:asc
  &populate[events][populate][actorAdmin][fields][0]=firstname
  &populate[events][populate][actorAdmin][fields][1]=lastname
  &populate[events][populate][actorUser][fields][0]=firstName
  &populate[events][populate][actorUser][fields][1]=lastName
  &populate[reviewer]=true
  &populate[cover]=true
  &populate[main_category]=true
```

**Opción 2 — endpoint dedicado** (recomendado para mostrar solo el historial):

```
GET /api/user-articles/{documentId}/events?locale=es-US
Authorization: Bearer <jwt>
```

Devuelve los eventos del artículo en el locale especificado, ordenados por fecha ascendente, con los actores poblados. Valida ownership: el usuario solo puede ver el historial de sus propios artículos.

Respuesta:

```json
{
  "data": [
    {
      "id": 1,
      "type": "submitted",
      "fromStatus": "draft",
      "toStatus": "in-review",
      "comment": null,
      "createdAt": "2026-05-27T12:00:00.000Z",
      "actorAdmin": null,
      "actorUser": { "id": 7, "firstName": "Sebastián", "lastName": "Meneses" }
    },
    {
      "id": 2,
      "type": "assigned",
      "createdAt": "2026-05-27T13:00:00.000Z",
      "actorAdmin": { "id": 3, "firstname": "Ana", "lastname": "García" },
      "actorUser": null
    }
  ]
}
```

### Estructura de un evento

```json
{
  "id": 1,
  "documentId": "evt_abc123",
  "locale": "es-US",
  "type": "submitted",
  "fromStatus": "draft",
  "toStatus": "in-review",
  "comment": null,
  "createdAt": "2026-05-27T12:00:00.000Z",
  "actorAdmin": null,
  "actorUser": { "id": 7, "firstName": "Sebastián", "lastName": "Meneses" }
}
```

### Tipos de eventos

| `type` | Cuándo se genera | Actor | Campos adicionales |
|---|---|---|---|
| `submitted` | Usuario hace POST `/submit` | `actorUser` | `fromStatus`, `toStatus` |
| `assigned` | Editor se asigna como reviewer | `actorAdmin` | — |
| `comments-added` | Editor edita `reviewComments` | `actorAdmin` | `comment` (preview hasta 500 chars) |
| `status-changed` | Editor cambia status (in-review→approved/requires-changes) | `actorAdmin` | `fromStatus`, `toStatus` |
| `withdrawn` | Usuario hace POST `/withdraw` | `actorUser` | `fromStatus`, `toStatus` |

### Mapeo eventos → UI

```js
const labelByEvent = {
  'submitted':       'Enviado a revisión',
  'assigned':        'Asignado a equipo editorial',
  'comments-added':  'Comentarios del editor actualizados',
  'status-changed':  (e) => `Estado: ${e.fromStatus} → ${e.toStatus}`,
  'withdrawn':       'Revisión retirada por el autor',
};

const historyEvents = events.map(e => ({
  label:     typeof labelByEvent[e.type] === 'function'
               ? labelByEvent[e.type](e)
               : labelByEvent[e.type],
  timestamp: e.createdAt,
  actor:     e.actorAdmin
               ? `${e.actorAdmin.firstname} ${e.actorAdmin.lastname}`
               : (e.actorUser ? `${e.actorUser.firstName} ${e.actorUser.lastName}` : null),
  comment:   e.comment,
}));
```

### Acciones disponibles según estado

| Estado | Acciones disponibles |
|---|---|
| `draft` | Editar, Enviar a revisión, Eliminar |
| `in-review` | Ver detalles, Retirar revisión |
| `requires-changes` | Editar, Ver comentarios, Enviar a revisión, Eliminar |
| `approved` | Solo lectura |

---

## 17. Manejo de errores

Todos los endpoints siguen el mismo formato:

```json
{
  "data": null,
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "El campo title es requerido"
  }
}
```

### Códigos de respuesta

| Código | Significado | Causa más común |
|---|---|---|
| `400 Bad Request` | Datos inválidos | Campo requerido ausente, estado incorrecto |
| `401 Unauthorized` | Sin autenticación | JWT faltante o expirado |
| `403 Forbidden` | Sin permiso | Artículo de otro usuario, estado no editable, locale equivocado |
| `404 Not Found` | No encontrado | documentId inexistente o sin versión en ese locale |
| `500 Internal Server Error` | Error del servidor | Contactar al backend |

---

## 18. Flujo completo paso a paso

```
1. Detectar idioma activo del frontend (es-US o en)
   → const locale = i18n.currentLocale

2. Usuario escribe el título
   → POST /user-articles/create-article?locale={locale} con { title, cover } mínimo
   → guardar el documentId devuelto

3. Usuario sube imagen de portada
   → POST /api/image-uploads/user-upload (multipart, campo "file")
   → PATCH /user-articles/{documentId}?locale={locale} con { cover: <id> }

4. Usuario selecciona categorías
   → GET /api/main-categories?locale={locale}
   → GET /api/user-sub-categories?locale={locale}
   → PATCH /user-articles/{documentId}?locale={locale}
       con { main_category: <documentId>, sub_categories: [<documentId>, ...] }

5. Usuario agrega bloques de contenido
   → imágenes dentro de bloques: primero upload, luego id en el bloque
   → PATCH con el array completo de blocks cada X segundos (auto-save)

6. Usuario hace click en "Solicitar aprobación"
   → POST /api/user-articles/{documentId}/submit?locale={locale}
   → poner UI en modo solo lectura (currentStatus = "in-review")
   → mostrar panel "Detalles de la revisión" con historial

7. [Opcional] Usuario hace click en "Retirar revisión"
   → POST /api/user-articles/{documentId}/withdraw?locale={locale}
   → volver a modo edición (currentStatus = "draft")

8. Equipo editorial revisa desde el admin panel
   → si aprueba: cambia status a "approved"
   → si requiere cambios: cambia status a "requires-changes" y agrega reviewComments
   → cada acción genera eventos en el historial DEL LOCALE QUE REVISÓ

9. Si requiere ajustes
   → GET /api/user-articles/{documentId}?locale={locale}&populate[events]=true
   → mostrar reviewComments + historial
   → habilitar edición → usuario corrige → vuelve al paso 5

10. [Opcional] Usuario elimina su historia
    → DELETE /api/user-articles/{documentId}?locale={locale}
    → solo elimina la versión en ese locale
    → confirmar con modal antes de llamar
```

---

## 19. Consideraciones importantes

### El locale es obligatorio en todas las llamadas
Pasar `?locale=` en cada request al API de user-articles, main-categories, user-sub-categories. Si no se pasa, Strapi usa el default del sistema y puede no coincidir con el idioma del frontend.

### URLs con documentId (no id numérico)
Todas las URLs usan `{documentId}` (UUID string). El `id` numérico es de la entry específica de un locale y NO se usa en URLs. El `documentId` se obtiene del response de cualquier endpoint que retorne user-articles.

### main_category y sub_categories: documentId o id
Strapi acepta ambos formatos en el payload. **Recomendado: documentId** (más robusto, no depende del locale). Si se usa `id` numérico, asegurarse de que sea del locale correcto.

### Reemplazo total de bloques
Al enviar `blocks` en un PATCH, se reemplaza el array completo. Siempre enviar todos los bloques actuales.

### Auto-save recomendado
Debounce de **2-3 segundos** después del último keystroke.

### Estado `in-review` en el UI
Editor en modo solo lectura. Mostrar panel "Detalles de la revisión" con historial. Botón "Solicitar aprobación" → "Retirar revisión".

### Estado `requires-changes` en el UI
Edición habilitada. Mostrar panel con `reviewComments` y datos del `reviewer`. Botón "Solicitar aprobación" disponible.

### Eliminar historia
Solo cuando `currentStatus` es `draft` o `requires-changes`. El backend rechaza con `403` en otros estados. El delete es irreversible.

### `wordCount` y `readingTime` son automáticos
Calculados en el backend al actualizar `blocks`. **No enviarlos en el payload.**

### `reviewer` usa `firstname` / `lastname` en minúscula
Por venir de `admin::user`. No confundir con `userAuthor` (camelCase, de `users-permissions.user`). El campo `email` NO se expone.

### Cambio de idioma en la UI
Si el usuario cambia de idioma en el frontend mientras está editando una historia, debe abrir la versión del nuevo locale **si existe**. Si no existe, mostrar solo las historias del idioma activo en la lista. El usuario NO crea traducciones — solo crea historias en su idioma actual.

### Filtrado del feed por sección
Usar `?filters[main_category][slug][$eq]=` + `?locale=` en `/api/user-articles`. Si la respuesta no trae registros, no mostrar la sección.

---

## 20. Cambios respecto a versiones anteriores

### BREAKING — Soporte i18n (es-US / en)

Todo el flujo ahora requiere especificar `?locale=` en cada request al API. Ajustar:

| Endpoint | Antes | Ahora |
|---|---|---|
| Crear | `POST /user-articles/create-article` | `POST /user-articles/create-article?locale=es-US` |
| Actualizar | `PATCH /user-articles/:id` | `PATCH /user-articles/{documentId}?locale=es-US` |
| Enviar | `POST /user-articles/:id/submit` | `POST /user-articles/{documentId}/submit?locale=es-US` |
| Retirar | `POST /user-articles/:id/withdraw` | `POST /user-articles/{documentId}/withdraw?locale=es-US` |
| Eliminar | `DELETE /user-articles/:id` | `DELETE /user-articles/{documentId}?locale=es-US` |
| Ver | `GET /user-articles/:id` | `GET /user-articles/{documentId}?locale=es-US` |
| Listar | `GET /user-articles/my-articles` | `GET /user-articles/my-articles?locale=es-US` |
| Main categories | `GET /api/main-categories` | `GET /api/main-categories?locale=es-US` |
| Sub categories | `GET /api/sub-categories` (deprecated) | `GET /api/user-sub-categories?locale=es-US` |

### BREAKING — URLs usan documentId

Antes: `:id` numérico (5, 101, etc.).
Ahora: `:documentId` (UUID string, ej. `lipig6h289w7jphr4rulzpez`).

El `documentId` se obtiene del response de cualquier endpoint. Guardarlo y usarlo en URLs subsecuentes.

### Estado por idioma
`currentStatus`, `reviewer` y `reviewComments` son por locale. La versión en es-US y la versión en en pueden estar en estados distintos. Cada una se aprueba/rechaza independientemente.

### Historial por idioma
El historial de eventos (`user-article-events`) también es por locale. Filtrar siempre por el locale actual.

### Otros cambios recientes (referencia)

| Antes | Ahora |
|---|---|
| `users_main_category` | `main_category` |
| `category` | _(eliminado)_ |
| `sub_categories` apuntaba a `/api/sub-categories` | Apunta a `/api/user-sub-categories` |
| `submittedAt`, `assignedAt`, `reviewUpdatedAt` | _(eliminados — ver historial de eventos)_ |
| `reviewer.firstName / lastName / username` | `reviewer.firstname / lastname` (minúscula, sin email) |
| Estado `rejected` | `requires-changes` |
| Sin `wordCount` | `wordCount` (automático) |

Ver [sección 17 de la versión anterior](https://git/log) o git history para detalles.
