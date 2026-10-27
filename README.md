# LibTrack — Library Management System & Visual DSA Console

LibTrack is a responsive Library Management System built as a college Data Structures & Algorithms (DSA) mini project. It pairs a retro editorial, hand-printed paper aesthetic (thick black ink borders, warm cream paper, offset drop shadows, zero gradients) with custom, dynamically allocated C++ data structures exposed via a minimal HTTP REST API.

---

## 1. Project Overview

LibTrack simulates a community lending and reading room. It models real-world library operations:
- Book catalog management (inventory tracking, multiple copies, checkout status).
- Student book loans and copy decrementing.
- Fair FIFO student waitlisting when copies are depleted.
- LIFO physical return stack tracking the latest returned books.
- Automatic reallocation of returned copies to the next eligible waiting student.
- Live, non-destructive **Visual Data Structure Console** providing visual inspection and search path tracing.

---

## 2. Technology Stack

- **Frontend**:
  - HTML5 (semantic layout with custom inline SVG bookplate & bookshelf art)
  - CSS3 (custom CSS variables, responsive CSS Grid / Flexbox, ink outlines, offset shadows)
  - Vanilla JavaScript (ES2020+, `fetch()` REST API client, zero frontend frameworks)
- **Backend**:
  - C++17 (`g++ -std=c++17 -Wall -Wextra -O2`)
  - POSIX sockets HTTP server with chunked header/body parsing
  - Zero external third-party C++ libraries or frameworks (pure standard C++ runtime)
- **Testing**:
  - Direct C++ memory test runner (`tests/test_dsa.cpp`)
  - Python test suites (`tests/test_api.py`, `tests/test_workflow.py`)

---

## 3. Four Core Data Structures & Their Roles

All data structures are implemented from scratch using custom C++ classes and dynamically allocated nodes (no `std::list`, `std::queue`, `std::stack`, or `std::map`):

| Data Structure | Implementation File | LibTrack Application Role | Operations & Time Complexity |
| :--- | :--- | :--- | :--- |
| **Singly Linked List** (`BookLinkedList`) | [`backend/DataStructures.h`](file:///home/antooswald/Projects/Library-Management-System/backend/DataStructures.h#L78-L187) | Primary store for book inventory records. Maintains `head` and `tail` pointers. | `insertBack` $O(1)$, `insertFront` $O(1)$, `remove` $O(n)$, `find` $O(n)$, `traverse` $O(n)$. |
| **Queue** (`RequestQueue`) | [`backend/DataStructures.h`](file:///home/antooswald/Projects/Library-Management-System/backend/DataStructures.h#L193-L294) | FIFO waiting list for student loan requests when all copies of a title are checked out. | `enqueue` $O(1)$, `dequeue` $O(1)$, `peek` $O(1)$, `dequeueFirstMatching` $O(n)$. |
| **Stack** (`ReturnStack`) | [`backend/DataStructures.h`](file:///home/antooswald/Projects/Library-Management-System/backend/DataStructures.h#L300-L362) | LIFO physical return tray tracking recently returned books (newest drop on top). | `push` $O(1)$, `pop` $O(1)$, `peek` $O(1)$, `traverse` $O(n)$. |
| **Binary Search Tree** (`BookBST`) | [`backend/DataStructures.h`](file:///home/antooswald/Projects/Library-Management-System/backend/DataStructures.h#L368-L509) | Secondary index by unique `bookId` for fast search and duplicate prevention. | `search` $O(h)$, `insert` $O(h)$, `remove` $O(h)$ (leaf, 1-child, 2-children successor swap), `inorder` $O(n)$. |

---

## 4. Main Website Views

1. **📖 Catalog Dashboard** (`#view-dashboard`):
   - **Header**: Bookshelf illustration banner with hanging pothos ivy and system status pill (`ZINE ENGINE: ONLINE`).
   - **Search & Filter**: Live instant filtering by Title or Book ID with clear button and counter badges.
   - **Book Catalog Shelf**: Responsive cards with colorful bookplate cover art, available/borrowed status, loan counts, borrower labels, and quick actions (`Loan`, `Return`, `Waitlist`, `Delete`).
   - **Add Book Panel**: Quick intake registration form for book ID, title, author, total copies, and visual cover style.
   - **FIFO Waiting Queue Panel**: Displays student waitlist queue with priority `#1 NEXT` badges and a `✓ SERVE NEXT STUDENT` action.
   - **LIFO Return Stack Panel**: Visual return tray displaying recent returns with `TOP PILE` indicator.

2. **🔬 Visual Data Structure Console** (`#view-console`):
   - Dedicated educational inspection view accessible via the top navigation bar.
   - **4 Selectable Tabs**: Linked List pointer chain, FIFO Queue track, LIFO drop stack, and Binary Search Tree diagram.
   - **Interactive BST Search**: Step-by-step path tracing and node highlighting (e.g. `B-101 (right) ➔ B-102 (right) ➔ B-104 (match)`).
   - **Operations & Complexity Tables**: Lists Big-O time and space complexities and internal LibTrack mechanisms for each structure.
   - **Non-Destructive**: Reads live pointers directly from `GET /api/structures` without mutating state.

---

## 5. Prerequisites & Dependencies

- **Operating System**: Linux / macOS (POSIX-compatible OS with socket API).
- **C++ Compiler**: GCC (g++ $\ge$ 7.0) or Clang supporting C++17.
- **Build Utility**: GNU Make.
- **Python**: Python 3.6+ (standard library only; used for automated test suites).

No external npm packages, pip packages, or third-party libraries are required.

---

## 6. Build and Run Commands

### Compile the Backend
```bash
make clean && make
```

### Start the Server
```bash
./libtrack_server 8080
```
*The server will start listening on `http://localhost:8080` (or another port if specified as an argument).*

### Open the Application
Open your web browser and navigate to:
```
http://localhost:8080
```

---

## 7. Testing Instructions

Run the complete verification suite with a single command:
```bash
make test
```

This runs three automated test suites:
1. **Low-Level C++ DSA Unit Tests (`tests/test_dsa.cpp`)**:
   - `BookLinkedList`: Insertion (`insertBack`, `insertFront`), node traversal, deletion (head, tail, middle), boundary safety.
   - `RequestQueue`: FIFO order, peek, empty handling, predicate matching (`dequeueFirstMatching`).
   - `ReturnStack`: LIFO ordering, top peek, popping empty stack.
   - `BookBST`: Leaf node deletion, 1-child node deletion, 2-children node deletion (in-order successor replacement), root node deletion, and strictly sorted in-order traversal.
2. **REST API & Edge Cases Suite (`tests/test_api.py`)**:
   - 25 automated assertions verifying static asset serving, CRUD operations, duplicate book prevention, borrowing/returning, auto-waitlist allocation, and delete safety locks.
3. **End-to-End User Workflow Suite (`tests/test_workflow.py`)**:
   - 10 full user workflows asserting state across inventory, queue, stack, console inspection, and clean restart memory initialization.

---

## 8. Safety Validations & Business Rules

- **Active Loan Deletion Lock**: A book cannot be deleted while active copies are checked out (`400 Bad Request`).
- **Waiting Queue Deletion Lock**: A book cannot be deleted while students are waiting for it in the queue (`400 Bad Request`).
- **Duplicate Prevention**: BST immediately rejects duplicate book IDs prior to linked list insertion.
- **Automatic Allocation**: When a copy is returned, the backend automatically assigns it to the oldest eligible waiting student in the FIFO queue and transfers checkout records seamlessly.

---

## 9. Current Limitations

- **In-Memory Storage**: LibTrack maintains all data structures in memory during server execution. Restarting the server resets the catalog and queues to their initial default seeded state. Persistence (e.g. SQLite or flat-file serialization) has intentionally not been included per project scope.

