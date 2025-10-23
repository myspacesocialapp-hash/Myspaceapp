// --- NOTE: Firebase Imports are loaded via script tags in the <head> to avoid CSP issues. ---

// Helper to access individual functions easily (from global Firebase objects)
const initializeApp = firebase.initializeApp;
const authModule = firebase.auth;
const firestoreModule = firebase.firestore;

// Destructured Firebase Auth functions
const getAuth = authModule.getAuth;
const onAuthStateChanged = authModule.onAuthStateChanged;
const createUserWithEmailAndPassword = authModule.createUserWithEmailAndPassword;
const signInWithEmailAndPassword = authModule.signInWithEmailAndPassword;
const signOut = authModule.signOut;
const sendEmailVerification = authModule.sendEmailVerification;
const sendPasswordResetEmail = authModule.sendPasswordResetEmail;

// Destructured Firebase Firestore functions
const getFirestore = firestoreModule.getFirestore;
const collection = firestoreModule.collection;
const doc = firestoreModule.doc;
const serverTimestamp = firestoreModule.serverTimestamp;
const setDoc = firestoreModule.setDoc;
const getDoc = firestoreModule.getDoc;
const updateDoc = firestoreModule.updateDoc;
const arrayUnion = firestoreModule.arrayUnion;
// Add more Firestore functions as we need them in later steps

// ===================================================================================
// --- FIREBASE CONFIG ---
// ===================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyClhomaPlXVrk_xeD0_jXHx3x1IPzvHH0s",
    authDomain: "my-space-app-9d39e.firebaseapp.com",
    projectId: "my-space-app-9d39e",
    storageBucket: "my-space-app-9d39e.firebasestorage.app",
    messagingSenderId: "567017323339",
    appId: "1:567017323339:web:78cb093d20e6090da806ce"
};

// ===================================================================================
// --- CLOUDINARY CONFIG (Not used in Step 1, but ready for Step 2) ---
// ===================================================================================
const CLOUD_NAME = "deobpcudu";
const UPLOAD_PRESET = "myuploads";

// ===================================================================================
// --- ADMIN CONFIG ---
// ===================================================================================
const ADMIN_UID = "Etkvuh7LqDeT12Pj9TPGqjGQSix2"; // <-- PASTE YOUR ACTUAL ADMIN UID HERE ONCE YOU SIGN UP!
// ===================================================================================

// --- GLOBAL VARIABLES & STATE ---
let auth, db, currentUserId, currentUserData;
let currentLang = 'en';
let isSignupMode = false;
// Listener unsubscribers
let unsubscribeUser;

// --- DOM ELEMENT SELECTORS ---
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Containers
const authContainer = $('#auth-container');
const appContainer = $('#app-container');
const loadingOverlay = $('#loading-overlay');
const bottomNav = $('#bottom-nav');

// Modals
const alertModal = $('#alert-modal');
const forgotPasswordModal = $('#forgot-password-modal');

// --- TRANSLATION (LANGUAGE) SYSTEM ---
const translations = {
     'en': {
         'login_title': 'Welcome Back', 'login_subtitle': 'Login to connect.', 'signup_title': 'Create Account', 'signup_subtitle': 'Join the community.',
         'nav_feed': 'Feed', 'nav_friends': 'People', 'nav_messages': 'Messages', 'nav_profile': 'Profile',
         'placeholder_firstname': 'First Name', 'placeholder_surname': 'Surname', 'placeholder_dob': 'Date of Birth',
         'gender_male': 'Male', 'gender_female': 'Female', 'placeholder_username': 'Choose a Username', 'placeholder_email': 'Email Address', 'placeholder_password': 'Password (min. 6 characters)',
         'btn_login': 'Login', 'btn_signup': 'Sign Up', 'toggle_signup': "Don't have an account?", 'toggle_login': 'Already have an account?',
         'btn_ok': 'OK', 'btn_cancel': 'Cancel',
         'email_verification_sent': 'Verification email sent! Check your inbox (and spam folder).',
         'forgot_password': 'Forgot Password?', 'send_reset_link': 'Send Reset Link', 'reset_password_title': 'Reset Password', 'reset_password_instructions': "Enter your email address and we'll send you a link to reset your password.",
         'error_invalid_email': 'Please enter a valid email address.', 'error_weak_password': 'Password must be at least 6 characters.', 'error_missing_email_pass': 'Email and password are required.',
         'error_login_failed': 'Incorrect email or password.', 'error_email_in_use': 'This email is already registered. Please login.', 'error_missing_password': 'Please enter your password.',
         'error_generic_auth': 'An authentication error occurred.', 'error_password_reset': 'Could not send reset email. Please try again.', 'error_user_not_found': 'No account found with that email address.',
         'error_signup_incomplete': 'Sign-up form incomplete. Please fill all fields.', 'error_username_short': 'Username must be at least 3 characters.', 'error_names_required': 'First and Last name are required.', 'error_dob_required': 'Date of Birth is required.',
     },
     'yo': { /* Yoruba translations ... */ },
     'fr': { /* French translations ... */ }
};

const translatePage = () => {
     if (!document.body) return;
     try {
         const langDict = translations[currentLang] || translations['en'];
         $$('[data-lang-key]').forEach(el => {
             const key = el.dataset.langKey;
             if (langDict[key]) {
                 if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                     if (el.type !== 'date') { el.placeholder = langDict[key]; }
                 } else if (el.tagName === 'OPTION') { /* Skip */ }
                 else { el.innerHTML = langDict[key]; }
             }
         });
         // Update selects
         const langSelectAuth = $('#lang-select-auth'); if (langSelectAuth) langSelectAuth.value = currentLang;
         // Update static text
         const forgotLink = $('#forgot-password-link'); if (forgotLink) forgotLink.textContent = langDict['forgot_password'] || 'Forgot Password?';
         const forgotTitle = $('#forgot-password-modal h3'); if (forgotTitle) forgotTitle.textContent = langDict['reset_password_title'] || 'Reset Password';
         const forgotInstr = $('#forgot-password-modal p:first-of-type'); if (forgotInstr) forgotInstr.textContent = langDict['reset_password_instructions'] || 'Enter your email...';
         const forgotSendBtn = $('#forgot-send-btn'); if (forgotSendBtn) forgotSendBtn.textContent = langDict['send_reset_link'] || 'Send Reset Link';
     } catch (e) {
         console.error("Translation error:", e);
     }
};

const setLanguage = async (lang) => {
    if (!translations[lang]) lang = 'en';
    currentLang = lang;
    localStorage.setItem('my-space-lang', lang);
    if (currentUserId && db) {
        try {
            const userDocRef = doc(db, 'users', currentUserId);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) { await updateDoc(userDocRef, { preferredLanguage: lang }); }
        } catch (e) { console.error("Could not save language preference:", e); }
    }
    translatePage();
};

// --- HELPER FUNCTIONS ---
const showLoader = () => { if(loadingOverlay) loadingOverlay.classList.remove('hidden'); }
const hideLoader = () => { if(loadingOverlay) loadingOverlay.classList.add('hidden'); }
const showAlert = (messageKey, fallbackMessage = 'An error occurred.') => {
     const message = translations[currentLang][messageKey] || fallbackMessage;
    const msgEl = $('#alert-message');
    if (msgEl) msgEl.textContent = message;
    showModal(alertModal);
};
const showModal = (modalEl) => { if(modalEl) modalEl.classList.remove('hidden'); };
const hideModal = (modalEl) => { if(modalEl) modalEl.classList.add('hidden'); };

// --- APP INITIALIZATION ---
function init() {
    console.log("App initializing...");
    showLoader();
    const savedLang = localStorage.getItem('my-space-lang') || 'en';
    setLanguage(savedLang);
    renderAuthPage(); // Render auth structure first

    try {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
        setupAuthListeners(); // This handles showing content/hiding loader
        setupModalListeners();
        // Nav listeners will be added in Step 2
    } catch (error) {
        console.error("Firebase Init Error:", error);
        if (authContainer) authContainer.innerHTML = `<div class="card p-4 text-center error-text">Could not connect. Check console & config.</div>`;
        hideLoader();
    }
}

// --- AUTHENTICATION ---
function setupAuthListeners() {
     onAuthStateChanged(auth, user => {
         if (unsubscribeUser) { unsubscribeUser(); unsubscribeUser = null; }

         if (user) {
             console.log("User logged IN:", user.uid, "Verified:", user.emailVerified);
             currentUserId = user.uid;
             listenToUserData((initialLoad) => {
                 if (initialLoad) {
                     console.log("Initial user data loaded, showing app UI.");
                     authContainer.classList.remove('active');
                     appContainer.classList.add('active');
                     bottomNav.classList.remove('hidden');
                     bottomNav.classList.add('flex');
                     // In Step 1, appContainer is empty, but this is the correct flow
                     hideLoader();
                 }
             });
         } else { // User is logged OUT
             console.log("User logged OUT");
             currentUserId = null;
             currentUserData = null;
             authContainer.classList.add('active');
             appContainer.classList.remove('active');
             bottomNav.classList.add('hidden');
             bottomNav.classList.remove('flex');
             renderAuthPage(); // Re-render auth page
             hideLoader();
         }
     }, (error) => {
          console.error("Auth State Error:", error);
          authContainer.innerHTML = `<div class="card p-4 text-center error-text">Authentication error. Please refresh.</div>`;
          authContainer.classList.add('active');
          appContainer.classList.remove('active');
          bottomNav.classList.add('hidden');
          bottomNav.classList.remove('flex');
          hideLoader();
     });
}

const handleAuthAction = async () => {
     const emailInput = $('#email');
     const passwordInput = $('#password');
     const authErrorEl = $('#auth-error');

     if (!emailInput || !passwordInput || !authErrorEl) return;

     const email = emailInput.value.trim(), password = passwordInput.value;
     authErrorEl.textContent = '';

     if (!email || !password) { authErrorEl.textContent = translations[currentLang]['error_missing_email_pass']; return; }
     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { authErrorEl.textContent = translations[currentLang]['error_invalid_email']; return; }

     showLoader();
     try {
         if (isSignupMode) {
             const usernameInput = $('#username');
             const firstNameInput = $('#firstName');
             const surnameInput = $('#surname');
             const dobInput = $('#dob');
             const genderInput = $('input[name="gender"]:checked');

             if (!usernameInput || !firstNameInput || !surnameInput || !dobInput || !genderInput) {
                  throw new Error(translations[currentLang]['error_signup_incomplete']);
             }

             const username = usernameInput.value.trim();
             const firstName = firstNameInput.value.trim();
             const surname = surnameInput.value.trim();
             const dob = dobInput.value;
             const gender = genderInput.value;

             if (username.length < 3) throw new Error(translations[currentLang]['error_username_short']);
             if (!firstName || !surname) throw new Error(translations[currentLang]['error_names_required']);
             if (!dob) throw new Error(translations[currentLang]['error_dob_required']);
             if (password.length < 6) throw new Error(translations[currentLang]['error_weak_password']);

             const userCredential = await createUserWithEmailAndPassword(auth, email, password);
             const userDocRef = doc(db, 'users', userCredential.user.uid);

             const newUserProfile = {
                 username: username, email: email, firstName: firstName, surname: surname,
                 dob: dob, gender: gender,
                 profilePictureUrl: `https://placehold.co/100x100/374151/E7E9EA?text=${username.charAt(0).toUpperCase()}`,
                 preferredLanguage: currentLang,
                 friends: [], friendRequests: [], friendRequestsSent: [],
                 following: ADMIN_UID && ADMIN_UID !== userCredential.user.uid && ADMIN_UID.length > 5 ? [ADMIN_UID] : [],
                 followers: ADMIN_UID && ADMIN_UID !== userCredential.user.uid && ADMIN_UID.length > 5 ? [ADMIN_UID] : [],
                 isVerified: false, role: 'user'
             };
             await setDoc(userDocRef, newUserProfile);

             // Make admin follow back
             if (ADMIN_UID && ADMIN_UID !== userCredential.user.uid && ADMIN_UID.length > 5) {
                 try {
                     const adminRef = doc(db, 'users', ADMIN_UID);
                      await updateDoc(adminRef, {
                         following: arrayUnion(userCredential.user.uid),
                         followers: arrayUnion(userCredential.user.uid)
                      }).catch(err => console.warn("Could not make admin follow user:", err));
                 } catch (adminFollowError) { console.warn("Error making admin follow user:", adminFollowError); }
             }

             try {
                  await sendEmailVerification(userCredential.user);
                  showAlert('email_verification_sent');
             } catch(emailError){
                  console.error("Error sending verification email:", emailError);
                  showAlert('Verification email could not be sent.');
             }

         } else { // Login Mode
             await signInWithEmailAndPassword(auth, email, password);
         }
     } catch (error) {
         console.error("Auth Action Error:", error);
         let messageKey = 'error_generic_auth';
         if (error.code) { messageKey = `error_${error.code.replace('auth/', '').replace(/-/g, '_')}`; }
         
         if (error.code === 'auth/email-already-in-use') messageKey = 'error_email_in_use';
         else if (error.code === 'auth/invalid-email') messageKey = 'error_invalid_email';
         else if (error.code === 'auth/weak-password') messageKey = 'error_weak_password';
         else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') messageKey = 'error_login_failed';
         else if (error.code === 'auth/missing-password') messageKey = 'error_missing_password';

         if (authErrorEl) authErrorEl.textContent = translations[currentLang][messageKey] || error.message;
         hideLoader();
     }
};

const toggleAuthMode = () => {
     isSignupMode = !isSignupMode;
     renderAuthPage();
};

const handleForgotPassword = async () => {
     const emailInput = $('#forgot-email-input');
     const errorEl = $('#forgot-error');
     if (!emailInput || !errorEl) return;
     const email = emailInput.value.trim();
     errorEl.textContent = '';

     if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
         errorEl.textContent = translations[currentLang]['error_invalid_email'];
         return;
     }

     showLoader();
     try {
         await sendPasswordResetEmail(auth, email);
         hideModal(forgotPasswordModal);
         showAlert('Password reset email sent! Check your inbox (and spam).');
     } catch (error) {
         console.error("Forgot Password Error:", error);
          let messageKey = 'error_password_reset';
          if(error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email'){ messageKey = 'error_user_not_found'; }
         errorEl.textContent = translations[currentLang][messageKey] || error.message;
     } finally {
         hideLoader();
     }
};

// --- DATA LISTENERS ---
function listenToUserData(callback = null) {
    if (unsubscribeUser) unsubscribeUser();
    if (!currentUserId || !db) return;
    let isInitialLoad = true;
    const userDocRef = doc(db, 'users', currentUserId);
    console.log("Listening to User Doc:", currentUserId);
    unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            console.log("User data received:", doc.data());
            currentUserData = { id: doc.id, ...doc.data() };
            if (currentUserData.preferredLanguage && currentUserData.preferredLanguage !== currentLang) {
                setLanguage(currentUserData.preferredLanguage);
            }
            if(callback && isInitialLoad) {
                 console.log("Executing initial load callback.");
                 callback(true); // Signal initial load complete
                 isInitialLoad = false;
            }
        } else {
             console.warn("Current user document NOT FOUND:", currentUserId);
             if(auth.currentUser) { signOut(auth); } // Log out if user doc is missing
        }
    }, (error) => { console.error("Error listening to user data:", error); showAlert('error_generic_auth'); });
}

// --- RENDER FUNCTIONS ---
function renderAuthPage() {
    if (!authContainer) return;
    authContainer.innerHTML = `
    <div class="relative w-full max-w-sm">
        <div class="absolute top-0 right-0 p-2 z-10">
            <select id="lang-select-auth" class="bg-gray-700 text-white text-sm font-medium rounded p-1 border border-gray-600">
                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>EN</option>
                <option value="yo" ${currentLang === 'yo' ? 'selected' : ''}>YO</option>
                <option value="fr" ${currentLang === 'fr' ? 'selected' : ''}>FR</option>
            </select>
        </div>

        <div class="bg-gray-800 p-8 pt-16 rounded-2xl shadow-xl relative border border-gray-700">
            <div class="text-center mb-6">
                <i class="ph-bold ph-planet text-5xl text-blue-500"></i>
                <h1 id="auth-title" class="text-2xl font-bold text-gray-100 mt-2" data-lang-key="${isSignupMode ? 'signup_title' : 'login_title'}"></h1>
                <p id="auth-subtitle" class="text-gray-400" data-lang-key="${isSignupMode ? 'signup_subtitle' : 'login_subtitle'}"></p>
            </div>
            <form id="auth-form" class="space-y-4">
                ${isSignupMode ? `
                <div class="grid grid-cols-2 gap-4">
                    <div><input type="text" id="firstName" data-lang-key="placeholder_firstname" required></div>
                    <div><input type="text" id="surname" data-lang-key="placeholder_surname" required></div>
                </div>
                <div><input type="text" id="username" data-lang-key="placeholder_username" required></div>
                <div><input type="date" id="dob" data-lang-key="placeholder_dob" placeholder="Date of Birth" required class="w-full appearance-none" max="${new Date().toISOString().split("T")[0]}"></div>
                <div class="text-gray-400 text-sm flex items-center gap-4">
                    <span>Gender:</span>
                    <label class="flex items-center"><input type="radio" name="gender" value="male" class="mr-1" required> <span data-lang-key="gender_male">Male</span></label>
                    <label class="flex items-center"><input type="radio" name="gender" value="female" class="mr-1"> <span data-lang-key="gender_female">Female</span></label>
                </div>
                ` : ''}
                <div><input type="email" id="email" data-lang-key="placeholder_email" required></div>
                <div><input type="password" id="password" data-lang-key="placeholder_password" required></div>
                <p id="auth-error" class="error-text text-sm h-4"></p>
                <button id="auth-button" type="submit" class="w-full btn btn-primary py-3" data-lang-key="${isSignupMode ? 'btn_signup' : 'btn_login'}"></button>
            </form>
            ${!isSignupMode ? `
            <div class="text-center mt-3">
                 <button id="forgot-password-link" type="button" class="link-style" data-lang-key="forgot_password">Forgot Password?</button>
            </div>
            ` : ''}
            <p class="text-center text-sm text-gray-400 pt-4">
                <span data-lang-key="${isSignupMode ? 'toggle_login' : 'toggle_signup'}"></span>
                <a href="#" id="auth-toggle-link" class="font-semibold text-blue-500 hover:underline">${isSignupMode ? (translations[currentLang]?.btn_login || 'Login') : (translations[currentLang]?.btn_signup || 'Sign Up')}</a>
            </p>
        </div>
    </div>`;
    translatePage();
    // Add listeners
    const authForm = $('#auth-form'); if(authForm) authForm.addEventListener('submit', (e) => { e.preventDefault(); handleAuthAction(); });
    const toggleLink = $('#auth-toggle-link'); if(toggleLink) toggleLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    const langSelect = $('#lang-select-auth'); if(langSelect) langSelect.addEventListener('change', (e) => setLanguage(e.target.value));
    const forgotLink = $('#forgot-password-link'); if(forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); showModal(forgotPasswordModal); });
}

// --- GLOBAL EVENT LISTENERS ---
function setupModalListeners() {
     // Alert
     $('#alert-ok-btn')?.addEventListener('click', () => hideModal(alertModal));
     // Forgot Password (This was the missing listener)
     $('#forgot-cancel-btn')?.addEventListener('click', () => hideModal(forgotPasswordModal));
     $('#forgot-send-btn')?.addEventListener('click', handleForgotPassword);
     // Other modals will be added in Step 2
}

// We will add the other listeners (nav, page content) in Step 2
function setupNavListeners() { /* ... Empty for Step 1 ... */ }

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', init);

</script>
</body>
</html>
