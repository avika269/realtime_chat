let conversations = []
let activeConversation = null
let activeOtherUser = null
let chatInitialized = false
let typingTimer = null

function initializeChat() {
    if (chatInitialized) return
    chatInitialized = true

    const searchInput = document.getElementById("chatSearch")
    if (searchInput) {
        searchInput.addEventListener("input", searchUsers)
    }

    const messageForm = document.getElementById("messageForm")
    if (messageForm) {
        messageForm.addEventListener("submit", sendChatMessage)
    }

    const sendButton = document.getElementById("sendMessageButton")
    if (sendButton) {
        sendButton.addEventListener("click", sendChatMessage)
    }

    const messageInput = document.getElementById("messageInput")
    if (messageInput) {
        messageInput.addEventListener("input", handleTyping)

        messageInput.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                sendChatMessage(event)
            }
        })
    }

    loadConversations()
}

async function loadConversations() {
    try {
        conversations = await apiRequest("/chats/conversations")
        renderConversations()
    } catch (error) {
        console.error("Load conversations error:", error)

        const container = document.getElementById("conversationList")

        if (container) {
            container.innerHTML = `
                <div class="chat-error">
                    ${escapeHtml(error.message)}
                </div>
            `
        }
    }
}

function renderConversations() {
    const container = document.getElementById("conversationList")

    if (!container) return

    container.innerHTML = ""

    if (!conversations.length) {
        container.innerHTML = `
            <div class="chat-empty">
                <i class="fa-regular fa-comments"></i>
                <p>No conversations yet</p>
            </div>
        `
        return
    }

    conversations.forEach(conversation => {
        const other = conversation.participants.find(user =>
            String(user._id) !== getCurrentUserId()
        )

        if (!other) return

        const item = document.createElement("button")

        item.type = "button"
        item.className = "conversation-item"

        if (
            activeConversation &&
            String(activeConversation._id) ===
            String(conversation._id)
        ) {
            item.classList.add("active")
        }

        const avatar = other.profilePicture
            ? `
                <img
                    src="${escapeAttribute(getMediaUrl(other.profilePicture))}"
                    alt="Profile"
                >
              `
            : `
                <i class="fa-solid fa-user"></i>
              `

        const lastMessage =
            conversation.lastMessage ||
            "Start a conversation"

        item.innerHTML = `
            <div class="chat-avatar">
                ${avatar}
            </div>

            <div class="conversation-info">

                <div class="conversation-top">

                    <strong>
                        ${escapeHtml(other.name)}
                    </strong>

                    <span
                        class="presence-dot ${
                            other.status === "online"
                                ? "online"
                                : ""
                        }"
                    ></span>

                </div>

                <p>
                    ${escapeHtml(lastMessage)}
                </p>

            </div>
        `

        item.addEventListener("click", () => {
            openConversation(conversation, other)
        })

        container.appendChild(item)
    })
}

async function openConversation(
    conversation,
    otherUser
) {
    activeConversation = conversation
    activeOtherUser = otherUser

    if (socket && socket.connected) {
        socket.emit(
            "conversation:join",
            conversation._id
        )
    }

    renderConversations()

    showActiveChat()

    updateChatHeader(otherUser)

    await loadMessages(conversation._id)
}

function showActiveChat() {
    const emptyChat =
        document.getElementById("emptyChat")

    const activeChat =
        document.getElementById("activeChat")

    if (emptyChat) {
        emptyChat.classList.add("hidden")
    }

    if (activeChat) {
        activeChat.classList.remove("hidden")
    }
}

function updateChatHeader(user) {
    const name =
        document.getElementById("chatUserName")

    const status =
        document.getElementById("chatUserStatus")

    const avatar =
        document.getElementById("chatAvatar") ||
        document.getElementById("chatUserAvatar")

    if (name) {
        name.textContent = user.name || "User"
    }

    if (status) {
        if (user.status === "online") {
            status.textContent = "online"
        } else {
            status.textContent =
                formatLastSeen(user.lastSeen)
        }
    }

    if (avatar) {
        if (user.profilePicture) {
            avatar.innerHTML = `
                <img
                    src="${escapeAttribute(
                        getMediaUrl(user.profilePicture)
                    )}"
                    alt="Profile"
                >
            `
        } else {
            avatar.innerHTML =
                `<i class="fa-solid fa-user"></i>`
        }
    }
}

async function loadMessages(conversationId) {
    const container =
        document.getElementById("messagesContainer")

    if (!container) return

    container.innerHTML = `
        <div class="chat-loading">
            Loading messages...
        </div>
    `

    try {
        const messages =
            await apiRequest(
                `/messages/conversation/${conversationId}`
            )

        container.innerHTML = ""

        if (!messages.length) {
            container.innerHTML = `
                <div class="chat-empty">
                    <i class="fa-regular fa-message"></i>
                    <p>No messages yet</p>
                    <span>Send a message to start the conversation.</span>
                </div>
            `
            return
        }

        messages.forEach(message => {
            container.appendChild(
                createMessageElement(message)
            )
        })

        scrollMessagesToBottom()

    } catch (error) {
        console.error(
            "Load messages error:",
            error
        )

        container.innerHTML = `
            <div class="chat-error">
                ${escapeHtml(error.message)}
            </div>
        `
    }
}

function createMessageElement(message) {
    const element =
        document.createElement("div")

    const senderId =
        String(
            message.sender?._id ||
            message.sender
        )

    const myId =
        getCurrentUserId()

    const mine =
        senderId === myId

    element.className =
        `message ${
            mine
                ? "message-mine"
                : "message-other"
        }`

    element.dataset.messageId =
        message._id

    if (message.deleted) {
        element.innerHTML = `
            <div class="message-bubble deleted-message">
                <i class="fa-solid fa-ban"></i>
                Message deleted
            </div>
        `

        return element
    }

    const time =
        message.createdAt
            ? new Date(
                message.createdAt
            ).toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            )
            : ""

    element.innerHTML = `
        <div class="message-bubble">

            <div class="message-text">
                ${escapeHtml(message.text || "")}
            </div>

            <div class="message-meta">

                <span>
                    ${time}
                </span>

                ${
                    message.edited
                        ? `<span>edited</span>`
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
                                type="button"
                                class="edit-message"
                                title="Edit"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button
                                type="button"
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
    `

    const editButton =
        element.querySelector(
            ".edit-message"
        )

    if (editButton) {
        editButton.addEventListener(
            "click",
            () => editMessage(message)
        )
    }

    const deleteButton =
        element.querySelector(
            ".delete-message"
        )

    if (deleteButton) {
        deleteButton.addEventListener(
            "click",
            () => deleteChatMessage(
                message._id
            )
        )
    }

    return element
}

async function sendChatMessage(event) {
    if (event) {
        event.preventDefault()
    }

    if (
        !activeConversation ||
        !activeOtherUser
    ) {
        showToast(
            "Select a conversation first"
        )
        return
    }

    const input =
        document.getElementById(
            "messageInput"
        )

    if (!input) return

    const text =
        input.value.trim()

    if (!text) return

    const payload = {
        conversationId:
            activeConversation._id,

        receiverId:
            activeOtherUser._id,

        text
    }

    input.value = ""

    stopTyping()

    if (
        socket &&
        socket.connected
    ) {
        socket.emit(
            "message:send",
            payload
        )

        return
    }

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
                        JSON.stringify(payload)
                }
            )

        if (result.message) {
            handleIncomingMessage(
                result.message
            )
        }

    } catch (error) {
        console.error(
            "Send message error:",
            error
        )

        showToast(error.message)

        input.value = text
    }
}

function handleIncomingMessage(message) {
    if (!message) return

    const conversationId =
        String(
            message.conversation?._id ||
            message.conversation
        )

    const isActiveConversation =
        activeConversation &&
        String(
            activeConversation._id
        ) === conversationId

    if (isActiveConversation) {
        const container =
            document.getElementById(
                "messagesContainer"
            )

        if (container) {

            const emptyMessage =
                container.querySelector(
                    ".chat-empty"
                )

            if (emptyMessage) {
                container.innerHTML = ""
            }

            const existing =
                container.querySelector(
                    `[data-message-id="${message._id}"]`
                )

            if (!existing) {
                container.appendChild(
                    createMessageElement(
                        message
                    )
                )
            }

            scrollMessagesToBottom()
        }

        const receiverId =
            String(
                message.receiver?._id ||
                message.receiver
            )

        if (
            receiverId ===
            getCurrentUserId()
        ) {
            markMessageSeen(message._id)
        }
    }

    loadConversations()
}

async function markMessageSeen(
    messageId
) {
    try {
        await apiRequest(
            `/messages/${messageId}/seen`,
            {
                method: "POST"
            }
        )

        if (socket) {
            socket.emit(
                "message:seen",
                {
                    messageId
                }
            )
        }

    } catch (error) {
        console.error(
            "Mark seen error:",
            error
        )
    }
}

async function searchUsers(event) {
    const query =
        event.target.value.trim()

    const results =
        document.getElementById(
            "userSearchResults"
        )

    if (!results) return

    if (!query) {
        results.innerHTML = ""
        return
    }

    try {
        const users =
            await apiRequest(
                `/users/search?q=${encodeURIComponent(
                    query
                )}`
            )

        results.innerHTML = ""

        if (!users.length) {
            results.innerHTML = `
                <div class="search-empty">
                    No users found
                </div>
            `
            return
        }

        users.forEach(user => {

            if (
                String(user._id) ===
                getCurrentUserId()
            ) {
                return
            }

            const item =
                document.createElement("button")

            item.type = "button"

            item.className =
                "user-search-item"

            const avatar =
                user.profilePicture
                    ? `
                        <img
                            src="${escapeAttribute(
                                getMediaUrl(
                                    user.profilePicture
                                )
                            )}"
                            alt="Profile"
                        >
                      `
                    : `
                        <i class="fa-solid fa-user"></i>
                      `

            item.innerHTML = `
                <div class="chat-avatar">
                    ${avatar}
                </div>

                <div>
                    <strong>
                        ${escapeHtml(user.name)}
                    </strong>

                    <span>
                        ${escapeHtml(user.email)}
                    </span>
                </div>
            `

            item.addEventListener(
                "click",
                () => startConversation(user)
            )

            results.appendChild(item)
        })

    } catch (error) {
        console.error(
            "User search error:",
            error
        )

        results.innerHTML = `
            <div class="search-error">
                ${escapeHtml(error.message)}
            </div>
        `
    }
}

async function startConversation(user) {
    try {

        const conversation =
            await apiRequest(
                `/chats/conversations/${user._id}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            )

        const searchInput =
            document.getElementById(
                "chatSearch"
            )

        if (searchInput) {
            searchInput.value = ""
        }

        const results =
            document.getElementById(
                "userSearchResults"
            )

        if (results) {
            results.innerHTML = ""
        }

        await loadConversations()

        const loadedConversation =
            conversations.find(
                item =>
                    String(item._id) ===
                    String(conversation._id)
            )

        await openConversation(
            loadedConversation ||
            conversation,
            user
        )

    } catch (error) {
        console.error(
            "Start conversation error:",
            error
        )

        showToast(error.message)
    }
}

function handleTyping() {
    if (
        !activeConversation ||
        !socket ||
        !socket.connected
    ) {
        return
    }

    socket.emit(
        "typing:start",
        {
            conversationId:
                activeConversation._id
        }
    )

    clearTimeout(typingTimer)

    typingTimer =
        setTimeout(
            stopTyping,
            800
        )
}

function stopTyping() {
    clearTimeout(typingTimer)

    if (
        !activeConversation ||
        !socket ||
        !socket.connected
    ) {
        return
    }

    socket.emit(
        "typing:stop",
        {
            conversationId:
                activeConversation._id
        }
    )
}

function handleTypingStart(data) {
    if (
        !activeConversation ||
        String(
            data.conversationId
        ) !==
        String(
            activeConversation._id
        )
    ) {
        return
    }

    const status =
        document.getElementById(
            "chatUserStatus"
        )

    if (status) {
        status.textContent =
            "typing..."
    }
}

function handleTypingStop(data) {
    if (
        !activeOtherUser
    ) {
        return
    }

    updateChatHeader(
        activeOtherUser
    )
}

function handleMessageSeen(data) {
    if (!data) return

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        )

    if (!element) return

    const seen =
        element.querySelector(
            ".message-seen"
        )

    if (seen) {
        seen.textContent = "✓✓"
    }
}

function handleMessageEdited(data) {
    if (!data) return

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        )

    if (!element) return

    const text =
        element.querySelector(
            ".message-text"
        )

    if (text) {
        text.textContent =
            data.text || ""
    }

    const meta =
        element.querySelector(
            ".message-meta"
        )

    if (
        meta &&
        !meta.textContent.includes("edited")
    ) {
        const edited =
            document.createElement("span")

        edited.textContent =
            "edited"

        meta.insertBefore(
            edited,
            meta.children[1] || null
        )
    }
}

function handleMessageDeleted(data) {
    if (!data) return

    const element =
        document.querySelector(
            `[data-message-id="${data.messageId}"]`
        )

    if (!element) return

    element.innerHTML = `
        <div class="message-bubble deleted-message">
            <i class="fa-solid fa-ban"></i>
            Message deleted
        </div>
    `
}

async function editMessage(message) {
    const text =
        window.prompt(
            "Edit message",
            message.text || ""
        )

    if (text === null) return

    const newText =
        text.trim()

    if (!newText) return

    try {

        const result =
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
                            text: newText
                        })
                }
            )

        const updatedMessage =
            result.message

        if (socket) {
            socket.emit(
                "message:edit",
                {
                    messageId:
                        message._id,

                    text:
                        newText
                }
            )
        }

        handleMessageEdited({
            messageId:
                message._id,

            text:
                updatedMessage?.text ||
                newText
        })

    } catch (error) {
        console.error(
            "Edit message error:",
            error
        )

        showToast(error.message)
    }
}

async function deleteChatMessage(
    messageId
) {
    const confirmed =
        window.confirm(
            "Delete this message?"
        )

    if (!confirmed) return

    try {

        await apiRequest(
            `/messages/${messageId}`,
            {
                method: "DELETE"
            }
        )

        if (socket) {
            socket.emit(
                "message:delete",
                {
                    messageId
                }
            )
        }

        handleMessageDeleted({
            messageId
        })

    } catch (error) {
        console.error(
            "Delete message error:",
            error
        )

        showToast(error.message)
    }
}

function handlePresenceUpdate(data) {
    if (!data) return

    conversations.forEach(
        conversation => {

            conversation.participants.forEach(
                user => {

                    if (
                        String(user._id) ===
                        String(data.userId)
                    ) {
                        user.status =
                            data.status

                        if (
                            data.lastSeen
                        ) {
                            user.lastSeen =
                                data.lastSeen
                        }
                    }
                }
            )
        }
    )

    renderConversations()

    if (
        activeOtherUser &&
        String(
            activeOtherUser._id
        ) ===
        String(data.userId)
    ) {
        activeOtherUser.status =
            data.status

        activeOtherUser.lastSeen =
            data.lastSeen

        updateChatHeader(
            activeOtherUser
        )
    }
}

function formatLastSeen(date) {
    if (!date) {
        return "offline"
    }

    return `
        last seen ${
            new Date(date).toLocaleString(
                [],
                {
                    dateStyle: "short",
                    timeStyle: "short"
                }
            )
        }
    `
}

function scrollMessagesToBottom() {
    const container =
        document.getElementById(
            "messagesContainer"
        )

    if (!container) return

    container.scrollTop =
        container.scrollHeight
}

function getCurrentUserId() {
    if (!currentUser) {
        return ""
    }

    return String(
        currentUser.id ||
        currentUser._id ||
        ""
    )
}

function getMediaUrl(url) {
    if (!url) return ""

    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:")
    ) {
        return url
    }

    if (url.startsWith("/")) {
        return url
    }

    return `/${url}`
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}

function escapeAttribute(value) {
    return escapeHtml(value)
}