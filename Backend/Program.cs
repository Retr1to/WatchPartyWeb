using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using WatchPartyBackend.Models;
using WatchPartyBackend.Services;

var builder = WebApplication.CreateBuilder(args);

var herokuPort = Environment.GetEnvironmentVariable("PORT");
if (int.TryParse(herokuPort, out var port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

// ✅ Configurar límite de tamaño de archivos (200 MB)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 200_000_000; // 200 MB
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 200_000_000; // 200 MB
});

// Registrar RoomManager como Singleton
builder.Services.AddSingleton<RoomManager>();

var videoStorageRoot = Environment.GetEnvironmentVariable("WATCHPARTY_VIDEO_STORAGE")
    ?? Path.Combine(Path.GetTempPath(), "watchparty_videos");

var cleanupIntervalMinutes = int.TryParse(Environment.GetEnvironmentVariable("WATCHPARTY_VIDEO_CLEANUP_INTERVAL_MINUTES"), out var parsedCleanupMinutes)
    ? parsedCleanupMinutes
    : 0;
var maxAgeHours = int.TryParse(Environment.GetEnvironmentVariable("WATCHPARTY_VIDEO_MAX_AGE_HOURS"), out var parsedMaxAgeHours)
    ? parsedMaxAgeHours
    : 24;

builder.Services.AddSingleton(new VideoStorageOptions
{
    RootPath = videoStorageRoot,
    CleanupInterval = TimeSpan.FromMinutes(Math.Max(0, cleanupIntervalMinutes)),
    MaxAge = TimeSpan.FromHours(Math.Max(1, maxAgeHours))
});
builder.Services.AddHostedService<VideoStorageCleanupService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var explicitOrigin = builder.Configuration["WATCHPARTY_FRONTEND_ORIGIN"] ?? Environment.GetEnvironmentVariable("WATCHPARTY_FRONTEND_ORIGIN");

        policy.SetIsOriginAllowed(origin =>
              {
                  if (string.IsNullOrWhiteSpace(origin)) return false;

                  if (!string.IsNullOrWhiteSpace(explicitOrigin) &&
                      string.Equals(origin, explicitOrigin, StringComparison.OrdinalIgnoreCase))
                  {
                      return true;
                  }

                  if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;

                  if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                      uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
                  {
                      return true;
                  }

                  return false;
              })
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Ensure wwwroot exists (best-effort; some hosts only allow writes under /tmp).
var webRootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
try
{
    Directory.CreateDirectory(webRootPath);
    Directory.CreateDirectory(Path.Combine(webRootPath, "videos"));
}
catch
{
    // ignore
}

 var app = builder.Build();
 
var runtimeWebRootPath = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
try
{
    Directory.CreateDirectory(runtimeWebRootPath);
    Directory.CreateDirectory(Path.Combine(runtimeWebRootPath, "videos"));
}
catch
{
    // ignore
}
app.Environment.WebRootPath = runtimeWebRootPath;
app.Environment.WebRootFileProvider = new PhysicalFileProvider(runtimeWebRootPath);

app.UseForwardedHeaders();
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseDefaultFiles();
app.UseStaticFiles(); // ✅ Sirve archivos de wwwroot/
app.UseCors("AllowFrontend");
app.UseWebSockets();

var roomManager = app.Services.GetRequiredService<RoomManager>();

// Duplicate identity handling:
// - "reject" (default): if a userId is already connected with a different sessionKey, reject the handshake.
// - "reassign": allow the connection and let RoomManager assign a new effective userId.
var duplicateUserIdPolicy = (Environment.GetEnvironmentVariable("WATCHPARTY_DUPLICATE_USERID_POLICY") ?? "reject")
    .Trim()
    .ToLowerInvariant();
var rejectDuplicateUserIdSessionConflicts = duplicateUserIdPolicy != "reassign";

Directory.CreateDirectory(videoStorageRoot);

roomManager.OnRoomRemoved = removedRoomId =>
{
    try
    {
        var roomDir = Path.Combine(videoStorageRoot, removedRoomId);
        if (Directory.Exists(roomDir))
        {
            Directory.Delete(roomDir, recursive: true);
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Video cleanup failed for room {removedRoomId}: {ex.Message}");
    }
};

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

static bool IsValidId(string value, int maxLength = 64)
{
    if (string.IsNullOrWhiteSpace(value) || value.Length > maxLength) return false;
    return value.All(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_');
}

static string SanitizeUsername(string username)
{
    var trimmed = (username ?? string.Empty).Trim();
    if (trimmed.Length > 32)
    {
        trimmed = trimmed[..32];
    }

    return trimmed;
}

static bool IsValidFileToken(string value, int maxLength = 128)
{
    if (string.IsNullOrWhiteSpace(value) || value.Length > maxLength) return false;
    return value.All(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_' or '.');
}

static bool IsAllowedVideoExtension(string extension)
{
    var ext = (extension ?? string.Empty).ToLowerInvariant();
    return ext is ".mp4" or ".webm" or ".ogg" or ".mov";
}

static string GetVideoContentType(string extension)
{
    return extension.ToLowerInvariant() switch
    {
        ".webm" => "video/webm",
        ".ogg" => "video/ogg",
        ".mov" => "video/quicktime",
        _ => "video/mp4"
    };
}

// ============================================================
// WEBSOCKET ENDPOINT - Conexión con manejo de mensajes JSON
// ============================================================
app.Map("/ws/{roomId}", async (HttpContext context, string roomId) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        return;
    }

    if (!IsValidId(roomId))
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("Invalid room id");
        return;
    }

    var userId = context.Request.Query["userId"].ToString();
    if (string.IsNullOrEmpty(userId))
    {
        userId = $"user_{Guid.NewGuid().ToString().Substring(0, 8)}";
    }
    else if (!IsValidId(userId))
    {
        userId = $"user_{Guid.NewGuid().ToString().Substring(0, 8)}";
    }

    var username = context.Request.Query["username"].ToString();
    username = SanitizeUsername(username);
    if (string.IsNullOrEmpty(username))
    {
        username = $"User{Random.Shared.Next(1000, 9999)}";
    }

    var sessionKey = context.Request.Query["sessionKey"].ToString();
    if (string.IsNullOrWhiteSpace(sessionKey) || !IsValidId(sessionKey, maxLength: 128))
    {
        sessionKey = Guid.NewGuid().ToString("N");
    }

    if (rejectDuplicateUserIdSessionConflicts && roomManager.HasSessionConflict(roomId, userId, sessionKey))
    {
        context.Response.StatusCode = 409;
        await context.Response.WriteAsJsonAsync(new
        {
            error = "Session conflict for userId (duplicate userId with different sessionKey)",
            code = "session_conflict"
        });
        return;
    }

    var webSocket = await context.WebSockets.AcceptWebSocketAsync();

    // Obtener o crear sala y agregar conexión
    userId = await roomManager.AddConnection(roomId, userId, sessionKey, webSocket, username);

    var isHost = roomManager.IsHost(roomId, userId);

    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] User {userId} ({username}) joined room {roomId} as {(isHost ? "HOST" : "VIEWER")}");

    // ✅ Enviar lista de usuarios actuales al nuevo usuario
    await roomManager.SendToUser(roomId, userId, new WebSocketMessage
    {
        Type = "welcome",
        UserId = userId,
        Username = username,
        IsHost = isHost
    });

    var currentUsers = roomManager.GetRoomUsers(roomId);
    var usersList = currentUsers.Select(u => new
    {
        userId = u.Key,
        username = u.Value,
        isHost = roomManager.IsHost(roomId, u.Key)
    }).ToList();

    var usersJson = JsonSerializer.Serialize(new { users = usersList }, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    });

    await roomManager.SendToUser(roomId, userId, new WebSocketMessage
    {
        Type = "room_state",
        Message = usersJson
    });

    // ✅ Enviar estado actual del video al nuevo usuario
    var currentState = roomManager.GetVideoState(roomId);
    if (currentState != null && (!string.IsNullOrEmpty(currentState.VideoFileName) || !string.IsNullOrEmpty(currentState.VideoUrl)))
    {
        await roomManager.SendToUser(roomId, userId, new WebSocketMessage
        {
            Type = "video_ready",
            VideoFileName = currentState.VideoFileName,
            VideoUrl = currentState.VideoUrl,
            Provider = currentState.Provider,
            VideoId = currentState.VideoId,
            State = currentState,
            Message = $"Video disponible: {currentState.VideoFileName}"
        });

        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Sent video state to {userId}: {currentState.VideoFileName}");
    }

    // Notificar a todos que alguien se unió
    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
    {
        Type = "user_joined",
        UserId = userId,
        Username = username,
        IsHost = isHost,
        Message = $"User {username} joined the room"
    });

    await BroadcastRoomState(roomId);

    // Manejar mensajes del WebSocket
    await HandleWebSocketMessages(webSocket, roomId, userId, roomManager, context.RequestAborted);
});

// ============================================================
// FUNCIÓN: Manejo de mensajes WebSocket
// ============================================================
async Task HandleWebSocketMessages(WebSocket webSocket, string roomId, string userId, RoomManager roomManager, CancellationToken cancellationToken)
{
    var buffer = new byte[8 * 1024];
    var options = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    try
    {
        while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            using var messageStream = new MemoryStream();
            WebSocketReceiveResult result;

            do
            {
                result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text && result.Count > 0)
                {
                    messageStream.Write(buffer, 0, result.Count);
                }
            } while (!result.EndOfMessage);

            if (result.MessageType == WebSocketMessageType.Close)
            {
                break;
            }

            if (result.MessageType != WebSocketMessageType.Text)
            {
                continue;
            }

            var messageJson = Encoding.UTF8.GetString(messageStream.GetBuffer(), 0, (int)messageStream.Length);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Received from {userId}: {messageJson}");

            WebSocketMessage? message;
            try
            {
                // ✅ Configurar deserialización con camelCase
                message = JsonSerializer.Deserialize<WebSocketMessage>(messageJson, options);
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"Invalid JSON received from {userId}: {ex.Message}");
                continue;
            }

            if (message == null)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] NULL message from {userId}");
                continue;
            }

            // ✅ DEBUG: Ver qué contiene el mensaje
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Deserialized - Type: '{message.Type}', Timestamp: {message.Timestamp}");

            await ProcessMessage(roomId, userId, message, roomManager);
        }

        if (webSocket.CloseStatus.HasValue)
        {
            await webSocket.CloseAsync(
                webSocket.CloseStatus.Value,
                webSocket.CloseStatusDescription,
                cancellationToken
            );
        }
    }
    catch (OperationCanceledException)
    {
        // ignore
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error with user {userId}: {ex.Message}");
    }
    finally
    {
        var wasHost = roomManager.IsHost(roomId, userId);
        var removed = roomManager.RemoveConnection(roomId, userId, webSocket);
        if (removed)
        {
            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "user_left",
                UserId = userId,
                Message = $"User {userId} left the room"
            });

            if (wasHost && roomManager.TryReassignHost(roomId, out var newHostId))
            {
                var users = roomManager.GetRoomUsers(roomId);
                users.TryGetValue(newHostId, out var newHostName);

                await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
                {
                    Type = "host_changed",
                    UserId = newHostId,
                    Username = newHostName,
                    Message = $"New host: {newHostId}"
                });
            }

            await BroadcastRoomState(roomId);
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] User {userId} left room {roomId}");
        }
    }
}

// ============================================================
// FUNCIÓN: Procesar diferentes tipos de mensajes
// ============================================================
async Task ProcessMessage(string roomId, string userId, WebSocketMessage message, RoomManager roomManager)
{
    var isHost = roomManager.IsHost(roomId, userId);

    // ✅ DEBUG: Log del tipo de mensaje
    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Processing message type: '{message.Type}' from {userId}");

    switch (message.Type.ToLower())
    {
        case "play":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to PLAY but is not host");
                return;
            }

            var playState = roomManager.GetVideoState(roomId);
            if (playState != null)
            {
                playState.IsPlaying = true;
                playState.CurrentTime = message.Timestamp ?? playState.CurrentTime;
                roomManager.UpdateVideoState(roomId, playState);
            }

            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "play",
                Timestamp = message.Timestamp,
                SentAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                IsHost = true,
                UserId = userId
            }, userId);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} pressed PLAY at {message.Timestamp}s");
            break;

        case "pause":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to PAUSE but is not host");
                return;
            }

            var pauseState = roomManager.GetVideoState(roomId);
            if (pauseState != null)
            {
                pauseState.IsPlaying = false;
                pauseState.CurrentTime = message.Timestamp ?? pauseState.CurrentTime;
                roomManager.UpdateVideoState(roomId, pauseState);
            }

            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "pause",
                Timestamp = message.Timestamp,
                SentAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                IsHost = true,
                UserId = userId
            }, userId);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} pressed PAUSE at {message.Timestamp}s");
            break;

        case "seek":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to SEEK but is not host");
                return;
            }

            var seekState = roomManager.GetVideoState(roomId);
            Console.WriteLine($"Seek state before: IsPlaying={seekState?.IsPlaying}, CurrentTime={seekState?.CurrentTime}");
            if (seekState != null)
            {
                var incomingIsPlaying = message.IsPlaying ?? seekState.IsPlaying;
                seekState.CurrentTime = message.Timestamp ?? 0;
                seekState.IsPlaying = incomingIsPlaying;
                roomManager.UpdateVideoState(roomId, seekState);
                Console.WriteLine($"Seek state after update: IsPlaying={seekState.IsPlaying}, CurrentTime={seekState.CurrentTime}");

                // Si estaba reproduciendo, enviar seek y luego play
                if (seekState.IsPlaying)
                {
                    Console.WriteLine("Sending seek and play");
                    // Enviar seek
                    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
                    {
                        Type = "seek",
                        Timestamp = message.Timestamp,
                        SentAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        IsPlaying = true,
                        IsHost = true,
                        UserId = userId
                    }, userId);

                    // Enviar play con el nuevo tiempo
                    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
                    {
                        Type = "play",
                        Timestamp = message.Timestamp,
                        SentAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        IsHost = true,
                        UserId = userId
                    }, userId);

                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Sent seek-play sequence to room {roomId}: time={message.Timestamp}");
                }
                else
                {
                    Console.WriteLine("Sending only seek");
                    // Si no estaba reproduciendo, solo enviar seek
                    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
                    {
                        Type = "seek",
                        Timestamp = message.Timestamp,
                        SentAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        IsPlaying = false,
                        IsHost = true,
                        UserId = userId
                    }, userId);

                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Sent seek to room {roomId}: time={message.Timestamp}, not playing");
                }
            }

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} SEEKED to {message.Timestamp}s");
            break;

        case "change_video":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to CHANGE VIDEO but is not host");
                return;
            }

            var newVideoUrl = message.VideoUrl ?? string.Empty;
            var provider = string.IsNullOrWhiteSpace(message.Provider) ? "url" : message.Provider!;
            var newVideoState = new VideoState
            {
                VideoFileName = string.Empty,
                VideoUrl = newVideoUrl,
                Provider = provider,
                VideoId = message.VideoId,
                CurrentTime = 0,
                IsPlaying = false
            };

            roomManager.UpdateVideoState(roomId, newVideoState);

            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "change_video",
                VideoUrl = newVideoUrl,
                Provider = provider,
                VideoId = message.VideoId,
                UserId = userId,
                IsHost = true,
                State = newVideoState
            }, userId);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} changed video URL to {newVideoUrl} (provider={provider}, videoId={message.VideoId})");
            break;

        case "sync_request":
            // Usuario pide sincronizarse
            var currentState = roomManager.GetVideoState(roomId);
            if (currentState != null)
            {
                await roomManager.SendToUser(roomId, userId, new WebSocketMessage
                {
                    Type = "video_ready",
                    VideoFileName = currentState.VideoFileName,
                    VideoUrl = currentState.VideoUrl,
                    Provider = currentState.Provider,
                    VideoId = currentState.VideoId,
                    State = currentState
                });
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Sent sync state to {userId}");
            }
            break;

        case "ping":
            await roomManager.SendToUser(roomId, userId, new WebSocketMessage
            {
                Type = "pong"
            });
            break;

        case "chat":
            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "chat",
                UserId = userId,
                Message = message.Message,
                IsHost = isHost
            });
            break;

        default:
            Console.WriteLine($"Unknown message type: {message.Type}");
            break;
    }
}

async Task BroadcastRoomState(string roomId)
{
    var currentUsers = roomManager.GetRoomUsers(roomId);
    var usersList = currentUsers.Select(u => new
    {
        userId = u.Key,
        username = u.Value,
        isHost = roomManager.IsHost(roomId, u.Key)
    }).ToList();

    var usersJson = JsonSerializer.Serialize(new { users = usersList }, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    });

    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
    {
        Type = "room_state",
        Message = usersJson
    });
}

// ============================================================
// VIDEO UPLOAD ENDPOINT - Solo el HOST puede subir
// ============================================================
app.MapPost("/upload/{roomId}", async (HttpContext context, string roomId) =>
{
    // ✅ Verificar que sea el HOST
    if (!IsValidId(roomId))
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = "Invalid room id" });
        return;
    }

    var userIdHeader = context.Request.Headers["X-User-Id"].ToString();
    var sessionKeyHeader = context.Request.Headers["X-Session-Key"].ToString();
    var isHost = roomManager.IsHost(roomId, userIdHeader);
    var isSessionValid = roomManager.ValidateSession(roomId, userIdHeader, sessionKeyHeader);

    if (!isHost || !isSessionValid)
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsJsonAsync(new { error = "Only the host can upload videos" });
        return;
    }

    if (!context.Request.HasFormContentType)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = "Expected multipart form data" });
        return;
    }

    var form = await context.Request.ReadFormAsync();
    var file = form.Files.GetFile("video");

    if (file == null || file.Length == 0)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = "No video file provided" });
        return;
    }

    // ✅ Validar tipo de archivo
    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

    if (!IsAllowedVideoExtension(extension))
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsJsonAsync(new { error = "Invalid file type. Allowed: mp4, webm, ogg, mov" });
        return;
    }

    // ✅ Crear directorio si no existe
    var videosDir = Path.Combine(videoStorageRoot, roomId);
    Directory.CreateDirectory(videosDir);

    // ✅ Generar nombre único para evitar colisiones
    var fileName = $"{Guid.NewGuid()}{extension}";
    var filePath = Path.Combine(videosDir, fileName);

    // ✅ Guardar archivo
    using (var stream = new FileStream(filePath, FileMode.Create))
    {
        await file.CopyToAsync(stream);
    }

    // ✅ Actualizar estado del video en la sala
    var videoState = new VideoState
    {
        VideoFileName = fileName,
        VideoUrl = null,
        Provider = "file",
        VideoId = null,
        CurrentTime = 0,
        IsPlaying = false
    };
    roomManager.UpdateVideoState(roomId, videoState);

    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Video uploaded to room {roomId}: {fileName} ({file.Length / 1024 / 1024:F2} MB)");

    // ✅ Notificar a TODOS (incluyendo el host)
    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
    {
        Type = "video_uploaded",
        VideoFileName = fileName,
        State = videoState,
        Message = $"New video uploaded: {file.FileName}"
    });

    // ✅ Responder con la URL del video
    var videoUrl = $"/videos/{roomId}/{fileName}";
    context.Response.StatusCode = 200;
    await context.Response.WriteAsJsonAsync(new
    {
        success = true,
        fileName = fileName,
        videoUrl = videoUrl,
        message = "Video uploaded successfully"
    });
});

// ============================================================
// ENDPOINT: Servir video de una sala (almacenamiento temporal)
// ============================================================
app.MapGet("/videos/{roomId}/{fileName}", (string roomId, string fileName) =>
{
    if (!IsValidId(roomId))
    {
        return Results.BadRequest(new { error = "Invalid room id" });
    }

    if (!IsValidFileToken(fileName))
    {
        return Results.BadRequest(new { error = "Invalid file name" });
    }

    var extension = Path.GetExtension(fileName).ToLowerInvariant();
    if (!IsAllowedVideoExtension(extension))
    {
        return Results.BadRequest(new { error = "Invalid file type" });
    }

    // Defense-in-depth against path traversal (even though fileName is token-validated).
    var videosDir = Path.Combine(videoStorageRoot, roomId);
    var safeFileName = Path.GetFileName(fileName);
    if (!string.Equals(safeFileName, fileName, StringComparison.Ordinal))
    {
        return Results.BadRequest(new { error = "Invalid file name" });
    }

    var fullVideosDir = Path.GetFullPath(videosDir) + Path.DirectorySeparatorChar;
    var filePath = Path.GetFullPath(Path.Combine(videosDir, safeFileName));
    if (!filePath.StartsWith(fullVideosDir, StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { error = "Invalid file path" });
    }
    if (!File.Exists(filePath))
    {
        return Results.NotFound(new { error = "Video not found" });
    }

    var contentType = GetVideoContentType(extension);
    return Results.File(filePath, contentType: contentType, enableRangeProcessing: true);
});

// ============================================================
// ENDPOINT: Listar videos disponibles en una sala
// ============================================================
app.MapGet("/videos/{roomId}", (string roomId) =>
{
    if (!IsValidId(roomId))
    {
        return Results.BadRequest(new { error = "Invalid room id" });
    }

    var videosDir = Path.Combine(videoStorageRoot, roomId);

    if (!Directory.Exists(videosDir))
    {
        return Results.Ok(new { videos = Array.Empty<string>() });
    }

    var videoFiles = Directory.GetFiles(videosDir)
        .Select(f => new
        {
            fileName = Path.GetFileName(f),
            url = $"/videos/{roomId}/{Path.GetFileName(f)}",
            size = new FileInfo(f).Length
        })
        .ToArray();

    return Results.Ok(new { videos = videoFiles });
});

// ============================================================
// ENDPOINT para obtener el estado actual de una sala
// ============================================================
app.MapGet("/room/{roomId}/state", (string roomId) =>
{
    if (!IsValidId(roomId))
    {
        return Results.BadRequest(new { error = "Invalid room id" });
    }

    var videoState = roomManager.GetVideoState(roomId);
    var users = roomManager.GetRoomUsers(roomId);

    if (videoState == null)
    {
        return Results.NotFound(new { error = "Room not found" });
    }

    var usersList = users.Select(u => new
    {
        userId = u.Key,
        username = u.Value,
        isHost = roomManager.IsHost(roomId, u.Key)
    }).ToList();

    return Results.Ok(new
    {
        roomId = roomId,
        videoState = videoState,
        users = usersList
    });
});

var spaIndexPath = Path.Combine(app.Environment.WebRootPath ?? app.Environment.ContentRootPath, "index.html");
if (File.Exists(spaIndexPath))
{
    app.MapFallbackToFile("index.html");
}

app.Run();
