# OAuth Authentication Setup Summary

## Descripción

Configuración completa para autenticación OAuth con Google y Facebook en Strapi. Ambos proveedores funcionan de manera similar, permitiendo registro, login y vinculación de cuentas.

## Proveedores Soportados

### ✅ Google OAuth
- **Redirección**: `GET /api/auth/google/redirect`
- **Callback**: `POST /api/auth/google/callback`
- **Documentación**: Ver `GOOGLE_OAUTH_SETUP.md`

### ✅ Facebook OAuth  
- **Redirección**: `GET /api/auth/facebook/redirect`
- **Callback**: `POST /api/auth/facebook/callback`
- **Documentación**: Ver `FACEBOOK_OAUTH_SETUP.md`

## Configuración Rápida

### 1. Variables de Entorno

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_FRONT_REDIRECT=http://localhost:4060/en/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_FRONT_REDIRECT=http://localhost:4060/en/auth/facebook/callback
```

### 2. Endpoints Principales

#### Redirección a Proveedor
```javascript
// Google
window.location.href = '/api/auth/google/redirect';

// Facebook
window.location.href = '/api/auth/facebook/redirect';
```

#### Callback con Access Token
```javascript
// Google
const response = await fetch('/api/auth/google/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ access_token: googleToken })
});

// Facebook
const response = await fetch('/api/auth/facebook/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ access_token: facebookToken })
});
```

## Flujo de Autenticación

### 1. Registro Nuevo Usuario
- **localIntegration**: `false` (usuarios OAuth)
- **providers**: `["google"]` o `["facebook"]`
- **imageUrl**: Foto de perfil del proveedor

### 2. Usuario Existente
- Si ya tiene el proveedor: Login directo
- Si no tiene el proveedor: Vincula a cuenta existente

### 3. Múltiples Proveedores
- Un usuario puede tener ambos: `["google", "facebook"]`
- `localIntegration` permanece `false`

## Endpoints de Gestión

### Obtener Proveedores del Usuario
```javascript
GET /api/multi-provider/providers
// Response: { providers: ["google"], providersData: {...} }
```

### Eliminar Proveedor
```javascript
DELETE /api/multi-provider/providers/google
DELETE /api/multi-provider/providers/facebook
```

### Actualizar Imagen de Perfil
```javascript
POST /api/multi-provider/update-profile-image
// Body: { provider: "google" }
```

### Debug de Configuración
```javascript
GET /api/auth/google/debug
GET /api/auth/facebook/debug
```

## Campos Mapeados

### Google → Usuario
| Google | Usuario |
|--------|---------|
| `email` | `email` |
| `given_name` | `firstName` |
| `family_name` | `lastName` |
| `picture` | `imageUrl` |
| `id` | `providerId` |

### Facebook → Usuario
| Facebook | Usuario |
|----------|---------|
| `email` | `email` |
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `picture.data.url` | `imageUrl` |
| `id` | `providerId` |

## Seguridad

### 1. Configuración de Dominios
- **Google Console**: Agregar dominios autorizados
- **Facebook Developers**: Configurar App Domains y Redirect URIs

### 2. HTTPS en Producción
- Todas las URLs deben usar HTTPS
- Actualizar redirect URIs en ambos proveedores

### 3. Manejo de Tokens
- Access tokens de proveedores tienen validez limitada
- JWT de Strapi para sesión del usuario
- Almacenamiento seguro de tokens

## Errores Comunes

### Configuración Incompleta
```
"Provider not configured: Missing GOOGLE_CLIENT_ID"
"Provider not configured: Missing FACEBOOK_APP_ID"
```
**Solución**: Configurar variables de entorno

### Token Inválido
```
"Unable to get user profile from OAuth provider"
```
**Solución**: Verificar token y permisos

### Dominio No Autorizado
```
"redirect_uri_mismatch"
```
**Solución**: Configurar redirect URIs en proveedor

## Testing

### 1. Ambiente de Desarrollo
- URLs: `http://localhost:4060`
- Callbacks: `/en/auth/{provider}/callback`

### 2. Ambiente de Producción
- URLs: `https://tudominio.com`
- Callbacks: `/en/auth/{provider}/callback`

### 3. Usuarios de Prueba
- Google: Usar cuentas de prueba
- Facebook: Crear test users en Facebook Developers

## Integración Frontend

### Botones de Login
```javascript
function loginWithGoogle() {
  window.location.href = '/api/auth/google/redirect';
}

function loginWithFacebook() {
  window.location.href = '/api/auth/facebook/redirect';
}
```

### Manejo de Callback
```javascript
// En página de callback
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const error = urlParams.get('error');

if (error) {
  console.error('Error:', error);
} else if (code) {
  // Backend procesa automáticamente
  window.location.href = '/dashboard';
}
```

### Login con SDK
```javascript
// Google SDK
const googleToken = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;

// Facebook SDK  
const facebookToken = FB.getAuthResponse().accessToken;

// Enviar a backend
const response = await fetch(`/api/auth/${provider}/callback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ access_token: token })
});
```

## Documentación Adicional

- **Google OAuth**: `docs/GOOGLE_OAUTH_SETUP.md`
- **Facebook OAuth**: `docs/FACEBOOK_OAUTH_SETUP.md`
- **Image Upload**: `docs/IMAGE_UPLOAD_SERVICE.md`
- **User Profile**: `docs/USER_PROFILE_SERVICE.md`

## Soporte

Para problemas con OAuth:

1. Verificar configuración en proveedores (Google Console, Facebook Developers)
2. Revisar variables de entorno
3. Usar endpoints de debug
4. Verificar logs del servidor
5. Configurar dominios y redirect URIs correctamente
