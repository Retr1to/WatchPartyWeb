using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using WatchPartyBackend.Models;
using WatchPartyBackend.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

// Registrar RoomManager como Singleton
builder.Services.AddSingleton<RoomManager>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowFrontend");
app.UseWebSockets();

var roomManager = app.Services.GetRequiredService<RoomManager>();

app.MapGet("/", () => "WatchParty Backend is running!");

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

    // Generar un ID único para este usuario
    var userId = context.Request.Query["userId"].ToString();
    if (string.IsNullOrEmpty(userId))
    {
        userId = Guid.NewGuid().ToString();
    }

    var username = context.Request.Query["username"].ToString();
    if (string.IsNullOrEmpty(username))
    {
        username = "Usuario";
    }

    var webSocket = await context.WebSockets.AcceptWebSocketAsync();

    // Obtener o crear sala y agregar conexión (✅ AGREGADO username)
    var room = roomManager.GetOrCreateRoom(roomId, userId);
    roomManager.AddConnection(roomId, userId, webSocket, username);

    var isHost = roomManager.IsHost(roomId, userId);

    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] User {userId} ({username}) joined room {roomId} as {(isHost ? "HOST" : "VIEWER")}");

    // ✅✅✅ NUEVO: Enviar lista de usuarios actuales al nuevo usuario ✅✅✅
    var currentUsers = roomManager.GetRoomUsers(roomId);
    var usersList = currentUsers.Select(u => new
    {
        userId = u.Key,
        username = u.Value,
        isHost = roomManager.IsHost(roomId, u.Key)
    }).ToList();

    // Serializar manualmente la lista de usuarios
    var usersJson = JsonSerializer.Serialize(new { users = usersList }, new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    });

    await roomManager.SendToUser(roomId, userId, new WebSocketMessage
    {
        Type = "room_state",
        Message = usersJson
    });
    // ✅✅✅ FIN ✅✅✅

    // Enviar estado actual del video al nuevo usuario
    var currentState = roomManager.GetVideoState(roomId);
    if (currentState != null && !string.IsNullOrEmpty(currentState.VideoFileName))
    {
        await roomManager.SendToUser(roomId, userId, new WebSocketMessage
        {
            Type = "state",
            IsHost = false,
            State = currentState
        });
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

    // Manejar mensajes del WebSocket
    await HandleWebSocketMessages(webSocket, roomId, userId, roomManager);
});

// ============================================================
// FUNCIÓN: Manejo de mensajes WebSocket
// ============================================================
async Task HandleWebSocketMessages(WebSocket webSocket, string roomId, string userId, RoomManager roomManager)
{
    var buffer = new byte[1024 * 4];

    try
    {
        WebSocketReceiveResult result = await webSocket.ReceiveAsync(
            new ArraySegment<byte>(buffer),
            CancellationToken.None
        );

        while (!result.CloseStatus.HasValue)
        {
            var messageJson = Encoding.UTF8.GetString(buffer, 0, result.Count);

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Received from {userId}: {messageJson}");

            // Deserializar el mensaje
            WebSocketMessage? message;
            try
            {
                message = JsonSerializer.Deserialize<WebSocketMessage>(messageJson);
            }
            catch (JsonException)
            {
                Console.WriteLine($"Invalid JSON received from {userId}");
                result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                continue;
            }

            if (message == null)
            {
                result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                continue;
            }

            // Procesar según el tipo de mensaje
            await ProcessMessage(roomId, userId, message, roomManager);

            // Recibir siguiente mensaje
            result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
        }

        // Usuario se desconectó
        await webSocket.CloseAsync(
            result.CloseStatus.Value,
            result.CloseStatusDescription,
            CancellationToken.None
        );
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error with user {userId}: {ex.Message}");
    }
    finally
    {
        // Limpiar conexión
        roomManager.RemoveConnection(roomId, userId);

        // Notificar que el usuario se fue
        await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
        {
            Type = "user_left",
            UserId = userId,
            Message = $"User {userId} left the room"
        });

        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] User {userId} left room {roomId}");
    }
}

// ============================================================
// FUNCIÓN: Procesar diferentes tipos de mensajes
// ============================================================
async Task ProcessMessage(string roomId, string userId, WebSocketMessage message, RoomManager roomManager)
{
    var isHost = roomManager.IsHost(roomId, userId);

    switch (message.Type.ToLower())
    {
        case "play":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to PLAY but is not host");
                return;
            }

            // Actualizar estado
            var playState = roomManager.GetVideoState(roomId);
            if (playState != null)
            {
                playState.IsPlaying = true;
                playState.CurrentTime = message.Timestamp ?? playState.CurrentTime;
                roomManager.UpdateVideoState(roomId, playState);
            }

            // Broadcast a todos
            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "play",
                Timestamp = message.Timestamp,
                IsHost = true,
                UserId = userId
            });

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} pressed PLAY at {message.Timestamp}s");
            break;

        case "pause":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to PAUSE but is not host");
                return;
            }

            // Actualizar estado
            var pauseState = roomManager.GetVideoState(roomId);
            if (pauseState != null)
            {
                pauseState.IsPlaying = false;
                pauseState.CurrentTime = message.Timestamp ?? pauseState.CurrentTime;
                roomManager.UpdateVideoState(roomId, pauseState);
            }

            // Broadcast a todos
            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "pause",
                Timestamp = message.Timestamp,
                IsHost = true,
                UserId = userId
            });

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} pressed PAUSE at {message.Timestamp}s");
            break;

        case "seek":
            if (!isHost)
            {
                Console.WriteLine($"User {userId} tried to SEEK but is not host");
                return;
            }

            // Actualizar estado
            var seekState = roomManager.GetVideoState(roomId);
            if (seekState != null)
            {
                seekState.CurrentTime = message.Timestamp ?? 0;
                roomManager.UpdateVideoState(roomId, seekState);
            }

            // Broadcast a todos
            await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
            {
                Type = "seek",
                Timestamp = message.Timestamp,
                IsHost = true,
                UserId = userId
            });

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] HOST {userId} SEEKED to {message.Timestamp}s");
            break;

        case "chat":
            // Broadcast mensaje de chat
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

// ============================================================
// VIDEO UPLOAD ENDPOINT - Solo el HOST puede subir
// ============================================================
app.MapPost("/upload/{roomId}", async (HttpContext context, string roomId) =>
{
    // Verificar header X-Is-Host
    if (!context.Request.Headers.TryGetValue("X-Is-Host", out var isHostHeader) || isHostHeader != "true")
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Forbidden: Only host can upload videos");
        return;
    }

    if (!context.Request.HasFormContentType)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("Bad Request: Expected multipart form data");
        return;
    }

    var form = await context.Request.ReadFormAsync();
    var file = form.Files.GetFile("video");

    if (file == null || file.Length == 0)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("Bad Request: No video file provided");
        return;
    }

    // Guardar archivo
    var videosDir = Path.Combine("wwwroot", "videos", roomId);
    Directory.CreateDirectory(videosDir);
    var filePath = Path.Combine(videosDir, file.FileName);

    using (var stream = new FileStream(filePath, FileMode.Create))
    {
        await file.CopyToAsync(stream);
    }

    // Actualizar estado del video en la sala
    var videoState = new VideoState
    {
        VideoFileName = file.FileName,
        CurrentTime = 0,
        IsPlaying = false
    };
    roomManager.UpdateVideoState(roomId, videoState);

    // Notificar a todos los usuarios
    await roomManager.BroadcastToRoom(roomId, new WebSocketMessage
    {
        Type = "video_uploaded",
        VideoFileName = file.FileName,
        Message = $"New video uploaded: {file.FileName}"
    });

    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Video uploaded to room {roomId}: {file.FileName}");

    context.Response.StatusCode = 200;
    await context.Response.WriteAsync($"Video uploaded successfully: {file.FileName}");
});

// ============================================================
// ENDPOINT: Listar videos disponibles en una sala
// ============================================================
app.MapGet("/videos/{roomId}", (string roomId) =>
{
    var videosDir = Path.Combine("wwwroot", "videos", roomId);

    if (!Directory.Exists(videosDir))
    {
        return Results.Ok(new { videos = Array.Empty<string>() });
    }

    var videoFiles = Directory.GetFiles(videosDir)
        .Select(Path.GetFileName)
        .ToArray();

    return Results.Ok(new { videos = videoFiles });
});

app.Run();
