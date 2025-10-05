/**
 * FirebaseService - Abstração para operações Firebase
 * Centraliza todas as operações do Firebase
 */
import { db, auth, googleProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, orderBy } from '../firebase.js';

export class FirebaseService {
    constructor() {
        try {
            this.db = db;
            this.auth = auth;
            this.googleProvider = googleProvider;
            
            // Expose functions for easy access
            this.collection = collection;
            this.doc = doc;
            this.query = query;
            this.where = where;
            this.getDocs = getDocs;
            this.orderBy = orderBy;
            
            // Enable auth persistence
            this.auth.setPersistence && this.auth.setPersistence('local');
            
            console.log('🔥 FirebaseService initialized');
        } catch (error) {
            console.error('❌ FirebaseService initialization failed:', error);
            throw error;
        }
    }

    // Auth Methods
    
    /**
     * Set up auth state change listener
     */
    onAuthStateChanged(callback) {
        return this.auth.onAuthStateChanged(callback);
    }

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        return await signInWithPopup(this.auth, this.googleProvider);
    }

    /**
     * Sign in with email and password
     */
    async signInWithEmail(email, password) {
        return await signInWithEmailAndPassword(this.auth, email, password);
    }

    /**
     * Create user with email and password
     */
    async signUpWithEmail(email, password) {
        return await createUserWithEmailAndPassword(this.auth, email, password);
    }

    /**
     * Sign out current user
     */
    async signOut() {
        return await signOut(this.auth);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.auth.currentUser;
    }

    // Firestore Methods - Users

    /**
     * Get user profile
     */
    async getUserProfile(userId) {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            return userDoc.exists() ? userDoc.data() : null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    }

    /**
     * Create user profile
     */
    async createUserProfile(userId, userData) {
        try {
            await setDoc(doc(this.db, 'users', userId), {
                ...userData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error creating user profile:', error);
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateUserProfile(userId, updates) {
        try {
            await updateDoc(doc(this.db, 'users', userId), {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }

    // Firestore Methods - Championships

    /**
     * Create championship
     */
    async createChampionship(championshipData) {
        try {
            const docRef = doc(collection(this.db, 'championships'));
            await setDoc(docRef, {
                ...championshipData,
                id: docRef.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating championship:', error);
            throw error;
        }
    }

    /**
     * Get championship by ID
     */
    async getChampionship(championshipId) {
        try {
            const championshipDoc = await getDoc(doc(this.db, 'championships', championshipId));
            return championshipDoc.exists() ? { id: championshipDoc.id, ...championshipDoc.data() } : null;
        } catch (error) {
            console.error('Error getting championship:', error);
            throw error;
        }
    }

    /**
     * Update championship
     */
    async updateChampionship(championshipId, updates) {
        try {
            await updateDoc(doc(this.db, 'championships', championshipId), {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating championship:', error);
            throw error;
        }
    }

    /**
     * Delete championship
     */
    async deleteChampionship(championshipId) {
        try {
            await deleteDoc(doc(this.db, 'championships', championshipId));
        } catch (error) {
            console.error('Error deleting championship:', error);
            throw error;
        }
    }

    /**
     * Get championships with real-time updates
     */
    onChampionshipsSnapshot(callback, filters = {}) {
        let championshipsQuery = collection(this.db, 'championships');

        // Apply filters
        if (filters.userId) {
            championshipsQuery = query(championshipsQuery, where('userId', '==', filters.userId));
        }

        if (filters.isPublic !== undefined) {
            championshipsQuery = query(championshipsQuery, where('isPublic', '==', filters.isPublic));
        }

        // Add ordering
        championshipsQuery = query(championshipsQuery, orderBy('createdAt', 'desc'));

        return onSnapshot(championshipsQuery, (snapshot) => {
            const championships = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(championships);
        });
    }

    /**
     * Get all public championships
     */
    async getPublicChampionships() {
        try {
            const q = query(
                collection(this.db, 'championships'),
                where('isPublic', '==', true),
                orderBy('createdAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting public championships:', error);
            throw error;
        }
    }

    // Firestore Methods - Results

    /**
     * Save race result
     */
    async saveRaceResult(resultData) {
        try {
            const docRef = doc(collection(this.db, 'results'));
            await setDoc(docRef, {
                ...resultData,
                id: docRef.id,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error saving race result:', error);
            throw error;
        }
    }

    /**
     * Get race results with real-time updates
     */
    onResultsSnapshot(championshipId, callback) {
        const resultsQuery = query(
            collection(this.db, 'results'),
            where('championshipId', '==', championshipId)
        );

        return onSnapshot(resultsQuery, (snapshot) => {
            const results = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!results[data.raceId]) {
                    results[data.raceId] = {};
                }
                results[data.raceId][data.driverId] = data;
            });
            callback(results);
        });
    }

    // Firestore Methods - Social

    /**
     * Create social post
     */
    async createPost(postData) {
        try {
            const docRef = doc(collection(this.db, 'posts'));
            await setDoc(docRef, {
                ...postData,
                id: docRef.id,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating post:', error);
            throw error;
        }
    }

    /**
     * Get posts with real-time updates
     */
    onPostsSnapshot(callback, filters = {}) {
        let postsQuery = collection(this.db, 'posts');

        // Apply filters
        if (filters.userId) {
            postsQuery = query(postsQuery, where('userId', '==', filters.userId));
        }

        if (filters.following && filters.following.length > 0) {
            postsQuery = query(postsQuery, where('userId', 'in', filters.following));
        }

        // Add ordering
        postsQuery = query(postsQuery, orderBy('createdAt', 'desc'));

        return onSnapshot(postsQuery, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(posts);
        });
    }

    /**
     * Update post (for likes, comments, etc.)
     */
    async updatePost(postId, updates) {
        try {
            await updateDoc(doc(this.db, 'posts', postId), {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating post:', error);
            throw error;
        }
    }

    /**
     * Delete post
     */
    async deletePost(postId) {
        try {
            await deleteDoc(doc(this.db, 'posts', postId));
        } catch (error) {
            console.error('Error deleting post:', error);
            throw error;
        }
    }

    // Generic Firestore Methods

    /**
     * Generic document creation
     */
    async createDocument(collectionName, data) {
        try {
            const docRef = doc(collection(this.db, collectionName));
            await setDoc(docRef, {
                ...data,
                id: docRef.id,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error(`Error creating document in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generic document update
     */
    async updateDocument(collectionName, documentId, updates) {
        try {
            await updateDoc(doc(this.db, collectionName, documentId), {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error(`Error updating document in ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generic document deletion
     */
    async deleteDocument(collectionName, documentId) {
        try {
            await deleteDoc(doc(this.db, collectionName, documentId));
        } catch (error) {
            console.error(`Error deleting document from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generic document get
     */
    async getDocument(collectionName, documentId) {
        try {
            const docSnapshot = await getDoc(doc(this.db, collectionName, documentId));
            return docSnapshot.exists() ? { id: docSnapshot.id, ...docSnapshot.data() } : null;
        } catch (error) {
            console.error(`Error getting document from ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generic collection query
     */
    async queryCollection(collectionName, filters = [], orderByField = 'createdAt', orderDirection = 'desc') {
        try {
            let q = collection(this.db, collectionName);

            // Apply filters
            filters.forEach(filter => {
                q = query(q, where(filter.field, filter.operator, filter.value));
            });

            // Add ordering
            if (orderByField) {
                q = query(q, orderBy(orderByField, orderDirection));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error querying collection ${collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Generic collection snapshot listener
     */
    onCollectionSnapshot(collectionName, callback, filters = [], orderByField = 'createdAt', orderDirection = 'desc') {
        let q = collection(this.db, collectionName);

        // Apply filters
        filters.forEach(filter => {
            q = query(q, where(filter.field, filter.operator, filter.value));
        });

        // Add ordering
        if (orderByField) {
            q = query(q, orderBy(orderByField, orderDirection));
        }

        return onSnapshot(q, (snapshot) => {
            const documents = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(documents);
        });
    }
}