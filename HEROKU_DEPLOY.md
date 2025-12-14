# Despliegue en Heroku (Container)

Este repo incluye un `Dockerfile` multi-stage (Angular + ASP.NET Core) listo para desplegar en Heroku usando contenedores.

## Requisitos

- Heroku CLI instalado
- Una app creada en Heroku

## Variables recomendadas

- `WATCHPARTY_FRONTEND_ORIGIN`: origen permitido para CORS (p. ej. `https://TU-APP.herokuapp.com`)
- `WATCHPARTY_VIDEO_STORAGE` (opcional): ruta de almacenamiento temporal; si no se define se usa `/tmp`
- `WATCHPARTY_DUPLICATE_USERID_POLICY` (opcional): `reject` (default) o `reassign` para manejar colisiones de `userId` con `sessionKey` distinto.
- `WATCHPARTY_VIDEO_CLEANUP_INTERVAL_MINUTES` (opcional): intervalo de limpieza de videos (0 deshabilita; recomendado en Heroku).
- `WATCHPARTY_VIDEO_MAX_AGE_HOURS` (opcional): edad máxima para borrar carpetas de videos de salas inactivas.

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
- El frontend manda `ping` cada ~25s para mantener viva la conexión (margen seguro vs timeouts comunes de ~30s en proxies/load balancers).
