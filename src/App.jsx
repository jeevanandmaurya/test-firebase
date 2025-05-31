import React, { useEffect, useState } from 'react';
import './App.css'; // Assuming you have some basic CSS

// Import Firestore functions
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Import setDoc for writing data

// Import Firebase Auth functions
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider, // Provider for Google Sign-In
  signInWithPopup, // Method for popup sign-in (e.g., Google)
  signInWithRedirect, // Method for redirect sign-in
  getRedirectResult // Method to handle redirect results
} from 'firebase/auth';

// Import your initialized Firebase services from firebase-config.js
import { db, auth } from './firebase-config';

function App() {
  const [user, setUser] = useState(null); // State to hold the authenticated user object
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState(''); // Messages for authentication status and errors
  const [userData, setUserData] = useState(null); // State to store specific user data fetched from Firestore

  // Function to fetch user-specific data from Firestore
  // Now accepts the full currentUserObject directly from onAuthStateChanged
  const fetchUserData = async (uid, currentUserObject) => {
    if (!uid) {
      console.log("No UID provided to fetch user data.");
      setAuthMessage("No user logged in to fetch data.");
      setUserData(null);
      return;
    }

    setAuthMessage(`Fetching data for UID: ${uid}...`);
    try {
      // Dynamically create the document reference using the user's UID
      // Assuming user profiles are stored in a collection named 'userProfiles'
      const userDocRef = doc(db, 'userProfiles', uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        console.log("User data from Firestore:", docSnap.data());
        setUserData(docSnap.data());
        setAuthMessage(`User data fetched for ${uid}. Check console.`);
      } else {
        console.log("No user profile found for this UID. Creating one...");
        // If no profile exists, create a basic one using the provided currentUserObject
        await setDoc(userDocRef, {
          uid: uid,
          email: currentUserObject.email || null, // Use email from currentUserObject
          displayName: currentUserObject.displayName || null, // Use display name from currentUserObject
          photoURL: currentUserObject.photoURL || null, // Use photo URL from currentUserObject
          createdAt: new Date(),
          score: 0 // Example initial data for a new user
        });
        const newDocSnap = await getDoc(userDocRef); // Re-fetch the newly created doc
        setUserData(newDocSnap.data());
        setAuthMessage(`New profile created and fetched for ${uid}.`);
      }
    } catch (error) {
      console.error("Error getting user document from Firestore:", error);
      setAuthMessage(`Firestore Data Error: ${error.message}`);
      setUserData(null); // Clear user data on error
    }
  };

  // useEffect to listen for authentication state changes and handle redirect results
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Update the user state with the current user object
      if (currentUser) {
        setAuthMessage(`Logged in as: ${currentUser.email || currentUser.displayName || 'Anonymous'}`);
        console.log("Current authenticated user UID:", currentUser.uid);

        // Call fetchUserData with the logged-in user's UID and the full currentUser object
        fetchUserData(currentUser.uid, currentUser);
      } else {
        setAuthMessage("Not logged in");
        console.log("User is logged out.");
        setUserData(null); // Clear user data when logged out
      }
    });

    // Handle redirect result immediately when the component mounts
    // This is crucial for signInWithRedirect to work correctly
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User was successfully signed in via redirect
          const user = result.user;
          setAuthMessage(`Successfully signed in with redirect: ${user.email || user.displayName}`);

          // Check if user already has a profile. If not, create it.
          const userDocRef = doc(db, 'userProfiles', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email || null,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              createdAt: new Date(),
              score: 0
            });
          }
          // The onAuthStateChanged listener will then pick up the user and fetch data
        }
      } catch (error) {
        setAuthMessage(`Redirect Sign In Error: ${error.message}`);
        console.error("Redirect Sign In Error:", error);
      }
    };

    handleRedirectResult(); // Call this on component mount

    // Cleanup function: unsubscribe from the auth state listener when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this effect runs only once on mount

  // --- Authentication Handlers ---

  const handleSignUp = async () => {
    setAuthMessage('Signing up...');
    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // After successful signup, immediately create their profile in Firestore
      await setDoc(doc(db, 'userProfiles', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email || null,
        displayName: userCredential.user.displayName || null,
        photoURL: userCredential.user.photoURL || null,
        createdAt: new Date(),
        score: 0
      });
      // The onAuthStateChanged listener will automatically update the UI
      // and set authMessage upon successful sign-up.
    } catch (error) {
      // Display specific error messages to the user
      setAuthMessage(`Sign Up Error: ${error.message}`);
      console.error("Sign Up Error:", error);
    }
  };

  const handleSignIn = async () => {
    setAuthMessage('Signing in...');
    try {
      // Sign in user with email and password
      await signInWithEmailAndPassword(auth, email, password);
      // The onAuthStateChanged listener will handle UI updates.
    } catch (error) {
      setAuthMessage(`Sign In Error: ${error.message}`);
      console.error("Sign In Error:", error);
    }
  };

  const handleGoogleSignInPopup = async () => {
    setAuthMessage('Signing in with Google (Popup)...');
    const provider = new GoogleAuthProvider(); // Create a new Google Auth provider
    try {
      // Sign in with Google using a popup window
      const result = await signInWithPopup(auth, provider);
      // Check if user already has a profile. If not, create it.
      const userDocRef = doc(db, 'userProfiles', result.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          uid: result.user.uid,
          email: result.user.email || null,
          displayName: result.user.displayName || null,
          photoURL: result.user.photoURL || null,
          createdAt: new Date(),
          score: 0
        });
      }
      // The onAuthStateChanged listener will handle UI updates.
    } catch (error) {
      // Handle Google Sign-In specific errors
      setAuthMessage(`Google Sign In Error (Popup): ${error.message}`);
      console.error("Google Sign In Error (Popup):", error);
    }
  };

 
  const handleGoogleSignInRedirect = async () => {
    setAuthMessage('Redirecting for Google Sign In...');
    const provider = new GoogleAuthProvider(); // Create a new Google Auth provider
    try {
      // Redirect to Google for sign-in
      await signInWithRedirect(auth, provider);
      // The page will redirect away. The getRedirectResult in useEffect will handle the return.
    } catch (error) {
      setAuthMessage(`Google Sign In Error (Redirect): ${error.message}`);
      console.error("Google Sign In Error (Redirect):", error);
    }
  };


  const handleSignOut = async () => {
    setAuthMessage('Signing out...');
    try {
      // Sign out the current user
      await signOut(auth);
      // The onAuthStateChanged listener will handle UI updates.
    } catch (error) {
      setAuthMessage(`Sign Out Error: ${error.message}`);
      console.error("Sign Out Error:", error);
    }
  };

  return (
    <>
      <div className="App">
        {/* Authentication Section */}
        <h2>Authentication</h2>
        {/* Display authentication messages */}
        {authMessage && <p style={{ color: user ? 'green' : 'red' }}>{authMessage}</p>}

        {!user ? ( // Render this block if no user is logged in
          <div className="auth-form">
            <h3>Sign Up / Sign In</h3>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
            />
            <input
              type="password"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
            <br />
            <button onClick={handleSignUp}>Sign Up (Email/Password)</button>
            <button onClick={handleSignIn}>Sign In (Email/Password)</button>
            <button onClick={handleGoogleSignInPopup}>Sign In with Google (Popup)</button>
            <button onClick={handleGoogleSignInRedirect}>Sign In with Google (Redirect)</button>
          </div>
        ) : ( // Render this block if a user IS logged in
          <div className="auth-status">
            <h3>Welcome!</h3>
            <p>You are logged in as: {user.email || user.displayName || 'Unknown User'}</p>
            {user.photoURL && <img src={user.photoURL} alt="User profile" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginTop: '10px' }} />}
            <br />
            <button onClick={handleSignOut}>Sign Out</button>

            {/* Display User-Specific Data */}
            <hr style={{ margin: '20px 0' }} />
            <h3>Your Profile Data:</h3>
            {userData ? (
              <pre style={{ color: 'black', textAlign: 'left', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px', overflowX: 'auto' }}>
                {JSON.stringify(userData, null, 2)}
              </pre>
            ) : (
              <p>No user data loaded yet or profile not found.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default App;