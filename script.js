/**
 * LibTrack — Frontend Controller
 * Connects UI directly to C++ DSA Backend via REST API.
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = {
    searchMode: 'title', // 'title' | 'id'
    searchQuery: '',
    books: [],
    queue: [],
    recentlyReturned: [],
    stats: { totalBooks: 0, totalCopies: 0, availableCopies: 0, borrowedCopies: 0, pendingRequests: 0, recentReturns: 0 },
    apiConnected: false
  };

  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const btnSearchByTitle = document.getElementById('btn-search-by-title');
  const btnSearchById = document.getElementById('btn-search-by-id');
  const bookListContainer = document.getElementById('book-list');
  const shelfCountBadge = document.getElementById('shelf-count-badge');
  const noBooksState = document.getElementById('no-books-state');
  const resetSearchBtn = document.getElementById('reset-search-btn');

  const addBookForm = document.getElementById('add-book-form');
  const bookIdInput = document.getElementById('book-id-input');
  const bookTitleInput = document.getElementById('book-title-input');
  const bookAuthorInput = document.getElementById('book-author-input');
  const bookCopiesInput = document.getElementById('book-copies-input');
  const submitBookBtn = document.getElementById('submit-book-btn');

  const queueListContainer = document.getElementById('queue-list');
  const queueCountBadge = document.getElementById('queue-count-badge');
  const serveNextBtn = document.getElementById('serve-next-btn');

  const returnsListContainer = document.getElementById('returns-list');
  const returnsCountBadge = document.getElementById('returns-count-badge');
  const toastContainer = document.getElementById('toast-container');
  const statusIndicator = document.getElementById('system-status-indicator');

  // Modal Dialog Elements
  const actionModal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalForm = document.getElementById('modal-form');
  const modalBookBanner = document.getElementById('modal-book-banner');
  const modalFields = document.getElementById('modal-fields');
  const modalSubmitBtn = document.getElementById('modal-submit-btn');

  let activeModalAction = null; // 'borrow' | 'return' | 'waitlist'
  let activeBook = null;

  // Console DOM Elements
  const navTabDashboard = document.getElementById('nav-tab-dashboard');
  const navTabConsole = document.getElementById('nav-tab-console');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewConsole = document.getElementById('view-console');
  const dsContentArea = document.getElementById('ds-content-area');
  const btnRefreshConsole = document.getElementById('btn-refresh-console');
  const dsTabs = document.querySelectorAll('.ds-tab');

  let activeDsTab = 'list'; // 'list' | 'queue' | 'stack' | 'bst'
  let bstSearchQuery = '';
  let bstSearchResult = null;

  // View Navigation
  function switchView(viewName) {
    if (viewName === 'console') {
      navTabDashboard.classList.remove('active');
      navTabDashboard.setAttribute('aria-selected', 'false');
      navTabConsole.classList.add('active');
      navTabConsole.setAttribute('aria-selected', 'true');
      viewDashboard.classList.add('hidden');
      viewConsole.classList.remove('hidden');
      syncStructures();
    } else {
      navTabConsole.classList.remove('active');
      navTabConsole.setAttribute('aria-selected', 'false');
      navTabDashboard.classList.add('active');
      navTabDashboard.setAttribute('aria-selected', 'true');
      viewConsole.classList.add('hidden');
      viewDashboard.classList.remove('hidden');
      renderBooks();
    }
  }

  navTabDashboard.addEventListener('click', () => switchView('dashboard'));
  navTabConsole.addEventListener('click', () => switchView('console'));

  // Data Structure Tab Switching
  dsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dsTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeDsTab = tab.dataset.ds;
      bstSearchQuery = '';
      bstSearchResult = null;
      syncStructures();
    });
  });

  btnRefreshConsole.addEventListener('click', async () => {
    await loadData();
    renderConsoleView();
    showToast('Refreshed in-memory data structures from C++ backend.', 'info');
  });

  // Render Data Structure Console
  function renderConsoleView(structuresData = null) {
    if (!structuresData) {
      structuresData = {
        linkedList: { name: "Singly Linked List (Books)", size: state.books.length },
        queue: { name: "FIFO Queue (Requests)", size: state.queue.length },
        stack: { name: "LIFO Stack (Returns)", size: state.recentlyReturned.length },
        bst: {
          name: "Binary Search Tree (Index)",
          size: state.books.length,
          inorder: state.books.map(b => b.id).sort(),
          tree: state.bstTree || buildLocalBST(state.books.map(b => b.id))
        }
      };
    }

    if (activeDsTab === 'list') {
      renderLinkedListConsole(structuresData.linkedList);
    } else if (activeDsTab === 'queue') {
      renderQueueConsole(structuresData.queue);
    } else if (activeDsTab === 'stack') {
      renderStackConsole(structuresData.stack);
    } else if (activeDsTab === 'bst') {
      renderBSTConsole(structuresData.bst);
    }
  }

  async function syncStructures() {
    renderConsoleView();
    try {
      const res = await fetch('/api/structures');
      if (res.ok) {
        const data = await res.json();
        if (data.bst && data.bst.tree) {
          state.bstTree = data.bst.tree;
        }
        renderConsoleView(data);
      }
    } catch {}
  }

  function buildLocalBST(ids) {
    if (!ids || ids.length === 0) return null;
    let root = null;
    function insert(node, id) {
      if (!node) return { id, left: null, right: null };
      if (id < node.id) node.left = insert(node.left, id);
      else if (id > node.id) node.right = insert(node.right, id);
      return node;
    }
    ids.forEach(id => { root = insert(root, id); });
    return root;
  }

  // 1. Linked List Console
  function renderLinkedListConsole(meta) {
    const books = state.books || [];
    let chainHTML = '';

    if (books.length === 0) {
      chainHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p class="empty-state-desc" style="margin:0;">HEAD ➔ NULL (Empty Linked List)</p>
        </div>
      `;
    } else {
      const nodesHTML = books.map(b => `
        <div class="ll-node-box">
          <div class="ll-node-data">
            <div class="ll-node-id">${escapeHTML(b.id)}</div>
            <div class="ll-node-title" title="${escapeHTML(b.title)}">${escapeHTML(b.title)}</div>
            <div class="ll-node-author">${escapeHTML(b.author || 'Author')} • ${b.availableCopies}/${b.totalCopies} Avail</div>
          </div>
          <div class="ll-node-next">
            <span>next*</span>
          </div>
        </div>
        <div class="ll-arrow" aria-hidden="true">➔</div>
      `).join('');

      chainHTML = `
        <div class="ll-chain">
          <div class="ll-pointer-badge">HEAD</div>
          <div class="ll-arrow" aria-hidden="true">➔</div>
          ${nodesHTML}
          <div class="ll-null-badge">NULL</div>
        </div>
      `;
    }

    dsContentArea.innerHTML = `
      <div class="ds-card neo-panel">
        <div class="ds-meta-header">
          <div>
            <h3 class="ds-name">1. Singly Linked List (Book Catalog)</h3>
            <p class="ds-role-desc">
              Primary owning data structure for all book catalog records. Each dynamically allocated node stores
              a <code>Book</code> struct and a pointer to the next volume in the shelf sequence.
            </p>
          </div>
          <div class="ds-badge">Size: ${books.length} Nodes</div>
        </div>

        <div class="ds-viz-wrap">
          <div class="viz-title">Pointer Chain Diagram (Memory Order)</div>
          ${chainHTML}
        </div>

        <div class="ops-section">
          <div class="viz-title">Supported Operations in C++ (BookLinkedList)</div>
          <table class="ops-table">
            <thead>
              <tr><th>Operation</th><th>Complexity</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>insertBack(book)</code></td><td><span class="complexity-badge">O(1)</span></td><td>Appends new volume to the tail pointer.</td></tr>
              <tr><td><code>insertFront(book)</code></td><td><span class="complexity-badge">O(1)</span></td><td>Prepends volume to the head pointer.</td></tr>
              <tr><td><code>remove(bookId)</code></td><td><span class="complexity-badge">O(n)</span></td><td>Locates book by ID and unlinks node, freeing memory.</td></tr>
              <tr><td><code>find(bookId)</code></td><td><span class="complexity-badge">O(n)</span></td><td>Sequential pointer traversal returning a pointer to the book record.</td></tr>
              <tr><td><code>traverse(func)</code></td><td><span class="complexity-badge">O(n)</span></td><td>Traverses each active node from head to tail.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 2. Queue Console
  function renderQueueConsole(meta) {
    const queue = state.queue || [];
    let trackHTML = '';

    if (queue.length === 0) {
      trackHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p class="empty-state-desc" style="margin:0;">FRONT ➔ NULL ➔ REAR (Queue is currently empty)</p>
        </div>
      `;
    } else {
      const cardsHTML = queue.map((req, idx) => `
        <div class="queue-card-node">
          <div class="queue-card-head">
            <span class="queue-rank-badge">#${idx + 1}</span>
            <span class="book-id-badge">${escapeHTML(req.bookId)}</span>
          </div>
          <div class="queue-card-name">${escapeHTML(req.studentName)} (${escapeHTML(req.studentId || 'ID')})</div>
          <div class="queue-card-req">Wants: ${escapeHTML(req.wantsTitle)}</div>
        </div>
        ${idx < queue.length - 1 ? '<div class="ll-arrow" aria-hidden="true">➔</div>' : ''}
      `).join('');

      trackHTML = `
        <div class="queue-viz-track">
          <div class="queue-end-label">FRONT (Next to Serve)</div>
          <div class="ll-arrow" aria-hidden="true">➔</div>
          ${cardsHTML}
          <div class="ll-arrow" aria-hidden="true">➔</div>
          <div class="queue-end-label queue-rear-label">REAR (Intake)</div>
        </div>
      `;
    }

    dsContentArea.innerHTML = `
      <div class="ds-card neo-panel accent-pink">
        <div class="ds-meta-header">
          <div>
            <h3 class="ds-name">2. FIFO Queue (Student Waiting Queue)</h3>
            <p class="ds-role-desc">
              First-In, First-Out waiting line for books with zero available copies. Serves students fairly
              in exact chronological request order.
            </p>
          </div>
          <div class="ds-badge" style="background:#fff;">Size: ${queue.length} Requests</div>
        </div>

        <div class="ds-viz-wrap" style="background: rgba(255,255,255,0.65);">
          <div class="viz-title">FIFO Queue Sequence (Front ➔ Rear)</div>
          ${trackHTML}
        </div>

        <div class="ops-section">
          <div class="viz-title">Supported Operations in C++ (RequestQueue)</div>
          <table class="ops-table">
            <thead>
              <tr><th>Operation</th><th>Complexity</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>enqueue(req)</code></td><td><span class="complexity-badge">O(1)</span></td><td>Appends student request to the rear node pointer.</td></tr>
              <tr><td><code>dequeue(outReq)</code></td><td><span class="complexity-badge">O(1)</span></td><td>Pops the front student to allocate next available copy.</td></tr>
              <tr><td><code>peek(outReq)</code></td><td><span class="complexity-badge">O(1)</span></td><td>Inspects the next waiting student without removing.</td></tr>
              <tr><td><code>dequeueFirstMatching(pred)</code></td><td><span class="complexity-badge">O(n)</span></td><td>Pops first request waiting for a specific book on return.</td></tr>
              <tr><td><code>traverse(func)</code></td><td><span class="complexity-badge">O(n)</span></td><td>Traverses queue from front to rear.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3. Stack Console
  function renderStackConsole(meta) {
    const returns = state.recentlyReturned || [];
    let stackHTML = '';

    if (returns.length === 0) {
      stackHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p class="empty-state-desc" style="margin:0;">TOP ➔ NULL (Return stack is currently empty)</p>
        </div>
      `;
    } else {
      const platesHTML = returns.map((rec, idx) => `
        <div class="stack-plate ${idx === 0 ? 'is-top' : ''}">
          <div>
            <span class="book-id-badge">${escapeHTML(rec.bookId || rec.id)}</span>
            <strong style="margin-left: 6px; font-size: 0.82rem;">${escapeHTML(rec.title)}</strong>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--ink-muted); margin-top: 2px;">
              Returned by: ${escapeHTML(rec.studentName || 'Reader')}
            </div>
          </div>
          <div>
            ${idx === 0 ? '<span class="sticker-top-pile">TOP OF STACK</span>' : `<span style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--ink-light);">${escapeHTML(rec.timeAgo || 'Earlier')}</span>`}
          </div>
        </div>
      `).join('');

      stackHTML = `
        <div class="stack-viz-column">
          <div class="stack-top-indicator">⬇ TOP OF STACK (Push / Pop Point)</div>
          ${platesHTML}
          <div class="stack-base-indicator">════ BASE OF STACK (NULL) ════</div>
        </div>
      `;
    }

    dsContentArea.innerHTML = `
      <div class="ds-card neo-panel accent-teal" style="background:#289fa3;">
        <div class="ds-meta-header" style="border-bottom-color: rgba(255,255,255,0.3);">
          <div>
            <h3 class="ds-name" style="color:#fff;">3. LIFO Stack (Recently Returned Drop Pile)</h3>
            <p class="ds-role-desc" style="color:#d8f3ec;">
              Last-In, First-Out stack modeling physical book return drops. The most recently dropped book
              rests on top of the pile and is inspected first by library staff.
            </p>
          </div>
          <div class="ds-badge" style="background:#e6faf7;">Size: ${returns.length} Returned</div>
        </div>

        <div class="ds-viz-wrap" style="background: rgba(255,255,255,0.75);">
          <div class="viz-title" style="text-align: center;">LIFO Stack Hierarchy (Vertical Drop Order)</div>
          ${stackHTML}
        </div>

        <div class="ops-section" style="border-top-color: rgba(255,255,255,0.3);">
          <div class="viz-title" style="color: #d8f3ec;">Supported Operations in C++ (ReturnStack)</div>
          <table class="ops-table" style="color: #fff;">
            <thead>
              <tr style="color: #d8f3ec;"><th>Operation</th><th>Complexity</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>push(record)</code></td><td><span class="complexity-badge" style="color:#111;">O(1)</span></td><td>Pushes newly dropped book onto the top pointer.</td></tr>
              <tr><td><code>pop(outRecord)</code></td><td><span class="complexity-badge" style="color:#111;">O(1)</span></td><td>Removes and inspects the topmost returned volume.</td></tr>
              <tr><td><code>peek(outRecord)</code></td><td><span class="complexity-badge" style="color:#111;">O(1)</span></td><td>Reads top of stack without removal.</td></tr>
              <tr><td><code>traverse(func)</code></td><td><span class="complexity-badge" style="color:#111;">O(n)</span></td><td>Inspects all returned items from top to base.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 4. Binary Search Tree Console
  function renderBSTConsole(bstData) {
    const inorderList = (bstData && bstData.inorder) ? bstData.inorder : (state.books || []).map(b => b.id).sort();
    const treeRoot = bstData ? bstData.tree : null;

    // Build In-Order Traversal String
    let inorderHTML = '';
    if (inorderList.length === 0) {
      inorderHTML = '<span style="color: var(--ink-muted);">Tree is empty.</span>';
    } else {
      inorderHTML = inorderList.map((id, idx) => `
        <span class="bst-inorder-tag">${escapeHTML(id)}</span>
        ${idx < inorderList.length - 1 ? '<span style="font-weight:900;">➔</span>' : ''}
      `).join(' ');
    }

    // Build Tree Diagram HTML recursively
    function renderTreeNodeHTML(node, targetId) {
      if (!node) return '<div style="font-family: var(--font-mono); font-size: 0.65rem; color: #a49e92; padding: 4px;">NULL</div>';
      const isMatch = targetId && node.id.toUpperCase() === targetId.toUpperCase();
      const highlightClass = isMatch ? 'highlight-search' : '';
      const hasChildren = node.left || node.right;

      let childrenHTML = '';
      if (hasChildren) {
        childrenHTML = `
          <div class="tree-children">
            <div class="tree-branch-left">${renderTreeNodeHTML(node.left, targetId)}</div>
            <div class="tree-branch-right">${renderTreeNodeHTML(node.right, targetId)}</div>
          </div>
        `;
      }

      return `
        <div class="tree-node-wrapper">
          <div class="tree-node-circle ${highlightClass}">
            ${escapeHTML(node.id)}
          </div>
          ${childrenHTML}
        </div>
      `;
    }

    let treeDiagramHTML = '';
    if (!treeRoot) {
      // Fallback: build simple balanced view from inorder if raw tree json is absent
      if (inorderList.length === 0) {
        treeDiagramHTML = '<div class="empty-state" style="padding: 20px;"><p class="empty-state-desc" style="margin:0;">ROOT ➔ NULL (Empty Tree)</p></div>';
      } else {
        treeDiagramHTML = `<div class="bst-tree-container"><div class="bst-inorder-strip">Tree nodes indexed: ${inorderHTML}</div></div>`;
      }
    } else {
      treeDiagramHTML = `
        <div class="bst-tree-container">
          ${renderTreeNodeHTML(treeRoot, bstSearchQuery)}
        </div>
      `;
    }

    let searchResultHTML = '';
    if (bstSearchResult) {
      const isSuccess = bstSearchResult.found;
      const resClass = isSuccess ? 'bst-result-success' : 'bst-result-fail';
      searchResultHTML = `
        <div class="bst-result-banner ${resClass}">
          ${escapeHTML(bstSearchResult.message)}
        </div>
      `;
    }

    dsContentArea.innerHTML = `
      <div class="ds-card neo-panel accent-yellow">
        <div class="ds-meta-header">
          <div>
            <h3 class="ds-name">4. Binary Search Tree (Book ID Fast Index)</h3>
            <p class="ds-role-desc">
              Logarithmic-time lookup index organized by Book ID (<code>B-101</code> &lt; <code>B-102</code> &lt; ...).
              Prevents duplicate book IDs and accelerates searches without scanning the entire linked list.
            </p>
          </div>
          <div class="ds-badge" style="background:#fff;">Size: ${inorderList.length} Nodes</div>
        </div>

        <!-- Interactive Search Bar -->
        <div class="bst-toolbar">
          <label for="bst-search-input" class="neo-label" style="margin:0; font-weight:800;">TEST BST SEARCH:</label>
          <input type="text" id="bst-search-input" class="neo-input text-upper bst-search-input" placeholder="e.g. B-104" value="${escapeHTML(bstSearchQuery)}">
          <button type="button" id="btn-bst-search" class="neo-btn btn-coral btn-sm">🔍 Search ID</button>
          <button type="button" id="btn-bst-reset" class="neo-btn btn-secondary btn-sm">Reset</button>
        </div>

        ${searchResultHTML}

        <!-- In-order Traversal Strip -->
        <div class="viz-title">In-Order Traversal (Sorted Book IDs)</div>
        <div class="bst-inorder-strip">
          ${inorderHTML}
        </div>

        <!-- Tree Branch Visualization -->
        <div class="ds-viz-wrap" style="background: rgba(255,255,255,0.7);">
          <div class="viz-title">Hierarchical Tree Structure (Root, Left, Right)</div>
          ${treeDiagramHTML}
        </div>

        <!-- Operations Table -->
        <div class="ops-section">
          <div class="viz-title">Supported Operations in C++ (BookBST)</div>
          <table class="ops-table">
            <thead>
              <tr><th>Operation</th><th>Average</th><th>Worst Case</th><th>Description</th></tr>
            </thead>
            <tbody>
              <tr><td><code>search(id)</code></td><td><span class="complexity-badge">O(log n)</span></td><td><span class="complexity-badge">O(n)</span></td><td>Fast key lookup comparing IDs lexicographically.</td></tr>
              <tr><td><code>insert(id)</code></td><td><span class="complexity-badge">O(log n)</span></td><td><span class="complexity-badge">O(n)</span></td><td>Recursively inserts unique ID; rejects duplicates.</td></tr>
              <tr><td><code>remove(id)</code></td><td><span class="complexity-badge">O(log n)</span></td><td><span class="complexity-badge">O(n)</span></td><td>Removes node replacing with in-order successor.</td></tr>
              <tr><td><code>inorder(func)</code></td><td><span class="complexity-badge">O(n)</span></td><td><span class="complexity-badge">O(n)</span></td><td>Traverses left ➔ root ➔ right in sorted order.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach BST Search Events
    const searchInp = document.getElementById('bst-search-input');
    const searchBtn = document.getElementById('btn-bst-search');
    const resetBtn = document.getElementById('btn-bst-reset');

    function executeBSTSearch() {
      const query = searchInp.value.trim().toUpperCase();
      if (!query) return;
      bstSearchQuery = query;

      // Trace search path through BST
      let curr = treeRoot;
      const path = [];
      let found = false;

      while (curr) {
        path.push(curr.id);
        if (query === curr.id) {
          found = true;
          break;
        } else if (query < curr.id) {
          curr = curr.left;
        } else {
          curr = curr.right;
        }
      }

      if (found) {
        bstSearchResult = {
          found: true,
          message: `✓ Found Book ID "${query}" in BST! Search path: ${path.join(' ➔ ')} (Depth: ${path.length})`
        };
      } else {
        bstSearchResult = {
          found: false,
          message: `✗ Book ID "${query}" not found in BST. Evaluated path: ${path.length ? path.join(' ➔ ') + ' ➔ NULL' : 'Root was NULL'}`
        };
      }

      renderBSTConsole(bstData);
    }

    searchBtn.addEventListener('click', executeBSTSearch);
    searchInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeBSTSearch();
      }
    });

    resetBtn.addEventListener('click', () => {
      bstSearchQuery = '';
      bstSearchResult = null;
      renderBSTConsole(bstData);
    });
  }

  // Mini Book Cover Illustrator
  function renderBookCoverHTML(styleIndex, isSmall = false) {
    const size = isSmall ? 'return-cover-mini' : 'book-cover-art';
    const s = ((styleIndex - 1) % 5) + 1;
    if (s === 1) return `<div class="${size} cover-style-1"><div class="cover-top"></div><div class="cover-lines"><span></span><span></span><span></span></div></div>`;
    if (s === 2) return `<div class="${size} cover-style-2"><div class="cover-circle"></div><div class="cover-bar"></div></div>`;
    if (s === 3) return `<div class="${size} cover-style-3"><svg viewBox="0 0 38 48"><path d="M 4,12 C 14,8 24,16 34,12 M 4,24 C 14,20 24,28 34,24 M 4,36 C 14,32 24,40 34,36" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></div>`;
    if (s === 4) return `<div class="${size} cover-style-4"><span class="star-icon">★</span><div class="dots-bottom"><span></span><span></span></div></div>`;
    return `<div class="${size} cover-style-5"><span></span><span></span><span></span><span></span><span></span><span></span></div>`;
  }

  // Render Books List
  function renderBooks() {
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = state.books.filter(b => {
      if (!q) return true;
      if (state.searchMode === 'title') {
        return b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q));
      }
      return b.id.toLowerCase().includes(q);
    });

    if (state.searchQuery.trim()) {
      shelfCountBadge.textContent = `${filtered.length} of ${state.books.length} Books`;
    } else {
      if (state.books.length === 0) {
        shelfCountBadge.textContent = '0 Books';
      } else {
        shelfCountBadge.textContent = `${state.stats.totalBooks} Titles • ${state.stats.availableCopies} Avail / ${state.stats.borrowedCopies} Loaned`;
      }
    }

    if (filtered.length === 0) {
      bookListContainer.innerHTML = '';
      const emptyTitle = noBooksState.querySelector('.empty-state-title');
      const emptyDesc = noBooksState.querySelector('.empty-state-desc');
      if (state.books.length === 0) {
        if (emptyTitle) emptyTitle.textContent = 'No books in the library yet';
        if (emptyDesc) emptyDesc.textContent = 'Use the "+ Add a Book" form on the right to register your first volume.';
        if (resetSearchBtn) resetSearchBtn.classList.add('hidden');
      } else {
        if (emptyTitle) emptyTitle.textContent = 'No books match your search';
        if (emptyDesc) emptyDesc.textContent = 'Try searching with a different title keyword or book ID.';
        if (resetSearchBtn) resetSearchBtn.classList.remove('hidden');
      }
      noBooksState.classList.remove('hidden');
      return;
    }
    noBooksState.classList.add('hidden');

    bookListContainer.innerHTML = filtered.map(b => {
      const avail = b.availableCopies > 0;
      const statusBadge = avail
        ? `<span class="status-badge status-available">AVAILABLE (${b.availableCopies}/${b.totalCopies})</span>`
        : `<span class="status-badge status-borrowed">BORROWED (0/${b.totalCopies})</span>`;

      let subtext = '';
      if (avail) {
        subtext = `<span class="book-subtext">Ready for check-out • by ${escapeHTML(b.author || 'Unknown')}</span>`;
      } else {
        const primaryBorrower = b.borrower || (b.activeLoans && b.activeLoans.length ? b.activeLoans[0].studentName : 'Reader');
        subtext = `<span class="book-subtext subtext-borrowed">With: ${escapeHTML(primaryBorrower)}</span>`;
      }

      const actions = avail
        ? `<button type="button" class="neo-btn btn-mint btn-sm" data-action="loan" data-id="${b.id}">Loan</button>
           <button type="button" class="neo-btn btn-secondary btn-sm" data-action="waitlist" data-id="${b.id}">Waitlist</button>`
        : `<button type="button" class="neo-btn btn-teal btn-sm" data-action="return" data-id="${b.id}">Return</button>
           <button type="button" class="neo-btn btn-mustard btn-sm" data-action="request" data-id="${b.id}">Request</button>`;

      return `
        <article class="book-card" data-book-id="${b.id}">
          <div class="book-card-left">
            ${renderBookCoverHTML(b.coverStyle)}
            <div class="book-details">
              <div class="book-meta-row">
                <span class="book-id-badge">${escapeHTML(b.id)}</span>
                ${statusBadge}
              </div>
              <h3 class="book-title" title="${escapeHTML(b.title)}">${escapeHTML(b.title)}</h3>
              ${subtext}
            </div>
          </div>
          <div class="book-actions">
            ${actions}
            <button type="button" class="neo-btn btn-icon-only btn-sm" data-action="delete" data-id="${b.id}" aria-label="Delete ${b.title}">
              <svg class="trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Render Queue (FIFO)
  function renderQueue() {
    queueCountBadge.textContent = `${state.queue.length} Enqueued`;
    serveNextBtn.disabled = state.queue.length === 0;

    if (state.queue.length === 0) {
      queueListContainer.innerHTML = '<div class="empty-state" style="padding: 14px; background: rgba(255,255,255,0.7);"><p class="empty-state-desc" style="margin:0; font-weight:600; color:var(--ink-black);">No pending requests</p></div>';
      return;
    }

    queueListContainer.innerHTML = state.queue.map((item, idx) => `
      <div class="queue-item-card" role="listitem">
        <div class="queue-rank-badge">#${idx + 1}</div>
        <div class="queue-info">
          <div class="queue-name-row">
            <span class="queue-person-name">${escapeHTML(item.studentName)}</span>
            ${idx === 0 ? '<span class="sticker-next">NEXT</span>' : ''}
          </div>
          <p class="queue-book-request">Wants: ${escapeHTML(item.wantsTitle)}</p>
        </div>
        <div class="queue-book-id-badge">${escapeHTML(item.bookId)}</div>
      </div>
    `).join('');
  }

  // Render Returns (LIFO)
  function renderReturns() {
    returnsCountBadge.textContent = `${state.recentlyReturned.length} in Stack`;
    if (state.recentlyReturned.length === 0) {
      returnsListContainer.innerHTML = '<div class="empty-state" style="padding: 14px; background: rgba(255,255,255,0.7);"><p class="empty-state-desc" style="margin:0; color:#111; font-weight:600;">No books returned yet</p></div>';
      return;
    }

    returnsListContainer.innerHTML = state.recentlyReturned.map((item, idx) => `
      <div class="return-item-card" role="listitem">
        ${renderBookCoverHTML(item.coverStyle, true)}
        <div class="return-info">
          <span class="book-id-badge">${escapeHTML(item.id || item.bookId)}</span>
          <h4 class="return-title">${escapeHTML(item.title)}</h4>
        </div>
        ${idx === 0 ? '<span class="sticker-top-pile">TOP PILE</span>' : `<span class="return-time-ago">${escapeHTML(item.timeAgo || 'Earlier')}</span>`}
      </div>
    `).join('');
  }

  // Fetch all live data from C++ Backend API
  async function loadData() {
    try {
      const [resBooks, resQueue, resReturns, resStats] = await Promise.all([
        fetch('/api/books'),
        fetch('/api/queue'),
        fetch('/api/returns'),
        fetch('/api/stats')
      ]);

      if (resBooks.ok && resQueue.ok && resReturns.ok) {
        state.books = await resBooks.json();
        state.queue = await resQueue.json();
        state.recentlyReturned = await resReturns.json();
        if (resStats.ok) {
          state.stats = await resStats.json();
        } else {
          calculateLocalStats();
        }
        state.apiConnected = true;
        if (statusIndicator) {
          statusIndicator.querySelector('.status-text').textContent = 'ZINE ENGINE: ONLINE';
        }
      } else {
        throw new Error('API response failed');
      }
    } catch {
      state.apiConnected = false;
      calculateLocalStats();
      if (statusIndicator) {
        statusIndicator.querySelector('.status-text').textContent = 'ZINE ENGINE: OFFLINE';
      }
    }

    renderBooks();
    renderQueue();
    renderReturns();
  }

  function calculateLocalStats() {
    let avail = 0, total = 0;
    state.books.forEach(b => {
      total += (b.totalCopies || 1);
      avail += (b.availableCopies !== undefined ? b.availableCopies : (b.status === 'AVAILABLE' ? 1 : 0));
    });
    state.stats = {
      totalBooks: state.books.length,
      totalCopies: total,
      availableCopies: avail,
      borrowedCopies: total - avail,
      pendingRequests: state.queue.length,
      recentReturns: state.recentlyReturned.length
    };
  }

  // Modals Controller
  function openModal(action, book) {
    activeModalAction = action;
    activeBook = book;
    actionModal.classList.remove('hidden');

    if (action === 'borrow') {
      modalTitle.textContent = 'Borrow Volume';
      modalSubmitBtn.textContent = 'Loan Book';
      modalSubmitBtn.className = 'neo-btn btn-mint';
      modalBookBanner.innerHTML = `<strong>${escapeHTML(book.id)}: ${escapeHTML(book.title)}</strong><br>Available copies: ${book.availableCopies} of ${book.totalCopies}`;
      modalFields.innerHTML = `
        <div class="form-group">
          <label for="modal-student-id" class="neo-label">STUDENT ID</label>
          <input type="text" id="modal-student-id" class="neo-input text-upper" placeholder="e.g. S-108" required value="S-${Math.floor(Math.random() * 899 + 100)}">
        </div>
        <div class="form-group">
          <label for="modal-student-name" class="neo-label">STUDENT NAME</label>
          <input type="text" id="modal-student-name" class="neo-input" placeholder="e.g. Nora Patel" required autofocus>
        </div>
      `;
    } else if (action === 'return') {
      modalTitle.textContent = 'Return Volume';
      modalSubmitBtn.textContent = 'Confirm Return';
      modalSubmitBtn.className = 'neo-btn btn-teal';
      modalBookBanner.innerHTML = `<strong>${escapeHTML(book.id)}: ${escapeHTML(book.title)}</strong><br>Total copies: ${book.totalCopies} • Currently borrowed: ${book.totalCopies - book.availableCopies}`;

      const loans = book.activeLoans || [];
      let borrowerSelectHTML = '';
      if (loans.length > 0) {
        borrowerSelectHTML = `
          <div class="form-group">
            <label for="modal-student-name" class="neo-label">SELECT BORROWER RECORD</label>
            <select id="modal-student-name" class="neo-input">
              ${loans.map(l => `<option value="${escapeHTML(l.studentName)}" data-student-id="${escapeHTML(l.studentId)}">${escapeHTML(l.studentName)} (${escapeHTML(l.studentId)})</option>`).join('')}
            </select>
          </div>
        `;
      } else {
        borrowerSelectHTML = `
          <div class="form-group">
            <label for="modal-student-name" class="neo-label">STUDENT NAME / ID</label>
            <input type="text" id="modal-student-name" class="neo-input" placeholder="e.g. Elena Rostova" value="${escapeHTML(book.borrower || '')}" required>
          </div>
        `;
      }
      modalFields.innerHTML = borrowerSelectHTML;
    } else if (action === 'waitlist') {
      modalTitle.textContent = 'Join FIFO Waiting Queue';
      modalSubmitBtn.textContent = 'Enqueue Request';
      modalSubmitBtn.className = 'neo-btn btn-mustard';
      modalBookBanner.innerHTML = `<strong>${escapeHTML(book.id)}: ${escapeHTML(book.title)}</strong><br>Status: All copies are in circulation.`;
      modalFields.innerHTML = `
        <div class="form-group">
          <label for="modal-student-id" class="neo-label">STUDENT ID</label>
          <input type="text" id="modal-student-id" class="neo-input text-upper" placeholder="e.g. S-109" required value="S-${Math.floor(Math.random() * 899 + 100)}">
        </div>
        <div class="form-group">
          <label for="modal-student-name" class="neo-label">STUDENT NAME</label>
          <input type="text" id="modal-student-name" class="neo-input" placeholder="e.g. Julian Thorne" required autofocus>
        </div>
      `;
    }
  }

  function closeModal() {
    actionModal.classList.add('hidden');
    activeModalAction = null;
    activeBook = null;
    modalFields.innerHTML = '';
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);
  actionModal.addEventListener('click', (e) => {
    if (e.target === actionModal) closeModal();
  });

  // Modal Form Submission
  modalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeBook || !activeModalAction) return;

    modalSubmitBtn.disabled = true;
    modalSubmitBtn.textContent = 'Processing...';

    const sNameInput = document.getElementById('modal-student-name');
    const sIdInput = document.getElementById('modal-student-id');
    let studentName = sNameInput ? sNameInput.value.trim() : '';
    let studentId = sIdInput ? sIdInput.value.trim().toUpperCase() : '';

    if (sNameInput && sNameInput.tagName === 'SELECT') {
      const opt = sNameInput.options[sNameInput.selectedIndex];
      if (opt && opt.dataset.studentId) {
        studentId = opt.dataset.studentId;
      }
    }

    if (!studentName && activeModalAction !== 'return') {
      showToast('Please enter a student name.', 'alert');
      modalSubmitBtn.disabled = false;
      modalSubmitBtn.textContent = 'Confirm';
      return;
    }

    try {
      if (activeModalAction === 'borrow') {
        const res = await fetch('/api/borrow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: activeBook.id, studentId, studentName })
        });
        const data = await res.json().catch(err => {
          console.error('Failed to parse borrow JSON response:', err);
          return null;
        });
        if (res.ok && data) {
          showToast(`✓ Loaned "${activeBook.title}" to ${studentName}!`, 'success');
          closeModal();
          await loadData();
        } else {
          showToast((data && data.error) || 'Failed to borrow book.', 'alert');
          if (data && data.canQueue) {
            openModal('waitlist', activeBook);
          }
        }
      } else if (activeModalAction === 'return') {
        const res = await fetch('/api/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: activeBook.id, studentName, studentId })
        });
        const data = await res.json().catch(err => {
          console.error('Failed to parse return JSON response:', err);
          return null;
        });
        if (res.ok && data) {
          showToast(data.message || `✓ "${activeBook.title}" returned!`, 'success');
          closeModal();
          await loadData();
        } else {
          showToast((data && data.error) || 'Failed to return book.', 'alert');
        }
      } else if (activeModalAction === 'waitlist') {
        const res = await fetch('/api/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, studentName, bookId: activeBook.id, wantsTitle: activeBook.title })
        });
        const data = await res.json().catch(err => {
          console.error('Failed to parse queue JSON response:', err);
          return null;
        });
        if (res.ok) {
          showToast(`✓ Added ${studentName} to FIFO waitlist for ${activeBook.id}!`, 'info');
          closeModal();
          await loadData();
        } else {
          showToast((data && data.error) || 'Failed to enqueue request.', 'alert');
        }
      }
    } catch (err) {
      console.error('Modal form submission error:', err);
      showToast('Backend communication error. Please try again.', 'alert');
    } finally {
      modalSubmitBtn.disabled = false;
    }
  });

  // Filter Mode Toggles
  function setSearchMode(mode) {
    if (state.searchMode === mode) return;
    state.searchMode = mode;
    const isTitle = mode === 'title';
    btnSearchByTitle.classList.toggle('active', isTitle);
    btnSearchByTitle.setAttribute('aria-pressed', isTitle);
    btnSearchById.classList.toggle('active', !isTitle);
    btnSearchById.setAttribute('aria-pressed', !isTitle);
    searchInput.placeholder = isTitle ? 'Type to filter titles (e.g. Graphic Storytelling)...' : 'Type to filter by ID (e.g. B-101)...';
    renderBooks();
  }

  btnSearchByTitle.addEventListener('click', () => setSearchMode('title'));
  btnSearchById.addEventListener('click', () => setSearchMode('id'));

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    searchClearBtn.classList.toggle('hidden', state.searchQuery.trim().length === 0);
    renderBooks();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClearBtn.classList.add('hidden');
    searchInput.focus();
    renderBooks();
  });

  resetSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    searchClearBtn.classList.add('hidden');
    renderBooks();
  });

  // Add Book Form Handler
  addBookForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBookBtn.disabled = true;
    submitBookBtn.textContent = 'REGISTERING...';

    const id = bookIdInput.value.trim().toUpperCase();
    const title = bookTitleInput.value.trim();
    const author = bookAuthorInput ? bookAuthorInput.value.trim() : 'Unknown Author';
    const totalCopies = bookCopiesInput ? parseInt(bookCopiesInput.value, 10) : 1;

    if (!id) {
      showToast('Please enter a Book ID (e.g. B-108).', 'alert');
      bookIdInput.focus();
      submitBookBtn.disabled = false;
      submitBookBtn.textContent = '+ ADD BOOK';
      return;
    }
    if (!title) {
      showToast('Please enter a Book Title.', 'alert');
      bookTitleInput.focus();
      submitBookBtn.disabled = false;
      submitBookBtn.textContent = '+ ADD BOOK';
      return;
    }
    if (isNaN(totalCopies) || totalCopies < 1) {
      showToast('Total copies must be at least 1.', 'alert');
      if (bookCopiesInput) bookCopiesInput.focus();
      submitBookBtn.disabled = false;
      submitBookBtn.textContent = '+ ADD BOOK';
      return;
    }

    const coverStyle = (state.books.length % 5) + 1;

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, author, totalCopies, coverStyle })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to add book.', 'alert');
        bookIdInput.focus();
        return;
      }

      showToast(`✓ Registered "${title}" (${id}) with ${totalCopies} copies!`, 'success');
      bookTitleInput.value = '';
      bookIdInput.value = '';
      if (bookAuthorInput) bookAuthorInput.value = '';
      if (bookCopiesInput) bookCopiesInput.value = '1';
      await loadData();
    } catch {
      showToast('Failed to reach backend server.', 'alert');
    } finally {
      submitBookBtn.disabled = false;
      submitBookBtn.textContent = '+ ADD BOOK';
    }
  });

  // Book Card Event Delegation: Loan, Return, Waitlist, Delete
  bookListContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    const book = state.books.find(b => b.id === id);
    if (!book) return;

    if (action === 'loan') {
      if (book.availableCopies <= 0) {
        openModal('waitlist', book);
      } else {
        openModal('borrow', book);
      }
    } else if (action === 'return') {
      openModal('return', book);
    } else if (action === 'waitlist' || action === 'request') {
      openModal('waitlist', book);
    } else if (action === 'delete') {
      if (confirm(`Remove "${book.title}" (${book.id}) from the catalog?`)) {
        try {
          const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast(`✓ Removed "${book.title}" from catalog.`, 'alert');
            await loadData();
          } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.error || 'Failed to delete book.', 'alert');
          }
        } catch {
          showToast('Failed to connect to backend server.', 'alert');
        }
      }
    }
  });

  // FIFO Serve Next Student Button
  serveNextBtn.addEventListener('click', async () => {
    serveNextBtn.disabled = true;
    try {
      const res = await fetch('/api/queue/serve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const data = await res.json().catch(err => {
        console.error('Failed to parse serve JSON response:', err);
        return null;
      });
      if (res.ok && data) {
        showToast(`✓ ${data.message}`, 'success');
        await loadData();
      } else {
        const msg = (data && data.error) ? data.error : (data && data.message ? data.message : 'Could not serve request.');
        showToast(msg, 'info');
      }
    } catch (err) {
      console.error('Serve Next Student communication error:', err);
      showToast('Backend communication error. Please try again.', 'alert');
    } finally {
      serveNextBtn.disabled = false;
    }
  });

  // Toast Notifications
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `neo-toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'alert' ? '⚠' : 'ℹ';
    t.innerHTML = `<span>${icon}</span> <span>${escapeHTML(msg)}</span>`;
    toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s, transform 0.2s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 200);
    }, 3200);
  }

  function escapeHTML(s) {
    return typeof s === 'string' ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
  }

  // Initial immediate render, then sync live backend data
  renderBooks();
  renderQueue();
  renderReturns();
  loadData();

  if (window.location.hash.startsWith('#console')) {
    switchView('console');
    if (window.location.hash === '#console-queue') {
      document.getElementById('ds-tab-queue').click();
    } else if (window.location.hash === '#console-stack') {
      document.getElementById('ds-tab-stack').click();
    } else if (window.location.hash === '#console-bst') {
      document.getElementById('ds-tab-bst').click();
    }
  }
});
