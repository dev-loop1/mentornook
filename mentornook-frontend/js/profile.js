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
  const profileForm = document.getElementById("profile-form");
  const profileViewPage = document.querySelector(".profile-view-page");

  if (profileForm) {
    // If profile setup/edit form exists on the page, run its setup logic
    setupProfileForm();
  } else if (profileViewPage) {
    // If on a profile view page (own or other), run the view logic
    loadProfileView();
  }
});

// --- Profile Setup/Edit Functions ---

// Global variable to store loaded profile data (used for image preview reset)
let currentProfileData = null;

/**
 * Sets up the profile creation/editing form: loads data, initializes tags, handles submit/delete.
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

  // --- Initialize Tag Inputs ---
  // Assumes initializeTagInput function is defined (e.g., in utils.js)
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
  // --- End Tag Input Initialization ---

  // --- Load Existing Profile Data ---
  submitButton.textContent = "Loading Profile...";
  submitButton.disabled = true;

  try {
    const response = await WorkspaceApi("/profile/", "GET", null, true); // Fetch own profile

    if (response.success && response.data) {
      currentProfileData = response.data; // Store loaded data
      formTitle.textContent = "Edit Your Profile";
      populateProfileForm(response.data); // Populate form with fetched data
    } else if (response.success && response.data === null) {
      // Profile doesn't exist yet (new user)
      formTitle.textContent = "Setup Your Profile";
      if (profilePicPreview)
        profilePicPreview.src = "assets/images/profile_avatar_default.png";
      currentProfileData = null; // Ensure current data is null if none loaded
    } else {
      // Error fetching profile
      showGeneralError(
        "profile-general-error",
        response.error || "Failed to load profile data."
      );
      formTitle.textContent = "Setup Your Profile"; // Default title on error
      if (profilePicPreview)
        profilePicPreview.src = "assets/images/profile_avatar_default.png";
    }
  } catch (error) {
    console.error("Error loading profile for edit:", error);
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
  // --- End Loading Profile Data ---

  // --- Image Preview Handler ---
  if (profilePicInput && profilePicPreview) {
    profilePicInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          profilePicPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
        clearError("profile-picture-error");
      } else if (file) {
        showError("profile-picture-error", "Please select a valid image file.");
        // Reset preview to current loaded image or default
        profilePicPreview.src =
          currentProfileData?.profile_picture_url ||
          "assets/images/profile_avatar_default.png";
        profilePicInput.value = ""; // Clear the invalid file selection
      }
    });
  }
  // --- End Image Preview Handler ---

  // --- Form Submission Handler ---
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors(profileForm);
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    // --- Frontend Validation ---
    let isValid = true;
    const skillsValue = document.getElementById("profile-skills").value; // From hidden input
    const interestsValue = document.getElementById("profile-interests").value; // From hidden input
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
    // Add other validation as needed...

    if (!isValid) {
      submitButton.disabled = false;
      submitButton.textContent = "Save Profile";
      showGeneralError(
        "profile-general-error",
        "Please fix the errors highlighted above."
      );
      return; // Stop if validation fails
    }
    // --- End Validation ---

    // --- Prepare Data (Handle potential Image Upload) ---
    const formElementDataForRead = new FormData(profileForm); // Use FormData to easily read most fields
    const imageFile = profilePicInput.files[0]; // Check if a new file was selected
    let dataToSend;
    let method = "PUT"; // Use PUT for updating existing or creating new profile via this endpoint

    const skillsString = document.getElementById("profile-skills").value || "";
    const interestsString =
      document.getElementById("profile-interests").value || "";

    if (imageFile) {
      // Use FormData if a new image file is selected
      dataToSend = new FormData();
      dataToSend.append("role", formElementDataForRead.get("role"));
      dataToSend.append("headline", formElementDataForRead.get("headline"));
      dataToSend.append("bio", formElementDataForRead.get("bio"));
      dataToSend.append("skills", skillsString); // Send string from hidden input
      dataToSend.append("interests", interestsString); // Send string from hidden input
      dataToSend.append("location", formElementDataForRead.get("location"));
      dataToSend.append(
        "linkedin_url",
        formElementDataForRead.get("linkedin_url")
      );
      dataToSend.append(
        "website_url",
        formElementDataForRead.get("website_url")
      );
      // Append the image file - 'profile_picture' must match backend Model/Serializer field name
      dataToSend.append("profile_picture", imageFile, imageFile.name);
    } else {
      // Use plain JSON object if no new image is selected
      dataToSend = {
        role: formElementDataForRead.get("role"),
        headline: formElementDataForRead.get("headline"),
        bio: formElementDataForRead.get("bio"),
        skills: skillsString, // Send string from hidden input
        interests: interestsString, // Send string from hidden input
        location: formElementDataForRead.get("location"),
        linkedin_url: formElementDataForRead.get("linkedin_url"),
        website_url: formElementDataForRead.get("website_url"),
        // NOTE: We specifically DO NOT include 'profile_picture' field here
        // to avoid accidentally clearing it on the backend if null is sent.
        // DRF handles PATCH/PUT correctly if a field is omitted.
      };
    }
    // --- End Data Preparation ---

    console.log("--- Seile Data ---");
    if (dataToSend instanceof FormData) {
      // Log FormData entries (won't show file content easily)
      for (let pair of dataToSend.entries()) {
        console.log(pair[0] + ": " + pair[1]);
      }
    } else {
      // Log JSON object
      console.log(JSON.stringify(dataToSend, null, 2));
    }
    // The actual API call follows:
    // const response = await WorkspaceApi('/profile/', method, dataToSend, true);nding Prof

    // --- Call Backend API to Save ---
    try {
      const response = await WorkspaceApi(
        "/profile/",
        method,
        dataToSend,
        true
      ); // requiresAuth is true

      if (response.success) {
        window.location.href = "my_profile.html"; // Redirect on success
      } else {
        // Attempt to display specific backend validation errors
        let errorMessage = response.error || "Failed to save profile.";
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
      console.error("Error saving profile:", error);
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
      if (
        confirm(
          "Are you sure you want to delete your profile? This action cannot be undone and will log you out."
        )
      ) {
        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";
        try {
          const response = await WorkspaceApi(
            "/profile/",
            "DELETE",
            null,
            true
          ); // requiresAuth is true

          if (response.success || response.status === 204) {
            // Treat 204 as success
            alert("Profile deleted successfully.");
            clearAuthInfo(); // Log user out
            window.location.href = "index.html"; // Redirect to homepage
          } else {
            alert(
              `Failed to delete profile: ${response.error || "Unknown error"}`
            );
            deleteButton.disabled = false;
            deleteButton.textContent = "Delete Profile";
          }
        } catch (error) {
          console.error("Error deleting profile:", error);
          alert(`An error occurred: ${error.message || "Please try again."}`);
          deleteButton.disabled = false;
          deleteButton.textContent = "Delete Profile";
        }
      }
    });
  } else {
    console.warn("Delete profile button not found.");
  }
  // --- End Delete Profile Handler ---
} // End setupProfileForm

/**
 * Populates the profile form fields with existing data, including initializing visual tags.
 * @param {object} profile - The profile data object from the API (response.data).
 */
function populateProfileForm(profile) {
  if (!profile) return;

  // Populate standard fields
  const roleInput = document.querySelector(
    `input[name="role"][value="${profile.role}"]`
  );
  if (roleInput) {
    roleInput.checked = true;
  } else if (profile.role) {
    console.warn(`Could not find radio button for role: ${profile.role}`);
  }

  // Use helper to safely set value or empty string
  const setInputValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  setInputValue("profile-headline", profile.headline);
  setInputValue("profile-bio", profile.bio);
  setInputValue("profile-location", profile.location);
  setInputValue("profile-linkedin", profile.linkedin_url);
  setInputValue("profile-website", profile.website_url);

  // Set profile picture preview
  const profilePicPreview = document.getElementById("profile-pic-preview");
  if (profilePicPreview) {
    profilePicPreview.src =
      profile.profile_picture_url || "assets/images/profile_avatar_default.png";
  }

  // --- Populate Tag Inputs ---
  const skillsHiddenInput = document.getElementById("profile-skills");
  const interestsHiddenInput = document.getElementById("profile-interests");

  // Use the *_list fields from the serializer response data
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

  // Refresh the visual tags using the function attached by initializeTagInput
  const skillsContainer = document.getElementById("profile-skills-container");
  const interestsContainer = document.getElementById(
    "profile-interests-container"
  );
  if (skillsContainer?.refreshTags) skillsContainer.refreshTags();
  if (interestsContainer?.refreshTags) interestsContainer.refreshTags();
} // End populateProfileForm

// --- Profile View Functions ---

/**
 * Loads and displays the profile data for either the logged-in user or another user.
 */
async function loadProfileView() {
  const profileContent = document.getElementById("profile-content");
  const loadingMessage = document.getElementById("loading-profile-message");
  const errorMessage = document.getElementById("error-profile-message");

  if (!profileContent || !loadingMessage || !errorMessage) {
    console.error("Profile view elements not found.");
    return;
  }

  const params = getUrlParams();
  const userIdFromUrl = params.id;
  const token = getAuthToken(); // Needed even for public view if connection status relies on it
  const loggedInUserInfo = getUserInfo();
  // Ensure consistent type comparison (e.g., both strings)
  const isOwnProfile =
    !userIdFromUrl ||
    (loggedInUserInfo && String(userIdFromUrl) === String(loggedInUserInfo.id));
  const targetUserId = isOwnProfile ? loggedInUserInfo?.id : userIdFromUrl;

  if (!targetUserId) {
    loadingMessage.style.display = "none";
    errorMessage.textContent = "Could not determine which profile to load.";
    errorMessage.style.display = "block";
    if (isOwnProfile && !loggedInUserInfo) window.location.href = "login.html";
    return;
  }

  loadingMessage.style.display = "block";
  profileContent.style.display = "none";
  errorMessage.style.display = "none";

  try {
    // Determine correct endpoint based on viewing own vs other's profile
    const endpoint = isOwnProfile ? "/profile/" : `/profiles/${targetUserId}/`;
    // Determine if auth is strictly needed (e.g., for connection status). Assume yes for now.
    const requiresAuth = true;
    const response = await WorkspaceApi(endpoint, "GET", null, requiresAuth);

    if (response.success && response.data) {
      // Log received data for debugging if needed
      // console.log('Profile Data Received:', JSON.stringify(response.data, null, 2));
      renderProfileData(response.data, isOwnProfile, loggedInUserInfo?.id);
      profileContent.style.display = "block"; // Show content only after successful render setup
    } else {
      errorMessage.textContent =
        response.error || "Profile could not be loaded.";
      errorMessage.style.display = "block";
    }
  } catch (error) {
    console.error("Error loading profile view:", error);
    errorMessage.textContent = error.message || "An unexpected error occurred.";
    errorMessage.style.display = "block";
  } finally {
    loadingMessage.style.display = "none";
  }
} // End loadProfileView

/**
 * Renders the fetched profile data onto the page.
 * @param {object} profile - The profile data object (response.data).
 * @param {boolean} isOwnProfile - Flag indicating if viewing own profile.
 * @param {string|number|null} loggedInUserId - The ID of the currently logged-in user.
 */
function renderProfileData(profile, isOwnProfile, loggedInUserId) {
  // Basic check for essential data
  if (!profile || !profile.user) {
    // console.error("Invalid profile data received for rendering:", profile);
    setTextContent(
      "error-profile-message",
      "Failed to render profile: Invalid data."
    );
    setVisible(document.getElementById("error-profile-message"), true);
    return;
  }
  // Ensure loggedInUserId is consistently a string or null for comparisons
  const currentUserId = loggedInUserId ? String(loggedInUserId) : null;
  const profileUserId = String(profile.user.id);

  // Set page title
  const displayName = profile.name || profile.user.username;
  document.title = isOwnProfile
    ? `My Profile - MentorNook`
    : `${displayName}'s Profile - MentorNook`;

  // Populate Header Info
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

  const roleElement = document.getElementById("profile-view-role");
  if (roleElement) {
    roleElement.textContent = profile.role || "Role not specified";
    roleElement.className = "user-role"; // Reset class
    if (profile.role) roleElement.classList.add(profile.role);
  }

  // Populate Detailed Sections
  setTextContent("profile-view-bio", profile.bio || "No bio provided.");

  // Render tags using *_list fields from backend
  renderTags("profile-view-skills", profile.skills_list, "skills");
  renderTags("profile-view-interests", profile.interests_list, "interests");

  // Populate Contact Info & Links (using setVisible helper)
  const locationEl = document.getElementById("profile-view-location");
  const linkedinEl = document.getElementById("profile-view-linkedin");
  const websiteEl = document.getElementById("profile-view-website");

  setVisible(locationEl, !!profile.location);
  if (profile.location && locationEl)
    locationEl.textContent = `Location: ${profile.location}`;

  setVisible(linkedinEl, !!profile.linkedin_url);
  if (profile.linkedin_url && linkedinEl)
    linkedinEl.innerHTML = `LinkedIn: <a href="${profile.linkedin_url}" target="_blank" rel="noopener noreferrer">View Profile</a>`;

  setVisible(websiteEl, !!profile.website_url);
  if (profile.website_url && websiteEl)
    websiteEl.innerHTML = `Website: <a href="${profile.website_url}" target="_blank" rel="noopener noreferrer">${profile.website_url}</a>`;

  // Setup Action Button (Edit or Connection)
  const actionArea = document.getElementById("connection-action-area");
  const editButton = document.querySelector(".edit-profile-btn");

  if (isOwnProfile) {
    setVisible(editButton, true);
    setVisible(actionArea, false);
  } else {
    setVisible(editButton, false);
    setVisible(actionArea, true);
    if (actionArea) {
      // Pass the connectionStatus received from the backend
      setupConnectionButton(
        actionArea,
        profileUserId,
        profile.connectionStatus,
        currentUserId
      );
    }
  }
  console.log("renderProfileData finished.");
} // End renderProfileData

// --- Connection Button Setup & Handling ---

/**
 * Sets up the appropriate connection button/status display.
 * @param {HTMLElement} container - The container element for the button/status.
 * @param {string} targetUserId - The ID of the profile user being viewed.
 * @param {string} status - The connection status ('none', 'pending_sent', 'pending_received', 'connected', 'self').
 * @param {string|null} loggedInUserId - The ID of the currently logged-in user.
 */
function setupConnectionButton(
  container,
  targetUserId,
  status,
  loggedInUserId
) {
  if (!container) return;
  container.innerHTML = ""; // Clear previous content

  // No button needed if not logged in or viewing own profile
  if (
    !loggedInUserId ||
    String(loggedInUserId) === String(targetUserId) ||
    status === "self"
  ) {
    return;
  }

  let button;
  let statusText;
  let buttonContainer = document.createElement("div"); // Use a container for flex/layout if needed
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "0.5rem"; // Add space between buttons

  switch (status) {
    case "pending_sent":
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Request Sent";
      container.appendChild(statusText);

      button = document.createElement("button");
      button.className = "btn btn-warning btn-sm";
      button.textContent = "Cancel Request";
      button.dataset.action = "cancel"; // Action determines DELETE
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button); // Append directly or to buttonContainer
      break;

    case "pending_received":
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Request Received";
      container.appendChild(statusText); // Display status text

      // Add Accept/Decline buttons to the container
      const acceptBtn = document.createElement("button");
      acceptBtn.className = "btn btn-success btn-sm";
      acceptBtn.textContent = "Accept";
      acceptBtn.dataset.action = "accept"; // Action determines PUT data
      acceptBtn.dataset.targetUserId = targetUserId;
      buttonContainer.appendChild(acceptBtn);

      const declineBtn = document.createElement("button");
      declineBtn.className = "btn btn-danger btn-sm";
      declineBtn.textContent = "Decline";
      declineBtn.dataset.action = "decline"; // Action determines PUT data
      declineBtn.dataset.targetUserId = targetUserId;
      buttonContainer.appendChild(declineBtn);

      container.appendChild(buttonContainer); // Append the container with buttons
      break;

    case "connected":
      statusText = document.createElement("p");
      statusText.className = "connection-status";
      statusText.textContent = "Connected";
      container.appendChild(statusText);

      button = document.createElement("button");
      button.className = "btn btn-danger btn-sm";
      button.textContent = "Remove Connection";
      button.dataset.action = "remove"; // Action determines DELETE
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button);
      break;

    case "none":
    default: // Fallback or 'none' status
      button = document.createElement("button");
      button.id = "send-request-btn";
      button.className = "btn btn-primary";
      button.textContent = "Send Mentorship Request";
      button.dataset.action = "send"; // Action determines POST
      button.dataset.targetUserId = targetUserId;
      container.appendChild(button);
      break;
  }

  // Attach single listener to the container for event delegation
  container.removeEventListener("click", handleConnectionActionClick); // Remove old one first
  container.addEventListener("click", handleConnectionActionClick);
} // End setupConnectionButton

/**
 * Handles clicks on connection action buttons (delegated from container).
 * @param {Event} event - The click event object.
 */
async function handleConnectionActionClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return; // Exit if click wasn't on an action button

  const action = button.dataset.action;
  const targetUserId = button.dataset.targetUserId; // ID of the profile being viewed
  const token = getAuthToken();
  const actionArea = button.closest("#connection-action-area"); // The container div
  const loggedInUserInfo = getUserInfo();

  if (!action || !targetUserId || !token || !actionArea || !loggedInUserInfo) {
    console.error("Connection action cannot proceed: Missing required data.");
    alert("Cannot perform action. Please ensure you are logged in.");
    return;
  }

  // Disable all buttons within the action area during processing
  const buttonsInArea = actionArea.querySelectorAll("button");
  buttonsInArea.forEach((btn) => (btn.disabled = true));
  const originalText = button.textContent; // Store original text of clicked button
  button.textContent = "Processing..."; // Provide visual feedback

  try {
    let response;
    let connectionId = null; // Required for PUT/DELETE actions

    // Find connection ID only if needed (action is not 'send')
    if (action !== "send") {
      const connectionsResponse = await WorkspaceApi(
        "/connections/",
        "GET",
        null,
        true
      );
      if (connectionsResponse.success && connectionsResponse.data) {
        const { incoming, outgoing, current } = connectionsResponse.data;
        const allConnections = [...incoming, ...outgoing, ...current];
        // Find connection where one party is loggedInUser and other is targetUser
        const connection = allConnections.find(
          (c) =>
            (String(c.requester?.id) === String(loggedInUserInfo.id) &&
              String(c.receiver?.id) === String(targetUserId)) ||
            (String(c.receiver?.id) === String(loggedInUserInfo.id) &&
              String(c.requester?.id) === String(targetUserId))
        );
        connectionId = connection?.id;
      }
      if (!connectionId) {
        // If no connection ID found, maybe the state is stale or request invalid
        throw new Error(
          `Could not find relevant connection/request involving user ${targetUserId} to perform action '${action}'.`
        );
      }
    }

    // Perform API Call based on action
    let method;
    let endpoint;
    let data = null;

    switch (action) {
      case "send":
        method = "POST";
        endpoint = "/connections/request/";
        data = { user_id: targetUserId }; // Match backend serializer field
        break;
      case "accept":
      case "decline":
        method = "PUT";
        endpoint = `/connections/${connectionId}/`;
        data = { action: action }; // Match backend serializer field
        break;
      case "cancel": // Cancel is DELETE on the specific connection
      case "remove": // Remove is DELETE on the specific connection
        method = "DELETE";
        endpoint = `/connections/${connectionId}/`;
        data = null;
        break;
      default:
        throw new Error(`Unknown connection action: ${action}`);
    }

    console.log(
      `Action: ${action}, Target: ${targetUserId}, ConnID: ${connectionId}, Method: ${method}`
    ); // Log action details
    response = await WorkspaceApi(endpoint, method, data, true); // All connection actions require auth

    // Handle API Response
    if (response.success || response.status === 204) {
      // Treat 204 No Content as success for DELETE
      // Refresh button state by re-fetching profile data which includes updated connectionStatus
      console.log(
        `Action ${action} successful for Target ${targetUserId}. Refreshing button state...`
      ); // Log success
      const profileEndpoint = `/profiles/${targetUserId}/`; // Use public profile endpoint
      const updatedProfileResponse = await WorkspaceApi(
        profileEndpoint,
        "GET",
        null,
        true
      ); // Assume auth needed for status

      if (updatedProfileResponse.success && updatedProfileResponse.data) {
        console.log(
          "Profile refresh successful. Calling setupConnectionButton with status:",
          updatedProfileResponse.data.connectionStatus
        ); // Log before UI update
        // Re-render button section with new status
        setupConnectionButton(
          actionArea,
          targetUserId,
          updatedProfileResponse.data.connectionStatus,
          loggedInUserInfo.id
        );
        console.log("setupConnectionButton potentially complete."); // Log after UI update attempt
      } else {
        console.error(
          "Failed to refresh profile after connection action:",
          updatedProfileResponse.error
        );
        actionArea.innerHTML =
          '<p class="error-message">Action successful, but failed to refresh status.</p>';
      }
    } else {
      // Action failed on the backend
      alert(`Action failed: ${response.error || "Unknown error"}`);
      // Re-enable buttons ONLY if action failed server-side
      buttonsInArea.forEach((btn) => (btn.disabled = false));
      button.textContent = originalText; // Restore original text
    }
  } catch (error) {
    // Handle unexpected errors (network, connection ID lookup failure, etc.)
    console.error(
      `Error performing connection action '${action}' for user ${targetUserId}:`,
      error
    );
    alert(`An error occurred: ${error.message || "Please try again."}`);
    // Re-enable buttons and restore text on any error
    buttonsInArea.forEach((btn) => (btn.disabled = false));
    button.textContent = originalText;
  }
} // End handleConnectionActionClick

// --- Helper Function Definitions ---
// (These should be defined here or imported if they are in utils.js)

/**
 * Helper function to set text content of an element by ID safely.
 * Logs an error if the element is not found.
 * @param {string} id - The ID of the element.
 * @param {string} text - The text content to set.
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.error(`!!! Element with ID "${id}" NOT FOUND for setTextContent.`);
  }
}

/**
 * Helper function to show/hide an element safely.
 * @param {HTMLElement|null} element - The DOM element.
 * @param {boolean} visible - True to show, false to hide.
 */
function setVisible(element, visible) {
  if (element) {
    element.style.display = visible ? "" : "none"; // Use '' to reset to default display
  }
}

/**
 * Renders skill or interest tags into a specified container.
 * Logs an error if the container element is not found.
 * @param {string} containerId - The ID of the container element for tags.
 * @param {string[]} items - An array of strings (skills or interests).
 * @param {string} itemType - A string ('skills' or 'interests') for placeholder text.
 */
function renderTags(containerId, items, itemType = "items") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(
      `!!! Container with ID "${containerId}" NOT FOUND for renderTags.`
    );
    return;
  }
  container.innerHTML = ""; // Clear previous tags
  if (items && Array.isArray(items) && items.length > 0) {
    items.forEach((item) => {
      if (item && item.trim() !== "") {
        // Ensure item is not empty string
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
