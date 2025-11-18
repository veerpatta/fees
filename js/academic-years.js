// Academic Year Management Module
import { db } from './firebase-config.js';
import { logAudit, getCurrentUser, isPrincipal } from './auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showAlert, showLoading, formatDate, sanitizeInput } from './utils.js';

let academicYears = [];

// Load all academic years
export async function loadAcademicYears() {
  try {
    console.log('Loading academic years from collection: academicYears');
    const q = query(
      collection(db, 'academicYears')
    );

    console.log('Executing Firestore query for academicYears...');
    const snapshot = await getDocs(q);
    console.log('Query completed. Documents found:', snapshot.size);

    academicYears = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Academic year document:', doc.id, data);
      return {
        id: doc.id,
        ...data
      };
    });

    console.log('Academic years loaded successfully:', academicYears.length);
    return academicYears;
  } catch (error) {
    console.error('Error loading academic years from Firestore:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Get active academic year
export function getActiveAcademicYear() {
  return academicYears.find(year => year.status === 'active') || academicYears[0] || null;
}

// Add new academic year
export async function addAcademicYear(yearData) {
  try {
    // Check permissions
    if (!isPrincipal()) {
      throw new Error('Only principals can create academic years');
    }

    const currentUser = getCurrentUser();

    // Validate dates
    const startDate = new Date(yearData.startDate);
    const endDate = new Date(yearData.endDate);

    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }

    // Check for overlapping years
    const overlapping = await checkOverlappingYears(startDate, endDate);
    if (overlapping) {
      throw new Error('Date range overlaps with existing academic year');
    }

    // Prepare year document
    const year = {
      name: sanitizeInput(yearData.name),
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      status: yearData.status || 'active',
      createdBy: currentUser.uid,
      createdByName: currentUser.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // If setting as active, deactivate other years
    if (year.status === 'active') {
      await deactivateAllYears();
    }

    // Add to Firestore
    const docRef = await addDoc(collection(db, 'academicYears'), year);

    // Log audit
    await logAudit('academic_year_created', {
      yearId: docRef.id,
      yearName: year.name,
      startDate: yearData.startDate,
      endDate: yearData.endDate
    });

    return { id: docRef.id, ...year };
  } catch (error) {
    console.error('Error adding academic year:', error);
    throw error;
  }
}

// Update academic year
export async function updateAcademicYear(yearId, updates) {
  try {
    if (!isPrincipal()) {
      throw new Error('Only principals can update academic years');
    }

    const currentUser = getCurrentUser();

    const updateData = {
      ...updates,
      updatedBy: currentUser.uid,
      updatedByName: currentUser.name,
      updatedAt: serverTimestamp()
    };

    // If dates are being updated, validate them
    if (updates.startDate || updates.endDate) {
      const year = academicYears.find(y => y.id === yearId);
      const startDate = updates.startDate ? new Date(updates.startDate) : year.startDate.toDate();
      const endDate = updates.endDate ? new Date(updates.endDate) : year.endDate.toDate();

      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }

      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(endDate);
      }
    }

    // If setting as active, deactivate other years
    if (updates.status === 'active') {
      await deactivateAllYears();
    }

    await updateDoc(doc(db, 'academicYears', yearId), updateData);

    // Log audit
    await logAudit('academic_year_updated', {
      yearId,
      updates: Object.keys(updates)
    });

    return true;
  } catch (error) {
    console.error('Error updating academic year:', error);
    throw error;
  }
}

// Delete academic year
export async function deleteAcademicYear(yearId) {
  try {
    if (!isPrincipal()) {
      throw new Error('Only principals can delete academic years');
    }

    // Check if year has any students
    const studentsQuery = query(
      collection(db, 'students'),
      where('academicYear', '==', yearId)
    );
    const studentsSnapshot = await getDocs(studentsQuery);

    if (!studentsSnapshot.empty) {
      throw new Error('Cannot delete academic year with enrolled students');
    }

    await deleteDoc(doc(db, 'academicYears', yearId));

    // Log audit
    await logAudit('academic_year_deleted', { yearId });

    return true;
  } catch (error) {
    console.error('Error deleting academic year:', error);
    throw error;
  }
}

// Set academic year as active
export async function setActiveAcademicYear(yearId) {
  try {
    await deactivateAllYears();
    await updateAcademicYear(yearId, { status: 'active' });
    return true;
  } catch (error) {
    console.error('Error setting active year:', error);
    throw error;
  }
}

// Archive academic year
export async function archiveAcademicYear(yearId) {
  try {
    await updateAcademicYear(yearId, { status: 'archived' });
    return true;
  } catch (error) {
    console.error('Error archiving year:', error);
    throw error;
  }
}

// Deactivate all academic years
async function deactivateAllYears() {
  try {
    const promises = academicYears
      .filter(year => year.status === 'active')
      .map(year => updateDoc(doc(db, 'academicYears', year.id), { status: 'inactive' }));

    await Promise.all(promises);
  } catch (error) {
    console.error('Error deactivating years:', error);
    throw error;
  }
}

// Check for overlapping years
async function checkOverlappingYears(startDate, endDate, excludeYearId = null) {
  try {
    const allYears = await loadAcademicYears();

    return allYears.some(year => {
      if (excludeYearId && year.id === excludeYearId) {
        return false;
      }

      const yearStart = year.startDate.toDate();
      const yearEnd = year.endDate.toDate();

      // Check if date ranges overlap
      return (
        (startDate >= yearStart && startDate <= yearEnd) ||
        (endDate >= yearStart && endDate <= yearEnd) ||
        (startDate <= yearStart && endDate >= yearEnd)
      );
    });
  } catch (error) {
    console.error('Error checking overlapping years:', error);
    return false;
  }
}

// Validate academic year data
export function validateAcademicYearData(data) {
  const errors = [];

  if (!data.name || data.name.trim() === '') {
    errors.push('Academic year name is required');
  }

  if (!data.startDate) {
    errors.push('Start date is required');
  }

  if (!data.endDate) {
    errors.push('End date is required');
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }

  return errors;
}

// Generate academic year name from dates
export function generateAcademicYearName(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return `${startYear}`;
  }

  // Format as "2024-25" for typical academic years
  if (endYear === startYear + 1) {
    return `${startYear}-${endYear.toString().slice(2)}`;
  }

  return `${startYear}-${endYear}`;
}

// Populate academic years dropdown
export async function populateAcademicYears() {
  try {
    const years = await loadAcademicYears();
    const yearSelect = document.getElementById('academicYear');
    
    if (!yearSelect) {
      console.warn('Academic year select element not found');
      return;
    }
    
    if (years.length === 0) {
      yearSelect.innerHTML = '<option value="">No academic years - Create one to begin</option>';
      return;
    }
    
    // Populate dropdown
    yearSelect.innerHTML = years.map(year => {
      const isActive = year.status === 'active' || year.isActive;
      return `<option value="${year.id}" ${isActive ? 'selected' : ''}>${year.name}</option>`;
    }).join('');
    
    return years;
  } catch (error) {
    console.error('Error populating academic years:', error);
    const yearSelect = document.getElementById('academicYear');
    if (yearSelect) {
      yearSelect.innerHTML = '<option value="">Error loading years</option>';
    }
    throw error;
  }
}

export default {
  loadAcademicYears,
      populateAcademicYears,
  getActiveAcademicYear,
  addAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
  validateAcademicYearData,
  generateAcademicYearName
};
