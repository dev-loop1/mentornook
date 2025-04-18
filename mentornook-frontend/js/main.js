document.addEventListener("DOMContentLoaded", () => {
  const currentYear = new Date().getFullYear();
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) {
    yearSpan.textContent = currentYear;
  }

  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const mainNav = document.querySelector(".main-header nav");

  if (mobileMenuToggle && mainNav) {
    mobileMenuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("mobile-nav-active");
      // Optional: Change toggle icon
      mobileMenuToggle.textContent = mainNav.classList.contains(
        "mobile-nav-active"
      )
        ? "✕"
        : "☰";
    });
  }

  // Handle Auth State for Header and Redirects
  handleAuthState();

  // Logout Button Listener (if present in header)
  // Use event delegation on the header in case the button is added dynamically
  // Logout Button Listener (if present in header)
  // Use event delegation on the header in case the button is added dynamically
  const header = document.querySelector(".main-header");
  if (header) {
    header.addEventListener("click", async (event) => {
      // Make handler async
      if (event.target && event.target.id === "logout-button") {
      //  console.log("Logout button clicked");
        event.target.disabled = true; // Disable button during logout
        event.target.textContent = "Logging out...";

        try {
          // Call the backend logout endpoint (requires auth token)
          const response = await WorkspaceApi("/logout/", "POST", null, true);
          if (!response.success) {
            // Log error but proceed with client-side logout anyway
            console.warn(
              "Backend logout failed (maybe token was already invalid?):",
              response.error
            );
          }
        } catch (error) {
          console.error("Error during logout API call:", error);
          // Proceed with client-side logout even if API call fails
        } finally {
          // Always clear local storage and redirect
          clearAuthInfo();
          window.location.href = "login.html";
        }
      }
    });
  }
});

function handleAuthState() {
  const loggedIn = isAuthenticated();
  const body = document.body;
  const header = document.querySelector(".main-header");
  const currentPage = window.location.pathname.split("/").pop(); // e.g., 'login.html'

  // Pages requiring authentication
  const protectedPages = [
    "dashboard.html",
    "profile_setup.html",
    "my_profile.html",
    "user_profile.html",
    "connections.html",
  ];
  // Pages for logged-out users only
  const publicOnlyPages = ["login.html", "signup.html"];

  if (loggedIn) {
    if (header) header.classList.replace("logged-out", "logged-in"); // Ensure correct header style if using classes
    // If logged in and on a public-only page, redirect to dashboard
    if (publicOnlyPages.includes(currentPage)) {
     // console.log("User logged in, redirecting from public page to dashboard.");
      window.location.href = "dashboard.html";
      return; // Prevent further execution on this page load
    }
    // Update header content dynamically (Example - adapt based on your header HTML structure)
    updateHeaderForLoggedInUser();
  } else {
    if (header) header.classList.replace("logged-in", "logged-out");
    // If not logged in and on a protected page, redirect to login
    if (protectedPages.includes(currentPage)) {
    //   console.log(
    //     "User not logged in, redirecting from protected page to login."
    //   );
      window.location.href = "login.html";
      return; // Prevent further execution
    }
    updateHeaderForLoggedOutUser();
  }

  // Special case for index.html: redirect if logged in
  if (currentPage === "index.html" || currentPage === "") {
    if (loggedIn) {
    //  console.log("User logged in, redirecting from index to dashboard.");
      window.location.href = "dashboard.html";
    }
  }
}

// Example functions to dynamically update header content (ADAPT TO YOUR HTML)
function updateHeaderForLoggedInUser() {
  const nav = document.querySelector(".main-header .container nav");
  if (!nav) return;
  const userInfo = getUserInfo();
  const userName = userInfo ? userInfo.name : "User";

  // Check if already updated to prevent duplicates if handleAuthState runs multiple times
  if (nav.querySelector("#logout-button")) return;

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
}

function updateHeaderForLoggedOutUser() {
  const nav = document.querySelector(".main-header .container nav");
  if (!nav) return;

  // Check if already updated
  if (nav.querySelector(".btn-primary")?.href?.includes("signup.html")) return;

  nav.innerHTML = `
         <ul>
             <li><a href="signup.html" class="btn btn-primary">Sign Up</a></li>
             <li><a href="login.html" class="btn btn-secondary">Login</a></li>
         </ul>
     `;
}

// Helper to add 'active' class to current page link in nav
function isActive(pageName) {
  return window.location.pathname.endsWith(pageName) ? "active" : "";
}
