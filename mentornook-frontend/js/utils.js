/**
 * utils.js
 * Contains utility functions, authentication helpers, validation, DOM helpers,
 * and the main API communication function (WorkspaceApi).
 */

// --- Constants ---
// TODO: Replace with your actual backend API URL. Add '/api' or appropriate prefix.
const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Example for local Django dev server

// --- DOM Helpers ---

/**
 * Displays an error message for a specific form field.
 * @param {string} elementId - The ID of the error message container element.
 * @param {string} message - The error message to display.
 */
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block'; // Make sure it's visible
    } else {
        console.warn(`Error element not found: ${elementId}`);
    }
}

/**
 * Clears the error message for a specific form field.
 * @param {string} elementId - The ID of the error message container element.
 */
function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none'; // Hide space if needed
    }
}

/**
 * Clears all error messages within a given form element.
 * @param {HTMLFormElement} formElement - The form element containing error messages.
 */
function clearAllErrors(formElement) {
    if (!formElement) return;
    const errorElements = formElement.querySelectorAll('.error-message, .form-error');
    errorElements.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
        if (el.classList.contains('form-error')) {
            el.classList.remove('visible');
        }
    });
}

/**
 * Displays a general form error message.
 * @param {string} elementId - The ID of the general error container (e.g., 'login-general-error').
 * @param {string} message - The message to display.
 */
function showGeneralError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.classList.add('visible');
    } else {
         console.warn(`General error element not found: ${elementId}`);
    }
}


// --- Validation Helpers ---

/**
 * Validates an email address format.
 * @param {string} email - The email address to validate.
 * @returns {boolean} True if the email format is valid, false otherwise.
 */
function validateEmail(email) {
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Validates password length (basic example).
 * @param {string} password - The password to validate.
 * @param {number} minLength - Minimum required length.
 * @returns {boolean} True if the password meets the minimum length requirement.
 */
function validatePassword(password, minLength = 8) {
    return password && password.length >= minLength;
}

/**
 * Checks if a value is empty or whitespace.
 * @param {string} value - The value to check.
 * @returns {boolean} True if the value is empty, false otherwise.
 */
function isEmpty(value) {
    return !value || value.trim() === '';
}

// --- Authentication Helpers (using localStorage) ---

/**
 * Saves the authentication token and basic user info to localStorage.
 * @param {string} token - The authentication token.
 * @param {object} user - Basic user object (e.g., { id, name, username, email }).
 */
function saveAuthInfo(token, user) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('authToken', token);
        localStorage.setItem('userInfo', JSON.stringify(user));
    } else {
        console.error("localStorage is not available.");
    }
}

/**
 * Retrieves the authentication token from localStorage.
 * @returns {string|null} The token or null if not found.
 */
function getAuthToken() {
     if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('authToken');
    }
    return null;
}

/**
 * Retrieves the user info object from localStorage.
 * @returns {object|null} The user object or null if not found/invalid.
 */
function getUserInfo() {
    if (typeof localStorage !== 'undefined') {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                return JSON.parse(userInfo);
            } catch (e) {
                console.error("Error parsing user info from localStorage:", e);
                return null;
            }
        }
    }
    return null;
}

/**
 * Clears authentication token and user info from localStorage.
 */
function clearAuthInfo() {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
    }
}

/**
 * Checks if a user is currently authenticated based on token presence.
 * @returns {boolean} True if an auth token exists.
 */
function isAuthenticated() {
    return !!getAuthToken();
}


// --- URL Helpers ---

/**
 * Parses URL query parameters into an object.
 * @returns {object} An object containing key-value pairs of query parameters.
 */
function getUrlParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while ((m = regex.exec(queryString)) !== null) { // Corrected loop condition
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2].replace(/\+/g, ' ')); // Handle '+' encoding for spaces
    }
    return params;
}

// --- CSRF Token Helper ---

/**
 * Retrieves the CSRF token value from the 'csrftoken' cookie set by Django.
 * @returns {string|null} The CSRF token value or null if not found.
 */
function getCsrfToken() {
    let csrfToken = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.startsWith('csrftoken=')) {
                csrfToken = decodeURIComponent(cookie.substring('csrftoken='.length));
                break;
            }
        }
    }
    // console.log("CSRF Token found:", csrfToken); // For debugging
    return csrfToken;
}


// --- *** Backend API Communication Function *** ---

/**
 * Handles communication with the backend API using fetch.
 * @param {string} endpoint - The API endpoint path (e.g., '/login/', '/users/'). MUST start with '/'.
 * @param {string} [method='GET'] - HTTP method (GET, POST, PUT, DELETE, PATCH).
 * @param {object|FormData|null} [data=null] - Data payload for POST/PUT/PATCH requests. Can be an object or FormData.
 * @param {boolean} [requiresAuth=true] - Whether the request requires an Authorization token.
 * @returns {Promise<object>} A promise resolving with { success: boolean, data?: any, error?: string, status?: number }.
 */
async function WorkspaceApi(endpoint, method = 'GET', data = null, requiresAuth = true) {
    const upperMethod = method.toUpperCase(); // Ensure method is uppercase

    // Input validation
    if (!endpoint || !endpoint.startsWith('/')) {
        console.error("WorkspaceApi Error: Endpoint must be provided and start with '/'.");
        return { success: false, error: "Invalid API endpoint.", status: null };
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'Accept': 'application/json', // We generally expect JSON back
    };
    const token = getAuthToken();

    // Set Authorization header if required
    if (requiresAuth) {
        if (!token) {
            console.error('WorkspaceApi Error: Authentication token missing for protected route:', endpoint);
            // Optionally trigger redirect to login page here if appropriate globally
            // window.location.href = 'login.html';
            return { success: false, error: 'Authentication required. Please log in.', status: 401 };
        }
        // Ensure this matches your Django Authentication scheme (TokenAuthentication uses 'Token')
        headers['Authorization'] = `Token ${token}`;
    }

    // Set CSRF token for state-changing methods
    if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(upperMethod)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        } else {
             console.warn(`WorkspaceApi Warning: CSRF token not found for ${upperMethod} request to ${endpoint}. Request might fail.`);
        }
    }

    // Configure fetch options
    const config = {
        method: upperMethod,
        headers: headers,
    };

    // Handle request body
    if (data) {
        if (data instanceof FormData) {
            // Don't set Content-Type; browser does it for FormData
            config.body = data;
        } else {
            // Assume JSON for other objects
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(data);
        }
    }

    // Perform the fetch call
    try {
        const response = await fetch(url, config);

        // Handle empty response body (e.g., 204 No Content)
        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return { success: true, status: response.status, data: null };
        }

        // Attempt to parse JSON response body
        let responseData;
        try {
            responseData = await response.json();
        } catch (jsonError) {
            // Handle cases where response is not JSON but request didn't fail (e.g., unexpected HTML error page)
             console.error(`WorkspaceApi Error: Failed to parse JSON response from ${endpoint} (Status: ${response.status}). Response Text:`, await response.text().catch(() => 'Could not read response text.'));
             return { success: false, error: `Invalid response format from server (Status: ${response.status}).`, status: response.status };
        }


        // Check if the HTTP status code indicates success (2xx range)
        if (!response.ok) {
            console.error(`WorkspaceApi Error: ${response.status} ${response.statusText} for ${endpoint}`, responseData);
            // Extract detailed error message from backend response if possible
            let errorMessage = responseData.detail || // Common DRF field
                               (Array.isArray(responseData) ? responseData.join(', ') : null) || // Handle list errors
                               (typeof responseData === 'object' ? JSON.stringify(responseData) : `Request failed with status ${response.status}.`); // Fallback
            return { success: false, error: errorMessage, status: response.status, data: responseData };
        }

        // Successful response with JSON data
        return { success: true, data: responseData, status: response.status };

    } catch (error) {
        // Handle network errors, CORS issues, etc.
        console.error(`WorkspaceApi Network/Fetch Error for ${endpoint}:`, error);
        // Provide a user-friendly message for network issues
        return { success: false, error: 'Failed to connect to the server. Please check your network connection.', status: null };
    }
}


// --- Tag Input Logic ---

/**
 * Initializes a tag input component.
 * @param {string} containerId - ID of the main container div.
 * @param {string} inputId - ID of the visible text input element.
 * @param {string} tagsDisplayId - ID of the div where tags will be displayed.
 * @param {string} hiddenInputId - ID of the hidden input storing the comma-separated value.
 */
function initializeTagInput(containerId, inputId, tagsDisplayId, hiddenInputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    const tagsDisplay = document.getElementById(tagsDisplayId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!container || !input || !tagsDisplay || !hiddenInput) {
        console.error("Tag input initialization failed: One or more elements not found.", { containerId, inputId, tagsDisplayId, hiddenInputId });
        return;
    }

    let tags = []; // Internal state for tags

    // Function to update the hidden input value from the tags array
    function updateHiddenInput() {
        hiddenInput.value = tags.join(',');
        // Optionally trigger change event for validation libraries etc.
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Clear any specific error related to this field if tags now exist
        if (tags.length > 0) {
            // Try to derive error element ID (assumes pattern like 'profile-skills-error' or 'filter-skills-error')
            const baseId = hiddenInputId.replace(/^profile-|^filter-/, ''); // Remove prefixes
            const errorElementId = `${baseId}-error`;
            clearError(errorElementId);
        }
    }

     // Function to create and add a tag visually and to the array
     function addTag(text) {
         const tagText = text.trim().replace(/,/g, ''); // Remove commas from tag text itself
         if (tagText.length < 1 || tags.includes(tagText)) {
             input.value = ''; // Clear input even if tag not added
             return; // Prevent empty or duplicate tags
         }

         tags.push(tagText);

         const tagElement = document.createElement('span');
         tagElement.className = 'tag-item';
         tagElement.textContent = tagText;

         const removeBtn = document.createElement('button');
         removeBtn.type = 'button'; // Important to prevent form submission
         removeBtn.className = 'tag-remove-btn';
         removeBtn.textContent = '×'; // Multiplication sign visually similar to x
         removeBtn.setAttribute('aria-label', `Remove ${tagText}`);
         removeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent container click listener from firing
            removeTag(tagText, tagElement);
         });

         tagElement.appendChild(removeBtn);
         tagsDisplay.appendChild(tagElement); // Add visual tag
         updateHiddenInput(); // Update stored value
         input.value = ''; // Clear input field after adding tag
     }

     // Function to remove a tag visually and from the array
     function removeTag(tagText, tagElement) {
         tags = tags.filter(t => t !== tagText); // Remove from array
         tagElement.remove(); // Remove from DOM
         updateHiddenInput(); // Update stored value
         input.focus(); // Return focus to input after removing tag
     }

     // Function to load tags from initial value (e.g., when editing profile)
     function loadInitialTags() {
          tags = hiddenInput.value ? hiddenInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
          tagsDisplay.innerHTML = ''; // Clear existing visual tags first
          tags.forEach(tagText => {
                // Re-create visual elements for existing tags
                const tagElement = document.createElement('span');
                tagElement.className = 'tag-item';
                tagElement.textContent = tagText;
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'tag-remove-btn';
                removeBtn.textContent = '×';
                removeBtn.setAttribute('aria-label', `Remove ${tagText}`);
                removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeTag(tagText, tagElement); });
                tagElement.appendChild(removeBtn);
                tagsDisplay.appendChild(tagElement);
          });
          // Ensure hidden input matches initial tags exactly (handles empty case)
          updateHiddenInput();
     }

    // --- Event Listeners ---
    input.addEventListener('keydown', (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault(); // Prevent comma typing or form submission
            if (input.value.trim()) { // Only add tag if there's text
                 addTag(input.value);
            }
        } else if (e.key === 'Backspace' && input.value === '' && tags.length > 0) {
            // Remove last tag on backspace if input is empty
             const lastTagElement = tagsDisplay.querySelector('.tag-item:last-child');
             if (lastTagElement) {
                 const lastTagText = tags[tags.length - 1]; // Get text before removing
                 removeTag(lastTagText, lastTagElement);
             }
        }
    });

    // Add tag when input loses focus, if there's text entered
    input.addEventListener('blur', () => {
        if (input.value.trim()) {
             addTag(input.value);
        }
    });

    // Make the container focus the input when clicked (improves usability)
    container.addEventListener('click', () => {
         input.focus();
    });

    // --- Initial Load ---
    // Load tags based on any pre-existing value in the hidden input
    loadInitialTags();

    // --- Expose Refresh Function ---
    // Attach function to container element so it can be called externally (e.g., after loading profile data)
    container.refreshTags = loadInitialTags;
}