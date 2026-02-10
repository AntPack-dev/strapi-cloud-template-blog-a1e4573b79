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
      // Obtener JWT del header
      const authHeader = response.headers.get('Authorization');
      const jwt = authHeader ? authHeader.replace('Bearer ', '') : null;
      
      if (jwt) {
        // Guardar el JWT en localStorage
        localStorage.setItem('jwt', jwt);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('Usuario logueado:', data.user);
        return { success: true, user: data.user, jwt: jwt };
      } else {
        console.error('JWT no encontrado en headers');
        return { success: false, error: 'JWT no encontrado' };
      }
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
      console.log('JWT guardado:', result.jwt);
      // Redirigir al usuario o actualizar UI
    } else {
      console.log('Error:', result.error);
    }
  });
```

### **Respuesta del Login**

La respuesta del login incluye el campo `provider` que indica el método de registro:

```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "provider": "local",        // "local", "google", o "facebook"
    "imageUrl": "https://example.com/profile.jpg",
    "biography": "Desarrollador apasionado",
    "statusProfile": "active",
    "confirmed": true,
    "blocked": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Importante**: El campo `provider` siempre viene en la respuesta del login, permitiendo identificar si el usuario se registró con:
- **Email y contraseña** (`"local"`)
- **Google OAuth** (`"google"`)  
- **Facebook OAuth** (`"facebook"`)

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

## 🌐 4. Autenticación Social (Google y Facebook)

### **Registro con Google**

```javascript
// auth/google.js
import API_URL from './config';

// Redirigir al usuario a Google para autenticación
function loginWithGoogle() {
  window.location.href = `${API_URL}/api/connect/google`;
}

// Después de la autenticación, Google redirigirá al usuario a tu callback URL
// El usuario llegará con el token JWT en la URL
```

### **Registro con Facebook**

```javascript
// auth/facebook.js
import API_URL from './config';

// Redirigir al usuario a Facebook para autenticación
function loginWithFacebook() {
  window.location.href = `${API_URL}/api/connect/facebook`;
}

// Después de la autenticación, Facebook redirigirá al usuario a tu callback URL
// El usuario llegará con el token JWT en la URL
```

### **Manejar el Callback de Autenticación Social**

```javascript
// auth/socialCallback.js
import API_URL from './config';

// Esta función se ejecuta cuando el usuario regresa de Google/Facebook
function handleSocialCallback() {
  // Obtener el JWT de los parámetros de la URL (para compatibilidad)
  const urlParams = new URLSearchParams(window.location.search);
  const urlJwt = urlParams.get('jwt');
  
  if (urlJwt) {
    // Guardar el JWT y los datos del usuario (método antiguo)
    localStorage.setItem('jwt', urlJwt);
    
    // Obtener los datos del usuario usando el JWT
    fetch(`${API_URL}/api/users/me`, {
      headers: {
        'Authorization': `Bearer ${urlJwt}`,
      },
    })
    .then(response => response.json())
    .then(userData => {
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('Usuario autenticado con redes sociales:', userData);
      
      // Redirigir al dashboard o página principal
      window.location.href = '/dashboard';
    })
    .catch(error => {
      console.error('Error al obtener datos del usuario:', error);
    });
  } else {
    // Nuevo método: obtener JWT de headers de la respuesta del callback
    // Esto se maneja automáticamente por el backend
    console.log('Autenticación social procesada por el backend');
    
    // Redirigir al dashboard o página principal
    window.location.href = '/dashboard';
  }
}

// Ejecutar esta función en tu página de callback
handleSocialCallback();
```

### **Respuesta del Login Social**

Cuando un usuario se autentica con Google o Facebook, la respuesta del endpoint `/api/users/me` también incluye el campo `provider`:

```json
{
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "provider": "google",       // "google" para login con Google
    "imageUrl": "https://lh3.googleusercontent.com/photo.jpg",
    "biography": null,
    "statusProfile": "active",
    "confirmed": true,
    "blocked": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Ejemplo con Facebook:**
```json
{
  "data": {
    "id": 2,
    "username": "jane_doe",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "provider": "facebook",     // "facebook" para login con Facebook
    "imageUrl": "https://graph.facebook.com/photo.jpg",
    "biography": null,
    "statusProfile": "active",
    "confirmed": true,
    "blocked": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Importante**: Tanto en el login local como en el login social, el campo `provider` siempre está presente y permite identificar el método de autenticación utilizado.

### **Verificar Provider Después del Login**

```javascript
// auth/checkLoginProvider.js
import API_URL from './config';

// Función para verificar el método de registro después del login
function checkLoginProvider() {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (user) {
    const provider = user.provider;
    console.log(`Usuario registrado con: ${provider}`);
    
    // Mostrar不同的 UI basado en el provider
    switch(provider) {
      case 'local':
        console.log('Mostrar opciones para cambio de contraseña');
        break;
      case 'google':
        console.log('Mostrar badge de Google, ocultar opción de cambio de contraseña');
        break;
      case 'facebook':
        console.log('Mostrar badge de Facebook, ocultar opción de cambio de contraseña');
        break;
    }
    
    return provider;
  }
  
  return null;
}

// Usar después del login
loginUser('john@example.com', 'Password123!')
  .then(result => {
    if (result.success) {
      const provider = checkLoginProvider();
      console.log(`Login exitoso con provider: ${provider}`);
    }
  });
```

### **Botones de Autenticación Social**

```javascript
// components/SocialAuthButtons.js
export function SocialAuthButtons() {
  return (
    <div className="social-auth-container">
      <button 
        onClick={loginWithGoogle}
        className="google-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: 'white',
          cursor: 'pointer'
        }}
      >
        <img 
          src="https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Google-512.png" 
          alt="Google" 
          width="20"
          height="20"
        />
        Continuar con Google
      </button>
      
      <button 
        onClick={loginWithFacebook}
        className="facebook-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: '#4267B2',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        <img 
          src="https://cdn2.iconfinder.com/data/icons/social-icons-33/128/Facebook-512.png" 
          alt="Facebook" 
          width="20"
          height="20"
        />
        Continuar con Facebook
      </button>
    </div>
  );
}
```

### **Datos del Usuario con Perfil Completo**

Los usuarios ahora incluyen campos adicionales para biografía y estado del perfil:

```javascript
// Ejemplo de respuesta de usuario con perfil completo
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "provider": "local", // "local", "google", o "facebook"
  "imageUrl": "https://example.com/profile.jpg",
  "biography": "Desarrollador apasionado por el código limpio",
  "statusProfile": "active", // "active", "inactive", "deactivated"
  "confirmed": true,
  "blocked": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### **Campo Provider - Método de Registro**

El campo `provider` indica cómo se registró el usuario originalmente. Con el nuevo sistema de múltiples providers, los usuarios pueden tener varios métodos de autenticación asociados:

```javascript
// Valores posibles del campo provider (método principal)
"provider": "local"      // Registro original con email y contraseña
"provider": "google"     // Registro original con Google OAuth
"provider": "facebook"   // Registro original con Facebook OAuth

// Nuevo campo providers (todos los métodos conectados)
"providers": {
  "local": true,                    // Si tiene contraseña
  "google": {                        // Si conectó Google
    "providerId": "123456789",
    "connectedAt": "2024-01-15T10:30:00.000Z",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "imageUrl": "https://lh3.googleusercontent.com/photo.jpg"
    }
  },
  "facebook": {                      // Si conectó Facebook
    "providerId": "987654321",
    "connectedAt": "2024-01-16T14:20:00.000Z",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "imageUrl": "https://graph.facebook.com/photo.jpg"
    }
  }
}
```

#### **Ejemplo de Usuario con Múltiples Providers (Respuesta Pública)**

```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "provider": "local",              // Método original de registro
  "providers": [                   // ← Array simple sin datos sensibles
    "local",
    "google", 
    "facebook"
  ],
  "imageUrl": "https://example.com/profile.jpg",
  "biography": "Desarrollador apasionado",
  "statusProfile": "active",
  "confirmed": true,
  "blocked": false,
  "createdAt": "2024-01-10T08:00:00.000Z",
  "updatedAt": "2024-01-16T14:20:00.000Z"
}
```

#### **Respuesta del Login y Registro**

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Body:**
```json
{
  "user": {
    "id": 4,
    "username": "custom_avatar_user",
    "email": "custom@example.com",
    "firstName": "Custom",
    "lastName": "Avatar",
    "providers": [
      "local",
      "google",
      "facebook"
    ]
  }
}
```

**Importante:** 
- El JWT viene en el header `Authorization`
- La respuesta contiene solo los campos básicos del usuario
- `providers` es un array simple con los nombres de los providers conectados

#### **Endpoint getUserInfo (Datos Completos)**

```javascript
// users/getUserInfo.js
import API_URL from './config';

async function getUserInfo() {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users-permissions/multi-provider/user-info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Información completa del usuario:', data.user);
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### **Respuesta de getUserInfo (Datos Completos con IDs)**

```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "provider": "local",
    "providers": {                    // ← Objeto completo con datos sensibles
      "local": true,
      "google": {
        "providerId": "123456789",
        "connectedAt": "2024-01-15T10:30:00.000Z",
        "profile": {
          "firstName": "John",
          "lastName": "Doe",
          "imageUrl": "https://lh3.googleusercontent.com/photo.jpg"
        }
      },
      "facebook": {
        "providerId": "987654321",
        "connectedAt": "2024-01-16T14:20:00.000Z",
        "profile": {
          "firstName": "John",
          "lastName": "Doe",
          "imageUrl": "https://graph.facebook.com/photo.jpg"
        }
      }
    },
    "imageUrl": "https://example.com/profile.jpg",
    "biography": "Desarrollador apasionado",
    "statusProfile": "active",
    "confirmed": true,
    "blocked": false,
    "role": {
      "id": 1,
      "name": "Authenticated",
      "type": "authenticated"
    },
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-16T14:20:00.000Z"
  }
}
```

#### **Obtener Todos los Providers del Usuario**

```javascript
// users/getAllProviders.js
import API_URL from './config';

async function getUserProviders() {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users-permissions/multi-provider/providers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Providers del usuario:', data);
      return { 
        success: true, 
        providers: data.providers,
        providersData: data.providersData
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### **Desconectar un Provider**

```javascript
// users/disconnectProvider.js
import API_URL from './config';

async function disconnectProvider(providerName) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users-permissions/multi-provider/providers/${providerName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`Provider ${providerName} desconectado:`, data);
      return { success: true, message: data.message, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### **Componente React para Gestión de Providers**

```javascript
// components/ProviderManager.js
import React, { useState, useEffect } from 'react';

export function ProviderManager() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    const result = await getUserProviders();
    if (result.success) {
      setProviders(result.providers);
    }
  };

  const handleDisconnect = async (provider) => {
    setLoading(true);
    const result = await disconnectProvider(provider);
    if (result.success) {
      await loadProviders(); // Recargar providers
      alert('Provider desconectado exitosamente');
    } else {
      alert('Error al desconectar provider: ' + result.error);
    }
    setLoading(false);
  };

  const getProviderIcon = (provider) => {
    switch(provider) {
      case 'local': return '📧';
      case 'google': return '🔍';
      case 'facebook': return '📘';
      default: return '❓';
    }
  };

  const getProviderName = (provider) => {
    switch(provider) {
      case 'local': return 'Email y Contraseña';
      case 'google': return 'Google';
      case 'facebook': return 'Facebook';
      default: return 'Desconocido';
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Métodos de Autenticación Conectados</h3>
      
      {providers.map(provider => (
        <div
          key={provider}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            margin: '8px 0',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>{getProviderIcon(provider)}</span>
            <span>{getProviderName(provider)}</span>
          </div>
          
          {provider !== 'local' && providers.length > 1 && (
            <button
              onClick={() => handleDisconnect(provider)}
              disabled={loading}
              style={{
                padding: '6px 12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Procesando...' : 'Desconectar'}
            </button>
          )}
        </div>
      ))}
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>• Puedes conectar múltiples métodos de autenticación</p>
        <p>• Debes mantener al menos un método conectado</p>
        <p>• El método local no se puede desconectar si tienes contraseña</p>
      </div>
    </div>
  );
}
```

#### **Actualizar Imagen de Perfil desde Provider**

```javascript
// users/updateProfileImage.js
import API_URL from './config';

async function updateProfileImageFromProvider(provider) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users-permissions/multi-provider/update-profile-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        provider: provider // 'google' o 'facebook'
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Imagen de perfil actualizada:', data.user);
      return { 
        success: true, 
        message: data.message,
        user: data.user
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### **Componente React para Gestión de Imagen de Perfil**

```javascript
// components/ProfileImageManager.js
import React, { useState, useEffect } from 'react';

export function ProfileImageManager({ user, onUserUpdate }) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    const result = await getUserProviders();
    if (result.success) {
      setProviders(result.providersData);
    }
  };

  const updateImageFromProvider = async (provider) => {
    setLoading(true);
    const result = await updateProfileImageFromProvider(provider);
    if (result.success) {
      onUserUpdate(result.user); // Actualizar usuario en el componente padre
      alert('Imagen de perfil actualizada exitosamente');
    } else {
      alert('Error al actualizar imagen: ' + result.error);
    }
    setLoading(false);
  };

  const getProviderIcon = (provider) => {
    switch(provider) {
      case 'google': return '🔍';
      case 'facebook': return '📘';
      default: return '❓';
    }
  };

  const getProviderName = (provider) => {
    switch(provider) {
      case 'google': return 'Google';
      case 'facebook': return 'Facebook';
      default: return 'Desconocido';
    }
  };

  const isProviderImage = (imageUrl) => {
    return imageUrl && (
      imageUrl.includes('googleusercontent.com') || 
      imageUrl.includes('graph.facebook.com')
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h3>Gestión de Imagen de Perfil</h3>
      
      {/* Imagen actual */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Imagen Actual:</h4>
        {user.imageUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src={user.imageUrl} 
              alt="Profile" 
              style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <div>
              <p style={{ margin: 0 }}>
                {isProviderImage(user.imageUrl) ? 'Imagen de red social' : 'Imagen personalizada'}
              </p>
              <small style={{ color: '#666' }}>
                {user.imageUrl}
              </small>
            </div>
          </div>
        ) : (
          <p>Sin imagen de perfil</p>
        )}
      </div>

      {/* Opciones de actualización */}
      <div>
        <h4>Actualizar imagen desde:</h4>
        {Object.entries(providers)
          .filter(([key, value]) => key !== 'local' && value.profile?.imageUrl)
          .map(([provider, data]) => (
            <div
              key={provider}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                margin: '8px 0',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>{getProviderIcon(provider)}</span>
                <div>
                  <div>{getProviderName(provider)}</div>
                  <small style={{ color: '#666' }}>
                    Conectado el {new Date(data.connectedAt).toLocaleDateString()}
                  </small>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {data.profile.imageUrl && (
                  <img 
                    src={data.profile.imageUrl} 
                    alt={`${provider} profile`}
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%',
                      objectFit: 'cover'
                    }}
                  />
                )}
                <button
                  onClick={() => updateImageFromProvider(provider)}
                  disabled={loading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Actualizando...' : 'Usar esta imagen'}
                </button>
              </div>
            </div>
          ))}
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>• Puedes actualizar tu imagen de perfil usando la de tus redes sociales</p>
        <p>• Si tienes una imagen personalizada, no será reemplazada automáticamente</p>
        <p>• La imagen se actualizará inmediatamente en todo tu perfil</p>
      </div>
    </div>
  );
}
```

#### **Verificar Método de Registro**

```javascript
// users/checkProvider.js
import API_URL from './config';

async function getUserProvider(userId) {
  const jwt = localStorage.getItem('jwt');

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      const provider = data.data.provider;
      console.log(`Método de registro: ${provider}`);
      
      // Ejemplo de lógica basada en el provider
      switch(provider) {
        case 'local':
          console.log('Usuario registrado con email y contraseña');
          break;
        case 'google':
          console.log('Usuario registrado con Google');
          break;
        case 'facebook':
          console.log('Usuario registrado con Facebook');
          break;
        default:
          console.log('Método de registro desconocido');
      }
      
      return { success: true, provider };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### **Componente React para Mostrar Método de Registro**

```javascript
// components/UserProviderBadge.js
import React from 'react';

export function UserProviderBadge({ provider }) {
  const getProviderInfo = (provider) => {
    switch(provider) {
      case 'local':
        return {
          text: 'Email',
          icon: '📧',
          color: '#007bff',
          bgColor: '#e7f3ff'
        };
      case 'google':
        return {
          text: 'Google',
          icon: '🔍',
          color: '#4285f4',
          bgColor: '#f8f9fa'
        };
      case 'facebook':
        return {
          text: 'Facebook',
          icon: '📘',
          color: '#1877f2',
          bgColor: '#e7f3ff'
        };
      default:
        return {
          text: 'Desconocido',
          icon: '❓',
          color: '#6c757d',
          bgColor: '#f8f9fa'
        };
    }
  };

  const providerInfo = getProviderInfo(provider);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        backgroundColor: providerInfo.bgColor,
        color: providerInfo.color,
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: '500',
        border: `1px solid ${providerInfo.color}20`
      }}
    >
      <span style={{ fontSize: '14px' }}>{providerInfo.icon}</span>
      <span>{providerInfo.text}</span>
    </div>
  );
}

// Uso en el perfil del usuario
function UserProfile({ user }) {
  return (
    <div>
      <h2>{user.firstName} {user.lastName}</h2>
      <p>Email: {user.email}</p>
      <UserProviderBadge provider={user.provider} />
    </div>
  );
}
```

### **Actualizar Perfil de Usuario**

```javascript
// users/updateProfile.js
import API_URL from './config';

async function updateProfile(userId, profileData) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        data: profileData, // { firstName, lastName, biography, imageUrl, etc. }
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Perfil actualizado:', data.data);
      return { success: true, user: data.data };
    } else {
      console.error('Error al actualizar perfil:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
updateProfile(1, {
  firstName: 'John',
  lastName: 'Doe',
  biography: 'Soy un desarrollador apasionado por las nuevas tecnologías.',
  imageUrl: 'https://example.com/new-avatar.jpg'
})
  .then(result => {
    if (result.success) {
      console.log('Perfil actualizado exitosamente');
      // Actualizar UI con nuevos datos
    }
  });
```

### **Desactivar Cuenta de Usuario**

```javascript
// users/deactivateAccount.js
import API_URL from './config';

async function deactivateAccount(userId) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        data: {
          statusProfile: 'deactivated'
        }
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Cuenta desactivada:', data.data);
      
      // Cerrar sesión automáticamente
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      
      return { success: true, message: 'Cuenta desactivada exitosamente' };
    } else {
      console.error('Error al desactivar cuenta:', data);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
deactivateAccount(1)
  .then(result => {
    if (result.success) {
      console.log('Cuenta desactivada');
      // Redirigir a página de despedida o login
      window.location.href = '/goodbye';
    }
  });
```

### **Componente de Perfil de Usuario Completo**

```javascript
// components/CompleteUserProfile.js
export function CompleteUserProfile({ user, onUpdate, onDeactivate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    biography: user.biography || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(user.id, formData);
    setIsEditing(false);
  };

  const handleDeactivate = () => {
    if (window.confirm('¿Estás seguro de que quieres desactivar tu cuenta? Esta acción puede ser reversible.')) {
      onDeactivate(user.id);
    }
  };

  return (
    <div className="user-profile-complete">
      <div className="profile-header">
        <div className="user-avatar">
          {user.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt={`${user.firstName} ${user.lastName}`}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div className="default-avatar" style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
          )}
        </div>
        
        <div className="user-info">
          <h2>{user.firstName} {user.lastName}</h2>
          <p>@{user.username}</p>
          <div className="user-status">
            <span className={`status-badge ${user.statusProfile}`}>
              {user.statusProfile === 'active' ? '✅ Activo' : 
               user.statusProfile === 'inactive' ? '⏸️ Inactivo' : 
               '❌ Desactivado'}
            </span>
          </div>
        </div>
      </div>

      <div className="profile-biography">
        {isEditing ? (
          <textarea
            value={formData.biography}
            onChange={(e) => setFormData({...formData, biography: e.target.value})}
            placeholder="Cuéntanos sobre ti..."
            rows={4}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              resize: 'vertical'
            }}
          />
        ) : (
          <p>{user.biography || 'Este usuario aún no ha agregado una biografía.'}</p>
        )}
      </div>

      <div className="profile-actions">
        {isEditing ? (
          <div className="edit-actions">
            <button 
              onClick={handleSubmit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Guardar
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="normal-actions">
            <button 
              onClick={() => setIsEditing(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Editar Perfil
            </button>
            
            {user.statusProfile !== 'deactivated' && (
              <button 
                onClick={handleDeactivate}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Desactivar Cuenta
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### **Mostrar Imagen de Perfil en la UI**

```javascript
// components/UserProfile.js
export function UserProfile({ user }) {
  return (
    <div className="user-profile">
      <div className="user-avatar">
        {user.imageUrl ? (
          <img 
            src={user.imageUrl} 
            alt={`${user.firstName} ${user.lastName}`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div className="default-avatar">
            {user.firstName[0]}{user.lastName[0]}
          </div>
        )}
      </div>
      <div className="user-info">
        <h3>{user.firstName} {user.lastName}</h3>
        <p>@{user.username}</p>
      </div>
    </div>
  );
}
```

---

## 📝 5. Crear un Comentario

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

## ⭐ 20. Sistema de Listas de Favoritos

### **Añadir Artículo a Favoritos**

```javascript
// favorites/addToFavorites.js
import API_URL from './config';

async function addArticleToFavorites(articleId, listId = null) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, error: 'No autenticado' };
  }

  try {
    const response = await fetch(`${API_URL}/api/favorite-lists/add-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        articleId: articleId,
        listId: listId // Si no se proporciona, se usa la lista por defecto
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Artículo añadido a favoritos:', data.data);
      return { success: true, list: data.data, message: data.message };
    } else {
      console.error('Error al añadir a favoritos:', data);
      return { success: false, error: data.error?.message || 'Error desconocido' };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, error: error.message };
  }
}

// Ejemplo de uso
addArticleToFavorites(6) // Añade a lista por defecto
  .then(result => {
    if (result.success) {
      console.log('✅ Artículo añadido a favoritos');
    }
  });
```

### **Verificar si Artículo está en Favoritos**

```javascript
// favorites/checkFavoriteStatus.js
import API_URL from './config';

async function checkArticleFavoriteStatus(articleId) {
  const jwt = localStorage.getItem('jwt');

  if (!jwt) {
    console.error('Usuario no autenticado');
    return { success: false, isFavorite: false };
  }

  try {
    const response = await fetch(`${API_URL}/api/favorite-lists/check/${articleId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Estado de favorito:', data.data);
      return { 
        success: true, 
        isFavorite: data.data.isFavorite,
        lists: data.data.lists
      };
    } else {
      console.error('Error al verificar favorito:', data);
      return { success: false, isFavorite: false };
    }
  } catch (error) {
    console.error('Error de red:', error);
    return { success: false, isFavorite: false };
  }
}
```

### **Componente React para Botón de Favoritos**

```javascript
// components/FavoriteButton.js
import React, { useState, useEffect } from 'react';

export function FavoriteButton({ articleId }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFavoriteStatus();
  }, [articleId]);

  const checkFavoriteStatus = async () => {
    const result = await checkArticleFavoriteStatus(articleId);
    if (result.success) {
      setIsFavorite(result.isFavorite);
    }
  };

  const handleToggleFavorite = async () => {
    setLoading(true);
    
    try {
      if (isFavorite) {
        // Remover de favoritos
        setIsFavorite(false);
      } else {
        // Añadir a lista por defecto
        const result = await addArticleToFavorites(articleId);
        if (result.success) {
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFavorite}
      disabled={loading}
      style={{
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: isFavorite ? '#ff4444' : '#ffcc00',
        color: isFavorite ? 'white' : 'black',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      {loading ? (
        'Cargando...'
      ) : (
        <>
          {isFavorite ? '❤️' : '🤍'}
          {isFavorite ? 'En Favoritos' : 'Añadir a Favoritos'}
        </>
      )}
    </button>
  );
}
```

### **Estructura de Datos de Respuesta**

```javascript
// Ejemplo de respuesta de lista de favoritos
{
  "data": {
    "id": 1,
    "name": "favorites",
    "description": "My favorite articles",
    "isDefault": true,
    "articles": [
      {
        "id": 6,
        "title": "Beautiful picture",
        "slug": "beautiful-picture",
        "description": "Description of a beautiful picture"
      }
    ],
    "user": {
      "id": 1,
      "username": "john"
    },
    "createdAt": "2026-02-10T15:30:00.000Z"
  }
}
```

### **Características del Sistema**

✅ **Lista por Defecto**: Se crea automáticamente "favorites" si el usuario no tiene listas  
✅ **Múltiples Listas**: Los usuarios pueden crear listas personalizadas  
✅ **Organización**: Cada lista puede tener nombre y descripción  
✅ **Relaciones**: Muchos a muchos entre artículos y listas  
✅ **Privacidad**: Cada usuario solo ve sus propias listas  
✅ **No afecta consultas**: Las consultas de artículos no se ven afectadas  

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
