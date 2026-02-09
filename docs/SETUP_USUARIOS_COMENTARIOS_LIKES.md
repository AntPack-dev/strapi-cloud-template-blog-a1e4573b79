# Sistema de Usuarios, Comentarios y Me Gusta - Guía de Configuración

## 📋 Resumen

Este documento describe la implementación completa del sistema de usuarios, comentarios y me gusta para tu blog en Strapi.

## 🏗️ Estructura Implementada

### Entidades Creadas

1. **Comment** (`api::comment.comment`)
   - `content` (text): Contenido del comentario
   - `article` (relation): Relación muchos-a-uno con Article
   - `author` (relation): Relación muchos-a-uno con User
   - Lifecycle hooks: Asigna automáticamente el autor basado en el JWT

2. **Like** (`api::like.like`)
   - `article` (relation): Relación muchos-a-uno con Article
   - `user` (relation): Relación muchos-a-uno con User
   - Lifecycle hooks: Asigna automáticamente el usuario basado en el JWT

3. **Article** (actualizado)
   - `comments` (relation): Relación uno-a-muchos con Comment
   - `likes` (relation): Relación uno-a-muchos con Like

### Endpoint Personalizado

**POST** `/api/articles/:id/toggle-like`
- Si el usuario ya dio like, lo elimina
- Si no existe, crea un nuevo like
- Requiere autenticación (JWT)

## ⚙️ Configuración de Permisos

### 1. Rol Public (Usuarios no autenticados)

Navega a: **Settings → Users & Permissions Plugin → Roles → Public**

Habilita los siguientes permisos:

#### Users-permissions
- ✅ `auth.register` - Permitir registro de nuevos usuarios
- ✅ `auth.callback` - Callback de autenticación
- ✅ `auth.connect` - Conectar con providers

#### Article
- ✅ `find` - Ver lista de artículos
- ✅ `findOne` - Ver un artículo específico

#### Comment
- ✅ `find` - Ver comentarios (opcional, si quieres mostrar comentarios a usuarios no logueados)
- ✅ `findOne` - Ver un comentario específico (opcional)

#### Like
- ❌ NO habilitar ningún permiso (los likes solo para usuarios autenticados)

---

### 2. Rol Authenticated (Usuarios autenticados)

Navega a: **Settings → Users & Permissions Plugin → Roles → Authenticated**

Habilita los siguientes permisos:

#### Users-permissions
- ✅ `users.me` - Obtener información del usuario actual

#### Article
- ✅ `find` - Ver lista de artículos
- ✅ `findOne` - Ver un artículo específico
- ✅ `toggleLike` - Dar/quitar me gusta (endpoint personalizado)

#### Comment
- ✅ `find` - Ver comentarios
- ✅ `findOne` - Ver un comentario específico
- ✅ `create` - Crear comentarios
- ✅ `update` - Actualizar sus propios comentarios
- ✅ `delete` - Eliminar sus propios comentarios

#### Like
- ✅ `find` - Ver likes
- ✅ `findOne` - Ver un like específico
- ⚠️ NO habilitar `create` ni `delete` directamente (usar el endpoint toggle-like)

---

## 🔒 Seguridad Implementada

### Lifecycle Hooks

Los lifecycle hooks garantizan que:

1. **Comment**: El campo `author` se asigna automáticamente al usuario autenticado, evitando que un usuario pueda comentar en nombre de otro.

2. **Like**: El campo `user` se asigna automáticamente al usuario autenticado, evitando que un usuario pueda dar like en nombre de otro.

### Políticas Recomendadas (Opcional - Avanzado)

Para mayor seguridad, puedes crear políticas personalizadas:

**Política para Comments** (`src/api/comment/policies/is-owner.js`):
```javascript
module.exports = async (policyContext, config, { strapi }) => {
  const { id } = policyContext.params;
  const userId = policyContext.state.user?.id;

  if (!userId) {
    return false;
  }

  const comment = await strapi.db.query('api::comment.comment').findOne({
    where: { id },
    populate: ['author'],
  });

  return comment && comment.author.id === userId;
};
```

Luego aplicarla en las rutas de update y delete.

---

## 🗄️ Índice Único para Likes (Recomendado)

Para evitar duplicados a nivel de base de datos, debes crear un índice único compuesto.

### Para PostgreSQL

Ejecuta esta migración SQL:

```sql
CREATE UNIQUE INDEX unique_user_article_like 
ON likes (user_id, article_id);
```

### Para MySQL

```sql
CREATE UNIQUE INDEX unique_user_article_like 
ON likes (user_id, article_id);
```

### Para SQLite

```sql
CREATE UNIQUE INDEX unique_user_article_like 
ON likes (user_id, article_id);
```

**Nota**: Strapi no soporta índices únicos compuestos directamente en el schema.json, por lo que debes crearlos manualmente en la base de datos.

---

## 🚀 Pasos de Configuración

1. **Reinicia Strapi** para que reconozca las nuevas entidades:
   ```bash
   npm run develop
   ```

2. **Configura los permisos** según las instrucciones anteriores en el panel de administración.

3. **Crea el índice único** en tu base de datos (ver sección anterior).

4. **Prueba los endpoints** usando los snippets de frontend proporcionados.

---

## 📝 Notas Importantes

- Los lifecycle hooks se ejecutan automáticamente, no necesitas configuración adicional.
- El endpoint `toggle-like` maneja automáticamente la creación y eliminación de likes.
- Los usuarios deben estar autenticados para comentar y dar likes.
- El registro de usuarios está habilitado por defecto con el plugin users-permissions.
