/**
 * profile.js
 * Handles logic for:
 * 1. Profile setup and editing form (profile_setup.html) - including tag inputs & image upload.
 * 2. Displaying user profiles (my_profile.html, user_profile.html) - including tags and connection actions.
 *
 * Assumes functions from utils.js (like getAuthToken, getUserInfo, WorkspaceApi,
 * initializeTagInput, getUrlParams, isEmpty, clearAllErrors, showError, showGeneralError)
 * are available globally or imported if using modules.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Determine if we are on the profile edit/setup page or a profile view page
  const profileForm = document.getElementById("profile-form");
  const profileViewPage = document.querySelector(".profile-view-page");

  if (profileForm) {
    // Initialize the profile editing form
    setupProfileForm();
  } else if (profileViewPage) {
    // Initialize the profile viewing logic
    loadProfileView();
  }
});

// --- Profile Setup/Edit Functions ---

// Global variable to store loaded profile data (used for image preview reset)
let currentProfileData = null;

/**
 * Sets up the profile creation/editing form:
 * - Checks authentication.
 * - Initializes tag inputs.
 * - Loads existing profile data (if any).
 * - Sets up image preview.
 * - Attaches form submission and profile deletion handlers.
 */
async function setupProfileForm() {
  // Get references to essential form elements
  const profileForm = document.getElementById("profile-form");
  const formTitle = document.getElementById("profile-form-title");
  const profilePicPreview = document.getElementById("profile-pic-preview");
  const profilePicInput = document.getElementById("profile-picture");
  const deleteButton = document.getElementById("delete-profile-button");
  const generalError = document.getElementById("profile-general-error");
  const submitButton = profileForm.querySelector('button[type="submit"]');

  // Basic check for element existence
  if (!profileForm || !submitButton || !formTitle || !profilePicInput) {
    console.error(
      "Profile form setup failed: Essential form elements not found."
    );
    return;
  }

  // Ensure user is authenticated
  const token = getAuthToken();
  if (!token) {
    console.warn("Not authenticated for profile setup. Redirecting to login.");
    window.location.href = "login.html"; // Redirect if not logged in
    return;
  }

  // Initialize Tag Inputs for skills and interests
  initializeTagInput(
    "profile-skills-container",
    "profile-skills-input",
    "profile-skills-tags",
    "profile-skills"
  );
  initializeTagInput(
    "profile-interests-container",
    "profile-interests-input",
    "profile-interests-tags",
    "profile-interests"
  );

  // Load existing profile data for editing
  submitButton.textContent = "Loading Profile...";
  submitButton.disabled = true;
  try {
    const response = await WorkspaceApi("/profile/", "GET", null, true); // Fetch own profile

    if (response.success && response.data) {
      currentProfileData = response.data; // Store loaded data
      formTitle.textContent = "Edit Your Profile";
      populateProfileForm(response.data); // Populate form fields & tags
    } else if (response.success && response.data === null) {
      // No profile exists yet (new user)
      formTitle.textContent = "Setup Your Profile";
      if (profilePicPreview)
        profilePicPreview.src = "assets/images/profile_avatar_default.png";
      currentProfileData = null;
    } else {
      // Error fetching profile
      showGeneralError(
        "profile-general-error",
        response.error || "Failed to load profile data."
      );
      formTitle.textContent = "Setup Your Profile";
      if (profilePicPreview)
        profilePicPreview.src = "assets/images/profile_avatar_default.png";
    }
  } catch (error) {
    console.error("Error loading profile for edit:", error); // Keep error log
    showGeneralError(
      "profile-general-error",
      "An error occurred while loading your profile."
    );
    formTitle.textContent = "Setup Your Profile";
    if (profilePicPreview)
      profilePicPreview.src = "assets/images/profile_avatar_default.png";
  } finally {
    submitButton.textContent = "Save Profile";
    submitButton.disabled = false;
  }

  // Set up the image preview handler
  if (profilePicInput && profilePicPreview) {
    profilePicInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file && file.type.startsWith("image/")) {
        // Show preview if valid image
        const reader = new FileReader();
        reader.onload = (e) => {
          profilePicPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
        clearError("profile-picture-error");
      } else if (file) {
        // Show error and reset preview if invalid file
        showError("profile-picture-error", "Please select a valid image file.");
        profilePicPreview.src =
          currentProfileData?.profile_picture_url ||
          "assets/images/profile_avatar_default.png";
        profilePicInput.value = ""; // Clear the invalid file selection
      }
    });
  }

  // Set up the main form submission handler
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent default HTML form submission
    clearAllErrors(profileForm); // Clear previous errors
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    // --- Frontend Validation ---
    let isValid = true;
    const skillsValue = document.getElementById("profile-skills").value;
    const interestsValue = document.getElementById("profile-interests").value;
    const roleValue = profileForm.querySelector(
      'input[name="role"]:checked'
    )?.value;
    const bioValue = document.getElementById("profile-bio").value;

    if (!roleValue) {
      showError("role-error", "Please select your role.");
      isValid = false;
    }
    if (isEmpty(bioValue)) {
      showError("bio-error", "Bio cannot be empty.");
      isValid = false;
    }
    if (isEmpty(skillsValue)) {
      showError(
        "skills-error",
        "Skills cannot be empty. Type a skill and press Enter."
      );
      isValid = false;
    }
    if (isEmpty(interestsValue)) {
      showError(
        "interests-error",
        "Interests cannot be empty. Type an interest and press Enter."
      );
      isValid = false;
    }

    if (!isValid) {
      submitButton.disabled = false;
      submitButton.textContent = "Save Profile";
      showGeneralError(
        "profile-general-error",
        "Please fix the errors highlighted above."
      );
      return; // Stop submission
    }
    // --- End Validation ---

    // --- Prepare Data (Handle potential Image Upload) ---
    const formElementDataForRead = new FormData(profileForm);
    const imageFile = profilePicInput.files[0];
    let dataToSend;
    const method = "PUT"; // Use PUT for update

    const skillsString = document.getElementById("profile-skills").value || "";
    const interestsString =
      document.getElementById("profile-interests").value || "";

    if (imageFile) {
      // Use FormData if a new image file was selected
      dataToSend = new FormData();
      // Append all relevant fields from the form
      dataToSend.append("role", formElementDataForRead.get("role"));
      dataToSend.append("headline", formElementDataForRead.get("headline"));
      dataToSend.append("bio", formElementDataForRead.get("bio"));
      dataToSend.append("skills", skillsString); // Send comma-separated string
      dataToSend.append("interests", interestsString); // Send comma-separated string
      dataToSend.append("location", formElementDataForRead.get("location"));
      dataToSend.append(
        "linkedin_url",
        formElementDataForRead.get("linkedin_url")
      );
      dataToSend.append(
        "website_url",
        formElementDataForRead.get("website_url")
      );
      dataToSend.append("profile_picture", imageFile, imageFile.name); // Append file
    } else {
      // Use plain JSON object if no new image file was selected
      dataToSend = {
        role: formElementDataForRead.get("role"),
        headline: formElementDataForRead.get("headline"),
        bio: formElementDataForRead.get("bio"),
        skills: skillsString, // Send comma-separated string
        interests: interestsString, // Send comma-separated string
        location: formElementDataForRead.get("location"),
        linkedin_url: formElementDataForRead.get("linkedin_url"),
        website_url: formElementDataForRead.get("website_url"),
      };
    }
    // --- End Data Preparation ---

    // --- Call Backend API to Save Profile ---
    try {
      const response = await WorkspaceApi(
        "/profile/",
        method,
        dataToSend,
        true
      ); // requiresAuth=true

      if (response.success) {
        // Redirect to view profile page on successful save
        window.location.href = "my_profile.html";
      } else {
        // Handle backend validation or other save errors
        let errorMessage = response.error || "Failed to save profile.";
        // Attempt to parse specific field errors from DRF response
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
        showGeneralError("profile-general-error", errorMessage);
        submitButton.disabled = false;
        submitButton.textContent = "Save Profile";
      }
    } catch (error) {
      // Handle network or other unexpected errors during API call
      console.error("Error saving profile:", error); // Keep error log
      showGeneralError(
        "profile-general-error",
        error.message || "An unexpected error occurred."
      );
      submitButton.disabled = false;
      submitButton.textContent = "Save Profile";
    }
    // --- End API Call ---
  });
  // --- End Form Submission Handler ---

  // --- Delete Profile Handler ---
  if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
      // Confirm deletion with user
      if (
        confirm(
          "Are you sure you want to delete your profile? This action cannot be undone and will log you out."
        )
      ) {
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";
        try {
          // Call backend API to delete profile
          const response = await WorkspaceApi(
            "/profile/",
            "DELETE",
            null,
            true
          ); // requiresAuth=true

          if (response.success || response.status === 204) {
            // Treat 204 No Content as success
            alert("Profile deleted successfully.");
            clearAuthInfo(); // Log user out on client-side
            window.location.href = "index.html"; // Redirect to homepage
          } else {
            // Handle deletion failure
            alert(
              `Failed to delete profile: ${response.error || "Unknown error"}`
            );
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete Profile";
          }
        } catch (error) {
          // Handle network or unexpected errors during deletion
          console.error("Error deleting profile:", error); // Keep error log
          alert(`An error occurred: ${error.message || "Please try again."}`);
          deleteButton.disabled = false;
          deleteButton.textContent = "Delete Profile";
        }
      }
    });
  } else {
    // Log warning if delete button element is missing
    console.warn("Delete profile button not found."); // Keep useful warning
  }
  // --- End Delete Profile Handler ---
} // End setupProfileForm

/**
 * Populates the profile editing form fields with data fetched from the API.
 * Also refreshes the visual state of the tag input components.
 * @param {object} profile - The profile data object (response.data).
 */
function populateProfileForm(profile) {
  if (!profile) return;

  // Populate radio button for role
  const roleInput = document.querySelector(
    `input[name="role"][value="${profile.role}"]`
  );
  if (roleInput) {
    roleInput.checked = true;
  } else if (profile.role) {
    // Log warning if a role value exists but no matching radio button found
    console.warn(`Could not find radio button for role: ${profile.role}`); // Keep useful warning
  }

  // Helper to safely set input values
  const setInputValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || ""; // Set to empty string if value is null/undefined
  };

  // Populate standard text/textarea fields
  setInputValue("profile-headline", profile.headline);
  setInputValue("profile-bio", profile.bio);
  setInputValue("profile-location", profile.location);
  setInputValue("profile-linkedin", profile.linkedin_url);
  setInputValue("profile-website", profile.website_url);

  // Set profile picture preview from URL provided by backend
  const profilePicPreview = document.getElementById("profile-pic-preview");
  if (profilePicPreview) {
    profilePicPreview.src =
      profile.profile_picture_url || "assets/images/profile_avatar_default.png";
  }

  // Populate hidden inputs for tags using *_list fields from backend data
  const skillsHiddenInput = document.getElementById("profile-skills");
  const interestsHiddenInput = document.getElementById("profile-interests");
  if (skillsHiddenInput) {
    skillsHiddenInput.value =
      profile.skills_list && Array.isArray(profile.skills_list)
        ? profile.skills_list.join(",")
        : "";
  }
  if (interestsHiddenInput) {
    interestsHiddenInput.value =
      profile.interests_list && Array.isArray(profile.interests_list)
        ? profile.interests_list.join(",")
        : "";
  }

  // Refresh the visual tags based on the hidden input values
  const skillsContainer = document.getElementById("profile-skills-container");
  const interestsContainer = document.getElementById(
    "profile-interests-container"
  );
  // Use optional chaining for safety in case refreshTags isn't attached
  if (skillsContainer?.refreshTags) skillsContainer.refreshTags();
  if (interestsContainer?.refreshTags) interestsContainer.refreshTags();
} // End populateProfileForm

// --- Profile View Functions ---

/**
 * Loads profile data (either own or another user's based on URL)
 * and triggers rendering. Handles loading and error states.
 */
async function loadProfileView() {
  // Get required elements for displaying content and messages
  const profileContent = document.getElementById("profile-content");
  const loadingMessage = document.getElementById("loading-profile-message");
  const errorMessage = document.getElementById("error-profile-message");

  // Exit if essential display elements are missing
  if (!profileContent || !loadingMessage || !errorMessage) {
    console.error("Profile view elements not found.");
    return; // Keep error log
  }

  // Determine which user's profile to load
  const params = getUrlParams();
  const userIdFromUrl = params.id; // Get ID from URL query parameter ?id=...
  const loggedInUserInfo = getUserInfo();
  // Check if viewing own profile (no ID in URL or ID matches logged-in user)
  const isOwnProfile =
    !userIdFromUrl ||
    (loggedInUserInfo && String(userIdFromUrl) === String(loggedInUserInfo.id));
  const targetUserId = isOwnProfile ? loggedInUserInfo?.id : userIdFromUrl;

  // Exit if target user cannot be determined (e.g., accessing own profile while logged out)
  if (!targetUserId) {
    loadingMessage.style.display = "none";
    errorMessage.textContent = "Could not determine which profile to load.";
    errorMessage.style.display = "block";
    if (isOwnProfile && !loggedInUserInfo) window.location.href = "login.html"; // Redirect if trying to view own profile logged out
    return;
  }

  // Set initial UI state (show loading, hide content/error)
  loadingMessage.style.display = "block";
  profileContent.style.display = "none";
  errorMessage.style.display = "none";

  try {
    // Determine the correct API endpoint
    const endpoint = isOwnProfile ? "/profile/" : `/profiles/${targetUserId}/`;
    // Assume viewing profiles requires authentication (to get connection status)
    const requiresAuth = true;
    // Fetch profile data from the backend
    const response = await WorkspaceApi(endpoint, "GET", null, requiresAuth);

    if (response.success && response.data) {
      // Data fetched successfully, render it
      renderProfileData(response.data, isOwnProfile, loggedInUserInfo?.id);
      profileContent.style.display = "block"; // Show the profile content
    } else {
      // API call failed or returned no data
      errorMessage.textContent =
        response.error || "Profile could not be loaded.";
      errorMessage.style.display = "block";
    }
  } catch (error) {
    // Handle network or other unexpected errors
    console.error("Error loading profile view:", error); // Keep error log
    errorMessage.textContent = error.message || "An unexpected error occurred.";
    errorMessage.style.display = "block";
  } finally {
    // Always hide loading message when done
    loadingMessage.style.display = "none";
  }
} // End loadProfileView

/**
 * Renders the fetched profile data into the corresponding HTML elements.
 * @param {object} profile - The profile data object from the API (response.data).
 * @param {boolean} isOwnProfile - Flag indicating if viewing own profile.
 * @param {string|number|null} loggedInUserId - The ID of the currently logged-in user.
 */
function renderProfileData(profile, isOwnProfile, loggedInUserId) {
  // Validate essential profile data structure
  if (!profile || !profile.user) {
    console.error("Invalid profile data received for rendering:", profile); // Keep error log
    setTextContent(
      "error-profile-message",
      "Failed to render profile: Invalid data."
    );
    setVisible(document.getElementById("error-profile-message"), true);
    return;
  }
  // Standardize ID comparison
  const currentUserId = loggedInUserId ? String(loggedInUserId) : null;
  const profileUserId = String(profile.user.id);

  // Set page title dynamically
  const displayName = profile.name || profile.user.username;
  document.title = isOwnProfile
    ? `My Profile - MentorNook`
    : `${displayName}'s Profile - MentorNook`;

  // Populate profile header elements
  const profilePic = document.getElementById("profile-view-picture");
  if (profilePic) {
    profilePic.src =
      profile.profile_picture_url || "assets/images/profile_avatar_default.png";
    profilePic.alt = `${displayName}'s profile picture`;
  }
  setTextContent("profile-view-name", displayName);
  setTextContent(
    "profile-view-headline",
    profile.headline || "No headline provided"
  );

  // Display role with specific class for styling
  const roleElement = document.getElementById("profile-view-role");
  if (roleElement) {
    roleElement.textContent = profile.role || "Role not specified";
    roleElement.className = "user-role"; // Reset classes
    if (profile.role) roleElement.classList.add(profile.role);
  }

  // Populate main profile details
  setTextContent("profile-view-bio", profile.bio || "No bio provided.");

  // Render skills and interests tags using data from *_list fields
  renderTags("profile-view-skills", profile.skills_list, "skills");
  renderTags("profile-view-interests", profile.interests_list, "interests");

  // Populate contact info, hiding elements if data is missing
  const locationEl = document.getElementById("profile-view-location");
  const linkedinEl = document.getElementById("profile-view-linkedin");
  const websiteEl = document.getElementById("profile-view-website");

  setVisible(locationEl, !!profile.location); // Show only if location exists
  if (profile.location && locationEl)
    locationEl.textContent = `Location: ${profile.location}`;

  setVisible(linkedinEl, !!profile.linkedin_url); // Show only if URL exists
  if (profile.linkedin_url && linkedinEl)
    linkedinEl.innerHTML = `LinkedIn: <a href="${profile.linkedin_url}" target="_blank" rel="noopener noreferrer">View Profile</a>`;

  setVisible(websiteEl, !!profile.website_url); // Show only if URL exists
  if (profile.website_url && websiteEl)
    websiteEl.innerHTML = `Website: <a href="${profile.website_url}" target="_blank" rel="noopener noreferrer">${profile.website_url}</a>`;

  // Setup Action Button area (Edit button for own profile, Connection buttons for others)
  const actionArea = document.getElementById("connection-action-area");
  const editButton = document.querySelector(".edit-profile-btn");

  if (isOwnProfile) {
    setVisible(editButton, true); // Show Edit button
    setVisible(actionArea, false); // Hide Connection area
  } else {
    setVisible(editButton, false); // Hide Edit button
    setVisible(actionArea, true); // Show Connection area
    if (actionArea) {
      // Render connection buttons based on status received from backend
      setupConnectionButton(
        actionArea,
        profileUserId,
        profile.connectionStatus,
        currentUserId
      );
    }
  }
  // Debug log removed: console.log("renderProfileData finished.");
} // End renderProfileData

// --- Connection Button Setup & Handling (on Profile View pages) ---

/**
 * Sets up the appropriate connection button(s) or status text in the action area
 * based on the connection status between the logged-in user and the viewed profile.
 * @param {HTMLElement} container - The container element (#connection-action-area).
 * @param {string} targetUserId - The ID of the profile user being viewed.
 * @param {string} status - Connection status ('none', 'pending_sent', 'pending_received', 'connected', 'self').
 * @param {string|null} loggedInUserId - The ID of the currently logged-in user.
 */
function setupConnectionButton(
  container,
  targetUserId,
  status,
  loggedInUserId
) {
  if (!container) {
    console.error("setupConnectionButton: Action area container not found.");
    return;
  }
  container.innerHTML = ""; // Clear previous buttons/text

  // Don't show buttons if not logged in, viewing own profile, or status is 'self'
  if (
    !loggedInUserId ||
    String(loggedInUserId) === String(targetUserId) ||
    status === "self"
  ) {
    return;
  }

  let button;
  let statusText;
  // Use a container for multiple buttons (Accept/Decline) for easier layout
  let buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "0.5rem"; // Space between buttons

  // Render UI based on connection status
  switch (status) {
    case "pending_sent": // Logged-in user sent request to this profile user
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Request Sent";
      container.appendChild(statusText);
      button = document.createElement("button");
      button.className = "btn btn-warning btn-sm";
      button.textContent = "Cancel Request";
      button.dataset.action = "cancel";
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button);
      break;
    case "pending_received": // This profile user sent request to logged-in user
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Request Received";
      container.appendChild(statusText);
      const acceptBtn = document.createElement("button");
      acceptBtn.className = "btn btn-success btn-sm";
      acceptBtn.textContent = "Accept";
      acceptBtn.dataset.action = "accept";
      acceptBtn.dataset.targetUserId = targetUserId;
      buttonContainer.appendChild(acceptBtn);
      const declineBtn = document.createElement("button");
      declineBtn.className = "btn btn-danger btn-sm";
      declineBtn.textContent = "Decline";
      declineBtn.dataset.action = "decline";
      declineBtn.dataset.targetUserId = targetUserId;
      buttonContainer.appendChild(declineBtn);
      container.appendChild(buttonContainer); // Append container with both buttons
      break;
    case "connected": // Users are connected
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Connected";
      container.appendChild(statusText);
      button = document.createElement("button");
      button.className = "btn btn-danger btn-sm";
      button.textContent = "Remove Connection";
      button.dataset.action = "remove";
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button);
      break;
    case "none": // No connection or request exists
    default:
      button = document.createElement("button");
      button.id = "send-request-btn";
      button.className = "btn btn-primary";
      button.textContent = "Send Mentorship Request";
      button.dataset.action = "send";
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button);
      break;
  }

  // Ensure event listener is attached only once to the main action area container
  // This uses event delegation to handle clicks on dynamically added buttons
  const mainActionArea = document.getElementById("connection-action-area");
  if (mainActionArea && !mainActionArea.dataset.listenerAttached) {
    mainActionArea.removeEventListener("click", handleConnectionActionClick); // Precautionary removal
    mainActionArea.addEventListener("click", handleConnectionActionClick);
    mainActionArea.dataset.listenerAttached = "true"; // Mark as attached
  } else if (!mainActionArea) {
    console.error("Could not find #connection-action-area to attach listener."); // Keep error log
  }
  // Debug log removed: console.log("setupConnectionButton finished rendering.");
} // End setupConnectionButton

/**
 * Handles clicks on connection action buttons within the profile view's action area.
 * Determines connection ID if needed, performs API call, and refreshes button state.
 * @param {Event} event - The click event object.
 */
async function handleConnectionActionClick(event) {
  // Find the button that was actually clicked using dataset attribute
  const button = event.target.closest("button[data-action]");
  // Ignore clicks not on a relevant button or if button is disabled
  if (!button || button.disabled) return;

  const action = button.dataset.action;
  const targetUserId = button.dataset.targetUserId; // ID of the profile being viewed
  const token = getAuthToken();
  const actionArea = button.closest("#connection-action-area"); // The container
  const loggedInUserInfo = getUserInfo();

  // Validate necessary data/context
  if (!action || !targetUserId || !token || !actionArea || !loggedInUserInfo) {
    console.error("Connection action cannot proceed: Missing required data."); // Keep error log
    alert("Cannot perform action. Please ensure you are logged in.");
    return;
  }

  // Disable buttons in the area and show processing state
  const buttonsInArea = actionArea.querySelectorAll("button");
  buttonsInArea.forEach((btn) => (btn.disabled = true));
  const originalText = button.textContent;
  button.textContent = "Processing...";

  try {
    let response;
    let connectionId = null; // Will be needed for PUT/DELETE actions

    // Find the relevant connection ID only if the action is not 'send'
    if (action !== "send") {
      // Fetch all connections to find the specific one involving these two users
      // Note: This could be optimized if the backend provided the ID directly
      const connectionsResponse = await WorkspaceApi(
        "/connections/",
        "GET",
        null,
        true
      ); // requiresAuth = true
      if (connectionsResponse.success && connectionsResponse.data) {
        const {
          incoming = [],
          outgoing = [],
          current = [],
        } = connectionsResponse.data;
        const allConnections = [...incoming, ...outgoing, ...current];
        const connection = allConnections.find(
          (c) =>
            (String(c.requester?.id) === String(loggedInUserInfo.id) &&
              String(c.receiver?.id) === String(targetUserId)) ||
            (String(c.receiver?.id) === String(loggedInUserInfo.id) &&
              String(c.requester?.id) === String(targetUserId))
        );
        connectionId = connection?.id; // Get the ID if found
      }
      // If no connection ID found for actions requiring one, refresh state or throw error
      if (!connectionId) {
        console.warn(
          `Could not find relevant connection for action '${action}' - attempting profile refresh.`
        ); // Keep warning
        // Attempt to refresh the profile state as the connection might already be gone
        const profileRefreshResponse = await WorkspaceApi(
          `/profiles/${targetUserId}/`,
          "GET",
          null,
          true
        );
        if (profileRefreshResponse.success && profileRefreshResponse.data) {
          setupConnectionButton(
            actionArea,
            targetUserId,
            profileRefreshResponse.data.connectionStatus,
            loggedInUserInfo.id
          );
        } else {
          // If refresh also fails, throw the original error
          throw new Error(
            `Could not find connection involving user ${targetUserId} to perform action '${action}', and failed to refresh state.`
          );
        }
        return; // Stop processing this action after refresh attempt
      }
    }

    // Determine API call parameters based on the action
    let method;
    let endpoint;
    let data = null;

    switch (action) {
      case "send":
        method = "POST";
        endpoint = "/connections/request/";
        data = { user_id: targetUserId };
        break;
      case "accept":
      case "decline":
        method = "PUT";
        endpoint = `/connections/${connectionId}/`;
        data = { action: action };
        break;
      case "cancel":
      case "remove":
        method = "DELETE";
        endpoint = `/connections/${connectionId}/`;
        data = null;
        break;
      default:
        throw new Error(`Unknown connection action: ${action}`);
    }

    // Perform the API call
    response = await WorkspaceApi(endpoint, method, data, true); // All connection actions require auth

    // Handle the API response
    if (response.success || response.status === 204) {
      // Treat 204 No Content as success for DELETE
      // Action succeeded, refresh the button state by re-fetching the viewed profile's data
      const profileEndpoint = `/profiles/${targetUserId}/`;
      try {
        // Add specific try/catch for the refresh call
        const updatedProfileResponse = await WorkspaceApi(
          profileEndpoint,
          "GET",
          null,
          true
        ); // Auth needed for connection status

        if (updatedProfileResponse.success && updatedProfileResponse.data) {
          // Re-render the button section with the new connection status
          setupConnectionButton(
            actionArea,
            targetUserId,
            updatedProfileResponse.data.connectionStatus,
            loggedInUserInfo.id
          );
        } else {
          // Handle failure to refresh the profile data after successful action
          console.error(
            "Failed to refresh profile after connection action:",
            updatedProfileResponse.error
          ); // Keep error log
          actionArea.innerHTML =
            '<p class="error-message">Action successful, but failed to refresh button status.</p>';
          // Buttons remain disabled as UI state is uncertain
        }
      } catch (refreshError) {
        // Handle exception during the refresh API call
        console.error(
          "Exception during profile refresh after connection action:",
          refreshError
        ); // Keep error log
        actionArea.innerHTML = `<p class="error-message">Action successful, but failed to refresh button status: ${refreshError.message}</p>`;
      }
    } else {
      // Initial action API call failed
      alert(`Action failed: ${response.error || "Unknown error"}`);
      // Re-enable buttons ONLY if the initial action failed
      buttonsInArea.forEach((btn) => (btn.disabled = false));
      button.textContent = originalText; // Restore original text
    }
  } catch (error) {
    // Handle unexpected errors (network, connection ID lookup failure, etc.)
    console.error(
      `Error performing connection action '${action}' for user ${targetUserId}:`,
      error
    ); // Keep error log
    alert(`An error occurred: ${error.message || "Please try again."}`);
    // Re-enable buttons and restore text on any error
    buttonsInArea.forEach((btn) => (btn.disabled = false));
    button.textContent = originalText;
  }
} // End handleConnectionActionClick

// --- Helper Function Definitions ---

/**
 * Helper function to set text content of an element by ID safely.
 * Logs an error if the element is not found.
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.error(`!!! Element with ID "${id}" NOT FOUND for setTextContent.`);
  } // Keep critical error log
}

/**
 * Helper function to show/hide an element safely.
 */
function setVisible(element, visible) {
  if (element) {
    element.style.display = visible ? "" : "none";
  }
  // No warning needed if element is null, the caller should handle it
}

/**
 * Renders skill or interest tags into a specified container.
 * Logs an error if the container element is not found.
 */
function renderTags(containerId, items, itemType = "items") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(
      `!!! Container with ID "${containerId}" NOT FOUND for renderTags.`
    );
    return;
  } // Keep critical error log
  container.innerHTML = "";
  if (items && Array.isArray(items) && items.length > 0) {
    items.forEach((item) => {
      if (item && item.trim() !== "") {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = item.trim();
        container.appendChild(tag);
      }
    });
  } else {
    const noItems = document.createElement("p");
    noItems.textContent = `No ${itemType} listed.`;
    noItems.style.color = "var(--muted-color)";
    noItems.style.fontStyle = "italic";
    container.appendChild(noItems);
  }
} // End renderTags
