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
import { loadAcademicYears, getActiveAcademicYear } from './academic-years.js';
import {
  renderAcademicYearsView,
  renderFeeStructureView,
  setGlobalAcademicYear
} from './dashboard-views.js';
import { showStudentForm, showPaymentForm, setCurrentAcademicYear } from './forms.js';
import { getStudentsByYear } from './students.js';
import { getPaymentsByYear } from './payments.js';
import { formatCurrency, formatDate, showAlert, showLoading } from './utils.js';
import { downloadReceipt } from './receipt.js';

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
    await populateAcademicYears();

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

// Load academic years and populate dropdown
async function populateAcademicYears() {
  try {
    academicYears = await loadAcademicYears();

    // Populate academic year dropdown
    const yearSelect = document.getElementById('academicYear');
    yearSelect.innerHTML = '';

    if (academicYears.length === 0) {
      yearSelect.innerHTML = '<option value="">No academic years found</option>';
      if (isPrincipal()) {
        showAlert('Please create an academic year first. Go to Academic Years to create one.', 'warning');
      }
      return;
    }

    // Find current/active year
    const activeYear = getActiveAcademicYear() || academicYears[0];
    currentAcademicYear = activeYear.id;

    // Set globally
    setGlobalAcademicYear(currentAcademicYear);

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
    setGlobalAcademicYear(currentAcademicYear);
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
    showAlert('Please select a student from the Students view or Pending Payments table', 'info');
  });

  // Add student button
  document.getElementById('addStudentBtn')?.addEventListener('click', () => {
    showStudentForm();
  });

  document.getElementById('addStudentBtnEmpty')?.addEventListener('click', () => {
    showStudentForm();
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
  } else if (view === 'academic-years') {
    renderAcademicYearsView();
  } else if (view === 'fee-structure') {
    renderFeeStructureView();
  } else if (view === 'bulk-upload') {
    renderBulkUploadView();
  } else if (view === 'promo-codes') {
    renderPromoCodesView();
  } else if (view === 'reports') {
    renderReportsView();
  } else if (view === 'audit-logs') {
    renderAuditLogsView();
  }
}

// Load students view
async function loadStudentsView() {
  if (!currentAcademicYear) {
    showAlert('Please select an academic year first', 'warning');
    return;
  }

  const container = document.getElementById('studentsTable');

  try {
    showLoading(true, 'Loading students...');

    const students = await getStudentsByYear(currentAcademicYear);

    if (students.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👨‍🎓</div>
          <h3>No Students Yet</h3>
          <p>Add students to get started</p>
          <button class="btn btn-primary mt-2" onclick="window.addNewStudent()">
            Add First Student
          </button>
        </div>
      `;
      showLoading(false);
      return;
    }

    // Build table
    let html = `
      <table>
        <thead>
          <tr>
            <th>Admission No.</th>
            <th>Name</th>
            <th>Class</th>
            <th>Contact</th>
            <th>Total Fees</th>
            <th>Paid</th>
            <th>Pending</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    students.forEach(student => {
      const pending = (student.totalFees || 0) - (student.totalPaid || 0);
      html += `
        <tr>
          <td>${student.admissionNumber || 'N/A'}</td>
          <td><strong>${student.name || 'Unknown'}</strong></td>
          <td>${student.class || 'N/A'} ${student.section || ''}</td>
          <td>${student.contactNumber || 'N/A'}</td>
          <td>${formatCurrency(student.totalFees)}</td>
          <td>${formatCurrency(student.totalPaid || 0)}</td>
          <td><strong class="${pending > 0 ? 'text-warning' : 'text-success'}">
            ${formatCurrency(pending)}
          </strong></td>
          <td>
            <div class="action-buttons">
              ${pending > 0 ? `
                <button class="btn btn-sm btn-primary" onclick="window.addPaymentForStudent('${student.id}')">
                  💰 Pay
                </button>
              ` : ''}
              <button class="btn btn-sm btn-outline" onclick="window.editStudent('${student.id}')">
                ✏️ Edit
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    showLoading(false);
  } catch (error) {
    console.error('Error loading students:', error);
    showAlert('Failed to load students', 'error');
    showLoading(false);
  }
}

// Load payments view
async function loadPaymentsView() {
  if (!currentAcademicYear) {
    showAlert('Please select an academic year first', 'warning');
    return;
  }

  const container = document.getElementById('paymentsTable');

  try {
    showLoading(true, 'Loading payments...');

    const payments = await getPaymentsByYear(currentAcademicYear);

    if (payments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💳</div>
          <h3>No Payments Yet</h3>
          <p>Payment history will appear here</p>
        </div>
      `;
      showLoading(false);
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
            <th>Class</th>
            <th>Amount</th>
            <th>Mode</th>
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
          <td><strong>${payment.receiptNumber || 'N/A'}</strong></td>
          <td>${payment.studentName || 'Unknown'}</td>
          <td>${payment.studentClass || 'N/A'}</td>
          <td>${formatCurrency(payment.amount)}</td>
          <td><span class="badge badge-info">${payment.paymentMode?.toUpperCase() || 'N/A'}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-outline" onclick="window.viewReceipt('${payment.id}')">
                📄 Receipt
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    showLoading(false);
  } catch (error) {
    console.error('Error loading payments:', error);
    showAlert('Failed to load payments', 'error');
    showLoading(false);
  }
}

// Placeholder views
function renderBulkUploadView() {
  const container = document.getElementById('bulkUploadView');
  container.innerHTML = `
    <div class="table-container">
      <h3>Bulk Upload Students</h3>
      <p class="text-secondary">This feature is coming soon. You can add students individually for now.</p>
    </div>
  `;
}

function renderPromoCodesView() {
  const container = document.getElementById('promoCodesView');
  container.innerHTML = `
    <div class="table-container">
      <h3>Promo Codes Management</h3>
      <p class="text-secondary">This feature is coming soon.</p>
    </div>
  `;
}

function renderReportsView() {
  const container = document.getElementById('reportsView');
  container.innerHTML = `
    <div class="table-container">
      <h3>Reports & Analytics</h3>
      <p class="text-secondary">This feature is coming soon.</p>
    </div>
  `;
}

function renderAuditLogsView() {
  const container = document.getElementById('auditLogsView');
  container.innerHTML = `
    <div class="table-container">
      <h3>Audit Logs</h3>
      <p class="text-secondary">This feature is coming soon.</p>
    </div>
  `;
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
window.viewReceipt = async (paymentId) => {
  try {
    await downloadReceipt(paymentId);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    showAlert('Failed to download receipt', 'error');
  }
};

window.addPayment = async (studentId) => {
  await showPaymentForm(studentId);
};

window.addPaymentForStudent = async (studentId) => {
  await showPaymentForm(studentId);
};

window.addNewStudent = () => {
  showStudentForm();
};

window.editStudent = (studentId) => {
  showStudentForm(studentId);
};

window.loadStudentsView = loadStudentsView;
window.loadDashboardData = loadDashboardData;

// Initialize on page load
document.addEventListener('DOMContentLoaded', initDashboard);
