import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFCQeV757IXl4_UgN47Gr3Q_xSwJb2Asw",
  authDomain: "catgroup-8d0bb.firebaseapp.com",
  projectId: "catgroup-8d0bb",
  storageBucket: "catgroup-8d0bb.firebasestorage.app",
  messagingSenderId: "733358557637",
  appId: "1:733358557637:web:2ebe75b505d0c6bc5e63ac",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export default app;