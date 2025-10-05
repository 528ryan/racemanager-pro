// Firebase SDK imports - usando versão 9.0.0 para estabilidade
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, orderBy, limit, addDoc, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, updateProfile, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-auth.js";
import envConfig from './utils/EnvironmentConfig.js';

// Initialize environment config
envConfig.loadConfig();

// Your web app's Firebase configuration from environment variables
const firebaseConfig = envConfig.getFirebaseConfig();

console.log('🔧 Initializing Firebase...');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Create Google provider with proper configuration
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

console.log('✅ Firebase initialized successfully');

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
    limit,
    addDoc,
    arrayUnion,
    arrayRemove,
    increment,
    signInWithPopup, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    setPersistence,
    browserLocalPersistence
};