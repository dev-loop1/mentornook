/**
 * connections.js
 * Handles fetching connection lists (incoming, outgoing, current) for connections.html
 * and managing connection actions (accept, decline, cancel, remove) via API calls
 * with minimal DOM updates on success.
 * Assumes functions from utils.js (like getAuthToken, getUserInfo, WorkspaceApi) are available.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Only run loadConnections if on the connections page
  if (document.querySelector(".connections-page")) {
    loadConnections(); // Initial load of all lists

    // Setup event listeners for action buttons using delegation
    const connectionsContainer = document.querySelector(
      ".connections-page .container"
    );
    if (connectionsContainer) {
      // Ensure listener is attached only once
      if (!connectionsContainer.dataset.listenerAttached) {
        connectionsContainer.addEventListener(
          "click",
          handleConnectionListPageAction
        );
        connectionsContainer.dataset.listenerAttached = "true";
      }
    } else {
      console.error(
        "Connections container not found for event listener setup."
      );
    }
  }
});

/**
 * Fetches all connection types from the API and renders them into the
 * respective lists on the page. Used for initial page load.
 */
async function loadConnections() {
  const incomingList = document.getElementById("incoming-requests-list");
  const outgoingList = document.getElementById("outgoing-requests-list");
  const currentList = document.getElementById("current-connections-list");
  const loadingIncoming = document.getElementById("loading-incoming");
  const loadingOutgoing = document.getElementById("loading-outgoing");
  const loadingCurrent = document.getElementById("loading-current");
  const noIncoming = document.getElementById("no-incoming");
  const noOutgoing = document.getElementById("no-outgoing");
  const noCurrent = document.getElementById("no-current");

  // Check if all required DOM elements are present
  if (
    !incomingList ||
    !outgoingList ||
    !currentList ||
    !loadingIncoming ||
    !loadingOutgoing ||
    !loadingCurrent ||
    !noIncoming ||
    !noOutgoing ||
    !noCurrent
  ) {
    console.error(
      "loadConnections: One or more required list/message elements not found on the page."
    );
    return;
  }

  // Show loading indicators, hide 'no results' messages
  [loadingIncoming, loadingOutgoing, loadingCurrent].forEach((el) => {
    if (el) el.style.display = "block";
  });
  [noIncoming, noOutgoing, noCurrent].forEach((el) => {
    if (el) el.style.display = "none";
  });
  // Clear previous list content before loading new data
  incomingList.innerHTML = "";
  outgoingList.innerHTML = "";
  currentList.innerHTML = "";

  const loggedInUser = getUserInfo(); // Get current user for context
  if (!loggedInUser) {
    console.error(
      "loadConnections: User info not found. Redirecting to login."
    );
    window.location.href = "login.html"; // Redirect if user data is missing
    return;
  }

  try {
    // Fetch all connection data from the backend
    const response = await WorkspaceApi("/connections/", "GET", null, true); // requiresAuth = true

    if (response.success && response.data) {
      const { incoming = [], outgoing = [], current = [] } = response.data; // Default to empty arrays

      // Render each list section
      renderList(
        incomingList,
        noIncoming,
        incoming,
        "incoming",
        loggedInUser.id
      );
      renderList(
        outgoingList,
        noOutgoing,
        outgoing,
        "outgoing",
        loggedInUser.id
      );
      renderList(currentList, noCurrent, current, "current", loggedInUser.id);
    } else {
      // Handle API error during fetch
      const errorMsg = response.error || "Failed to load connections.";
      console.error("loadConnections API call failed:", errorMsg);
      // Display error message within the list areas
      const errorHtml = `<p class="error-message">Error: ${errorMsg}</p>`;
      incomingList.innerHTML = errorHtml;
      outgoingList.innerHTML = errorHtml;
      currentList.innerHTML = errorHtml;
    }
  } catch (error) {
    // Catch network/fetch errors or errors during rendering
    console.error("Exception during loadConnections fetch/render:", error);
    const errorMsg = error.message || "An unexpected error occurred.";
    const errorHtml = `<p class="error-message">${errorMsg}</p>`;
    incomingList.innerHTML = errorHtml;
    outgoingList.innerHTML = errorHtml;
    currentList.innerHTML = errorHtml;
  } finally {
    // Always hide loading indicators after attempt
    [loadingIncoming, loadingOutgoing, loadingCurrent].forEach((el) => {
      if (el) el.style.display = "none";
    });
  }
} // End loadConnections

/**
 * Helper function to render connection items into a specific list container.
 * @param {HTMLElement} listElement - The UL/DIV element to append items to.
 * @param {HTMLElement} noItemsElement - The element showing the 'no items' message.
 * @param {Array<object>} items - Array of connection data objects from API.
 * @param {'incoming'|'outgoing'|'current'} type - The type of list being rendered.
 * @param {string|number} loggedInUserId - The current user's ID.
 */
function renderList(listElement, noItemsElement, items, type, loggedInUserId) {
  listElement.innerHTML = ""; // Clear previous content first
  if (items && items.length > 0) {
    if (noItemsElement) noItemsElement.style.display = "none"; // Hide "no items" message
    items.forEach((item) => {
      try {
        // Ensure createConnectionItem function exists before calling
        if (typeof createConnectionItem === "function") {
          listElement.appendChild(
            createConnectionItem(item, type, loggedInUserId)
          );
        } else {
          console.error("createConnectionItem function is not defined!");
          // Avoid infinite loop if createConnectionItem is missing
          listElement.innerHTML =
            '<p class="error-message">Error rendering list items.</p>';
          return; // Exit loop early
        }
      } catch (renderError) {
        console.error(
          `Error creating/appending ${type} item:`,
          item,
          renderError
        );
        // Optionally append an error placeholder for the specific item
        // listElement.innerHTML += `<p class="error-message">Error rendering item.</p>`;
      }
    });
  } else {
    // Show "no items" message if the list is empty
    if (noItemsElement) noItemsElement.style.display = "block";
  }
} // End renderList

/**
 * Creates the HTML element structure for a single connection item.
 * @param {object} item - Connection data object from the API response.
 * @param {'incoming'|'outgoing'|'current'} type - Type of connection list.
 * @param {string|number} loggedInUserId - ID of the current user.
 * @returns {HTMLElement} The created div element representing the connection item.
 */
function createConnectionItem(item, type, loggedInUserId) {
  const div = document.createElement("div");
  div.className = "connection-item";
  div.dataset.connectionId = item.id; // Store connection ID on the element

  // Determine the details of the *other* user in the connection
  let otherUser = null;
  let otherUserProfile = null;
  const loggedInUserIdStr = String(loggedInUserId);
  const requesterIdStr = String(item.requester?.id);
  const receiverIdStr = String(item.receiver?.id);

  if (requesterIdStr === loggedInUserIdStr) {
    // If logged-in user sent the request
    otherUser = item.receiver;
    otherUserProfile = item.receiver_profile;
  } else if (receiverIdStr === loggedInUserIdStr) {
    // If logged-in user received the request
    otherUser = item.requester;
    otherUserProfile = item.requester_profile;
  } else {
    // Fallback if user data is unexpected
    console.warn("Could not determine other user in connection item:", item);
    otherUser = {
      id: "unknown",
      username: "Unknown User",
      first_name: "",
      last_name: "",
    };
    otherUserProfile = { role: "", profile_picture_url: null };
  }

  // Safely extract details for display
  const otherUserId = otherUser?.id || "unknown";
  const otherUserName =
    otherUser?.first_name && otherUser?.last_name
      ? `${otherUser.first_name} ${otherUser.last_name}`
      : otherUser?.username || "Unknown User";
  const otherUserRole = otherUserProfile?.role || "";
  const otherUserProfilePic =
    otherUserProfile?.profile_picture_url ||
    "assets/images/profile_avatar_default.png";

  div.dataset.userId = otherUserId; // Store other user's ID for profile link

  // Format date information
  const dateValue = type === "current" ? item.accepted_at : item.created_at;
  const date = dateValue ? new Date(dateValue).toLocaleDateString() : "N/A";
  let dateLabel = "";
  if (type === "incoming" || type === "outgoing")
    dateLabel = `Sent on: ${date}`;
  if (type === "current") dateLabel = `Connected since: ${date}`;

  // Generate action buttons based on the list type
  let actionsHtml = "";
  switch (type) {
    case "incoming":
      actionsHtml = `<button class="btn btn-success btn-sm accept-request" data-action="accept">Accept</button> <button class="btn btn-danger btn-sm decline-request" data-action="decline">Decline</button>`;
      break;
    case "outgoing":
      actionsHtml = `<button class="btn btn-warning btn-sm cancel-request" data-action="cancel">Cancel Request</button>`;
      break;
    case "current":
      actionsHtml = `<a href="user_profile.html?id=${otherUserId}" class="btn btn-secondary btn-sm">View Profile</a> <button class="btn btn-danger btn-sm remove-connection" data-action="remove">Remove</button>`;
      break;
  }

  // Construct the inner HTML for the connection item
  div.innerHTML = `
        <img src="${otherUserProfilePic}" alt="${otherUserName}'s profile picture">
        <div class="connection-info">
            <strong>${otherUserName}</strong>
            ${
              otherUserRole
                ? `<span class="user-role ${otherUserRole}">${otherUserRole}</span>`
                : ""
            }
            <span class="${
              type === "current" ? "connection-date" : "request-date"
            }">${dateLabel}</span>
        </div>
        <div class="connection-actions">
            ${actionsHtml}
        </div>
    `;
  return div;
} // End createConnectionItem

/**
 * Handles clicks on action buttons (Accept, Decline, Cancel, Remove) within the connection lists.
 * Performs the API action and updates the UI minimally by removing/adding relevant items.
 * @param {Event} event - The click event object.
 */
async function handleConnectionListPageAction(event) {
  // Find the specific button clicked using event delegation
  const button = event.target.closest("button[data-action]");
  // Ignore clicks not on an action button or if button is already disabled
  if (!button || button.disabled) return;

  // Get action details from the button and its parent item
  const action = button.dataset.action;
  const connectionItem = button.closest(".connection-item");
  const connectionId = connectionItem?.dataset.connectionId;
  const originatingList = connectionItem?.parentElement; // The list the item is currently in

  // Validate necessary data is present
  if (!action || !connectionId || !connectionItem || !originatingList) {
    console.error(
      "Could not process action: Missing action, connectionId, item reference, or parent list."
    );
    return;
  }

  // Disable button(s) and show processing state
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "...";
  const actionContainer = button.closest(".connection-actions");
  const siblingButtons = actionContainer
    ? actionContainer.querySelectorAll("button")
    : [button];
  siblingButtons.forEach((btn) => {
    if (btn !== button) btn.disabled = true;
  }); // Disable siblings too

  try {
    // Determine API method and data based on action
    let method = action === "accept" || action === "decline" ? "PUT" : "DELETE";
    let data =
      action === "accept" || action === "decline" ? { action: action } : null;

    // Perform the API call
    const response = await WorkspaceApi(
      `/connections/${connectionId}/`,
      method,
      data,
      true
    ); // requiresAuth = true

    if (response.success || response.status === 204) {
      // Treat 204 No Content as success for DELETE
      // Action successful, update UI minimally
      const loggedInUser = getUserInfo();
      if (!loggedInUser)
        throw new Error("Cannot update UI without logged-in user info.");

      if (action === "accept") {
        // Remove from 'Incoming' list
        connectionItem.remove();
        checkIfListEmpty(originatingList.id);

        // Add to 'Current' list
        const currentList = document.getElementById("current-connections-list");
        // Check if backend returned updated connection data in response.data
        if (
          currentList &&
          response.data &&
          typeof createConnectionItem === "function"
        ) {
          currentList.appendChild(
            createConnectionItem(response.data, "current", loggedInUser.id)
          );
          checkIfListEmpty("current-connections-list"); // Update 'current' list's empty state
        } else if (!response.data) {
          console.warn(
            "Accept successful, but no updated connection data returned. 'Current' list may not be updated until next full load."
          );
          // Optionally call loadConnections() here as a fallback if needed, but defeats minimal update goal
        } else {
          console.error(
            "Could not find 'current-connections-list' or 'createConnectionItem' to add accepted connection."
          );
        }
      } else if (
        action === "decline" ||
        action === "cancel" ||
        action === "remove"
      ) {
        // Just remove the item from its current list
        connectionItem.remove();
        checkIfListEmpty(originatingList.id); // Update originating list's empty state
      }
      // No need to re-enable buttons as the item is removed/replaced
    } else {
      // Initial action API call failed - Alert user and re-enable buttons
      alert(`Action failed: ${response.error || "Unknown error"}`);
      siblingButtons.forEach((btn) => (btn.disabled = false));
      button.textContent = originalText;
    }
  } catch (error) {
    // Exception occurred (network error, etc.) - Alert user and re-enable buttons
    console.error(`Error performing connection action ${action}:`, error);
    alert(`An error occurred: ${error.message || "Please try again."}`);
    siblingButtons.forEach((btn) => (btn.disabled = false));
    button.textContent = originalText;
  }
} // End handleConnectionListPageAction

/**
 * Checks if a list container is empty after DOM manipulation and updates the visibility
 * of the corresponding "no items" message paragraph.
 * @param {string} listId - The ID of the list element (e.g., 'incoming-requests-list').
 */
function checkIfListEmpty(listId) {
  const listElement = document.getElementById(listId);
  // Find the parent section to locate the corresponding "no items" message
  const listSection = listElement?.closest(".connections-section");
  if (!listElement || !listSection) {
    console.warn(
      `checkIfListEmpty: Could not find list element or parent section for ID: ${listId}`
    );
    return;
  }

  // Assume the "no items" message has an ID starting with "no-" (e.g., "no-incoming")
  const noItemsMessage = listSection.querySelector('[id^="no-"]');
  if (!noItemsMessage) {
    console.warn(
      `checkIfListEmpty: Could not find 'no items' message element within section for list ID: ${listId}`
    );
    return;
  }

  // Check if the list still contains any connection items
  const hasItems = listElement.querySelector(".connection-item") !== null;

  // Toggle visibility based on whether items exist
  noItemsMessage.style.display = hasItems ? "none" : "block";
} // End checkIfListEmpty
