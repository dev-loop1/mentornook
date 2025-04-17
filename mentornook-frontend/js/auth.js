document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // --- Login Form Handling ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors(loginForm);
            const loginButton = loginForm.querySelector('button[type="submit"]');
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            // --- Frontend Validation ---
            let isValid = true;
            if (isEmpty(email) || !validateEmail(email)) {
                showError('email-error', 'Please enter a valid email address.');
                isValid = false;
            }
            if (isEmpty(password)) {
                showError('password-error', 'Please enter your password.');
                isValid = false;
            }

            if (!isValid) {
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                return;
            }
            // --- End Validation ---

            // --- Call Backend API ---
            try {
                // **FIXED:** Endpoint URL, data payload (use email as username), requiresAuth: false
                const response = await WorkspaceApi(
                    '/login/', // Added trailing slash
                    'POST',
                    { username: email, password: password }, // Send email as username
                    false // Login does not require auth
                );

                // **FIXED:** Check response.success and access response.data
                if (response.success && response.data.token) {
                    // Backend sends token and user info nested in 'data'
                    saveAuthInfo(response.data.token, response.data.user);
                    window.location.href = 'dashboard.html'; // Redirect after successful login
                } else {
                    // **FIXED:** Use response.error
                    showGeneralError('login-general-error', response.error || 'Login failed. Please check credentials.');
                    loginButton.disabled = false;
                    loginButton.textContent = 'Login';
                }
            } catch (error) { // Catch potential errors from WorkspaceApi itself (e.g., network)
                console.error("Login error:", error);
                // **FIXED:** Use error.message if available, fallback
                showGeneralError('login-general-error', error.message || 'An unexpected error occurred. Please try again later.');
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
            // --- End API Call ---
        });
    }

    // --- Signup Form Handling ---
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors(signupForm);
            const signupButton = signupForm.querySelector('button[type="submit"]');
            signupButton.disabled = true;
            signupButton.textContent = 'Signing up...';

            const fullname = document.getElementById('signup-fullname').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            // --- Frontend Validation ---
            let isValid = true;
            if (isEmpty(fullname)) {
                showError('fullname-error', 'Please enter your full name.');
                isValid = false;
            }
            if (isEmpty(email) || !validateEmail(email)) {
                showError('email-error', 'Please enter a valid email address.');
                isValid = false;
            }
            if (isEmpty(password) || !validatePassword(password)) {
                showError('password-error', 'Password must be at least 8 characters long.');
                isValid = false;
            }
            if (password !== confirmPassword) {
                showError('confirm-password-error', 'Passwords do not match.');
                isValid = false;
            }

            if (!isValid) {
                signupButton.disabled = false;
                signupButton.textContent = 'Sign Up';
                return;
            }
            // --- End Validation ---

            // --- Prepare Registration Data for Backend ---
            // **FIXED:** Create data object matching UserRegistrationSerializer fields
            const registrationData = {
                username: email, // Use email as username (or prompt user for a separate username)
                email: email,
                password: password,
                 // Simple split of fullname - adjust if needed
                first_name: fullname.split(' ')[0] || '',
                last_name: fullname.split(' ').slice(1).join(' ') || ''
            };
            // --- End Data Preparation ---


            // --- Call Backend API for Registration ---
            try {
                // **FIXED:** Endpoint URL, pass prepared registrationData
                const response = await WorkspaceApi('/register/', 'POST', registrationData, false); // Register does not require auth

                // **FIXED:** Check response.success
                if (response.success) {
                    // Registration successful, now try to automatically log in
                    console.log('Registration successful. Attempting auto-login...');
                    try {
                         // **FIXED:** Use correct login payload (username: email) and requiresAuth: false
                         const loginResponse = await WorkspaceApi('/login/', 'POST', { username: email, password: password }, false);

                         // **FIXED:** Check loginResponse.success and access data correctly
                         if (loginResponse.success && loginResponse.data.token) {
                             saveAuthInfo(loginResponse.data.token, loginResponse.data.user);
                             window.location.href = 'profile_setup.html'; // Redirect to profile setup
                         } else {
                             // Auto-login failed after successful registration
                             console.error("Auto-login failed:", loginResponse.error);
                             // **FIXED:** Use loginResponse.error
                             showGeneralError('signup-general-error', `Registration successful, but auto-login failed: ${loginResponse.error || 'Please log in manually.'}`);
                             signupButton.disabled = false;
                             signupButton.textContent = 'Sign Up';
                             // Redirect to login page so user can log in manually
                             // setTimeout(() => { window.location.href = 'login.html'; }, 3000); // Optional delay
                         }
                    } catch(loginError) {
                         console.error("Error during auto-login attempt:", loginError);
                          showGeneralError('signup-general-error', `Registration successful, but auto-login failed: ${loginError.message || 'Please log in manually.'}`);
                          signupButton.disabled = false;
                          signupButton.textContent = 'Sign Up';
                    }

                } else {
                    // Registration itself failed
                    // **FIXED:** Use response.error
                    // Extract specific field errors if backend provides them (e.g., email already exists)
                    let errorMessage = response.error || 'Registration failed. Please try again.';
                    if (response.data && typeof response.data === 'object') {
                        // Attempt to show specific field errors from DRF serializers
                         if (response.data.username) errorMessage = `Username: ${response.data.username.join(', ')}`;
                         else if (response.data.email) errorMessage = `Email: ${response.data.email.join(', ')}`;
                         else if (response.data.password) errorMessage = `Password: ${response.data.password.join(', ')}`;
                    }
                    showGeneralError('signup-general-error', errorMessage);
                    signupButton.disabled = false;
                    signupButton.textContent = 'Sign Up';
                }
            } catch (error) { // Catch potential errors from WorkspaceApi itself (e.g., network)
                console.error("Signup error:", error);
                 // **FIXED:** Use error.message if available, fallback
                showGeneralError('signup-general-error', error.message || 'An unexpected error occurred. Please try again later.');
                signupButton.disabled = false;
                signupButton.textContent = 'Sign Up';
            }
             // --- End API Call ---
        });
    }

    // --- Logout Handling (Example - trigger this from a button click in main.js/header) ---
    // This function could be called by an event listener elsewhere
    async function handleLogout() {
        console.log("Attempting logout...");
        try {
            // Logout doesn't need data, but requires auth token
            const response = await WorkspaceApi('/logout/', 'POST', null, true);

            // Even if logout fails server-side (e.g., token already invalid), clear client-side
            if (!response.success) {
                 console.warn("Server logout failed (maybe token was already invalid?):", response.error);
            }
        } catch (error) {
            console.error("Error during logout API call:", error);
        } finally {
            // Always clear local storage and redirect on logout attempt
             clearAuthInfo();
             window.location.href = 'login.html';
        }
    }
    // Example: Attach to a button if it exists directly on auth pages (unlikely)
    // const logoutButton = document.getElementById('logout-button');
    // if (logoutButton) logoutButton.addEventListener('click', handleLogout);

}); // End DOMContentLoaded