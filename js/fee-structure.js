// Fee Structure Management Module
import { db } from './firebase-config.js';
import { logAudit, getCurrentUser, isPrincipal } from './auth.js';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showAlert, sanitizeInput } from './utils.js';

// Load fee structure for academic year
export async function loadFeeStructure(academicYearId) {
  try {
    const docRef = doc(db, 'feeStructures', academicYearId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        academicYearId,
        categories: [],
        updatedAt: null,
        updatedBy: null
      };
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error('Error loading fee structure:', error);
    throw error;
  }
}

// Save fee structure for academic year
export async function saveFeeStructure(academicYearId, categories) {
  try {
    if (!isPrincipal()) {
      throw new Error('Only principals can modify fee structures');
    }

    const currentUser = getCurrentUser();

    // Validate categories
    const errors = validateFeeStructure(categories);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const feeStructure = {
      academicYearId,
      categories: categories.map(cat => ({
        id: cat.id || generateCategoryId(cat.name),
        name: sanitizeInput(cat.name),
        description: sanitizeInput(cat.description || ''),
        amounts: cat.amounts || {},
        isActive: cat.isActive !== false
      })),
      updatedBy: currentUser.uid,
      updatedByName: currentUser.name,
      updatedAt: serverTimestamp()
    };

    // Use setDoc to create or update
    await setDoc(doc(db, 'feeStructures', academicYearId), feeStructure);

    // Log audit
    await logAudit('fee_structure_updated', {
      academicYearId,
      categoryCount: categories.length
    });

    return feeStructure;
  } catch (error) {
    console.error('Error saving fee structure:', error);
    throw error;
  }
}

// Add fee category
export async function addFeeCategory(academicYearId, category) {
  try {
    const structure = await loadFeeStructure(academicYearId);

    // Check if category already exists
    const existingCategory = structure.categories.find(
      cat => cat.name.toLowerCase() === category.name.toLowerCase()
    );

    if (existingCategory) {
      throw new Error('Category with this name already exists');
    }

    // Add new category
    structure.categories.push({
      id: generateCategoryId(category.name),
      name: sanitizeInput(category.name),
      description: sanitizeInput(category.description || ''),
      amounts: category.amounts || {},
      isActive: true
    });

    await saveFeeStructure(academicYearId, structure.categories);

    return structure;
  } catch (error) {
    console.error('Error adding fee category:', error);
    throw error;
  }
}

// Update fee category
export async function updateFeeCategory(academicYearId, categoryId, updates) {
  try {
    const structure = await loadFeeStructure(academicYearId);

    const categoryIndex = structure.categories.findIndex(cat => cat.id === categoryId);
    if (categoryIndex === -1) {
      throw new Error('Category not found');
    }

    // Update category
    structure.categories[categoryIndex] = {
      ...structure.categories[categoryIndex],
      ...updates
    };

    await saveFeeStructure(academicYearId, structure.categories);

    return structure;
  } catch (error) {
    console.error('Error updating fee category:', error);
    throw error;
  }
}

// Delete fee category
export async function deleteFeeCategory(academicYearId, categoryId) {
  try {
    const structure = await loadFeeStructure(academicYearId);

    structure.categories = structure.categories.filter(cat => cat.id !== categoryId);

    await saveFeeStructure(academicYearId, structure.categories);

    return structure;
  } catch (error) {
    console.error('Error deleting fee category:', error);
    throw error;
  }
}

// Get total fee for a class
export function calculateClassFee(feeStructure, className) {
  if (!feeStructure || !feeStructure.categories) {
    return 0;
  }

  let total = 0;

  feeStructure.categories.forEach(category => {
    if (category.isActive && category.amounts && category.amounts[className]) {
      total += parseFloat(category.amounts[className]) || 0;
    }
  });

  return total;
}

// Get fee breakdown for a class
export function getClassFeeBreakdown(feeStructure, className) {
  if (!feeStructure || !feeStructure.categories) {
    return { breakdown: [], total: 0 };
  }

  const breakdown = [];
  let total = 0;

  feeStructure.categories.forEach(category => {
    if (category.isActive && category.amounts && category.amounts[className]) {
      const amount = parseFloat(category.amounts[className]) || 0;
      if (amount > 0) {
        breakdown.push({
          category: category.name,
          categoryId: category.id,
          amount: amount
        });
        total += amount;
      }
    }
  });

  return { breakdown, total };
}

// Validate fee structure
function validateFeeStructure(categories) {
  const errors = [];

  if (!categories || categories.length === 0) {
    errors.push('At least one fee category is required');
    return errors;
  }

  categories.forEach((category, index) => {
    if (!category.name || category.name.trim() === '') {
      errors.push(`Category ${index + 1}: Name is required`);
    }

    if (category.amounts) {
      Object.entries(category.amounts).forEach(([className, amount]) => {
        if (isNaN(amount) || amount < 0) {
          errors.push(`Category "${category.name}", Class ${className}: Invalid amount`);
        }
      });
    }
  });

  return errors;
}

// Generate category ID from name
function generateCategoryId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Get default fee categories (templates)
export function getDefaultFeeCategories() {
  return [
    {
      id: 'tuition',
      name: 'Tuition Fee',
      description: 'Basic tuition fee for academics',
      amounts: {}
    },
    {
      id: 'books',
      name: 'Books & Stationery',
      description: 'Textbooks and school supplies',
      amounts: {}
    },
    {
      id: 'transport',
      name: 'Transport Fee',
      description: 'School bus transportation',
      amounts: {}
    },
    {
      id: 'activities',
      name: 'Activities & Sports',
      description: 'Extra-curricular activities and sports',
      amounts: {}
    },
    {
      id: 'exam',
      name: 'Exam Fee',
      description: 'Examination and assessment fees',
      amounts: {}
    }
  ];
}

// Get all class options
export function getClassOptions() {
  return [
    'Nursery',
    'LKG',
    'UKG',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12'
  ];
}

// Copy fee structure from another year
export async function copyFeeStructureFromYear(sourceYearId, targetYearId) {
  try {
    if (!isPrincipal()) {
      throw new Error('Only principals can copy fee structures');
    }

    const sourceStructure = await loadFeeStructure(sourceYearId);

    if (!sourceStructure.categories || sourceStructure.categories.length === 0) {
      throw new Error('Source academic year has no fee structure');
    }

    await saveFeeStructure(targetYearId, sourceStructure.categories);

    await logAudit('fee_structure_copied', {
      sourceYearId,
      targetYearId,
      categoryCount: sourceStructure.categories.length
    });

    return true;
  } catch (error) {
    console.error('Error copying fee structure:', error);
    throw error;
  }
}

export default {
  loadFeeStructure,
  saveFeeStructure,
  addFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  calculateClassFee,
  getClassFeeBreakdown,
  getDefaultFeeCategories,
  getClassOptions,
  copyFeeStructureFromYear
};
