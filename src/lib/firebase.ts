import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Public Firebase web config (project fahampesa-8c514). These keys are not secret —
// they identify the project to Google's auth servers. All real authorization happens
// server-side via the Firebase ID token the backend verifies.
const firebaseConfig = {
  apiKey: "AIzaSyDpY3OgTpdlVR5dNIWw36ZOzTllPtOqNFk",
  authDomain: "fahampesa-8c514.firebaseapp.com",
  projectId: "fahampesa-8c514",
  storageBucket: "fahampesa-8c514.firebasestorage.app",
  messagingSenderId: "97127182300",
  appId: "1:97127182300:web:4e20292f842ef99229e919",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
