import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: 'AIzaSyArXIpsK1GfZyvP0LfWO72X-6TzzaSju70',
  authDomain: 'sales-control-6bd78.firebaseapp.com',
  projectId: 'sales-control-6bd78',
  storageBucket: 'sales-control-6bd78.firebasestorage.app',
  messagingSenderId: '122328251260',
  appId: '1:122328251260:web:880d3ecdd534f39e37c2f9',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
