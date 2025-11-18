// Student Management Module
import { db } from './firebase-config.js';
import { logAudit, getCurrentUser } from './auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Add a new student
async function addStudent(studentData) {
  try {
    const currentUser = getCurrentUser();

    // Prepare student document
    const student = {
      ...studentData,
      totalPaid: 0,
      pendingFees: studentData.totalFees,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'students'), student);

    // Log audit
    await logAudit('student_added', {
      studentId: docRef.id,
      studentName: studentData.name,
      academicYear: studentData.academicYear
    });

    return { id: docRef.id, ...student };
  } catch (error) {
    console.error('Error adding student:', error);
    throw error;
  }
}

// Update student
async function updateStudent(studentId, updates) {
  try {
    const currentUser = getCurrentUser();

    const updateData = {
      ...updates,
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, 'students', studentId), updateData);

    // Log audit
    await logAudit('student_updated', {
      studentId,
      updates: Object.keys(updates)
    });

    return true;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
}

// Delete student
async function deleteStudent(studentId) {
  try {
    // Check if student has any payments
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('studentId', '==', studentId)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);

    if (!paymentsSnapshot.empty) {
      throw new Error('Cannot delete student with existing payment records');
    }

    await deleteDoc(doc(db, 'students', studentId));

    // Log audit
    await logAudit('student_deleted', { studentId });

    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
}

// Get student by ID
async function getStudent(studentId) {
  try {
    const docSnap = await getDoc(doc(db, 'students', studentId));

    if (!docSnap.exists()) {
      throw new Error('Student not found');
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error getting student:', error);
    throw error;
  }
}

// Get all students for academic year
async function getStudentsByYear(academicYear) {
  try {
    const q = query(
      collection(db, 'students'),
      where('academicYear', '==', academicYear)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting students:', error);
    throw error;
  }
}

// Search students
async function searchStudents(academicYear, searchTerm) {
  try {
    const students = await getStudentsByYear(academicYear);

    if (!searchTerm) return students;

    const term = searchTerm.toLowerCase();
    return students.filter(student =>
      student.name?.toLowerCase().includes(term) ||
      student.admissionNumber?.toLowerCase().includes(term) ||
      student.class?.toLowerCase().includes(term) ||
      student.fatherName?.toLowerCase().includes(term) ||
      student.contactNumber?.includes(term)
    );
  } catch (error) {
    console.error('Error searching students:', error);
    throw error;
  }
}

// Calculate fee breakdown
function calculateFeeBreakdown(feeStructure, customFees = []) {
  let breakdown = [];
  let total = 0;

  // Add standard fees
  if (feeStructure) {
    Object.entries(feeStructure).forEach(([category, amount]) => {
      if (amount > 0) {
        breakdown.push({
          category,
          amount,
          type: 'standard'
        });
        total += amount;
      }
    });
  }

  // Add custom fees
  if (customFees && customFees.length > 0) {
    customFees.forEach(fee => {
      breakdown.push({
        category: fee.category || fee.name,
        amount: fee.amount,
        type: 'custom'
      });
      total += fee.amount;
    });
  }

  return { breakdown, total };
}

// Update student fee totals after payment
async function updateStudentFees(studentId, paymentAmount) {
  try {
    const student = await getStudent(studentId);

    const totalPaid = (student.totalPaid || 0) + paymentAmount;
    const pendingFees = (student.totalFees || 0) - totalPaid;

    await updateStudent(studentId, {
      totalPaid,
      pendingFees,
      lastPaymentDate: serverTimestamp()
    });

    return { totalPaid, pendingFees };
  } catch (error) {
    console.error('Error updating student fees:', error);
    throw error;
  }
}

// Validate student data
function validateStudentData(data) {
  const errors = [];

  if (!data.name || data.name.trim() === '') {
    errors.push('Student name is required');
  }

  if (!data.admissionNumber || data.admissionNumber.trim() === '') {
    errors.push('Admission number is required');
  }

  if (!data.class || data.class.trim() === '') {
    errors.push('Class is required');
  }

  if (!data.academicYear) {
    errors.push('Academic year is required');
  }

  if (data.totalFees === undefined || data.totalFees < 0) {
    errors.push('Valid total fees amount is required');
  }

  if (data.contactNumber && !/^\d{10}$/.test(data.contactNumber.replace(/\D/g, ''))) {
    errors.push('Contact number must be 10 digits');
  }

  return errors;
}

// Check if admission number exists
async function checkAdmissionNumberExists(admissionNumber, academicYear, excludeStudentId = null) {
  try {
    const q = query(
      collection(db, 'students'),
      where('admissionNumber', '==', admissionNumber),
      where('academicYear', '==', academicYear)
    );

    const snapshot = await getDocs(q);

    // If we're updating, exclude current student
    if (excludeStudentId) {
      return snapshot.docs.some(doc => doc.id !== excludeStudentId);
    }

    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking admission number:', error);
    return false;
  }
}

export {
  addStudent,
  updateStudent,
  deleteStudent,
  getStudent,
  getStudentsByYear,
  searchStudents,
  calculateFeeBreakdown,
  updateStudentFees,
  validateStudentData,
  checkAdmissionNumberExists
};
