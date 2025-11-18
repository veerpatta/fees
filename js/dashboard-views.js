// Dashboard Views Module - Handles all view rendering and interactions
import { db } from './firebase-config.js';
import { getCurrentUser, isPrincipal } from './auth.js';
import {
  loadAcademicYears,
  addAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
  validateAcademicYearData,
  generateAcademicYearName
} from './academic-years.js';
import {
  loadFeeStructure,
  saveFeeStructure,
  addFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  getDefaultFeeCategories,
  getClassOptions,
  calculateClassFee
} from './fee-structure.js';
import { getStudentsByYear, searchStudents } from './students.js';
import { getPaymentsByYear, searchPayments, filterPaymentsByMode } from './payments.js';
import { showStudentForm, showPaymentForm, setCurrentAcademicYear } from './forms.js';
import { downloadReceipt } from './receipt.js';
import {
  formatCurrency,
  formatDate,
  formatDateForInput,
  showAlert,
  showLoading,
  sanitizeInput,
  confirm,
  debounce,
  exportToCSV
} from './utils.js';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentAcademicYear = null;

// Set current academic year globally
export function setGlobalAcademicYear(yearId) {
  currentAcademicYear = yearId;
  setCurrentAcademicYear(yearId);
}

// Render Academic Years View
export async function renderAcademicYearsView() {
  const container = document.getElementById('academicYearsView');

  try {
    showLoading(true, 'Loading academic years...');

    const years = await loadAcademicYears();

    let html = `
      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">Academic Years Management</h3>
          <div class="table-actions">
            <button class="btn btn-primary" id="addAcademicYearBtn">
              ➕ Add Academic Year
            </button>
          </div>
        </div>
    `;

    if (years.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <h3>No Academic Years</h3>
          <p>Create your first academic year to get started</p>
          <button class="btn btn-primary mt-2" onclick="window.showAcademicYearForm()">
            Add First Academic Year
          </button>
        </div>
      `;
    } else {
      html += `
        <table>
          <thead>
            <tr>
              <th>Academic Year</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
      `;

      years.forEach(year => {
        const statusClass = year.status === 'active' ? 'success' :
                           year.status === 'archived' ? 'secondary' : 'warning';

        html += `
          <tr>
            <td><strong>${year.name}</strong></td>
            <td>${formatDate(year.startDate)}</td>
            <td>${formatDate(year.endDate)}</td>
            <td><span class="badge badge-${statusClass}">${year.status.toUpperCase()}</span></td>
            <td>${year.createdByName || 'System'}</td>
            <td>
              <div class="action-buttons">
                ${year.status !== 'active' ? `
                  <button class="btn btn-sm btn-success" onclick="window.setYearActive('${year.id}')">
                    ✓ Set Active
                  </button>
                ` : ''}
                ${year.status !== 'archived' ? `
                  <button class="btn btn-sm btn-warning" onclick="window.archiveYear('${year.id}')">
                    📦 Archive
                  </button>
                ` : ''}
                <button class="btn btn-sm btn-outline" onclick="window.editAcademicYear('${year.id}')">
                  ✏️ Edit
                  </button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteYear('${year.id}')">
                  🗑️ Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Add event listener
    document.getElementById('addAcademicYearBtn')?.addEventListener('click', showAcademicYearForm);

    showLoading(false);
  } catch (error) {
    console.error('Error rendering academic years:', error);
    showAlert('Failed to load academic years', 'error');
    showLoading(false);
  }
}

// Show academic year form
function showAcademicYearForm(yearId = null) {
  const isEdit = !!yearId;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'academicYearModal';

  const today = formatDateForInput(new Date());

  modal.innerHTML = `
    <div class="modal modal-medium">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit' : 'Add'} Academic Year</h3>
        <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="academicYearForm">
          <div class="form-group">
            <label for="yearName" class="form-label">Academic Year Name *</label>
            <input type="text" id="yearName" class="form-control" placeholder="e.g., 2024-25" required>
            <span class="form-text">Name will be auto-generated from dates</span>
          </div>

          <div class="form-group">
            <label for="startDate" class="form-label">Start Date *</label>
            <input type="date" id="startDate" class="form-control" required>
          </div>

          <div class="form-group">
            <label for="endDate" class="form-label">End Date *</label>
            <input type="date" id="endDate" class="form-control" required>
          </div>

          <div class="form-group">
            <label for="yearStatus" class="form-label">Status *</label>
            <select id="yearStatus" class="form-control form-select" required>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" id="saveAcademicYearBtn">
          ${isEdit ? 'Update' : 'Create'} Academic Year
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-generate name from dates
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const nameInput = document.getElementById('yearName');

  function updateName() {
    if (startDateInput.value && endDateInput.value) {
      const name = generateAcademicYearName(startDateInput.value, endDateInput.value);
      nameInput.value = name;
    }
  }

  startDateInput.addEventListener('change', updateName);
  endDateInput.addEventListener('change', updateName);

  // Save button
  document.getElementById('saveAcademicYearBtn').addEventListener('click', async () => {
    const form = document.getElementById('academicYearForm');

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const yearData = {
      name: sanitizeInput(document.getElementById('yearName').value),
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value,
      status: document.getElementById('yearStatus').value
    };

    const errors = validateAcademicYearData(yearData);
    if (errors.length > 0) {
      showAlert(errors.join('<br>'), 'error');
      return;
    }

    try {
      showLoading(true, isEdit ? 'Updating...' : 'Creating...');

      if (isEdit) {
        await updateAcademicYear(yearId, yearData);
        showAlert('Academic year updated successfully', 'success');
      } else {
        await addAcademicYear(yearData);
        showAlert('Academic year created successfully', 'success');
      }

      modal.remove();
      await renderAcademicYearsView();
      showLoading(false);
    } catch (error) {
      console.error('Error saving academic year:', error);
      showAlert('Failed to save: ' + error.message, 'error');
      showLoading(false);
    }
  });
}

// Global functions for academic year management
window.showAcademicYearForm = showAcademicYearForm;

window.editAcademicYear = async (yearId) => {
  showAcademicYearForm(yearId);
};

window.setYearActive = async (yearId) => {
  if (!confirm('Set this academic year as active? This will deactivate other years.')) {
    return;
  }

  try {
    showLoading(true, 'Updating...');
    await setActiveAcademicYear(yearId);
    showAlert('Academic year activated successfully', 'success');
    await renderAcademicYearsView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed: ' + error.message, 'error');
    showLoading(false);
  }
};

window.archiveYear = async (yearId) => {
  if (!confirm('Archive this academic year? It will be read-only.')) {
    return;
  }

  try {
    showLoading(true, 'Archiving...');
    await archiveAcademicYear(yearId);
    showAlert('Academic year archived successfully', 'success');
    await renderAcademicYearsView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed: ' + error.message, 'error');
    showLoading(false);
  }
};

window.deleteYear = async (yearId) => {
  if (!confirm('Delete this academic year? This cannot be undone!')) {
    return;
  }

  try {
    showLoading(true, 'Deleting...');
    await deleteAcademicYear(yearId);
    showAlert('Academic year deleted successfully', 'success');
    await renderAcademicYearsView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed: ' + error.message, 'error');
    showLoading(false);
  }
};

// Render Fee Structure View
export async function renderFeeStructureView() {
  if (!currentAcademicYear) {
    showAlert('Please select an academic year first', 'warning');
    return;
  }

  const container = document.getElementById('feeStructureView');

  try {
    showLoading(true, 'Loading fee structure...');

    const structure = await loadFeeStructure(currentAcademicYear);
    const classes = getClassOptions();

    let html = `
      <div class="table-container">
        <div class="table-header">
          <h3 class="table-title">Fee Structure Configuration</h3>
          <div class="table-actions">
            <button class="btn btn-primary" id="addFeeCategoryBtn">
              ➕ Add Category
            </button>
            <button class="btn btn-outline" id="loadDefaultCategoriesBtn">
              📋 Load Defaults
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="fee-structure-table">
            <thead>
              <tr>
                <th style="min-width: 150px;">Category</th>
                ${classes.map(cls => `<th class="text-center">${cls}</th>`).join('')}
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody id="feeStructureTableBody">
    `;

    if (structure.categories && structure.categories.length > 0) {
      structure.categories.forEach(category => {
        html += `<tr data-category-id="${category.id}">
            <td><strong>${category.name}</strong></td>
        `;

        classes.forEach(cls => {
          const amount = category.amounts?.[cls] || 0;
          html += `
            <td>
              <input type="number"
                     class="form-control form-control-sm fee-amount-input"
                     data-category="${category.id}"
                     data-class="${cls}"
                     value="${amount}"
                     min="0"
                     style="width: 100px; text-align: right;">
            </td>
          `;
        });

        html += `
            <td class="text-center">
              <button class="btn btn-sm btn-danger" onclick="window.deleteFeeCategory('${category.id}')">
                🗑️
              </button>
            </td>
          </tr>
        `;
      });

      // Totals row
      html += `<tr class="totals-row">
          <td><strong>Total Fee</strong></td>
      `;

      classes.forEach(cls => {
        const total = calculateClassFee(structure, cls);
        html += `<td class="text-center"><strong>${formatCurrency(total)}</strong></td>`;
      });

      html += '<td></td></tr>';
    } else {
      html += `
        <tr>
          <td colspan="${classes.length + 2}" class="text-center">
            <div class="empty-state-small">
              <p>No fee categories defined</p>
              <button class="btn btn-primary btn-sm" onclick="window.loadDefaultCategories()">
                Load Default Categories
              </button>
            </div>
          </td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>

        ${structure.categories && structure.categories.length > 0 ? `
          <div class="table-footer" style="margin-top: 20px;">
            <button class="btn btn-success btn-lg" id="saveFeeStructureBtn">
              💾 Save Fee Structure
            </button>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;

    // Add event listeners
    document.getElementById('addFeeCategoryBtn')?.addEventListener('click', showAddCategoryForm);
    document.getElementById('loadDefaultCategoriesBtn')?.addEventListener('click', loadDefaultCategories);
    document.getElementById('saveFeeStructureBtn')?.addEventListener('click', saveFeeStructureChanges);

    showLoading(false);
  } catch (error) {
    console.error('Error rendering fee structure:', error);
    showAlert('Failed to load fee structure', 'error');
    showLoading(false);
  }
}

// Show add category form
function showAddCategoryForm() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  modal.innerHTML = `
    <div class="modal modal-small">
      <div class="modal-header">
        <h3 class="modal-title">Add Fee Category</h3>
        <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="categoryForm">
          <div class="form-group">
            <label for="categoryName" class="form-label">Category Name *</label>
            <input type="text" id="categoryName" class="form-control" placeholder="e.g., Tuition Fee" required>
          </div>

          <div class="form-group">
            <label for="categoryDesc" class="form-label">Description</label>
            <textarea id="categoryDesc" class="form-control" rows="2"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" id="saveCategoryBtn">
          Add Category
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('saveCategoryBtn').addEventListener('click', async () => {
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDesc').value.trim();

    if (!name) {
      showAlert('Category name is required', 'error');
      return;
    }

    try {
      showLoading(true, 'Adding category...');
      await addFeeCategory(currentAcademicYear, { name, description, amounts: {} });
      showAlert('Category added successfully', 'success');
      modal.remove();
      await renderFeeStructureView();
      showLoading(false);
    } catch (error) {
      console.error('Error:', error);
      showAlert('Failed: ' + error.message, 'error');
      showLoading(false);
    }
  });
}

// Load default categories
async function loadDefaultCategories() {
  if (!confirm('Load default fee categories? This will add standard categories.')) {
    return;
  }

  try {
    showLoading(true, 'Loading defaults...');
    const defaults = getDefaultFeeCategories();

    const structure = await loadFeeStructure(currentAcademicYear);
    structure.categories = [...structure.categories, ...defaults];

    await saveFeeStructure(currentAcademicYear, structure.categories);
    showAlert('Default categories loaded successfully', 'success');
    await renderFeeStructureView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed: ' + error.message, 'error');
    showLoading(false);
  }
}

window.loadDefaultCategories = loadDefaultCategories;

// Save fee structure changes
async function saveFeeStructureChanges() {
  try {
    showLoading(true, 'Saving fee structure...');

    const structure = await loadFeeStructure(currentAcademicYear);

    // Collect all amounts from inputs
    const inputs = document.querySelectorAll('.fee-amount-input');
    inputs.forEach(input => {
      const categoryId = input.dataset.category;
      const className = input.dataset.class;
      const amount = parseFloat(input.value) || 0;

      const category = structure.categories.find(c => c.id === categoryId);
      if (category) {
        if (!category.amounts) {
          category.amounts = {};
        }
        category.amounts[className] = amount;
      }
    });

    await saveFeeStructure(currentAcademicYear, structure.categories);
    showAlert('Fee structure saved successfully', 'success');
    await renderFeeStructureView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed to save: ' + error.message, 'error');
    showLoading(false);
  }
}

window.deleteFeeCategory = async (categoryId) => {
  if (!confirm('Delete this fee category?')) {
    return;
  }

  try {
    showLoading(true, 'Deleting...');
    await deleteFeeCategory(currentAcademicYear, categoryId);
    showAlert('Category deleted successfully', 'success');
    await renderFeeStructureView();
    showLoading(false);
  } catch (error) {
    console.error('Error:', error);
    showAlert('Failed: ' + error.message, 'error');
    showLoading(false);
  }
};

// Export all rendering functions
export default {
  renderAcademicYearsView,
  renderFeeStructureView,
  setGlobalAcademicYear
};
