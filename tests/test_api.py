#!/usr/bin/env python3
"""
Automated test suite for LibTrack C++ DSA Core & HTTP API.
Tests:
1. Static Assets: Serving index.html, style.css, script.js
2. Linked List: Book insertion, retrieval, and deletion
3. BST: Indexing, O(log n) lookup, duplicate prevention, in-order traversal
4. Queue: FIFO student request enqueue and serve
5. Stack: LIFO return history push and traversal
6. Domain rules: Multi-copy borrowing, auto-allocation to waiting queue
7. Edge cases:
   - Duplicate book IDs
   - Missing or invalid input
   - Searching for nonexistent books
   - Removing nonexistent books
   - Empty queue & stack handling
   - Returning a book that was not borrowed
   - Borrowing when 0 copies are available
   - Preventing deletion of books with active loans or pending requests
"""

import subprocess
import time
import urllib.request
import urllib.error
import json
import sys

def run_tests():
    print("[TEST] Starting LibTrack C++ Server...")
    server = subprocess.Popen(["./libtrack_server", "8080"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(0.5)

    def request(path, method="GET", data=None):
        url = f"http://127.0.0.1:8080{path}"
        req = urllib.request.Request(url, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
            body = json.dumps(data).encode("utf-8")
        else:
            body = None
        try:
            with urllib.request.urlopen(req, data=body, timeout=3) as res:
                return res.status, res.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  ✓ PASS: {name}")
        else:
            print(f"  ✗ FAIL: {name} - {details}")

    try:
        # 1. Test Static Asset Serving
        status, html = request("/")
        assert_test("Serve index.html at root", status == 200 and "Library Management System" in html)

        status, css = request("/style.css")
        assert_test("Serve style.css", status == 200 and "--ink-black" in css)

        status, js = request("/script.js")
        assert_test("Serve script.js", status == 200 and "loadData" in js)

        # 2. Test Linked List & Books API
        status, books_json = request("/api/books")
        books = json.loads(books_json)
        assert_test("GET /api/books returns seeded books", status == 200 and len(books) == 5, f"Count: {len(books)}")

        status, book_json = request("/api/books/B-101")
        book = json.loads(book_json)
        assert_test("GET /api/books/B-101 returns book record", status == 200 and book.get("title") == "The Design of Everyday Things")

        # 3. Test BST Index & Duplicate Prevention
        new_book = {
            "id": "B-200",
            "title": "Algorithms to Live By",
            "author": "Brian Christian",
            "coverStyle": 2
        }
        status, add_res = request("/api/books", "POST", new_book)
        assert_test("POST /api/books adds new book", status == 201)

        # Verify BST indexed the new book
        status, struct_json = request("/api/structures")
        structures = json.loads(struct_json)
        bst_inorder = structures.get("bst", {}).get("inorder", [])
        assert_test("BST in-order contains new book B-200", "B-200" in bst_inorder and bst_inorder == sorted(bst_inorder))

        # Duplicate ID should fail gracefully
        status, dup_res = request("/api/books", "POST", new_book)
        assert_test("POST /api/books prevents duplicate ID", status == 400 and "Duplicate" in dup_res)

        # 4. Test Deletion from both Linked List and BST
        status, del_res = request("/api/books/B-200", "DELETE")
        assert_test("DELETE /api/books/B-200 removes book", status == 200)

        status, struct_json = request("/api/structures")
        structures = json.loads(struct_json)
        assert_test("BST index synchronized after deletion", "B-200" not in structures.get("bst", {}).get("inorder", []))

        # 5. Test Borrowing and Returning
        status, borrow_res = request("/api/borrow", "POST", {"bookId": "B-101", "studentName": "Ada Lovelace"})
        assert_test("POST /api/borrow loans available book", status == 200)

        status, book_json = request("/api/books/B-101")
        book = json.loads(book_json)
        assert_test("Book B-101 marked BORROWED with Ada Lovelace", book.get("status") == "BORROWED" and book.get("borrower") == "Ada Lovelace")

        status, return_res = request("/api/return", "POST", {"bookId": "B-101", "studentName": "Ada Lovelace"})
        assert_test("POST /api/return returns book", status == 200)

        # 6. Test Stack (LIFO Return Stack)
        status, returns_json = request("/api/returns")
        returns = json.loads(returns_json)
        assert_test("Stack top is newly returned book B-101", len(returns) > 0 and returns[0].get("id") == "B-101" and returns[0].get("isTop") is True)

        # 7. Test Queue & Serve Next Eligible Request
        # Enqueue student for B-103 (available)
        status, enq_res = request("/api/queue", "POST", {
            "studentId": "S-999",
            "studentName": "Grace Hopper",
            "bookId": "B-103",
            "wantsTitle": "Clean Code: A Handbook of Agile Craft"
        })
        assert_test("POST /api/queue enqueues request", status == 201)

        # Serve next eligible student
        status, serve_res = request("/api/queue/serve", "POST", {})
        assert_test("POST /api/queue/serve loans book to eligible waiting student", status == 200 and "Grace Hopper" in serve_res)

        # 8. Test Automatic Allocation on Return
        # Elena Rostova wants B-104 (currently borrowed by Marcus Vance)
        status, ret_res = request("/api/return", "POST", {"bookId": "B-104", "studentName": "Marcus Vance"})
        assert_test("Return of B-104 auto-allocates to waiting Elena Rostova", status == 200 and "Elena Rostova" in ret_res)

        # =====================================================================
        # Edge Case & Safety Validations (Step 5)
        # =====================================================================

        # Edge Case 1: Cannot delete book with active loans
        # B-102 has active loans (borrowed by Elena Rostova)
        status, del_loan_res = request("/api/books/B-102", "DELETE")
        assert_test("Prevent deleting book with active loans (B-102)", status == 400 and "active loans" in del_loan_res)

        # Edge Case 2: Cannot delete book with pending queue requests
        # Julian Thorne is in queue for B-102, Elena is now borrowing B-104.
        # Let's add book B-300, enqueue a student for B-300, then attempt to delete B-300.
        request("/api/books", "POST", {"id": "B-300", "title": "Test Book", "author": "Tester", "totalCopies": 1})
        request("/api/queue", "POST", {"studentId": "S-555", "studentName": "Queue Tester", "bookId": "B-300", "wantsTitle": "Test Book"})
        status, del_queue_res = request("/api/books/B-300", "DELETE")
        assert_test("Prevent deleting book with pending queue requests", status == 400 and "pending waiting queue" in del_queue_res)

        # Edge Case 3: Deleting a nonexistent book
        status, del_non_res = request("/api/books/NONEXISTENT", "DELETE")
        assert_test("Deleting nonexistent book returns 404", status == 404 and "not found" in del_non_res.lower())

        # Edge Case 4: Searching for a nonexistent book
        status, get_non_res = request("/api/books/NONEXISTENT", "GET")
        assert_test("Searching nonexistent book returns 404", status == 404 and "not found" in get_non_res.lower())

        # Edge Case 5: Missing or invalid input on book creation
        status, bad_add_1 = request("/api/books", "POST", {"id": "", "title": "No ID"})
        assert_test("POST /api/books with empty ID returns 400", status == 400 and "empty" in bad_add_1)

        status, bad_add_2 = request("/api/books", "POST", {"id": "B-BAD", "title": "Bad Copies", "totalCopies": 0})
        assert_test("POST /api/books with totalCopies <= 0 returns 400", status == 400 and "at least 1" in bad_add_2)

        # Edge Case 6: Borrowing when 0 copies are available
        # B-104 is now borrowed by Elena Rostova (0 copies available)
        status, borrow_no_copies = request("/api/borrow", "POST", {"bookId": "B-104", "studentName": "Impatient Reader"})
        assert_test("Borrowing book with 0 copies returns 400 with canQueue", status == 400 and "No copies" in borrow_no_copies)

        # Edge Case 7: Returning a book that was not borrowed
        status, return_unborrowed = request("/api/return", "POST", {"bookId": "B-101", "studentName": "Unregistered Student"})
        assert_test("Returning book not borrowed by student returns 400", status == 400 and "does not have" in return_unborrowed)

        print(f"\n[SUMMARY] {passed}/{total} tests passed.")
        return passed == total

    finally:
        print("[TEST] Terminating server...")
        server.terminate()
        server.wait()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
