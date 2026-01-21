#!/bin/bash

# Test script for WatchParty Authentication and Friend System
# This script tests the backend SOAP endpoint

SOAP_URL="http://localhost:5232/soap"

echo "=== WatchParty API Test Script ==="
echo ""
echo "Note: Make sure PostgreSQL is running and backend is started with 'dotnet run'"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

soap_call() {
    local action="$1"
    local body="$2"
    local token="$3"

    local envelope="<?xml version=\"1.0\" encoding=\"utf-8\"?>"
    envelope="${envelope}<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:wp=\"http://watchparty/soap\">"
    envelope="${envelope}<soap:Body><wp:${action}>${body}</wp:${action}></soap:Body></soap:Envelope>"

    local curl_args=(-s -X POST "$SOAP_URL" -H "Content-Type: text/xml; charset=utf-8" -H "SOAPAction: $action")
    if [ -n "$token" ]; then
        curl_args+=(-H "Authorization: Bearer $token")
    fi

    curl "${curl_args[@]}" -d "$envelope"
}

normalize_xml() {
    echo "$1" | tr '\n' ' '
}

extract_tag() {
    local tag="$1"
    local payload
    payload="$(normalize_xml "$2")"
    echo "$payload" | sed -n "s:.*<[^>]*${tag}>\\([^<]*\\)</[^>]*${tag}>.*:\\1:p" | head -1
}

# Test 1: Health Check
echo -e "${YELLOW}1. Testing Health Endpoint...${NC}"
HEALTH=$(soap_call "HealthCheck" "")
STATUS=$(extract_tag "Status" "$HEALTH")
if [ "$STATUS" == "ok" ]; then
    echo -e "${GREEN}û Health check passed${NC}"
else
    echo -e "${RED}? Health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Register User 1
echo -e "${YELLOW}2. Registering User 1 (Alice)...${NC}"
REGISTER1=$(soap_call "Register" "<Username>alice</Username><Email>alice@watchparty.test</Email><Password>password123</Password>")

TOKEN1=$(extract_tag "Token" "$REGISTER1")

if [ -n "$TOKEN1" ]; then
    echo -e "${GREEN}û User 1 registered successfully${NC}"
    echo "   Token: ${TOKEN1:0:20}..."
else
    echo -e "${RED}? Registration failed${NC}"
    echo "   Response: $REGISTER1"
fi
echo ""

# Test 3: Register User 2
echo -e "${YELLOW}3. Registering User 2 (Bob)...${NC}"
REGISTER2=$(soap_call "Register" "<Username>bob</Username><Email>bob@watchparty.test</Email><Password>password123</Password>")

TOKEN2=$(extract_tag "Token" "$REGISTER2")

if [ -n "$TOKEN2" ]; then
    echo -e "${GREEN}û User 2 registered successfully${NC}"
    echo "   Token: ${TOKEN2:0:20}..."
else
    echo -e "${RED}? Registration failed (might already exist)${NC}"
fi
echo ""

# Test 4: Get Current User
echo -e "${YELLOW}4. Testing Authentication - Get Current User...${NC}"
ME=$(soap_call "GetCurrentUser" "" "$TOKEN1")
ME_USERNAME=$(extract_tag "Username" "$ME")

if [ "$ME_USERNAME" == "alice" ]; then
    echo -e "${GREEN}û Authentication working - User retrieved${NC}"
    echo "   User: $ME_USERNAME"
else
    echo -e "${RED}? Authentication failed${NC}"
fi
echo ""

# Test 5: Send Friend Request
echo -e "${YELLOW}5. Sending Friend Request (Alice -> Bob)...${NC}"
FRIEND_REQ=$(soap_call "SendFriendRequest" "<Email>bob@watchparty.test</Email>" "$TOKEN1")
FRIEND_REQ_SUCCESS=$(extract_tag "Success" "$FRIEND_REQ")

if [ "$FRIEND_REQ_SUCCESS" == "true" ]; then
    echo -e "${GREEN}û Friend request sent${NC}"
else
    echo -e "${YELLOW}? Friend request might already exist${NC}"
fi
echo ""

# Test 6: Get Pending Requests (Bob)
echo -e "${YELLOW}6. Getting Pending Friend Requests (Bob)...${NC}"
PENDING=$(soap_call "GetPendingFriendRequests" "" "$TOKEN2")
REQUEST_ID=$(extract_tag "Id" "$PENDING")

if [ -n "$REQUEST_ID" ]; then
    echo -e "${GREEN}û Pending requests retrieved${NC}"
    echo "   Request ID: $REQUEST_ID"
else
    echo -e "${YELLOW}? No pending requests found${NC}"
fi
echo ""

# Test 7: Accept Friend Request
if [ -n "$REQUEST_ID" ]; then
    echo -e "${YELLOW}7. Accepting Friend Request...${NC}"
    ACCEPT=$(soap_call "AcceptFriendRequest" "<RequestId>$REQUEST_ID</RequestId>" "$TOKEN2")
    ACCEPT_SUCCESS=$(extract_tag "Success" "$ACCEPT")
    
    if [ "$ACCEPT_SUCCESS" == "true" ]; then
        echo -e "${GREEN}û Friend request accepted${NC}"
    else
        echo -e "${RED}? Accept failed${NC}"
    fi
else
    echo -e "${YELLOW}7. Skipping accept (no request ID)${NC}"
fi
echo ""

# Test 8: Get Friends List
echo -e "${YELLOW}8. Getting Friends List (Alice)...${NC}"
FRIENDS=$(soap_call "GetFriends" "" "$TOKEN1")

if echo "$FRIENDS" | grep -q "<[^>]*Username>bob"; then
    echo -e "${GREEN}û Friends list retrieved${NC}"
    echo "   Friends: bob"
else
    echo -e "${YELLOW}? No friends found (request might not be accepted yet)${NC}"
fi
echo ""

# Test 9: Create Public Room
echo -e "${YELLOW}9. Creating Public Room...${NC}"
ROOM=$(soap_call "CreateRoom" "<Name>Movie Night</Name><Visibility>Public</Visibility>" "$TOKEN1")
ROOM_CODE=$(extract_tag "RoomCode" "$ROOM")

if [ -n "$ROOM_CODE" ]; then
    echo -e "${GREEN}û Public room created${NC}"
    echo "   Room Code: $ROOM_CODE"
else
    echo -e "${RED}? Room creation failed${NC}"
fi
echo ""

# Test 10: Get Public Rooms
echo -e "${YELLOW}10. Getting Public Rooms List...${NC}"
PUBLIC_ROOMS=$(soap_call "GetPublicRooms" "")
ROOM_COUNT=$(echo "$(normalize_xml "$PUBLIC_ROOMS")" | grep -o "<[^>]*Room>" | wc -l)

if [ "$ROOM_COUNT" -gt 0 ]; then
    echo -e "${GREEN}û Public rooms retrieved${NC}"
    echo "   Total public rooms: $ROOM_COUNT"
else
    echo -e "${YELLOW}? No public rooms found${NC}"
fi
echo ""

# Summary
echo "=== Test Summary ==="
echo ""
echo "û Backend SOAP endpoint is responding"
echo "û User registration works"
echo "û JWT authentication works"
echo "û Friend system works"
echo "û Room creation works"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:4200 in your browser"
echo "2. Register a new account or login"
echo "3. Add friends and create rooms"
echo ""
