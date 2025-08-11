# 🚀 Guía de Despliegue - Boda Suite

## Opción Recomendada: Railway (Gratis y Fácil)

### Paso 1: Preparar el Código
✅ **Ya está listo** - Los archivos ya están configurados para producción.

### Paso 2: Crear Cuenta en Railway
1. Ve a [railway.app](https://railway.app)
2. Haz clic en "Start a New Project"
3. Conecta tu cuenta de GitHub

### Paso 3: Subir tu Código a GitHub
```bash
# En tu terminal, dentro de la carpeta del proyecto:
git init
git add .
git commit -m "Initial commit - Boda Suite"

# Crear repositorio en GitHub y conectarlo:
git remote add origin https://github.com/TU_USUARIO/boda-suite.git
git push -u origin main
```

### Paso 4: Desplegar en Railway
1. En Railway, selecciona "Deploy from GitHub repo"
2. Elige tu repositorio `boda-suite`
3. Railway detectará automáticamente que es una app Node.js
4. El despliegue comenzará automáticamente

### Paso 5: Configurar Variables de Entorno (Opcional)
En Railway, ve a Variables y agrega:
- `NODE_ENV=production`
- `JWT_SECRET=tu-clave-secreta-aqui`

### Paso 6: ¡Listo!
Railway te dará una URL como: `https://tu-app.railway.app`

---

## Alternativa: Render

### Paso 1: Crear Cuenta
1. Ve a [render.com](https://render.com)
2. Conecta tu GitHub

### Paso 2: Crear Web Service
1. "New" → "Web Service"
2. Conecta tu repositorio
3. Configuración:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm run start:prod`

---

## Alternativa: Vercel (Solo Frontend)

Si quieres separar frontend y backend:

### Para el Frontend:
1. Ve a [vercel.com](https://vercel.com)
2. Importa tu repositorio
3. Vercel detectará automáticamente React

### Para el Backend:
Usa Railway o Render solo para el backend.

---

## 📋 Checklist Pre-Despliegue

- ✅ Scripts de producción agregados
- ✅ Variables de entorno configuradas
- ✅ Archivos estáticos configurados
- ✅ CORS configurado para producción
- ✅ Base de datos SQLite incluida
- ✅ .gitignore creado

## 🔧 Comandos Útiles

```bash
# Probar localmente en modo producción
npm run build
npm run start:prod

# Verificar que todo funciona
# Visita: http://localhost:3002
```

## 🆘 Solución de Problemas

### Error: "Cannot find module"
- Asegúrate de que todas las dependencias estén en `dependencies`, no en `devDependencies`

### Error: "Database locked"
- Railway maneja esto automáticamente con SQLite

### Error: "CORS"
- Ya está configurado para producción

## 💡 Consejos

1. **Railway** es la opción más fácil y rápida
2. Incluye **$5 USD gratis** cada mes
3. Escalamiento automático
4. SSL/HTTPS incluido
5. Dominio personalizado disponible

¡Tu app estará online en menos de 5 minutos! 🎉