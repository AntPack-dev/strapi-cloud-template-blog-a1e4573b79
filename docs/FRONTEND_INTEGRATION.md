# Integración Frontend - Sistema de Usuarios, Comentarios y Likes

## 🔧 Configuración Inicial

```javascript
// config.js
const API_URL = 'http://localhost:1337'; // Cambia esto a tu URL de producción

export default API_URL;
```

---

## 👤 1. Registro de Usuario

```javascript
// auth/register.js
import API_URL from './config';

async function registerUser(firstName, lastName, email, password) {
  try {
    // Generar username automáticamente a partir del email
    const username = email.split('@')[0];
    
    const response = await fetch(`${API_URL}/api/auth/local/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: firstName,
        lastName: lastName,
        username: username,
        email: email,
        password: password,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Guardar el JWT en localStorage
      localStorage.setItem('jwt', data.jwt);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('Usuario registrado:', data.user);
      return { success: true, user: data.user, jwt: data.jwt };
    } else {
      console.error('Error en registro:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
registerUser('John', 'Doe', 'john@example.com', 'Password123!')
  .then(result => {
    if (result.success) {
      console.log('Registro exitoso');
      // Redirigir al usuario o actualizar UI
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## 🔐 2. Login de Usuario

```javascript
// auth/login.js
import API_URL from './config';

async function loginUser(identifier, password) {
  try {
    const response = await fetch(`${API_URL}/api/auth/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier, // Puede ser email o username
        password: password,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Guardar el JWT en localStorage
      localStorage.setItem('jwt', data.jwt);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      console.log('Usuario logueado:', data.user);
      return { success: true, user: data.user, jwt: data.jwt };
    } else {
      console.error('Error en login:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
loginUser('john@example.com', 'Password123!')
  .then(result => {
    if (result.success) {
      console.log('Login exitoso');
      // Redirigir al usuario o actualizar UI
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## 🚪 3. Logout de Usuario

```javascript
// auth/logout.js
function logoutUser() {
  localStorage.removeItem('jwt');
  localStorage.removeItem('user');
  console.log('Usuario deslogueado');
  // Redirigir a la página de login o home
}

// Ejemplo de uso
logoutUser();
```

---

## 📝 4. Crear un Comentario

```javascript
// comments/createComment.js
import API_URL from './config';

async function createComment(articleId, content) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        data: {
          content: content,
          article_id: articleId,
          // El author se asigna automáticamente por el controller
        },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Comentario creado:', data.data);
      return { success: true, comment: data.data };
    } else {
      console.error('Error al crear comentario:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
createComment(1, 'Este es un comentario de prueba')
  .then(result => {
    if (result.success) {
      console.log('Comentario publicado');
      // Actualizar la lista de comentarios en la UI
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## 📖 5. Obtener Comentarios de un Artículo

```javascript
// comments/getComments.js
import API_URL from './config';

async function getComments(articleId) {
  try {
    const response = await fetch(
      `${API_URL}/api/comments?filters[article][id][$eq]=${articleId}&populate=author,article`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('Comentarios obtenidos:', data.data);
      return { success: true, comments: data.data };
    } else {
      console.error('Error al obtener comentarios:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getComments(6)
  .then(result => {
    if (result.success) {
      result.comments.forEach(comment => {
        console.log(`${comment.author.username}: ${comment.content}`);
      });
    }
  });
```

---

## ✏️ 6. Actualizar un Comentario

```javascript
// comments/updateComment.js
import API_URL from './config';

async function updateComment(commentId, newContent) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        data: {
          content: newContent,
        },
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Comentario actualizado:', data.data);
      return { success: true, comment: data.data };
    } else {
      console.error('Error al actualizar comentario:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
updateComment(2, 'Contenido actualizado del comentario')
  .then(result => {
    if (result.success) {
      console.log('Comentario actualizado exitosamente');
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## 🗑️ 7. Eliminar un Comentario

```javascript
// comments/deleteComment.js
import API_URL from './config';

async function deleteComment(commentId) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Comentario eliminado:', data.message);
      return { success: true, message: data.message };
    } else {
      console.error('Error al eliminar comentario:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
deleteComment(2)
  .then(result => {
    if (result.success) {
      console.log('Comentario eliminado exitosamente');
      // Actualizar la lista de comentarios en la UI
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## ❤️ 8. Toggle Like (Único Endpoint)

```javascript
// likes/toggleLike.js
import API_URL from './config';

async function toggleLike(articleId) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/likes/${articleId}/toggle-like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log(data.message, '- Liked:', data.liked);
      return { success: true, liked: data.liked, message: data.message };
    } else {
      console.error('Error al dar/quitar like:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
toggleLike(6)
  .then(result => {
    if (result.success) {
      if (result.liked) {
        console.log('Like agregado ❤️');
        // Actualizar UI: cambiar icono a corazón rojo
      } else {
        console.log('Like removido 🤍');
        // Actualizar UI: cambiar icono a corazón vacío
      }
    } else {
      console.log('Error:', result.error);
    }
  });
```

---

## � 9. Obtener Cantidad de Likes

```javascript
// likes/getLikesCount.js
import API_URL from './config';

async function getLikesCount(articleId) {
  try {
    const response = await fetch(
      `${API_URL}/api/likes?articleId=${articleId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const count = data.meta.total;
      console.log(`Artículo ${articleId} tiene ${count} likes`);
      return { success: true, count: count };
    } else {
      console.error('Error al obtener likes:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getLikesCount(6)
  .then(result => {
    if (result.success) {
      console.log(`Total de likes: ${result.count}`);
    }
  });
```

---

## ✅ 10. Verificar si el Usuario Dio Like

```javascript
// likes/checkUserLike.js
import API_URL from './config';

async function checkUserLike(articleId) {
  const jwt = localStorage.getItem('jwt');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!jwt || !user) {
    return { success: false, liked: false };
  }

  try {
    const response = await fetch(
      `${API_URL}/api/likes?articleId=${articleId}`,
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const userLike = data.data.find(like => like.user?.id === user.id);
      return { success: true, liked: !!userLike };
    } else {
      return { success: false, liked: false };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, liked: false };
  }
}

// Ejemplo de uso
checkUserLike(6)
  .then(result => {
    if (result.success && result.liked) {
      console.log('El usuario ya dio like a este artículo ❤️');
      // Mostrar corazón rojo en la UI
    } else {
      console.log('El usuario no ha dado like 🤍');
      // Mostrar corazón vacío en la UI
    }
  });
```

---

## 📊 11. Obtener Artículos con Conteo de Likes (Método 1 - API Estándar)

### **Postman - Paso 1: Verificar Artículos Disponibles**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Esperada:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "slug": "beautiful-picture"
    },
    {
      "id": 7,
      "title": "Otro artículo",
      "slug": "otro-articulo"
    }
  ],
  "meta": {
    "pagination": {
      "total": 2
    }
  }
}
```

### **Postman - Paso 2: Obtener Artículo con Likes Count**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6?populate=likes`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Exitosa:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "description": "Description of a beautiful picture",
    "slug": "beautiful-picture",
    "likes": [
      {"id": 1, "user": {"id": 1, "username": "john"}},
      {"id": 2, "user": {"id": 1, "username": "john"}}
    ],
    "createdAt": "2026-02-02T15:33:15.211Z"
  },
  "meta": {}
}
```

**Respuesta si no existe:**
```json
{
  "data": null,
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Not Found"
  }
}
```

### **Postman - Paso 3: Obtener Todos los Artículos con Likes Count**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles?populate=likes`

**Headers:**
```
Content-Type: application/json
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "likes": [
        {"id": 1, "user": {"id": 1, "username": "john"}},
        {"id": 2, "user": {"id": 1, "username": "john"}}
      ]
    },
    {
      "id": 7,
      "title": "Otro artículo",
      "likes": []
    }
  ],
  "meta": {
    "pagination": {
      "total": 2,
      "page": 1,
      "pageSize": 25,
      "pageCount": 1
    }
  }
}
```

### **Postman - Paso 4: Optimizado (Solo IDs de Likes)**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6?populate[likes][fields]=id`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Optimizada:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "likes": [
      {"id": 1},
      {"id": 2}
    ],
    "createdAt": "2026-02-02T15:33:15.211Z"
  },
  "meta": {}
}
```

---

## 📊 12. Código JavaScript con Manejo de Errores

```javascript
// articles/getArticlesWithLikesCount.js
import API_URL from './config';

async function getArticlesWithLikesCount() {
  try {
    const response = await fetch(`${API_URL}/api/articles?populate[likes][fields]=id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      // Transformar para incluir solo el conteo
      const articlesWithCount = data.data.map(article => ({
        ...article,
        likesCount: article.likes?.length || 0,
      }));
      
      console.log('Artículos con conteo de likes:', articlesWithCount);
      return { success: true, articles: articlesWithCount };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso con manejo de errores
getArticlesWithLikesCount()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`${article.title}: ${article.likesCount} likes`);
      });
    } else {
      console.error('Falló la consulta:', result.error);
    }
  });
```

---

## 📊 13. Obtener Artículo Específico con Conteo de Likes

### **Postman - Verificar ID Correcto**

Primero obtén la lista de artículos para encontrar un ID válido, luego usa:

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6?populate[likes][fields][0]=id`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Exitosa:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "likes": [
      {"id": 1},
      {"id": 2},
      {"id": 3}
    ]
  }
}
```

**Respuesta si no existe el artículo:**
```json
{
  "data": null,
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Not Found"
  }
}
```

### **Código JavaScript con Validación**

```javascript
// articles/getArticleWithLikesCount.js
import API_URL from './config';

async function getArticleWithLikesCount(articleId) {
  try {
    const response = await fetch(`${API_URL}/api/articles/${articleId}?populate[likes][fields]=id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      const article = data.data;
      const articleWithCount = {
        ...article,
        likesCount: article.likes?.length || 0,
      };
      
      console.log('Artículo con conteo de likes:', articleWithCount);
      return { success: true, article: articleWithCount };
    } else {
      if (response.status === 404) {
        console.error(`Artículo con ID ${articleId} no encontrado`);
      } else {
        console.error('Error al obtener artículo:', data);
      }
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso con ID válido
getArticleWithLikesCount(6)
  .then(result => {
    if (result.success) {
      const article = result.article;
      console.log(`${article.title} tiene ${article.likesCount} likes`);
    } else {
      console.error('Falló la consulta:', result.error);
    }
  });

// Ejemplo con ID que no existe
getArticleWithLikesCount(999)
  .then(result => {
    if (result.success) {
      console.log(`${result.article.title} tiene ${result.article.likesCount} likes`);
    } else {
      console.error('Artículo no encontrado:', result.error);
    }
  });
```

---

## 🔍 **Guía de Depuración para Error 404**

### **Paso 1: Verificar Artículos Disponibles**
```
GET http://localhost:1337/api/articles
```

**Respuesta Esperada:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "currentStatus": "draft",
      "publishedAt": "2026-02-02T15:48:03.128Z"
    }
  ]
}
```

### **Paso 2: Verificar Estado de Publicación**

Si el artículo está en `"currentStatus": "draft"`, necesitas:

#### **Opción A: Acceder con Estado Preview**
```
GET http://localhost:1337/api/articles/6?populate=likes&publicationState=preview
```

#### **Opción B: Publicar el Artículo**
1. Ve a: `http://localhost:1337/admin`
2. **Content Manager → Articles**
3. Selecciona el artículo
4. Haz clic en **"Publish"**

#### **Opción C: Usar DocumentId**
```
GET http://localhost:1337/api/articles/{documentId}?populate=likes
```

### **Paso 3: Verificar Permisos**
Ve a: `http://localhost:1337/admin`

**Settings → Users & Permissions Plugin → Roles → Public**

Asegúrate de tener:
- ✅ `find` en Articles
- ✅ `findOne` en Articles

### **Paso 4: Soluciones Funcionales**

#### **Si el artículo está publicado:**
```
GET http://localhost:1337/api/articles/6?populate=likes
```

#### **Si el artículo está en draft:**
```
GET http://localhost:1337/api/articles/6?populate=likes&publicationState=preview
```

#### **Para obtener todos los artículos (incluyendo drafts):**
```
GET http://localhost:1337/api/articles?populate=likes&publicationState=preview
```

---

## 📊 13. Obtener Artículos con Solo Conteo de Likes (Optimizado)

### **Postman - Endpoint Optimizado**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/with-likes-count`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Optimizada (Solo el conteo):**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "currentStatus": "draft",
      "likesCount": 43,
      "createdAt": "2026-02-02T15:33:15.211Z",
      "updatedAt": "2026-02-02T15:48:03.099Z"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### **Postman - Artículo Específico Optimizado**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6/with-likes-count`

**Headers:**
```
Content-Type: application/json
```

**Respuesta:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "description": "Description of a beautiful picture",
    "slug": "beautiful-picture",
    "currentStatus": "draft",
    "likesCount": 43,
    "createdAt": "2026-02-02T15:33:15.211Z",
    "updatedAt": "2026-02-02T15:48:03.099Z"
  }
}
```

---

## 📊 14. Código JavaScript para Endpoints Optimizados

```javascript
// articles/getArticlesWithLikesCountOptimized.js
import API_URL from './config';

async function getArticlesWithLikesCountOptimized() {
  try {
    const response = await fetch(`${API_URL}/api/articles/with-likes-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos con conteo optimizado:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithLikesCountOptimized()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`${article.title}: ${article.likesCount} likes`);
      });
    }
  });
```

---

## 📊 15. Artículo Específico con Solo Conteo

```javascript
// articles/getArticleWithLikesCountOptimized.js
import API_URL from './config';

async function getArticleWithLikesCountOptimized(articleId) {
  try {
    const response = await fetch(`${API_URL}/api/articles/${articleId}/with-likes-count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículo con conteo optimizado:', data.data);
      return { success: true, article: data.data };
    } else {
      console.error('Error al obtener artículo:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticleWithLikesCountOptimized(6)
  .then(result => {
    if (result.success) {
      const article = result.article;
      console.log(`${article.title} tiene ${article.likesCount} likes`);
    } else {
      console.error('Falló la consulta:', result.error);
    }
  });
```

---

## 🎯 **Ventajas del Endpoint Optimizado**

1. **Sin relaciones**: No trae datos de usuarios de likes
2. **Campo directo**: `likesCount: 43` ya calculado
3. **Rendimiento**: Más rápido y ligero
4. **Simple**: Solo el número que necesitas

**Comparación:**
- ❌ `populate=likes`: Trae usuarios, datos extra, lento
- ✅ `/with-likes-count`: Solo el número, rápido, optimizado
**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/with-likes-count?filters[category][slug][$eq]=innovacion-y-emprendimiento&filters[documentId][$ne]=lg9msobqxtgmrqsg12jegicj&populate[imageCard][fields][0]=id&populate[imageCard][fields][1]=name&populate[imageCard][fields][2]=url&populate[imageCard][fields][3]=alternativeText&populate[cover][fields][0]=id&populate[cover][fields][1]=name&populate[cover][fields][2]=url&populate[cover][fields][3]=alternativeText&populate[countries][fields][0]=id&populate[countries][fields][1]=name&populate[countries][fields][2]=slug&populate[countries][fields][3]=link&populate[author][fields][0]=id&populate[author][fields][1]=name&populate[author][fields][2]=email&populate[author][populate][avatar][fields][0]=id&populate[author][populate][avatar][fields][1]=name&populate[author][populate][avatar][fields][2]=url&populate[author][populate][avatar][fields][3]=alternativeText&populate[main_category][fields][0]=id&populate[main_category][fields][1]=name&populate[main_category][fields][2]=slug&populate[main_category][fields][3]=locale&populate[main_category][filters][locale][$eq]=es-US&populate[category][fields][0]=id&populate[category][fields][1]=name&populate[category][fields][2]=slug&populate[category][fields][3]=locale&populate[category][filters][locale][$eq]=es-US&populate[sub_categories][fields][0]=id&populate[sub_categories][fields][1]=name&populate[sub_categories][fields][2]=slug&populate[sub_categories][fields][3]=locale&populate[sub_categories][filters][locale][$eq]=es-US&populate[seo][fields][0]=id&populate[seo][fields][1]=metaTitle&populate[seo][fields][2]=metaDescription&populate[seo][fields][3]=metaRobots&populate[seo][fields][4]=canonicalURL&populate[seo][fields][5]=openGraphTitle&populate[seo][fields][6]=openGraphDescription&populate[seo][fields][7]=languageCode&populate[seo][fields][8]=countryCode&populate[seo][fields][9]=slug&populate[seo][fields][10]=keywords&populate[seo][populate][openGraphImage][fields][0]=id&populate[seo][populate][openGraphImage][fields][1]=name&populate[seo][populate][openGraphImage][fields][2]=url&populate[seo][populate][openGraphImage][fields][3]=alternativeText&populate[seo][populate][twitterCardImage][fields][0]=id&populate[seo][populate][twitterCardImage][fields][1]=name&populate[seo][populate][twitterCardImage][fields][2]=url&populate[seo][populate][twitterCardImage][fields][3]=alternativeText&populate[blocks][on][shared.media][populate][file][fields][0]=id&populate[blocks][on][shared.media][populate][file][fields][1]=name&populate[blocks][on][shared.media][populate][file][fields][2]=url&populate[blocks][on][shared.media][populate][file][fields][3]=alternativeText&populate[blocks][on][shared.rich-text]=true&populate[blocks][on][shared.quote]=true&populate[localizations][fields][0]=id&populate[localizations][fields][1]=documentId&populate[localizations][fields][2]=slug&populate[localizations][fields][3]=locale&locale=es-US&pagination[pageSize]=6&pagination[page]=1&sort[0]=publishedAt%3Adesc`

**Headers:**
```
Content-Type: application/json
```

**Respuesta Esperada (Tu consulta + likesCount):**
```json
{
  "data": [
    {
      "id": 6,
      "documentId": "iq5qwcwkgate0f191hxamw1v",
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "likesCount": 43,
      "imageCard": {
        "id": 1,
        "name": "imagen_tarjeta",
        "url": "http://localhost:1337/uploads/imagen_tarjeta.jpg",
        "alternativeText": "Imagen de tarjeta"
      },
      "cover": {
        "id": 2,
        "name": "portada",
        "url": "http://localhost:1337/uploads/portada.jpg",
        "alternativeText": "Imagen de portada"
      },
      "category": {
        "id": 1,
        "name": "Innovación y Emprendimiento",
        "slug": "innovacion-y-emprendimiento",
        "locale": "es-US"
      },
      "main_category": {
        "id": 2,
        "name": "Tecnología",
        "slug": "tecnologia",
        "locale": "es-US"
      },
      "sub_categories": [
        {
          "id": 3,
          "name": "Startups",
          "slug": "startups",
          "locale": "es-US"
        }
      ],
      "author": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "avatar": {
          "id": 1,
          "name": "avatar_john",
          "url": "http://localhost:1337/uploads/avatar_john.jpg",
          "alternativeText": "Avatar de John"
        }
      },
      "countries": [
        {
          "id": 1,
          "name": "Colombia",
          "slug": "colombia",
          "link": "https://example.com/colombia"
        }
      ],
      "seo": {
        "id": 1,
        "metaTitle": "Beautiful Picture - Innovación",
        "metaDescription": "Descripción SEO",
        "metaRobots": "index,follow",
        "canonicalURL": "https://example.com/beautiful-picture",
        "openGraphTitle": "Beautiful Picture",
        "openGraphDescription": "Descripción Open Graph",
        "languageCode": "es",
        "countryCode": "CO",
        "slug": "beautiful-picture",
        "keywords": ["innovación", "emprendimiento"],
        "openGraphImage": {
          "id": 3,
          "name": "og_image",
          "url": "http://localhost:1337/uploads/og_image.jpg",
          "alternativeText": "Open Graph Image"
        },
        "twitterCardImage": {
          "id": 4,
          "name": "twitter_image",
          "url": "http://localhost:1337/uploads/twitter_image.jpg",
          "alternativeText": "Twitter Card Image"
        }
      },
      "blocks": [
        {
          "__component": "shared.media",
          "file": {
            "id": 5,
            "name": "media_file",
            "url": "http://localhost:1337/uploads/media_file.jpg",
            "alternativeText": "Media File"
          }
        },
        {
          "__component": "shared.rich-text",
          "content": "<p>Contenido rich text aquí</p>"
        },
        {
          "__component": "shared.quote",
          "content": "Esta es una cita inspiradora",
          "author": "Autor de la cita"
        }
      ],
      "localizations": [
        {
          "id": 7,
          "documentId": "lg9msobqxtgmrqsg12jegicj",
          "slug": "beautiful-picture-en",
          "locale": "en"
```

**Respuesta Optimizada:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "likesCount": 43,
      "createdAt": "2026-02-02T15:33:15.211Z"
    }
  ]
}
```

### **Postman - Artículo Específico con LikesCount**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6/with-likes-count?populate=comments.author`

**Headers:**
```
Content-Type: application/json
```

**Respuesta:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "description": "Description of a beautiful picture",
    "slug": "beautiful-picture",
    "likesCount": 43,
    "comments": [
      {
        "id": 1,
        "content": "Comentario de prueba",
        "author": {
          "id": 1,
          "username": "john",
          "firstName": "John",
          "lastName": "Doe"
        }
      }
    ],
    "createdAt": "2026-02-02T15:33:15.211Z"
  }
}
```
    );

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos completos con likesCount:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithEverythingAndLikes()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`
          📰 ${article.title}
          ❤️ ${article.likesCount} likes
          📂 ${article.category?.name || 'Sin categoría'}
          💬 ${article.comments?.length || 0} comentarios
        `);
      });
    }
  });
```

### **JavaScript Selectivo**

```javascript
// Solo lo que necesitas + likesCount
async function getArticlesSelective() {
  const response = await fetch(
    `${API_URL}/api/articles-with-likes?populate=category,comments.author`
  );
  
  const data = await response.json();
  return data.data;
}

// Para un artículo específico
async function getArticleSelective(articleId) {
  const response = await fetch(
    `${API_URL}/api/articles-with-likes/${articleId}?populate=category,comments.author`
  );
  
  const data = await response.json();
  return data.data;
}
```

---

## 🎯 **Comparación: APIs Disponibles**

### **API Estándar Strapi (Intacta - Sin Modificar):**
```
GET /api/articles?populate=category,comments.author
```
✅ Funcionalidad original intacta
❌ Sin likesCount

### **API Nueva con LikesCount (Sección Completamente Nueva):**
```
GET /api/articles-with-likes?populate=category,comments.author
```
✅ No afecta funcionalidad actual
✅ Con likesCount adicional

**Tienes ambas APIs disponibles sin riesgo!**

---

## 📊 16. Obtener Artículos con Conteo de Comentarios

### **API Estándar con Comments Count**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles?includeCommentsCount=true`

**Headers:**
```
Content-Type: application/json
```

**Respuesta con Comments Count:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "commentsCount": 15,
      "createdAt": "2026-02-02T15:33:15.211Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 1
    }
  }
}
```

### **API con Ambos Conteos (Likes + Comments)**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles?includeLikesCount=true&includeCommentsCount=true`

**Respuesta con Ambos Conteos:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "likesCount": 43,
      "commentsCount": 15,
      "createdAt": "2026-02-02T15:33:15.211Z"
    }
  ],
  "meta": {
    "pagination": {
      "total": 1
    }
  }
}
```

### **Artículo Específico con Comments Count**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6?includeCommentsCount=true`

**Respuesta:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "description": "Description of a beautiful picture",
    "slug": "beautiful-picture",
    "commentsCount": 15,
    "createdAt": "2026-02-02T15:33:15.211Z"
  },
  "meta": {}
}
```

---

## 📊 17. Código JavaScript para Comments Count

```javascript
// articles/getArticlesWithCommentsCount.js
import API_URL from './config';

async function getArticlesWithCommentsCount() {
  try {
    const response = await fetch(`${API_URL}/api/articles?includeCommentsCount=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos con conteo de comentarios:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithCommentsCount()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`${article.title}: ${article.commentsCount} comentarios`);
      });
    }
  });
```

### **Artículo Específico con Comments Count**

```javascript
// articles/getArticleWithCommentsCount.js
import API_URL from './config';

async function getArticleWithCommentsCount(articleId) {
  try {
    const response = await fetch(`${API_URL}/api/articles/${articleId}?includeCommentsCount=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículo con conteo de comentarios:', data.data);
      return { success: true, article: data.data };
    } else {
      console.error('Error al obtener artículo:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticleWithCommentsCount(6)
  .then(result => {
    if (result.success) {
      const article = result.article;
      console.log(`${article.title} tiene ${article.commentsCount} comentarios`);
    }
  });
```

### **Ambos Conteos (Likes + Comments)**

```javascript
// articles/getArticlesWithAllCounts.js
import API_URL from './config';

async function getArticlesWithAllCounts() {
  try {
    const response = await fetch(`${API_URL}/api/articles?includeLikesCount=true&includeCommentsCount=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos con todos los conteos:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithAllCounts()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`${article.title}: ${article.likesCount} likes, ${article.commentsCount} comentarios`);
      });
    }
  });
```

---

## 📊 18. Endpoints Optimizados con Comments Count

### **Endpoint Optimizado con Comments Count**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/with-likes-count?includeCommentsCount=true`

**Respuesta Optimizada:**
```json
{
  "data": [
    {
      "id": 6,
      "title": "Beautiful picture",
      "description": "Description of a beautiful picture",
      "slug": "beautiful-picture",
      "likesCount": 43,
      "commentsCount": 15,
      "createdAt": "2026-02-02T15:33:15.211Z",
      "updatedAt": "2026-02-02T15:48:03.099Z"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### **Artículo Específico Optimizado**

**Method:** `GET`  
**URL:** `http://localhost:1337/api/articles/6/with-likes-count?includeCommentsCount=true`

**Respuesta:**
```json
{
  "data": {
    "id": 6,
    "title": "Beautiful picture",
    "description": "Description of a beautiful picture",
    "slug": "beautiful-picture",
    "likesCount": 43,
    "commentsCount": 15,
    "createdAt": "2026-02-02T15:33:15.211Z",
    "updatedAt": "2026-02-02T15:48:03.099Z"
  }
}
```

---

## 📊 19. Código JavaScript para Endpoints Optimizados

```javascript
// articles/getArticlesWithAllCountsOptimized.js
import API_URL from './config';

async function getArticlesWithAllCountsOptimized() {
  try {
    const response = await fetch(`${API_URL}/api/articles/with-likes-count?includeCommentsCount=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos con conteos optimizados:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithAllCountsOptimized()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        console.log(`${article.title}: ${article.likesCount} likes, ${article.commentsCount} comentarios`);
      });
    }
  });
```

---

## 🎯 **Resumen de Parámetros Disponibles**

### **Parámetros de Query:**

| Parámetro | Descripción | Ejemplo |
|-----------|-------------|---------|
| `includeLikesCount=true` | Incluir conteo de likes | `?includeLikesCount=true` |
| `includeCommentsCount=true` | Incluir conteo de comentarios | `?includeCommentsCount=true` |
| `populate=*` | Incluir todas las relaciones | `?populate=*` |
| `populate=author,category` | Incluir relaciones específicas | `?populate=author,category` |

### **Combinaciones Posibles:**

1. **Solo likes count:**
   ```
   GET /api/articles?includeLikesCount=true
   ```

2. **Solo comments count:**
   ```
   GET /api/articles?includeCommentsCount=true
   ```

3. **Ambos conteos:**
   ```
   GET /api/articles?includeLikesCount=true&includeCommentsCount=true
   ```

4. **Conteos + relaciones:**
   ```
   GET /api/articles?includeLikesCount=true&includeCommentsCount=true&populate=author,category
   ```

5. **Endpoints optimizados:**
   ```
   GET /api/articles/with-likes-count?includeCommentsCount=true
   ```

---

## �� 13. Obtener Artículos con Likes y Comentarios

```javascript
// articles/getArticlesWithLikesAndComments.js
import API_URL from './config';

async function getArticlesWithLikesAndComments() {
  try {
    const response = await fetch(
      `${API_URL}/api/articles?populate=likes,comments.author`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log('Artículos con likes y comentarios:', data.data);
      return { success: true, articles: data.data };
    } else {
      console.error('Error al obtener artículos:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getArticlesWithLikesAndComments()
  .then(result => {
    if (result.success) {
      result.articles.forEach(article => {
        const likesCount = article.likes?.length || 0;
        const commentsCount = article.comments?.length || 0;
        console.log(`${article.title}: ${likesCount} likes, ${commentsCount} comentarios`);
      });
    }
  });
```

---

## �� 7. Obtener Cantidad de Likes de un Artículo

```javascript
// likes/getLikesCount.js
import API_URL from './config';

async function getLikesCount(articleId) {
  try {
    const response = await fetch(
      `${API_URL}/api/likes?filters[article][id][$eq]=${articleId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const count = data.meta.pagination.total;
      console.log(`Artículo ${articleId} tiene ${count} likes`);
      return { success: true, count: count };
    } else {
      console.error('Error al obtener likes:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
getLikesCount(1)
  .then(result => {
    if (result.success) {
      console.log(`Total de likes: ${result.count}`);
    }
  });
```

---

## ✅ 8. Verificar si el Usuario Actual Dio Like

```javascript
// likes/checkUserLike.js
import API_URL from './config';

async function checkUserLike(articleId) {
  const jwt = localStorage.getItem('jwt');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!jwt || !user) {
    return { success: false, liked: false };
  }

  try {
    const response = await fetch(
      `${API_URL}/api/likes?filters[article][id][$eq]=${articleId}&filters[user][id][$eq]=${user.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      const liked = data.data.length > 0;
      return { success: true, liked: liked };
    } else {
      return { success: false, liked: false };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, liked: false };
  }
}

// Ejemplo de uso
checkUserLike(1)
  .then(result => {
    if (result.success && result.liked) {
      console.log('El usuario ya dio like a este artículo ❤️');
      // Mostrar corazón rojo en la UI
    } else {
      console.log('El usuario no ha dado like 🤍');
      // Mostrar corazón vacío en la UI
    }
  });
```

---

## 🎨 9. Componente React Completo (Ejemplo)

```jsx
// components/ArticleLikeButton.jsx
import React, { useState, useEffect } from 'react';
import API_URL from '../config';

function ArticleLikeButton({ articleId }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIfLiked();
    fetchLikesCount();
  }, [articleId]);

  const checkIfLiked = async () => {
    const jwt = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!jwt || !user) return;

    try {
      const response = await fetch(
        `${API_URL}/api/likes?articleId=${articleId}`,
        {
          headers: {
            'Authorization': `Bearer ${jwt}`,
          },
        }
      );
      const data = await response.json();
      const userLike = data.data.find(like => like.user?.id === user.id);
      setLiked(!!userLike);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchLikesCount = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/likes?articleId=${articleId}`
      );
      const data = await response.json();
      setLikesCount(data.meta.total);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleToggleLike = async () => {
    const jwt = localStorage.getItem('jwt');

    if (!jwt) {
      alert('Debes iniciar sesión para dar like');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/likes/${articleId}/toggle-like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setLiked(data.liked);
        setLikesCount(prev => data.liked ? prev + 1 : prev - 1);
      } else {
        alert('Error al procesar el like');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error de red al procesar el like');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLike}
      disabled={loading}
      className={`like-button ${liked ? 'liked' : ''}`}
    >
      {liked ? '❤️' : '🤍'} {likesCount}
    </button>
  );
}

export default ArticleLikeButton;
```

---

## 📱 10. Componente React para Comentarios

```jsx
// components/CommentSection.jsx
import React, { useState, useEffect } from 'react';
import API_URL from '../config';

function CommentSection({ articleId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/comments?filters[article][id][$eq]=${articleId}&populate=author&sort=createdAt:desc`
      );
      const data = await response.json();
      setComments(data.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const jwt = localStorage.getItem('jwt');

    if (!jwt) {
      alert('Debes iniciar sesión para comentar');
      return;
    }

    if (!newComment.trim()) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          data: {
            content: newComment,
            article_id: articleId,
          },
        }),
      });

      if (response.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="comment-section">
      <h3>Comentarios ({comments.length})</h3>

      <form onSubmit={handleSubmitComment}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe un comentario..."
          rows="3"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Comentar'}
        </button>
      </form>

      <div className="comments-list">
        const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleUpdateComment = async (commentId, newContent) => {
    const jwt = localStorage.getItem('jwt');
    
    if (!jwt) {
      alert('Debes iniciar sesión para actualizar comentarios');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          data: {
            content: newContent,
          },
        }),
      });

      if (response.ok) {
        fetchComments();
      } else {
        alert('Error al actualizar comentario');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const jwt = localStorage.getItem('jwt');
    
    if (!jwt) {
      alert('Debes iniciar sesión para eliminar comentarios');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
      });

      if (response.ok) {
        fetchComments();
      } else {
        alert('Error al eliminar comentario');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="comment-section">
      <h3>Comentarios ({comments.length})</h3>

      <form onSubmit={handleSubmitComment}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe un comentario..."
          rows="3"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Comentar'}
        </button>
      </form>

      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <strong>{comment.author?.username || 'Usuario'}</strong>
            <p>{comment.content}</p>
            <small>{new Date(comment.createdAt).toLocaleDateString()}</small>
            
            {user.id === comment.author?.id && (
              <div className="comment-actions">
                <button 
                  onClick={() => {
                    const newContent = prompt('Editar comentario:', comment.content);
                    if (newContent && newContent !== comment.content) {
                      handleUpdateComment(comment.id, newContent);
                    }
                  }}
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleDeleteComment(comment.id)}
                  style={{ marginLeft: '10px', color: 'red' }}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CommentSection;
```

---

## 🔑 Notas Importantes

1. **JWT Storage**: Los ejemplos usan `localStorage` para almacenar el JWT. En producción, considera usar cookies HttpOnly para mayor seguridad.

2. **Error Handling**: Implementa manejo de errores más robusto según tus necesidades.

3. **CORS**: Asegúrate de configurar CORS en Strapi si tu frontend está en un dominio diferente.

4. **Validación**: Agrega validación de formularios en el frontend antes de enviar datos.

5. **Loading States**: Implementa estados de carga para mejorar la UX.

6. **Optimistic Updates**: Considera actualizar la UI optimísticamente antes de recibir la respuesta del servidor.
