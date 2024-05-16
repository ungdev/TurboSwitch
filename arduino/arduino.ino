#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <HTTPClient.h>
#include <Keypad.h>

// Preferences
#define WIFI_SSID "eduroam"
#define WIFI_IDENTITY "ung" // Should be the same as the username
#define WIFI_USERNAME "ung"
#define WIFI_PASSWORD "aaaa"

#define INTERVAL 120 // Interval in seconds to ping the server

#define HTTP_SERVER "https://turboswitch.assos.utt.fr"
#define BEARER_PASSWORD "test"

// Time variables
#define NTP_SERVER "time.nist.gov"
#define NTP_OFFSET 3600 * 1
#define NTP_DAYLIGHT 3600 * 0

// Hardware pins
#define MOTOR 7
#define BUZZER 1
#define RESET 5

#define CODE_LENGTH 4

const byte ROWS = 4; // four rows
const byte COLS = 3; // four columns

char hexaKeys[ROWS][COLS] = {
    {'1', '2', '3'},
    {'4', '5', '6'},
    {'7', '8', '9'},
    {'C', '0', 'E'}};
byte rowPins[ROWS] = {22, 21, 19, 9}; // connect to the row pinouts of the keypad
byte colPins[COLS] = {23, 20, 18};    // connect to the column pinouts of the keypad

// initialize an instance of class NewKeypad
Keypad customKeypad = Keypad(makeKeymap(hexaKeys), rowPins, colPins, ROWS, COLS);

unsigned long lastPing = millis() - 120000;
unsigned long lastAttempt = millis();

bool resetting = false;

String code = "";

bool serverTimeEnabled = true;

bool isWifiConnected = false;

WiFiClientSecure client;
HTTPClient http;

// Function to get current time
tm getTime()
{
    struct tm timeinfo;
    if (serverTimeEnabled && isWifiConnected && !getLocalTime(&timeinfo))
    {
        Serial.println("Failed to obtain time");
        serverTimeEnabled = false;
    }

    return timeinfo;
}

// Function to log messages
void logging(const char *title, const char *message)
{
    String time;
    if (serverTimeEnabled && isWifiConnected)
    {
        tm timeinfo = getTime();
        time = "[" + String(timeinfo.tm_hour) + ":" + String(timeinfo.tm_min) + ":" + String(timeinfo.tm_sec) + "]";
    }
    else
    {
        time = "[00:00:00]";
    }

    Serial.println(time + " [" + title + "] " + message);
}

// Function to handle WiFi events
void WiFiEvent(WiFiEvent_t event)
{
    switch (event)
    {
    case WIFI_EVENT_STA_DISCONNECTED:
        // We have lost connection to the WiFi network
        logging("WiFi", "Disconnected from WiFi");

        isWifiConnected = false;
        break;
    default:
        break;
    }
}

void buzzer(int freq, int duration)
{
    tone(BUZZER, freq);
    delay(duration);
    noTone(BUZZER);
}

// Function to setup wifi connection
bool setupWifiConnection()
{
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WPA2_AUTH_PEAP, WIFI_IDENTITY, WIFI_USERNAME, WIFI_PASSWORD);
    logging("WiFi", ("Connecting to SSID \"" + String(WIFI_SSID) + "\"").c_str());

    unsigned long startAttemptTime = millis();

    while (WiFi.status() != WL_CONNECTED)
    {
        if (WiFi.status() == WL_CONNECT_FAILED || millis() - startAttemptTime > 20000)
        {
            return false;
        }
        delay(100);
    }
    
    logging("WiFi", "Connected to the WiFi network");
    logging("WiFi", ("Local ESP32 IP: " + WiFi.localIP().toString()).c_str());

    configTime(NTP_OFFSET, NTP_DAYLIGHT, NTP_SERVER);

    WiFi.onEvent(WiFiEvent);

    return true;
}

int sendHTTPRequest(bool isPost, const String &endpoint, const String &body)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        logging("WiFi", "WiFi not connected");
        return -1; // Return an error code if not connected
    }

    logging("HTTP", ("Sending " + String(isPost ? "POST" : "GET") + " request to " + endpoint + " with body: " + body).c_str());

    client.setInsecure();

    http.begin(client, HTTP_SERVER + endpoint);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + String(BEARER_PASSWORD));

    int httpResponseCode = 0;

    if (isPost)
    {
        httpResponseCode = http.POST(body);
    }
    else
    {
        httpResponseCode = http.GET();
    }

    http.end();

    logging("HTTP", ("HTTP Response code: " + String(httpResponseCode)).c_str());

    return httpResponseCode;
}

void reset()
{
    resetting = true;
}

void setup()
{
    Serial.begin(115200);

    pinMode(MOTOR, OUTPUT);
    pinMode(RESET, INPUT_PULLUP);
    pinMode(BUZZER, OUTPUT);

    // Setup the WiFi connection
    isWifiConnected = setupWifiConnection();

    if (!isWifiConnected)
    {
        logging("WiFi", "Failed to connect to the WiFi network");
        return;
    }

    attachInterrupt(digitalPinToInterrupt(RESET), reset, CHANGE);

    logging("Boot", "Setup ended successfully");
}

void loop()
{
    if (resetting)
    {
        logging("Reset", "Button pressed");
        delay(1000);
        if (digitalRead(RESET) == HIGH)
        {
            buzzer(4000, 250);
            ESP.restart();
        }
        else
        {
            logging("Reset", "Button pressed for less than 1 second");
            resetting = false;
        }
    }

    // Each 2 minutes, ping the server
    if (millis() - lastPing > INTERVAL * 1000)
    {
        logging("HTTP", "Pinging server");
        int httpResponseCode = sendHTTPRequest(false, String("/api/ping?interval=" + INTERVAL), "");

        if (httpResponseCode == 200)
        {
            logging("HTTP", "Server is reachable");
        }
        else
        {
            logging("HTTP", "Server is unreachable");
            // TODO: Handle server unreachable
        }

        lastPing = millis();
    }

    char customKey = customKeypad.getKey();

    if (customKey)
    {
        if (customKey == 'C')
        {
            buzzer(1200, 180);
            code = "";
        }
        else if (customKey == 'E')
        {
            logging("Current attempt", ("Sending code " + String(code) + " to server").c_str());

            if (code.length() != CODE_LENGTH)
            {
                buzzer(4000, 400);
                code = "";
                return;
            }
            
            int httpResponseCode = sendHTTPRequest(true, "/api/sesame", "{\"code\":\"" + code + "\"}");
            if (httpResponseCode == 200)
            {
                logging("Door", "Door is opened");
                digitalWrite(MOTOR, HIGH);

                buzzer(430, 240);
                buzzer(466, 240);
                buzzer(500, 240);
                buzzer(525, 350);

                delay(10000);
                digitalWrite(MOTOR, LOW);
                logging("Door", "Door is closed");
            }
            else
            {
                logging("Door", "Door is not opened");
                buzzer(494, 150);
                buzzer(698, 150);
                delay(150);
                buzzer(698, 150);
                buzzer(698, 150);
                buzzer(659, 150);
                buzzer(587, 150);
                buzzer(523, 150);
                buzzer(330, 150);
                delay(100);
                buzzer(330, 150);
                buzzer(262, 300);
            }
            code = "";
        }
        else
        {
            buzzer(1000, 200);
            code += customKey;

            lastAttempt = millis();

            logging("Current attempt", code.c_str());
        }

        if (code.length() > CODE_LENGTH)
        {
            buzzer(4000, 400);
            code = "";
        }
    }

    if (millis() - lastAttempt > 60000)
    {
        code = "";
    }
}
