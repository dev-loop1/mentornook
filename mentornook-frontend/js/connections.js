document.addEventListener('DOMContentLoaded', () => {
    // Only run loadConnections if on the connections page
    if (document.querySelector('.connections-page')) {
        loadConnections();

         // Setup event listeners for action buttons using delegation
         const connectionsContainer = document.querySelector('.connections-page .container');
         if(connectionsContainer) {
             connectionsContainer.addEventListener('click', handleConnectionListPageAction);
         }
    }
});

async function loadConnections() {
    const incomingList = document.getElementById('incoming-requests-list');
    const outgoingList = document.getElementById('outgoing-requests-list');
    const currentList = document.getElementById('current-connections-list');
    const loadingIncoming = document.getElementById('loading-incoming');
    const loadingOutgoing = document.getElementById('loading-outgoing');
    const loadingCurrent = document.getElementById('loading-current');
    const noIncoming = document.getElementById('no-incoming');
    const noOutgoing = document.getElementById('no-outgoing');
    const noCurrent = document.getElementById('no-current');

    // Ensure elements exist before proceeding
     if (!incomingList || !outgoingList || !currentList || !loadingIncoming || !loadingOutgoing || !loadingCurrent || !noIncoming || !noOutgoing || !noCurrent) {
         console.error("One or more connection list elements not found.");
         return;
     }

    // Show loading indicators
    loadingIncoming.style.display = 'block';
    loadingOutgoing.style.display = 'block';
    loadingCurrent.style.display = 'block';
    noIncoming.style.display = 'none';
    noOutgoing.style.display = 'none';
    noCurrent.style.display = 'none';
    incomingList.innerHTML = ''; // Clear previous content
    outgoingList.innerHTML = '';
    currentList.innerHTML = '';

    // Get logged-in user info - needed for createConnectionItem
    const loggedInUser = getUserInfo(); // Assumes getUserInfo() from utils.js returns { id, ... }
    if (!loggedInUser) {
        console.error("User info not found, cannot determine connection details accurately.");
        // Optionally redirect to login or show error
        window.location.href = 'login.html';
        return;
    }

    try {
        // **FIXED:** Endpoint URL with trailing slash, explicitly set requiresAuth: true
        const response = await WorkspaceApi('/connections/', 'GET', null, true);

        // **FIXED:** Check response.success and access response.data
        if (response.success && response.data) {
            const { incoming, outgoing, current } = response.data;

            // Render Incoming Requests
            if (incoming && incoming.length > 0) {
                // Pass loggedInUser.id to determine who sent the request
                incoming.forEach(req => incomingList.appendChild(createConnectionItem(req, 'incoming', loggedInUser.id)));
            } else {
                noIncoming.style.display = 'block';
            }

            // Render Outgoing Requests
            if (outgoing && outgoing.length > 0) {
                 // Pass loggedInUser.id to determine who received the request
                outgoing.forEach(req => outgoingList.appendChild(createConnectionItem(req, 'outgoing', loggedInUser.id)));
            } else {
                noOutgoing.style.display = 'block';
            }

            // Render Current Connections
            if (current && current.length > 0) {
                 // Pass loggedInUser.id to determine who the other user is
                current.forEach(conn => currentList.appendChild(createConnectionItem(conn, 'current', loggedInUser.id)));
            } else {
                noCurrent.style.display = 'block';
            }

        } else {
            // **FIXED:** Use response.error
            const errorMsg = response.error || 'Failed to load connections.';
            console.error("Failed to load connections:", errorMsg);
            // Show error message in all sections
            incomingList.innerHTML = `<p class="error-message">Error: ${errorMsg}</p>`;
            outgoingList.innerHTML = `<p class="error-message">Error: ${errorMsg}</p>`;
            currentList.innerHTML = `<p class="error-message">Error: ${errorMsg}</p>`;
        }

    } catch (error) { // Catch network/fetch errors
        console.error("Error fetching connections:", error);
        const errorMsg = error.message || 'An unexpected error occurred.';
        incomingList.innerHTML = `<p class="error-message">${errorMsg}</p>`;
        outgoingList.innerHTML = `<p class="error-message">${errorMsg}</p>`;
        currentList.innerHTML = `<p class="error-message">${errorMsg}</p>`;
    } finally {
        // Hide loading indicators
        loadingIncoming.style.display = 'none';
        loadingOutgoing.style.display = 'none';
        loadingCurrent.style.display = 'none';
    }
}

/**
 * Creates the HTML element for a single connection item.
 * @param {object} item - The connection object from the backend API (includes nested requester/receiver/profile info).
 * @param {'incoming'|'outgoing'|'current'} type - The type of connection list item.
 * @param {number|string} loggedInUserId - The ID of the currently logged-in user.
 * @returns {HTMLElement} The created div element for the connection item.
 */
function createConnectionItem(item, type, loggedInUserId) {
    const div = document.createElement('div');
    div.className = 'connection-item';
    div.dataset.connectionId = item.id; // Use item.id (correct field name from serializer)

    // --- **FIXED:** Determine the *other* user's details ---
    let otherUser = null;
    let otherUserProfile = null;

    // Compare IDs as numbers or strings consistently
    const loggedInUserIdStr = String(loggedInUserId);
    const requesterIdStr = String(item.requester?.id);
    const receiverIdStr = String(item.receiver?.id);


    if (requesterIdStr === loggedInUserIdStr) {
        // Logged-in user sent the request or is part of connection
        otherUser = item.receiver;
        otherUserProfile = item.receiver_profile;
    } else if (receiverIdStr === loggedInUserIdStr) {
         // Logged-in user received the request or is part of connection
        otherUser = item.requester;
        otherUserProfile = item.requester_profile;
    } else {
        // Should not happen if API returns correct data, but handle gracefully
        console.warn("Could not determine other user in connection item:", item);
        // Fallback display or skip rendering
         otherUser = { id: 'unknown', username: 'Unknown User', first_name: '', last_name: '' };
         otherUserProfile = { role: 'unknown', profile_picture_url: null };
    }

    // Extract details safely using optional chaining (?.)
    const otherUserId = otherUser?.id || 'unknown';
    const otherUserName = (otherUser?.first_name && otherUser?.last_name)
                            ? `${otherUser.first_name} ${otherUser.last_name}`
                            : (otherUser?.username || 'Unknown User');
    const otherUserRole = otherUserProfile?.role || '';
    const otherUserProfilePic = otherUserProfile?.profile_picture_url || 'assets/images/profile_avatar_default.png';

    // Store the *other* user's ID for profile linking
    div.dataset.userId = otherUserId;
    // --- End Determining Other User ---


    const dateValue = (type === 'current' ? item.accepted_at : item.created_at);
    const date = dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A';
    let dateLabel = '';
    if (type === 'incoming' || type === 'outgoing') dateLabel = `Sent on: ${date}`;
    if (type === 'current') dateLabel = `Connected since: ${date}`;


    // --- Actions based on connection type ---
    let actionsHtml = '';
    switch (type) {
        case 'incoming': // Received by logged-in user
            actionsHtml = `
                <button class="btn btn-success btn-sm accept-request" data-action="accept">Accept</button>
                <button class="btn btn-danger btn-sm decline-request" data-action="decline">Decline</button>
            `;
            break;
        case 'outgoing': // Sent by logged-in user
            actionsHtml = `
                <button class="btn btn-warning btn-sm cancel-request" data-action="cancel">Cancel Request</button>
            `;
            break;
        case 'current': // Accepted connection
            actionsHtml = `
                <a href="user_profile.html?id=${otherUserId}" class="btn btn-secondary btn-sm">View Profile</a>
                <button class="btn btn-danger btn-sm remove-connection" data-action="remove">Remove</button>
            `;
            break;
    }

    // --- Build Inner HTML ---
    div.innerHTML = `
        <img src="${otherUserProfilePic}" alt="${otherUserName}'s profile picture">
        <div class="connection-info">
            <strong>${otherUserName}</strong>
            ${otherUserRole ? `(<span class="user-role ${otherUserRole}">${otherUserRole}</span>)` : ''}
            <span class="${type === 'current' ? 'connection-date' : 'request-date'}">${dateLabel}</span>
        </div>
        <div class="connection-actions">
            ${actionsHtml}
        </div>
    `;
    return div;
}


/**
 * Event handler for Accept/Decline/Cancel/Remove buttons on the connections page.
 * @param {Event} event - The click event object.
 */
async function handleConnectionListPageAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return; // Click wasn't on an action button

    const action = button.dataset.action;
    const connectionItem = button.closest('.connection-item');
    const connectionId = connectionItem?.dataset.connectionId;

    // Basic validation
    if (!action || !connectionId) {
        console.error("Missing action or connectionId for connection management.");
        return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '...'; // Indicate processing

    try {
        let response;
        let method;
        let data = null;

        // Determine method and data based on action
        if (action === 'accept' || action === 'decline') {
            method = 'PUT';
            data = { action: action }; // Send action in body for PUT
        } else if (action === 'cancel' || action === 'remove') {
            method = 'DELETE'; // Cancel (pending) and Remove (accepted) use DELETE
            data = null;
        } else {
             throw new Error(`Unknown connection action: ${action}`);
        }

        // **FIXED:** Endpoint URL with trailing slash, correct method, add requiresAuth: true
        response = await WorkspaceApi(`/connections/${connectionId}/`, method, data, true);

        // **FIXED:** Check response.success and use response.error
        if (response.success) {
            // Refresh the connections list to show the update
            // Add a small visual delay/feedback? Optional.
            loadConnections();
        } else {
            alert(`Action failed: ${response.error || 'Unknown error'}`);
            button.disabled = false;
            button.textContent = originalText;
        }
    } catch (error) { // Catch network/fetch errors or errors thrown above
        console.error(`Error performing connection action ${action}:`, error);
        alert(`An error occurred: ${error.message || 'Please try again.'}`);
        button.disabled = false;
        button.textContent = originalText;
    }
} // End handleConnectionListPageAction