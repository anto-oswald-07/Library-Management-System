#ifndef LIBRARY_H
#define LIBRARY_H

#include "DataStructures.h"
#include <string>
#include <sstream>

inline std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else o << c;
    }
    return o.str();
}

class Library {
private:
    BookLinkedList bookList;
    BookBST bookBst;
    RequestQueue requestQueue;
    ReturnStack returnStack;

public:
    Library();
    ~Library() = default;

    // Core Domain Operations
    bool addBook(const Book& book, std::string& errorMsg);
    bool removeBook(const std::string& id, std::string& errorMsg);
    bool removeBook(const std::string& id);
    Book* findBook(const std::string& id);
    const Book* findBook(const std::string& id) const;

    bool borrowBook(const std::string& bookId, const std::string& studentId, const std::string& studentName,
                    std::string& errorMsg, bool& canQueue);
    bool returnBook(const std::string& bookId, const std::string& studentInfo,
                    std::string& resultMsg, std::string& errorMsg);

    void enqueueRequest(const StudentRequest& req);
    bool serveNextRequest(StudentRequest& outReq, std::string& resultMsg);

    // Serialization for API Responses
    std::string getBooksJson() const;
    std::string getBookJson(const std::string& id) const;
    std::string getQueueJson() const;
    std::string getReturnsJson() const;
    std::string getStructuresJson() const;
    std::string getStatsJson() const;

    // Initializer
    void seedSampleData();
};

#endif // LIBRARY_H
