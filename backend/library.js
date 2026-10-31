/**
 * LibTrack — Library Domain Manager
 * Coordinates custom data structures and enforces library business rules.
 */

const {
  BookLinkedList,
  RequestQueue,
  ReturnStack,
  BookBST
} = require('./dataStructures');

class Library {
  constructor() {
    this.bookList = new BookLinkedList();
    this.bookBst = new BookBST();
    this.requestQueue = new RequestQueue();
    this.returnStack = new ReturnStack();
  }

  // Core Book Management
  addBook(bookData) {
    const id = String(bookData.id || '').trim();
    const title = String(bookData.title || '').trim();
    const author = String(bookData.author || 'Author Unknown').trim();
    const totalCopies = parseInt(bookData.totalCopies, 10);
    const coverStyle = parseInt(bookData.coverStyle, 10) || 1;

    if (!id || !title) {
      return { success: false, status: 400, error: 'Book ID and title cannot be empty.' };
    }
    if (isNaN(totalCopies) || totalCopies <= 0) {
      return { success: false, status: 400, error: 'Total copies must be at least 1.' };
    }

    if (this.bookBst.search(id)) {
      return { success: false, status: 400, error: `Duplicate Book ID: ${id} already exists in catalog.` };
    }

    const newBook = {
      id,
      title,
      author,
      totalCopies,
      availableCopies: totalCopies,
      coverStyle,
      activeLoans: []
    };

    this.bookList.insertBack(newBook);
    this.bookBst.insert(id);

    return { success: true, id };
  }

  removeBook(id) {
    const bookId = String(id || '').trim();
    const book = this.findBook(bookId);

    if (!book) {
      return { success: false, status: 404, error: `Book not found: ${bookId}` };
    }

    // Validation rule 1: Do not permit deleting a book with active loans
    if (book.activeLoans.length > 0 || book.availableCopies < book.totalCopies) {
      return {
        success: false,
        status: 400,
        error: `Cannot delete [${bookId}]: book currently has active loans. Return all copies first.`
      };
    }

    // Validation rule 2: Do not permit deleting a book with pending queue requests
    let hasPendingQueue = false;
    this.requestQueue.traverse(r => {
      if (r.bookId === bookId) hasPendingQueue = true;
    });

    if (hasPendingQueue) {
      return {
        success: false,
        status: 400,
        error: `Cannot delete [${bookId}]: book currently has pending waiting queue requests.`
      };
    }

    this.bookBst.remove(bookId);
    this.bookList.remove(bookId);

    return { success: true, id: bookId };
  }

  findBook(id) {
    const bookId = String(id || '').trim();
    if (!this.bookBst.search(bookId)) return null;
    return this.bookList.find(bookId);
  }

  borrowBook(bookId, studentId, studentName) {
    const bId = String(bookId || '').trim();
    const sId = String(studentId || '').trim();
    const sName = String(studentName || '').trim();

    const book = this.findBook(bId);
    if (!book) {
      return { success: false, status: 404, error: `Book not found: ${bId}` };
    }

    if (!sName && !sId) {
      return { success: false, status: 400, error: 'Student name or ID is required to borrow a book.' };
    }

    if (book.availableCopies <= 0) {
      return {
        success: false,
        status: 400,
        error: `No copies of '${book.title}' are currently available.`,
        canQueue: true
      };
    }

    const assignedId = sId || `S-${Math.floor(Math.random() * 900 + 100)}`;
    const assignedName = sName || `Reader ${assignedId}`;

    book.availableCopies--;
    book.activeLoans.push({ studentId: assignedId, studentName: assignedName });

    return { success: true, message: 'Book borrowed successfully' };
  }

  returnBook(bookId, studentInfo) {
    const bId = String(bookId || '').trim();
    const sInfo = String(studentInfo || '').trim();

    const book = this.findBook(bId);
    if (!book) {
      return { success: false, status: 404, error: `Book not found: ${bId}` };
    }

    let foundLoanIndex = -1;
    if (sInfo) {
      foundLoanIndex = book.activeLoans.findIndex(
        l => l.studentId.toUpperCase() === sInfo.toUpperCase() ||
             l.studentName.toLowerCase() === sInfo.toLowerCase()
      );
    } else if (book.activeLoans.length > 0) {
      foundLoanIndex = 0; // Default to oldest loan if unspecified
    }

    if (foundLoanIndex === -1) {
      if (sInfo) {
        return {
          success: false,
          status: 400,
          error: `Student '${sInfo}' does not have [${bId}] checked out.`
        };
      } else {
        return {
          success: false,
          status: 400,
          error: `All copies of [${bId}] are already returned to the shelf.`
        };
      }
    }

    const loan = book.activeLoans.splice(foundLoanIndex, 1)[0];
    book.availableCopies++;

    // Push to LIFO return history stack
    this.returnStack.push({
      bookId: book.id,
      title: book.title,
      studentName: loan.studentName,
      timeAgo: 'Just now',
      coverStyle: book.coverStyle
    });

    let resultMsg = `Book '${book.title}' successfully returned from ${loan.studentName}.`;

    // FIFO Rule: Check if a waiting student in queue wants this returned book
    const waitingReq = this.requestQueue.dequeueFirstMatching(r => r.bookId === bId);
    if (waitingReq) {
      book.availableCopies--;
      book.activeLoans.push({
        studentId: waitingReq.studentId,
        studentName: waitingReq.studentName
      });
      resultMsg += ` Immediately allocated to waiting student ${waitingReq.studentName} (${waitingReq.studentId})!`;
    }

    return { success: true, message: resultMsg };
  }

  enqueueRequest(reqData) {
    const studentId = String(reqData.studentId || `S-${Math.floor(Math.random() * 900 + 100)}`).trim();
    const studentName = String(reqData.studentName || 'Student').trim();
    const bookId = String(reqData.bookId || '').trim();

    let wantsTitle = String(reqData.wantsTitle || '').trim();
    if (!wantsTitle) {
      const b = this.findBook(bookId);
      wantsTitle = b ? b.title : 'Requested Book';
    }

    this.requestQueue.enqueue({
      studentId,
      studentName,
      bookId,
      wantsTitle
    });

    return { success: true, message: 'Request enqueued' };
  }

  serveNextRequest() {
    if (this.requestQueue.isEmpty()) {
      return { success: false, status: 400, error: 'Waiting queue is currently empty.' };
    }

    // Inspect next request in queue (FIFO front)
    const nextReq = this.requestQueue.peek();
    if (nextReq) {
      const frontBook = this.findBook(nextReq.bookId);
      if (frontBook && frontBook.availableCopies > 0) {
        const outReq = this.requestQueue.dequeue();
        frontBook.availableCopies--;
        frontBook.activeLoans.push({
          studentId: outReq.studentId,
          studentName: outReq.studentName
        });
        return {
          success: true,
          message: `Served #${outReq.studentId} (${outReq.studentName}) and loaned [${frontBook.id}] ${frontBook.title}`,
          studentName: outReq.studentName,
          bookId: frontBook.id
        };
      }
    }

    // If front request book is not currently available, see if any subsequent waiting request is eligible
    const served = this.requestQueue.dequeueFirstMatching(r => {
      const b = this.findBook(r.bookId);
      return b && b.availableCopies > 0;
    });

    if (!served) {
      return {
        success: false,
        status: 400,
        error: 'No eligible requests: none of the books requested by waiting students are currently available on shelves.'
      };
    }

    const book = this.findBook(served.bookId);
    if (book) {
      book.availableCopies--;
      book.activeLoans.push({
        studentId: served.studentId,
        studentName: served.studentName
      });
      return {
        success: true,
        message: `Served #${served.studentId} (${served.studentName}) and loaned [${book.id}] ${book.title}`,
        studentName: served.studentName,
        bookId: book.id
      };
    }

    return {
      success: true,
      message: `Served request for ${served.studentName}`,
      studentName: served.studentName,
      bookId: served.bookId
    };
  }

  // Serialization for API Responses
  getBooks() {
    return this.bookList.toArray();
  }

  getBook(id) {
    const book = this.findBook(id);
    if (!book) return null;
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      status: book.availableCopies > 0 ? 'AVAILABLE' : 'BORROWED',
      borrower: book.activeLoans.length > 0 ? book.activeLoans[0].studentName : '',
      coverStyle: book.coverStyle,
      activeLoans: [...book.activeLoans]
    };
  }

  getQueue() {
    return this.requestQueue.toArray();
  }

  getReturns() {
    return this.returnStack.toArray();
  }

  getStats() {
    let totalCopies = 0;
    let availableCopies = 0;

    this.bookList.traverse(b => {
      totalCopies += b.totalCopies;
      availableCopies += b.availableCopies;
    });

    const borrowedCopies = totalCopies - availableCopies;

    return {
      totalBooks: this.bookList.size(),
      totalCopies,
      availableCopies,
      borrowedCopies,
      pendingRequests: this.requestQueue.size(),
      recentReturns: this.returnStack.size()
    };
  }

  getStructures() {
    return {
      linkedList: {
        name: 'Singly Linked List (Books)',
        size: this.bookList.size()
      },
      bst: {
        name: 'Binary Search Tree (Index)',
        size: this.bookBst.size(),
        tree: this.bookBst.getTreeJson(),
        inorder: this.bookBst.inorder()
      },
      queue: {
        name: 'FIFO Queue (Requests)',
        size: this.requestQueue.size()
      },
      stack: {
        name: 'LIFO Stack (Returns)',
        size: this.returnStack.size()
      }
    };
  }
}

module.exports = Library;

