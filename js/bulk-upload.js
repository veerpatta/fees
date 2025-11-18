// Bulk Upload Module for Students
import { addStudent, validateStudentData, checkAdmissionNumberExists } from './students.js';
import { loadFeeStructure, getClassFeeBreakdown } from './fee-structure.js';
import { showAlert, showLoading, sanitizeInput } from './utils.js';
import { getCurrentUser, logAudit } from './auth.js';

// Parse CSV file
export async function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n');

        if (lines.length < 2) {
          reject(new Error('CSV file is empty or has no data rows'));
          return;
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Validate required headers
        const requiredHeaders = ['name', 'admission number', 'class', 'contact number'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
          return;
        }

        // Parse rows
        const students = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(v => v.trim());
          const student = {};

          headers.forEach((header, index) => {
            student[header] = values[index] || '';
          });

          students.push(student);
        }

        resolve({ headers, students });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

// Validate bulk student data
export function validateBulkStudents(students, academicYearId) {
  const results = students.map((student, index) => {
    const errors = [];
    const warnings = [];

    // Map CSV columns to student data structure
    const studentData = {
      name: sanitizeInput(student['name'] || student['student name'] || ''),
      admissionNumber: sanitizeInput(student['admission number'] || student['admission no'] || student['roll number'] || ''),
      class: student['class'] || '',
      section: sanitizeInput(student['section'] || ''),
      rollNumber: sanitizeInput(student['roll number'] || student['roll no'] || ''),
      fatherName: sanitizeInput(student['father name'] || student["father's name"] || ''),
      motherName: sanitizeInput(student['mother name'] || student["mother's name"] || ''),
      contactNumber: (student['contact number'] || student['contact'] || student['phone'] || '').replace(/\D/g, ''),
      email: student['email'] || '',
      address: sanitizeInput(student['address'] || ''),
      academicYear: academicYearId
    };

    // Validate required fields
    if (!studentData.name) {
      errors.push('Name is required');
    }

    if (!studentData.admissionNumber) {
      errors.push('Admission number is required');
    }

    if (!studentData.class) {
      errors.push('Class is required');
    }

    if (!studentData.contactNumber || studentData.contactNumber.length !== 10) {
      errors.push('Valid 10-digit contact number is required');
    }

    // Check for warnings
    if (!studentData.fatherName && !studentData.motherName) {
      warnings.push('No parent name provided');
    }

    if (!studentData.email) {
      warnings.push('No email provided');
    }

    return {
      row: index + 2, // +2 because: +1 for zero-index, +1 for header row
      originalData: student,
      studentData,
      errors,
      warnings,
      valid: errors.length === 0
    };
  });

  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.filter(r => !r.valid).length;

  return {
    results,
    summary: {
      total: students.length,
      valid: validCount,
      invalid: invalidCount
    }
  };
}

// Upload students in bulk
export async function uploadBulkStudents(validatedResults, academicYearId, feeStructure) {
  const currentUser = getCurrentUser();
  const successfulUploads = [];
  const failedUploads = [];

  showLoading(true, 'Uploading students...');

  for (const result of validatedResults.results) {
    if (!result.valid) {
      failedUploads.push({
        row: result.row,
        data: result.studentData,
        error: result.errors.join(', ')
      });
      continue;
    }

    try {
      // Check if admission number already exists
      const exists = await checkAdmissionNumberExists(
        result.studentData.admissionNumber,
        academicYearId
      );

      if (exists) {
        failedUploads.push({
          row: result.row,
          data: result.studentData,
          error: 'Admission number already exists'
        });
        continue;
      }

      // Auto-calculate fees from fee structure
      const { total: totalFees } = getClassFeeBreakdown(feeStructure, result.studentData.class);

      // Add student with fees
      const studentToAdd = {
        ...result.studentData,
        classFee: totalFees,
        transportFee: 0,
        otherFees: 0,
        totalFees: totalFees
      };

      await addStudent(studentToAdd);

      successfulUploads.push({
        row: result.row,
        name: result.studentData.name,
        admissionNumber: result.studentData.admissionNumber
      });
    } catch (error) {
      console.error(`Error uploading row ${result.row}:`, error);
      failedUploads.push({
        row: result.row,
        data: result.studentData,
        error: error.message || 'Unknown error'
      });
    }
  }

  showLoading(false);

  // Log audit
  await logAudit('bulk_student_upload', {
    academicYearId,
    totalAttempted: validatedResults.results.length,
    successful: successfulUploads.length,
    failed: failedUploads.length
  });

  return {
    successful: successfulUploads,
    failed: failedUploads,
    summary: {
      total: validatedResults.results.length,
      successful: successfulUploads.length,
      failed: failedUploads.length
    }
  };
}

// Generate sample CSV template
export function generateSampleCSV() {
  const headers = [
    'Name',
    'Admission Number',
    'Class',
    'Section',
    'Roll Number',
    'Father Name',
    'Mother Name',
    'Contact Number',
    'Email',
    'Address'
  ];

  const sampleData = [
    [
      'Rahul Sharma',
      'ADM001',
      '10',
      'A',
      '001',
      'Rajesh Sharma',
      'Sunita Sharma',
      '9876543210',
      'rahul@example.com',
      '123 Main Street, City'
    ],
    [
      'Priya Singh',
      'ADM002',
      '10',
      'A',
      '002',
      'Amit Singh',
      'Kavita Singh',
      '9876543211',
      'priya@example.com',
      '456 Park Avenue, City'
    ],
    [
      'Arjun Patel',
      'ADM003',
      '10',
      'B',
      '003',
      'Vijay Patel',
      'Anita Patel',
      '9876543212',
      'arjun@example.com',
      '789 Oak Road, City'
    ]
  ];

  let csv = headers.join(',') + '\n';
  sampleData.forEach(row => {
    csv += row.map(value => `"${value}"`).join(',') + '\n';
  });

  // Download the CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-upload-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default {
  parseCSVFile,
  validateBulkStudents,
  uploadBulkStudents,
  generateSampleCSV
};
