# User Article Creation — Frontend Integration Guide

Guía completa para integrar el flujo de creación de artículos por usuarios lectores desde el frontend. Cubre todo el ciclo: subir imágenes, crear borrador, auto-guardar, enviar a revisión, retirar revisión, ver el historial de eventos y eliminar historia.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Autenticación](#2-autenticación)
3. [Flujo de estados](#3-flujo-de-estados)
4. [Subir imagen](#4-subir-imagen)
5. [Crear artículo](#5-crear-artículo)
6. [Tipos de bloques](#6-tipos-de-bloques)
7. [Auto-guardar (PATCH)](#7-auto-guardar-patch)
8. [Enviar a revisión](#8-enviar-a-revisión)
9. [Retirar revisión](#9-retirar-revisión)
10. [Eliminar historia](#10-eliminar-historia)
11. [Ver / previsualizar un artículo](#11-ver--previsualizar-un-artículo)
12. [Mis artículos](#12-mis-artículos)
13. [Feed público de historias aprobadas](#13-feed-público-de-historias-aprobadas)
14. [Selectores de categorías y países](#14-selectores-de-categorías-y-países)
15. [Detalles de la revisión y historial](#15-detalles-de-la-revisión-y-historial)
16. [Manejo de errores](#16-manejo-de-errores)
17. [Flujo completo paso a paso](#17-flujo-completo-paso-a-paso)
18. [Consideraciones importantes](#18-consideraciones-importantes)
19. [Cambios respecto a versiones anteriores](#19-cambios-respecto-a-versiones-anteriores)

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
- Cuando son aprobados, aparecen en `GET /api/user-articles?filters[currentStatus][$eq]=approved`
- Llevan un **historial de eventos** auditable (colección `user-article-events`) que reemplaza los timestamps individuales

> **Importante para el front**: los artículos de usuarios NO están en `/api/articles`. El feed de historias aprobadas se obtiene desde `/api/user-articles` con filtro de estado.

---

## 2. Autenticación

Todos los endpoints de creación/edición requieren el JWT del usuario autenticado.

```
Authorization: Bearer <jwt>
```

El JWT se obtiene al hacer login. Ver `OAUTH_FRONTEND_GUIDE.md` y `USER_PROFILE_SERVICE.md` para el flujo de autenticación completo.

---

## 3. Flujo de estados

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

---

## 4. Subir imagen

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

---

## 5. Crear artículo

Crea un artículo nuevo en estado `draft`. El slug, el tiempo de lectura y el conteo de palabras se calculan automáticamente en el backend.

### Endpoint

```
POST /api/user-articles/create-article
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | string | ✅ | Título del artículo |
| `cover` | number | ✅ | ID del archivo de portada (obtenido del upload) |
| `description` | string | ❌ | Subtítulo / descripción corta. Máximo 80 caracteres. |
| `main_category` | number | ❌ | ID de la categoría principal (de `/api/main-categories`) |
| `sub_categories` | number[] | ❌ | Array de IDs de subcategorías (de `/api/user-sub-categories`) |
| `countries` | number[] | ❌ | Array de IDs de países (en general lo asigna el editor, no el usuario) |
| `blocks` | array | ❌ | Bloques de contenido. Ver [sección 6](#6-tipos-de-bloques). |
| `creationDate` | string (YYYY-MM-DD) | ❌ | Fecha de creación visible |

> ⚠️ Cambios respecto a versiones anteriores: ver [sección 19](#19-cambios-respecto-a-versiones-anteriores) para el detalle de campos renombrados / eliminados.

### Ejemplo de request

```json
{
  "title": "Mi primera historia",
  "cover": 42,
  "description": "Un subtítulo de máximo 80 caracteres.",
  "main_category": 1,
  "sub_categories": [5, 6],
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
    "title": "Mi primera historia",
    "slug": "mi-primera-historia",
    "description": "Un subtítulo de máximo 80 caracteres.",
    "currentStatus": "draft",
    "readingTime": 3,
    "wordCount": 542,
    "creationDate": "2026-05-25",
    "cover": {
      "id": 42,
      "url": "https://cdn.example.com/mi-portada.jpg"
    },
    "imageCard": {
      "id": 42,
      "url": "https://cdn.example.com/mi-portada.jpg"
    },
    "userAuthor": {
      "id": 7,
      "firstName": "Sebastián",
      "lastName": "Meneses",
      "imageUrl": "https://cdn.example.com/avatar.jpg"
    },
    "reviewer": null,
    "reviewComments": null,
    "main_category": { "id": 1, "name": "El feed que importa", "slug": "el-feed-que-importa", "backgroundColor": "#E3F2FD" },
    "sub_categories": [
      { "id": 5, "name": "Actualidad", "slug": "actualidad", "description": "Lo que pasa hoy en la región" }
    ],
    "countries": [],
    "blocks": [ "..." ]
  }
}
```

**Notas:**
- `slug` → generado automáticamente desde `title`
- `readingTime` → calculado automáticamente (palabras / 200 wpm, mínimo 1)
- `wordCount` → conteo total de palabras del cuerpo (calculado server-side, NO enviar desde el front)
- `imageCard` → copia exacta de `cover`
- `reviewer` / `reviewComments` → null hasta que el equipo editorial los complete
- `countries` → en general queda vacío en draft. Es el editor quien asigna los países de visibilidad durante la revisión.

---

## 6. Tipos de bloques

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

La imagen se sube primero con el [endpoint de upload](#4-subir-imagen) y el `id` resultante va aquí.

### `shared.user-quote` — Cita

```json
{
  "__component": "shared.user-quote",
  "body": "El texto de la cita va aquí.",
  "source": "Nombre del autor o fuente"
}
```

> **Importante**: usar siempre `shared.user-quote`, nunca `shared.quote`. El componente `shared.quote` es para uso editorial interno y tiene una estructura diferente.

---

## 7. Auto-guardar (PATCH)

Actualiza un artículo existente. Todos los campos son opcionales — solo se actualizan los que se envían.

### Endpoint

```
PATCH /api/user-articles/:id
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `draft` o `requires-changes`
- Devuelve `403` si el artículo está `in-review` o `approved`

### Body

Mismos campos que el [create](#5-crear-artículo), todos opcionales.

```json
{
  "title": "Título actualizado",
  "main_category": 2,
  "sub_categories": [7],
  "blocks": [
    { "__component": "shared.rich-text", "body": "Nuevo contenido..." }
  ]
}
```

> **Atención con los bloques**: al enviar `blocks`, se reemplaza el array completo. Siempre enviar el array entero con todos los bloques actuales.

### Respuesta exitosa `200 OK`

Misma estructura que el create, con los datos actualizados.

---

## 8. Enviar a revisión

Cambia el estado de `draft` o `requires-changes` a `in-review`. Corresponde al botón "Solicitar aprobación" de la UI. **Genera automáticamente un evento `submitted` en el historial.**

### Endpoint

```
POST /api/user-articles/:id/submit
Authorization: Bearer <jwt>
```

No requiere body.

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `draft` o `requires-changes`
- El artículo debe tener título y portada; si no, devuelve `400`

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "currentStatus": "in-review",
    "cover": { "..." },
    "main_category": { "..." }
  }
}
```

> No hay campo `submittedAt` en la respuesta. La fecha del envío se obtiene del evento más reciente de tipo `submitted` desde `/api/user-article-events`. Ver [sección 15](#15-detalles-de-la-revisión-y-historial).

---

## 9. Retirar revisión

Saca el artículo del proceso de revisión y lo regresa a `draft`. Corresponde al botón "Retirar revisión" de la UI. **Genera automáticamente un evento `withdrawn` en el historial.**

### Endpoint

```
POST /api/user-articles/:id/withdraw
Authorization: Bearer <jwt>
```

No requiere body.

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `in-review`
- Devuelve `400` si el artículo no está en revisión

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "currentStatus": "draft",
    "cover": { "..." },
    "main_category": { "..." }
  }
}
```

---

## 10. Eliminar historia

Elimina permanentemente el artículo y **todos sus eventos del historial** (cascade delete). Corresponde al botón "Eliminar historia" de la UI.

### Endpoint

```
DELETE /api/user-articles/:id
Authorization: Bearer <jwt>
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `draft` o `requires-changes`
- Devuelve `403` si el artículo está `in-review` o `approved`

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "message": "Historia eliminada correctamente"
  }
}
```

> El delete es irreversible. Mostrar un modal de confirmación en la UI antes de llamar al endpoint.

---

## 11. Ver / previsualizar un artículo

Devuelve el artículo completo con todos sus bloques. Solo accesible por el propietario. Usar para cargar el editor en modo edición o para la previsualización.

### Endpoint

```
GET /api/user-articles/:id
Authorization: Bearer <jwt>
```

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "title": "Mi primera historia",
    "slug": "mi-primera-historia",
    "description": "Un subtítulo de máximo 80 caracteres.",
    "currentStatus": "requires-changes",
    "readingTime": 3,
    "wordCount": 542,
    "creationDate": "2026-05-25",
    "cover": {
      "id": 42,
      "url": "https://cdn.example.com/portada.jpg",
      "mime": "image/jpeg"
    },
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
      "lastname": "García",
      "email": "ana@antpack.co"
    },
    "reviewComments": "El artículo necesita más desarrollo en la sección de conclusiones.",
    "main_category": { "id": 1, "name": "El feed que importa", "slug": "el-feed-que-importa", "backgroundColor": "#E3F2FD" },
    "sub_categories": [
      { "id": 5, "name": "Actualidad", "slug": "actualidad", "description": "..." }
    ],
    "countries": [
      { "id": 2, "name": "Colombia", "slug": "colombia" }
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

> ⚠️ El objeto `reviewer` usa `firstname` y `lastname` en **minúscula** (viene de `admin::user`), mientras que `userAuthor` usa `firstName` y `lastName` en **camelCase** (viene de `users-permissions.user`). Son dos sistemas distintos de usuarios — no confundir.

---

## 12. Mis artículos

Lista paginada de todos los artículos del usuario autenticado.

### Endpoint

```
GET /api/user-articles/my-articles
Authorization: Bearer <jwt>
```

### Query params

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | number | `1` | Página actual |
| `pageSize` | number | `10` | Artículos por página (máximo 50) |
| `currentStatus` | string | — | Filtrar: `draft`, `in-review`, `requires-changes`, `approved` |

### Ejemplos

```
GET /api/user-articles/my-articles
GET /api/user-articles/my-articles?currentStatus=requires-changes
GET /api/user-articles/my-articles?page=2&pageSize=5
```

### Respuesta exitosa `200 OK`

```json
{
  "data": [
    {
      "id": 101,
      "title": "Mi primera historia",
      "slug": "mi-primera-historia",
      "description": "Un subtítulo...",
      "currentStatus": "requires-changes",
      "readingTime": 3,
      "wordCount": 542,
      "creationDate": "2026-05-25",
      "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
      "imageCard": { "..." },
      "main_category": { "id": 1, "name": "El feed que importa", "slug": "el-feed-que-importa" }
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

> La lista no incluye `blocks`, `reviewComments` ni `sub_categories` por performance. Para cargar el contenido completo usar `GET /api/user-articles/:id`.

---

## 13. Feed público de historias aprobadas

Devuelve los artículos de usuarios que ya fueron aprobados. No requiere autenticación. Usar para la sección "Historias de usuarios" del frontend.

### Endpoint base

```
GET /api/user-articles?filters[currentStatus][$eq]=approved
```

### Filtrar por sección (`main_category`)

Cada sección del frontend ("El feed que importa", "El pitch central", etc.) consulta sus propias historias filtrando por el `slug` de la `main_category`:

```
GET /api/user-articles
  ?filters[currentStatus][$eq]=approved
  &filters[main_category][slug][$eq]=el-feed-que-importa
  &populate[cover]=true
  &populate[main_category]=true
  &populate[sub_categories]=true
  &populate[userAuthor][fields][0]=firstName
  &populate[userAuthor][fields][1]=lastName
  &populate[userAuthor][fields][2]=imageUrl
```

**Importante para la UI**: si `data.length === 0`, **no mostrar la sección**. No hay un endpoint específico para "saber si la sección tiene historias" — usar este mismo query y validar el resultado.

### Respuesta exitosa `200 OK`

```json
{
  "data": [
    {
      "id": 101,
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
      "main_category": { "id": 1, "name": "El feed que importa", "slug": "el-feed-que-importa" },
      "sub_categories": [
        { "id": 5, "name": "Actualidad", "slug": "actualidad" }
      ]
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 14. Selectores de categorías y países

Endpoints públicos (no requieren autenticación) para poblar los dropdowns del formulario de creación.

### Categoría principal (`main_category`) — primer dropdown

Corresponde al campo "Categoría" del modal "Publicar historia".

```
GET /api/main-categories
```

```json
{
  "data": [
    {
      "id": 1,
      "name": "El feed que importa",
      "slug": "el-feed-que-importa",
      "backgroundColor": "#E3F2FD"
    },
    {
      "id": 2,
      "name": "El pitch central",
      "slug": "el-pitch-central",
      "backgroundColor": "#FFF3E0"
    }
  ]
}
```

> El `id` de este endpoint se envía como `main_category` al crear/actualizar el artículo.

### Subcategorías (`sub_categories`) — segundo dropdown

Corresponde al campo "SubCategoría" del modal "Publicar historia". Estas subcategorías son **exclusivas para artículos de usuarios** — viven en una colección separada de las subcategorías editoriales.

```
GET /api/user-sub-categories
```

```json
{
  "data": [
    { "id": 5, "name": "Actualidad", "slug": "actualidad", "description": "Lo que pasa hoy en la región" },
    { "id": 6, "name": "Progreso", "slug": "progreso", "description": "Iniciativas que transforman la región" },
    { "id": 7, "name": "En buena manos", "slug": "en-buenas-manos", "description": "Acciones que protegen la región" }
  ]
}
```

> **No usar `/api/sub-categories`** — ese endpoint trae las subcategorías editoriales, que no aplican para el flujo de usuarios.

### Países

```
GET /api/countries
```

```json
{
  "data": [
    { "id": 2, "name": "Colombia", "slug": "colombia", "order": 1, "link": "/co", "isActive": true }
  ]
}
```

> En general los países los asigna el editor durante la revisión, no el usuario al crear. Si el formulario los expone, enviar `countries: [<id>, <id>]`.

---

## 15. Detalles de la revisión y historial

Cuando el artículo está en `in-review`, `requires-changes` o `approved`, el usuario puede ver el panel de seguimiento con el historial completo de eventos.

### Campos del artículo relevantes para el panel

| Campo | Uso en UI |
|---|---|
| `currentStatus` | Badge de estado: "En revisión" / "Requiere ajustes" / "Aprobado" |
| `reviewer.firstname` + `reviewer.lastname` | "Responsable de la revisión" |
| `reviewComments` | "Descripción corta" — comentarios del editor (solo cuando `requires-changes`) |
| `events` (populate) o `/api/user-article-events?filters[user_article][id][$eq]=:id` | Historial cronológico |

### Cómo obtener el historial

**Opción 1 — populate desde el artículo** (recomendado, una sola request):

```
GET /api/user-articles/:id
  ?populate[events][sort]=createdAt:asc
  &populate[events][populate][actorAdmin][fields][0]=firstname
  &populate[events][populate][actorAdmin][fields][1]=lastname
  &populate[events][populate][actorUser][fields][0]=firstName
  &populate[events][populate][actorUser][fields][1]=lastName
  &populate[reviewer]=true
  &populate[cover]=true
  &populate[main_category]=true
```

**Opción 2 — endpoint dedicado** (útil si solo necesitás el historial):

```
GET /api/user-article-events
  ?filters[user_article][id][$eq]=101
  &sort=createdAt:asc
  &populate[actorAdmin][fields][0]=firstname
  &populate[actorAdmin][fields][1]=lastname
  &populate[actorUser][fields][0]=firstName
  &populate[actorUser][fields][1]=lastName
```

### Estructura de un evento

```json
{
  "id": 1,
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

| `type` | Cuándo se genera | Quién es el actor | Campos adicionales |
|---|---|---|---|
| `submitted` | Usuario hace POST `/submit` | `actorUser` (usuario autor) | `fromStatus`, `toStatus` |
| `assigned` | Editor se asigna como reviewer (admin panel) | `actorAdmin` (editor) | — |
| `comments-added` | Editor escribe o edita `reviewComments` (admin panel) | `actorAdmin` (editor) | `comment` (preview hasta 500 chars del texto) |
| `status-changed` | Editor cambia status manualmente (admin panel) — ej. `in-review` → `approved` | `actorAdmin` (editor) | `fromStatus`, `toStatus` |
| `withdrawn` | Usuario hace POST `/withdraw` | `actorUser` (usuario autor) | `fromStatus`, `toStatus` |

> Los eventos `submitted` y `withdrawn` cubren las transiciones del usuario (draft ↔ in-review). El evento `status-changed` cubre el resto de transiciones (las que hace el editor desde el admin panel).

### Mapeo eventos → UI del historial

```js
const labelByEvent = {
  'submitted':       'Enviado a revisión',
  'assigned':        'Asignado a equipo editorial',
  'comments-added':  'Comentarios del editor actualizados',
  'status-changed':  (e) => `Estado cambiado: ${e.fromStatus} → ${e.toStatus}`,
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

### Lógica de display recomendada

```js
const showReviewPanel = ['in-review', 'requires-changes', 'approved'].includes(article.currentStatus);
const showComments    = article.currentStatus === 'requires-changes' && article.reviewComments;
const showHistory     = article.events && article.events.length > 0;
```

### Acciones disponibles según estado

| Estado | Acciones disponibles |
|---|---|
| `draft` | Editar, Enviar a revisión, Eliminar |
| `in-review` | Ver detalles, Retirar revisión |
| `requires-changes` | Editar, Ver comentarios, Enviar a revisión, Eliminar |
| `approved` | Solo lectura |

---

## 16. Manejo de errores

Todos los endpoints siguen el mismo formato de error:

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
| `400 Bad Request` | Datos inválidos o faltantes | Campo requerido ausente, estado incorrecto |
| `401 Unauthorized` | Sin autenticación | JWT faltante o expirado |
| `403 Forbidden` | Sin permiso | Artículo de otro usuario, o estado no editable |
| `404 Not Found` | No encontrado | ID de artículo inexistente |
| `500 Internal Server Error` | Error del servidor | Contactar al equipo de backend |

---

## 17. Flujo completo paso a paso

```
1. Usuario escribe el título
   → POST /user-articles/create-article con { title, cover } mínimo
   → guardar el id devuelto para usar en los siguientes pasos

2. Usuario sube imagen de portada
   → POST /api/image-uploads/user-upload  (multipart, campo "file")
   → PATCH /user-articles/:id con { cover: <id> }

3. Usuario selecciona categorías
   → GET /api/main-categories             (primer dropdown — "Categoría")
   → GET /api/user-sub-categories         (segundo dropdown — "SubCategoría")
   → PATCH /user-articles/:id con { main_category: X, sub_categories: [Y, Z] }

4. Usuario agrega bloques de contenido
   → imágenes dentro de bloques: primero upload, luego id en el bloque
   → PATCH con el array completo de blocks cada X segundos (auto-save)

5. Usuario hace click en "Solicitar aprobación"
   → POST /api/user-articles/:id/submit
   → poner UI en modo solo lectura (currentStatus = "in-review")
   → mostrar panel "Detalles de la revisión" con historial

6. [Opcional] Usuario hace click en "Retirar revisión"
   → POST /api/user-articles/:id/withdraw
   → volver a modo edición (currentStatus = "draft")

7. Equipo editorial revisa en el panel de Strapi
   → si aprueba: cambia status a "approved"
   → si requiere cambios: cambia status a "requires-changes" y agrega reviewComments
   → cada acción genera eventos automáticos en el historial

8. Si requiere ajustes
   → GET /api/user-articles/:id?populate[events]=true → mostrar reviewComments + historial
   → habilitar edición nuevamente
   → usuario corrige y vuelve al paso 4

9. [Opcional] Usuario elimina la historia
   → DELETE /api/user-articles/:id  (solo si draft o requires-changes)
   → confirmar con modal antes de llamar al endpoint
   → el delete también elimina todos los eventos del historial (cascade)
```

---

## 18. Consideraciones importantes

### Reemplazo total de bloques
Cuando se envía `blocks` en un PATCH, **se reemplaza el array completo**. Nunca enviar solo el bloque modificado — siempre enviar todos los bloques actuales del artículo.

### Auto-save recomendado
Implementar debounce de **2-3 segundos** después del último keystroke. Si el usuario está inactivo más de 30 segundos, hacer un save final.

### Estado `in-review` en el UI
Cuando `currentStatus === 'in-review'`, poner el editor en modo solo lectura. Mostrar el panel "Detalles de la revisión" con el historial completo. El botón "Solicitar aprobación" no debe mostrarse — reemplazarlo por "Retirar revisión".

### Estado `requires-changes` en el UI
Habilitar edición nuevamente. Mostrar el panel "Comentarios de la revisión" con `reviewComments` y los datos del `reviewer`. El botón "Solicitar aprobación" vuelve a estar disponible.

### Eliminar historia — cuándo mostrar el botón
Mostrar el botón "Eliminar historia" solo cuando `currentStatus` es `draft` o `requires-changes`. El backend rechaza la eliminación en otros estados con `403`. **El delete es irreversible y borra también el historial completo del artículo.**

### Artículo nuevo vs existente
Al abrir el editor en blanco, crear el artículo recién cuando el usuario escribe el primer carácter del título o sube la portada. Antes de eso no hay artículo en el servidor.

### Límite de `description`
El campo `description` tiene un límite de **80 caracteres**. Mostrar un contador en el UI.

### Errores de upload de imagen
Si el upload falla, no bloquear el flujo de escritura. Mostrar el error inline y permitir reintentar.

### `wordCount` y `readingTime` son automáticos
Estos dos campos se calculan en el backend cada vez que se actualizan los `blocks`. **No enviarlos en el payload** — cualquier valor enviado será sobrescrito.

### `reviewer` usa `firstname` / `lastname` en minúscula
Por venir de `admin::user` (no de `users-permissions.user`), los campos son `firstname`, `lastname` y `email` — todo en minúscula. No confundir con `userAuthor` que sí usa camelCase.

### Filtrado del feed por sección
Para mostrar/ocultar una sección del frontend ("El feed que importa", "El pitch central", etc.) usar el endpoint público de `/api/user-articles` filtrando por `main_category.slug`. Si la respuesta no trae registros, la sección no se muestra. No hay endpoint dedicado para esto.

---

## 19. Cambios respecto a versiones anteriores

Si el frontend ya estaba integrado con una versión anterior de este backend, estos son los cambios que requieren ajuste:

### Campos del payload renombrados o eliminados

| Antes | Ahora | Acción |
|---|---|---|
| `users_main_category` | `main_category` | Renombrar en payloads de `POST create-article` y `PATCH` |
| `category` | _(eliminado)_ | Quitar del payload — ya no existe en el schema |
| `sub_categories` apuntaba a `/api/sub-categories` | ahora apunta a `/api/user-sub-categories` | Cambiar el endpoint del dropdown de subcategorías |

### Timestamps eliminados de la respuesta

Los siguientes campos **ya no existen** en `user-article`:

- `submittedAt`
- `assignedAt`
- `reviewUpdatedAt`

**Migración**: el historial de eventos los reemplaza. Reemplazar cualquier lectura de estos campos con el populate de `events` y el mapeo del [historial](#15-detalles-de-la-revisión-y-historial).

### `reviewer` cambió de tipo de usuario

Antes el `reviewer` venía de `users-permissions.user` y tenía campos `firstName`, `lastName`, `username`. Ahora viene de `admin::user` y tiene `firstname`, `lastname`, `email` (todo en minúscula).

### Subcategorías ahora son una colección propia

Las subcategorías para artículos de usuarios viven en `/api/user-sub-categories`, separadas de las editoriales (`/api/sub-categories`). El frontend debe consumir el endpoint nuevo. Estas subcategorías no están atadas a una `category` — son una lista plana específica para el flujo de usuarios.

### Estado renombrado: `requires-changes`
El estado que antes se llamaba `rejected` ahora se llama `requires-changes`. Actualizar cualquier comparación `currentStatus === 'rejected'` → `currentStatus === 'requires-changes'`.

### Nuevo campo `wordCount`
Conteo de palabras del cuerpo del artículo. Calculado server-side. Disponible en todas las respuestas, no se envía en el payload.

### Nuevo endpoint `/api/user-article-events`
Colección de eventos del historial. Cada acción del flujo de revisión genera un evento. Ver [sección 15](#15-detalles-de-la-revisión-y-historial) para el detalle.
