// Payment Processing Module
import { db } from './firebase-config.js';
import { logAudit, getCurrentUser } from './auth.js';
import { updateStudentFees, getStudent } from './students.js';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Generate receipt number
async function generateReceiptNumber(academicYear) {
  try {
    // Get all payments for this academic year
    const q = query(
      collection(db, 'payments'),
      where('academicYear', '==', academicYear),
      orderBy('receiptNumber', 'desc')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // First receipt for this year
      return `${academicYear}-0001`;
    }

    // Get last receipt number and increment
    const lastReceipt = snapshot.docs[0].data().receiptNumber;
    const lastNumber = parseInt(lastReceipt.split('-')[1]);
    const newNumber = (lastNumber + 1).toString().padStart(4, '0');

    return `${academicYear}-${newNumber}`;
  } catch (error) {
    console.error('Error generating receipt number:', error);
    // Fallback to timestamp-based number
    return `${academicYear}-${Date.now().toString().slice(-4)}`;
  }
}

// Add a payment
async function addPayment(paymentData) {
  try {
    const currentUser = getCurrentUser();

    // Get student details
    const student = await getStudent(paymentData.studentId);

    // Generate receipt number
    const receiptNumber = await generateReceiptNumber(paymentData.academicYear);

    // Prepare payment document
    const payment = {
      ...paymentData,
      receiptNumber,
      studentName: student.name,
      studentClass: student.class,
      studentAdmissionNumber: student.admissionNumber,
      collectedBy: currentUser.uid,
      collectedByName: currentUser.name,
      createdAt: serverTimestamp(),
      status: 'completed'
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'payments'), payment);

    // Update student's fee totals
    await updateStudentFees(paymentData.studentId, paymentData.amount);

    // Log audit
    await logAudit('payment_added', {
      paymentId: docRef.id,
      receiptNumber,
      studentId: paymentData.studentId,
      studentName: student.name,
      amount: paymentData.amount,
      paymentMode: paymentData.paymentMode
    });

    return { id: docRef.id, ...payment };
  } catch (error) {
    console.error('Error adding payment:', error);
    throw error;
  }
}

// Get payment by ID
async function getPayment(paymentId) {
  try {
    const docSnap = await getDoc(doc(db, 'payments', paymentId));

    if (!docSnap.exists()) {
      throw new Error('Payment not found');
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error getting payment:', error);
    throw error;
  }
}

// Get payments by student
async function getPaymentsByStudent(studentId) {
  try {
    const q = query(
      collection(db, 'payments'),
      where('studentId', '==', studentId),
      orderBy('paymentDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting student payments:', error);
    throw error;
  }
}

// Get payments by academic year
async function getPaymentsByYear(academicYear) {
  try {
    const q = query(
      collection(db, 'payments'),
      where('academicYear', '==', academicYear),
      orderBy('paymentDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting payments:', error);
    throw error;
  }
}

// Get payments by date range
async function getPaymentsByDateRange(academicYear, startDate, endDate) {
  try {
    const q = query(
      collection(db, 'payments'),
      where('academicYear', '==', academicYear),
      where('paymentDate', '>=', startDate),
      where('paymentDate', '<=', endDate),
      orderBy('paymentDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting payments by date range:', error);
    throw error;
  }
}

// Search payments
async function searchPayments(academicYear, searchTerm) {
  try {
    const payments = await getPaymentsByYear(academicYear);

    if (!searchTerm) return payments;

    const term = searchTerm.toLowerCase();
    return payments.filter(payment =>
      payment.receiptNumber?.toLowerCase().includes(term) ||
      payment.studentName?.toLowerCase().includes(term) ||
      payment.studentAdmissionNumber?.toLowerCase().includes(term) ||
      payment.paymentMode?.toLowerCase().includes(term)
    );
  } catch (error) {
    console.error('Error searching payments:', error);
    throw error;
  }
}

// Filter payments by mode
function filterPaymentsByMode(payments, mode) {
  if (!mode) return payments;
  return payments.filter(p => p.paymentMode === mode);
}

// Calculate payment statistics
function calculatePaymentStats(payments) {
  const stats = {
    total: 0,
    count: payments.length,
    byMode: {
      cash: 0,
      online: 0,
      cheque: 0
    },
    byDate: {}
  };

  payments.forEach(payment => {
    stats.total += payment.amount || 0;

    // By mode
    const mode = payment.paymentMode || 'cash';
    stats.byMode[mode] = (stats.byMode[mode] || 0) + payment.amount;

    // By date
    const date = payment.paymentDate?.toDate?.() || new Date(payment.paymentDate);
    const dateKey = date.toISOString().split('T')[0];
    stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + payment.amount;
  });

  return stats;
}

// Validate payment data
function validatePaymentData(data) {
  const errors = [];

  if (!data.studentId) {
    errors.push('Student is required');
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Valid payment amount is required');
  }

  if (!data.paymentMode) {
    errors.push('Payment mode is required');
  }

  if (!data.paymentDate) {
    errors.push('Payment date is required');
  }

  if (!data.academicYear) {
    errors.push('Academic year is required');
  }

  // Validate payment mode
  const validModes = ['cash', 'online', 'cheque'];
  if (data.paymentMode && !validModes.includes(data.paymentMode)) {
    errors.push('Invalid payment mode');
  }

  // Validate cheque details
  if (data.paymentMode === 'cheque') {
    if (!data.chequeNumber) {
      errors.push('Cheque number is required for cheque payments');
    }
    if (!data.bankName) {
      errors.push('Bank name is required for cheque payments');
    }
  }

  // Validate online payment details
  if (data.paymentMode === 'online') {
    if (!data.transactionId) {
      errors.push('Transaction ID is required for online payments');
    }
  }

  return errors;
}

// Apply promo code discount
async function applyPromoCode(promoCode, amount, studentId) {
  try {
    // Get promo code details
    const q = query(
      collection(db, 'promoCodes'),
      where('code', '==', promoCode),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Invalid or inactive promo code');
    }

    const promo = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    // Check validity dates
    const now = new Date();
    const validFrom = promo.validFrom?.toDate?.() || new Date(promo.validFrom);
    const validUntil = promo.validUntil?.toDate?.() || new Date(promo.validUntil);

    if (now < validFrom || now > validUntil) {
      throw new Error('Promo code has expired or is not yet valid');
    }

    // Check usage limit
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      throw new Error('Promo code usage limit reached');
    }

    // Calculate discount
    let discount = 0;
    if (promo.discountType === 'percentage') {
      discount = (amount * promo.discountValue) / 100;
      if (promo.maxDiscount) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else {
      discount = promo.discountValue;
    }

    return {
      promoId: promo.id,
      promoCode: promo.code,
      discountAmount: discount,
      finalAmount: amount - discount
    };
  } catch (error) {
    console.error('Error applying promo code:', error);
    throw error;
  }
}

export {
  generateReceiptNumber,
  addPayment,
  getPayment,
  getPaymentsByStudent,
  getPaymentsByYear,
  getPaymentsByDateRange,
  searchPayments,
  filterPaymentsByMode,
  calculatePaymentStats,
  validatePaymentData,
  applyPromoCode
};
