# Despliegue en Heroku (Container)

Este repo incluye un `Dockerfile` multi-stage (Angular + ASP.NET Core) listo para desplegar en Heroku usando contenedores.

## Requisitos

- Heroku CLI instalado
- Una app creada en Heroku

## Variables recomendadas

- `WATCHPARTY_FRONTEND_ORIGIN`: origen permitido para CORS (p. ej. `https://TU-APP.herokuapp.com`)
- `WATCHPARTY_VIDEO_STORAGE` (opcional): ruta de almacenamiento temporal; si no se define se usa `/tmp`

## Deploy

```bash
heroku login
docker buildx build --platform linux/amd64 --provenance=false --sbom=false \
  -t registry.heroku.com/watchpartyalejololer/web:latest --output type=docker .
docker push registry.heroku.com/watchpartyalejololer/web:latest
heroku container:release web -a watchpartyalejololer
```

## Notas

- Heroku inyecta `PORT` automáticamente; el backend lo lee y escucha en `0.0.0.0:$PORT`.
- La subida de videos valida `X-User-Id` y `X-Session-Key` para evitar suplantación del host.

