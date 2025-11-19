# WatchTogether Environment Configuration

## Backend (.env file)
Copy `.env.example` to `.env` and configure:

PORT=3000
FRONTEND_URL=http://localhost:4200

## Frontend (socket.service.ts)
Update the SERVER_URL constant in:
`Frontend/src/app/services/socket.service.ts`

```typescript
private readonly SERVER_URL = 'http://localhost:3000';
```

## Production Configuration

### Backend
1. Set production PORT
2. Update CORS origin to production frontend URL
3. Consider using environment variables

### Frontend  
1. Update SERVER_URL to production backend URL
2. Build with: `npm run build`
3. Serve from `dist/` directory
