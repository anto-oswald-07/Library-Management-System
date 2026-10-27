#ifndef DATA_STRUCTURES_H
#define DATA_STRUCTURES_H

#include <string>
#include <vector>
#include <functional>

// ============================================================================
// Data Model Structs
// ============================================================================

struct LoanRecord {
    std::string studentId;
    std::string studentName;
};

struct Book {
    std::string id;
    std::string title;
    std::string author;
    int totalCopies = 1;
    int availableCopies = 1;
    std::vector<LoanRecord> activeLoans; // Active checkouts
    int coverStyle = 1;                 // Visual cover aesthetic (1-5)

    std::string getPrimaryBorrower() const {
        if (activeLoans.empty()) return "";
        return activeLoans[0].studentName;
    }

    bool hasBorrower(const std::string& studentInfo) const {
        if (studentInfo.empty()) return !activeLoans.empty();
        for (const auto& loan : activeLoans) {
            if (loan.studentId == studentInfo || loan.studentName == studentInfo) {
                return true;
            }
        }
        return false;
    }

    bool removeLoan(const std::string& studentInfo, LoanRecord& outLoan) {
        if (activeLoans.empty()) return false;
        if (studentInfo.empty()) {
            outLoan = activeLoans.back();
            activeLoans.pop_back();
            return true;
        }
        for (auto it = activeLoans.begin(); it != activeLoans.end(); ++it) {
            if (it->studentId == studentInfo || it->studentName == studentInfo) {
                outLoan = *it;
                activeLoans.erase(it);
                return true;
            }
        }
        return false;
    }
};

struct StudentRequest {
    std::string studentId;
    std::string studentName;
    std::string bookId;
    std::string wantsTitle;
};

struct ReturnRecord {
    std::string bookId;
    std::string title;
    std::string studentName;
    std::string timeAgo = "Just now";
    int coverStyle = 1;
};

// ============================================================================
// 1. Singly Linked List (Owns Book Records)
// ============================================================================

class BookLinkedList {
private:
    struct Node {
        Book data;
        Node* next;
        Node(const Book& b) : data(b), next(nullptr) {}
    };

    Node* head = nullptr;
    Node* tail = nullptr;
    size_t count = 0;

public:
    BookLinkedList() = default;
    ~BookLinkedList() { clear(); }

    BookLinkedList(const BookLinkedList&) = delete;
    BookLinkedList& operator=(const BookLinkedList&) = delete;

    void insertBack(const Book& book) {
        Node* newNode = new Node(book);
        if (!head) {
            head = tail = newNode;
        } else {
            tail->next = newNode;
            tail = newNode;
        }
        count++;
    }

    void insertFront(const Book& book) {
        Node* newNode = new Node(book);
        if (!head) {
            head = tail = newNode;
        } else {
            newNode->next = head;
            head = newNode;
        }
        count++;
    }

    bool remove(const std::string& bookId) {
        if (!head) return false;

        Node* curr = head;
        Node* prev = nullptr;

        while (curr && curr->data.id != bookId) {
            prev = curr;
            curr = curr->next;
        }

        if (!curr) return false;

        if (curr == head) {
            head = head->next;
            if (!head) tail = nullptr;
        } else {
            prev->next = curr->next;
            if (curr == tail) {
                tail = prev;
            }
        }

        delete curr;
        count--;
        return true;
    }

    Book* find(const std::string& bookId) {
        Node* curr = head;
        while (curr) {
            if (curr->data.id == bookId) return &(curr->data);
            curr = curr->next;
        }
        return nullptr;
    }

    const Book* find(const std::string& bookId) const {
        Node* curr = head;
        while (curr) {
            if (curr->data.id == bookId) return &(curr->data);
            curr = curr->next;
        }
        return nullptr;
    }

    template<typename Func>
    void traverse(Func func) const {
        Node* curr = head;
        while (curr) {
            func(curr->data);
            curr = curr->next;
        }
    }

    size_t size() const { return count; }
    bool isEmpty() const { return count == 0; }

    void clear() {
        Node* curr = head;
        while (curr) {
            Node* nextNode = curr->next;
            delete curr;
            curr = nextNode;
        }
        head = tail = nullptr;
        count = 0;
    }
};

// ============================================================================
// 2. Queue (FIFO for Student Borrowing Requests)
// ============================================================================

class RequestQueue {
private:
    struct QueueNode {
        StudentRequest data;
        QueueNode* next;
        QueueNode(const StudentRequest& req) : data(req), next(nullptr) {}
    };

    QueueNode* frontNode = nullptr;
    QueueNode* rearNode = nullptr;
    size_t count = 0;

public:
    RequestQueue() = default;
    ~RequestQueue() { clear(); }

    RequestQueue(const RequestQueue&) = delete;
    RequestQueue& operator=(const RequestQueue&) = delete;

    void enqueue(const StudentRequest& req) {
        QueueNode* newNode = new QueueNode(req);
        if (!rearNode) {
            frontNode = rearNode = newNode;
        } else {
            rearNode->next = newNode;
            rearNode = newNode;
        }
        count++;
    }

    bool dequeue(StudentRequest& outReq) {
        if (!frontNode) return false;

        QueueNode* temp = frontNode;
        outReq = temp->data;
        frontNode = frontNode->next;

        if (!frontNode) {
            rearNode = nullptr;
        }

        delete temp;
        count--;
        return true;
    }

    bool peek(StudentRequest& outReq) const {
        if (!frontNode) return false;
        outReq = frontNode->data;
        return true;
    }

    // Dequeues the first request that satisfies a predicate (e.g. for a specific bookId)
    template<typename Predicate>
    bool dequeueFirstMatching(Predicate pred, StudentRequest& outReq) {
        if (!frontNode) return false;

        QueueNode* curr = frontNode;
        QueueNode* prev = nullptr;

        while (curr) {
            if (pred(curr->data)) {
                outReq = curr->data;
                if (curr == frontNode) {
                    frontNode = frontNode->next;
                    if (!frontNode) rearNode = nullptr;
                } else {
                    prev->next = curr->next;
                    if (curr == rearNode) rearNode = prev;
                }
                delete curr;
                count--;
                return true;
            }
            prev = curr;
            curr = curr->next;
        }
        return false;
    }

    template<typename Func>
    void traverse(Func func) const {
        QueueNode* curr = frontNode;
        while (curr) {
            func(curr->data);
            curr = curr->next;
        }
    }

    size_t size() const { return count; }
    bool isEmpty() const { return count == 0; }

    void clear() {
        while (frontNode) {
            QueueNode* temp = frontNode;
            frontNode = frontNode->next;
            delete temp;
        }
        rearNode = nullptr;
        count = 0;
    }
};

// ============================================================================
// 3. Stack (LIFO for Recently Returned Book History)
// ============================================================================

class ReturnStack {
private:
    struct StackNode {
        ReturnRecord data;
        StackNode* next;
        StackNode(const ReturnRecord& rec) : data(rec), next(nullptr) {}
    };

    StackNode* topNode = nullptr;
    size_t count = 0;

public:
    ReturnStack() = default;
    ~ReturnStack() { clear(); }

    ReturnStack(const ReturnStack&) = delete;
    ReturnStack& operator=(const ReturnStack&) = delete;

    void push(const ReturnRecord& record) {
        StackNode* newNode = new StackNode(record);
        newNode->next = topNode;
        topNode = newNode;
        count++;
    }

    bool pop(ReturnRecord& outRecord) {
        if (!topNode) return false;

        StackNode* temp = topNode;
        outRecord = temp->data;
        topNode = topNode->next;
        delete temp;
        count--;
        return true;
    }

    bool peek(ReturnRecord& outRecord) const {
        if (!topNode) return false;
        outRecord = topNode->data;
        return true;
    }

    template<typename Func>
    void traverse(Func func) const {
        StackNode* curr = topNode;
        while (curr) {
            func(curr->data);
            curr = curr->next;
        }
    }

    size_t size() const { return count; }
    bool isEmpty() const { return count == 0; }

    void clear() {
        while (topNode) {
            StackNode* temp = topNode;
            topNode = topNode->next;
            delete temp;
        }
        count = 0;
    }
};

// ============================================================================
// 4. Binary Search Tree (Indexes Book IDs)
// ============================================================================

class BookBST {
private:
    struct BSTNode {
        std::string bookId;
        BSTNode* left;
        BSTNode* right;
        BSTNode(const std::string& id) : bookId(id), left(nullptr), right(nullptr) {}
    };

    BSTNode* root = nullptr;
    size_t count = 0;

    void clearSubtree(BSTNode* node) {
        if (!node) return;
        clearSubtree(node->left);
        clearSubtree(node->right);
        delete node;
    }

    BSTNode* insertHelper(BSTNode* node, const std::string& id, bool& inserted) {
        if (!node) {
            inserted = true;
            return new BSTNode(id);
        }
        if (id < node->bookId) {
            node->left = insertHelper(node->left, id, inserted);
        } else if (id > node->bookId) {
            node->right = insertHelper(node->right, id, inserted);
        } else {
            inserted = false;
        }
        return node;
    }

    bool searchHelper(BSTNode* node, const std::string& id) const {
        if (!node) return false;
        if (id == node->bookId) return true;
        if (id < node->bookId) return searchHelper(node->left, id);
        return searchHelper(node->right, id);
    }

    BSTNode* findMin(BSTNode* node) const {
        while (node && node->left) {
            node = node->left;
        }
        return node;
    }

    BSTNode* removeHelper(BSTNode* node, const std::string& id, bool& removed) {
        if (!node) {
            removed = false;
            return nullptr;
        }

        if (id < node->bookId) {
            node->left = removeHelper(node->left, id, removed);
        } else if (id > node->bookId) {
            node->right = removeHelper(node->right, id, removed);
        } else {
            removed = true;
            if (!node->left) {
                BSTNode* rightChild = node->right;
                delete node;
                return rightChild;
            } else if (!node->right) {
                BSTNode* leftChild = node->left;
                delete node;
                return leftChild;
            }

            BSTNode* successor = findMin(node->right);
            node->bookId = successor->bookId;
            node->right = removeHelper(node->right, successor->bookId, removed);
        }
        return node;
    }

    template<typename Func>
    void inorderHelper(BSTNode* node, Func func) const {
        if (!node) return;
        inorderHelper(node->left, func);
        func(node->bookId);
        inorderHelper(node->right, func);
    }

    void serializeTreeHelper(BSTNode* node, std::string& out) const {
        if (!node) {
            out += "null";
            return;
        }
        out += "{\"id\":\"" + node->bookId + "\",\"left\":";
        serializeTreeHelper(node->left, out);
        out += ",\"right\":";
        serializeTreeHelper(node->right, out);
        out += "}";
    }

public:
    BookBST() = default;
    ~BookBST() { clear(); }

    BookBST(const BookBST&) = delete;
    BookBST& operator=(const BookBST&) = delete;

    std::string getTreeJson() const {
        std::string res;
        serializeTreeHelper(root, res);
        return res;
    }

    bool insert(const std::string& bookId) {
        bool inserted = false;
        root = insertHelper(root, bookId, inserted);
        if (inserted) count++;
        return inserted;
    }

    bool search(const std::string& bookId) const {
        return searchHelper(root, bookId);
    }

    bool remove(const std::string& bookId) {
        bool removed = false;
        root = removeHelper(root, bookId, removed);
        if (removed) count--;
        return removed;
    }

    template<typename Func>
    void inorder(Func func) const {
        inorderHelper(root, func);
    }

    size_t size() const { return count; }
    bool isEmpty() const { return count == 0; }

    void clear() {
        clearSubtree(root);
        root = nullptr;
        count = 0;
    }
};

#endif // DATA_STRUCTURES_H
