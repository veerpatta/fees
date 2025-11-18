// Utility Functions

// Format currency in Indian Rupees
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

// Format date
export function formatDate(date, includeTime = false) {
  if (!date) return 'N/A';

  const d = date instanceof Date ? date :
            date.toDate ? date.toDate() :
            new Date(date);

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('en-IN', options).format(d);
}

// Format date for input fields
export function formatDateForInput(date) {
  if (!date) return '';

  const d = date instanceof Date ? date :
            date.toDate ? date.toDate() :
            new Date(date);

  return d.toISOString().split('T')[0];
}

// Convert amount to words (Indian numbering system)
export function amountToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (amount === 0) return 'Zero Rupees Only';

  let num = Math.floor(amount);
  let words = '';

  // Crores
  if (num >= 10000000) {
    words += amountToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }

  // Lakhs
  if (num >= 100000) {
    words += amountToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }

  // Thousands
  if (num >= 1000) {
    words += amountToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }

  // Hundreds
  if (num >= 100) {
    words += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }

  // Tens and ones
  if (num >= 20) {
    words += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 10) {
    words += teens[num - 10] + ' ';
    num = 0;
  }

  if (num > 0) {
    words += ones[num] + ' ';
  }

  return words.trim() + ' Rupees Only';
}

// Show alert message
export function showAlert(message, type = 'info', duration = 5000) {
  const container = document.getElementById('alertContainer');
  if (!container) {
    console.warn('Alert container not found');
    return;
  }

  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible`;
  alert.innerHTML = `
    ${message}
    <button type="button" class="alert-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(alert);

  if (duration > 0) {
    setTimeout(() => {
      if (alert.parentElement) {
        alert.remove();
      }
    }, duration);
  }
}

// Show loading overlay
export function showLoading(show, message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  if (show) {
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner-lg"></div>
        <p>${message}</p>
      </div>
    `;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// Confirm dialog
export function confirm(message) {
  return window.confirm(message);
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Download file
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Sanitize input
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

// Validate email
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validate phone number (Indian)
export function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

// Format phone number
export function formatPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return phone;
}

// Generate random ID
export function generateId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Parse CSV
export function parseCSV(text) {
  const lines = text.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',').map(v => v.trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return { headers, data };
}

// Export to CSV
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showAlert('No data to export', 'warning');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';

  // Add rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes
      return typeof value === 'string' && value.includes(',')
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    });
    csv += values.join(',') + '\n';
  });

  downloadFile(csv, filename, 'text/csv');
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showAlert('Copied to clipboard', 'success', 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showAlert('Failed to copy to clipboard', 'error');
  }
}

// Calculate percentage
export function calculatePercentage(value, total) {
  if (total === 0) return 0;
  return ((value / total) * 100).toFixed(2);
}

// Group array by key
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

// Sort array of objects
export function sortBy(array, key, order = 'asc') {
  return array.sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

// Get date range
export function getDateRange(period) {
  const today = new Date();
  const startDate = new Date(today);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(today.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(today.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    default:
      return { startDate: today, endDate: today };
  }

  return { startDate, endDate: today };
}

// Check if date is today
export function isToday(date) {
  const d = date instanceof Date ? date :
           date.toDate ? date.toDate() :
           new Date(date);

  const today = new Date();
  return d.toDateString() === today.toDateString();
}

// Get academic year name from dates
export function getAcademicYearName(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  return `${start.getFullYear()}-${end.getFullYear()}`;
}

export default {
  formatCurrency,
  formatDate,
  formatDateForInput,
  amountToWords,
  showAlert,
  showLoading,
  confirm,
  debounce,
  downloadFile,
  sanitizeInput,
  isValidEmail,
  isValidPhone,
  formatPhone,
  generateId,
  parseCSV,
  exportToCSV,
  copyToClipboard,
  calculatePercentage,
  groupBy,
  sortBy,
  getDateRange,
  isToday,
  getAcademicYearName
};
