/**
 * profile.js
 * Handles logic for:
 * 1. Profile setup and editing form (profile_setup.html) - including tag inputs & image upload.
 * 2. Displaying user profiles (my_profile.html, user_profile.html) - including tags and connection actions.
 *
 * Assumes functions from utils.js (like getAuthToken, WorkspaceApi, initializeTagInput, etc.) are available.
 */

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const profileViewPage = document.querySelector('.profile-view-page');

    if (profileForm) {
        setupProfileForm();
    } else if (profileViewPage) {
        loadProfileView();
    }
});

// --- Profile Setup/Edit Functions ---

let currentProfileData = null; // Store loaded profile data

async function setupProfileForm() {
    const profileForm = document.getElementById('profile-form');
    const formTitle = document.getElementById('profile-form-title');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const profilePicInput = document.getElementById('profile-picture');
    const deleteButton = document.getElementById('delete-profile-button');
    const generalError = document.getElementById('profile-general-error');
    const submitButton = profileForm.querySelector('button[type="submit"]');

    if (!profileForm || !submitButton || !formTitle || !profilePicInput) {
        console.error("Profile form setup failed: Essential form elements not found.");
        return;
    }

    const token = getAuthToken();
    if (!token) {
        console.warn("Not authenticated. Redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    // Initialize Tag Inputs
    initializeTagInput('profile-skills-container', 'profile-skills-input', 'profile-skills-tags', 'profile-skills');
    initializeTagInput('profile-interests-container', 'profile-interests-input', 'profile-interests-tags', 'profile-interests');

    // Load existing profile data
    submitButton.textContent = 'Loading Profile...';
    submitButton.disabled = true;

    try {
        // **FIXED:** Endpoint URL and requiresAuth
        const response = await WorkspaceApi('/profile/', 'GET', null, true); // Use true for requiresAuth

        // **FIXED:** Check success and access response.data
        if (response.success && response.data) {
            currentProfileData = response.data; // Store loaded data
            formTitle.textContent = 'Edit Your Profile';
            populateProfileForm(response.data);
        } else if (response.success && response.data === null) { // Check for explicit null if profile doesn't exist yet
            formTitle.textContent = 'Setup Your Profile';
            if (profilePicPreview) profilePicPreview.src = 'assets/images/profile_avatar_default.png';
        } else {
            // **FIXED:** Use response.error
            showGeneralError('profile-general-error', response.error || 'Failed to load profile data.');
            // Set default state on error
            formTitle.textContent = 'Setup Your Profile';
             if (profilePicPreview) profilePicPreview.src = 'assets/images/profile_avatar_default.png';
        }
    } catch (error) {
        console.error("Error loading profile for edit:", error);
        showGeneralError('profile-general-error', 'An error occurred while loading your profile.');
        formTitle.textContent = 'Setup Your Profile';
        if (profilePicPreview) profilePicPreview.src = 'assets/images/profile_avatar_default.png';
    } finally {
        submitButton.textContent = 'Save Profile';
        submitButton.disabled = false;
    }

    // Image Preview Handler (no changes needed here)
    if (profilePicInput && profilePicPreview) {
        profilePicInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => { profilePicPreview.src = e.target.result; }
                reader.readAsDataURL(file);
                clearError('profile-picture-error');
            } else if (file) {
                showError('profile-picture-error', 'Please select a valid image file.');
                // **FIXED:** Use correct field for resetting preview
                profilePicPreview.src = currentProfileData?.profile_picture_url || 'assets/images/profile_avatar_default.png';
            }
        });
    }

    // Form Submission Handler
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAllErrors(profileForm);
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        // --- Frontend Validation --- (no changes needed here)
        let isValid = true;
        // Use hidden input values for validation
        const skillsValue = document.getElementById('profile-skills').value;
        const interestsValue = document.getElementById('profile-interests').value;
        const roleValue = profileForm.querySelector('input[name="role"]:checked')?.value;
        const bioValue = document.getElementById('profile-bio').value;

        if (!roleValue) { showError('role-error', 'Please select your role.'); isValid = false; }
        if (isEmpty(bioValue)) { showError('bio-error', 'Bio cannot be empty.'); isValid = false; }
        if (isEmpty(skillsValue)) { showError('skills-error', 'Skills cannot be empty. Type a skill and press Enter.'); isValid = false; }
        if (isEmpty(interestsValue)) { showError('interests-error', 'Interests cannot be empty. Type an interest and press Enter.'); isValid = false; }

        if (!isValid) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Profile';
            showGeneralError('profile-general-error', 'Please fix the errors highlighted above.');
            return;
        }
        // --- End Validation ---


        // --- Prepare Data (Handle Image Upload) ---
        // **FIXED:** Handle image upload using FormData
        const formElementData = new FormData(profileForm); // Use FormData to easily get most fields
        const imageFile = profilePicInput.files[0];
        let dataToSend;
        let method = 'PUT'; // Or PATCH if backend supports partial updates

        if (imageFile) {
            // If a new image is selected, use FormData
            dataToSend = new FormData();
            // Append standard fields from formElementData (ensure names match backend)
            dataToSend.append('role', formElementData.get('role'));
            dataToSend.append('headline', formElementData.get('headline'));
            dataToSend.append('bio', formElementData.get('bio'));
            dataToSend.append('skills', formElementData.get('skills')); // Comma-separated string from hidden input
            dataToSend.append('interests', formElementData.get('interests')); // Comma-separated string from hidden input
            dataToSend.append('location', formElementData.get('location'));
            dataToSend.append('linkedin_url', formElementData.get('linkedin_url'));
            dataToSend.append('website_url', formElementData.get('website_url'));
            // Append the image file - 'profile_picture' must match backend field name
            dataToSend.append('profile_picture', imageFile, imageFile.name);
        } else {
            // If no new image, send JSON data (excluding profile_picture)
            dataToSend = {
                role: formElementData.get('role'),
                headline: formElementData.get('headline'),
                bio: formElementData.get('bio'),
                // **FIXED:** Send skills/interests as arrays if backend serializer expects lists
                skills: (formElementData.get('skills') || '').split(',').map(s => s.trim()).filter(s => s),
                interests: (formElementData.get('interests') || '').split(',').map(i => i.trim()).filter(i => i),
                location: formElementData.get('location'),
                linkedin_url: formElementData.get('linkedin_url'),
                website_url: formElementData.get('website_url'),
            };
        }
        // --- End Data Preparation ---

        try {
            // **FIXED:** Endpoint URL, pass dataToSend, requiresAuth: true
            const response = await WorkspaceApi('/profile/', method, dataToSend, true);

            // **FIXED:** Check success and use response.error
            if (response.success) {
                window.location.href = 'my_profile.html';
            } else {
                showGeneralError('profile-general-error', response.error || 'Failed to save profile.');
                submitButton.disabled = false;
                submitButton.textContent = 'Save Profile';
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            showGeneralError('profile-general-error', error.message || 'An unexpected error occurred.');
            submitButton.disabled = false;
            submitButton.textContent = 'Save Profile';
        }
    });

    // Delete Profile Handler
    if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete your profile? This action cannot be undone and will log you out.')) {
                deleteButton.disabled = true;
                deleteButton.textContent = 'Deleting...';
                try {
                    // **FIXED:** Endpoint URL, requiresAuth: true
                    const response = await WorkspaceApi('/profile/', 'DELETE', null, true);

                    // **FIXED:** Check success and use response.error
                    if (response.success || response.status === 204) { // 204 No Content is success for DELETE
                        alert('Profile deleted successfully.');
                        clearAuthInfo();
                        window.location.href = 'index.html';
                    } else {
                        alert(`Failed to delete profile: ${response.error || 'Unknown error'}`);
                        deleteButton.disabled = false;
                        deleteButton.textContent = 'Delete Profile';
                    }
                } catch (error) {
                    console.error("Error deleting profile:", error);
                    alert(`An error occurred: ${error.message || 'Please try again.'}`);
                    deleteButton.disabled = false;
                    deleteButton.textContent = 'Delete Profile';
                }
            }
        });
    } else {
        console.warn("Delete profile button not found.");
    }
} // End setupProfileForm


/**
 * Populates the profile form fields with existing data, including initializing visual tags.
 * @param {object} profile - The profile data object from the API (response.data).
 */
function populateProfileForm(profile) {
    if (!profile) return;

    const roleInput = document.querySelector(`input[name="role"][value="${profile.role}"]`);
    if (roleInput) roleInput.checked = true;

    document.getElementById('profile-headline').value = profile.headline || '';
    document.getElementById('profile-bio').value = profile.bio || '';
    document.getElementById('profile-location').value = profile.location || '';
    document.getElementById('profile-linkedin').value = profile.linkedin_url || '';
    document.getElementById('profile-website').value = profile.website_url || '';

    const profilePicPreview = document.getElementById('profile-pic-preview');
    if (profilePicPreview) {
        // **FIXED:** Use profile_picture_url from backend
        profilePicPreview.src = profile.profile_picture_url || 'assets/images/profile_avatar_default.png';
    }

    // --- Populate Tag Inputs ---
    const skillsHiddenInput = document.getElementById('profile-skills');
    const interestsHiddenInput = document.getElementById('profile-interests');

    if (skillsHiddenInput) {
        // **FIXED:** Use skills_list array from backend
        skillsHiddenInput.value = profile.skills_list && Array.isArray(profile.skills_list) ? profile.skills_list.join(',') : '';
    }
    if (interestsHiddenInput) {
        // **FIXED:** Use interests_list array from backend
        interestsHiddenInput.value = profile.interests_list && Array.isArray(profile.interests_list) ? profile.interests_list.join(',') : '';
    }

    // Refresh visual tags based on hidden inputs
    const skillsContainer = document.getElementById('profile-skills-container');
    const interestsContainer = document.getElementById('profile-interests-container');
    if (skillsContainer?.refreshTags) skillsContainer.refreshTags(); // Use optional chaining
    if (interestsContainer?.refreshTags) interestsContainer.refreshTags(); // Use optional chaining

} // End populateProfileForm


// --- Profile View Functions ---

async function loadProfileView() {
    // Get elements for displaying data and messages
    const profileContent = document.getElementById('profile-content');          // Checks for this ID
    const loadingMessage = document.getElementById('loading-profile-message'); // Checks for this ID
    const errorMessage = document.getElementById('error-profile-message');     // Checks for this ID

    // Ensure display elements exist
    if (!profileContent || !loadingMessage || !errorMessage) { // <--- Your error happens here
        console.error("Profile view elements not found.");     // <--- Your error message
        return; // Function stops if any element is missing
    }

    const params = getUrlParams();
    const userIdFromUrl = params.id;
    const token = getAuthToken();
    const loggedInUserInfo = getUserInfo();
    const isOwnProfile = !userIdFromUrl || (loggedInUserInfo && String(userIdFromUrl) === String(loggedInUserInfo.id)); // Consistent ID comparison
    const targetUserId = isOwnProfile ? loggedInUserInfo?.id : userIdFromUrl;

    if (!targetUserId) {
        loadingMessage.style.display = 'none';
        errorMessage.textContent = 'Could not determine which profile to load.';
        errorMessage.style.display = 'block';
        if (isOwnProfile && !loggedInUserInfo) window.location.href = 'login.html';
        return;
    }

    loadingMessage.style.display = 'block';
    profileContent.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const endpoint = isOwnProfile ? '/profile/' : `/profiles/${targetUserId}/`;
        const requiresAuth = true; // Or false if public profiles allowed
        const response = await WorkspaceApi(endpoint, 'GET', null, requiresAuth);
    
        if (response.success && response.data) {
            // **** ADD THIS LINE: ****
            console.log('Profile Data Received:', JSON.stringify(response.data, null, 2));
            // **** END OF ADDED LINE ****
    
            renderProfileData(response.data, isOwnProfile, loggedInUserInfo?.id);
            profileContent.style.display = 'block';
        } else {
            // **FIXED:** Use response.error
            errorMessage.textContent = response.error || 'Profile could not be loaded.';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error("Error loading profile view:", error);
        errorMessage.textContent = error.message || 'An unexpected error occurred.';
        errorMessage.style.display = 'block';
    } finally {
        loadingMessage.style.display = 'none';
    }
} // End loadProfileView


/**
 * Renders the fetched profile data onto the page.
 * @param {object} profile - The profile data object (response.data).
 * @param {boolean} isOwnProfile - Flag indicating if viewing own profile.
 * @param {string|null} loggedInUserId - The ID of the currently logged-in user.
 */
function renderProfileData(profile, isOwnProfile, loggedInUserId) {
    if (!profile || !profile.user) { // Check for essential data
         console.error("Invalid profile data received for rendering:", profile);
         // Optionally show an error message on the page
         setTextContent('error-profile-message', 'Failed to render profile: Invalid data.');
         setVisible(document.getElementById('error-profile-message'), true);
         return;
    }

    if (!isOwnProfile) {
        document.title = `${profile.name || profile.user.username}'s Profile - MentorNook`;
    } else {
         document.title = `My Profile - MentorNook`;
    }

    // Populate Header Info
    const profilePic = document.getElementById('profile-view-picture');
    if (profilePic) {
        // **FIXED:** Use profile_picture_url
        profilePic.src = profile.profile_picture_url || 'assets/images/profile_avatar_default.png';
        profilePic.alt = `${profile.name || profile.user.username}'s profile picture`;
    }
    setTextContent('profile-view-name', profile.name || profile.user.username);
    setTextContent('profile-view-headline', profile.headline || 'No headline provided');

    const roleElement = document.getElementById('profile-view-role');
    if (roleElement) {
        roleElement.textContent = profile.role || 'Role not specified';
        roleElement.className = 'user-role';
        if (profile.role) roleElement.classList.add(profile.role);
    }

    // Populate Detailed Sections
    setTextContent('profile-view-bio', profile.bio || 'No bio provided.');

    // **FIXED:** Render tags using _list fields
    renderTags('profile-view-skills', profile.skills_list, 'skills');
    renderTags('profile-view-interests', profile.interests_list, 'interests');

    // Populate Contact Info & Links
    const locationEl = document.getElementById('profile-view-location');
    const linkedinEl = document.getElementById('profile-view-linkedin');
    const websiteEl = document.getElementById('profile-view-website');

    setVisible(locationEl, !!profile.location);
    if (profile.location && locationEl) locationEl.textContent = `Location: ${profile.location}`;

    setVisible(linkedinEl, !!profile.linkedin_url);
    if (profile.linkedin_url && linkedinEl) linkedinEl.innerHTML = `LinkedIn: <a href="${profile.linkedin_url}" target="_blank" rel="noopener noreferrer">View Profile</a>`;

    setVisible(websiteEl, !!profile.website_url);
    if (profile.website_url && websiteEl) websiteEl.innerHTML = `Website: <a href="${profile.website_url}" target="_blank" rel="noopener noreferrer">${profile.website_url}</a>`;

    // Setup Action Button
    const actionArea = document.getElementById('connection-action-area');
    const editButton = document.querySelector('.edit-profile-btn');

    if (isOwnProfile) {
        setVisible(editButton, true);
        setVisible(actionArea, false);
    } else {
        setVisible(editButton, false);
        setVisible(actionArea, true);
        if (actionArea) {
            // **FIXED:** Pass correct target user ID (profile.user.id)
             // Pass connectionStatus if provided by backend (Needs backend serializer update)
             // For now, assume it needs fetching or pass undefined.
             // Let's assume backend ProfileSerializer includes connectionStatus relative to request.user
            setupConnectionButton(actionArea, profile.user.id, profile.connectionStatus, loggedInUserId);
        }
    }
} // End renderProfileData


// --- Helper functions (keep setTextContent, setVisible, renderTags as they are) ---
function setTextContent(id, text) { /* ... keep existing ... */ }
function setVisible(element, visible) { /* ... keep existing ... */ }
function renderTags(containerId, items, itemType = 'items') { /* ... keep existing ... */ }


// --- Connection Button Setup & Handling (keep existing setupConnectionButton and handleConnectionActionClick, but fix issues within handleConnectionActionClick) ---

function setupConnectionButton(container, targetUserId, status, loggedInUserId) { /* ... keep existing ... */ }


/**
 * Handles clicks on connection action buttons (Send, Accept, Decline, Cancel, Remove)
 * within the profile view page's action area. Determines the connection ID if needed.
 * @param {Event} event - The click event object.
 */
async function handleConnectionActionClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const targetUserId = button.dataset.targetUserId; // ID of the profile being viewed
    const token = getAuthToken();
    const actionArea = button.closest('#connection-action-area');
    const loggedInUserInfo = getUserInfo(); // Get logged in user info

    if (!action || !targetUserId || !token || !actionArea || !loggedInUserInfo) {
        console.error("Connection action cannot proceed: Missing data.");
        alert("Cannot perform action. Please ensure you are logged in.");
        return;
    }

    const buttonsInArea = actionArea.querySelectorAll('button');
    buttonsInArea.forEach(btn => btn.disabled = true);
    const originalText = button.textContent;
    button.textContent = 'Processing...';

    try {
        let response;
        let connectionId = null; // Needed for non-'send' actions

        // Find connection ID if action requires it
        if (action !== 'send') {
            // Fetch current connections to find the ID involving targetUserId
            // **FIXED:** Use correct endpoint and requiresAuth flag
            const connectionsResponse = await WorkspaceApi('/connections/', 'GET', null, true);
            if (connectionsResponse.success && connectionsResponse.data) {
                const { incoming, outgoing, current } = connectionsResponse.data;
                const allConnections = [...incoming, ...outgoing, ...current];
                // Find the connection where the other user matches targetUserId
                 const connection = allConnections.find(c =>
                     (String(c.requester?.id) === String(targetUserId) || String(c.receiver?.id) === String(targetUserId))
                 );
                connectionId = connection?.id; // Use optional chaining for safety
            }
            if (!connectionId) {
                // Attempting action (e.g., cancel) but no existing request/connection found
                // This might happen if state is stale. Refreshing might be better.
                throw new Error(`Could not find connection involving user ${targetUserId} to perform action '${action}'.`);
            }
        }

        // --- Perform API Call based on action ---
        if (action === 'send') {
            // **FIXED:** Endpoint URL, Data payload key ('user_id'), requiresAuth
            response = await WorkspaceApi('/connections/request/', 'POST', { user_id: targetUserId }, true);
        } else if (action === 'accept' || action === 'decline') {
            // **FIXED:** Endpoint URL, requiresAuth
            response = await WorkspaceApi(`/connections/${connectionId}/`, 'PUT', { action: action }, true);
        } else if (action === 'cancel' || action === 'remove') {
             // **FIXED:** Use DELETE for both cancel and remove, Endpoint URL, requiresAuth
            response = await WorkspaceApi(`/connections/${connectionId}/`, 'DELETE', null, true);
        } else {
            throw new Error(`Unknown connection action: ${action}`);
        }

        // --- Handle API Response ---
        // **FIXED:** Check success and use response.error
        if (response.success || response.status === 204) { // Treat 204 No Content as success for DELETE
            // Refresh button state by re-fetching profile data (includes updated connectionStatus)
             // **FIXED:** Use correct endpoint for fetching OTHER user's profile
            const updatedProfileResponse = await WorkspaceApi(`/profiles/${targetUserId}/`, 'GET', null, true); // Assuming requiresAuth for viewing needed for connection status
            if (updatedProfileResponse.success && updatedProfileResponse.data) {
                 // **FIXED:** Pass correct loggedInUserId
                 setupConnectionButton(actionArea, targetUserId, updatedProfileResponse.data.connectionStatus, loggedInUserInfo.id);
            } else {
                console.error("Failed to refresh profile after connection action:", updatedProfileResponse.error);
                actionArea.innerHTML = '<p class="error-message">Action successful, but failed to refresh status.</p>';
            }
        } else {
            // Action failed
            alert(`Action failed: ${response.error || 'Unknown error'}`);
            // Re-enable buttons only if action failed server-side
             buttonsInArea.forEach(btn => btn.disabled = false);
             button.textContent = originalText;
        }
    } catch (error) {
        // Handle unexpected errors
        console.error(`Error performing connection action '${action}' for user ${targetUserId}:`, error);
        alert(`An error occurred: ${error.message || 'Please try again.'}`);
        // Re-enable buttons on error
        buttonsInArea.forEach(btn => btn.disabled = false);
        button.textContent = originalText;
    }
} // End handleConnectionActionClick