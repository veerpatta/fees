// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC_oilbKMzJKGq__9QIs-P6wKVr6hTweCc",
  authDomain: "veer-patta-fees-system.firebaseapp.com",
  projectId: "veer-patta-fees-system",
  storageBucket: "veer-patta-fees-system.firebasestorage.app",
  messagingSenderId: "973863765966",
  appId: "1:973863765966:web:446f3ff2f4fabd9b36cd9f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
