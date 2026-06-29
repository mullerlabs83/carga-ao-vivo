import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCyaVh1j-BT3LzMpJ5y74ZUjnIupPZVg",
  authDomain: "carga-ao-vivo.firebaseapp.com",
  databaseURL: "https://carga-ao-vivo-default-rtdb.firebaseio.com",
  projectId: "carga-ao-vivo",
  storageBucket: "carga-ao-vivo.firebasestorage.app",
  messagingSenderId: "499106630308",
  appId: "1:499106630308:web:91df6d20ff4df5a2bfb431",
};

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

export const db = getDatabase(app);