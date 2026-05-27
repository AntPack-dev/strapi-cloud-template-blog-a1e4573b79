# User Article Creation — Frontend Integration Guide

Guía completa para integrar el flujo de creación de artículos por usuarios lectores desde el frontend. Cubre todo el ciclo: subir imágenes, crear borrador, auto-guardar, enviar a revisión, retirar revisión, ver comentarios del editor y eliminar historia.

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
15. [Detalles de la revisión](#15-detalles-de-la-revisión)
16. [Manejo de errores](#16-manejo-de-errores)
17. [Flujo completo paso a paso](#17-flujo-completo-paso-a-paso)
18. [Consideraciones importantes](#18-consideraciones-importantes)

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

> **Cambio respecto a la versión anterior**: el estado `rejected` fue renombrado a `requires-changes`. Actualizar cualquier comparación de `currentStatus === 'rejected'` → `currentStatus === 'requires-changes'`.

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

Crea un artículo nuevo en estado `draft`. El slug y el tiempo de lectura se calculan automáticamente en el backend.

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
| `users_main_category` | number | ❌ | ID de la categoría principal de usuarios |
| `category` | number | ❌ | ID de la categoría |
| `sub_categories` | number[] | ❌ | Array de IDs de subcategorías |
| `countries` | number[] | ❌ | Array de IDs de países |
| `blocks` | array | ❌ | Bloques de contenido. Ver [sección 6](#6-tipos-de-bloques). |
| `creationDate` | string (YYYY-MM-DD) | ❌ | Fecha de creación visible |

> **Cambio respecto a la versión anterior**: el campo se llama `users_main_category`, no `main_category`. Actualizar el payload del formulario.

### Ejemplo de request

```json
{
  "title": "Mi primera historia",
  "cover": 42,
  "description": "Un subtítulo de máximo 80 caracteres.",
  "users_main_category": 1,
  "category": 3,
  "sub_categories": [5, 6],
  "countries": [2],
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
    "creationDate": "2026-05-25",
    "submittedAt": null,
    "assignedAt": null,
    "reviewUpdatedAt": null,
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
    "users_main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia", "backgroundColor": "#E3F2FD" },
    "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" },
    "sub_categories": [
      { "id": 5, "name": "Frontend", "slug": "frontend" }
    ],
    "blocks": [ "..." ]
  }
}
```

**Notas:**
- `slug` → generado automáticamente desde `title`
- `readingTime` → calculado automáticamente (palabras / 200 wpm, mínimo 1)
- `imageCard` → copia exacta de `cover`
- `reviewer` / `reviewComments` → null hasta que el equipo editorial los complete

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
  "users_main_category": 2,
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

Cambia el estado de `draft` o `requires-changes` a `in-review`. Corresponde al botón "Solicitar aprobación" de la UI. Auto-registra `submittedAt`.

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
    "submittedAt": "2026-05-27T14:00:00.000Z",
    "cover": { "..." },
    "category": { "..." }
  }
}
```

---

## 9. Retirar revisión

Saca el artículo del proceso de revisión y lo regresa a `draft`. Corresponde al botón "Retirar revisión" de la UI.

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
    "category": { "..." }
  }
}
```

---

## 10. Eliminar historia

Elimina permanentemente el artículo. Corresponde al botón "Eliminar historia" de la UI.

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
    "creationDate": "2026-05-25",
    "submittedAt": "2026-05-27T12:00:00.000Z",
    "assignedAt": "2026-05-27T13:00:00.000Z",
    "reviewUpdatedAt": "2026-05-27T13:30:00.000Z",
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
      "firstName": "Ana",
      "lastName": "García",
      "username": "ana.garcia"
    },
    "reviewComments": "El artículo necesita más desarrollo en la sección de conclusiones.",
    "users_main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia", "backgroundColor": "#E3F2FD" },
    "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" },
    "sub_categories": [
      { "id": 5, "name": "Frontend", "slug": "frontend" }
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
      "creationDate": "2026-05-25",
      "submittedAt": "2026-05-27T12:00:00.000Z",
      "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
      "imageCard": { "..." },
      "users_main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
      "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" }
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

> La lista no incluye `blocks` ni `reviewComments` por performance. Para cargar el contenido completo usar `GET /api/user-articles/:id`.

---

## 13. Feed público de historias aprobadas

Devuelve los artículos de usuarios que ya fueron aprobados. No requiere autenticación. Usar para la sección "Historias de usuarios" del frontend.

### Endpoint

```
GET /api/user-articles?filters[currentStatus][$eq]=approved
```

### Populate recomendado

```
GET /api/user-articles?filters[currentStatus][$eq]=approved&populate[cover]=true&populate[userAuthor][fields][0]=firstName&populate[userAuthor][fields][1]=lastName&populate[userAuthor][fields][2]=imageUrl&populate[category][fields][0]=name&populate[category][fields][1]=slug
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
      "currentStatus": "approved",
      "readingTime": 3,
      "creationDate": "2026-05-25",
      "cover": { "id": 42, "url": "https://cdn.example.com/portada.jpg" },
      "userAuthor": {
        "id": 7,
        "firstName": "Sebastián",
        "lastName": "Meneses",
        "imageUrl": "https://cdn.example.com/avatar.jpg"
      },
      "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" }
    }
  ],
  "meta": { "pagination": { "..." } }
}
```

---

## 14. Selectores de categorías y países

Endpoints públicos (no requieren autenticación) para poblar los dropdowns del formulario de creación.

### Main categories (categorías de usuarios)

```
GET /api/main-categories
```

```json
{
  "data": [
    {
      "id": 1,
      "name": "Tecnología",
      "slug": "tecnologia",
      "backgroundColor": "#E3F2FD"
    }
  ]
}
```

> El `id` de este endpoint se envía como `users_main_category` al crear/actualizar el artículo.

### Categorías (filtradas por main_category)

```
GET /api/categories?filters[main_category][id][$eq]=1
```

```json
{
  "data": [
    { "id": 3, "name": "Desarrollo", "slug": "desarrollo" }
  ]
}
```

### Subcategorías (filtradas por category)

```
GET /api/sub-categories?filters[category][id][$eq]=3
```

```json
{
  "data": [
    { "id": 5, "name": "Frontend", "slug": "frontend" },
    { "id": 6, "name": "Backend", "slug": "backend" }
  ]
}
```

### Países

```
GET /api/countries
```

```json
{
  "data": [
    { "id": 2, "name": "Colombia", "code": "CO" }
  ]
}
```

---

## 15. Detalles de la revisión

Cuando el artículo está en `in-review` o `requires-changes`, el usuario puede ver el panel de seguimiento. Todos los datos necesarios vienen del `GET /api/user-articles/:id`.

### Campos relevantes para el panel

| Campo | Uso en UI |
|---|---|
| `currentStatus` | Badge de estado: "En revisión" / "Requiere ajustes" |
| `reviewer.firstName` + `reviewer.lastName` | "Responsable de la revisión" |
| `reviewComments` | "Descripción corta" — comentarios del editor (solo cuando `requires-changes`) |
| `submittedAt` | Historial: "Enviado a revisión" |
| `assignedAt` | Historial: "Asignado a equipo editorial" |
| `reviewUpdatedAt` | Historial: "Revisión en curso — Actualización hace X" |

### Lógica de display recomendada

```js
// Mostrar panel de revisión cuando:
const showReviewPanel = ['in-review', 'requires-changes'].includes(article.currentStatus);

// Mostrar comentarios del editor solo cuando requiere ajustes:
const showComments = article.currentStatus === 'requires-changes' && article.reviewComments;

// Historial: solo mostrar entradas con timestamp (los null se omiten)
const historyEvents = [
  { label: 'Enviado a revisión',        timestamp: article.submittedAt },
  { label: 'Asignado a equipo editorial', timestamp: article.assignedAt },
  { label: 'Revisión en curso',          timestamp: article.reviewUpdatedAt },
].filter(e => e.timestamp);
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
   → GET /api/main-categories  (para el primer dropdown)
   → GET /api/categories?filters[main_category][id][$eq]=<id>  (para el segundo)
   → PATCH /user-articles/:id con { users_main_category: X, category: Y }

4. Usuario agrega bloques de contenido
   → imágenes dentro de bloques: primero upload, luego id en el bloque
   → PATCH con el array completo de blocks cada X segundos (auto-save)

5. Usuario hace click en "Solicitar aprobación"
   → POST /api/user-articles/:id/submit
   → poner UI en modo solo lectura (currentStatus = "in-review")
   → mostrar panel "Detalles de la revisión"

6. [Opcional] Usuario hace click en "Retirar revisión"
   → POST /api/user-articles/:id/withdraw
   → volver a modo edición (currentStatus = "draft")

7. Equipo editorial revisa en el panel de Strapi
   → si aprueba: cambia status a "approved"
   → si requiere cambios: cambia status a "requires-changes" y agrega reviewComments

8. Si requiere ajustes
   → GET /api/user-articles/:id → mostrar reviewComments en la UI
   → habilitar edición nuevamente
   → usuario corrige y vuelve al paso 4

9. [Opcional] Usuario elimina la historia
   → DELETE /api/user-articles/:id  (solo si draft o requires-changes)
   → confirmar con modal antes de llamar al endpoint
```

---

## 18. Consideraciones importantes

### Campo renombrado: `users_main_category`
El campo que antes se llamaba `main_category` en el payload ahora se llama `users_main_category`. Actualizar en todos los `POST create-article` y `PATCH update` donde se envíe este campo.

### Estado renombrado: `requires-changes`
El estado que antes se llamaba `rejected` ahora se llama `requires-changes`. Actualizar cualquier comparación `currentStatus === 'rejected'` → `currentStatus === 'requires-changes'`.

### Reemplazo total de bloques
Cuando se envía `blocks` en un PATCH, **se reemplaza el array completo**. Nunca enviar solo el bloque modificado — siempre enviar todos los bloques actuales del artículo.

### Auto-save recomendado
Implementar debounce de **2-3 segundos** después del último keystroke. Si el usuario está inactivo más de 30 segundos, hacer un save final.

### Estado `in-review` en el UI
Cuando `currentStatus === 'in-review'`, poner el editor en modo solo lectura. Mostrar el panel "Detalles de la revisión". El botón "Solicitar aprobación" no debe mostrarse — reemplazarlo por "Retirar revisión".

### Estado `requires-changes` en el UI
Habilitar edición nuevamente. Mostrar el panel "Comentarios de la revisión" con `reviewComments` y los datos del `reviewer`. El botón "Solicitar aprobación" vuelve a estar disponible.

### Eliminar historia — cuándo mostrar el botón
Mostrar el botón "Eliminar historia" solo cuando `currentStatus` es `draft` o `requires-changes`. El backend rechaza la eliminación en otros estados con `403`.

### Artículo nuevo vs existente
Al abrir el editor en blanco, crear el artículo recién cuando el usuario escribe el primer carácter del título o sube la portada. Antes de eso no hay artículo en el servidor.

### Límite de `description`
El campo `description` tiene un límite de **80 caracteres**. Mostrar un contador en el UI.

### Errores de upload de imagen
Si el upload falla, no bloquear el flujo de escritura. Mostrar el error inline y permitir reintentar.
