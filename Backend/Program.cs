using System.Collections.Concurrent;
using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Adjust to frontend URL
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// In-memory storage for rooms and connections
var rooms = new ConcurrentDictionary<string, ConcurrentBag<WebSocket>>();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowFrontend");
app.UseWebSockets();

app.MapGet("/", () => "Hello World!");

// WebSocket endpoint for rooms
app.Map("/ws/{roomId}", async (HttpContext context, string roomId) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        var connections = rooms.GetOrAdd(roomId, _ => new ConcurrentBag<WebSocket>());
        connections.Add(webSocket);

        await HandleWebSocketAsync(webSocket, roomId, connections);
    }
    else
    {
        context.Response.StatusCode = 400;
    }
});

async Task HandleWebSocketAsync(WebSocket webSocket, string roomId, ConcurrentBag<WebSocket> connections)
{
    var buffer = new byte[1024 * 4];
    WebSocketReceiveResult result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

    while (!result.CloseStatus.HasValue)
    {
        // For now, just echo or broadcast messages
        var message = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
        // Broadcast to all in room
        foreach (var conn in connections)
        {
            if (conn.State == WebSocketState.Open)
            {
                await conn.SendAsync(new ArraySegment<byte>(buffer, 0, result.Count), result.MessageType, result.EndOfMessage, CancellationToken.None);
            }
        }

        result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
    }

    await webSocket.CloseAsync(result.CloseStatus.Value, result.CloseStatusDescription, CancellationToken.None);
    connections.TryTake(out _); // Remove from connections
}

// Video upload endpoint (host only)
app.MapPost("/upload/{roomId}", async (HttpContext context, string roomId) =>
{
    // Check if user is host: require header "X-Is-Host" with value "true"
    if (!context.Request.Headers.TryGetValue("X-Is-Host", out var isHost) || isHost != "true")
    {
        context.Response.StatusCode = 403;
        await context.Response.WriteAsync("Forbidden: Host access required");
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

    // Save file to wwwroot/videos/roomId/filename
    var videosDir = Path.Combine("wwwroot", "videos", roomId);
    Directory.CreateDirectory(videosDir);
    var filePath = Path.Combine(videosDir, file.FileName);

    using (var stream = new FileStream(filePath, FileMode.Create))
    {
        await file.CopyToAsync(stream);
    }

    // Notify all clients in the room via WebSocket
    if (rooms.TryGetValue(roomId, out var connections))
    {
        var message = $"New video uploaded: {file.FileName}";
        var messageBytes = System.Text.Encoding.UTF8.GetBytes(message);
        foreach (var conn in connections)
        {
            if (conn.State == WebSocketState.Open)
            {
                await conn.SendAsync(new ArraySegment<byte>(messageBytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }

    context.Response.StatusCode = 200;
    await context.Response.WriteAsync($"Video uploaded successfully: {file.FileName}");
});

app.Run();
