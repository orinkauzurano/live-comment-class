import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAd40Zl4ENNppSZ5qJ-7BKHi9JKfaenHDA",
  authDomain: "live-comment-class.firebaseapp.com",
  projectId: "live-comment-class",
  storageBucket: "live-comment-class.firebasestorage.app",
  messagingSenderId: "1034600928398",
  appId: "1:1034600928398:web:5cf0a273c99239f863e5df",
  measurementId: "G-RN9WJ2TE32",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();