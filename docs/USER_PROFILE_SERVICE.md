# User Profile Service

## Descripción

Para actualizar la información del usuario (nombre, apellido, biografía, imageUrl), usa los endpoints estándar de Strapi para el plugin `users-permissions`.

## Endpoints

### GET /api/users/me
Obtener el perfil del usuario autenticado.

**Autenticación**: Requiere token JWT

**Response (200 OK)**:
```json
{
  "id": 1,
  "email": "usuario@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "biography": "Desarrollador web apasionado",
  "imageUrl": "https://cdn.ejemplo.com/uploads/avatar.jpg",
  "createdAt": "2026-02-16T12:00:00.000Z",
  "updatedAt": "2026-02-16T12:00:00.000Z"
}
```

### PUT /api/users/:id
Actualizar el perfil del usuario autenticado.

**Autenticación**: Requiere token JWT

**Request Body**:
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "biography": "Nueva biografía del usuario",
  "imageUrl": "https://cdn.ejemplo.com/uploads/new_avatar.jpg"
}
```

**Response (200 OK)**:
```json
{
  "id": 1,
  "email": "usuario@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "biography": "Nueva biografía del usuario",
  "imageUrl": "https://cdn.ejemplo.com/uploads/new_avatar.jpg",
  "createdAt": "2026-02-16T12:00:00.000Z",
  "updatedAt": "2026-02-16T12:47:00.000Z"
}
```

## Uso

### Obtener perfil
```javascript
const response = await fetch('/api/users/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  }
});

const user = await response.json();
```

### Actualizar perfil
```javascript
const profileData = {
  firstName: 'Juan',
  lastName: 'Pérez',
  biography: 'Nueva biografía',
  imageUrl: 'https://cdn.ejemplo.com/uploads/avatar.jpg'
};

// Obtener el ID del usuario del token o de /api/users/me
const userId = 1; // Reemplazar con el ID real del usuario

const response = await fetch(`/api/users/${userId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(profileData)
});

const user = await response.json();
```

## Campos actualizables

- **firstName**: Nombre del usuario
- **lastName**: Apellido del usuario  
- **biography**: Biografía o descripción personal
- **imageUrl**: URL de la imagen de perfil (obtenida del servicio de upload)

## Errores comunes

- **401 Unauthorized**: Usuario no autenticado o token inválido
- **400 Bad Request**: Datos inválidos en la petición
- **403 Forbidden**: No tienes permisos para actualizar este usuario
- **404 Not Found**: Usuario no encontrado

## Integración con Image Upload

Para actualizar la imagen de perfil:

1. Primero sube la imagen usando el servicio de upload:
```javascript
const formData = new FormData();
formData.append('file', imageFile);

const uploadResponse = await fetch('/api/image-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwt}`
  },
  body: formData
});

const { url } = await uploadResponse.json();
```

2. Luego actualiza el perfil con la URL de la imagen:
```javascript
// Primero obtén tu ID de usuario
const meResponse = await fetch('/api/users/me', {
  headers: {
    'Authorization': `Bearer ${jwt}`
  }
});
const { id } = await meResponse.json();

// Actualiza el perfil
const profileResponse = await fetch(`/api/users/${id}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageUrl: url
  })
});
```

## Configuración de permisos

Asegúrate de que en el panel de administración:
1. Ve a Settings → USERS & PERMISSIONS → Roles
2. Selecciona el rol "Authenticated"
3. Activa los permisos para "User" → "findme" y "update"
