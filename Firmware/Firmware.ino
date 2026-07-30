#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include <ESP32Servo.h>

// ---------------------------------------------------------
// SINGLE SERVO CALIBRATION SETUP
// ---------------------------------------------------------
Servo testServo;

// Connect the signal wire of the single servo to GPIO 12
const int SERVO_PIN = 12;

// ---------------------------------------------------------
// WIFI & WEBSERVER SETUP
// ---------------------------------------------------------
const char* ssid = "Hexapod-AP";
const char* password = "password123"; // Minimum 8 characters

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

void setupServos() {
  ESP32PWM::allocateTimer(0);
  testServo.setPeriodHertz(50);
  
  // Attach servo to pin 12. 
  // 500us and 2400us are standard limits for 0 and 180 degrees.
  testServo.attach(SERVO_PIN, 500, 2400);
}

void setServoAngle(uint8_t angle) {
  testServo.write(angle);
}

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  
  // We expect a binary frame of exactly 20 bytes 
  if (info->final && info->index == 0 && info->len == len && info->opcode == WS_BINARY) {
    if (len == 20 && data[0] == 0xAA) {
      
      // For this single-motor test, let's just grab the FIRST angle 
      // which corresponds to Leg 1 Coxa, and send it to our single servo.
      uint8_t leg1CoxaAngle = data[2]; 
      setServoAngle(leg1CoxaAngle);
    }
  }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected\n", client->id());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      handleWebSocketMessage(arg, data, len);
      break;
    case WS_EVT_PONG:
    case WS_EVT_ERROR:
      break;
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize single servo
  setupServos();
  Serial.println("Single test servo initialized.");

  // Force the servo to exactly 90 degrees on boot so you can attach the horn!
  Serial.println("Centering test servo to 90 degrees...");
  setServoAngle(90);
  delay(500); 

  // Initialize LittleFS
  if (!LittleFS.begin()) {
    Serial.println("An Error has occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully.");

  // Start Access Point
  Serial.println("Setting up Access Point...");
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);

  // Serve static files from LittleFS
  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");

  // Setup WebSocket
  ws.onEvent(onEvent);
  server.addHandler(&ws);

  // Start server
  server.begin();
  Serial.println("HTTP Server started.");
}

void loop() {
  ws.cleanupClients();
}
