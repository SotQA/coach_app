import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAV9aev_MqnIgDhIrV3t4roHmHVREv5Moc",
  authDomain: "gym-coach-app-3a18a.firebaseapp.com",
  projectId: "gym-coach-app-3a18a",
  storageBucket: "gym-coach-app-3a18a.firebasestorage.app",
  messagingSenderId: "915193499412",
  appId: "1:915193499412:web:74956934752ed456d07c01",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);