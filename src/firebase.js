// Simulated Firebase Authentication wrapper
// Ready to be replaced by actual Firebase config keys when deploying to production

const config = {
  apiKey: "MOCK_FIREBASE_API_KEY_AZNET",
  authDomain: "aznet-offline-dashboard.firebaseapp.com",
  projectId: "aznet-offline-dashboard",
  storageBucket: "aznet-offline-dashboard.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:mockappid123"
};

// Simulation Layer for Offline Sandboxed Testing
const authStateListeners = [];
let currentUser = null;

// Initialize from LocalStorage
try {
  const cachedUser = localStorage.getItem('aznet_auth_user');
  if (cachedUser) {
    currentUser = JSON.parse(cachedUser);
  }
} catch (e) {
  console.warn("Could not read auth user from localStorage", e);
}

const triggerListeners = (user) => {
  currentUser = user;
  authStateListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error("Error in onAuthStateChanged listener callback", e);
    }
  });
};

export const auth = {
  currentUser,
  config
};

export const onAuthStateChanged = (callback) => {
  authStateListeners.push(callback);
  // Trigger callback immediately with current user state
  callback(currentUser);
  return () => {
    const idx = authStateListeners.indexOf(callback);
    if (idx !== -1) authStateListeners.splice(idx, 1);
  };
};

export const createUserWithEmailAndPassword = async (email, password) => {
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 800));

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  if (password.length < 6) {
    throw new Error("Password should be at least 6 characters.");
  }

  const usersKey = 'aznet_simulated_users';
  let users = [];
  try {
    const cachedUsers = localStorage.getItem(usersKey);
    if (cachedUsers) users = JSON.parse(cachedUsers);
  } catch (e) {
    users = [];
  }

  // Check if exists
  const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    throw new Error("auth/email-already-in-use: The email address is already in use by another account.");
  }

  const newUser = {
    uid: 'sim-' + Math.random().toString(36).substr(2, 9),
    email,
    displayName: email.split('@')[0],
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(usersKey, JSON.stringify(users));
  localStorage.setItem('aznet_auth_user', JSON.stringify(newUser));

  triggerListeners(newUser);
  return { user: newUser };
};

export const signInWithEmailAndPassword = async (email, password) => {
  await new Promise(resolve => setTimeout(resolve, 800));

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const usersKey = 'aznet_simulated_users';
  let users = [];
  try {
    const cachedUsers = localStorage.getItem(usersKey);
    if (cachedUsers) users = JSON.parse(cachedUsers);
  } catch (e) {
    users = [];
  }

  // If empty, automatically register the first user for convenience
  if (users.length === 0) {
    const defaultUser = {
      uid: 'sim-default',
      email: email,
      displayName: email.split('@')[0],
      createdAt: new Date().toISOString()
    };
    users.push(defaultUser);
    localStorage.setItem(usersKey, JSON.stringify(users));
  }

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error("auth/user-not-found: There is no user record corresponding to this identifier.");
  }

  // Mock Password Check: Allow any password >= 6 chars for testing, otherwise check length
  if (password.length < 6) {
    throw new Error("auth/wrong-password: The password is invalid or the user does not have a password.");
  }

  localStorage.setItem('aznet_auth_user', JSON.stringify(user));
  triggerListeners(user);
  return { user };
};

export const signOut = async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  localStorage.removeItem('aznet_auth_user');
  triggerListeners(null);
  return true;
};
