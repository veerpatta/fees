// Dashboard JavaScript
import { checkAuth, logout, getCurrentUser, isPrincipal, logAudit } from './auth.js';
import { db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let currentAcademicYear = null;
let academicYears = [];

// Initialize dashboard
async function initDashboard() {
  try {
    showLoading(true);

    // Check authentication
    currentUser = await checkAuth(['principal', 'staff']);

    // Update UI with user info
    updateUserInfo();

    // Load academic years
    await loadAcademicYears();

    // Load dashboard data
    await loadDashboardData();

    // Setup event listeners
    setupEventListeners();

    showLoading(false);
  } catch (error) {
    console.error('Dashboard initialization error:', error);
    showAlert('Failed to load dashboard. Redirecting to login...', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
  }
}

// Update user info in sidebar
function updateUserInfo() {
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userRole').textContent = currentUser.role;

  // Show/hide principal-only items
  if (isPrincipal()) {
    document.querySelectorAll('.principal-only').forEach(el => {
      el.classList.remove('hidden');
    });
  }
}

// Load academic years
async function loadAcademicYears() {
  try {
    const yearsQuery = query(
      collection(db, 'academicYears'),
      orderBy('startDate', 'desc')
    );

    const snapshot = await getDocs(yearsQuery);
    academicYears = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Populate academic year dropdown
    const yearSelect = document.getElementById('academicYear');
    yearSelect.innerHTML = '';

    if (academicYears.length === 0) {
      yearSelect.innerHTML = '<option value="">No academic years found</option>';
      if (isPrincipal()) {
        showAlert('Please create an academic year first', 'warning');
      }
      return;
    }

    // Find current/active year
    const activeYear = academicYears.find(y => y.isActive) || academicYears[0];
    currentAcademicYear = activeYear.id;

    academicYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year.id;
      option.textContent = year.name;
      if (year.id === currentAcademicYear) {
        option.selected = true;
      }
      yearSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading academic years:', error);
    showAlert('Failed to load academic years', 'error');
  }
}

// Load dashboard data
async function loadDashboardData() {
  if (!currentAcademicYear) return;

  try {
    // Load statistics
    await loadStatistics();

    // Load recent payments
    await loadRecentPayments();

    // Load pending payments
    await loadPendingPayments();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showAlert('Failed to load dashboard data', 'error');
  }
}

// Load statistics
async function loadStatistics() {
  try {
    // Get total students for current year
    const studentsQuery = query(
      collection(db, 'students'),
      where('academicYear', '==', currentAcademicYear)
    );
    const studentsSnapshot = await getDocs(studentsQuery);
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    document.getElementById('totalStudents').textContent = students.length;

    // Calculate total fees, collected, and pending
    let totalFees = 0;
    let totalCollected = 0;
    let totalPending = 0;

    students.forEach(student => {
      const fees = student.totalFees || 0;
      const paid = student.totalPaid || 0;
      totalFees += fees;
      totalCollected += paid;
      totalPending += (fees - paid);
    });

    document.getElementById('totalCollected').textContent = formatCurrency(totalCollected);
    document.getElementById('totalPending').textContent = formatCurrency(totalPending);

    // Get today's collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentsQuery = query(
      collection(db, 'payments'),
      where('academicYear', '==', currentAcademicYear),
      where('paymentDate', '>=', today)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    const todayPayments = paymentsSnapshot.docs.map(doc => doc.data());

    const todayTotal = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    document.getElementById('todayCollection').textContent = formatCurrency(todayTotal);
    document.getElementById('todayPaymentsCount').textContent =
      `${todayPayments.length} payment${todayPayments.length !== 1 ? 's' : ''} today`;
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Load recent payments
async function loadRecentPayments() {
  try {
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('academicYear', '==', currentAcademicYear),
      orderBy('paymentDate', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(paymentsQuery);
    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const container = document.getElementById('recentPaymentsTable');

    if (payments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💳</div>
          <h3>No Payments Yet</h3>
          <p>Recent payments will appear here</p>
        </div>
      `;
      return;
    }

    // Build table
    let html = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Receipt No.</th>
            <th>Student</th>
            <th>Amount</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    payments.forEach(payment => {
      const date = payment.paymentDate?.toDate?.() || new Date(payment.paymentDate);
      html += `
        <tr>
          <td>${formatDate(date)}</td>
          <td>${payment.receiptNumber || 'N/A'}</td>
          <td>${payment.studentName || 'Unknown'}</td>
          <td>${formatCurrency(payment.amount)}</td>
          <td><span class="badge badge-info">${payment.paymentMode || 'N/A'}</span></td>
          <td><span class="badge badge-success">Paid</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-outline" onclick="viewReceipt('${payment.id}')">
                📄 Receipt
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading recent payments:', error);
  }
}

// Load pending payments
async function loadPendingPayments() {
  try {
    const studentsQuery = query(
      collection(db, 'students'),
      where('academicYear', '==', currentAcademicYear)
    );

    const snapshot = await getDocs(studentsQuery);
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter students with pending dues
    const pendingStudents = students.filter(s => {
      const pending = (s.totalFees || 0) - (s.totalPaid || 0);
      return pending > 0;
    });

    const container = document.getElementById('pendingPaymentsTable');

    if (pendingStudents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <h3>All Paid Up!</h3>
          <p>No pending payments</p>
        </div>
      `;
      return;
    }

    // Build table
    let html = `
      <table>
        <thead>
          <tr>
            <th>Student Name</th>
            <th>Class</th>
            <th>Total Fees</th>
            <th>Paid</th>
            <th>Pending</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    pendingStudents.forEach(student => {
      const pending = (student.totalFees || 0) - (student.totalPaid || 0);
      html += `
        <tr>
          <td>${student.name || 'Unknown'}</td>
          <td>${student.class || 'N/A'}</td>
          <td>${formatCurrency(student.totalFees)}</td>
          <td>${formatCurrency(student.totalPaid)}</td>
          <td><strong class="text-warning">${formatCurrency(pending)}</strong></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-primary" onclick="addPayment('${student.id}')">
                💰 Pay
              </button>
              <button class="btn btn-sm btn-outline" onclick="viewStudent('${student.id}')">
                👁️ View
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading pending payments:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      showAlert('Failed to logout', 'error');
    }
  });

  // Academic year change
  document.getElementById('academicYear').addEventListener('change', async (e) => {
    currentAcademicYear = e.target.value;
    showLoading(true);
    await loadDashboardData();
    showLoading(false);
  });

  // Navigation menu
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });

  // Mobile menu toggle
  document.getElementById('mobileMenuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
  });

  // Add payment button
  document.getElementById('addPaymentBtn')?.addEventListener('click', () => {
    showAlert('Payment form will open here', 'info');
  });

  // Add student button
  document.getElementById('addStudentBtn')?.addEventListener('click', () => {
    showAlert('Student form will open here', 'info');
  });

  document.getElementById('addStudentBtnEmpty')?.addEventListener('click', () => {
    showAlert('Student form will open here', 'info');
  });
}

// Switch view
function switchView(view) {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === view) {
      item.classList.add('active');
    }
  });

  // Hide all views
  document.querySelectorAll('.view-content').forEach(v => {
    v.classList.add('hidden');
  });

  // Show selected view
  const viewMap = {
    'dashboard': 'dashboardView',
    'students': 'studentsView',
    'payments': 'paymentsView',
    'reports': 'reportsView',
    'bulk-upload': 'bulkUploadView',
    'promo-codes': 'promoCodesView',
    'fee-structure': 'feeStructureView',
    'academic-years': 'academicYearsView',
    'audit-logs': 'auditLogsView'
  };

  const viewId = viewMap[view];
  if (viewId) {
    document.getElementById(viewId).classList.remove('hidden');

    // Update page title
    const titles = {
      'dashboard': 'Dashboard',
      'students': 'Student Management',
      'payments': 'Payment History',
      'reports': 'Reports & Analytics',
      'bulk-upload': 'Bulk Upload',
      'promo-codes': 'Promo Codes',
      'fee-structure': 'Fee Structure',
      'academic-years': 'Academic Years',
      'audit-logs': 'Audit Logs'
    };
    document.getElementById('pageTitle').textContent = titles[view];
  }

  // Load view data if needed
  if (view === 'students') {
    loadStudentsView();
  } else if (view === 'payments') {
    loadPaymentsView();
  }
}

// Load students view
async function loadStudentsView() {
  // Placeholder - will be implemented
  console.log('Loading students view...');
}

// Load payments view
async function loadPaymentsView() {
  // Placeholder - will be implemented
  console.log('Loading payments view...');
}

// Utility Functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function showAlert(message, type = 'info') {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="alert-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(alert);

  setTimeout(() => {
    if (alert.parentElement) {
      alert.remove();
    }
  }, 5000);
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// Make functions globally available
window.viewReceipt = (paymentId) => {
  showAlert('Receipt viewer will open here', 'info');
};

window.addPayment = (studentId) => {
  showAlert('Payment form will open here', 'info');
};

window.viewStudent = (studentId) => {
  showAlert('Student details will open here', 'info');
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
