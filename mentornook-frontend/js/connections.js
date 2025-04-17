/**
 * connections.js
 * Handles fetching and managing connection lists on connections.html.
 * Uses minimal DOM updates after actions.
 * Assumes functions from utils.js are available.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Only run loadConnections if on the connections page
    if (document.querySelector('.connections-page')) {
        console.log("Connections page detected. Initializing...");
        loadConnections(); // Initial load of all lists

        // Setup event listeners for action buttons using delegation
        const connectionsContainer = document.querySelector('.connections-page .container');
        if (connectionsContainer) {
            console.log("Attaching event listener to connections container.");
            // Ensure listener is attached only once
            if (!connectionsContainer.dataset.listenerAttached) {
                connectionsContainer.addEventListener('click', handleConnectionListPageAction);
                connectionsContainer.dataset.listenerAttached = 'true';
            }
        } else {
            console.error("Connections container not found for event listener setup.");
        }
    }
});

/**
 * Fetches all connection types and renders them into the respective lists (for initial load).
 */
async function loadConnections() {
    console.log("--- loadConnections START (Initial Load) ---");
    const incomingList = document.getElementById('incoming-requests-list');
    const outgoingList = document.getElementById('outgoing-requests-list');
    const currentList = document.getElementById('current-connections-list');
    const loadingIncoming = document.getElementById('loading-incoming');
    const loadingOutgoing = document.getElementById('loading-outgoing');
    const loadingCurrent = document.getElementById('loading-current');
    const noIncoming = document.getElementById('no-incoming');
    const noOutgoing = document.getElementById('no-outgoing');
    const noCurrent = document.getElementById('no-current');

    if (!incomingList || !outgoingList || !currentList || !loadingIncoming || !loadingOutgoing || !loadingCurrent || !noIncoming || !noOutgoing || !noCurrent) {
        console.error("loadConnections: One or more list/message elements not found.");
        return;
    }

    // Show loading indicators, hide 'no results' messages
    [loadingIncoming, loadingOutgoing, loadingCurrent].forEach(el => { if(el) el.style.display = 'block' });
    [noIncoming, noOutgoing, noCurrent].forEach(el => { if(el) el.style.display = 'none' });
    // Clear previous list content
    incomingList.innerHTML = '';
    outgoingList.innerHTML = '';
    currentList.innerHTML = '';

    const loggedInUser = getUserInfo();
    if (!loggedInUser) {
        console.error("loadConnections: User info not found. Redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    try {
        console.log("loadConnections: Fetching data from /connections/");
        const response = await WorkspaceApi('/connections/', 'GET', null, true);
        console.log("loadConnections: API response received:", response);

        if (response.success && response.data) {
            const { incoming = [], outgoing = [], current = [] } = response.data;
            console.log(`loadConnections: Processing ${incoming.length} incoming, ${outgoing.length} outgoing, ${current.length} current.`);

            // Render lists
            renderList(incomingList, noIncoming, incoming, 'incoming', loggedInUser.id);
            renderList(outgoingList, noOutgoing, outgoing, 'outgoing', loggedInUser.id);
            renderList(currentList, noCurrent, current, 'current', loggedInUser.id);

            console.log("--- loadConnections: Finished rendering lists ---");

        } else {
            const errorMsg = response.error || 'Failed to load connections.';
            console.error("loadConnections API call failed:", errorMsg);
            const errorHtml = `<p class="error-message">Error: ${errorMsg}</p>`;
            incomingList.innerHTML = errorHtml;
            outgoingList.innerHTML = errorHtml;
            currentList.innerHTML = errorHtml;
        }
    } catch (error) {
        console.error("Exception during loadConnections fetch/render:", error);
        const errorMsg = error.message || 'An unexpected error occurred.';
        const errorHtml = `<p class="error-message">${errorMsg}</p>`;
        incomingList.innerHTML = errorHtml;
        outgoingList.innerHTML = errorHtml;
        currentList.innerHTML = errorHtml;
    } finally {
        console.log("loadConnections: Hiding loading indicators (finally block).");
        [loadingIncoming, loadingOutgoing, loadingCurrent].forEach(el => { if(el) el.style.display = 'none' });
        console.log("--- loadConnections END (Initial Load) ---");
    }
} // End loadConnections

/**
 * Helper function to render items into a specific list container.
 * @param {HTMLElement} listElement - The UL/DIV element to append items to.
 * @param {HTMLElement} noItemsElement - The element showing the 'no items' message.
 * @param {Array<object>} items - Array of connection data objects.
 * @param {'incoming'|'outgoing'|'current'} type - The type of list.
 * @param {string|number} loggedInUserId - The current user's ID.
 */
function renderList(listElement, noItemsElement, items, type, loggedInUserId) {
    listElement.innerHTML = ''; // Clear previous content
    if (items && items.length > 0) {
        if (noItemsElement) noItemsElement.style.display = 'none';
        items.forEach(item => {
            try {
                // Ensure createConnectionItem exists and works
                if (typeof createConnectionItem === 'function') {
                     listElement.appendChild(createConnectionItem(item, type, loggedInUserId));
                } else {
                     console.error("createConnectionItem function is not defined!");
                }
            } catch (renderError) {
                console.error(`Error creating/appending ${type} item:`, item, renderError);
                // Optionally append an error placeholder for the specific item
            }
        });
    } else {
        if (noItemsElement) noItemsElement.style.display = 'block';
    }
}

/**
 * Creates the HTML element for a single connection item.
 * (Keep the previously corrected version of createConnectionItem here)
 * @param {object} item - Connection object from API.
 * @param {'incoming'|'outgoing'|'current'} type - List type.
 * @param {string|number} loggedInUserId - Current user's ID.
 * @returns {HTMLElement} The list item element.
 */
function createConnectionItem(item, type, loggedInUserId) {
    const div = document.createElement('div');
    div.className = 'connection-item';
    div.dataset.connectionId = item.id;

    let otherUser = null;
    let otherUserProfile = null;
    const loggedInUserIdStr = String(loggedInUserId);
    const requesterIdStr = String(item.requester?.id);
    const receiverIdStr = String(item.receiver?.id);

    if (requesterIdStr === loggedInUserIdStr) {
        otherUser = item.receiver;
        otherUserProfile = item.receiver_profile;
    } else if (receiverIdStr === loggedInUserIdStr) {
        otherUser = item.requester;
        otherUserProfile = item.requester_profile;
    } else {
        console.warn("Could not determine other user in connection item:", item);
        otherUser = { id: 'unknown', username: 'Unknown User', first_name:'', last_name:'' };
        otherUserProfile = { role: '', profile_picture_url: null };
    }

    const otherUserId = otherUser?.id || 'unknown';
    const otherUserName = (otherUser?.first_name && otherUser?.last_name)
                            ? `${otherUser.first_name} ${otherUser.last_name}`
                            : (otherUser?.username || 'Unknown User');
    const otherUserRole = otherUserProfile?.role || '';
    const otherUserProfilePic = otherUserProfile?.profile_picture_url || 'assets/images/profile_avatar_default.png';

    div.dataset.userId = otherUserId;

    const dateValue = (type === 'current' ? item.accepted_at : item.created_at);
    const date = dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A';
    let dateLabel = '';
    if (type === 'incoming' || type === 'outgoing') dateLabel = `Sent on: ${date}`;
    if (type === 'current') dateLabel = `Connected since: ${date}`;

    let actionsHtml = '';
    // --- Generate buttons with appropriate data attributes ---
    switch (type) {
        case 'incoming':
            actionsHtml = `<button class="btn btn-success btn-sm accept-request" data-action="accept">Accept</button> <button class="btn btn-danger btn-sm decline-request" data-action="decline">Decline</button>`;
            break;
        case 'outgoing':
            actionsHtml = `<button class="btn btn-warning btn-sm cancel-request" data-action="cancel">Cancel Request</button>`;
            break;
        case 'current':
            actionsHtml = `<a href="user_profile.html?id=${otherUserId}" class="btn btn-secondary btn-sm">View Profile</a> <button class="btn btn-danger btn-sm remove-connection" data-action="remove">Remove</button>`;
            break;
    }

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
} // End createConnectionItem

/**
 * Handles clicks on Accept/Decline/Cancel/Remove buttons using minimal DOM updates.
 * @param {Event} event - The click event object.
 */
async function handleConnectionListPageAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const connectionItem = button.closest('.connection-item');
    const connectionId = connectionItem?.dataset.connectionId;
    const originatingList = connectionItem?.parentElement; // Get the list (UL/DIV) the item belongs to

    if (!action || !connectionId || !connectionItem || !originatingList) {
        console.error("Could not process action: Missing action, connectionId, item reference, or parent list.");
        return;
    }

    // Store original state before disabling
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '...';

    // Find sibling buttons in the same action group to potentially re-enable on error
    const actionContainer = button.closest('.connection-actions');
    const siblingButtons = actionContainer ? actionContainer.querySelectorAll('button') : [button];
    siblingButtons.forEach(btn => { if(btn !== button) btn.disabled = true; });

    try {
        let response;
        let method = (action === 'accept' || action === 'decline') ? 'PUT' : 'DELETE';
        let data = (action === 'accept' || action === 'decline') ? { action: action } : null;

        console.log(`ACTION: ${action}, ConnID: ${connectionId}, Method: ${method}`);
        response = await WorkspaceApi(`/connections/${connectionId}/`, method, data, true);
        console.log(`RESPONSE for ${action} ConnID ${connectionId}:`, response);

        if (response.success || response.status === 204) {
            console.log(`Action ${action} successful for ConnID ${connectionId}. Updating UI minimally...`);

            // --- Minimal DOM Update Logic ---
            const loggedInUser = getUserInfo(); // Needed for potential re-render
            if (!loggedInUser) throw new Error("Cannot update UI without logged-in user info."); // Should not happen

            if (action === 'accept') {
                 // 1. Remove from 'Incoming' list
                 connectionItem.remove();
                 checkIfListEmpty(originatingList.id); // Check if incoming list became empty

                 // 2. Add to 'Current' list (assuming response.data contains updated connection)
                 const currentList = document.getElementById('current-connections-list');
                 if (currentList && response.data && typeof createConnectionItem === 'function') {
                     currentList.appendChild(createConnectionItem(response.data, 'current', loggedInUser.id));
                     checkIfListEmpty('current-connections-list'); // Hide 'no current' message if needed
                 } else if (!response.data) {
                      console.warn("Accept successful, but no connection data returned to add to 'current' list. Full refresh might be needed eventually.");
                 } else {
                     console.error("Could not find 'current-connections-list' or 'createConnectionItem' to add accepted connection.");
                 }

            } else if (action === 'decline' || action === 'cancel' || action === 'remove') {
                 // Just remove the item from its current list
                 connectionItem.remove();
                 checkIfListEmpty(originatingList.id); // Check if list became empty
            }
            // --- End Minimal DOM Update ---

            console.log("Minimal UI update complete.");
            // No need to re-enable buttons as the item/buttons were removed or replaced.

        } else {
            // Initial action API call failed
            alert(`Action failed: ${response.error || 'Unknown error'}`);
            siblingButtons.forEach(btn => btn.disabled = false); // Re-enable buttons
            button.textContent = originalText;
        }
    } catch (error) {
        // Exception occurred
        console.error(`Error performing connection action ${action}:`, error);
        alert(`An error occurred: ${error.message || 'Please try again.'}`);
        siblingButtons.forEach(btn => btn.disabled = false); // Re-enable buttons
        button.textContent = originalText;
    }
} // End handleConnectionListPageAction


/**
 * Checks if a list is empty after removing an item and shows/hides the corresponding "no items" message.
 * @param {string} listId - The ID of the list element (e.g., 'incoming-requests-list').
 */
function checkIfListEmpty(listId) {
    const listElement = document.getElementById(listId);
    const listSection = listElement?.closest('.connections-section'); // Find parent section
    if (!listElement || !listSection) return;

    const noItemsMessage = listSection.querySelector('[id^="no-"]'); // Find p tag starting with id="no-"
    if (!noItemsMessage) return;

    // Check if listElement has any .connection-item children left
    const hasItems = listElement.querySelector('.connection-item') !== null;

    console.log(`Checking if list ${listId} is empty: ${!hasItems}`);
    noItemsMessage.style.display = hasItems ? 'none' : 'block';
}