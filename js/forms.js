// Forms and Modals Handler
import { addStudent, updateStudent, getStudent, validateStudentData, checkAdmissionNumberExists } from './students.js';
import { addPayment, validatePaymentData, getPaymentsByStudent } from './payments.js';
import { downloadReceipt } from './receipt.js';
import { loadFeeStructure, getClassFeeBreakdown } from './fee-structure.js';
import { formatCurrency, formatDateForInput, showAlert, showLoading, sanitizeInput } from './utils.js';

let currentAcademicYear = null;
let currentEditingStudentId = null;
let currentFeeStructure = null;

// Set current academic year
export async function setCurrentAcademicYear(yearId) {
  currentAcademicYear = yearId;

  // Load fee structure for this year
  if (yearId) {
    try {
      currentFeeStructure = await loadFeeStructure(yearId);
    } catch (error) {
      console.error('Error loading fee structure:', error);
      currentFeeStructure = null;
    }
  }
}

// Show student form modal
export function showStudentForm(studentId = null) {
  currentEditingStudentId = studentId;

  const modal = createModal(
    studentId ? 'Edit Student' : 'Add New Student',
    getStudentFormHTML(),
    {
      onSave: handleStudentFormSubmit,
      onCancel: closeModal,
      saveButtonText: studentId ? 'Update Student' : 'Add Student'
    }
  );

  document.body.appendChild(modal);

  // If editing, load student data
  if (studentId) {
    loadStudentDataIntoForm(studentId);
  }

  // Add event listeners
  setupStudentFormListeners();
}

// Get student form HTML
function getStudentFormHTML() {
  return `
    <form id="studentForm" class="form-grid">
      <div class="form-group form-grid-full">
        <label for="studentName" class="form-label">Student Name *</label>
        <input type="text" id="studentName" class="form-control" required>
      </div>

      <div class="form-group">
        <label for="admissionNumber" class="form-label">Admission Number *</label>
        <input type="text" id="admissionNumber" class="form-control" required>
      </div>

      <div class="form-group">
        <label for="studentClass" class="form-label">Class *</label>
        <select id="studentClass" class="form-control form-select" required>
          <option value="">Select Class</option>
          <option value="Nursery">Nursery</option>
          <option value="LKG">LKG</option>
          <option value="UKG">UKG</option>
          <option value="1">Class 1</option>
          <option value="2">Class 2</option>
          <option value="3">Class 3</option>
          <option value="4">Class 4</option>
          <option value="5">Class 5</option>
          <option value="6">Class 6</option>
          <option value="7">Class 7</option>
          <option value="8">Class 8</option>
          <option value="9">Class 9</option>
          <option value="10">Class 10</option>
          <option value="11">Class 11</option>
          <option value="12">Class 12</option>
        </select>
      </div>

      <div class="form-group">
        <label for="section" class="form-label">Section</label>
        <input type="text" id="section" class="form-control" placeholder="e.g., A, B, C">
      </div>

      <div class="form-group">
        <label for="rollNumber" class="form-label">Roll Number</label>
        <input type="text" id="rollNumber" class="form-control">
      </div>

      <div class="form-group form-grid-full">
        <label for="fatherName" class="form-label">Father's Name</label>
        <input type="text" id="fatherName" class="form-control">
      </div>

      <div class="form-group form-grid-full">
        <label for="motherName" class="form-label">Mother's Name</label>
        <input type="text" id="motherName" class="form-control">
      </div>

      <div class="form-group">
        <label for="contactNumber" class="form-label">Contact Number *</label>
        <input type="tel" id="contactNumber" class="form-control" required pattern="[0-9]{10}">
      </div>

      <div class="form-group">
        <label for="email" class="form-label">Email</label>
        <input type="email" id="email" class="form-control">
      </div>

      <div class="form-group form-grid-full">
        <label for="address" class="form-label">Address</label>
        <textarea id="address" class="form-control" rows="2"></textarea>
      </div>

      <div class="form-group">
        <label for="classFee" class="form-label">Class Fee (₹) *</label>
        <input type="number" id="classFee" class="form-control" min="0" required value="0">
      </div>

      <div class="form-group">
        <label for="transportFee" class="form-label">Transport Fee (₹)</label>
        <input type="number" id="transportFee" class="form-control" min="0" value="0">
      </div>

      <div class="form-group">
        <label for="otherFees" class="form-label">Other Fees (₹)</label>
        <input type="number" id="otherFees" class="form-control" min="0" value="0">
      </div>

      <div class="form-group">
        <label for="totalFees" class="form-label">Total Fees (₹) *</label>
        <input type="number" id="totalFees" class="form-control" min="0" required readonly>
      </div>

      <div class="form-group form-grid-full">
        <label for="remarks" class="form-label">Remarks</label>
        <textarea id="remarks" class="form-control" rows="2"></textarea>
      </div>
    </form>
  `;
}

// Setup student form listeners
function setupStudentFormListeners() {
  // Auto-calculate fees based on class selection
  const classSelect = document.getElementById('studentClass');
  if (classSelect) {
    classSelect.addEventListener('change', async () => {
      await updateFeesFromStructure(classSelect.value);
    });
  }

  // Auto-calculate total fees
  const feeInputs = ['classFee', 'transportFee', 'otherFees'];
  feeInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', calculateTotalFees);
    }
  });
}

// Update fees from fee structure
async function updateFeesFromStructure(className) {
  if (!currentFeeStructure || !className) {
    return;
  }

  const { breakdown, total } = getClassFeeBreakdown(currentFeeStructure, className);

  if (breakdown.length > 0) {
    // Auto-fill the fees
    let classFee = 0;
    breakdown.forEach(item => {
      classFee += item.amount;
    });

    document.getElementById('classFee').value = classFee;
    document.getElementById('transportFee').value = 0;
    document.getElementById('otherFees').value = 0;
    calculateTotalFees();

    showAlert(`Fees auto-filled: ${formatCurrency(total)}`, 'success', 3000);
  }
}

// Calculate total fees
function calculateTotalFees() {
  const classFee = parseFloat(document.getElementById('classFee').value) || 0;
  const transportFee = parseFloat(document.getElementById('transportFee').value) || 0;
  const otherFees = parseFloat(document.getElementById('otherFees').value) || 0;

  const total = classFee + transportFee + otherFees;
  document.getElementById('totalFees').value = total;
}

// Load student data into form
async function loadStudentDataIntoForm(studentId) {
  try {
    showLoading(true, 'Loading student data...');
    const student = await getStudent(studentId);

    document.getElementById('studentName').value = student.name || '';
    document.getElementById('admissionNumber').value = student.admissionNumber || '';
    document.getElementById('studentClass').value = student.class || '';
    document.getElementById('section').value = student.section || '';
    document.getElementById('rollNumber').value = student.rollNumber || '';
    document.getElementById('fatherName').value = student.fatherName || '';
    document.getElementById('motherName').value = student.motherName || '';
    document.getElementById('contactNumber').value = student.contactNumber || '';
    document.getElementById('email').value = student.email || '';
    document.getElementById('address').value = student.address || '';
    document.getElementById('classFee').value = student.classFee || 0;
    document.getElementById('transportFee').value = student.transportFee || 0;
    document.getElementById('otherFees').value = student.otherFees || 0;
    document.getElementById('totalFees').value = student.totalFees || 0;
    document.getElementById('remarks').value = student.remarks || '';

    showLoading(false);
  } catch (error) {
    console.error('Error loading student:', error);
    showAlert('Failed to load student data', 'error');
    closeModal();
  }
}

// Handle student form submit
async function handleStudentFormSubmit() {
  const form = document.getElementById('studentForm');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const studentData = {
    name: sanitizeInput(document.getElementById('studentName').value),
    admissionNumber: sanitizeInput(document.getElementById('admissionNumber').value),
    class: document.getElementById('studentClass').value,
    section: sanitizeInput(document.getElementById('section').value),
    rollNumber: sanitizeInput(document.getElementById('rollNumber').value),
    fatherName: sanitizeInput(document.getElementById('fatherName').value),
    motherName: sanitizeInput(document.getElementById('motherName').value),
    contactNumber: document.getElementById('contactNumber').value,
    email: document.getElementById('email').value,
    address: sanitizeInput(document.getElementById('address').value),
    classFee: parseFloat(document.getElementById('classFee').value) || 0,
    transportFee: parseFloat(document.getElementById('transportFee').value) || 0,
    otherFees: parseFloat(document.getElementById('otherFees').value) || 0,
    totalFees: parseFloat(document.getElementById('totalFees').value) || 0,
    remarks: sanitizeInput(document.getElementById('remarks').value),
    academicYear: currentAcademicYear
  };

  // Validate
  const errors = validateStudentData(studentData);
  if (errors.length > 0) {
    showAlert(errors.join('<br>'), 'error');
    return;
  }

  // Check admission number uniqueness
  const admissionExists = await checkAdmissionNumberExists(
    studentData.admissionNumber,
    currentAcademicYear,
    currentEditingStudentId
  );

  if (admissionExists) {
    showAlert('Admission number already exists for this academic year', 'error');
    return;
  }

  try {
    showLoading(true, currentEditingStudentId ? 'Updating student...' : 'Adding student...');

    if (currentEditingStudentId) {
      await updateStudent(currentEditingStudentId, studentData);
      showAlert('Student updated successfully', 'success');
    } else {
      await addStudent(studentData);
      showAlert('Student added successfully', 'success');
    }

    closeModal();
    showLoading(false);

    // Reload the students view
    if (typeof window.loadStudentsView === 'function') {
      window.loadStudentsView();
    }
  } catch (error) {
    console.error('Error saving student:', error);
    showAlert('Failed to save student: ' + error.message, 'error');
    showLoading(false);
  }
}

// Show payment form modal
export async function showPaymentForm(studentId) {
  try {
    showLoading(true, 'Loading student data...');
    const student = await getStudent(studentId);
    showLoading(false);

    const modal = createModal(
      'Add Payment',
      getPaymentFormHTML(student),
      {
        onSave: () => handlePaymentFormSubmit(studentId, student),
        onCancel: closeModal,
        saveButtonText: 'Process Payment'
      }
    );

    document.body.appendChild(modal);
    setupPaymentFormListeners();
  } catch (error) {
    console.error('Error loading student:', error);
    showAlert('Failed to load student data', 'error');
    showLoading(false);
  }
}

// Get payment form HTML
function getPaymentFormHTML(student) {
  const pending = (student.totalFees || 0) - (student.totalPaid || 0);
  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="mb-3" style="background: var(--bg-tertiary); padding: 15px; border-radius: var(--border-radius);">
      <h4 style="margin: 0 0 10px 0;">${student.name}</h4>
      <p style="margin: 5px 0; color: var(--text-secondary);">
        <strong>Class:</strong> ${student.class} | <strong>Admission No:</strong> ${student.admissionNumber}
      </p>
      <p style="margin: 5px 0;">
        <strong>Total Fees:</strong> ${formatCurrency(student.totalFees)} |
        <strong>Paid:</strong> ${formatCurrency(student.totalPaid || 0)} |
        <strong class="text-warning">Pending:</strong> <strong>${formatCurrency(pending)}</strong>
      </p>
    </div>

    <form id="paymentForm" class="form-grid">
      <div class="form-group">
        <label for="paymentAmount" class="form-label">Amount (₹) *</label>
        <input type="number" id="paymentAmount" class="form-control" min="1" max="${pending}" required>
        <span class="form-text">Maximum: ${formatCurrency(pending)}</span>
      </div>

      <div class="form-group">
        <label for="paymentDate" class="form-label">Payment Date *</label>
        <input type="date" id="paymentDate" class="form-control" value="${today}" required max="${today}">
      </div>

      <div class="form-group form-grid-full">
        <label for="paymentMode" class="form-label">Payment Mode *</label>
        <select id="paymentMode" class="form-control form-select" required>
          <option value="">Select Mode</option>
          <option value="cash">Cash</option>
          <option value="online">Online/UPI</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      <div id="onlineDetails" class="form-group form-grid-full hidden">
        <label for="transactionId" class="form-label">Transaction ID</label>
        <input type="text" id="transactionId" class="form-control">
      </div>

      <div id="chequeDetails" class="hidden" style="display: contents;">
        <div class="form-group">
          <label for="chequeNumber" class="form-label">Cheque Number</label>
          <input type="text" id="chequeNumber" class="form-control">
        </div>

        <div class="form-group">
          <label for="bankName" class="form-label">Bank Name</label>
          <input type="text" id="bankName" class="form-control">
        </div>

        <div class="form-group">
          <label for="chequeDate" class="form-label">Cheque Date</label>
          <input type="date" id="chequeDate" class="form-control">
        </div>
      </div>

      <div class="form-group form-grid-full">
        <label for="paymentNotes" class="form-label">Notes</label>
        <textarea id="paymentNotes" class="form-control" rows="2"></textarea>
      </div>
    </form>
  `;
}

// Setup payment form listeners
function setupPaymentFormListeners() {
  const modeSelect = document.getElementById('paymentMode');
  const onlineDetails = document.getElementById('onlineDetails');
  const chequeDetails = document.getElementById('chequeDetails');

  modeSelect.addEventListener('change', (e) => {
    const mode = e.target.value;

    // Hide all detail sections
    onlineDetails.classList.add('hidden');
    chequeDetails.classList.add('hidden');

    // Show relevant section
    if (mode === 'online') {
      onlineDetails.classList.remove('hidden');
      document.getElementById('transactionId').required = true;
    } else if (mode === 'cheque') {
      chequeDetails.classList.remove('hidden');
      document.getElementById('chequeNumber').required = true;
      document.getElementById('bankName').required = true;
    }
  });
}

// Handle payment form submit
async function handlePaymentFormSubmit(studentId, student) {
  const form = document.getElementById('paymentForm');

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const amount = parseFloat(document.getElementById('paymentAmount').value);
  const pending = (student.totalFees || 0) - (student.totalPaid || 0);

  if (amount > pending) {
    showAlert(`Amount cannot exceed pending fees of ${formatCurrency(pending)}`, 'error');
    return;
  }

  const paymentData = {
    studentId,
    amount,
    paymentDate: new Date(document.getElementById('paymentDate').value),
    paymentMode: document.getElementById('paymentMode').value,
    notes: sanitizeInput(document.getElementById('paymentNotes').value),
    academicYear: currentAcademicYear
  };

  // Add mode-specific fields
  if (paymentData.paymentMode === 'online') {
    paymentData.transactionId = sanitizeInput(document.getElementById('transactionId').value);
  } else if (paymentData.paymentMode === 'cheque') {
    paymentData.chequeNumber = sanitizeInput(document.getElementById('chequeNumber').value);
    paymentData.bankName = sanitizeInput(document.getElementById('bankName').value);
    paymentData.chequeDate = document.getElementById('chequeDate').value ?
      new Date(document.getElementById('chequeDate').value) : null;
  }

  // Validate
  const errors = validatePaymentData(paymentData);
  if (errors.length > 0) {
    showAlert(errors.join('<br>'), 'error');
    return;
  }

  try {
    showLoading(true, 'Processing payment...');

    const payment = await addPayment(paymentData);

    showAlert('Payment processed successfully!', 'success');
    closeModal();
    showLoading(false);

    // Show receipt download option
    setTimeout(async () => {
      if (confirm('Payment recorded! Do you want to download the receipt?')) {
        await downloadReceipt(payment.id);
      }

      // Reload views
      if (typeof window.loadDashboardData === 'function') {
        window.loadDashboardData();
      }
    }, 500);
  } catch (error) {
    console.error('Error processing payment:', error);
    showAlert('Failed to process payment: ' + error.message, 'error');
    showLoading(false);
  }
}

// Create modal
function createModal(title, content, options = {}) {
  const {
    onSave,
    onCancel,
    saveButtonText = 'Save',
    cancelButtonText = 'Cancel',
    size = 'medium'
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'currentModal';

  const modal = document.createElement('div');
  modal.className = `modal modal-${size}`;

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button type="button" class="modal-close" id="modalCloseBtn">&times;</button>
    </div>
    <div class="modal-body">
      ${content}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="modalCancelBtn">${cancelButtonText}</button>
      <button type="button" class="btn btn-primary" id="modalSaveBtn">${saveButtonText}</button>
    </div>
  `;

  overlay.appendChild(modal);

  // Event listeners
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      onCancel?.();
    }
  });

  modal.querySelector('#modalCloseBtn').addEventListener('click', () => {
    onCancel?.();
  });

  modal.querySelector('#modalCancelBtn').addEventListener('click', () => {
    onCancel?.();
  });

  modal.querySelector('#modalSaveBtn').addEventListener('click', () => {
    onSave?.();
  });

  return overlay;
}

// Close modal
function closeModal() {
  const modal = document.getElementById('currentModal');
  if (modal) {
    modal.remove();
  }
}

export {
  createModal,
  closeModal
};
