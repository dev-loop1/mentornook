/**
 * auth.js
 * Handles user authentication logic: Login and Signup form submissions.
 * Interacts with the backend API via WorkspaceApi from utils.js.
 * Manages user session state via localStorage helpers from utils.js.
 */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  // --- Login Form Handling ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Prevent default form submission
      clearAllErrors(loginForm); // Clear previous validation errors

      const loginButton = loginForm.querySelector('button[type="submit"]');
      loginButton.disabled = true;
      loginButton.textContent = "Logging in...";

      // Get form values
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      // --- Simple Frontend Validation ---
      let isValid = true;
      if (isEmpty(email) || !validateEmail(email)) {
        showError("email-error", "Please enter a valid email address.");
        isValid = false;
      }
      if (isEmpty(password)) {
        showError("password-error", "Please enter your password.");
        isValid = false;
      }

      if (!isValid) {
        // Re-enable button if validation fails
        loginButton.disabled = false;
        loginButton.textContent = "Login";
        return;
      }
      // --- End Validation ---

      // --- API Call for Login ---
      try {
        // Call backend login endpoint (expects username=email)
        const response = await WorkspaceApi(
          "/login/",
          "POST",
          { username: email, password: password },
          false // Authentication not required for login itself
        );

        if (response.success && response.data.token) {
          // Login successful: save token/user info, redirect to dashboard
          saveAuthInfo(response.data.token, response.data.user);
          window.location.href = "dashboard.html";
        } else {
          // Login failed: show error message from backend or default
          showGeneralError(
            "login-general-error",
            response.error || "Login failed. Please check credentials."
          );
          loginButton.disabled = false;
          loginButton.textContent = "Login";
        }
      } catch (error) {
        // Handle network or other unexpected errors during API call
        console.error("Login error:", error); // Keep error logs for diagnosing production issues
        showGeneralError(
          "login-general-error",
          error.message ||
            "An unexpected error occurred. Please try again later."
        );
        loginButton.disabled = false;
        loginButton.textContent = "Login";
      }
      // --- End API Call ---
    });
  } // End if(loginForm)

  // --- Signup Form Handling ---
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Prevent default form submission
      clearAllErrors(signupForm); // Clear previous validation errors

      const signupButton = signupForm.querySelector('button[type="submit"]');
      signupButton.disabled = true;
      signupButton.textContent = "Signing up...";

      // Get form values
      const fullname = document.getElementById("signup-fullname").value;
      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const confirmPassword = document.getElementById(
        "signup-confirm-password"
      ).value;

      // --- Simple Frontend Validation ---
      let isValid = true;
      if (isEmpty(fullname)) {
        showError("fullname-error", "Please enter your full name.");
        isValid = false;
      }
      if (isEmpty(email) || !validateEmail(email)) {
        showError("email-error", "Please enter a valid email address.");
        isValid = false;
      }
      if (isEmpty(password) || !validatePassword(password)) {
        showError(
          "password-error",
          "Password must be at least 8 characters long."
        );
        isValid = false;
      }
      if (password !== confirmPassword) {
        showError("confirm-password-error", "Passwords do not match.");
        isValid = false;
      }

      if (!isValid) {
        // Re-enable button if validation fails
        signupButton.disabled = false;
        signupButton.textContent = "Sign Up";
        return;
      }
      // --- End Validation ---

      // --- Prepare Registration Data ---
      // Create data object matching backend UserRegistrationSerializer fields
      const registrationData = {
        username: email, // Using email as username for simplicity
        email: email,
        password: password,
        first_name: fullname.split(" ")[0] || "",
        last_name: fullname.split(" ").slice(1).join(" ") || "",
      };
      // --- End Data Preparation ---

      // --- API Call for Registration ---
      try {
        const response = await WorkspaceApi(
          "/register/",
          "POST",
          registrationData,
          false
        ); // Registration is public

        if (response.success) {
          // Registration successful, attempt auto-login for better UX
          try {
            const loginResponse = await WorkspaceApi(
              "/login/",
              "POST",
              { username: email, password: password },
              false
            );

            if (loginResponse.success && loginResponse.data.token) {
              // Auto-login successful
              saveAuthInfo(loginResponse.data.token, loginResponse.data.user);
              window.location.href = "profile_setup.html"; // Redirect to profile setup
            } else {
              // Auto-login failed after registration
              console.warn(
                "Auto-login failed after registration:",
                loginResponse.error
              ); // Keep useful warnings
              showGeneralError(
                "signup-general-error",
                `Registration successful, but auto-login failed: ${
                  loginResponse.error || "Please log in manually."
                }`
              );
              signupButton.disabled = false;
              signupButton.textContent = "Sign Up";
              // Consider redirecting to login page here after a short delay
              // setTimeout(() => { window.location.href = 'login.html'; }, 3000);
            }
          } catch (loginError) {
            // Exception during auto-login attempt
            console.error("Exception during auto-login attempt:", loginError); // Keep error logs
            showGeneralError(
              "signup-general-error",
              `Registration successful, but auto-login failed: ${
                loginError.message || "Please log in manually."
              }`
            );
            signupButton.disabled = false;
            signupButton.textContent = "Sign Up";
          }
        } else {
          // Registration API call itself failed
          // Attempt to parse specific field errors from backend response
          let errorMessage =
            response.error || "Registration failed. Please try again.";
          if (response.data && typeof response.data === "object") {
            const fieldErrors = Object.entries(response.data)
              .map(
                ([field, errors]) =>
                  `${field}: ${
                    Array.isArray(errors) ? errors.join(", ") : errors
                  }`
              )
              .join("; ");
            if (fieldErrors) errorMessage = fieldErrors;
          }
          showGeneralError("signup-general-error", errorMessage);
          signupButton.disabled = false;
          signupButton.textContent = "Sign Up";
        }
      } catch (error) {
        // Handle network or other unexpected errors during registration API call
        console.error("Signup error:", error); // Keep error logs
        showGeneralError(
          "signup-general-error",
          error.message ||
            "An unexpected error occurred. Please try again later."
        );
        signupButton.disabled = false;
        signupButton.textContent = "Sign Up";
      }
      // --- End API Call ---
    });
  } // End if(signupForm)

  // --- Logout Handling ---
  async function handleLogout() {
    // console.log("Attempting logout..."); // DEBUG log removed
    try {
      const response = await WorkspaceApi("/logout/", "POST", null, true); // Requires auth
      if (!response.success) {
        // Log server-side logout failure, but proceed with client-side logout
        console.warn(
          "Server logout failed (token might be expired/invalid):",
          response.error
        ); // Keep useful warnings
      }
    } catch (error) {
      console.error("Error during logout API call:", error); // Keep error logs
    } finally {
      // Always clear local storage and redirect regardless of API call outcome
      clearAuthInfo();
      window.location.href = "login.html";
    }
  }
}); // End DOMContentLoaded
