# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend-build
WORKDIR /src/Frontend
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src
COPY Backend/WatchPartyBackend.csproj Backend/
RUN dotnet restore Backend/WatchPartyBackend.csproj
COPY Backend/ Backend/
# Angular (v17+) application builder outputs to dist/.../browser
COPY --from=frontend-build /src/Frontend/dist/watchparty-frontend/browser/ Backend/wwwroot/
RUN dotnet publish Backend/WatchPartyBackend.csproj -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=backend-build /app/out ./
ENV PORT=8080
EXPOSE 8080
CMD ["dotnet", "WatchPartyBackend.dll"]
