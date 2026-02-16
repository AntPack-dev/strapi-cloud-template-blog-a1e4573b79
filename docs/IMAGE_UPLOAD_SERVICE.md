# Image Upload Service

## Descripción

Servicio personalizado para subir imágenes que valida formatos y utiliza S3 como almacenamiento.

## Endpoint

**POST** `/api/image-upload`

## Autenticación

Este servicio requiere autenticación. Solo usuarios autenticados pueden utilizarlo.

## Formatos permitidos

- JPG
- JPEG  
- PNG

## Límites

- Tamaño máximo: 5MB por archivo

## Uso

### Request (multipart/form-data)

```javascript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('/api/image-upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

### Response (200 OK)

```json
{
  "success": true,
  "url": "https://cdn.ejemplo.com/uploads/uuid-nombre.jpg",
  "fileName": "uuid-nombre.jpg",
  "size": 1024000,
  "type": "image/jpeg"
}
```

### Response (400 Bad Request)

```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Tipo de archivo no permitido. Solo se permiten JPG, JPEG y PNG"
  }
}
```

## Errores comunes

- **400**: No se encontró archivo para subir
- **400**: Tipo de archivo no permitido
- **400**: Archivo demasiado grande (más de 5MB)
- **500**: Error interno al subir la imagen

## Configuración

El servicio utiliza la configuración existente de AWS S3 en `config/plugins.js`. Asegúrate de tener configuradas las siguientes variables de entorno:

```
AWS_ACCESS_KEY_ID=tu_access_key
AWS_ACCESS_SECRET=tu_secret_key
AWS_REGION=us-east-1
AWS_BUCKET=tu_bucket
RESOURCES_CDN=tu_cdn_url
```
