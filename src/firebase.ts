import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocFromServer,
  getDoc,
  getDocs
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  getDocFromServer,
  getDoc,
  getDocs
};
export type { User };

// No connection test needed here as it's handled in App.tsx components
