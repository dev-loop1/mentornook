/**
 * discovery.js
 * Handles the user discovery page (dashboard.html): fetching, filtering,
 * searching, paginating, and displaying user profiles.
 * Assumes functions from utils.js (like getAuthToken, WorkspaceApi, initializeTagInput) are available.
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- Get DOM Elements ---
  const filterForm = document.getElementById("filter-form");
  const userListContainer = document.getElementById("user-list-container");
  const loadingMessage = document.getElementById("loading-message");
  const noResultsMessage = document.getElementById("no-results-message");
  const paginationControls = document.getElementById("pagination-controls");
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  // Optional: const clearSearchButton = document.getElementById('clear-search-button');

  // --- State Variables ---
  // Stores the currently active filters and search term
  let currentFilters = {
    role: "",
    skills: "",
    interests: "",
    search: "",
  };
  // Stores the current page number for pagination
  let currentPage = 1;
  // Page size should match backend pagination setting for accurate calculation
  const PAGE_SIZE = 10; // Match DRF Page Size setting in settings.py

  // --- Initialize Tag Inputs for Filters ---
  const skillsFilterContainer = document.getElementById(
    "filter-skills-container"
  );
  const interestsFilterContainer = document.getElementById(
    "filter-interests-container"
  );

  if (skillsFilterContainer) {
    // Initialize the tag input component for skills filter
    initializeTagInput(
      "filter-skills-container",
      "filter-skills-input",
      "filter-skills-tags",
      "filter-skills"
    );
  } else {
    // Log warning if element is missing - helps diagnose HTML issues
    console.warn("Skills filter tag input container not found.");
  }
  if (interestsFilterContainer) {
    // Initialize the tag input component for interests filter
    initializeTagInput(
      "filter-interests-container",
      "filter-interests-input",
      "filter-interests-tags",
      "filter-interests"
    );
  } else {
    console.warn("Interests filter tag input container not found.");
  }
  // --- End Initialization ---

  // --- Initial Data Load ---
  // Fetch and display users when the page first loads
  fetchAndDisplayUsers(currentFilters, currentPage);

  // --- Event Listener for Search Form ---
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Prevent default form submission
      // Update state with the new search term
      currentFilters.search = searchInput.value.trim();
      currentPage = 1; // Reset to page 1 for new search
      // Fetch users with the updated search term (and existing filters)
      fetchAndDisplayUsers(currentFilters, currentPage);
    });
  } else {
    console.warn("Search form not found."); // Log warning if element is missing
  }

  // Optional: Add handler for a clear search button if implemented
  // if (clearSearchButton) { ... }

  // --- Event Listener for Filter Form ---
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Prevent default form submission
      // Update filter state from form inputs (including hidden tag inputs)
      currentFilters.role = document.getElementById("filter-role")?.value || "";
      currentFilters.skills =
        document.getElementById("filter-skills")?.value || "";
      currentFilters.interests =
        document.getElementById("filter-interests")?.value || "";
      // Ensure the current search term is preserved when applying filters
      currentFilters.search = searchInput?.value.trim() || "";
      currentPage = 1; // Reset to page 1 when filters change
      // Fetch users with the updated filters (and existing search term)
      fetchAndDisplayUsers(currentFilters, currentPage);
    });
  } else {
    console.warn("Filter form not found."); // Log warning if element is missing
  }

  // --- Event Listener for Pagination ---
  if (paginationControls) {
    // Use event delegation to handle clicks on pagination buttons
    paginationControls.addEventListener("click", (e) => {
      // Check if a button with a 'data-page' attribute was clicked
      if (e.target.tagName === "BUTTON" && e.target.dataset.page) {
        const page = parseInt(e.target.dataset.page, 10);
        if (!isNaN(page)) {
          currentPage = page; // Update current page state
          // Fetch users for the new page, keeping current filters/search active
          fetchAndDisplayUsers(currentFilters, currentPage);
        }
      }
    });
  } else {
    console.warn("Pagination controls container not found."); // Log warning if element is missing
  }

  /**
   * Fetches user profiles from the backend based on current filters, search term,
   * and page number, then renders the results.
   * @param {object} filters - The current filter/search state object.
   * @param {number} page - The page number to fetch.
   */
  async function fetchAndDisplayUsers(filters = {}, page = 1) {
    // Ensure required DOM elements for display exist
    if (!userListContainer || !loadingMessage || !noResultsMessage) {
      console.error(
        "Cannot display users: Missing required list or message elements."
      );
      return;
    }

    // Show loading state, hide previous results/messages
    loadingMessage.style.display = "block";
    noResultsMessage.style.display = "none";
    userListContainer.innerHTML = "";
    if (paginationControls) paginationControls.innerHTML = "";

    // --- Construct Query Parameters for API ---
    const queryParams = new URLSearchParams();
    // Append parameters only if they have a value
    if (filters.role) queryParams.append("role", filters.role);
    if (filters.skills) queryParams.append("skills", filters.skills);
    if (filters.interests) queryParams.append("interests", filters.interests);
    if (filters.search) queryParams.append("search", filters.search);
    if (page > 1) queryParams.append("page", page);
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/users/?${queryString}` : "/users/"; // Append query string if present
    // --- End Query Parameter Construction ---

    try {
      // Determine if authentication is needed to view the user list
      const requiresAuth = true; // Set to false if list should be public
      // Call the backend API
      const response = await WorkspaceApi(endpoint, "GET", null, requiresAuth);

      // Process the response
      if (
        response.success &&
        response.data &&
        Array.isArray(response.data.results)
      ) {
        const userProfiles = response.data.results;
        if (userProfiles.length > 0) {
          // Render each user card
          userProfiles.forEach((userProfile) => {
            if (userProfile && userProfile.user) {
              // Basic validation of received item
              const userCard = createUserCard(userProfile);
              userListContainer.appendChild(userCard);
            } else {
              console.warn(
                "Received invalid user profile data item:",
                userProfile
              ); // Keep useful warnings
            }
          });
          // Render pagination controls based on total count and current page
          const totalPages = Math.ceil(response.data.count / PAGE_SIZE);
          renderPagination(totalPages, page);
        } else {
          // No users found matching criteria
          noResultsMessage.style.display = "block";
        }
      } else {
        // API call failed or returned unexpected data
        noResultsMessage.textContent =
          response.error || "Failed to load users.";
        noResultsMessage.style.display = "block";
        console.error("Error loading users:", response.error); // Keep error logs
      }
    } catch (error) {
      // Handle network errors or exceptions during the fetch process
      console.error("Error fetching users:", error); // Keep error logs
      noResultsMessage.textContent =
        error.message || "An unexpected error occurred while fetching users.";
      noResultsMessage.style.display = "block";
    } finally {
      // Always hide the loading message
      loadingMessage.style.display = "none";
    }
  } // End fetchAndDisplayUsers

  /**
   * Creates the HTML structure for a single user profile card.
   * @param {object} userProfile - Profile data object from the API response.
   * @returns {HTMLElement} The created div element for the user card.
   */
  function createUserCard(userProfile) {
    const card = document.createElement("div");
    card.className = "user-card";

    // Extract data safely, providing defaults
    const profilePic =
      "assets/images/profile_avatar_default.png";
    const name =
      userProfile.name || userProfile.user?.username || "Unnamed User";
    const role = userProfile.role || "";
    const skillsList = userProfile.skills_list || [];
    const skillsText =
      skillsList.length > 0 ? skillsList.join(", ") : "No skills listed";
    const interestsList = userProfile.interests_list || [];
    const interestsText = interestsList.length > 0 ? interestsList.join(', ') : 'No interests listed';
    const userId = userProfile.user?.id; // Use nested user ID

    // Generate profile link only if userId is valid
    const profileLink = userId
      ? `<a href="user_profile.html?id=${userId}" class="btn btn-secondary btn-sm">View Profile</a>`
      : "";

    // Construct card HTML
    card.innerHTML = `
            <img src="${profilePic}" alt="${name}'s profile picture">
            <h3>${name}</h3>
            ${role ? `<span class="user-role ${role}">${role}</span>` : ""}
            <p class="user-skills" title="${skillsText}">Skills: ${skillsText}</p>
            <p class="user-interests" title="${interestsText}">Interests: ${interestsText}</p>
            ${profileLink}
        `;
    return card;
  } // End createUserCard

  /**
   * Renders pagination controls based on total pages and current page.
   * @param {number} totalPages - Total number of pages available.
   * @param {number} currentPage - The currently displayed page number.
   */
  function renderPagination(totalPages, currentPage) {
    // Standard pagination logic (no changes needed from previous version)
    if (!paginationControls || totalPages <= 1) {
      if (paginationControls) paginationControls.innerHTML = "";
      return;
    }
    paginationControls.innerHTML = "";
    const prevButton = document.createElement("button");
    prevButton.textContent = "« Prev";
    prevButton.dataset.page = currentPage - 1;
    prevButton.disabled = currentPage === 1;
    paginationControls.appendChild(prevButton);
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
    if (startPage > 1) {
      const firstButton = document.createElement("button");
      firstButton.textContent = "1";
      firstButton.dataset.page = 1;
      paginationControls.appendChild(firstButton);
      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        paginationControls.appendChild(ellipsis);
      }
    }
    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement("button");
      pageButton.textContent = i;
      pageButton.dataset.page = i;
      if (i === currentPage) {
        pageButton.disabled = true;
        pageButton.classList.add("current-page");
      }
      paginationControls.appendChild(pageButton);
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        paginationControls.appendChild(ellipsis);
      }
      const lastButton = document.createElement("button");
      lastButton.textContent = totalPages;
      lastButton.dataset.page = totalPages;
      paginationControls.appendChild(lastButton);
    }
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next »";
    nextButton.dataset.page = currentPage + 1;
    nextButton.disabled = currentPage === totalPages;
    paginationControls.appendChild(nextButton);
  } // End renderPagination
}); // End DOMContentLoaded
