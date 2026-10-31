/**
 * LibTrack — Custom Data Structures
 * Built from scratch using dynamically referenced nodes.
 * No built-in Array, Map, or Set used as data store substitutes.
 */

// ============================================================================
// 1. Singly Linked List (Book Inventory)
// ============================================================================

class ListNode {
  constructor(book) {
    this.data = {
      id: String(book.id || ''),
      title: String(book.title || ''),
      author: String(book.author || 'Author Unknown'),
      totalCopies: Math.max(1, parseInt(book.totalCopies, 10) || 1),
      availableCopies: parseInt(book.availableCopies !== undefined ? book.availableCopies : book.totalCopies, 10),
      coverStyle: parseInt(book.coverStyle, 10) || 1,
      activeLoans: book.activeLoans ? book.activeLoans.map(l => ({ studentId: l.studentId, studentName: l.studentName })) : []
    };
    if (isNaN(this.data.availableCopies)) {
      this.data.availableCopies = this.data.totalCopies;
    }
    this.next = null;
  }
}

class BookLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.count = 0;
  }

  insertBack(book) {
    const node = new ListNode(book);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.count++;
    return node.data;
  }

  insertFront(book) {
    const node = new ListNode(book);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      node.next = this.head;
      this.head = node;
    }
    this.count++;
    return node.data;
  }

  remove(bookId) {
    if (!this.head) return false;

    let curr = this.head;
    let prev = null;

    while (curr && curr.data.id !== bookId) {
      prev = curr;
      curr = curr.next;
    }

    if (!curr) return false;

    if (curr === this.head) {
      this.head = this.head.next;
      if (!this.head) this.tail = null;
    } else {
      prev.next = curr.next;
      if (curr === this.tail) {
        this.tail = prev;
      }
    }

    this.count--;
    return true;
  }

  find(bookId) {
    let curr = this.head;
    while (curr) {
      if (curr.data.id === bookId) {
        return curr.data;
      }
      curr = curr.next;
    }
    return null;
  }

  findByTitle(query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return null;
    let curr = this.head;
    while (curr) {
      if (curr.data.title.toLowerCase().includes(q)) {
        return curr.data;
      }
      curr = curr.next;
    }
    return null;
  }

  traverse(fn) {
    let curr = this.head;
    while (curr) {
      fn(curr.data, curr);
      curr = curr.next;
    }
  }

  toArray() {
    const result = [];
    this.traverse(b => {
      result.push({
        id: b.id,
        title: b.title,
        author: b.author,
        totalCopies: b.totalCopies,
        availableCopies: b.availableCopies,
        status: b.availableCopies > 0 ? 'AVAILABLE' : 'BORROWED',
        borrower: b.activeLoans.length > 0 ? b.activeLoans[0].studentName : '',
        coverStyle: b.coverStyle,
        activeLoans: [...b.activeLoans]
      });
    });
    return result;
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  clear() {
    this.head = null;
    this.tail = null;
    this.count = 0;
  }
}

// ============================================================================
// 2. Queue (FIFO for Borrowing Requests)
// ============================================================================

class QueueNode {
  constructor(req) {
    this.data = {
      studentId: String(req.studentId || ''),
      studentName: String(req.studentName || ''),
      bookId: String(req.bookId || ''),
      wantsTitle: String(req.wantsTitle || '')
    };
    this.next = null;
  }
}

class RequestQueue {
  constructor() {
    this.front = null;
    this.rear = null;
    this.count = 0;
  }

  enqueue(req) {
    const node = new QueueNode(req);
    if (!this.rear) {
      this.front = this.rear = node;
    } else {
      this.rear.next = node;
      this.rear = node;
    }
    this.count++;
  }

  dequeue() {
    if (!this.front) return null;
    const node = this.front;
    this.front = this.front.next;
    if (!this.front) {
      this.rear = null;
    }
    this.count--;
    return node.data;
  }

  peek() {
    if (!this.front) return null;
    return this.front.data;
  }

  dequeueFirstMatching(predicate) {
    if (!this.front) return null;

    let curr = this.front;
    let prev = null;

    while (curr) {
      if (predicate(curr.data)) {
        const matched = curr.data;
        if (curr === this.front) {
          this.front = this.front.next;
          if (!this.front) this.rear = null;
        } else {
          prev.next = curr.next;
          if (curr === this.rear) {
            this.rear = prev;
          }
        }
        this.count--;
        return matched;
      }
      prev = curr;
      curr = curr.next;
    }
    return null;
  }

  traverse(fn) {
    let curr = this.front;
    while (curr) {
      fn(curr.data, curr);
      curr = curr.next;
    }
  }

  toArray() {
    const result = [];
    let rank = 1;
    this.traverse(item => {
      result.push({
        rank: rank++,
        studentId: item.studentId,
        studentName: item.studentName,
        bookId: item.bookId,
        wantsTitle: item.wantsTitle
      });
    });
    return result;
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  clear() {
    this.front = null;
    this.rear = null;
    this.count = 0;
  }
}

// ============================================================================
// 3. Stack (LIFO for Return History)
// ============================================================================

class StackNode {
  constructor(record) {
    this.data = {
      id: String(record.bookId || record.id || ''),
      bookId: String(record.bookId || record.id || ''),
      title: String(record.title || ''),
      studentName: String(record.studentName || 'Reader'),
      timeAgo: String(record.timeAgo || 'Just now'),
      coverStyle: parseInt(record.coverStyle, 10) || 1
    };
    this.next = null;
  }
}

class ReturnStack {
  constructor() {
    this.top = null;
    this.count = 0;
  }

  push(record) {
    const node = new StackNode(record);
    node.next = this.top;
    this.top = node;
    this.count++;
  }

  pop() {
    if (!this.top) return null;
    const node = this.top;
    this.top = this.top.next;
    this.count--;
    return node.data;
  }

  peek() {
    if (!this.top) return null;
    return this.top.data;
  }

  traverse(fn) {
    let curr = this.top;
    while (curr) {
      fn(curr.data, curr);
      curr = curr.next;
    }
  }

  toArray() {
    const result = [];
    let isFirst = true;
    this.traverse(item => {
      result.push({
        ...item,
        isTop: isFirst
      });
      isFirst = false;
    });
    return result;
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  clear() {
    this.top = null;
    this.count = 0;
  }
}

// ============================================================================
// 4. Binary Search Tree (Indexes Book IDs)
// ============================================================================

class BSTNode {
  constructor(bookId) {
    this.bookId = String(bookId);
    this.left = null;
    this.right = null;
  }
}

class BookBST {
  constructor() {
    this.root = null;
    this.count = 0;
  }

  insert(bookId) {
    const id = String(bookId);
    let inserted = false;

    const insertNode = (node) => {
      if (!node) {
        inserted = true;
        return new BSTNode(id);
      }
      if (id < node.bookId) {
        node.left = insertNode(node.left);
      } else if (id > node.bookId) {
        node.right = insertNode(node.right);
      } else {
        inserted = false;
      }
      return node;
    };

    this.root = insertNode(this.root);
    if (inserted) this.count++;
    return inserted;
  }

  search(bookId) {
    const id = String(bookId);
    let curr = this.root;
    while (curr) {
      if (id === curr.bookId) return true;
      if (id < curr.bookId) curr = curr.left;
      else curr = curr.right;
    }
    return false;
  }

  remove(bookId) {
    const id = String(bookId);
    let removed = false;

    const findMin = (node) => {
      while (node && node.left) {
        node = node.left;
      }
      return node;
    };

    const removeNode = (node) => {
      if (!node) {
        removed = false;
        return null;
      }

      if (id < node.bookId) {
        node.left = removeNode(node.left);
      } else if (id > node.bookId) {
        node.right = removeNode(node.right);
      } else {
        removed = true;
        // Case 1 & 2: Leaf or single child
        if (!node.left) return node.right;
        if (!node.right) return node.left;

        // Case 3: Two children (in-order successor replacement)
        const successor = findMin(node.right);
        node.bookId = successor.bookId;
        // Recursively remove successor from right subtree
        node.right = this._removeKey(node.right, successor.bookId);
      }
      return node;
    };

    this.root = removeNode(this.root);
    if (removed) this.count--;
    return removed;
  }

  _removeKey(node, id) {
    if (!node) return null;
    if (id < node.bookId) {
      node.left = this._removeKey(node.left, id);
    } else if (id > node.bookId) {
      node.right = this._removeKey(node.right, id);
    } else {
      if (!node.left) return node.right;
      if (!node.right) return node.left;
      const successor = node.right.left ? this._findMinNode(node.right) : node.right;
      node.bookId = successor.bookId;
      node.right = this._removeKey(node.right, successor.bookId);
    }
    return node;
  }

  _findMinNode(node) {
    while (node && node.left) node = node.left;
    return node;
  }

  inorderTraversal(fn) {
    const traverse = (node) => {
      if (!node) return;
      traverse(node.left);
      fn(node.bookId);
      traverse(node.right);
    };
    traverse(this.root);
  }

  inorder() {
    const result = [];
    this.inorderTraversal(id => result.push(id));
    return result;
  }

  getTreeJson() {
    const serialize = (node) => {
      if (!node) return null;
      return {
        id: node.bookId,
        left: serialize(node.left),
        right: serialize(node.right)
      };
    };
    return serialize(this.root);
  }

  size() {
    return this.count;
  }

  isEmpty() {
    return this.count === 0;
  }

  clear() {
    this.root = null;
    this.count = 0;
  }
}

module.exports = {
  ListNode,
  BookLinkedList,
  QueueNode,
  RequestQueue,
  StackNode,
  ReturnStack,
  BSTNode,
  BookBST
};

