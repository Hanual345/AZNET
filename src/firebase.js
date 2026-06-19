import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signInWithPopup
} from 'firebase/auth';

// Replace these with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwPemumB3bCk7BNGxBmxhoyFhopzXSmeQ",
  authDomain: "aznet-51b44.firebaseapp.com",
  projectId: "aznet-51b44",
  storageBucket: "aznet-51b44.firebasestorage.app",
  messagingSenderId: "569883085657",
  appId: "1:569883085657:web:789c80059339fbdd1ada48",
  measurementId: "G-17WV0VX543"
};

let app;
let auth;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  auth = getAuth(app);
} catch (error) {
  console.error("Firebase initialization error", error);
}

export {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  GithubAuthProvider,
  signInWithPopup
};
