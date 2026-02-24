# API de Interacciones (Sistema de Likes)

## Overview

El sistema de interacciones permite a los usuarios marcar artículos con diferentes tipos de interacciones. Los tipos están definidos en la tabla `interaction_types` y son completamente dinámicos y configurables desde el admin.

**⚠️ IMPORTANTE: Sistema Dinámico**
- Los tipos de interacción se obtienen desde `/api/interaction-types`
- El frontend debe usar el **ID** del tipo de interacción, no códigos hardcodeados
- Los administradores pueden crear, editar o eliminar tipos desde el panel de Strapi
- El sistema es escalable: se pueden agregar nuevos tipos sin cambiar código

**Estructura de un Tipo de Interacción:**
- `id`: ID único del tipo (usar este en las peticiones)
- `code`: Código identificador (puede cambiar desde el admin)
- `display_name`: Nombre para mostrar al usuario
- `icon`: Icono asociado (opcional)
- `color`: Color para UI (opcional)
- `active`: Si el tipo está activo o no

## Endpoints

### 1. Toggle Interaction (Alternar Interacción)

**POST** `/api/likes/toggle-interaction`

Alternar una interacción con un artículo específico. Si el usuario ya tiene esa interacción, la elimina. Si no, la crea.

**Request Body:**
```json
{
  "articleId": 123,  // ID del artículo (requerido)
  "type": 1          // ID del tipo de interacción (requerido)
}
```

**Parámetros:**
- `articleId` (body, requerido): ID del artículo
- `type` (body, requerido): **ID** del tipo de interacción (número)
  - Obtener los IDs disponibles desde `/api/interaction-types`
  - Usar el campo `id` del tipo de interacción

**Comportamiento:**
- Un usuario solo puede tener **una interacción por artículo**
- Si el usuario no tiene interacción: crea una nueva
- Si el usuario tiene el mismo tipo: elimina la interacción
- Si el usuario tiene un tipo diferente: reemplaza la interacción existente

**Response Exitoso (200):**
```json
{
  "message": "Article liked",
  "interacted": true,
  "type": "me_gusta",
  "typeInfo": {
    "code": "me_gusta",
    "display_name": "Me gusta",
    "icon": "❤️",
    "color": "#e74c3c"
  }
}
```

**Response al eliminar (200):**
```json
{
  "message": "Me gusta removed",
  "interacted": false,
  "type": "me_gusta",
  "typeInfo": {
    "code": "me_gusta",
    "display_name": "Me gusta",
    "icon": "❤️",
    "color": "#e74c3c"
  }
}
```

**Response al cambiar tipo (200):**
```json
{
  "message": "Interaction changed from Me gusta to Me interesa",
  "interacted": true,
  "type": "me_interesa",
  "previousType": "me_gusta",
  "typeInfo": {
    "code": "me_interesa",
    "display_name": "Me interesa",
    "icon": "⭐",
    "color": "#f39c12"
  }
}
```

**Flujo Completo:**
```javascript
// 1. Primero, obtener los tipos de interacción disponibles
const typesResponse = await fetch('/api/interaction-types', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
});
const { data: interactionTypes } = await typesResponse.json();

// 2. Encontrar el tipo que necesitas (ej: "Me gusta")
const likeType = interactionTypes.find(t => t.attributes.code === 'me_gusta');

// 3. Usar el ID del tipo para crear la interacción
fetch('/api/likes/toggle-interaction', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    articleId: 123,        // ✅ ID del artículo
    type: likeType.id      // ✅ ID dinámico del tipo
  })
})
```

**⚠️ NO hacer esto:**
```javascript
// ❌ INCORRECTO - No hardcodear códigos en lugar de IDs
body: JSON.stringify({ 
  articleId: 123,
  type: 'me_gusta'  // ❌ Debe ser el ID numérico
})

// ❌ INCORRECTO - No asumir IDs fijos sin obtenerlos primero
body: JSON.stringify({ 
  articleId: 123,
  type: 1  // ❌ Obtener el ID dinámicamente desde /api/interaction-types
})
```

### 2. Get User Interactions (Obtener Interacciones del Usuario)

**GET** `/api/likes/my-interactions`

Obtener todas las interacciones del usuario actual.

**Query Parameters:**
- `type` (opcional): Filtrar por ID del tipo de interacción (número)
- `articleId` (opcional): Filtrar por artículo específico

**Response Exitoso (200):**
```json
{
  "data": [
    {
      "id": 1,
      "attributes": {
        "createdAt": "2024-02-24T10:00:00.000Z",
        "updatedAt": "2024-02-24T10:00:00.000Z",
        "type": {
          "data": {
            "id": 1,
            "attributes": {
              "code": "me_gusta",
              "display_name": "Me gusta",
              "icon": "❤️",
              "color": "#e74c3c"
            }
          }
        },
        "article": {
          "data": {
            "id": 123,
            "attributes": {
              "title": "Título del Artículo",
              "slug": "titulo-del-articulo"
            }
          }
        }
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

**Ejemplo de uso:**
```javascript
// Obtener tipos de interacción primero
const typesResponse = await fetch('/api/interaction-types');
const { data: types } = await typesResponse.json();
const likeTypeId = types.find(t => t.attributes.code === 'me_gusta')?.id;

// Obtener todos los artículos que me gustan
fetch(`/api/likes/my-interactions?type=${likeTypeId}`, {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
})

// Obtener todas las interacciones (sin filtro)
fetch('/api/likes/my-interactions', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  }
})
```

### 3. Get Article Interactions (Obtener Interacciones de un Artículo)

**GET** `/api/likes?articleId=123`

Obtener todas las interacciones para un artículo específico.

**Query Parameters:**
- `articleId` (requerido): ID del artículo
- `type` (opcional): Filtrar por código de tipo de interacción

**Response Exitoso (200):**
```json
{
  "data": [
    {
      "id": 1,
      "attributes": {
        "createdAt": "2024-02-24T10:00:00.000Z",
        "type": {
          "data": {
            "id": 1,
            "attributes": {
              "code": "me_gusta",
              "display_name": "Me gusta",
              "icon": "❤️",
              "color": "#e74c3c"
            }
          }
        },
        "user": {
          "data": {
            "id": 456,
            "attributes": {
              "username": "usuario123"
            }
          }
        }
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### 4. Get User Liked Articles (Obtener Artículos que Gustan al Usuario)

**GET** `/api/likes/my-liked-articles`

Obtener todos los artículos que el usuario actual ha marcado como "me gusta".

**Response Exitoso (200):**
```json
{
  "data": [
    {
      "id": 123,
      "attributes": {
        "title": "Título del Artículo",
        "slug": "titulo-del-articulo",
        "content": "Contenido del artículo...",
        "publishedAt": "2024-02-24T09:00:00.000Z"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### 5. Get User Interested Articles (Obtener Artículos que Interesan al Usuario)

**GET** `/api/likes/my-interested-articles`

Obtener todos los artículos que el usuario actual ha marcado como "me interesa".

**Response Exitoso (200):**
```json
{
  "data": [
    {
      "id": 124,
      "attributes": {
        "title": "Título del Artículo",
        "slug": "titulo-del-articulo",
        "content": "Contenido del artículo...",
        "publishedAt": "2024-02-24T09:00:00.000Z"
      }
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## Estados de Interacción

### Verificar Estado de Interacción

Para verificar si un usuario ya interactuó con un artículo, puedes hacer:

```javascript
// Verificar si el usuario le gusta un artículo específico
async function checkUserInteraction(articleId, userId, type) {
  const response = await fetch(`/api/likes?articleId=${articleId}&type=${type}`, {
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN'
    }
  });
  
  const data = await response.json();
  const userInteraction = data.data.find(interaction => 
    interaction.attributes.user.data.id === userId
  );
  
  return {
    hasInteracted: !!userInteraction,
    interaction: userInteraction,
    typeInfo: userInteraction?.attributes.type?.data?.attributes
  };
}
```

## Tipos de Interacción

| Código (code) | Display Name | Icono | Color | ID (interno) | Descripción |
|---------------|-------------|-------|-------|--------------|-------------|
| `me_gusta` | Me gusta | ❤️ | #e74c3c | 1 | Para marcar favoritos o contenido apreciado |
| `me_interesa` | Me interesa | ⭐ | #f39c12 | 2 | Para marcar contenido para leer más tarde |

**⚠️ Importante:** 
- **Siempre usar el campo `code`** en las peticiones API
- **Nunca usar el ID numérico** (solo uso interno de la base de datos)

## Obtener Tipos de Interacción Disponibles

**GET** `/api/interaction-types`

Obtener todos los tipos de interacción disponibles para usar sus códigos en las peticiones.

**Response Exitoso (200):**
```json
{
  "data": [
    {
      "id": 1,
      "attributes": {
        "code": "me_gusta",
        "display_name": "Me gusta",
        "icon": "❤️",
        "color": "#e74c3c",
        "active": true
      }
    },
    {
      "id": 2,
      "attributes": {
        "code": "me_interesa",
        "display_name": "Me interesa",
        "icon": "⭐",
        "color": "#f39c12",
        "active": true
      }
    }
  ]
}
```

## Errores Comunes

### 401 Unauthorized
```json
{
  "error": "You must be logged in to interact with articles"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid interaction type"
}
```

### 404 Not Found
```json
{
  "error": "Interaction not found"
}
```

## Ejemplo Completo en Frontend

```javascript
class InteractionManager {
  constructor() {
    this.token = localStorage.getItem('jwt');
  }

  async toggleInteraction(articleId, type = 'like') {
    try {
      const response = await fetch(`/api/likes/${articleId}/toggle-interaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      return await response.json();
    } catch (error) {
      console.error('Error toggling interaction:', error);
      throw error;
    }
  }

  async getMyLikedArticles() {
    try {
      const response = await fetch('/api/likes/my-liked-articles', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting liked articles:', error);
      throw error;
    }
  }

  async getMyInterestedArticles() {
    try {
      const response = await fetch('/api/likes/my-interested-articles', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting interested articles:', error);
      throw error;
    }
  }

  async getArticleInteractions(articleId, type = null) {
    try {
      let url = `/api/likes?articleId=${articleId}`;
      if (type) {
        url += `&type=${type}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting article interactions:', error);
      throw error;
    }
  }

  async getInteractionTypes() {
    try {
      const response = await fetch('/api/likes-types', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error getting interaction types:', error);
      throw error;
    }
  }
}

// Uso en React
function InteractionButton({ articleId, type }) {
  const [currentInteraction, setCurrentInteraction] = useState(null);
  const interactionManager = new InteractionManager();

  const handleInteraction = async () => {
    try {
      const result = await interactionManager.toggleInteraction(articleId, type);
      
      if (result.interacted) {
        setCurrentInteraction(result.typeInfo);
      } else {
        setCurrentInteraction(null);
      }
    } catch (error) {
      console.error('Error toggling interaction:', error);
    }
  };

  const isActive = currentInteraction?.code === type;

  return (
    <button 
      onClick={handleInteraction}
      style={{ 
        backgroundColor: isActive ? currentInteraction?.color : '#ccc',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      {isActive ? `${currentInteraction?.icon} ${currentInteraction?.display_name}` : `${type === 'like' ? '🤍' : '☆'} ${type === 'like' ? 'Me gusta' : 'Me interesa'}`}
    </button>
  );
}

// Componente completo con múltiples interacciones
function ArticleInteractions({ articleId }) {
  const [userInteraction, setUserInteraction] = useState(null);
  const [types, setTypes] = useState([]);
  const interactionManager = new InteractionManager();

  useEffect(() => {
    // Cargar tipos de interacción disponibles
    interactionManager.getInteractionTypes().then(setTypes);
    
    // Cargar interacción actual del usuario para este artículo
    interactionManager.getMyInteractions({ articleId }).then(data => {
      if (data.data.length > 0) {
        setUserInteraction(data.data[0].attributes.type.data.attributes);
      }
    });
  }, [articleId]);

  const handleInteraction = async (typeCode) => {
    try {
      const result = await interactionManager.toggleInteraction(articleId, typeCode);
      
      if (result.interacted) {
        setUserInteraction(result.typeInfo);
      } else {
        setUserInteraction(null);
      }
    } catch (error) {
      console.error('Error toggling interaction:', error);
    }
  };

  return (
    <div className="article-interactions">
      {types.map(type => {
        const isActive = userInteraction?.code === type.attributes.code;
        return (
          <button
            key={type.id}
            onClick={() => handleInteraction(type.attributes.code)}
            style={{
              backgroundColor: isActive ? type.attributes.color : '#f0f0f0',
              color: isActive ? 'white' : '#333',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '8px',
              fontSize: '14px'
            }}
          >
            {isActive ? 
              `${type.attributes.icon} ${type.attributes.display_name}` : 
              `${type.attributes.icon === '❤️' ? '🤍' : '☆'} ${type.attributes.display_name}`
            }
          </button>
        );
      })}
    </div>
  );
}

// Componente completo con múltiples interacciones
function ArticleInteractions({ articleId }) {
  const [interactions, setInteractions] = useState([]);
  const [types, setTypes] = useState([]);
  const interactionManager = new InteractionManager();

  useEffect(() => {
    // Cargar tipos de interacción disponibles
    interactionManager.getInteractionTypes().then(setTypes);
    
    // Cargar interacciones del usuario para este artículo
    interactionManager.getMyInteractions({ articleId }).then(setInteractions);
  }, [articleId]);

  const getInteractionStatus = (typeCode) => {
    return interactions.some(interaction => 
      interaction.attributes.type?.data?.attributes?.code === typeCode
    );
  };

  return (
    <div className="article-interactions">
      {types.map(type => (
        <InteractionButton
          key={type.id}
          articleId={articleId}
          type={type.attributes.code}
          initialStatus={getInteractionStatus(type.attributes.code)}
          typeInfo={type.attributes}
        />
      ))}
    </div>
  );
}
```

## Consideraciones de Seguridad

1. **Autenticación requerida**: Todos los endpoints requieren un token JWT válido
2. **Validación de tipos**: Solo se permite `me_gusta` y `me_interesa`
3. **Propiedad**: Los usuarios solo pueden eliminar sus propias interacciones
4. **Privacidad**: Las interacciones son públicas pero los datos del usuario están protegidos

## Rendimiento

- Las interacciones están optimizadas con índices en la base de datos
- Los endpoints soportan paginación para grandes conjuntos de datos
- Las respuestas incluyen información relevante del artículo para evitar consultas adicionales
