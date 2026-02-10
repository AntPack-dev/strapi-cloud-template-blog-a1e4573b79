# 🚨 OAuth Troubleshooting Guide

## Problema: "This provider is disabled"

Si recibes este error al intentar acceder a `/api/connect/google` o `/api/connect/facebook`, significa que el provider de OAuth no está configurado correctamente.

## 🔧 Soluciones

### 1. **Verificar Variables de Entorno**

Asegúrate de que las siguientes variables estén configuradas en tu servidor:

```bash
# Para Google OAuth
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Para Facebook OAuth  
FACEBOOK_APP_ID=tu_facebook_app_id
FACEBOOK_APP_SECRET=tu_facebook_app_secret
```

### 2. **Verificar Configuración en plugins.js**

La configuración en `config/plugins.js` debe incluir los providers:

```javascript
auth: {
  providers: [
    {
      uid: 'google',
      displayName: 'Google',
      createStrategy: (strapi) => new GoogleStrategy({
        clientID: env('GOOGLE_CLIENT_ID'),
        clientSecret: env('GOOGLE_CLIENT_SECRET'),
        // ... resto de configuración
      })
    },
    {
      uid: 'facebook', 
      displayName: 'Facebook',
      createStrategy: (strapi) => new FacebookStrategy({
        clientID: env('FACEBOOK_APP_ID'),
        clientSecret: env('FACEBOOK_APP_SECRET'),
        // ... resto de configuración
      })
    }
  ]
}
```

### 3. **Verificar Callback URLs**

Asegúrate de que las callback URLs estén configuradas correctamente en tus aplicaciones OAuth:

#### **Google Console:**
- Authorized redirect URIs: `https://apiqa.latilde.co/api/users-permissions/multi-provider/callback/google`

#### **Facebook Developers:**
- Valid OAuth Redirect URIs: `https://apiqa.latilde.co/api/users-permissions/multi-provider/callback/facebook`

### 4. **Reiniciar Servidor**

Después de configurar las variables de entorno, reinicia el servidor:

```bash
npm run develop
# o en producción
npm run start
```

### 5. **Verificar Logs del Servidor**

Revisa los logs del servidor para ver si hay errores de configuración:

```bash
# Ver logs de Strapi
npm run develop -- --verbose
```

### 6. **Probar Configuración**

Puedes probar si las variables están cargadas correctamente:

```javascript
// En cualquier controller
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('Facebook App ID:', process.env.FACEBOOK_APP_ID);
```

## 🚀 Rutas Disponibles

Una vez configurado correctamente, estas rutas estarán disponibles:

| Ruta | Método | Función |
|------|--------|---------|
| `/api/connect/google` | GET | Redirige a Google OAuth |
| `/api/connect/facebook` | GET | Redirige a Facebook OAuth |
| `/api/users-permissions/multi-provider/callback/google` | POST | Callback de Google |
| `/api/users-permissions/multi-provider/callback/facebook` | POST | Callback de Facebook |

## 📱 Flujo Completo

1. **Frontend:** `window.location.href = '/api/connect/google'`
2. **Backend:** Redirige a Google OAuth
3. **Usuario:** Autentica con Google
4. **Google:** Redirige a nuestro callback
5. **Backend:** Procesa callback y crea/actualiza usuario
6. **Frontend:** Recibe JWT en header y datos del usuario

## 🔍 Debugging

### Verificar si el provider está habilitado:

```bash
curl -X GET https://apiqa.latilde.co/api/connect/google
```

Si devuelve "This provider is disabled", las variables de entorno no están configuradas.

### Verificar configuración de OAuth:

```javascript
// En un controller temporal
async testConfig(ctx) {
  const config = strapi.config.get('plugin.users-permissions');
  return ctx.send({ oauthConfig: config.auth?.providers });
}
```

## 🆘 Si el problema persiste

1. **Verifica que las variables de entorno estén en el archivo `.env` del servidor**
2. **Asegúrate de que el servidor se reinició después de configurar las variables**
3. **Verifica que las credenciales de OAuth sean correctas**
4. **Confirma que las callback URLs coincidan exactamente**

## 📝 Checklist de Configuración

- [ ] Variables de entorno configuradas
- [ ] Callback URLs configuradas en OAuth providers
- [ ] Servidor reiniciado
- [ ] Credenciales correctas
- [ ] URLs coincidentes (http vs https)
- [ ] Dominios autorizados en OAuth providers
