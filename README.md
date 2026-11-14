# Racha — Seguimiento de Hábitos y Consistencia

Aplicación web progresiva (PWA) para seguimiento de hábitos diarios, rachas con días de gracia, calendario, analítica de progreso, cronología de hitos, tarjeta compartible PNG, Coach Racha con Gemini, sincronización multi-dispositivo y minijuego 3D (*Forja de Racha*).

## Requisitos previos

- Node.js 20+
- npm (o bun)

## Instalación y ejecución local

1. Instala las dependencias:

```bash
npm install
```

2. Crea tu archivo `.env` a partir de `.env.example` y añade tu clave de Gemini si quieres usar **Coach Racha** con IA en vivo (si no se configura, funciona con respaldo local):

```bash
cp .env.example .env
```

3. Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

La aplicación quedará disponible en `http://localhost:3000`.

## Compilación para producción

```bash
npm run build
NODE_ENV=production npm start
```

## Subir a otro repositorio en GitHub

Descomprime el archivo del proyecto en una carpeta local y ejecuta:

```bash
git init
git add .
git commit -m "Initial commit: Racha habit tracker"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```
