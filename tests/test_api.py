#!/usr/bin/env python3
"""
Automated test suite for LibTrack C++ DSA Core & HTTP API.
Tests:
1. Clean startup: zero books, empty queue, empty stack, zero stats.
2. Static Assets: Serving index.html, style.css, script.js
3. Book addition & BST indexing: adding real book, duplicate ID rejection, invalid input rejection.
4. Borrowing & Returning: copy count updates, borrower records, LIFO return stack.
5. FIFO Queue: enqueue, eligible serve, auto-allocation on return.
6. Safety rules: preventing deletion of books with active loans or pending requests.
7. Deletion & BST sync: clean deletion of available book without active loans/requests.
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

        # 2. Test Clean Startup (Zero dummy data)
        status, books_json = request("/api/books")
        books = json.loads(books_json)
        assert_test("GET /api/books starts completely empty", status == 200 and len(books) == 0, f"Count: {len(books)}")

        status, queue_json = request("/api/queue")
        queue = json.loads(queue_json)
        assert_test("GET /api/queue starts completely empty", status == 200 and len(queue) == 0, f"Count: {len(queue)}")

        status, ret_json = request("/api/returns")
        rets = json.loads(ret_json)
        assert_test("GET /api/returns starts completely empty", status == 200 and len(rets) == 0, f"Count: {len(rets)}")

        status, stats_json = request("/api/stats")
        stats = json.loads(stats_json)
        assert_test("GET /api/stats reports 0 for all counts on startup",
                    status == 200 and stats.get("totalBooks") == 0 and stats.get("totalCopies") == 0)

        # 3. Add Real Books
        book1 = {
            "id": "BK-01",
            "title": "Design Patterns",
            "author": "Erich Gamma",
            "totalCopies": 2,
            "coverStyle": 1
        }
        status, add_res1 = request("/api/books", "POST", book1)
        assert_test("POST /api/books adds first book (BK-01)", status == 201)

        book2 = {
            "id": "BK-02",
            "title": "Clean Code",
            "author": "Robert C. Martin",
            "totalCopies": 1,
            "coverStyle": 3
        }
        status, add_res2 = request("/api/books", "POST", book2)
        assert_test("POST /api/books adds second book (BK-02)", status == 201)

        # Verify BST indexed the books in sorted order
        status, struct_json = request("/api/structures")
        structures = json.loads(struct_json)
        bst_inorder = structures.get("bst", {}).get("inorder", [])
        assert_test("BST in-order contains indexed books in sorted order",
                    bst_inorder == ["BK-01", "BK-02"])

        # Duplicate ID should fail
        status, dup_res = request("/api/books", "POST", book1)
        assert_test("POST /api/books prevents duplicate ID", status == 400 and "Duplicate" in dup_res)

        # 4. Test Borrowing and Returning
        status, borrow_res = request("/api/borrow", "POST", {"bookId": "BK-01", "studentName": "Ada Lovelace"})
        assert_test("POST /api/borrow loans copy of BK-01", status == 200)

        status, b_json = request("/api/books/BK-01")
        b_data = json.loads(b_json)
        assert_test("BK-01 available copies decremented (1/2)", b_data.get("availableCopies") == 1)

        # Borrow remaining copy of BK-01
        request("/api/borrow", "POST", {"bookId": "BK-01", "studentName": "Grace Hopper"})

        # Now BK-01 has 0 available copies; borrowing should fail with canQueue
        status, borrow_no_copies = request("/api/borrow", "POST", {"bookId": "BK-01", "studentName": "Margaret Hamilton"})
        assert_test("Borrowing with 0 available copies fails with canQueue", status == 400 and "No copies" in borrow_no_copies)

        # Enqueue Margaret Hamilton for BK-01
        status, enq_res = request("/api/queue", "POST", {
            "studentId": "STU-100",
            "studentName": "Margaret Hamilton",
            "bookId": "BK-01",
            "wantsTitle": "Design Patterns"
        })
        assert_test("POST /api/queue enqueues request", status == 201)

        # Return BK-01 from Ada Lovelace -> should auto-allocate to waiting Margaret Hamilton!
        status, ret_res = request("/api/return", "POST", {"bookId": "BK-01", "studentName": "Ada Lovelace"})
        assert_test("Return of BK-01 auto-allocates to waiting Margaret Hamilton", status == 200 and "Margaret Hamilton" in ret_res)

        # Verify Return Stack has Ada Lovelace's return at top
        status, ret_json = request("/api/returns")
        rets = json.loads(ret_json)
        assert_test("LIFO Return Stack updated with top return", len(rets) > 0 and rets[0].get("id") == "BK-01" and rets[0].get("isTop") is True)

        # 5. Test Safety Validations (Step 5 constraints)
        # Attempt to delete BK-01 (currently has active loan with Grace Hopper / Margaret Hamilton)
        status, del_loan_res = request("/api/books/BK-01", "DELETE")
        assert_test("Prevent deleting book with active loans", status == 400 and "active loans" in del_loan_res)

        # Add an unborrowed book BK-03 and delete it
        request("/api/books", "POST", {"id": "BK-03", "title": "Refactoring", "author": "Martin Fowler", "totalCopies": 1})
        status, del_res = request("/api/books/BK-03", "DELETE")
        assert_test("DELETE /api/books/BK-03 removes unborrowed book", status == 200)

        # Verify BST removed BK-03
        status, struct_json = request("/api/structures")
        structures = json.loads(struct_json)
        assert_test("BST index synchronized after deletion", "BK-03" not in structures.get("bst", {}).get("inorder", []))

        # 6. Test Nonexistent and Invalid Requests
        status, del_non_res = request("/api/books/NONEXISTENT", "DELETE")
        assert_test("Deleting nonexistent book returns 404", status == 404 and "not found" in del_non_res.lower())

        status, get_non_res = request("/api/books/NONEXISTENT", "GET")
        assert_test("Searching nonexistent book returns 404", status == 404 and "not found" in get_non_res.lower())

        status, bad_add = request("/api/books", "POST", {"id": "", "title": "No ID"})
        assert_test("POST /api/books with empty ID returns 400", status == 400 and "empty" in bad_add)

        status, ret_unborrowed = request("/api/return", "POST", {"bookId": "BK-02", "studentName": "Nobody"})
        assert_test("Returning unborrowed book returns 400", status == 400)

        print(f"\n[SUMMARY] {passed}/{total} tests passed.")
        return passed == total

    finally:
        print("[TEST] Terminating server...")
        server.terminate()
        server.wait()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
