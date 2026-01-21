using System.IO;
using System.Security.Claims;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using WatchPartyBackend.Contracts;
using WatchPartyBackend.Services;

namespace WatchPartyBackend.Soap
{
    public class SoapRequestHandler
    {
        private static readonly XNamespace SoapNs = "http://schemas.xmlsoap.org/soap/envelope/";
        private static readonly XNamespace ServiceNs = "http://watchparty/soap";

        private readonly AuthService _authService;
        private readonly FriendService _friendService;
        private readonly RoomService _roomService;

        public SoapRequestHandler(AuthService authService, FriendService friendService, RoomService roomService)
        {
            _authService = authService;
            _friendService = friendService;
            _roomService = roomService;
        }

        public async Task<IResult> HandleAsync(HttpContext context)
        {
            var requestXml = await ReadRequestBodyAsync(context.Request);
            if (string.IsNullOrWhiteSpace(requestXml))
            {
                return SoapResponse(ServiceElement("ErrorResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Empty SOAP request body")));
            }

            if (!TryParseSoapBody(requestXml, out var operationElement, out var parseError))
            {
                return SoapResponse(ServiceElement("ErrorResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", parseError ?? "Invalid SOAP request")));
            }

            var operationName = operationElement!.Name.LocalName;
            switch (operationName)
            {
                case "HealthCheck":
                    return SoapResponse(ServiceElement("HealthCheckResponse",
                        ServiceElement("Success", true),
                        ServiceElement("Status", "ok")));
                case "Register":
                    return await HandleRegisterAsync(operationElement);
                case "Login":
                    return await HandleLoginAsync(operationElement);
                case "GetCurrentUser":
                    return await HandleGetCurrentUserAsync(context);
                case "SendFriendRequest":
                    return await HandleSendFriendRequestAsync(context, operationElement);
                case "AcceptFriendRequest":
                    return await HandleAcceptFriendRequestAsync(context, operationElement);
                case "RejectFriendRequest":
                    return await HandleRejectFriendRequestAsync(context, operationElement);
                case "GetFriends":
                    return await HandleGetFriendsAsync(context);
                case "GetPendingFriendRequests":
                    return await HandleGetPendingFriendRequestsAsync(context);
                case "CreateRoom":
                    return await HandleCreateRoomAsync(context, operationElement);
                case "GetPublicRooms":
                    return await HandleGetPublicRoomsAsync();
                case "GetFriendRooms":
                    return await HandleGetFriendRoomsAsync(context);
                case "CanJoinRoom":
                    return await HandleCanJoinRoomAsync(context, operationElement);
                default:
                    return SoapResponse(ServiceElement("ErrorResponse",
                        ServiceElement("Success", false),
                        ServiceElement("Error", $"Unknown operation '{operationName}'")));
            }
        }

        private async Task<IResult> HandleRegisterAsync(XElement operationElement)
        {
            var username = GetChildValue(operationElement, "Username");
            var email = GetChildValue(operationElement, "Email");
            var password = GetChildValue(operationElement, "Password");

            var (success, token, error, userId) = await _authService.RegisterAsync(username ?? string.Empty, email ?? string.Empty, password ?? string.Empty);
            var user = success && userId.HasValue ? await _authService.GetUserByIdAsync(userId.Value) : null;

            return SoapResponse(ServiceElement("RegisterResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("Token", token ?? string.Empty),
                ServiceElement("UserId", userId ?? 0),
                ServiceElement("Username", user?.Username ?? string.Empty),
                ServiceElement("Email", user?.Email ?? string.Empty)));
        }

        private async Task<IResult> HandleLoginAsync(XElement operationElement)
        {
            var email = GetChildValue(operationElement, "Email");
            var password = GetChildValue(operationElement, "Password");

            var (success, token, error, userId) = await _authService.LoginAsync(email ?? string.Empty, password ?? string.Empty);
            var user = success && userId.HasValue ? await _authService.GetUserByIdAsync(userId.Value) : null;

            return SoapResponse(ServiceElement("LoginResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("Token", token ?? string.Empty),
                ServiceElement("UserId", userId ?? 0),
                ServiceElement("Username", user?.Username ?? string.Empty),
                ServiceElement("Email", user?.Email ?? string.Empty)));
        }

        private async Task<IResult> HandleGetCurrentUserAsync(HttpContext context)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("GetCurrentUserResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var user = await _authService.GetUserByIdAsync(userId);
            if (user == null)
            {
                return SoapResponse(ServiceElement("GetCurrentUserResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "User not found")));
            }

            return SoapResponse(ServiceElement("GetCurrentUserResponse",
                ServiceElement("Success", true),
                ServiceElement("Error", string.Empty),
                ServiceElement("Id", user.Id),
                ServiceElement("Username", user.Username),
                ServiceElement("Email", user.Email)));
        }

        private async Task<IResult> HandleSendFriendRequestAsync(HttpContext context, XElement operationElement)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("SendFriendRequestResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var email = GetChildValue(operationElement, "Email");
            var (success, error) = await _friendService.SendFriendRequestAsync(userId, email ?? string.Empty);

            return SoapResponse(ServiceElement("SendFriendRequestResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("Message", success ? "Friend request sent" : string.Empty)));
        }

        private async Task<IResult> HandleAcceptFriendRequestAsync(HttpContext context, XElement operationElement)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("AcceptFriendRequestResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            if (!TryGetInt(operationElement, "RequestId", out var requestId))
            {
                return SoapResponse(ServiceElement("AcceptFriendRequestResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "RequestId is required")));
            }

            var (success, error) = await _friendService.AcceptFriendRequestAsync(userId, requestId);

            return SoapResponse(ServiceElement("AcceptFriendRequestResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("Message", success ? "Friend request accepted" : string.Empty)));
        }

        private async Task<IResult> HandleRejectFriendRequestAsync(HttpContext context, XElement operationElement)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("RejectFriendRequestResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            if (!TryGetInt(operationElement, "RequestId", out var requestId))
            {
                return SoapResponse(ServiceElement("RejectFriendRequestResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "RequestId is required")));
            }

            var (success, error) = await _friendService.RejectFriendRequestAsync(userId, requestId);

            return SoapResponse(ServiceElement("RejectFriendRequestResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("Message", success ? "Friend request rejected" : string.Empty)));
        }

        private async Task<IResult> HandleGetFriendsAsync(HttpContext context)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("GetFriendsResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var friends = await _friendService.GetFriendsAsync(userId);
            var friendsElement = ServiceElement("Friends",
                friends.Select(friend => ServiceElement("Friend",
                    ServiceElement("Id", friend.Id),
                    ServiceElement("Username", friend.Username),
                    ServiceElement("Email", friend.Email))));

            return SoapResponse(ServiceElement("GetFriendsResponse",
                ServiceElement("Success", true),
                ServiceElement("Error", string.Empty),
                friendsElement));
        }

        private async Task<IResult> HandleGetPendingFriendRequestsAsync(HttpContext context)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("GetPendingFriendRequestsResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var requests = await _friendService.GetPendingFriendRequestsAsync(userId);
            var requestsElement = ServiceElement("Requests",
                requests.Select(request => ServiceElement("Request",
                    ServiceElement("Id", request.Id),
                    ServiceElement("CreatedAt", request.CreatedAt.ToString("O")),
                    ServiceElement("From",
                        ServiceElement("Id", request.From.Id),
                        ServiceElement("Username", request.From.Username),
                        ServiceElement("Email", request.From.Email)))));

            return SoapResponse(ServiceElement("GetPendingFriendRequestsResponse",
                ServiceElement("Success", true),
                ServiceElement("Error", string.Empty),
                requestsElement));
        }

        private async Task<IResult> HandleCreateRoomAsync(HttpContext context, XElement operationElement)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("CreateRoomResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var name = GetChildValue(operationElement, "Name") ?? string.Empty;
            var visibility = GetChildValue(operationElement, "Visibility") ?? string.Empty;
            var normalizedName = RoomService.NormalizeRoomName(name);
            var normalizedVisibility = RoomService.NormalizeVisibility(visibility);

            if (normalizedVisibility == null)
            {
                return SoapResponse(ServiceElement("CreateRoomResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Invalid visibility. Must be Public, Private, or Friends")));
            }

            var (success, roomCode, error) = await _roomService.CreateRoomAsync(userId, normalizedName, normalizedVisibility);

            return SoapResponse(ServiceElement("CreateRoomResponse",
                ServiceElement("Success", success),
                ServiceElement("Error", error ?? string.Empty),
                ServiceElement("RoomCode", roomCode ?? string.Empty),
                ServiceElement("Name", normalizedName),
                ServiceElement("Visibility", normalizedVisibility)));
        }

        private async Task<IResult> HandleGetPublicRoomsAsync()
        {
            var rooms = await _roomService.GetPublicRoomsAsync();
            var roomsElement = ServiceElement("Rooms", rooms.Select(room => RoomElement(room)));

            return SoapResponse(ServiceElement("GetPublicRoomsResponse",
                ServiceElement("Success", true),
                ServiceElement("Error", string.Empty),
                roomsElement));
        }

        private async Task<IResult> HandleGetFriendRoomsAsync(HttpContext context)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("GetFriendRoomsResponse",
                    ServiceElement("Success", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var rooms = await _roomService.GetFriendRoomsAsync(userId);
            var roomsElement = ServiceElement("Rooms", rooms.Select(room => RoomElement(room)));

            return SoapResponse(ServiceElement("GetFriendRoomsResponse",
                ServiceElement("Success", true),
                ServiceElement("Error", string.Empty),
                roomsElement));
        }

        private async Task<IResult> HandleCanJoinRoomAsync(HttpContext context, XElement operationElement)
        {
            if (!TryGetUserId(context, out var userId))
            {
                return SoapResponse(ServiceElement("CanJoinRoomResponse",
                    ServiceElement("Success", false),
                    ServiceElement("CanJoin", false),
                    ServiceElement("Error", "Unauthorized")));
            }

            var roomCode = GetChildValue(operationElement, "RoomCode") ?? string.Empty;
            var (canJoin, error) = await _roomService.CanUserJoinRoomAsync(userId, roomCode);

            return SoapResponse(ServiceElement("CanJoinRoomResponse",
                ServiceElement("Success", true),
                ServiceElement("CanJoin", canJoin),
                ServiceElement("Error", error ?? string.Empty)));
        }

        private static XElement RoomElement(RoomSummary room)
        {
            return ServiceElement("Room",
                ServiceElement("RoomCode", room.RoomCode),
                ServiceElement("Name", room.Name),
                ServiceElement("Visibility", room.Visibility),
                ServiceElement("CreatedAt", room.CreatedAt.ToString("O")),
                ServiceElement("LastActivityAt", room.LastActivityAt.ToString("O")),
                ServiceElement("Owner",
                    ServiceElement("Id", room.Owner.Id),
                    ServiceElement("Username", room.Owner.Username)));
        }

        private static string? GetChildValue(XElement parent, string localName)
        {
            var value = parent.Elements()
                .FirstOrDefault(e => string.Equals(e.Name.LocalName, localName, StringComparison.OrdinalIgnoreCase))
                ?.Value;
            return value?.Trim();
        }

        private static bool TryGetInt(XElement parent, string localName, out int value)
        {
            value = 0;
            var raw = GetChildValue(parent, localName);
            return int.TryParse(raw, out value);
        }

        private static bool TryParseSoapBody(string xml, out XElement? operationElement, out string? error)
        {
            operationElement = null;
            error = null;

            try
            {
                var settings = new XmlReaderSettings
                {
                    DtdProcessing = DtdProcessing.Prohibit,
                    XmlResolver = null
                };

                using var stringReader = new StringReader(xml);
                using var reader = XmlReader.Create(stringReader, settings);
                var document = XDocument.Load(reader, LoadOptions.None);

                var envelope = document.Root;
                if (envelope == null || !string.Equals(envelope.Name.LocalName, "Envelope", StringComparison.OrdinalIgnoreCase))
                {
                    error = "Missing SOAP envelope";
                    return false;
                }

                var body = envelope.Elements().FirstOrDefault(e => string.Equals(e.Name.LocalName, "Body", StringComparison.OrdinalIgnoreCase));
                if (body == null)
                {
                    error = "Missing SOAP body";
                    return false;
                }

                operationElement = body.Elements().FirstOrDefault(e => e.NodeType == XmlNodeType.Element);
                if (operationElement == null)
                {
                    error = "Missing SOAP operation";
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                error = $"Invalid XML: {ex.Message}";
                return false;
            }
        }

        private static bool TryGetUserId(HttpContext context, out int userId)
        {
            userId = 0;
            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out userId))
            {
                return false;
            }

            return true;
        }

        private static async Task<string> ReadRequestBodyAsync(HttpRequest request)
        {
            using var reader = new StreamReader(request.Body, Encoding.UTF8);
            return await reader.ReadToEndAsync();
        }

        private static IResult SoapResponse(XElement bodyContent)
        {
            var document = new XDocument(
                new XDeclaration("1.0", "utf-8", null),
                new XElement(SoapNs + "Envelope",
                    new XAttribute(XNamespace.Xmlns + "soap", SoapNs),
                    new XAttribute(XNamespace.Xmlns + "wp", ServiceNs),
                    new XElement(SoapNs + "Body", bodyContent))
            );

            return Results.Text(document.ToString(SaveOptions.DisableFormatting), "text/xml", Encoding.UTF8);
        }

        private static XElement ServiceElement(string localName, params object[] content)
        {
            return new XElement(ServiceNs + localName, content);
        }
    }
}
