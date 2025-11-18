# 🚀 Quick Setup Guide - VPPS Fee Management System

## Step 1: Firebase Setup (5 minutes)

### 1.1 Create Firebase Users

Go to [Firebase Console](https://console.firebase.google.com) → Your Project → Authentication

**Add Principal User:**
- Click "Add User"
- Email: `director@vpps.co.in`
- Password: (create a strong password)
- Click "Add User"

**Add Staff User:**
- Click "Add User"
- Email: `reception@vpps.co.in`
- Password: (create a strong password)
- Click "Add User"

### 1.2 Create User Profiles in Firestore

Go to Firebase Console → Firestore Database

**Create `users` collection if not exists:**

**Add Principal Document:**
```
Collection: users
Document ID: (copy UID from Authentication tab for director@vpps.co.in)

Fields:
- email: "director@vpps.co.in"
- name: "Director Name"
- role: "principal"
- createdAt: (use Timestamp)
```

**Add Staff Document:**
```
Collection: users
Document ID: (copy UID from Authentication tab for reception@vpps.co.in)

Fields:
- email: "reception@vpps.co.in"
- name: "Reception Staff"
- role: "staff"
- createdAt: (use Timestamp)
```

### 1.3 Create First Academic Year

**Add Document to `academicYears` collection:**
```
Collection: academicYears
Document ID: Auto-generate

Fields:
- name: "2024-2025"
- startDate: 2024-04-01 (Timestamp)
- endDate: 2025-03-31 (Timestamp)
- isActive: true
- createdAt: (use Timestamp)
```

## Step 2: Deploy to GitHub Pages (2 minutes)

### 2.1 Push Code to GitHub

```bash
git add .
git commit -m "Initial deployment of fee management system"
git push origin main
```

### 2.2 Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll to "Pages" in left sidebar
4. Under "Source":
   - Select "Deploy from a branch"
   - Select branch: `main`
   - Select folder: `/ (root)`
5. Click "Save"

Your site will be live at: `https://YOUR-USERNAME.github.io/fees/`

## Step 3: First Login & Test (2 minutes)

### 3.1 Login as Principal

1. Visit your GitHub Pages URL
2. Login with:
   - Email: `director@vpps.co.in`
   - Password: (the one you created)
3. You should see the dashboard

### 3.2 Create a Test Student

1. Click "Students" in sidebar
2. Click "Add Student"
3. Fill in details:
   - Name: Test Student
   - Admission No: 2024001
   - Class: 10
   - Contact: 9876543210
   - Class Fee: 15000
   - Total Fees: 15000
4. Click "Add Student"

### 3.3 Process a Test Payment

1. Go to Dashboard
2. Find the student in "Pending Dues" table
3. Click "Pay" button
4. Enter payment details:
   - Amount: 5000
   - Payment Mode: Cash
5. Click "Process Payment"
6. Download the receipt when prompted

## Step 4: Firestore Security Rules

Go to Firebase Console → Firestore Database → Rules

Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }

    // Helper function to get user data
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Helper function to check role
    function hasRole(role) {
      return isSignedIn() && getUserData().role == role;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal');
    }

    // Students collection
    match /students/{studentId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal') || hasRole('staff');
    }

    // Payments collection
    match /payments/{paymentId} {
      allow read: if isSignedIn();
      allow create: if hasRole('principal') || hasRole('staff');
      allow update, delete: if hasRole('principal');
    }

    // Academic Years collection
    match /academicYears/{yearId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal');
    }

    // Fee Structure collection
    match /feeStructure/{structureId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal');
    }

    // Promo Codes collection
    match /promoCodes/{codeId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal');
    }

    // Audit Logs collection
    match /auditLogs/{logId} {
      allow read: if hasRole('principal');
      allow create: if isSignedIn();
      allow update, delete: if false;
    }

    // Bulk Uploads collection
    match /bulkUploads/{uploadId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal');
    }

    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if isSignedIn();
      allow write: if hasRole('principal') || hasRole('staff');
    }
  }
}
```

Click "Publish"

## ✅ Setup Complete!

Your fee management system is now live and ready to use.

## 📝 Next Steps

1. **Add More Students:**
   - Use "Add Student" for individual students
   - Or prepare a CSV for bulk upload

2. **Customize:**
   - Update school name in code if needed
   - Add school logo image
   - Customize receipt format

3. **Train Staff:**
   - Show them how to add students
   - Demonstrate payment processing
   - Explain receipt generation

4. **Setup Parent Accounts (Optional):**
   - Create parent users in Firebase Authentication
   - Add to Firestore with role "parent"
   - Link to their children

## 🆘 Troubleshooting

**Can't login?**
- Check if user exists in Firebase Authentication
- Verify user profile exists in Firestore users collection
- Make sure role is set correctly

**Dashboard shows no data?**
- Verify academic year is created
- Check Firestore security rules are published
- Look at browser console (F12) for errors

**Receipt not downloading?**
- Check if popup blocker is enabled
- Try different browser
- Check internet connection (jsPDF loads from CDN)

## 🔐 Security Checklist

- ✅ Firebase security rules applied
- ✅ Strong passwords for admin accounts
- ✅ HTTPS enabled (automatic with GitHub Pages)
- ✅ Audit logging enabled
- ⚠️ Change default passwords after first login
- ⚠️ Backup Firestore data regularly (Firebase Console → Firestore → Export)

## 📱 Access URLs

- **Production:** `https://YOUR-USERNAME.github.io/fees/`
- **Firebase Console:** `https://console.firebase.google.com`
- **GitHub Repository:** Your repository URL

## 🎉 You're All Set!

The system is ready for production use. Start by adding students and processing payments.

For support, refer to README.md or contact the system administrator.

---

**Last Updated:** November 2025
