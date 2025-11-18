// Authentication Handler
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// User roles
const ROLES = {
  PRINCIPAL: 'principal',
  STAFF: 'staff',
  PARENT: 'parent'
};

// Current user data
let currentUser = null;

// Login function
async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get user role from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      throw new Error('User profile not found. Please contact administrator.');
    }

    const userData = userDoc.data();
    currentUser = {
      uid: user.uid,
      email: user.email,
      role: userData.role,
      name: userData.name,
      ...userData
    };

    // Log login activity
    await logAudit('login', {
      userId: user.uid,
      email: user.email,
      role: userData.role
    });

    return currentUser;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Logout function
async function logout() {
  try {
    if (currentUser) {
      await logAudit('logout', {
        userId: currentUser.uid,
        email: currentUser.email
      });
    }
    await signOut(auth);
    currentUser = null;
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// Check authentication state
function checkAuth(requiredRoles = []) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        reject(new Error('Not authenticated'));
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
          reject(new Error('User profile not found'));
          return;
        }

        const userData = userDoc.data();
        currentUser = {
          uid: user.uid,
          email: user.email,
          role: userData.role,
          name: userData.name,
          ...userData
        };

        // Check if user has required role
        if (requiredRoles.length > 0 && !requiredRoles.includes(currentUser.role)) {
          reject(new Error('Insufficient permissions'));
          return;
        }

        resolve(currentUser);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Check if user has permission
function hasPermission(requiredRoles) {
  if (!currentUser) return false;
  return requiredRoles.includes(currentUser.role);
}

// Check if user is principal
function isPrincipal() {
  return currentUser && currentUser.role === ROLES.PRINCIPAL;
}

// Check if user is staff
function isStaff() {
  return currentUser && currentUser.role === ROLES.STAFF;
}

// Check if user is parent
function isParent() {
  return currentUser && currentUser.role === ROLES.PARENT;
}

// Log audit trail
async function logAudit(action, details = {}) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      userId: currentUser?.uid || 'anonymous',
      userEmail: currentUser?.email || 'anonymous',
      userRole: currentUser?.role || 'unknown',
      details,
      timestamp: serverTimestamp(),
      ipAddress: null // Could be enhanced with IP detection
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw error - audit logging should not break functionality
  }
}

export {
  login,
  logout,
  checkAuth,
  getCurrentUser,
  hasPermission,
  isPrincipal,
  isStaff,
  isParent,
  logAudit,
  ROLES
};
