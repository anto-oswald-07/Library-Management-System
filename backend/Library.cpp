#include "Library.h"
#include <sstream>
#include <iomanip>

static std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\b') o << "\\b";
        else if (c == '\f') o << "\\f";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "\\r";
        else if (c == '\t') o << "\\t";
        else if ('\x00' <= c && c <= '\x1f') {
            o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
        } else {
            o << c;
        }
    }
    return o.str();
}

Library::Library() {
    seedSampleData();
}

void Library::seedSampleData() {
    std::string err;
    // B-101: 1 copy, available
    addBook({"B-101", "The Design of Everyday Things", "Don Norman", 1, 1, {}, 1}, err);

    // B-102: 1 copy, borrowed by Elena Rostova
    addBook({"B-102", "Structure and Interpretation of Com...", "Harold Abelson", 1, 0, {{"S-101", "Elena Rostova"}}, 2}, err);

    // B-103: 1 copy, available
    addBook({"B-103", "Clean Code: A Handbook of Agile Craft", "Robert C. Martin", 1, 1, {}, 3}, err);

    // B-104: 1 copy, borrowed by Marcus Vance
    addBook({"B-104", "Introduction to Algorithms (CLRS)", "Thomas H. Cormen", 1, 0, {{"S-103", "Marcus Vance"}}, 4}, err);

    // B-105: 2 copies, 2 available
    addBook({"B-105", "Graphic Storytelling & Visual Narrative", "Will Eisner", 2, 2, {}, 5}, err);

    // Seed FIFO Queue
    enqueueRequest({"S-101", "Elena Rostova", "B-104", "Introduction to Algorithms (CLRS)"});
    enqueueRequest({"S-102", "Julian Thorne", "B-102", "Structure and Interpretation of Comp..."});

    // Seed LIFO Return Stack
    returnStack.push({"B-107", "Designing Data-Intensive Applications", "Julian Thorne", "45 mins ago", 1});
    returnStack.push({"B-106", "Refactoring: Improving Existing Code", "Elena Rostova", "Just now", 2});
}

bool Library::addBook(const Book& book, std::string& errorMsg) {
    if (book.id.empty() || book.title.empty()) {
        errorMsg = "Book ID and title cannot be empty.";
        return false;
    }
    if (book.totalCopies <= 0) {
        errorMsg = "Total copies must be at least 1.";
        return false;
    }

    if (bookBst.search(book.id)) {
        errorMsg = "Duplicate Book ID: " + book.id + " already exists in catalog.";
        return false;
    }

    bookList.insertBack(book);
    bookBst.insert(book.id);
    return true;
}

bool Library::removeBook(const std::string& id, std::string& errorMsg) {
    Book* book = findBook(id);
    if (!book) {
        errorMsg = "Book not found: " + id;
        return false;
    }

    // Validation rule 1: Do not permit deleting a book with active loans
    if (!book->activeLoans.empty() || book->availableCopies < book->totalCopies) {
        errorMsg = "Cannot delete [" + id + "]: book currently has active loans. Return all copies first.";
        return false;
    }

    // Validation rule 2: Do not permit deleting a book with pending requests in waiting queue
    bool hasPendingQueue = false;
    requestQueue.traverse([&](const StudentRequest& r) {
        if (r.bookId == id) hasPendingQueue = true;
    });
    if (hasPendingQueue) {
        errorMsg = "Cannot delete [" + id + "]: book currently has pending waiting queue requests.";
        return false;
    }

    bookBst.remove(id);
    bookList.remove(id);
    return true;
}

bool Library::removeBook(const std::string& id) {
    std::string err;
    return removeBook(id, err);
}

Book* Library::findBook(const std::string& id) {
    if (!bookBst.search(id)) return nullptr;
    return bookList.find(id);
}

const Book* Library::findBook(const std::string& id) const {
    if (!bookBst.search(id)) return nullptr;
    return bookList.find(id);
}

bool Library::borrowBook(const std::string& bookId, const std::string& studentId, const std::string& studentName,
                         std::string& errorMsg, bool& canQueue) {
    canQueue = false;
    Book* book = findBook(bookId);
    if (!book) {
        errorMsg = "Book not found: " + bookId;
        return false;
    }

    if (studentName.empty() && studentId.empty()) {
        errorMsg = "Student name or ID is required to borrow a book.";
        return false;
    }

    if (book->availableCopies <= 0) {
        canQueue = true;
        errorMsg = "No copies of \"" + book->title + "\" are currently available.";
        return false;
    }

    // Record checkout
    std::string sId = studentId.empty() ? ("S-" + std::to_string(rand() % 900 + 100)) : studentId;
    std::string sName = studentName.empty() ? "Reader " + sId : studentName;

    book->availableCopies--;
    book->activeLoans.push_back({sId, sName});
    return true;
}

bool Library::returnBook(const std::string& bookId, const std::string& studentInfo,
                         std::string& resultMsg, std::string& errorMsg) {
    Book* book = findBook(bookId);
    if (!book) {
        errorMsg = "Book not found: " + bookId;
        return false;
    }

    LoanRecord loan;
    bool foundLoan = book->removeLoan(studentInfo, loan);

    if (!foundLoan) {
        if (!studentInfo.empty()) {
            errorMsg = "Student \"" + studentInfo + "\" does not have [" + bookId + "] checked out.";
            return false;
        } else if (book->activeLoans.empty()) {
            errorMsg = "All copies of [" + bookId + "] are already returned to the shelf.";
            return false;
        } else {
            // Default to oldest loan if no specific student provided
            loan = book->activeLoans.front();
            book->activeLoans.erase(book->activeLoans.begin());
        }
    }

    book->availableCopies++;

    // Push to LIFO return history stack
    ReturnRecord record;
    record.bookId = book->id;
    record.title = book->title;
    record.studentName = loan.studentName;
    record.timeAgo = "Just now";
    record.coverStyle = book->coverStyle;
    returnStack.push(record);

    resultMsg = "Book \"" + book->title + "\" successfully returned from " + loan.studentName + ".";

    // FIFO Rule: Check if a waiting student in queue wants this returned book
    StudentRequest waitingReq;
    bool dequeued = requestQueue.dequeueFirstMatching([&](const StudentRequest& r) {
        return r.bookId == bookId;
    }, waitingReq);

    if (dequeued) {
        // Allocate copy to waiting student
        book->availableCopies--;
        book->activeLoans.push_back({waitingReq.studentId, waitingReq.studentName});
        resultMsg += " Immediately allocated to waiting student " + waitingReq.studentName + " (" + waitingReq.studentId + ")!";
    }

    return true;
}

void Library::enqueueRequest(const StudentRequest& req) {
    requestQueue.enqueue(req);
}

bool Library::serveNextRequest(StudentRequest& outReq, std::string& resultMsg) {
    if (requestQueue.isEmpty()) {
        resultMsg = "Waiting queue is currently empty.";
        return false;
    }

    // Find the first eligible request in FIFO order whose book has available copies
    bool served = requestQueue.dequeueFirstMatching([&](const StudentRequest& r) {
        Book* b = findBook(r.bookId);
        return b && b->availableCopies > 0;
    }, outReq);

    if (!served) {
        resultMsg = "No eligible requests: none of the books requested by waiting students are currently available on shelves.";
        return false;
    }

    Book* book = findBook(outReq.bookId);
    if (book) {
        book->availableCopies--;
        book->activeLoans.push_back({outReq.studentId, outReq.studentName});
        resultMsg = "Served #" + outReq.studentId + " (" + outReq.studentName + ") and loaned [" + book->id + "] " + book->title;
    } else {
        resultMsg = "Served request for " + outReq.studentName;
    }
    return true;
}

std::string Library::getBooksJson() const {
    std::ostringstream json;
    json << "[";
    bool first = true;

    bookList.traverse([&](const Book& b) {
        if (!first) json << ",";
        first = false;
        json << "{"
             << "\"id\":\"" << escapeJson(b.id) << "\","
             << "\"title\":\"" << escapeJson(b.title) << "\","
             << "\"author\":\"" << escapeJson(b.author) << "\","
             << "\"totalCopies\":" << b.totalCopies << ","
             << "\"availableCopies\":" << b.availableCopies << ","
             << "\"status\":\"" << (b.availableCopies > 0 ? "AVAILABLE" : "BORROWED") << "\","
             << "\"borrower\":\"" << escapeJson(b.getPrimaryBorrower()) << "\","
             << "\"coverStyle\":" << b.coverStyle << ","
             << "\"activeLoans\":[";

        bool firstLoan = true;
        for (const auto& l : b.activeLoans) {
            if (!firstLoan) json << ",";
            firstLoan = false;
            json << "{\"studentId\":\"" << escapeJson(l.studentId)
                 << "\",\"studentName\":\"" << escapeJson(l.studentName) << "\"}";
        }
        json << "]}";
    });

    json << "]";
    return json.str();
}

std::string Library::getBookJson(const std::string& id) const {
    const Book* b = findBook(id);
    if (!b) return "{}";

    std::ostringstream json;
    json << "{"
         << "\"id\":\"" << escapeJson(b->id) << "\","
         << "\"title\":\"" << escapeJson(b->title) << "\","
         << "\"author\":\"" << escapeJson(b->author) << "\","
         << "\"totalCopies\":" << b->totalCopies << ","
         << "\"availableCopies\":" << b->availableCopies << ","
         << "\"status\":\"" << (b->availableCopies > 0 ? "AVAILABLE" : "BORROWED") << "\","
         << "\"borrower\":\"" << escapeJson(b->getPrimaryBorrower()) << "\","
         << "\"coverStyle\":" << b->coverStyle << ","
         << "\"activeLoans\":[";

    bool firstLoan = true;
    for (const auto& l : b->activeLoans) {
        if (!firstLoan) json << ",";
        firstLoan = false;
        json << "{\"studentId\":\"" << escapeJson(l.studentId)
             << "\",\"studentName\":\"" << escapeJson(l.studentName) << "\"}";
    }
    json << "]}";
    return json.str();
}

std::string Library::getQueueJson() const {
    std::ostringstream json;
    json << "[";
    bool first = true;
    int index = 1;

    requestQueue.traverse([&](const StudentRequest& req) {
        if (!first) json << ",";
        first = false;
        json << "{"
             << "\"rank\":" << index++ << ","
             << "\"studentId\":\"" << escapeJson(req.studentId) << "\","
             << "\"studentName\":\"" << escapeJson(req.studentName) << "\","
             << "\"bookId\":\"" << escapeJson(req.bookId) << "\","
             << "\"wantsTitle\":\"" << escapeJson(req.wantsTitle) << "\""
             << "}";
    });

    json << "]";
    return json.str();
}

std::string Library::getReturnsJson() const {
    std::ostringstream json;
    json << "[";
    bool first = true;
    int index = 0;

    returnStack.traverse([&](const ReturnRecord& rec) {
        if (!first) json << ",";
        first = false;
        json << "{"
             << "\"bookId\":\"" << escapeJson(rec.bookId) << "\","
             << "\"id\":\"" << escapeJson(rec.bookId) << "\","
             << "\"title\":\"" << escapeJson(rec.title) << "\","
             << "\"studentName\":\"" << escapeJson(rec.studentName) << "\","
             << "\"timeAgo\":\"" << escapeJson(rec.timeAgo) << "\","
             << "\"coverStyle\":" << rec.coverStyle << ","
             << "\"isTop\":" << (index == 0 ? "true" : "false")
             << "}";
        index++;
    });

    json << "]";
    return json.str();
}

std::string Library::getStatsJson() const {
    size_t totalBooks = bookList.size();
    int totalCopies = 0;
    int availableCopies = 0;

    bookList.traverse([&](const Book& b) {
        totalCopies += b.totalCopies;
        availableCopies += b.availableCopies;
    });

    int borrowedCopies = totalCopies - availableCopies;

    std::ostringstream json;
    json << "{"
         << "\"totalBooks\":" << totalBooks << ","
         << "\"totalCopies\":" << totalCopies << ","
         << "\"availableCopies\":" << availableCopies << ","
         << "\"borrowedCopies\":" << borrowedCopies << ","
         << "\"pendingRequests\":" << requestQueue.size() << ","
         << "\"recentReturns\":" << returnStack.size()
         << "}";
    return json.str();
}

std::string Library::getStructuresJson() const {
    std::ostringstream json;
    json << "{"
         << "\"linkedList\":{\"name\":\"Singly Linked List (Books)\",\"size\":" << bookList.size() << "},"
         << "\"bst\":{\"name\":\"Binary Search Tree (Index)\",\"size\":" << bookBst.size()
         << ",\"tree\":" << bookBst.getTreeJson()
         << ",\"inorder\":[";

    bool firstBst = true;
    bookBst.inorder([&](const std::string& id) {
        if (!firstBst) json << ",";
        firstBst = false;
        json << "\"" << escapeJson(id) << "\"";
    });

    json << "]},"
         << "\"queue\":{\"name\":\"FIFO Queue (Requests)\",\"size\":" << requestQueue.size() << "},"
         << "\"stack\":{\"name\":\"LIFO Stack (Returns)\",\"size\":" << returnStack.size() << "}"
         << "}";
    return json.str();
}
