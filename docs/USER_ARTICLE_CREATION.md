# User Article Creation — Frontend Integration Guide

Guía completa para integrar el flujo de creación de artículos por usuarios lectores desde el frontend. Cubre todo el ciclo: subir imágenes, crear borrador, auto-guardar, enviar a revisión y consultar el estado.

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
9. [Ver / previsualizar un artículo](#9-ver--previsualizar-un-artículo)
10. [Mis artículos](#10-mis-artículos)
11. [Selectores de categorías y países](#11-selectores-de-categorías-y-países)
12. [Manejo de errores](#12-manejo-de-errores)
13. [Flujo completo paso a paso](#13-flujo-completo-paso-a-paso)
14. [Consideraciones importantes](#14-consideraciones-importantes)

---

## 1. Visión general

Los usuarios autenticados (lectores) pueden crear sus propias historias desde una interfaz externa sin acceder al panel de administración de Strapi. El flujo es:

```
Usuario escribe → guarda borrador → envía a revisión → equipo editorial aprueba → se publica
```

Los artículos creados por usuarios:
- Empiezan siempre en estado `draft`
- No se publican automáticamente — requieren aprobación del equipo editorial
- Usan el mismo árbol de categorías que los artículos editoriales
- Aparecen en el listado público de artículos solo cuando están publicados y aprobados
- Identifican al autor con los datos del perfil del usuario (`firstName`, `lastName`, `imageUrl`)

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
draft ──► in-review ──► approved  (se publica en Strapi)
  ▲            │
  └────────────┘
           rejected
```

| Estado | Quién lo asigna | El usuario puede editar |
|---|---|---|
| `draft` | Backend al crear | ✅ Sí |
| `in-review` | Usuario al solicitar revisión | ❌ No |
| `rejected` | Equipo editorial (admin panel) | ✅ Sí |
| `approved` | Equipo editorial (admin panel) | ❌ No |

**Regla clave**: `PATCH` y `POST .../submit` solo funcionan cuando el artículo está en `draft` o `rejected`. Cualquier intento sobre un artículo `in-review` o `approved` devuelve `403 Forbidden`.

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

### Uso

El `id` de la respuesta (`42` en el ejemplo) es el valor que se envía como `cover` al crear o actualizar el artículo, y como `file` dentro de bloques de tipo imagen.

---

## 5. Crear artículo

Crea un artículo nuevo en estado `draft` y registra la propiedad del usuario. El slug y el tiempo de lectura se calculan automáticamente en el backend.

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
| `main_category` | number | ❌ | ID de la categoría principal |
| `category` | number | ❌ | ID de la categoría |
| `sub_categories` | number[] | ❌ | Array de IDs de subcategorías |
| `countries` | number[] | ❌ | Array de IDs de países |
| `blocks` | array | ❌ | Bloques de contenido. Ver [sección 6](#6-tipos-de-bloques). |
| `creationDate` | string (YYYY-MM-DD) | ❌ | Fecha de creación visible |

### Ejemplo de request

```json
{
  "title": "Mi primera historia",
  "cover": 42,
  "description": "Un subtítulo de máximo 80 caracteres.",
  "main_category": 1,
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
    "publishedAt": null,
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
    "main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
    "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" },
    "sub_categories": [
      { "id": 5, "name": "Frontend", "slug": "frontend" }
    ],
    "blocks": [ ... ]
  }
}
```

**Notas:**
- `slug` → generado automáticamente desde `title`, no se envía
- `readingTime` → calculado automáticamente desde el contenido de los bloques (palabras / 200 wpm, mínimo 1)
- `imageCard` → copia exacta de `cover`, no se envía por separado
- `publishedAt: null` → el artículo es un borrador, no visible públicamente

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

| Campo | Tipo | Requerido |
|---|---|---|
| `body` | string (richtext) | ❌ |

---

### `shared.subtitle` — Subtítulo

```json
{
  "__component": "shared.subtitle",
  "text": "Título de sección dentro del artículo"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `text` | string | ✅ |

---

### `shared.media` — Imagen

```json
{
  "__component": "shared.media",
  "file": 43
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `file` | number | ❌ | ID del archivo previamente subido |

La imagen se sube primero con el [endpoint de upload](#4-subir-imagen) y el `id` resultante va aquí.

---

### `shared.user-quote` — Cita

```json
{
  "__component": "shared.user-quote",
  "body": "El texto de la cita va aquí.",
  "source": "Nombre del autor o fuente"
}
```

| Campo | Tipo | Requerido |
|---|---|---|
| `body` | string | ✅ |
| `source` | string | ❌ |

> **Importante**: Para artículos de usuarios usar siempre `shared.user-quote`, no `shared.quote`. El componente `shared.quote` es para uso editorial interno y tiene una estructura diferente.

---

## 7. Auto-guardar (PATCH)

Actualiza un artículo existente. Todos los campos son opcionales — solo se actualizan los que se envían. Diseñado para auto-guardar mientras el usuario escribe.

### Endpoint

```
PATCH /api/user-articles/:id
Authorization: Bearer <jwt>
Content-Type: application/json
```

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `draft` o `rejected`
- Devuelve `403` si el artículo está `in-review` o `approved`

### Body

Mismos campos que el [create](#5-crear-artículo), todos opcionales.

```json
{
  "title": "Título actualizado",
  "blocks": [
    { "__component": "shared.rich-text", "body": "Nuevo contenido..." }
  ]
}
```

> **Atención con los bloques**: al enviar `blocks`, se reemplaza el array completo. Siempre enviar el array entero con todos los bloques actuales, no solo el bloque modificado.

### Respuesta exitosa `200 OK`

Misma estructura que el create, con los datos actualizados.

---

## 8. Enviar a revisión

Cambia el estado del artículo de `draft` o `rejected` a `in-review`. Corresponde al botón "Solicitar aprobación" de la UI.

### Endpoint

```
POST /api/user-articles/:id/submit
Authorization: Bearer <jwt>
```

No requiere body.

### Restricciones

- Solo funciona si el artículo pertenece al usuario autenticado
- Solo funciona si `currentStatus` es `draft` o `rejected`
- El artículo debe tener título y portada; si no, devuelve `400`

### Respuesta exitosa `200 OK`

```json
{
  "data": {
    "id": 101,
    "currentStatus": "in-review",
    "cover": { ... },
    "category": { ... }
  }
}
```

---

## 9. Ver / previsualizar un artículo

Devuelve un artículo completo con todos sus bloques. Solo accesible por el propietario. Usar para cargar el editor en modo edición o para la previsualización.

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
    "currentStatus": "draft",
    "readingTime": 3,
    "publishedAt": null,
    "creationDate": "2026-05-25",
    "cover": {
      "id": 42,
      "url": "https://cdn.example.com/portada.jpg",
      "mime": "image/jpeg"
    },
    "imageCard": { ... },
    "userAuthor": {
      "id": 7,
      "firstName": "Sebastián",
      "lastName": "Meneses",
      "imageUrl": "https://cdn.example.com/avatar.jpg"
    },
    "main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
    "category": { "id": 3, "name": "Desarrollo", "slug": "desarrollo" },
    "sub_categories": [
      { "id": 5, "name": "Frontend", "slug": "frontend" }
    ],
    "blocks": [
      {
        "id": 1,
        "__component": "shared.rich-text",
        "body": "Contenido del primer párrafo."
      },
      {
        "id": 2,
        "__component": "shared.subtitle",
        "text": "Un subtítulo"
      },
      {
        "id": 3,
        "__component": "shared.media",
        "file": { "id": 43, "url": "https://cdn.example.com/imagen.jpg" }
      },
      {
        "id": 4,
        "__component": "shared.user-quote",
        "body": "La cita.",
        "source": "Autor"
      }
    ]
  }
}
```

---

## 10. Mis artículos

Lista paginada de todos los artículos del usuario autenticado. Para la pantalla "Mis historias".

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
| `currentStatus` | string | — | Filtrar por estado: `draft`, `in-review`, `rejected`, `approved` |

### Ejemplos

```
GET /api/user-articles/my-articles
GET /api/user-articles/my-articles?page=2&pageSize=5
GET /api/user-articles/my-articles?currentStatus=in-review
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
      "currentStatus": "draft",
      "readingTime": 3,
      "publishedAt": null,
      "creationDate": "2026-05-25",
      "cover": {
        "id": 42,
        "url": "https://cdn.example.com/portada.jpg"
      },
      "imageCard": { ... },
      "main_category": { "id": 1, "name": "Tecnología", "slug": "tecnologia" },
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

> La lista no incluye `blocks` por performance. Para cargar el contenido completo (editar o previsualizar) usar `GET /api/user-articles/:id`.

---

## 11. Selectores de categorías y países

Endpoints públicos (no requieren autenticación) para poblar los dropdowns del formulario de creación.

### Main categories

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
      "backgroundColor": "#E3F2FD",
      "order": "first"
    }
  ]
}
```

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

## 12. Manejo de errores

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
| `400 Bad Request` | Datos inválidos o faltantes | Campo requerido ausente, formato incorrecto |
| `401 Unauthorized` | Sin autenticación | JWT faltante o expirado |
| `403 Forbidden` | Sin permiso | Artículo de otro usuario, o estado no editable |
| `404 Not Found` | No encontrado | ID de artículo inexistente |
| `500 Internal Server Error` | Error del servidor | Contactar al equipo de backend |

### Casos especiales de `403`

- Intentar editar (`PATCH`) un artículo en `in-review` o `approved`
- Intentar hacer submit de un artículo que ya está `in-review`
- Intentar acceder a un artículo que pertenece a otro usuario

---

## 13. Flujo completo paso a paso

### Crear una historia nueva

```
1. Usuario escribe el título
   → frontend hace PATCH en background si ya existe el artículo
   → o POST /user-articles/create-article con { title, cover } mínimo

2. Usuario sube imagen de portada
   → POST /api/image-uploads/user-upload  (multipart, campo "file")
   → guarda el id devuelto
   → hace PATCH /user-articles/:id con { cover: <id> }

3. Usuario agrega bloques de contenido
   → imágenes dentro de bloques: primero upload, luego id en el bloque
   → frontend envía PATCH con el array completo de blocks cada X segundos

4. Usuario quiere previsualizar
   → GET /api/user-articles/:id  (renderizar localmente sin llamada extra)

5. Usuario hace click en "Solicitar aprobación"
   → POST /api/user-articles/:id/submit
   → deshabilitar edición en el frontend (currentStatus = "in-review")

6. Equipo editorial revisa en el panel de Strapi
   → si aprueba: cambia status a "approved" y publica → el artículo aparece en /articles
   → si rechaza: cambia status a "rejected"

7. Si fue rechazado
   → GET /api/user-articles/:id  → mostrar currentStatus: "rejected"
   → habilitar edición nuevamente (draft y rejected son editables)
   → usuario corrige y vuelve al paso 3
```

---

## 14. Consideraciones importantes

### Límite de `description`
El campo `description` (subtítulo del artículo) tiene un límite de **80 caracteres** definido en el schema. Si se excede, Strapi devuelve un error de validación. Mostrar un contador de caracteres en el UI.

### Reemplazo total de bloques
Cuando se envía `blocks` en un PATCH, **se reemplaza el array completo**. Nunca enviar solo el bloque modificado — siempre enviar todos los bloques actuales del artículo.

### Auto-save recomendado
Implementar debounce de **2-3 segundos** después del último keystroke para evitar llamadas excesivas. Si el usuario está inactivo más de 30 segundos, hacer un save final.

### Artículo nuevo vs existente
Al abrir el editor en blanco, crear el artículo recién cuando el usuario escribe el primer carácter del título (o cuando sube la portada). Antes de eso, no hay artículo en el servidor.

### Errores de upload de imagen
Si el upload falla, no bloquear el flujo de escritura. Mostrar el error inline junto al bloque de imagen y permitir reintentar.

### Estado `in-review` en el UI
Cuando `currentStatus === 'in-review'`, poner el editor en modo solo lectura. Mostrar un mensaje claro de que el artículo está siendo revisado. El botón "Solicitar aprobación" no debe mostrarse.

### Artículos publicados en el listing general
Cuando un artículo es aprobado y publicado, aparece en `GET /api/articles` y `GET /api/articles-enhanced` con los datos normales del artículo. Para mostrar el autor, usar el campo `userAuthor` (cuando `author` sea null, el artículo es de un usuario lector):

```json
{
  "author": null,
  "userAuthor": {
    "id": 7,
    "firstName": "Sebastián",
    "lastName": "Meneses",
    "imageUrl": "https://cdn.example.com/avatar.jpg"
  }
}
```

> **Nota para el front**: `article-enhanced` ya devuelve `userAuthor` en el populate. Si usás el endpoint estándar `/articles`, agregar `populate=userAuthor` en la query.
