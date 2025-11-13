# Instrucciones para Restaurar el Repositorio en GitHub

## Paso 1: Crear el repositorio en GitHub

1. Ve a: https://github.com/new
2. Nombre del repositorio: `integrador-Base-de-Datos`
3. Descripción (opcional): "API REST para e-commerce con MongoDB - Integrador Base de Datos UTN"
4. Visibilidad: Public o Private (tu elección)
5. **NO marques ninguna de estas opciones:**
   - ❌ Initialize this repository with a README
   - ❌ Add .gitignore
   - ❌ Choose a license
6. Click en "Create repository"

## Paso 2: Ejecutar estos comandos en PowerShell

Una vez creado el repositorio en GitHub, ejecuta estos comandos en la carpeta del proyecto:

```powershell
# Verificar que estás en la carpeta correcta
cd "C:\Users\adrian\Desktop\PROGRAMACION (UTN) Y PROYECTOS\UTN\INTEGRADOR BASE DE DATOS"

# Verificar que el remoto está configurado correctamente
git remote set-url origin https://github.com/adrianfredes10/integrador-Base-de-Datos.git

# Subir todo al repositorio
git push -u origin main
```

## Si necesitas autenticarte

GitHub puede pedirte autenticación. Opciones:

1. **Personal Access Token (recomendado):**
   - Ve a: https://github.com/settings/tokens
   - Click en "Generate new token (classic)"
   - Selecciona el scope: `repo`
   - Copia el token
   - Cuando git pida password, usa el token en lugar de la contraseña

2. **GitHub CLI:**
   - Si tienes `gh` instalado, puedes usar: `gh auth login`

## Verificar que se subió correctamente

Después del push, ve a:
https://github.com/adrianfredes10/integrador-Base-de-Datos

Deberías ver todos los archivos del proyecto.


