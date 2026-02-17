# Facebook OAuth Authentication Setup

## Descripción

Guía completa para configurar y usar la autenticación con Facebook en tu aplicación Strapi. El sistema soporta registro, login y vinculación de cuentas de Facebook.

## Configuración

### 1. Crear App en Facebook Developers

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Crea una nueva aplicación o selecciona una existente
3. Agrega el producto "Facebook Login"
4. Configura los dominios autorizados:
   - Desarrollo: `http://localhost:4060`
   - Producción: `https://tudominio.com`

### 2. Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```bash
# Facebook OAuth
FACEBOOK_APP_ID=tu_facebook_app_id
FACEBOOK_APP_SECRET=tu_facebook_app_secret
FACEBOOK_FRONT_REDIRECT=http://localhost:4060/en/auth/facebook/callback
```

### 3. Configuración de la App en Facebook

En tu dashboard de Facebook Developers:

**Settings → Basic**:
- App ID: `FACEBOOK_APP_ID`
- App Secret: `FACEBOOK_APP_SECRET`

**Facebook Login → Settings**:
- Valid OAuth Redirect URIs:
  - `http://localhost:4060/en/auth/facebook/callback` (desarrollo)
  - `https://tudominio.com/en/auth/facebook/callback` (producción)

**App Domains**:
- `localhost:4060` (desarrollo)
- `tudominio.com` (producción)

## Endpoints API

### 1. Redirección a Facebook

**GET** `/api/auth/facebook/redirect`

Redirige al usuario a Facebook para iniciar sesión.

```javascript
// Frontend
window.location.href = '/api/auth/facebook/redirect';
```

### 2. Callback de Facebook

**GET** `/api/auth/facebook/callback`

Endpoint que recibe el callback de Facebook después de la autenticación.

```javascript
// Este endpoint es llamado automáticamente por Facebook
// No necesita ser consumido directamente desde el frontend
```

### 3. Login con Access Token

**POST** `/api/auth/facebook/callback`

Usa un access token de Facebook para autenticar al usuario.

**Request Body**:
```json
{
  "access_token": "EAAD...",
  "notificationActive": true
}
```

**Response (200 OK)**:
```json
{
  "user": {
    "id": 1,
    "username": "usuario_1640000000000",
    "email": "usuario@facebook.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "providers": ["facebook"]
  }
}
```

**Headers**:
- `Authorization: Bearer {jwt}` - Token JWT generado automáticamente

## Flujo de Autenticación

### Registro Nuevo Usuario

1. **Usuario no existe**: Se crea nueva cuenta con datos de Facebook
2. **localIntegration**: `false` (usuarios OAuth)
3. **providers**: `["facebook"]`
4. **imageUrl**: Foto de perfil de Facebook

### Usuario Existente

1. **Usuario ya tiene Facebook**: Inicia sesión directamente
2. **Usuario existe pero sin Facebook**: Vincula Facebook a cuenta existente

## Uso en Frontend

### 1. Botón de Login con Facebook

```javascript
async function loginWithFacebook() {
  try {
    // Redirigir a Facebook
    window.location.href = '/api/auth/facebook/redirect';
  } catch (error) {
    console.error('Error en login con Facebook:', error);
  }
}
```

### 2. Manejar el Callback

```javascript
// En tu página de callback
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  
  if (error) {
    console.error('Error de Facebook:', error);
    return;
  }
  
  if (code) {
    // El backend manejará el código automáticamente
    // Redirige al usuario al dashboard o página principal
    window.location.href = '/dashboard';
  }
}, []);
```

### 3. Login Directo con Token (SDK de Facebook)

```javascript
async function loginWithFacebookToken() {
  try {
    // Obtener token del SDK de Facebook
    const response = await FB.login();
    const accessToken = response.authResponse.accessToken;
    
    // Enviar token al backend
    const authResponse = await fetch('/api/auth/facebook/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: accessToken,
        notificationActive: true
      })
    });
    
    const data = await authResponse.json();
    
    // Guardar JWT y redirigir
    localStorage.setItem('jwt', data.jwt);
    window.location.href = '/dashboard';
    
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Permisos de Facebook

La aplicación solicita los siguientes permisos:

- **email**: Acceso al email del usuario
- **public_profile**: Acceso al perfil público (nombre, foto)

## Campos Mapeados

| Campo Facebook | Campo Usuario | Descripción |
|----------------|---------------|-------------|
| `email` | `email` | Email del usuario |
| `first_name` | `firstName` | Nombre |
| `last_name` | `lastName` | Apellido |
| `picture.data.url` | `imageUrl` | URL de la foto de perfil |
| `id` | `providerId` | ID del usuario en Facebook |

## Manejo de Errores

### Errores Comunes

**400 Bad Request - Provider not configured**:
```json
{
  "error": "Facebook OAuth not configured: Missing FACEBOOK_APP_ID"
}
```
**Solución**: Configura las variables de entorno `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET`.

**400 Bad Request - Access token required**:
```json
{
  "error": "Access token is required"
}
```
**Solución**: Asegúrate de enviar el `access_token` en el body.

**401 Unauthorized - Invalid credentials**:
```json
{
  "error": "Unable to get user profile from OAuth provider"
}
```
**Solución**: El access token es inválido o ha expirado.

### Debug Mode

Usa el endpoint de debug para verificar configuración:

```javascript
// GET /api/auth/facebook/debug
const response = await fetch('/api/auth/facebook/debug');
const config = await response.json();

console.log('Configuración Facebook:', config);
```

## Seguridad

### 1. HTTPS en Producción

En producción, todas las URLs deben usar HTTPS:
- `https://tudominio.com/api/auth/facebook/redirect`
- `https://tudominio.com/api/auth/facebook/callback`

### 2. Validación de Dominios

Asegúrate de que tu dominio esté configurado en:
- Facebook Developers → App Domains
- Valid OAuth Redirect URIs

### 3. Manejo de Tokens

- Los access tokens de Facebook tienen validez limitada
- Los JWT de Strapi deben manejarse de forma segura
- Usa cookies seguras o almacenamiento local encriptado

## Testing

### 1. Ambiente de Desarrollo

Usa las URLs de desarrollo:
- Redirect URI: `http://localhost:4060/en/auth/facebook/callback`
- App Domain: `localhost:4060`

### 2. Ambiente de Producción

Actualiza las URLs de producción:
- Redirect URI: `https://tudominio.com/en/auth/facebook/callback`
- App Domain: `tudominio.com`

### 3. Pruebas con Usuarios de Prueba

Facebook permite crear usuarios de prueba para no afectar datos reales:
1. Ve a Facebook Developers → Roles → Test Users
2. Crea usuarios de prueba
3. Usa estos usuarios para probar el flujo completo

## Integración con Google

Facebook OAuth funciona junto con Google OAuth:

- Un usuario puede tener ambos proveedores vinculados
- El campo `providers` muestra todos los proveedores conectados
- `localIntegration` permanece `false` para usuarios OAuth

## Soporte

Para problemas con Facebook OAuth:

1. Verifica la configuración en Facebook Developers
2. Revisa las variables de entorno
3. Usa el endpoint de debug
4. Verifica los logs del servidor
5. Asegúrate de que los dominios estén configurados correctamente
