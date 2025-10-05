// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import envConfig from './utils/EnvironmentConfig.js';

// Initialize environment config (synchronous for better compatibility)
envConfig.loadConfig();

// Your web app's Firebase configuration from environment variables
const firebaseConfig = envConfig.getFirebaseConfig();

let app, db, auth, googleProvider;

try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Configure auth persistence - do this before creating provider
    await setPersistence(auth, browserLocalPersistence);
    
    // Create Google provider
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    // Fallback configuration for development
    app = initializeApp({
        projectId: "motorsport-pro-demo",
        authDomain: "motorsport-pro-demo.firebaseapp.com"
    });
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
}

export { 
    db, 
    auth, 
    googleProvider, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    orderBy, 
    signInWithPopup, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence
};