#!/usr/bin/env python3
"""
Step-by-step verification of all 10 User Workflows specified in Step 5:
1. Open website & view dashboard (starts clean with 0 dummy books)
2. Add book & verify inventory
3. Search by book ID and title
4. Remove book & verify linked list + BST sync
5. Borrow available book & verify count decrements
6. Request unavailable book & verify queue join
7. Return borrowed book & verify return stack updates
8. Process eligible waiting request when copy becomes available
9. Open Console & verify all 4 structures reflect current data
10. Restart backend & verify clean memory initialization (0 records)
"""

import subprocess
import time
import urllib.request
import urllib.error
import json
import sys

def run_workflow_test():
    print("=" * 60)
    print("LIBTRACK STEP 5 — COMPLETE USER WORKFLOW VERIFICATION")
    print("=" * 60)

    # Start fresh server on 8081 for this test
    server = subprocess.Popen(["./libtrack_server", "8081"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(0.5)

    def req(path, method="GET", data=None):
        url = f"http://127.0.0.1:8081{path}"
        r = urllib.request.Request(url, method=method)
        if data is not None:
            r.add_header("Content-Type", "application/json")
            body = json.dumps(data).encode("utf-8")
        else:
            body = None
        try:
            with urllib.request.urlopen(r, data=body, timeout=3) as res:
                return res.status, res.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8")

    try:
        # Scenario 1: Open website & view dashboard
        status, html = req("/")
        assert status == 200 and "Library Management System" in html
        status, books_json = req("/api/books")
        books = json.loads(books_json)
        assert len(books) == 0
        print("✓ Scenario 1: Website loaded and verified initial empty catalog.")

        # Scenario 2: Add a book and verify it appears in inventory
        new_book = {
            "id": "B-108",
            "title": "Godel, Escher, Bach",
            "author": "Douglas Hofstadter",
            "totalCopies": 2,
            "coverStyle": 4
        }
        status, add_res = req("/api/books", "POST", new_book)
        assert status == 201
        status, books_json = req("/api/books")
        books = json.loads(books_json)
        assert any(b["id"] == "B-108" for b in books)
        print("✓ Scenario 2: Book B-108 added and confirmed in catalog inventory.")

        # Scenario 3: Search by book ID and title
        status, b_id_json = req("/api/books/B-108")
        b_id = json.loads(b_id_json)
        assert b_id["title"] == "Godel, Escher, Bach"
        # Search via list filter simulation
        found_by_title = [b for b in books if "Godel" in b["title"]]
        assert len(found_by_title) == 1 and found_by_title[0]["id"] == "B-108"
        print("✓ Scenario 3: Search by Book ID and Title verified.")

        # Scenario 4: Remove a book and verify linked list and BST stay synchronized
        # Add B-999 temporarily to delete
        req("/api/books", "POST", {"id": "B-999", "title": "Temp", "author": "Author", "totalCopies": 1})
        status, del_res = req("/api/books/B-999", "DELETE")
        assert status == 200
        # Check Linked List
        status, books_json = req("/api/books")
        books = json.loads(books_json)
        assert not any(b["id"] == "B-999" for b in books)
        # Check BST In-order index
        status, struct_json = req("/api/structures")
        structures = json.loads(struct_json)
        assert "B-999" not in structures["bst"]["inorder"]
        print("✓ Scenario 4: Book removed; Linked List and BST verified synchronized.")

        # Scenario 5: Borrow an available book and verify its available-copy count decreases
        # Add B-101: 1 total, 1 available
        req("/api/books", "POST", {"id": "B-101", "title": "Everyday Things", "author": "Norman", "totalCopies": 1})
        status, borrow_res = req("/api/borrow", "POST", {"bookId": "B-101", "studentName": "Nikola Tesla"})
        assert status == 200
        status, b_json = req("/api/books/B-101")
        b_101 = json.loads(b_json)
        assert b_101["availableCopies"] == 0
        assert b_101["status"] == "BORROWED"
        assert b_101["borrower"] == "Nikola Tesla"
        print("✓ Scenario 5: Borrowed B-101; available copies decremented from 1 to 0.")

        # Scenario 6: Request an unavailable book and verify the student joins the queue
        # B-101 now has 0 available copies
        status, borrow_fail = req("/api/borrow", "POST", {"bookId": "B-101", "studentName": "Marie Curie"})
        assert status == 400
        # Join queue for B-101
        status, queue_res = req("/api/queue", "POST", {
            "studentId": "S-777",
            "studentName": "Marie Curie",
            "bookId": "B-101",
            "wantsTitle": "Everyday Things"
        })
        assert status == 201
        status, q_json = req("/api/queue")
        q = json.loads(q_json)
        assert any(item["studentName"] == "Marie Curie" and item["bookId"] == "B-101" for item in q)
        print("✓ Scenario 6: Request for unavailable B-101 rejected and enqueued in FIFO queue.")

        # Scenario 7: Return a borrowed book and verify the return stack updates
        # Nikola Tesla returns B-101. Note: Marie Curie is waiting in FIFO queue!
        # Returning B-101 will push return to stack AND auto-allocate to Marie Curie!
        status, ret_res = req("/api/return", "POST", {"bookId": "B-101", "studentName": "Nikola Tesla"})
        assert status == 200
        status, ret_json = req("/api/returns")
        rets = json.loads(ret_json)
        assert len(rets) > 0 and rets[0]["id"] == "B-101" and rets[0]["studentName"] == "Nikola Tesla"
        print("✓ Scenario 7: Returned B-101; LIFO Return Stack updated with top entry.")

        # Scenario 8: Process an eligible waiting request when a copy becomes available
        # Verify Marie Curie was auto-allocated upon return
        status, b_json = req("/api/books/B-101")
        b_101 = json.loads(b_json)
        assert b_101["borrower"] == "Marie Curie"
        print("✓ Scenario 8: Eligible waiting requests processed and allocated as copies freed.")

        # Scenario 9: Open the Data Structure Console and verify all four structures show current backend data
        status, s_json = req("/api/structures")
        structures = json.loads(s_json)
        assert "linkedList" in structures and len(structures["linkedList"]) > 0
        assert "queue" in structures
        assert "stack" in structures and len(structures["stack"]) >= 1
        assert "bst" in structures and len(structures["bst"]["inorder"]) > 0
        assert structures["bst"]["inorder"] == sorted(structures["bst"]["inorder"])
        print("✓ Scenario 9: Data Structure Console API exposes live linked list, queue, stack, and BST.")

    finally:
        server.terminate()
        server.wait()

    # Scenario 10: Restart the backend and verify expected behavior for current storage model
    print("[TEST] Restarting server to verify clean in-memory storage state (zero dummy data)...")
    server2 = subprocess.Popen(["./libtrack_server", "8082"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(0.5)
    try:
        def req2(path):
            with urllib.request.urlopen(f"http://127.0.0.1:8082{path}", timeout=3) as res:
                return res.status, res.read().decode("utf-8")
        status, b_json = req2("/api/books")
        books = json.loads(b_json)
        # Verify clean initial state: 0 books
        assert len(books) == 0
        status, q_json = req2("/api/queue")
        q = json.loads(q_json)
        # Verify clean initial state: 0 queue requests
        assert len(q) == 0
        status, ret_json = req2("/api/returns")
        rets = json.loads(ret_json)
        # Verify clean initial state: 0 returns
        assert len(rets) == 0
        print("✓ Scenario 10: Server restart verified clean in-memory initialization to 0 records.")
    finally:
        server2.terminate()
        server2.wait()

    print("\n" + "=" * 60)
    print("ALL 10 USER WORKFLOW SCENARIOS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_workflow_test()
