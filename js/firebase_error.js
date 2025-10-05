// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import envConfig from './utils/EnvironmentConfig.js';

// Initialize environment config
envConfig.loadConfig();

// Your web app's Firebase configuration from environment variables
const firebaseConfig = envConfig.getFirebaseConfig();

console.log('🔧 Firebase Config:', firebaseConfig);

// Initialize Firebase immediately
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Create Google provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

console.log('✅ Firebase initialized successfully');
        
        // Fallback configuration for development
        try {
            app = initializeApp({
                projectId: "motorsport-pro-demo",
                authDomain: "motorsport-pro-demo.firebaseapp.com",
                storageBucket: "motorsport-pro-demo.appspot.com"
            });
            db = getFirestore(app);
            auth = getAuth(app);
            googleProvider = new GoogleAuthProvider();
            
            console.log('⚠️ Using fallback Firebase configuration');
            return false;
        } catch (fallbackError) {
            console.error('❌ Fallback Firebase initialization also failed:', fallbackError);
            return false;
        }
    }
}

// Initialize immediately
initializeFirebase();

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
    browserLocalPersistence,
    initializeFirebase
};