#include "../backend/DataStructures.h"
#include <iostream>
#include <vector>
#include <cassert>

// Test Runner for C++ Data Structures
int main() {
    std::cout << "[DSA TEST] Testing Custom C++ Data Structures...\n";

    // 1. Test BookLinkedList
    {
        BookLinkedList list;
        assert(list.isEmpty());
        assert(list.size() == 0);

        list.insertBack({"B-101", "Book One", "Author A", 1, 1, {}, 1});
        list.insertBack({"B-102", "Book Two", "Author B", 2, 2, {}, 2});
        list.insertFront({"B-100", "Book Zero", "Author Z", 1, 1, {}, 3});

        assert(list.size() == 3);
        assert(list.find("B-100") != nullptr);
        assert(list.find("B-101") != nullptr);
        assert(list.find("B-102") != nullptr);
        assert(list.find("B-999") == nullptr);

        // Remove head
        assert(list.remove("B-100"));
        assert(list.size() == 2);
        assert(list.find("B-100") == nullptr);

        // Remove tail
        assert(list.remove("B-102"));
        assert(list.size() == 1);
        assert(list.find("B-102") == nullptr);

        // Remove remaining
        assert(list.remove("B-101"));
        assert(list.isEmpty());
        assert(list.size() == 0);

        std::cout << "  ✓ PASS: BookLinkedList insert, find, delete, bounds\n";
    }

    // 2. Test RequestQueue (FIFO)
    {
        RequestQueue q;
        assert(q.isEmpty());
        StudentRequest out;
        assert(!q.dequeue(out));
        assert(!q.peek(out));

        q.enqueue({"S-1", "Alice", "B-101", "Book One"});
        q.enqueue({"S-2", "Bob", "B-102", "Book Two"});
        q.enqueue({"S-3", "Charlie", "B-101", "Book One"});

        assert(q.size() == 3);
        assert(q.peek(out) && out.studentId == "S-1");

        // Dequeue matching predicate
        bool found = q.dequeueFirstMatching([](const StudentRequest& r) {
            return r.studentId == "S-2";
        }, out);
        assert(found && out.studentName == "Bob");
        assert(q.size() == 2);

        // FIFO order preserved
        assert(q.dequeue(out) && out.studentId == "S-1");
        assert(q.dequeue(out) && out.studentId == "S-3");
        assert(q.isEmpty());

        std::cout << "  ✓ PASS: RequestQueue FIFO ordering, peek, dequeueFirstMatching\n";
    }

    // 3. Test ReturnStack (LIFO)
    {
        ReturnStack st;
        assert(st.isEmpty());
        ReturnRecord out;
        assert(!st.pop(out));
        assert(!st.peek(out));

        st.push({"B-101", "Title 1", "Alice", "10m ago", 1});
        st.push({"B-102", "Title 2", "Bob", "5m ago", 2});
        st.push({"B-103", "Title 3", "Charlie", "Just now", 3});

        assert(st.size() == 3);
        assert(st.peek(out) && out.bookId == "B-103"); // LIFO top

        assert(st.pop(out) && out.bookId == "B-103");
        assert(st.pop(out) && out.bookId == "B-102");
        assert(st.pop(out) && out.bookId == "B-101");
        assert(st.isEmpty());

        std::cout << "  ✓ PASS: ReturnStack LIFO ordering, peek, pop\n";
    }

    // 4. Test BookBST with Comprehensive Deletion Edge Cases:
    // Leaf, One-Child, Two-Children
    {
        BookBST bst;
        assert(bst.isEmpty());

        /*
                 B-50
               /      \
            B-25      B-75
            /   \     /   \
          B-10  B-30 B-60 B-90
                 \
                 B-35
        */
        bst.insert("B-50");
        bst.insert("B-25");
        bst.insert("B-75");
        bst.insert("B-10");
        bst.insert("B-30");
        bst.insert("B-60");
        bst.insert("B-90");
        bst.insert("B-35");

        assert(bst.size() == 8);

        // Verify In-Order Traversal is strictly sorted
        std::vector<std::string> order;
        bst.inorder([&](const std::string& id) { order.push_back(id); });
        assert(order.size() == 8);
        for (size_t i = 1; i < order.size(); ++i) {
            assert(order[i - 1] < order[i]);
        }

        // Case 1: Delete a LEAF node (B-10 has no children)
        assert(bst.remove("B-10"));
        assert(!bst.search("B-10"));
        assert(bst.size() == 7);
        order.clear();
        bst.inorder([&](const std::string& id) { order.push_back(id); });
        for (size_t i = 1; i < order.size(); ++i) {
            assert(order[i - 1] < order[i]);
        }
        std::cout << "  ✓ PASS: BST leaf node deletion\n";

        // Case 2: Delete a node with ONE child (B-30 has only right child B-35)
        assert(bst.remove("B-30"));
        assert(!bst.search("B-30"));
        assert(bst.search("B-35"));
        assert(bst.size() == 6);
        order.clear();
        bst.inorder([&](const std::string& id) { order.push_back(id); });
        for (size_t i = 1; i < order.size(); ++i) {
            assert(order[i - 1] < order[i]);
        }
        std::cout << "  ✓ PASS: BST one-child node deletion\n";

        // Case 3: Delete a node with TWO children (B-25 has left nullptr now, wait: B-50 has two children: B-25 and B-75)
        // B-75 has two children (B-60 and B-90)
        assert(bst.remove("B-75"));
        assert(!bst.search("B-75"));
        assert(bst.search("B-60"));
        assert(bst.search("B-90"));
        assert(bst.size() == 5);
        order.clear();
        bst.inorder([&](const std::string& id) { order.push_back(id); });
        for (size_t i = 1; i < order.size(); ++i) {
            assert(order[i - 1] < order[i]);
        }
        std::cout << "  ✓ PASS: BST two-children node deletion\n";

        // Delete ROOT node with two children (B-50)
        assert(bst.remove("B-50"));
        assert(!bst.search("B-50"));
        assert(bst.size() == 4);
        order.clear();
        bst.inorder([&](const std::string& id) { order.push_back(id); });
        for (size_t i = 1; i < order.size(); ++i) {
            assert(order[i - 1] < order[i]);
        }
        std::cout << "  ✓ PASS: BST root node with two children deletion\n";

        // Nonexistent removal
        assert(!bst.remove("NONEXISTENT"));
        std::cout << "  ✓ PASS: BST nonexistent removal handled safely\n";
    }

    std::cout << "\n[ALL DSA TESTS PASSED SUCCESSFULLY]\n";
    return 0;
}

