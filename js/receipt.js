// Receipt Generation Module using jsPDF
import { formatCurrency, formatDate, amountToWords } from './utils.js';
import { getPayment } from './payments.js';
import { getStudent } from './students.js';

// Load jsPDF from CDN
const loadJsPDF = () => {
  return new Promise((resolve, reject) => {
    if (window.jspdf) {
      resolve(window.jspdf.jsPDF);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      resolve(window.jspdf.jsPDF);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Generate receipt PDF
export async function generateReceipt(paymentId, action = 'download') {
  try {
    // Load jsPDF
    const jsPDF = await loadJsPDF();

    // Get payment and student details
    const payment = await getPayment(paymentId);
    const student = await getStudent(payment.studentId);

    // Create PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set font
    doc.setFont('helvetica');

    // School Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('🏫', 15, 20);
    doc.text('Veer Patta Public School', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Fee Management System', 105, 27, { align: 'center' });

    // Draw line
    doc.setLineWidth(0.5);
    doc.line(15, 32, 195, 32);

    // Receipt Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FEE RECEIPT', 105, 42, { align: 'center' });

    // Receipt Number and Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt No: ${payment.receiptNumber}`, 15, 52);
    doc.text(`Date: ${formatDate(payment.paymentDate)}`, 150, 52);

    // Student Details Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Student Details', 15, 65);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let yPos = 73;

    const studentDetails = [
      ['Name:', student.name],
      ['Admission No:', student.admissionNumber],
      ['Class:', student.class],
      ['Father\'s Name:', student.fatherName || 'N/A'],
      ['Contact:', student.contactNumber || 'N/A']
    ];

    studentDetails.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 55, yPos);
      yPos += 7;
    });

    // Payment Details Section
    yPos += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Details', 15, yPos);

    yPos += 8;
    doc.setFontSize(10);

    const paymentDetails = [
      ['Payment Mode:', payment.paymentMode?.toUpperCase() || 'N/A'],
      ['Transaction ID:', payment.transactionId || payment.chequeNumber || 'N/A'],
      ['Bank Name:', payment.bankName || 'N/A']
    ];

    paymentDetails.forEach(([label, value]) => {
      if (value !== 'N/A' || label === 'Payment Mode:') {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 15, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 55, yPos);
        yPos += 7;
      }
    });

    // Fee Breakdown Table
    yPos += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Fee Breakdown', 15, yPos);

    yPos += 5;

    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 10, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 20, yPos + 7);
    doc.text('Amount', 170, yPos + 7, { align: 'right' });

    yPos += 10;

    // Table rows
    doc.setFont('helvetica', 'normal');

    if (payment.feeBreakdown && payment.feeBreakdown.length > 0) {
      payment.feeBreakdown.forEach(item => {
        doc.text(item.category || item.description, 20, yPos + 5);
        doc.text(formatCurrency(item.amount), 170, yPos + 5, { align: 'right' });
        yPos += 7;
      });
    } else {
      doc.text('Fee Payment', 20, yPos + 5);
      doc.text(formatCurrency(payment.amount), 170, yPos + 5, { align: 'right' });
      yPos += 7;
    }

    // Total
    yPos += 3;
    doc.setLineWidth(0.3);
    doc.line(15, yPos, 195, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Paid:', 20, yPos);
    doc.text(formatCurrency(payment.amount), 170, yPos, { align: 'right' });

    // Amount in words
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const words = amountToWords(payment.amount);
    doc.text(`Amount in words: ${words}`, 15, yPos);

    // Outstanding Balance
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    const pending = (student.totalFees || 0) - (student.totalPaid || 0);
    doc.text('Total Fees:', 15, yPos);
    doc.text(formatCurrency(student.totalFees), 70, yPos);
    yPos += 7;
    doc.text('Total Paid:', 15, yPos);
    doc.text(formatCurrency(student.totalPaid), 70, yPos);
    yPos += 7;
    doc.text('Balance Pending:', 15, yPos);
    doc.setTextColor(pending > 0 ? 200 : 0, pending > 0 ? 0 : 100, 0);
    doc.text(formatCurrency(pending), 70, yPos);
    doc.setTextColor(0, 0, 0);

    // Notes
    if (payment.notes) {
      yPos += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Notes:', 15, yPos);
      doc.text(payment.notes, 15, yPos + 5, { maxWidth: 180 });
      yPos += 15;
    }

    // Signature section
    yPos = 260; // Fixed position near bottom

    doc.setLineWidth(0.3);
    doc.line(15, yPos, 80, yPos);
    doc.line(125, yPos, 190, yPos);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Received By', 15, yPos + 5);
    doc.text(payment.collectedByName || 'Staff', 15, yPos + 10);

    doc.text('Parent/Guardian Signature', 125, yPos + 5);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a computer-generated receipt.', 105, 285, { align: 'center' });
    doc.text('Thank you for your payment!', 105, 290, { align: 'center' });

    // QR Code placeholder (simple box)
    doc.setLineWidth(0.5);
    doc.rect(175, 240, 20, 20);
    doc.setFontSize(6);
    doc.text('QR', 183, 251, { align: 'center' });

    // Action: download or open
    if (action === 'download') {
      doc.save(`Receipt_${payment.receiptNumber}.pdf`);
    } else if (action === 'preview') {
      window.open(doc.output('bloburl'), '_blank');
    } else if (action === 'print') {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }

    return doc;
  } catch (error) {
    console.error('Error generating receipt:', error);
    throw error;
  }
}

// Generate multiple receipts (for bulk operations)
export async function generateBulkReceipts(paymentIds) {
  try {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    for (let i = 0; i < paymentIds.length; i++) {
      if (i > 0) {
        doc.addPage();
      }

      const receipt = await generateReceipt(paymentIds[i], 'none');
      // This would need modification to merge PDFs properly
      // For now, generate individually
    }

    doc.save('Receipts_Bulk.pdf');
  } catch (error) {
    console.error('Error generating bulk receipts:', error);
    throw error;
  }
}

// Print receipt
export async function printReceipt(paymentId) {
  await generateReceipt(paymentId, 'print');
}

// Preview receipt
export async function previewReceipt(paymentId) {
  await generateReceipt(paymentId, 'preview');
}

// Download receipt
export async function downloadReceipt(paymentId) {
  await generateReceipt(paymentId, 'download');
}

export default {
  generateReceipt,
  generateBulkReceipts,
  printReceipt,
  previewReceipt,
  downloadReceipt
};
