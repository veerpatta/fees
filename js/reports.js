// Reports and Analytics Module
import { db } from './firebase-config.js';
import { getCurrentUser } from './auth.js';
import { getStudentsByYear } from './students.js';
import { getPaymentsByYear, getPaymentsByDateRange } from './payments.js';
import {
  formatCurrency,
  formatDate,
  exportToCSV,
  showAlert,
  showLoading,
  groupBy,
  sortBy
} from './utils.js';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy as firestoreOrderBy,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Generate Collection Report
export async function generateCollectionReport(academicYearId, startDate, endDate) {
  try {
    showLoading(true, 'Generating collection report...');

    const start = startDate ? Timestamp.fromDate(new Date(startDate)) : null;
    const end = endDate ? Timestamp.fromDate(new Date(endDate)) : null;

    let payments;
    if (start && end) {
      payments = await getPaymentsByDateRange(academicYearId, start, end);
    } else {
      payments = await getPaymentsByYear(academicYearId);
    }

    // Calculate statistics
    const totalCollection = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalTransactions = payments.length;

    // Group by payment mode
    const byMode = {
      cash: 0,
      online: 0,
      cheque: 0
    };

    payments.forEach(payment => {
      const mode = payment.paymentMode || 'cash';
      byMode[mode] = (byMode[mode] || 0) + payment.amount;
    });

    // Group by class
    const byClass = {};
    payments.forEach(payment => {
      const cls = payment.studentClass || 'Unknown';
      if (!byClass[cls]) {
        byClass[cls] = { count: 0, amount: 0 };
      }
      byClass[cls].count++;
      byClass[cls].amount += payment.amount || 0;
    });

    // Group by date
    const byDate = {};
    payments.forEach(payment => {
      const date = payment.paymentDate?.toDate?.() || new Date(payment.paymentDate);
      const dateKey = date.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = { count: 0, amount: 0 };
      }
      byDate[dateKey].count++;
      byDate[dateKey].amount += payment.amount || 0;
    });

    showLoading(false);

    return {
      summary: {
        totalCollection,
        totalTransactions,
        startDate: startDate || 'All time',
        endDate: endDate || 'Present'
      },
      byMode,
      byClass,
      byDate,
      payments
    };
  } catch (error) {
    console.error('Error generating collection report:', error);
    showLoading(false);
    throw error;
  }
}

// Generate Pending Dues Report
export async function generatePendingDuesReport(academicYearId) {
  try {
    showLoading(true, 'Generating pending dues report...');

    const students = await getStudentsByYear(academicYearId);

    // Filter students with pending dues
    const pendingStudents = students
      .map(student => ({
        ...student,
        pendingAmount: (student.totalFees || 0) - (student.totalPaid || 0)
      }))
      .filter(s => s.pendingAmount > 0)
      .sort((a, b) => b.pendingAmount - a.pendingAmount);

    const totalPending = pendingStudents.reduce((sum, s) => sum + s.pendingAmount, 0);
    const totalStudents = pendingStudents.length;

    // Group by class
    const byClass = {};
    pendingStudents.forEach(student => {
      const cls = student.class || 'Unknown';
      if (!byClass[cls]) {
        byClass[cls] = { count: 0, amount: 0 };
      }
      byClass[cls].count++;
      byClass[cls].amount += student.pendingAmount;
    });

    showLoading(false);

    return {
      summary: {
        totalPending,
        totalStudents
      },
      byClass,
      students: pendingStudents
    };
  } catch (error) {
    console.error('Error generating pending dues report:', error);
    showLoading(false);
    throw error;
  }
}

// Generate Class-wise Summary Report
export async function generateClasswiseReport(academicYearId) {
  try {
    showLoading(true, 'Generating class-wise report...');

    const students = await getStudentsByYear(academicYearId);

    // Group by class
    const classSummary = {};

    students.forEach(student => {
      const cls = student.class || 'Unknown';
      if (!classSummary[cls]) {
        classSummary[cls] = {
          studentCount: 0,
          totalFees: 0,
          totalCollected: 0,
          totalPending: 0
        };
      }

      classSummary[cls].studentCount++;
      classSummary[cls].totalFees += student.totalFees || 0;
      classSummary[cls].totalCollected += student.totalPaid || 0;
      classSummary[cls].totalPending += (student.totalFees || 0) - (student.totalPaid || 0);
    });

    showLoading(false);

    return classSummary;
  } catch (error) {
    console.error('Error generating class-wise report:', error);
    showLoading(false);
    throw error;
  }
}

// Generate Daily Collection Report
export async function generateDailyReport(academicYearId, date) {
  try {
    showLoading(true, 'Generating daily report...');

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const payments = await getPaymentsByDateRange(
      academicYearId,
      Timestamp.fromDate(targetDate),
      Timestamp.fromDate(nextDay)
    );

    const totalCollection = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Group by payment mode
    const byMode = {
      cash: 0,
      online: 0,
      cheque: 0
    };

    payments.forEach(payment => {
      const mode = payment.paymentMode || 'cash';
      byMode[mode] = (byMode[mode] || 0) + payment.amount;
    });

    showLoading(false);

    return {
      date: targetDate,
      totalCollection,
      totalTransactions: payments.length,
      byMode,
      payments
    };
  } catch (error) {
    console.error('Error generating daily report:', error);
    showLoading(false);
    throw error;
  }
}

// Export Collection Report to CSV
export function exportCollectionReportCSV(reportData) {
  const csvData = reportData.payments.map(payment => ({
    'Receipt No': payment.receiptNumber || 'N/A',
    'Date': formatDate(payment.paymentDate),
    'Student Name': payment.studentName || 'Unknown',
    'Class': payment.studentClass || 'N/A',
    'Amount': payment.amount || 0,
    'Mode': payment.paymentMode?.toUpperCase() || 'N/A',
    'Collected By': payment.collectedByName || 'Unknown'
  }));

  exportToCSV(csvData, `collection-report-${Date.now()}.csv`);
}

// Export Pending Dues Report to CSV
export function exportPendingDuesCSV(reportData) {
  const csvData = reportData.students.map(student => ({
    'Admission No': student.admissionNumber || 'N/A',
    'Student Name': student.name || 'Unknown',
    'Class': student.class || 'N/A',
    'Contact': student.contactNumber || 'N/A',
    'Total Fees': student.totalFees || 0,
    'Paid': student.totalPaid || 0,
    'Pending': student.pendingAmount || 0
  }));

  exportToCSV(csvData, `pending-dues-${Date.now()}.csv`);
}

// Export Class-wise Summary to CSV
export function exportClasswiseCSV(classSummary) {
  const csvData = Object.entries(classSummary).map(([cls, data]) => ({
    'Class': cls,
    'Students': data.studentCount,
    'Total Fees': data.totalFees,
    'Collected': data.totalCollected,
    'Pending': data.totalPending,
    'Collection %': ((data.totalCollected / data.totalFees) * 100).toFixed(2)
  }));

  exportToCSV(csvData, `classwise-summary-${Date.now()}.csv`);
}

// Generate Collection Report PDF
export async function generateCollectionReportPDF(reportData) {
  try {
    // Load jsPDF
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Collection Report', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${formatDate(new Date(), true)}`, 105, 28, { align: 'center' });

    // Summary
    let yPos = 40;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Collection: ${formatCurrency(reportData.summary.totalCollection)}`, 20, yPos);
    yPos += 6;
    doc.text(`Total Transactions: ${reportData.summary.totalTransactions}`, 20, yPos);
    yPos += 6;
    doc.text(`Period: ${reportData.summary.startDate} to ${reportData.summary.endDate}`, 20, yPos);

    // By Mode
    yPos += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('Collection by Payment Mode', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');

    Object.entries(reportData.byMode).forEach(([mode, amount]) => {
      doc.text(`${mode.toUpperCase()}: ${formatCurrency(amount)}`, 20, yPos);
      yPos += 6;
    });

    // By Class
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Collection by Class', 20, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');

    Object.entries(reportData.byClass).forEach(([cls, data]) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`Class ${cls}: ${formatCurrency(data.amount)} (${data.count} payments)`, 20, yPos);
      yPos += 6;
    });

    doc.save(`collection-report-${Date.now()}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

export default {
  generateCollectionReport,
  generatePendingDuesReport,
  generateClasswiseReport,
  generateDailyReport,
  exportCollectionReportCSV,
  exportPendingDuesCSV,
  exportClasswiseCSV,
  generateCollectionReportPDF
};
