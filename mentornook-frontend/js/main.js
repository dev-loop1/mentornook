/**
 * main.js
 * Handles global initialization, navigation, authentication state checks,
 * redirects, and dynamic header updates based on login status.
 * Assumes functions from utils.js (like isAuthenticated, getUserInfo, clearAuthInfo, WorkspaceApi) are available.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Set current year in the footer
  const currentYear = new Date().getFullYear();
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) {
    yearSpan.textContent = currentYear;
  }

  // --- Mobile Menu Toggle ---
  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const mainNav = document.querySelector(".main-header nav");

  if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("mobile-nav-active");
      // Toggle hamburger/close icon
      mobileMenuToggle.textContent = mainNav.classList.contains(
        "mobile-nav-active"
      )
        ? "✕" // Close icon
        : "☰"; // Hamburger icon
    });
  }

  // --- Handle Authentication State & Redirects ---
  // Checks login status on page load, redirects if necessary, updates header
  handleAuthState();

  // --- Logout Button Listener ---
  // Uses event delegation on the header as the button is added dynamically
  const header = document.querySelector(".main-header");
  if (header) {
    header.addEventListener("click", async (event) => {
      // Check if the clicked element is the logout button
      if (event.target && event.target.id === "logout-button") {
        event.target.disabled = true; // Prevent multiple clicks
        event.target.textContent = "Logging out...";

        try {
          // Call the backend API to invalidate the token
          const response = await WorkspaceApi("/logout/", "POST", null, true); // Requires auth
          if (!response.success) {
            // Log a warning if server logout fails, but proceed with client logout
            console.warn(
              "Backend logout failed (maybe token was already invalid?):",
              response.error
            );
          }
        } catch (error) {
          // Log any network or unexpected errors during the API call
          console.error("Error during logout API call:", error);
        } finally {
          // Always clear local storage and redirect, regardless of API call outcome
          clearAuthInfo();
          window.location.href = "login.html";
        }
      }
    });
  }
}); // End DOMContentLoaded

/**
 * Checks authentication status, updates header styles/content, and handles
 * redirects for protected pages, public-only pages, and the index page.
 */
function handleAuthState() {
  const loggedIn = isAuthenticated(); // Check if auth token exists
  const header = document.querySelector(".main-header");
  // Get the current HTML filename (e.g., 'login.html', 'dashboard.html', '')
  const currentPage = window.location.pathname.split("/").pop() || "index.html"; // Default to index if path is '/'

  // Define page access rules
  const protectedPages = [
    "dashboard.html",
    "profile_setup.html",
    "my_profile.html",
    "user_profile.html",
    "connections.html",
  ];
  const publicOnlyPages = ["login.html", "signup.html"];

  if (loggedIn) {
    // --- User is Logged In ---
    if (header) header.classList.replace("logged-out", "logged-in"); // Apply logged-in header style

    // Redirect away from pages only meant for logged-out users
    if (publicOnlyPages.includes(currentPage)) {
      window.location.href = "dashboard.html";
      return; // Stop further execution after redirect
    }
    // Redirect away from index page (usually landing page)
    if (currentPage === "index.html") {
      window.location.href = "dashboard.html";
      return; // Stop further execution after redirect
    }
    // Update header navigation for logged-in state
    updateHeaderForLoggedInUser();
  } else {
    // --- User is Logged Out ---
    if (header) header.classList.replace("logged-in", "logged-out"); // Apply logged-out header style

    // Redirect away from pages that require login
    if (protectedPages.includes(currentPage)) {
      window.location.href = "login.html";
      return; // Stop further execution after redirect
    }
    // Update header navigation for logged-out state
    updateHeaderForLoggedOutUser();
  }
} // End handleAuthState

/**
 * Updates the header navigation HTML for a logged-in user.
 */
function updateHeaderForLoggedInUser() {
  const nav = document.querySelector(".main-header .container nav");
  if (!nav) return; // Exit if nav element not found

  // Avoid re-rendering if logout button already exists
  if (nav.querySelector("#logout-button")) return;

  // Generate HTML for logged-in navigation links
  nav.innerHTML = `
          <ul>
              <li><a href="dashboard.html" class="${isActive(
                "dashboard.html"
              )}">Dashboard</a></li>
              <li><a href="my_profile.html" class="${isActive(
                "my_profile.html"
              )}">My Profile</a></li>
              <li><a href="connections.html" class="${isActive(
                "connections.html"
              )}">Connections</a></li>
              <li><button id="logout-button" class="btn btn-secondary">Logout</button></li>
          </ul>
      `;
} // End updateHeaderForLoggedInUser

/**
 * Updates the header navigation HTML for a logged-out user.
 */
function updateHeaderForLoggedOutUser() {
  const nav = document.querySelector(".main-header .container nav");
  if (!nav) return; // Exit if nav element not found

  // Avoid re-rendering if signup button already exists
  if (nav.querySelector(".btn-primary")?.href?.includes("signup.html")) return;

  // Generate HTML for logged-out navigation links
  nav.innerHTML = `
           <ul>
               <li><a href="signup.html" class="btn btn-primary">Sign Up</a></li>
               <li><a href="login.html" class="btn btn-secondary">Login</a></li>
           </ul>
       `;
} // End updateHeaderForLoggedOutUser

/**
 * Helper function to determine if a navigation link corresponds to the current page.
 * Adds an 'active' class for styling purposes.
 * @param {string} pageName - The HTML filename to check against (e.g., 'dashboard.html').
 * @returns {string} 'active' if the current page matches, otherwise an empty string.
 */
function isActive(pageName) {
  // Check if the current URL's pathname ends with the given pageName
  return window.location.pathname.endsWith(pageName) ? "active" : "";
} // End isActive
