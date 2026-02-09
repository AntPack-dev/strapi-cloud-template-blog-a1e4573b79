# 🔐 Guía de Integración OAuth - Facebook y Google

## 📋 Requisitos Previos

1. **Configurar credenciales OAuth:**
   - **Google**: Crea una aplicación en [Google Cloud Console](https://console.cloud.google.com/)
   - **Facebook**: Crea una aplicación en [Facebook Developers](https://developers.facebook.com/)

2. **Variables de entorno configuradas** en tu `.env`:
   ```env
   GOOGLE_CLIENT_ID=tu_google_client_id
   GOOGLE_CLIENT_SECRET=tu_google_client_secret
   FACEBOOK_APP_ID=tu_facebook_app_id
   FACEBOOK_APP_SECRET=tu_facebook_app_secret
   ```

---

## 🚀 Métodos de Autenticación desde el Frontend

### 1. **Login con Google**

```javascript
// auth/google.js
const API_URL = 'http://localhost:1337';

// Redirigir al usuario a Google para autenticación
export const loginWithGoogle = () => {
  window.location.href = `${API_URL}/api/connect/google`;
};

// Callback después de la autenticación
export const handleGoogleCallback = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    
    if (accessToken) {
      // Obtener información del usuario
      const response = await fetch(`${API_URL}/api/auth/google/callback?access_token=${accessToken}`);
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('jwt', data.jwt);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true, user: data.user, jwt: data.jwt };
      }
    }
    return { success: false, error: 'Autenticación fallida' };
  } catch (error) {
    console.error('Error en autenticación Google:', error);
    return { success: false, error: error.message };
  }
};
```

### 2. **Login con Facebook**

```javascript
// auth/facebook.js
const API_URL = 'http://localhost:1337';

// Inicializar Facebook SDK
export const initFacebookSDK = () => {
  window.fbAsyncInit = function() {
    FB.init({
      appId: process.env.REACT_APP_FACEBOOK_APP_ID,
      cookie: true,
      xfbml: true,
      version: 'v12.0'
    });
  };

  // Load the SDK asynchronously
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
};

// Login con Facebook
export const loginWithFacebook = () => {
  return new Promise((resolve, reject) => {
    FB.login(async (response) => {
      if (response.authResponse) {
        try {
          const res = await fetch(`${API_URL}/api/auth/facebook/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: response.authResponse.accessToken
            })
          });
          
          const data = await res.json();
          
          if (res.ok) {
            localStorage.setItem('jwt', data.jwt);
            localStorage.setItem('user', JSON.stringify(data.user));
            resolve({ success: true, user: data.user, jwt: data.jwt });
          } else {
            resolve({ success: false, error: data.error });
          }
        } catch (error) {
          reject({ success: false, error: error.message });
        }
      } else {
        resolve({ success: false, error: 'Usuario canceló el login' });
      }
    }, { scope: 'email' });
  });
};
```

### 3. **Componente de Login Completo**

```jsx
// components/Login.jsx
import React, { useState, useEffect } from 'react';
import { loginWithGoogle, handleGoogleCallback } from '../auth/google';
import { loginWithFacebook, initFacebookSDK } from '../auth/facebook';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Inicializar Facebook SDK
    initFacebookSDK();
    
    // Verificar si hay callback de Google
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('access_token')) {
      handleGoogleCallback();
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    loginWithGoogle();
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await loginWithFacebook();
      if (result.success) {
        // Redirigir al dashboard o página principal
        window.location.href = '/dashboard';
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError('Error en autenticación con Facebook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Iniciar Sesión</h2>
      
      {error && <div className="error">{error}</div>}
      
      <div className="social-login">
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="google-btn"
        >
          <img src="/google-icon.png" alt="Google" />
          {loading ? 'Conectando...' : 'Iniciar con Google'}
        </button>
        
        <button 
          onClick={handleFacebookLogin}
          disabled={loading}
          className="facebook-btn"
        >
          <img src="/facebook-icon.png" alt="Facebook" />
          {loading ? 'Conectando...' : 'Iniciar con Facebook'}
        </button>
      </div>
      
      <div className="divider">
        <span>o</span>
      </div>
      
      {/* Formulario de login tradicional existente */}
      <form className="traditional-login">
        {/* Tu formulario de email/password existente */}
      </form>
    </div>
  );
};

export default Login;
```

### 4. **Servicio de Autenticación Unificado**

```javascript
// services/authService.js
const API_URL = 'http://localhost:1337';

class AuthService {
  // Login tradicional
  async login(email, password) {
    const response = await fetch(`${API_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('jwt', data.jwt);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    }
    throw new Error(data.error?.message || 'Error en login');
  }

  // Login con Google
  loginWithGoogle() {
    window.location.href = `${API_URL}/api/connect/google`;
  }

  // Login con Facebook
  async loginWithFacebook(accessToken) {
    const response = await fetch(`${API_URL}/api/auth/facebook/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken })
    });
    
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('jwt', data.jwt);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    }
    throw new Error(data.error?.message || 'Error en autenticación Facebook');
  }

  // Verificar si está autenticado
  isAuthenticated() {
    const token = localStorage.getItem('jwt');
    return !!token;
  }

  // Obtener usuario actual
  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // Logout
  logout() {
    localStorage.removeItem('jwt');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  // Obtener token para requests
  getToken() {
    return localStorage.getItem('jwt');
  }
}

export default new AuthService();
```

### 5. **Hook de Autenticación para React**

```jsx
// hooks/useAuth.js
import { useState, useEffect } from 'react';
import authService from '../services/authService';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      setUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = () => {
    authService.loginWithGoogle();
  };

  const loginWithFacebook = async (accessToken) => {
    try {
      const result = await authService.loginWithFacebook(accessToken);
      setUser(result.user);
      return result;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
  };

  return {
    user,
    loading,
    login,
    loginWithGoogle,
    loginWithFacebook,
    logout,
    isAuthenticated: authService.isAuthenticated()
  };
};
```

---

## 🔄 Flujo de Autenticación

### Google OAuth:
1. Usuario hace clic en "Iniciar con Google"
2. Redirección a Google para consentimiento
3. Google redirige a tu callback con access_token
4. Frontend envía token a Strapi
5. Strapi valida token y crea/actualiza usuario
6. Strapi devuelve JWT y datos del usuario
7. Frontend guarda tokens y redirige al dashboard

### Facebook OAuth:
1. Usuario hace clic en "Iniciar con Facebook"
2. Facebook SDK muestra popup de consentimiento
3. Usuario autoriza y Facebook devuelve access_token
4. Frontend envía token a Strapi
5. Strapi valida token y crea/actualiza usuario
6. Strapi devuelve JWT y datos del usuario
7. Frontend guarda tokens y redirige al dashboard

---

## 🛠️ Configuración Adicional

### Callback URLs en los proveedores:

**Google:**
```
http://localhost:1337/api/auth/google/callback
```

**Facebook:**
```
http://localhost:1337/api/auth/facebook/callback
```

### Variables de entorno en el frontend:
```env
REACT_APP_API_URL=http://localhost:1337
REACT_APP_FACEBOOK_APP_ID=tu_facebook_app_id
```

---

## 🎯 Ejemplo de Uso en Componente

```jsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';

const Dashboard = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return <div>Redirigiendo al login...</div>;
  }

  return (
    <div>
      <h1>Bienvenido, {user.firstName}!</h1>
      <p>Email: {user.email}</p>
      <p>Proveedor: {user.provider}</p>
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  );
};

export default Dashboard;
```

---

## 🚨 Notas Importantes

1. **HTTPS en producción**: Los proveedores OAuth requieren HTTPS en producción
2. **Dominios autorizados**: Configura los dominios permitidos en las consolas de desarrollo
3. **Manejo de errores**: Implementa manejo robusto de errores y estados de carga
4. **Seguridad**: Nunca expongas los secrets del cliente en el frontend
5. **Testing**: Prueba exhaustivamente en diferentes navegadores y dispositivos
