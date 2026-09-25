let conversations = [];

let activeConversation =
    null;

let activeOtherUser =
    null;

let chatInitialized =
    false;


function initializeChat() {

    if (chatInitialized) {
        return;
    }

    chatInitialized =
        true;

    const searchInput =
        document.getElementById(
            "chatSearch"
        );

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            searchUsers
        );
    }

    const messageForm =
        document.getElementById(
            "messageForm"
        );

    if (messageForm) {

        messageForm.addEventListener(
            "submit",
            sendChatMessage
        );
    }

    const messageInput =
        document.getElementById(
            "messageInput"
        );

    if (messageInput) {

        messageInput.addEventListener(
            "input",
            handleTyping
        );
    }

    loadConversations();
}


async function loadConversations() {

    try {

        conversations =
            await apiRequest(
                "/chats"
            );

        renderConversations();

    } catch (error) {

        console.error(
            error
        );
    }
}


function renderConversations() {

    const container =
        document.getElementById(
            "conversationList"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        "";

    if (
        conversations.length ===
        0
    ) {

        container.innerHTML =
            `
            <div class="chat-empty">
                <i class="fa-regular fa-comments"></i>
                <p>No conversations yet</p>
            </div>
            `;

        return;
    }

    conversations.forEach(
        conversation => {

            const other =
                conversation.participants.find(
                    user =>
                        String(
                            user._id
                        ) !==
                        String(
                            currentUser.id ||
                            currentUser._id
                        )
                );

            if (!other) {
                return;
            }

            const item =
                document.createElement(
                    "button"
                );

            item.className =
                "conversation-item";

            if (
                activeConversation &&
                String(
                    activeConversation._id
                ) ===
                String(
                    conversation._id
                )
            ) {
                item.classList.add(
                    "active"
                );
            }

            const avatar =
                other.profilePicture
                    ? `
                    <img
                        src="${escapeAttribute(
                            other.profilePicture
                        )}"
                        alt="Profile"
                    >
                    `
                    : `
                    <i class="fa-solid fa-user"></i>
                    `;

            const lastMessage =
                conversation.lastMessageText ||
                "Start a conversation";

            item.innerHTML =
                `
                <div class="chat-avatar">
                    ${avatar}
                </div>

                <div class="conversation-info">

                    <div class="conversation-top">

                        <strong>
                            ${escapeHtml(
                                other.name
                            )}
                        </strong>

                        <span class="presence-dot ${
                            other.status ===
                            "online"
                                ? "online"
                                : ""
                        }"></span>

                    </div>

                    <p>
                        ${escapeHtml(
                            lastMessage
                        )}
                    </p>

                </div>
                `;

            item.addEventListener(
                "click",
                () =>
                    openConversation(
                        conversation,
                        other
                    )
            );

            container.appendChild(
                item
            );
        }
    );
}


async function openConversation(
    conversation,
    otherUser
) {

    activeConversation =
        conversation;

    activeOtherUser =
        otherUser;

    if (socket) {

        socket.emit(
            "conversation:join",
            conversation._id
        );
    }

    renderConversations();

    updateChatHeader(
        otherUser
    );

    await loadMessages(
        conversation._id
    );
}


function updateChatHeader(
    user
) {

    const name =
        document.getElementById(
            "chatUserName"
        );

    const status =
        document.getElementById(
            "chatUserStatus"
        );

    const avatar =
        document.getElementById(
            "chatUserAvatar"
        );

    if (name) {
        name.textContent =
            user.name;
    }

    if (status) {

        status.textContent =
            user.status ===
            "online"
                ? "online"
                : formatLastSeen(
                    user.lastSeen
                );
    }

    if (avatar) {

        avatar.innerHTML =
            user.profilePicture
                ? `
                    <img
                        src="${escapeAttribute(
                            user.profilePicture
                        )}"
                        alt="Profile"
                    >
                  `
                : `
                    <i class="fa-solid fa-user"></i>
                  `;
    }
}


async function loadMessages(
    conversationId
) {

    const container =
        document.getElementById(
            "messagesContainer"
        );

    if (!container) {
        return;
    }

    container.innerHTML =
        `
        <div class="chat-loading">
            Loading messages...
        </div>
        `;

    try {

        const messages =
            await apiRequest(
                `/messages/conversation/${conversationId}`
            );

        container.innerHTML =
            "";

        messages.forEach(
            message => {

                container.appendChild(
                    createMessageElement(
                        message
                    )
                );
            }
        );

        scrollMessagesToBottom();

    } catch (error) {

        container.innerHTML =
            `
            <div class="chat-error">
                ${escapeHtml(
                    error.message
                )}
            </div>
            `;
    }
}


function createMessageElement(
    message
) {

    const element =
        document.createElement(
            "div"
        );

    const senderId =
        String(
            message.sender?._id ||
            message.sender
        );

    const myId =
        String(
            currentUser.id ||
            currentUser._id
        );

    const mine =
        senderId ===
        myId;

    element.className =
        `message ${
            mine
                ? "message-mine"
                : "message-other"
        }`;

    element.dataset.messageId =
        message._id;

    if (
        message.deleted
    ) {

        element.innerHTML =
            `
            <div class="message-bubble deleted-message">
                <i class="fa-solid fa-ban"></i>
                Message deleted
            </div>
            `;

        return element;
    }

    const time =
        new Date(
            message.createdAt
        ).toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    element.innerHTML =
        `
        <div class="message-bubble">

            <div class="message-text">
                ${escapeHtml(
                    message.text
                )}
            </div>

            <div class="message-meta">

                <span>
                    ${time}
                </span>

                ${
                    message.edited
                        ? `
                        <span>
                            edited
                        </span>
                        `
                        : ""
                }

                ${
                    mine
                        ? `
                        <span class="message-seen">
                            ${
                                message.seen
                                    ? "✓✓"
                                    : "✓"
                            }
                        </span>
                        `
                        : ""
                }

            </div>

            ${
                mine
                    ? `
                    <div class="message-actions">

                        <button
                            class="edit-message"
                            title="Edit"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>

                        <button
                            class="delete-message"
                            title="Delete"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>
                    `
                    : ""
            }

        </div>
        `;

    const editButton =
        element.querySelector(
            ".edit-message"
        );

    if (editButton) {

        editButton.addEventListener(
            "click",
            () =>
                editMessage(
                    message
                )
        );
    }

    const deleteButton =
        element.querySelector(
            ".delete-message"
        );

    if (deleteButton) {

        deleteButton.addEventListener(
            "click",
            () =>
                deleteChatMessage(
                    message._id
                )
        );
    }

    return element;
}


async function sendChatMessage(
    event
) {

    event.preventDefault();

    if (
        !activeConversation ||
        !activeOtherUser
    ) {

        showToast(
            "Select a conversation first"
        );

        return;
    }

    const input =
        document.getElementById(
            "messageInput"
        );

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    if (
        socket &&
        socket.connected
    ) {

        socket.emit(
            "message:send",
            {
                conversationId:
                    activeConversation._id,

                receiverId:
                    activeOtherUser._id,

                text
            }
        );

    } else {

        try {

            const result =
                await apiRequest(
                    "/messages",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body:
                            JSON.stringify({
                                conversationId:
                                    activeConversation._id,

                                receiverId:
                                    activeOtherUser._id,

                                text
                            })
                    }
                );

            handleIncomingMessage(
                result.message
            );

        } catch (error) {

            showToast(
                error.message
            );
        }
    }

    input.value =
        "";

    stopTyping();
}


function handleIncomingMessage(
    message
) {

    const conversationId =
        String(
            message.conversation?._id ||
            message.conversation
        );

    if (
        activeConversation &&
        String(
            activeConversation._id
        ) ===
        conversationId
    ) {

        const container =
            document.getElementById(
                "messagesContainer"
            );

        if (container) {

            container.appendChild(
                createMessageElement(
                    message
                )
            );

            scrollMessagesToBottom();
        }

        if (
            String(
                message.receiver?._id ||
                message.receiver
            ) ===
            String(
                currentUser.id ||
                currentUser._id
            )
        ) {

            if (socket) {

                socket.emit(
                    "message:seen",
                    {
                        messageId:
                            message._id
                    }
                );
            }
        }
    }

    loadConversations();
}


async function searchUsers(
    event
) {

    const query =
        event.target.value.trim();

    const results =
        document.getElementById(
            "userSearchResults"
        );

    if (!results) {
        return;
    }

    if (!query) {

        results.innerHTML =
            "";

        return;
    }

    try {

        const users =
            await apiRequest(
                `/users/search?q=${encodeURIComponent(
                    query
                )}`
            );

        results.innerHTML =
            "";

        users.forEach(
            user => {

                const item =
                    document.createElement(
                        "button"
                    );

                item.className =
                    "user-search-item";

                item.innerHTML =
                    `
                    <div class="chat-avatar">
                        ${
                            user.profilePicture
                                ? `
                                <img
                                    src="${escapeAttribute(
                                        user.profilePicture
                                    )}"
                                    alt="Profile"
                                >
                                `
                                : `
                                <i class="fa-solid fa-user"></i>
                                `
                        }
                    </div>

                    <div>
                        <strong>
                            ${escapeHtml(
                                user.name
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                user.email
                            )}
                        </span>
                    </div>
                    `;

                item.addEventListener(
                    "click",
                    () =>
                        startConversation(
                            user
                        )
                );

                results.appendChild(
                    item
                );
            }
        );

    } catch (error) {

        results.innerHTML =
            `
            <p>
                ${escapeHtml(
                    error.message
                )}
            </p>
            `;
    }
}


async function startConversation(
    user
) {

    try {

        const conversation =
            await apiRequest(
                "/chats",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            userId:
                                user._id
                        })
                }
            );

        document.getElementById(
            "chatSearch"
        ).value =
            "";

        document.getElementById(
            "userSearchResults"
        ).innerHTML =
            "";

        await loadConversations();

        await openConversation(
            conversation,
            user
        );

    } catch (error) {

        showToast(
            error.message
        );
    }
}


function handleTyping() {

    if (
        !activeConversation ||
        !socket
    ) {
        return;
    }

    socket.emit(
        "typing:start",
        {
            conversationId:
                activeConversation._id
        }
    );

    clearTimeout(
        window.typingTimer
    );

    window.typingTimer =
        setTimeout(
            stopTyping,
            800
        );
}


function stopTyping() {

    if (
        !activeConversation ||
        !socket
    ) {
        return;
    }

    socket.emit(
        "typing:stop",
        {
            conversationId:
                activeConversation._id
        }
    );
}


function handleTypingStart(
    data
) {

    if (
        !activeConversation ||
        String(
            data.conversationId
        ) !==
        String(
            activeConversation._id
        )
    ) {
        return;
    }

    const status =
        document.getElementById(
            "chatUserStatus"
        );

    if (status) {
        status.textContent =
            "typing...";
    }
}


function handleTypingStop(
    data
) {

    if (
        !activeOtherUser
    ) {
        return;
    }

    updateChatHeader(
        activeOtherUser
    );
}


function handleMessageSeen(
    data
) {

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        );

    if (!element) {
        return;
    }

    const seen =
        element.querySelector(
            ".message-seen"
        );

    if (seen) {
        seen.textContent =
            "✓✓";
    }
}


function handleMessageEdited(
    data
) {

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        );

    if (!element) {
        return;
    }

    const text =
        element.querySelector(
            ".message-text"
        );

    if (text) {
        text.textContent =
            data.text;
    }
}


function handleMessageDeleted(
    data
) {

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        );

    if (!element) {
        return;
    }

    element.innerHTML =
        `
        <div class="message-bubble deleted-message">
            <i class="fa-solid fa-ban"></i>
            Message deleted
        </div>
        `;
}


async function editMessage(
    message
) {

    const text =
        window.prompt(
            "Edit message",
            message.text
        );

    if (
        text === null
    ) {
        return;
    }

    const newText =
        text.trim();

    if (!newText) {
        return;
    }

    try {

        await apiRequest(
            `/messages/${message._id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify({
                        text:
                            newText
                    })
            }
        );

        if (socket) {

            socket.emit(
                "message:edit",
                {
                    messageId:
                        message._id,

                    text:
                        newText
                }
            );
        }

    } catch (error) {

        showToast(
            error.message
        );
    }
}


async function deleteChatMessage(
    messageId
) {

    const confirmed =
        window.confirm(
            "Delete this message?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await apiRequest(
            `/messages/${messageId}`,
            {
                method: "DELETE"
            }
        );

        if (socket) {

            socket.emit(
                "message:delete",
                {
                    messageId
                }
            );
        }

        handleMessageDeleted({
            messageId
        });

    } catch (error) {

        showToast(
            error.message
        );
    }
}


function handlePresenceUpdate(
    data
) {

    conversations.forEach(
        conversation => {

            conversation.participants.forEach(
                user => {

                    if (
                        String(
                            user._id
                        ) ===
                        String(
                            data.userId
                        )
                    ) {

                        user.status =
                            data.status;

                        if (
                            data.lastSeen
                        ) {
                            user.lastSeen =
                                data.lastSeen;
                        }
                    }
                }
            );
        }
    );

    renderConversations();

    if (
        activeOtherUser &&
        String(
            activeOtherUser._id
        ) ===
        String(
            data.userId
        )
    ) {

        activeOtherUser.status =
            data.status;

        activeOtherUser.lastSeen =
            data.lastSeen;

        updateChatHeader(
            activeOtherUser
        );
    }
}


function formatLastSeen(
    date
) {

    if (!date) {
        return "offline";
    }

    return `last seen ${new Date(
        date
    ).toLocaleString(
        [],
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    )}`;
}


function scrollMessagesToBottom() {

    const container =
        document.getElementById(
            "messagesContainer"
        );

    if (!container) {
        return;
    }

    container.scrollTop =
        container.scrollHeight;
}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );
}