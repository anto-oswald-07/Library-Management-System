/**
 * Comprehensive Unit Test for LibTrack Custom Data Structures in JavaScript.
 * Tests:
 * 1. BookLinkedList
 * 2. RequestQueue (FIFO)
 * 3. ReturnStack (LIFO)
 * 4. BookBST (Comprehensive Deletion: Leaf, One-Child, Two-Children)
 */

const assert = require('assert');
const {
  BookLinkedList,
  RequestQueue,
  ReturnStack,
  BookBST
} = require('../backend/dataStructures');

console.log('[DSA TEST] Testing Custom JavaScript Data Structures...');

// 1. Test BookLinkedList
{
  const list = new BookLinkedList();
  assert.strictEqual(list.isEmpty(), true);
  assert.strictEqual(list.size(), 0);

  list.insertBack({ id: 'B-101', title: 'Book One', author: 'Author A', totalCopies: 1 });
  list.insertBack({ id: 'B-102', title: 'Book Two', author: 'Author B', totalCopies: 2 });
  list.insertFront({ id: 'B-100', title: 'Book Zero', author: 'Author Z', totalCopies: 1 });

  assert.strictEqual(list.size(), 3);
  assert.notStrictEqual(list.find('B-100'), null);
  assert.notStrictEqual(list.find('B-101'), null);
  assert.notStrictEqual(list.find('B-102'), null);
  assert.strictEqual(list.find('B-999'), null);

  assert.notStrictEqual(list.findByTitle('zero'), null);
  assert.strictEqual(list.findByTitle('nonexistent'), null);

  // Remove head
  assert.strictEqual(list.remove('B-100'), true);
  assert.strictEqual(list.size(), 2);
  assert.strictEqual(list.find('B-100'), null);

  // Remove tail
  assert.strictEqual(list.remove('B-102'), true);
  assert.strictEqual(list.size(), 1);
  assert.strictEqual(list.find('B-102'), null);

  // Remove remaining
  assert.strictEqual(list.remove('B-101'), true);
  assert.strictEqual(list.isEmpty(), true);
  assert.strictEqual(list.size(), 0);

  console.log('  ✓ PASS: BookLinkedList insert, find, findByTitle, delete, bounds');
}

// 2. Test RequestQueue (FIFO)
{
  const q = new RequestQueue();
  assert.strictEqual(q.isEmpty(), true);
  assert.strictEqual(q.dequeue(), null);
  assert.strictEqual(q.peek(), null);

  q.enqueue({ studentId: 'S-1', studentName: 'Alice', bookId: 'B-101', wantsTitle: 'Book One' });
  q.enqueue({ studentId: 'S-2', studentName: 'Bob', bookId: 'B-102', wantsTitle: 'Book Two' });
  q.enqueue({ studentId: 'S-3', studentName: 'Charlie', bookId: 'B-101', wantsTitle: 'Book One' });

  assert.strictEqual(q.size(), 3);
  assert.strictEqual(q.peek().studentId, 'S-1');

  // Dequeue matching predicate (targeted book)
  const matched = q.dequeueFirstMatching(r => r.studentId === 'S-2');
  assert.notStrictEqual(matched, null);
  assert.strictEqual(matched.studentName, 'Bob');
  assert.strictEqual(q.size(), 2);

  // FIFO order preserved
  assert.strictEqual(q.dequeue().studentId, 'S-1');
  assert.strictEqual(q.dequeue().studentId, 'S-3');
  assert.strictEqual(q.isEmpty(), true);

  console.log('  ✓ PASS: RequestQueue FIFO ordering, peek, dequeueFirstMatching');
}

// 3. Test ReturnStack (LIFO)
{
  const st = new ReturnStack();
  assert.strictEqual(st.isEmpty(), true);
  assert.strictEqual(st.pop(), null);
  assert.strictEqual(st.peek(), null);

  st.push({ bookId: 'B-101', title: 'Title 1', studentName: 'Alice', timeAgo: '10m ago' });
  st.push({ bookId: 'B-102', title: 'Title 2', studentName: 'Bob', timeAgo: '5m ago' });
  st.push({ bookId: 'B-103', title: 'Title 3', studentName: 'Charlie', timeAgo: 'Just now' });

  assert.strictEqual(st.size(), 3);
  assert.strictEqual(st.peek().bookId, 'B-103'); // LIFO top

  assert.strictEqual(st.pop().bookId, 'B-103');
  assert.strictEqual(st.pop().bookId, 'B-102');
  assert.strictEqual(st.pop().bookId, 'B-101');
  assert.strictEqual(st.isEmpty(), true);

  console.log('  ✓ PASS: ReturnStack LIFO ordering, peek, pop');
}

// 4. Test BookBST with Comprehensive Deletion Edge Cases: Leaf, One-Child, Two-Children
{
  const bst = new BookBST();
  assert.strictEqual(bst.isEmpty(), true);

  /*
           B-50
         /      \
      B-25      B-75
      /   \     /   \
    B-10  B-30 B-60 B-90
           \
           B-35
  */
  bst.insert('B-50');
  bst.insert('B-25');
  bst.insert('B-75');
  bst.insert('B-10');
  bst.insert('B-30');
  bst.insert('B-60');
  bst.insert('B-90');
  bst.insert('B-35');

  assert.strictEqual(bst.size(), 8);

  // In-order traversal must be strictly sorted
  const order = bst.inorder();
  assert.strictEqual(order.length, 8);
  for (let i = 1; i < order.length; i++) {
    assert(order[i - 1] < order[i], `Expected ${order[i - 1]} < ${order[i]}`);
  }

  // Case 1: Delete a LEAF node (B-10 has no children)
  assert.strictEqual(bst.remove('B-10'), true);
  assert.strictEqual(bst.search('B-10'), false);
  assert.strictEqual(bst.size(), 7);
  let curOrder = bst.inorder();
  for (let i = 1; i < curOrder.length; i++) {
    assert(curOrder[i - 1] < curOrder[i]);
  }
  console.log('  ✓ PASS: BST leaf node deletion');

  // Case 2: Delete a node with ONE child (B-30 has only right child B-35)
  assert.strictEqual(bst.remove('B-30'), true);
  assert.strictEqual(bst.search('B-30'), false);
  assert.strictEqual(bst.search('B-35'), true);
  assert.strictEqual(bst.size(), 6);
  curOrder = bst.inorder();
  for (let i = 1; i < curOrder.length; i++) {
    assert(curOrder[i - 1] < curOrder[i]);
  }
  console.log('  ✓ PASS: BST one-child node deletion');

  // Case 3: Delete a node with TWO children (B-75 has both B-60 and B-90)
  assert.strictEqual(bst.remove('B-75'), true);
  assert.strictEqual(bst.search('B-75'), false);
  assert.strictEqual(bst.search('B-60'), true);
  assert.strictEqual(bst.search('B-90'), true);
  assert.strictEqual(bst.size(), 5);
  curOrder = bst.inorder();
  for (let i = 1; i < curOrder.length; i++) {
    assert(curOrder[i - 1] < curOrder[i]);
  }
  console.log('  ✓ PASS: BST two-children node deletion');

  // Delete ROOT node with two children (B-50)
  assert.strictEqual(bst.remove('B-50'), true);
  assert.strictEqual(bst.search('B-50'), false);
  assert.strictEqual(bst.size(), 4);
  curOrder = bst.inorder();
  for (let i = 1; i < curOrder.length; i++) {
    assert(curOrder[i - 1] < curOrder[i]);
  }
  console.log('  ✓ PASS: BST root node with two children deletion');

  // Nonexistent removal
  assert.strictEqual(bst.remove('NONEXISTENT'), false);
  console.log('  ✓ PASS: BST nonexistent removal handled safely');

  // Tree JSON serialization for visual console
  const treeJson = bst.getTreeJson();
  assert.notStrictEqual(treeJson, null);
  assert.strictEqual(typeof treeJson.id, 'string');
  console.log('  ✓ PASS: BST tree JSON serialization for visual console');
}

console.log('\n[ALL DSA JAVASCRIPT TESTS PASSED SUCCESSFULLY]\n');

