# Troubleshooting Guide

This guide helps you resolve common issues with the VPPS Fee Management System.

---

## Dashboard Loading Issues

### Issue: Dashboard shows "Loading..." indefinitely

**Symptoms:**
- After logging in, you see the dashboard page
- User name shows "Loading..."
- Academic year dropdown shows "Loading..."
- Page never finishes loading

**Possible Causes & Solutions:**

#### 1. Firebase Authentication State Not Loading

**Check:**
- Open browser console (F12 or Right-click > Inspect > Console)
- Look for error messages related to authentication

**Solution:**
- Clear browser cache and cookies
- Try logging out and logging in again
- Check if Firebase Authentication is enabled in Firebase Console
- Verify that the user exists in the `users` collection in Firestore

**Debug Steps:**
```
1. Open Console
2. Look for: "Fetching user profile for: [uid]"
3. If you see "User profile not found", the user doesn't exist in Firestore
4. Create a user document in the `users` collection with the correct structure
```

#### 2. Missing User Profile in Firestore

**Check:**
- Go to Firebase Console > Firestore Database
- Navigate to the `users` collection
- Look for a document with your user's UID

**Solution:**
Create a user document with this structure:
```javascript
{
  name: "Your Name",
  email: "your@email.com",
  role: "principal" or "staff" or "parent",
  createdAt: [current timestamp]
}
```

#### 3. Insufficient Permissions

**Check:**
- Look for "Insufficient permissions" error in console
- Check your user role in the `users` collection

**Solution:**
- Only users with `role: "principal"` or `role: "staff"` can access the dashboard
- Update your user document to have the correct role
- If you're a parent, you cannot access the admin dashboard

#### 4. No Academic Years Created

**Check:**
- Open Console
- Look for: "No academic years found in database"

**Solution:**
- You need at least one academic year to use the system
- Login as a principal user
- Navigate to "Academic Years" in the sidebar
- Create a new academic year
- Set it as "active"

#### 5. Firestore Security Rules Blocking Access

**Check:**
- Look for "permission-denied" errors in console
- Check Firebase Console > Firestore Database > Rules

**Solution:**
Update your Firestore Security Rules to allow authenticated users to read/write:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check authentication
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    // Users collection - users can read their own data
    match /users/{userId} {
      allow read: if isAuthenticated() && request.auth.uid == userId;
      allow write: if isAuthenticated() && getUserRole() == 'principal';
    }

    // Academic years - readable by all authenticated users
    match /academicYears/{yearId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && getUserRole() == 'principal';
    }

    // Students - readable by staff and principal
    match /students/{studentId} {
      allow read: if isAuthenticated() && getUserRole() in ['principal', 'staff'];
      allow write: if isAuthenticated() && getUserRole() in ['principal', 'staff'];
    }

    // Payments - readable by staff and principal
    match /payments/{paymentId} {
      allow read: if isAuthenticated() && getUserRole() in ['principal', 'staff'];
      allow write: if isAuthenticated() && getUserRole() in ['principal', 'staff'];
    }

    // Fee structures
    match /feeStructures/{structureId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && getUserRole() == 'principal';
    }

    // Audit logs - principal only
    match /auditLogs/{logId} {
      allow read: if isAuthenticated() && getUserRole() == 'principal';
      allow write: if isAuthenticated();
    }
  }
}
```

#### 6. Missing Firestore Composite Indexes

**Check:**
- Look for errors mentioning "index" or "failed-precondition"
- Check for "Index Required" messages on the dashboard

**Solution:**
- See [FIRESTORE_INDEXES.md](./FIRESTORE_INDEXES.md) for required indexes
- Click the index creation link in the error message
- Wait for the index to build (can take a few minutes)

---

## Login Issues

### Issue: "Invalid email or password" error

**Check:**
- Verify email and password are correct
- Check if the user exists in Firebase Authentication

**Solution:**
1. Go to Firebase Console > Authentication
2. Look for the user in the Users list
3. If not found, create the user
4. Also create a matching document in the `users` collection in Firestore

### Issue: Login successful but redirects back to login

**Check:**
- Check if user profile exists in Firestore
- Look for console errors

**Solution:**
- Create a user document in Firestore `users` collection
- Ensure the UID matches the Authentication UID

---

## Data Not Loading

### Issue: Statistics show 0 for everything

**Possible Causes:**
1. No data in the database for the selected academic year
2. Academic year ID mismatch
3. Firestore query error

**Solution:**
1. Check Console for query errors
2. Verify students and payments are linked to the correct academic year ID
3. Check that the `academicYear` field in students/payments matches the academic year document ID

### Issue: Recent Payments section shows "Index Required"

**Solution:**
- See [FIRESTORE_INDEXES.md](./FIRESTORE_INDEXES.md)
- Create the required composite index for the payments collection

---

## Browser Console Debugging

### How to Open Console

**Chrome/Edge:**
- Press F12, or
- Right-click > Inspect > Console tab

**Firefox:**
- Press F12, or
- Right-click > Inspect Element > Console tab

**Safari:**
- Enable Developer Menu: Preferences > Advanced > "Show Develop menu"
- Develop > Show JavaScript Console

### Key Log Messages to Look For

When the dashboard loads successfully, you should see:
```
=== Dashboard Initialization Started ===
Checking authentication...
Fetching user profile for: [user-uid]
User profile loaded: {name: "...", role: "..."}
Authentication successful for: [user-name]
Updating user info...
Loading academic years...
Loading academic years from collection: academicYears
Executing Firestore query for academicYears...
Query completed. Documents found: [number]
Academic year document: [id] {name: "...", status: "..."}
Academic years loaded successfully: [number]
Active academic year set to: [year-name] (ID: [id])
Academic year dropdown populated with [number] options
Academic years loaded successfully
Loading dashboard data for academic year: [id]
Loading statistics...
... [more logs]
=== Dashboard Initialization Complete ===
```

### Common Error Messages

**"No authenticated user found"**
- User is not logged in or session expired
- Solution: Log in again

**"User profile not found in Firestore for uid: [uid]"**
- User exists in Authentication but not in Firestore
- Solution: Create user document in `users` collection

**"Insufficient permissions. User role: [role] Required: [required-roles]"**
- User doesn't have the right role
- Solution: Update user role in Firestore

**"No academic years found in database"**
- No academic years created yet
- Solution: Create an academic year (principal only)

**"Authentication check timeout"**
- Firebase not responding or network issue
- Solution: Check internet connection, refresh page

---

## Performance Issues

### Issue: Dashboard loads slowly

**Possible Causes:**
1. Large number of students/payments
2. Missing indexes
3. Inefficient queries

**Solution:**
1. Create all required Firestore indexes
2. Limit the number of records loaded at once
3. Implement pagination for large datasets

---

## Data Integrity Issues

### Issue: Student fees don't match payments

**Check:**
- Verify `totalPaid` field is being updated when payments are added
- Check if all payments are linked to the correct student

**Solution:**
- The system should auto-calculate `totalPaid` when adding payments
- If there's a mismatch, you may need to manually recalculate totals

---

## Getting Help

If you're still experiencing issues:

1. **Check the Console:** Most errors will be logged there
2. **Check Firebase Console:** Verify your data structure matches expectations
3. **Review Firestore Rules:** Ensure permissions are correctly configured
4. **Check Firestore Indexes:** Make sure all required indexes are built
5. **Clear Cache:** Sometimes browser cache can cause issues
6. **Try Incognito Mode:** This helps identify if the issue is related to browser extensions or cache

---

## Reporting Issues

When reporting issues, please include:
1. Browser console logs (with error messages)
2. Steps to reproduce the issue
3. User role attempting the action
4. Firebase project ID (do not share Firebase config keys publicly)
5. Screenshot of the error (if applicable)
