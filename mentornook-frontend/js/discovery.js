document.addEventListener("DOMContentLoaded", () => {
  // --- Get DOM Elements ---
  const filterForm = document.getElementById("filter-form");
  const userListContainer = document.getElementById("user-list-container");
  const loadingMessage = document.getElementById("loading-message");
  const noResultsMessage = document.getElementById("no-results-message");
  const paginationControls = document.getElementById("pagination-controls");
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  // Optional Clear Button: const clearSearchButton = document.getElementById('clear-search-button');

  // --- State Variables ---
  let currentFilters = {
    role: "",
    skills: "",
    interests: "",
    search: "",
  };
  let currentPage = 1;
  const PAGE_SIZE = 10; // Match DRF Page Size setting

  // --- Initialize Tag Inputs for Filters ---
  const skillsFilterContainer = document.getElementById(
    "filter-skills-container"
  );
  const interestsFilterContainer = document.getElementById(
    "filter-interests-container"
  );

  if (skillsFilterContainer) {
    initializeTagInput(
      "filter-skills-container",
      "filter-skills-input",
      "filter-skills-tags",
      "filter-skills"
    );
  } else {
    console.warn("Skills filter tag input container not found.");
  }
  if (interestsFilterContainer) {
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
  fetchAndDisplayUsers(currentFilters, currentPage);

  // --- Event Listener for Search Form ---
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      currentFilters.search = searchInput.value.trim();
      currentPage = 1; // Reset page
      fetchAndDisplayUsers(currentFilters, currentPage);
      // Optional: Manage clear button visibility based on searchInput.value
    });
  } else {
    console.warn("Search form not found.");
  }

  // Optional: Clear Search Button Handler
  // if (clearSearchButton) { ... }

  // --- Event Listener for Filter Form ---
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      // Update filters state
      currentFilters.role = document.getElementById("filter-role")?.value || "";
      currentFilters.skills =
        document.getElementById("filter-skills")?.value || ""; // From hidden input
      currentFilters.interests =
        document.getElementById("filter-interests")?.value || ""; // From hidden input
      // Keep existing search term when applying filters
      currentFilters.search = searchInput?.value.trim() || "";
      currentPage = 1; // Reset page
      fetchAndDisplayUsers(currentFilters, currentPage);
    });
  } else {
    console.warn("Filter form not found.");
  }

  // --- Event Listener for Pagination ---
  if (paginationControls) {
    paginationControls.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON" && e.target.dataset.page) {
        const page = parseInt(e.target.dataset.page, 10);
        if (!isNaN(page)) {
          currentPage = page;
          // Fetch data for the new page with current filters
          fetchAndDisplayUsers(currentFilters, currentPage);
        }
      }
    });
  } else {
    console.warn("Pagination controls container not found.");
  }

  // --- Core Function to Fetch and Display Users ---
  async function fetchAndDisplayUsers(filters = {}, page = 1) {
    if (!userListContainer || !loadingMessage || !noResultsMessage) {
      console.error(
        "Cannot display users: Missing required list or message elements."
      );
      return;
    }

    loadingMessage.style.display = "block";
    noResultsMessage.style.display = "none";
    userListContainer.innerHTML = ""; // Clear previous results
    if (paginationControls) paginationControls.innerHTML = ""; // Clear pagination

    // --- Construct Query Parameters ---
    const queryParams = new URLSearchParams();
    // Add filters only if they have a value
    if (filters.role) queryParams.append("role", filters.role);
    if (filters.skills) queryParams.append("skills", filters.skills); // Backend view handles comma-separated string for skills filter
    if (filters.interests) queryParams.append("interests", filters.interests); // Backend view handles comma-separated string for interests filter
    if (filters.search) queryParams.append("search", filters.search); // DRF SearchFilter default param
    if (page > 1) queryParams.append("page", page); // DRF PageNumberPagination default param
    const queryString = queryParams.toString();

    // **FIXED:** Construct full endpoint URL with query string
    const endpoint = queryString ? `/users/?${queryString}` : "/users/";
    // --- End Query Parameter Construction ---

    try {
      // **FIXED:** Pass null for data (GET request), add requiresAuth, use correct endpoint
      // Set requiresAuth based on whether user list is public (false) or requires login (true)
      const requiresAuth = true; // Or false if public listing is allowed
      const response = await WorkspaceApi(endpoint, "GET", null, requiresAuth);

      // **FIXED:** Check response.success and access DRF paginated data structure
      if (
        response.success &&
        response.data &&
        Array.isArray(response.data.results)
      ) {
        if (response.data.results.length > 0) {
          response.data.results.forEach((userProfile) => {
            // Ensure userProfile is valid before creating card
            if (userProfile && userProfile.user) {
              const userCard = createUserCard(userProfile);
              userListContainer.appendChild(userCard);
            } else {
              console.warn(
                "Received invalid user profile data item:",
                userProfile
              );
            }
          });
          // **FIXED:** Calculate total pages from count and page size
          const totalPages = Math.ceil(response.data.count / PAGE_SIZE);
          renderPagination(totalPages, page); // Pass current page number
        } else {
          noResultsMessage.style.display = "block"; // Show no results message if results array is empty
        }
      } else {
        // Handle API error response
        // **FIXED:** Use response.error
        noResultsMessage.textContent =
          response.error || "Failed to load users.";
        noResultsMessage.style.display = "block";
        console.error("Error loading users:", response.error);
      }
    } catch (error) {
      // Catch network/fetch errors
      console.error("Error fetching users:", error);
      noResultsMessage.textContent =
        error.message || "An unexpected error occurred while fetching users.";
      noResultsMessage.style.display = "block";
    } finally {
      loadingMessage.style.display = "none";
    }
  } // End fetchAndDisplayUsers

  // --- Function to Create User Card HTML ---
  function createUserCard(userProfile) {
    const card = document.createElement("div");
    card.className = "user-card";

    // **FIXED:** Use correct fields from ProfileSerializer data
    const profilePic =
      userProfile.profile_picture_url ||
      "assets/images/profile_avatar_default.png";
    const name =
      userProfile.name || userProfile.user?.username || "Unnamed User"; // Use calculated name field
    const role = userProfile.role || "";
    // **FIXED:** Use skills_list array provided by serializer
    const skillsList = userProfile.skills_list || [];
    const skillsText =
      skillsList.length > 0 ? skillsList.join(", ") : "No skills listed";
    // **FIXED:** Use nested user ID for the link
    const userId = userProfile.user?.id; // Get ID from nested user object

    // Only create link if userId is valid
    const profileLink = userId
      ? `<a href="user_profile.html?id=${userId}" class="btn btn-secondary btn-sm">View Profile</a>`
      : "";

    card.innerHTML = `
            <img src="${profilePic}" alt="${name}'s profile picture">
            <h3>${name}</h3>
            ${role ? `<span class="user-role ${role}">${role}</span>` : ""}
            <p class="user-skills" title="${skillsText}">Skills: ${skillsText}</p>
            ${profileLink}
        `;
    return card;
  } // End createUserCard

  // --- Function to Render Pagination Controls ---
  // (Keep existing renderPagination function - it correctly uses totalPages and currentPage)
  function renderPagination(totalPages, currentPage) {
    if (!paginationControls || totalPages <= 1) {
      if (paginationControls) paginationControls.innerHTML = "";
      return;
    }
    paginationControls.innerHTML = ""; // Clear previous controls
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
