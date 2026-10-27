#include "Library.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cstring>
#include <cstdlib>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <signal.h>

static int server_socket = -1;

void handleSigint(int) {
    if (server_socket >= 0) {
        close(server_socket);
    }
    std::cout << "\n[LibTrack Server] Shutting down gracefully.\n";
    exit(0);
}

// Lightweight JSON parsing helpers
static std::string extractJsonString(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return "";

    pos += pattern.length();
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == ':' || json[pos] == '\t')) pos++;

    if (pos < json.length() && json[pos] == '"') {
        pos++;
        size_t endPos = pos;
        while (endPos < json.length() && json[endPos] != '"') {
            if (json[endPos] == '\\' && endPos + 1 < json.length()) endPos += 2;
            else endPos++;
        }
        return json.substr(pos, endPos - pos);
    }
    return "";
}

static int extractJsonInt(const std::string& json, const std::string& key, int defaultVal = 1) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return defaultVal;

    pos += pattern.length();
    while (pos < json.length() && (json[pos] == ' ' || json[pos] == ':' || json[pos] == '\t')) pos++;

    size_t endPos = pos;
    while (endPos < json.length() && ((json[endPos] >= '0' && json[endPos] <= '9') || json[endPos] == '-')) endPos++;

    if (endPos > pos) {
        try {
            return std::stoi(json.substr(pos, endPos - pos));
        } catch (...) {}
    }
    return defaultVal;
}

static std::string readFileContents(const std::string& filepath) {
    std::ifstream file(filepath, std::ios::binary);
    if (!file.is_open()) return "";
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

static void sendHttpResponse(int client_fd, int statusCode, const std::string& statusText,
                             const std::string& contentType, const std::string& body) {
    std::ostringstream response;
    response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n"
             << "Content-Type: " << contentType << "; charset=utf-8\r\n"
             << "Content-Length: " << body.length() << "\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Connection: close\r\n\r\n"
             << body;

    std::string str = response.str();
    write(client_fd, str.c_str(), str.length());
}

int main(int argc, char* argv[]) {
    signal(SIGINT, handleSigint);
    signal(SIGTERM, handleSigint);

    int port = 8080;
    if (argc > 1) {
        port = std::atoi(argv[1]);
    } else if (const char* envPort = std::getenv("PORT")) {
        port = std::atoi(envPort);
    }

    Library library;

    server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket < 0) {
        std::cerr << "Failed to create socket.\n";
        return 1;
    }

    int opt = 1;
    setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(port);

    if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        std::cerr << "Failed to bind to port " << port << ".\n";
        close(server_socket);
        return 1;
    }

    if (listen(server_socket, 20) < 0) {
        std::cerr << "Failed to listen on socket.\n";
        close(server_socket);
        return 1;
    }

    std::cout << "========================================================\n";
    std::cout << " LibTrack C++ DSA Backend running on http://localhost:" << port << "\n";
    std::cout << " Serving Static Website and REST API endpoints\n";
    std::cout << "========================================================\n";

    while (true) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_socket, (struct sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) continue;

        std::string request = "";
        char buffer[4096];
        ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
        if (bytes_read <= 0) {
            close(client_fd);
            continue;
        }
        request.append(buffer, bytes_read);

        // Ensure full headers are read
        size_t header_end = request.find("\r\n\r\n");
        while (header_end == std::string::npos) {
            bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
            if (bytes_read <= 0) break;
            request.append(buffer, bytes_read);
            header_end = request.find("\r\n\r\n");
        }

        if (header_end == std::string::npos) {
            close(client_fd);
            continue;
        }

        // Extract Content-Length if present
        size_t cl_pos = request.find("Content-Length:");
        if (cl_pos == std::string::npos) cl_pos = request.find("content-length:");
        size_t content_length = 0;
        if (cl_pos != std::string::npos && cl_pos < header_end) {
            size_t val_start = cl_pos + 15;
            while (val_start < header_end && (request[val_start] == ' ' || request[val_start] == '\t')) val_start++;
            size_t val_end = request.find("\r\n", val_start);
            if (val_end != std::string::npos) {
                try {
                    content_length = std::stoul(request.substr(val_start, val_end - val_start));
                } catch (...) {}
            }
        }

        // Read remaining body bytes if needed
        while (request.length() < header_end + 4 + content_length) {
            bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
            if (bytes_read <= 0) break;
            request.append(buffer, bytes_read);
        }

        std::istringstream request_stream(request);
        std::string method, path, http_version;
        request_stream >> method >> path >> http_version;

        std::string body = "";
        if (request.length() >= header_end + 4) {
            body = request.substr(header_end + 4, content_length > 0 ? content_length : std::string::npos);
        }

        // Handle CORS preflight
        if (method == "OPTIONS") {
            sendHttpResponse(client_fd, 204, "No Content", "text/plain", "");
            close(client_fd);
            continue;
        }

        // ---------------------------------------------------------------------
        // REST API Routes
        // ---------------------------------------------------------------------

        if (method == "GET" && path == "/api/books") {
            sendHttpResponse(client_fd, 200, "OK", "application/json", library.getBooksJson());
        }
        else if (method == "GET" && path.rfind("/api/books/", 0) == 0) {
            std::string id = path.substr(11);
            std::string bookJson = library.getBookJson(id);
            if (bookJson == "{}") {
                sendHttpResponse(client_fd, 404, "Not Found", "application/json", "{\"error\":\"Book not found\"}");
            } else {
                sendHttpResponse(client_fd, 200, "OK", "application/json", bookJson);
            }
        }
        else if (method == "POST" && path == "/api/books") {
            std::string id = extractJsonString(body, "id");
            std::string title = extractJsonString(body, "title");
            std::string author = extractJsonString(body, "author");
            int totalCopies = extractJsonInt(body, "totalCopies", 1);
            int coverStyle = extractJsonInt(body, "coverStyle", 1);

            if (author.empty()) author = "Author Unknown";

            Book newBook{id, title, author, totalCopies, totalCopies, {}, coverStyle};
            std::string errorMsg;
            if (library.addBook(newBook, errorMsg)) {
                sendHttpResponse(client_fd, 201, "Created", "application/json",
                                 "{\"message\":\"Book added successfully\",\"id\":\"" + id + "\"}");
            } else {
                sendHttpResponse(client_fd, 400, "Bad Request", "application/json",
                                 "{\"error\":\"" + errorMsg + "\"}");
            }
        }
        else if (method == "DELETE" && path.rfind("/api/books/", 0) == 0) {
            std::string id = path.substr(11);
            std::string errorMsg;
            if (library.removeBook(id, errorMsg)) {
                sendHttpResponse(client_fd, 200, "OK", "application/json",
                                 "{\"message\":\"Book deleted successfully\",\"id\":\"" + id + "\"}");
            } else {
                int status = (errorMsg.find("not found") != std::string::npos) ? 404 : 400;
                sendHttpResponse(client_fd, status, status == 404 ? "Not Found" : "Bad Request", "application/json",
                                 "{\"error\":\"" + errorMsg + "\"}");
            }
        }
        else if (method == "GET" && path == "/api/stats") {
            sendHttpResponse(client_fd, 200, "OK", "application/json", library.getStatsJson());
        }
        else if (method == "POST" && path == "/api/borrow") {
            std::string bookId = extractJsonString(body, "bookId");
            std::string studentId = extractJsonString(body, "studentId");
            std::string studentName = extractJsonString(body, "studentName");
            std::string err;
            bool canQueue = false;
            if (library.borrowBook(bookId, studentId, studentName, err, canQueue)) {
                sendHttpResponse(client_fd, 200, "OK", "application/json", "{\"message\":\"Book borrowed successfully\"}");
            } else {
                std::string res = "{\"error\":\"" + err + "\",\"canQueue\":" + (canQueue ? "true" : "false") + "}";
                sendHttpResponse(client_fd, 400, "Bad Request", "application/json", res);
            }
        }
        else if (method == "POST" && path == "/api/return") {
            std::string bookId = extractJsonString(body, "bookId");
            std::string studentName = extractJsonString(body, "studentName");
            std::string studentId = extractJsonString(body, "studentId");
            std::string studentInfo = !studentId.empty() ? studentId : studentName;
            std::string resultMsg, err;
            if (library.returnBook(bookId, studentInfo, resultMsg, err)) {
                sendHttpResponse(client_fd, 200, "OK", "application/json", "{\"message\":\"" + resultMsg + "\"}");
            } else {
                sendHttpResponse(client_fd, 400, "Bad Request", "application/json", "{\"error\":\"" + err + "\"}");
            }
        }
        else if (method == "GET" && path == "/api/queue") {
            sendHttpResponse(client_fd, 200, "OK", "application/json", library.getQueueJson());
        }
        else if (method == "POST" && path == "/api/queue") {
            std::string studentId = extractJsonString(body, "studentId");
            std::string studentName = extractJsonString(body, "studentName");
            std::string bookId = extractJsonString(body, "bookId");
            std::string wantsTitle = extractJsonString(body, "wantsTitle");

            if (studentId.empty()) studentId = "S-" + std::to_string(rand() % 900 + 100);
            if (wantsTitle.empty()) {
                const Book* b = library.findBook(bookId);
                wantsTitle = b ? b->title : "Requested Book";
            }

            library.enqueueRequest({studentId, studentName, bookId, wantsTitle});
            sendHttpResponse(client_fd, 201, "Created", "application/json", "{\"message\":\"Request enqueued\"}");
        }
        else if (method == "POST" && (path == "/api/queue/serve" || path == "/api/serve")) {
            StudentRequest served;
            std::string resultMsg;
            if (library.serveNextRequest(served, resultMsg)) {
                std::string res = "{\"message\":\"" + resultMsg + "\",\"studentName\":\"" + served.studentName +
                                  "\",\"bookId\":\"" + served.bookId + "\"}";
                sendHttpResponse(client_fd, 200, "OK", "application/json", res);
            } else {
                sendHttpResponse(client_fd, 400, "Bad Request", "application/json", "{\"error\":\"" + resultMsg + "\"}");
            }
        }
        else if (method == "GET" && path == "/api/returns") {
            sendHttpResponse(client_fd, 200, "OK", "application/json", library.getReturnsJson());
        }
        else if (method == "GET" && path == "/api/structures") {
            sendHttpResponse(client_fd, 200, "OK", "application/json", library.getStructuresJson());
        }

        // ---------------------------------------------------------------------
        // Static Web Asset Serving
        // ---------------------------------------------------------------------
        else if (method == "GET" && (path == "/" || path == "/index.html")) {
            std::string content = readFileContents("index.html");
            if (!content.empty()) {
                sendHttpResponse(client_fd, 200, "OK", "text/html", content);
            } else {
                sendHttpResponse(client_fd, 404, "Not Found", "text/plain", "index.html not found");
            }
        }
        else if (method == "GET" && path == "/style.css") {
            std::string content = readFileContents("style.css");
            if (!content.empty()) {
                sendHttpResponse(client_fd, 200, "OK", "text/css", content);
            } else {
                sendHttpResponse(client_fd, 404, "Not Found", "text/plain", "style.css not found");
            }
        }
        else if (method == "GET" && path == "/script.js") {
            std::string content = readFileContents("script.js");
            if (!content.empty()) {
                sendHttpResponse(client_fd, 200, "OK", "application/javascript", content);
            } else {
                sendHttpResponse(client_fd, 404, "Not Found", "text/plain", "script.js not found");
            }
        }
        else {
            sendHttpResponse(client_fd, 404, "Not Found", "application/json", "{\"error\":\"Endpoint or file not found\"}");
        }

        close(client_fd);
    }

    close(server_socket);
    return 0;
}
