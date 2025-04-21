/**
 * utils.js
 * Contains utility functions shared across the application:
 * - DOM manipulation helpers (errors)
 * - Input validation
 * - Authentication helpers (localStorage)
 * - URL parsing
 * - CSRF token retrieval
 * - Main API communication function (WorkspaceApi)
 * - Tag input component initialization
 */

// --- Constants ---
// TODO: Update this URL for staging/production environments, potentially using environment variables.
const API_BASE_URL = 'http://127.0.0.1:8000/api'; // Base URL for backend API

// --- DOM Helpers ---

/**
 * Displays an error message associated with a specific form field.
 * @param {string} elementId - ID of the error message container.
 * @param {string} message - Error message text.
 */
function showError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  } else {
    // Log a warning if the target error element isn't found in the DOM
    console.warn(`Error element not found: ${elementId}`);
  }
}

/**
 * Clears the error message for a specific form field.
 * @param {string} elementId - ID of the error message container.
 */
function clearError(elementId) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
}

/**
 * Clears all validation error messages within a given form.
 * @param {HTMLFormElement} formElement - The form element.
 */
function clearAllErrors(formElement) {
  if (!formElement) return;
  // Select elements typically used for displaying errors
  const errorElements = formElement.querySelectorAll('.error-message, .form-error');
  errorElements.forEach((el) => {
    el.textContent = '';
    el.style.display = 'none';
    // Reset visibility for general form error containers
    if (el.classList.contains('form-error')) {
      el.classList.remove('visible');
    }
  });
}

/**
 * Displays a general error message for a form (not tied to a specific field).
 * @param {string} elementId - ID of the general error container.
 * @param {string} message - Error message text.
 */
function showGeneralError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    errorElement.classList.add('visible'); // Ensure visibility class is added
  } else {
    // Log warning if the general error display element is missing
    console.warn(`General error element not found: ${elementId}`);
  }
}

// --- Validation Helpers ---

/**
 * Validates email format using a regular expression.
 * @param {string} email - Email string to validate.
 * @returns {boolean} True if format is valid.
 */
function validateEmail(email) {
  // Basic email format regex
  const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Validates password minimum length.
 * @param {string} password - Password string to validate.
 * @param {number} [minLength=8] - Minimum required length.
 * @returns {boolean} True if password meets minimum length.
 */
function validatePassword(password, minLength = 8) {
  return password && password.length >= minLength;
}

/**
 * Checks if a string value is null, undefined, or only whitespace.
 * @param {string} value - The string value to check.
 * @returns {boolean} True if the value is considered empty.
 */
function isEmpty(value) {
  return !value || value.trim() === '';
}

// --- Authentication Helpers (using localStorage) ---

/**
 * Saves authentication token and user info object to localStorage.
 * @param {string} token - Authentication token from API.
 * @param {object} user - User info object from API.
 */
function saveAuthInfo(token, user) {
  // Check if localStorage is available
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('authToken', token);
    // Store user object as a JSON string
    localStorage.setItem('userInfo', JSON.stringify(user));
  } else {
    // Log error if localStorage cannot be used
    console.error('localStorage is not available. Cannot save authentication info.');
  }
}

/**
 * Retrieves the authentication token from localStorage.
 * @returns {string|null} The token, or null if not found or localStorage unavailable.
 */
function getAuthToken() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('authToken');
  }
  return null;
}

/**
 * Retrieves and parses the user info object from localStorage.
 * @returns {object|null} The user object, or null if not found, invalid, or localStorage unavailable.
 */
function getUserInfo() {
  if (typeof localStorage !== 'undefined') {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      try {
        // Attempt to parse the stored JSON string
        return JSON.parse(userInfo);
      } catch (e) {
        // Log error if parsing fails (e.g., corrupted data)
        console.error('Error parsing user info from localStorage:', e);
        return null;
      }
    }
  }
  return null;
}

/**
 * Removes authentication token and user info from localStorage.
 */
function clearAuthInfo() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
  }
}

/**
 * Checks if a user is currently considered authenticated (based on token presence).
 * @returns {boolean} True if an auth token exists in localStorage.
 */
function isAuthenticated() {
  return !!getAuthToken(); // Returns true if token is not null/empty, false otherwise
}

// --- URL Helpers ---

/**
 * Parses URL query parameters from the current window location.
 * @returns {object} An object containing key-value pairs of query parameters.
 */
function getUrlParams() {
  const params = {};
  // Get query string part of URL, remove leading '?'
  const queryString = window.location.search.substring(1);
  // Regex to find key=value pairs
  const regex = /([^&=]+)=?([^&]*)/g; // Made value optional with =?
  let match;
  // Loop through all matches
  while ((match = regex.exec(queryString)) !== null) {
    // Decode key and value, replace '+' with space for values
    const key = decodeURIComponent(match[1]);
    const value = decodeURIComponent(match[2].replace(/\+/g, ' '));
    params[key] = value;
  }
  return params;
}

// --- CSRF Token Helper ---

/**
 * Retrieves the CSRF token value from the 'csrftoken' cookie set by Django.
 * Required for non-GET requests to Django backend.
 * @returns {string|null} The CSRF token value or null if not found.
 */
function getCsrfToken() {
  let csrfToken = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      // Does this cookie string begin with the name 'csrftoken='?
      if (cookie.startsWith('csrftoken=')) {
        csrfToken = decodeURIComponent(cookie.substring('csrftoken='.length));
        break; // Found the cookie, no need to check further
      }
    }
  }
  // Debug log removed: // console.log("CSRF Token found:", csrfToken);
  return csrfToken;
}

// --- Backend API Communication Function ---

/**
 * Central function for making asynchronous requests to the backend API using fetch.
 * Handles headers (Auth, CSRF, Content-Type), request body types (JSON, FormData),
 * response parsing, and basic error handling.
 * @param {string} endpoint - The API endpoint path (e.g., '/login/', '/users/'). MUST start with '/'.
 * @param {string} [method='GET'] - HTTP method (GET, POST, PUT, DELETE, PATCH).
 * @param {object|FormData|null} [data=null] - Data payload for POST/PUT/PATCH requests.
 * @param {boolean} [requiresAuth=true] - Whether to include the Authorization token header.
 * @returns {Promise<object>} A promise resolving with { success: boolean, data?: any, error?: string, status?: number }.
 */
async function WorkspaceApi(endpoint, method = 'GET', data = null, requiresAuth = true) {
  const upperMethod = method.toUpperCase();

  // Validate endpoint format
  if (!endpoint || !endpoint.startsWith('/')) {
    console.error("WorkspaceApi Error: Endpoint must be provided and start with '/'.");
    return { success: false, error: 'Invalid API endpoint provided.', status: null };
  }

  const url = `${API_BASE_URL}${endpoint}`; // Construct full URL
  const headers = {
    'Accept': 'application/json', // Specify we prefer JSON responses
  };
  const token = getAuthToken(); // Get auth token if available

  // Add Authorization header if needed and available
  if (requiresAuth) {
    if (!token) {
      console.error('WorkspaceApi Error: Auth token missing for protected route:', endpoint);
      return { success: false, error: 'Authentication required. Please log in.', status: 401 };
    }
    headers['Authorization'] = `Token ${token}`; // Assumes DRF TokenAuthentication format
  }

  // Add CSRF token header for methods that modify state
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(upperMethod)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken;
    } else {
      // Log warning if CSRF token is missing for relevant methods
      console.warn(`WorkspaceApi Warning: CSRF token not found for ${upperMethod} request to ${endpoint}. Request might fail.`);
    }
  }

  // Configure fetch options
  const config = {
    method: upperMethod,
    headers: headers,
  };

  // Prepare request body if data is provided
  if (data) {
    if (data instanceof FormData) {
      // For FormData, let the browser set the Content-Type header with boundary
      config.body = data;
    } else {
      // For other data, assume JSON
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(data);
    }
  }

  // Perform the API call
  try {
    const response = await fetch(url, config);

    // Handle successful responses with no content body (e.g., 204 after DELETE)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { success: true, status: response.status, data: null };
    }

    // Attempt to parse response body as JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      // Handle cases where response isn't valid JSON (e.g., HTML error page)
      const responseText = await response.text().catch(() => 'Could not read response text.');
      console.error(`WorkspaceApi Error: Failed to parse JSON response from ${endpoint} (Status: ${response.status}). Response Text:`, responseText);
      return { success: false, error: `Invalid response format from server (Status: ${response.status}).`, status: response.status };
    }

    // Check if the HTTP status code indicates an error (non-2xx)
    if (!response.ok) {
      console.error(`WorkspaceApi Error: ${response.status} ${response.statusText} for ${endpoint}`, responseData);
      // Extract detailed error message from backend if possible (common DRF patterns)
      let errorMessage = responseData.detail ||
                         (Array.isArray(responseData) ? responseData.join(', ') : null) ||
                         (typeof responseData === 'object' ? JSON.stringify(responseData) : `Request failed with status ${response.status}.`);
      return { success: false, error: errorMessage, status: response.status, data: responseData };
    }

    // Successful response with JSON data
    return { success: true, data: responseData, status: response.status };

  } catch (error) {
    // Handle network errors (fetch failure, CORS issues, etc.)
    console.error(`WorkspaceApi Network/Fetch Error for ${endpoint}:`, error);
    return { success: false, error: 'Failed to connect to the server. Please check your network connection.', status: null };
  }
} // End WorkspaceApi


// --- Tag Input Logic ---

/**
 * Initializes a tag input component, handling tag creation, deletion,
 * and synchronization with a hidden input field.
 * @param {string} containerId - ID of the main container div for the tag input.
 * @param {string} inputId - ID of the visible text input element for typing tags.
 * @param {string} tagsDisplayId - ID of the div where visual tags will be displayed.
 * @param {string} hiddenInputId - ID of the hidden input storing the comma-separated tag values.
 */
function initializeTagInput(containerId, inputId, tagsDisplayId, hiddenInputId) {
  // Get references to the required DOM elements
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  const tagsDisplay = document.getElementById(tagsDisplayId);
  const hiddenInput = document.getElementById(hiddenInputId);

  // Exit if any element is missing to prevent errors
  if (!container || !input || !tagsDisplay || !hiddenInput) {
    console.error("Tag input initialization failed: One or more elements not found.", { containerId, inputId, tagsDisplayId, hiddenInputId });
    return;
  }

  let tags = []; // Array to hold the tag strings internally

  // Updates the hidden input field with the current tags array (comma-separated)
  function updateHiddenInput() {
    hiddenInput.value = tags.join(',');
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event

    // Clear associated error message if tags are now present
    if (tags.length > 0) {
      const baseId = hiddenInputId.replace(/^profile-|^filter-/, '');
      const errorElementId = `${baseId}-error`;
      clearError(errorElementId); // Assumes clearError is defined globally
    }
  }

  // Creates and adds a new tag element visually and updates the state
  function addTag(text) {
    const tagText = text.trim().replace(/,/g, ''); // Clean tag text (remove commas)
    // Prevent empty or duplicate tags
    if (tagText.length < 1 || tags.includes(tagText)) {
      input.value = ''; // Clear input even if tag wasn't added
      return;
    }

    tags.push(tagText); // Add to internal array

    // Create visual elements for the tag
    const tagElement = document.createElement('span');
    tagElement.className = 'tag-item';
    tagElement.textContent = tagText;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tag-remove-btn';
    removeBtn.textContent = '×'; // Visual 'x'
    removeBtn.setAttribute('aria-label', `Remove ${tagText}`);
    // Add event listener to remove the tag when 'x' is clicked
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent container click listener
      removeTag(tagText, tagElement);
    });

    tagElement.appendChild(removeBtn);
    tagsDisplay.appendChild(tagElement); // Add tag to the display area
    updateHiddenInput(); // Update the hidden input value
    input.value = ''; // Clear the text input field
  }

  // Removes a tag visually and from the internal state
  function removeTag(tagText, tagElement) {
    tags = tags.filter(t => t !== tagText); // Remove from array
    tagElement.remove(); // Remove from DOM
    updateHiddenInput(); // Update hidden input
    input.focus(); // Return focus to the input field
  }

  // Loads initial tags based on the hidden input's value (e.g., when editing)
  function loadInitialTags() {
    // Get comma-separated string, split into array, trim items, filter empty ones
    tags = hiddenInput.value ? hiddenInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
    tagsDisplay.innerHTML = ''; // Clear any existing visual tags
    // Recreate visual tags for each item in the loaded array
    tags.forEach(tagText => {
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
    updateHiddenInput(); // Ensure hidden input matches exactly after load
  }

  // --- Event Listeners for Tag Input ---
  // Handle key presses in the input field
  input.addEventListener('keydown', (e) => {
    // Add tag on comma or Enter key press
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault(); // Prevent default action (typing comma, submitting form)
      if (input.value.trim()) { addTag(input.value); } // Add tag if input has text
    } else if (e.key === 'Backspace' && input.value === '' && tags.length > 0) {
      // Remove last tag if backspace is pressed in empty input
      const lastTagElement = tagsDisplay.querySelector('.tag-item:last-child');
      if (lastTagElement) {
        const lastTagText = tags[tags.length - 1];
        removeTag(lastTagText, lastTagElement);
      }
    }
  });

  // Add tag if user types something and then clicks away (blur)
  input.addEventListener('blur', () => {
    if (input.value.trim()) { addTag(input.value); }
  });

  // Focus the text input when the container background is clicked
  container.addEventListener('click', () => {
    input.focus();
  });

  // --- Initial Load & Setup ---
  loadInitialTags(); // Load any existing tags from hidden input on init
  // Make the refresh function available externally on the container element
  container.refreshTags = loadInitialTags;

} // End initializeTagInput
