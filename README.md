# 🏫 Veer Patta Public School - Fee Management System

A complete, zero-cost fee management system built with modern web technologies and Firebase.

## 📋 Overview

This system provides comprehensive fee management capabilities for schools, including:
- Student management with fee tracking
- Payment processing with multiple payment modes
- Automatic receipt generation with PDF download
- Role-based access control (Principal, Staff, Parents)
- Bulk student upload via CSV
- Promo code system for discounts
- Comprehensive reports and analytics
- Audit logging for all transactions

## 🚀 Features

### Core Features (Phase 1)
- ✅ **Role-Based Authentication**
  - Principal: Full system access
  - Staff: Limited access (add students, record payments)
  - Parents: Read-only access to their child's records

- ✅ **Student Management**
  - Add/edit students with complete details
  - Fee breakdown by category
  - Auto-calculate total/paid/pending fees
  - Search and filter students

- ✅ **Payment Processing**
  - Support for partial payments (installments)
  - Multiple payment modes (Cash, Online, Cheque)
  - Auto-generate receipt numbers
  - Transaction tracking

- ✅ **Receipt Generation**
  - Professional PDF receipts
  - QR code for verification
  - Download and print options
  - Auto-calculation of pending balance

- ✅ **Dashboard**
  - Real-time statistics
  - Recent payments overview
  - Pending dues tracking
  - Today's collection summary

### Advanced Features (Phase 2)
- 🔄 **Bulk Upload** (Coming Soon)
  - CSV import for students
  - Data validation
  - Error reporting

- 🎟️ **Promo Codes** (Coming Soon)
  - Percentage and fixed discounts
  - Usage limits and expiry dates
  - Principal-only access

- 📊 **Reports & Analytics** (Coming Soon)
  - Collection reports by date range
  - Class-wise fee analysis
  - Payment mode analysis
  - Defaulter reports

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Firebase (Firestore + Authentication)
- **PDF Generation:** jsPDF
- **CSV Parsing:** PapaParse (for bulk upload)
- **Hosting:** GitHub Pages (zero cost!)
- **Design:** Material Design inspired

## 📦 Firebase Configuration

### Firestore Collections

```
academicYears/      # Academic year definitions
students/           # Student records
payments/           # Payment transactions
users/              # User accounts and roles
promoCodes/         # Discount promo codes
auditLogs/          # Audit trail
bulkUploads/        # Bulk upload history
feeStructure/       # Fee structure definitions
notifications/      # System notifications
```

### Security Rules

The system uses comprehensive Firestore security rules to ensure:
- Principals have full access
- Staff can read/write students and payments
- Parents can only read their own child's data
- All actions are validated server-side

## 🚦 Getting Started

### Prerequisites

1. **Firebase Project** - Already configured
   - Firestore Database enabled
   - Authentication (Email/Password) enabled
   - Firebase configuration in `js/firebase-config.js`

2. **User Accounts**
   - Create user accounts in Firebase Authentication Console
   - Add user profiles in Firestore `users` collection with role field

### Deployment

**GitHub Pages Deployment:**

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Deploy fee management system"
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to repository Settings > Pages
   - Select main branch
   - Your site will be live at: `https://yourusername.github.io/fees`

### First-Time Setup

1. **Create Users in Firebase**
   - Go to Firebase Console > Authentication
   - Add Email/Password users
   - Example:
     - director@vpps.co.in (Principal)
     - reception@vpps.co.in (Staff)

2. **Add User Roles in Firestore**
   - Go to Firebase Console > Firestore
   - Collection: `users`
   - Add documents with structure:
     ```json
     {
       "email": "director@vpps.co.in",
       "name": "Director Name",
       "role": "principal"
     }
     ```

3. **Create Academic Year**
   - Login as principal
   - Navigate to Academic Years
   - Create first academic year (e.g., 2024-2025)

4. **Add Students**
   - Use "Add Student" for individual entries
   - Or use "Bulk Upload" for CSV import

## 👥 User Roles & Permissions

### Principal (director@vpps.co.in)
- Full system access
- Create/manage academic years
- Configure fee structures
- Bulk upload students
- Create/manage promo codes
- Apply discounts
- View all reports and audit logs
- Manage staff accounts

### Staff (reception@vpps.co.in)
- Add/edit students
- Record fee payments
- Generate receipts
- View payment history
- Cannot modify fee amounts
- Cannot apply discounts

### Parents
- View child's fee details
- View payment history
- Download receipts
- Check pending dues

## 📱 System Modules

### 1. Login Page (`index.html`)
- Email/password authentication
- Role-based redirection
- Demo credentials display

### 2. Dashboard (`dashboard.html`)
- Statistics overview
- Recent payments
- Pending dues
- Quick actions

### 3. Student Management
- Add/edit students
- Search and filter
- Fee assignment
- View payment history

### 4. Payment Processing
- Select student
- Enter payment details
- Multiple payment modes
- Auto-generate receipt

### 5. Receipt Generation
- Professional PDF format
- School branding
- Complete payment details
- Download/print/email

## 📊 Data Structure

### Student Document
```javascript
{
  name: "John Doe",
  admissionNumber: "2024001",
  class: "10",
  section: "A",
  fatherName: "Father Name",
  contactNumber: "9876543210",
  classFee: 15000,
  transportFee: 5000,
  totalFees: 20000,
  totalPaid: 10000,
  pendingFees: 10000,
  academicYear: "2024-2025"
}
```

### Payment Document
```javascript
{
  studentId: "abc123",
  receiptNumber: "2024-2025-0001",
  amount: 5000,
  paymentDate: Timestamp,
  paymentMode: "cash",
  academicYear: "2024-2025",
  collectedBy: "user123"
}
```

## 🔒 Security Features

- Firebase Authentication
- Role-based access control
- Firestore security rules
- Audit logging
- Input validation
- XSS protection

## 🐛 Troubleshooting

**Login fails:**
- Check Firebase Authentication is enabled
- Verify user exists with correct role

**Data not loading:**
- Check Firestore security rules
- Verify academic year exists

**Receipt not generating:**
- Check jsPDF CDN is accessible
- Verify payment data is complete

## 📞 Support

For technical support:
- Email: director@vpps.co.in
- Contact: School Administration

## 📄 License

Proprietary - Veer Patta Public School

---

**Made with ❤️ for Veer Patta Public School**

**Version:** 1.0.0
**Last Updated:** November 2025