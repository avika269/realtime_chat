let socket = null

let token = localStorage.getItem("token")

let username = ""
let loggedInUserId = ""

let selectedUserId = ""
let selectedConversationId = ""

let replyMessageId = null

let localStream = null
let peerConnection = null

let incomingOffer = null
let callerId = null
let callerCallId = null
let callerType = "video"

let currentCallId = null
let currentCallType = "video"

let cameraEnabled = true
let microphoneEnabled = true

let typingTimeout = null

let messagesCache = []

const rtcConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.hidden = true
  })

  document.getElementById(pageId).hidden = false
}

async function api(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json"
    options.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }

  return data
}

document
  .getElementById("registerForm")
  .addEventListener("submit", async event => {
    event.preventDefault()

    const usernameInput =
      document.getElementById("registerUsername").value

    const email =
      document.getElementById("registerEmail").value

    const password =
      document.getElementById("registerPassword").value

    try {
      const data = await api("/api/register", {
        method: "POST",
        body: {
          username: usernameInput,
          email,
          password
        }
      })

      document.getElementById("registerMessage").textContent =
        data.message

      document.getElementById("registerForm").reset()

      setTimeout(() => {
        showPage("loginPage")
      }, 1000)
    } catch (error) {
      document.getElementById("registerMessage").textContent =
        error.message
    }
  })

document
  .getElementById("loginForm")
  .addEventListener("submit", async event => {
    event.preventDefault()

    const email =
      document.getElementById("loginEmail").value

    const password =
      document.getElementById("loginPassword").value

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: {
          email,
          password
        }
      })

      token = data.token
      username = data.username
      loggedInUserId = data.userId

      localStorage.setItem("token", token)

      document.getElementById("currentUsername").textContent =
        username

      connectSocket()

      showPage("chatPage")

      loadConversations()
      loadUsers()
    } catch (error) {
      document.getElementById("loginMessage").textContent =
        error.message
    }
  })

function connectSocket() {
  if (!token) {
    return
  }

  if (socket) {
    socket.disconnect()
  }

  socket = io({
    auth: {
      token
    }
  })

  socket.on("connect", () => {
    console.log("Socket connected")
  })

  socket.on("connect_error", error => {
    console.log(error.message)
  })

  socket.on("privateMessage", message => {
    handleIncomingMessage(message)
  })

  socket.on("messageError", data => {
    alert(data.message)
  })

  socket.on("userStatus", data => {
    updateUserStatus(
      data.userId,
      data.online,
      data.lastSeen
    )
  })

  socket.on("typing", data => {
    if (data.userId === selectedUserId) {
      document.getElementById("typingIndicator").textContent =
        data.typing
          ? `${data.username} is typing...`
          : ""
    }
  })

  socket.on("messageRead", data => {
    const element = document.querySelector(
      `[data-message-id="${data.messageId}"]`
    )

    if (element) {
      const status =
        element.querySelector(".messageStatus")

      if (status) {
        status.textContent = "✓✓"
      }
    }
  })

  socket.on("messageEdited", message => {
    const element = document.querySelector(
      `[data-message-id="${message._id}"]`
    )

    if (element) {
      renderSingleMessage(message, element)
    }
  })

  socket.on("messageDeleted", data => {
    const element = document.querySelector(
      `[data-message-id="${data.messageId}"]`
    )

    if (element) {
      const text =
        element.querySelector(".messageText")

      if (text) {
        text.textContent = "This message was deleted"
      }
    }
  })

  socket.on("reactionUpdated", data => {
    const element = document.querySelector(
      `[data-message-id="${data.messageId}"]`
    )

    if (!element) {
      return
    }

    const reactionElement =
      element.querySelector(".messageReaction")

    if (reactionElement) {
      reactionElement.textContent =
        data.reactions
          .map(item => item.reaction)
          .join(" ")
    }
  })

  socket.on("incomingCall", data => {
    callerId = data.from
    callerCallId = data.callId
    callerType = data.type
    incomingOffer = data.offer

    document.getElementById("callerName").textContent =
      data.username

    document.getElementById("callerType").textContent =
      data.type === "video"
        ? "Incoming video call"
        : "Incoming audio call"

    document.getElementById("incomingCall").hidden =
      false
  })

  socket.on("callAccepted", async data => {
    currentCallId = data.callId

    if (!peerConnection) {
      return
    }

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.answer)
    )

    document.getElementById("callStatus").textContent =
      "Connected"
  })

  socket.on("iceCandidate", async data => {
    if (!peerConnection) {
      return
    }

    try {
      await peerConnection.addIceCandidate(
        new RTCIceCandidate(data.candidate)
      )
    } catch (error) {
      console.log(error)
    }
  })

  socket.on("callRejected", () => {
    alert("Call rejected")
    closeCall()
    showPage("chatPage")
  })

  socket.on("callUnavailable", () => {
    alert("User is offline")
    closeCall()
    showPage("chatPage")
  })

  socket.on("endCall", () => {
    closeCall()
    showPage("chatPage")
  })
}

async function loadUsers(search = "") {
  try {
    const users = await api(
      `/api/users?search=${encodeURIComponent(search)}`
    )

    const container =
      document.getElementById("usersList")

    container.innerHTML = ""

    users.forEach(user => {
      const element = document.createElement("div")

      element.className = "listItem"

      element.innerHTML = `
        <strong>${escapeHtml(user.username)}</strong>
        <span>${user.online ? "Online" : formatLastSeen(user.lastSeen)}</span>
      `

      element.onclick = () => {
        openChat(user)
      }

      container.appendChild(element)
    })
  } catch (error) {
    console.log(error)
  }
}

async function loadConversations() {
  try {
    const conversations =
      await api("/api/conversations")

    const container =
      document.getElementById("chatList")

    container.innerHTML = ""

    conversations.forEach(conversation => {
      const otherUser =
        conversation.participants.find(
          user => user._id !== loggedInUserId
        )

      if (!otherUser) {
        return
      }

      const element = document.createElement("div")

      element.className = "listItem"

      const lastMessage =
        conversation.lastMessage?.text ||
        conversation.lastMessage?.mediaName ||
        ""

      element.innerHTML = `
        <strong>${escapeHtml(otherUser.username)}</strong>
        <span>${escapeHtml(lastMessage)}</span>
      `

      element.onclick = () => {
        openChat(otherUser, conversation._id)
      }

      container.appendChild(element)
    })
  } catch (error) {
    console.log(error)
  }
}

async function openChat(user, conversationId = null) {
  selectedUserId = user._id

  document.getElementById("activeChatName").textContent =
    user.username

  document.getElementById("activeChatStatus").textContent =
    user.online
      ? "Online"
      : formatLastSeen(user.lastSeen)

  document.getElementById("messages").innerHTML = ""

  if (!conversationId) {
    const conversation =
      await api(`/api/conversations/${user._id}`, {
        method: "POST"
      })

    selectedConversationId =
      conversation._id
  } else {
    selectedConversationId = conversationId
  }

  await loadMessages()

  if (
    window.innerWidth <= 800
  ) {
    showSidebar("chats")
  }
}

async function loadMessages() {
  if (!selectedConversationId) {
    return
  }

  try {
    messagesCache = await api(
      `/api/messages/${selectedConversationId}`
    )

    const container =
      document.getElementById("messages")

    container.innerHTML = ""

    messagesCache.forEach(message => {
      appendMessage(message)
    })

    scrollMessages()
  } catch (error) {
    console.log(error)
  }
}

function handleIncomingMessage(message) {
  if (
    message.conversationId ===
    selectedConversationId
  ) {
    appendMessage(message)
    scrollMessages()

    if (
      message.receiver._id ===
      loggedInUserId
    ) {
      socket.emit("messageRead", {
        messageId: message._id
      })
    }
  }

  loadConversations()
}

function appendMessage(message) {
  const container =
    document.getElementById("messages")

  const element =
    document.createElement("div")

  element.className =
    message.sender._id === loggedInUserId
      ? "message mine"
      : "message theirs"

  element.dataset.messageId =
    message._id

  renderSingleMessage(
    message,
    element
  )

  container.appendChild(element)
}

function renderSingleMessage(message, element) {
  element.innerHTML = ""

  const content =
    document.createElement("div")

  content.className = "messageText"

  if (message.deleted) {
    content.textContent =
      "This message was deleted"
  } else if (message.type === "image") {
    content.innerHTML = `
      <img
        class="messageImage"
        src="/api/media/${message.mediaId}"
        alt="${escapeHtml(message.mediaName)}">
      `

    if (message.text) {
      content.innerHTML += `
        <div>${escapeHtml(message.text)}</div>
      `
    }
  } else if (message.type === "video") {
    content.innerHTML = `
      <video
        class="messageVideo"
        controls
        src="/api/media/${message.mediaId}">
      </video>
    `

    if (message.text) {
      content.innerHTML += `
        <div>${escapeHtml(message.text)}</div>
      `
    }
  } else if (message.type === "audio") {
    content.innerHTML = `
      <audio
        class="messageAudio"
        controls
        src="/api/media/${message.mediaId}">
      </audio>
    `
  } else if (message.type === "document") {
    content.innerHTML = `
      <div class="messageFile">
        <a
          href="/api/media/${message.mediaId}"
          target="_blank">
          ${escapeHtml(message.mediaName)}
        </a>
      </div>
    `
  } else {
    content.textContent =
      message.text
  }

  element.appendChild(content)

  if (message.replyTo) {
    const reply =
      document.createElement("div")

    reply.textContent =
      `Reply: ${message.replyTo.text || message.replyTo.mediaName || "Media"}`

    reply.style.fontSize = "11px"
    reply.style.opacity = "0.7"

    element.insertBefore(
      reply,
      content
    )
  }

  const meta =
    document.createElement("div")

  meta.className = "messageMeta"

  meta.innerHTML = `
    <span>${formatTime(message.createdAt)}</span>
    ${message.edited ? "<span>edited</span>" : ""}
    ${
      message.sender._id === loggedInUserId
        ? `<span class="messageStatus">${message.read ? "✓✓" : "✓"}</span>`
        : ""
    }
  `

  element.appendChild(meta)

  const reaction =
    document.createElement("div")

  reaction.className =
    "messageReaction"

  reaction.textContent =
    message.reactions
      ?.map(item => item.reaction)
      .join(" ") || ""

  element.appendChild(reaction)

  const actions =
    document.createElement("div")

  actions.className =
    "messageActions"

  actions.innerHTML = `
    <button onclick="replyToMessage('${message._id}')">
      Reply
    </button>
    <button onclick="reactToMessage('${message._id}', '❤️')">
      ❤️
    </button>
    <button onclick="reactToMessage('${message._id}', '😂')">
      😂
    </button>
  `

  if (
    message.sender._id === loggedInUserId &&
    !message.deleted
  ) {
    actions.innerHTML += `
      <button onclick="editMessage('${message._id}')">
        Edit
      </button>
      <button onclick="deleteMessage('${message._id}')">
        Delete
      </button>
    `
  }

  element.appendChild(actions)
}

document
  .getElementById("messageForm")
  .addEventListener("submit", async event => {
    event.preventDefault()

    if (!selectedUserId) {
      alert("Select a user first")
      return
    }

    const input =
      document.getElementById("messageInput")

    const text =
      input.value.trim()

    if (!text) {
      return
    }

    socket.emit("privateMessage", {
      receiverId: selectedUserId,
      text,
      type: "text",
      replyTo: replyMessageId
    })

    input.value = ""

    cancelReply()

    socket.emit("typing", {
      receiverId: selectedUserId,
      typing: false
    })
  })

document
  .getElementById("messageInput")
  .addEventListener("input", () => {
    if (!selectedUserId) {
      return
    }

    socket.emit("typing", {
      receiverId: selectedUserId,
      typing: true
    })

    clearTimeout(typingTimeout)

    typingTimeout = setTimeout(() => {
      socket.emit("typing", {
        receiverId: selectedUserId,
        typing: false
      })
    }, 700)
  })

document
  .getElementById("fileInput")
  .addEventListener("change", async event => {
    const file = event.target.files[0]

    if (!file || !selectedUserId) {
      return
    }

    try {
      const formData =
        new FormData()

      formData.append(
        "file",
        file
      )

      const response =
        await fetch("/api/media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        })

      const media =
        await response.json()

      if (!response.ok) {
        throw new Error(
          media.message
        )
      }

      socket.emit("privateMessage", {
        receiverId: selectedUserId,
        text: "",
        type: media.type,
        mediaId: media.mediaId,
        mediaName: media.name,
        mediaType: media.mimeType,
        mediaSize: media.size,
        replyTo: replyMessageId
      })

      cancelReply()
    } catch (error) {
      alert(error.message)
    }

    event.target.value = ""
  })

function replyToMessage(messageId) {
  const message =
    messagesCache.find(
      item => item._id === messageId
    )

  if (!message) {
    return
  }

  replyMessageId =
    messageId

  document.getElementById(
    "replyText"
  ).textContent =
    message.text ||
    message.mediaName ||
    "Media"

  document.getElementById(
    "replyBox"
  ).hidden = false
}

function cancelReply() {
  replyMessageId = null

  document.getElementById(
    "replyBox"
  ).hidden = true
}

function editMessage(messageId) {
  const message =
    messagesCache.find(
      item => item._id === messageId
    )

  if (!message) {
    return
  }

  const newText =
    prompt(
      "Edit message",
      message.text
    )

  if (
    newText === null ||
    !newText.trim()
  ) {
    return
  }

  socket.emit("editMessage", {
    messageId,
    text: newText.trim()
  })
}

function deleteMessage(messageId) {
  if (
    !confirm(
      "Delete this message?"
    )
  ) {
    return
  }

  socket.emit("deleteMessage", {
    messageId
  })
}

function reactToMessage(
  messageId,
  reaction
) {
  socket.emit("reaction", {
    messageId,
    reaction
  })
}

async function openProfile() {
  try {
    const data =
      await api("/api/me")

    document.getElementById(
      "profileUsername"
    ).textContent =
      data.user.username

    document.getElementById(
      "profileEmail"
    ).textContent =
      data.user.email

    document.getElementById(
      "profileAbout"
    ).value =
      data.user.about || ""

    document.getElementById(
      "myAvatar"
    ).textContent =
      data.user.username
        .charAt(0)
        .toUpperCase()

    document.getElementById(
      "profilePanel"
    ).hidden = false
  } catch (error) {
    alert(error.message)
  }
}

function closeProfile() {
  document.getElementById(
    "profilePanel"
  ).hidden = true
}

async function saveProfile() {
  try {
    const about =
      document.getElementById(
        "profileAbout"
      ).value

    await api("/api/profile", {
      method: "PATCH",
      body: {
        about
      }
    })

    alert("Profile updated")

    closeProfile()
  } catch (error) {
    alert(error.message)
  }
}

async function openUserProfile() {
  if (!selectedUserId) {
    return
  }

  try {
    const user =
      await api(
        `/api/users/${selectedUserId}`
      )

    document.getElementById(
      "otherUsername"
    ).textContent =
      user.username

    document.getElementById(
      "otherAbout"
    ).textContent =
      user.about

    document.getElementById(
      "otherStatus"
    ).textContent =
      user.online
        ? "Online"
        : formatLastSeen(user.lastSeen)

    document.getElementById(
      "otherAvatar"
    ).textContent =
      user.username
        .charAt(0)
        .toUpperCase()

    document.getElementById(
      "userProfileModal"
    ).hidden = false
  } catch (error) {
    alert(error.message)
  }
}

function closeUserProfile() {
  document.getElementById(
    "userProfileModal"
  ).hidden = true
}

async function addContact() {
  if (!selectedUserId) {
    return
  }

  try {
    await api(
      `/api/contacts/${selectedUserId}`,
      {
        method: "POST"
      }
    )

    alert("Contact added")
  } catch (error) {
    alert(error.message)
  }
}

async function blockUser() {
  if (!selectedUserId) {
    return
  }

  try {
    await api(
      `/api/block/${selectedUserId}`,
      {
        method: "POST"
      }
    )

    closeUserProfile()

    alert("User blocked")
  } catch (error) {
    alert(error.message)
  }
}

function showSidebar(type) {
  document.getElementById(
    "chatList"
  ).hidden = type !== "chats"

  document.getElementById(
    "usersList"
  ).hidden = type !== "users"

  document.getElementById(
    "callsList"
  ).hidden = type !== "calls"

  if (type === "users") {
    loadUsers()
  }

  if (type === "calls") {
    loadCalls()
  }
}

document
  .getElementById("userSearch")
  .addEventListener("input", event => {
    loadUsers(event.target.value)
  })

async function loadCalls() {
  try {
    const calls =
      await api("/api/calls")

    const container =
      document.getElementById(
        "callsList"
      )

    container.innerHTML = ""

    calls.forEach(call => {
      const other =
        call.caller._id === loggedInUserId
          ? call.receiver
          : call.caller

      const element =
        document.createElement("div")

      element.className =
        "listItem"

      element.innerHTML = `
        <strong>${escapeHtml(other.username)}</strong>
        <span>
          ${call.type} call · ${call.status}
        </span>
      `

      container.appendChild(element)
    })
  } catch (error) {
    console.log(error)
  }
}

async function startVideoCall() {
  await startCall("video")
}

async function startAudioCall() {
  await startCall("audio")
}

async function startCall(type) {
  if (!selectedUserId) {
    alert("Select a user first")
    return
  }

  currentCallType = type

  showPage("callPage")

  document.getElementById(
    "callStatus"
  ).textContent =
    "Calling..."

  await startCamera(type)

  createPeerConnection()

  const offer =
    await peerConnection.createOffer()

  await peerConnection.setLocalDescription(
    offer
  )

  socket.emit("callUser", {
    to: selectedUserId,
    type,
    offer
  })
}

async function startCamera(type) {
  if (localStream) {
    localStream
      .getTracks()
      .forEach(track =>
        track.stop()
      )
  }

  localStream =
    await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true
    })

  document.getElementById(
    "localVideo"
  ).srcObject =
    localStream
}

function createPeerConnection() {
  peerConnection =
    new RTCPeerConnection(
      rtcConfiguration
    )

  if (localStream) {
    localStream
      .getTracks()
      .forEach(track => {
        peerConnection.addTrack(
          track,
          localStream
        )
      })
  }

  peerConnection.ontrack = event => {
    document.getElementById(
      "remoteVideo"
    ).srcObject =
      event.streams[0]
  }

  peerConnection.onicecandidate =
    event => {
      if (
        event.candidate &&
        selectedUserId
      ) {
        socket.emit(
          "iceCandidate",
          {
            to: selectedUserId,
            candidate:
              event.candidate
          }
        )
      }
    }

  peerConnection.onconnectionstatechange =
    () => {
      if (
        peerConnection.connectionState ===
        "connected"
      ) {
        document.getElementById(
          "callStatus"
        ).textContent =
          "Connected"
      }

      if (
        peerConnection.connectionState ===
        "disconnected"
      ) {
        closeCall()
        showPage("chatPage")
      }
    }
}

async function acceptCall() {
  document.getElementById(
    "incomingCall"
  ).hidden = true

  selectedUserId = callerId
  currentCallId = callerCallId
  currentCallType = callerType

  showPage("callPage")

  document.getElementById(
    "callStatus"
  ).textContent =
    "Connecting..."

  await startCamera(
    callerType
  )

  createPeerConnection()

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(
      incomingOffer
    )
  )

  const answer =
    await peerConnection.createAnswer()

  await peerConnection.setLocalDescription(
    answer
  )

  socket.emit("callAccepted", {
    to: callerId,
    callId: callerCallId,
    answer
  })
}

function rejectCall() {
  document.getElementById(
    "incomingCall"
  ).hidden = true

  if (socket && callerId) {
    socket.emit("callRejected", {
      to: callerId,
      callId: callerCallId
    })
  }

  incomingOffer = null
  callerId = null
  callerCallId = null
}

function toggleCamera() {
  if (!localStream) {
    return
  }

  const videoTrack =
    localStream.getVideoTracks()[0]

  if (!videoTrack) {
    return
  }

  cameraEnabled =
    !cameraEnabled

  videoTrack.enabled =
    cameraEnabled
}

function toggleMicrophone() {
  if (!localStream) {
    return
  }

  const audioTrack =
    localStream.getAudioTracks()[0]

  if (!audioTrack) {
    return
  }

  microphoneEnabled =
    !microphoneEnabled

  audioTrack.enabled =
    microphoneEnabled
}

function endCall() {
  if (
    socket &&
    selectedUserId
  ) {
    socket.emit("endCall", {
      to: selectedUserId,
      callId: currentCallId
    })
  }

  closeCall()

  showPage("chatPage")
}

function closeCall() {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  if (localStream) {
    localStream
      .getTracks()
      .forEach(track =>
        track.stop()
      )

    localStream = null
  }

  document.getElementById(
    "localVideo"
  ).srcObject = null

  document.getElementById(
    "remoteVideo"
  ).srcObject = null

  currentCallId = null
}

function updateUserStatus(
  userId,
  online,
  lastSeen
) {
  if (
    userId === selectedUserId
  ) {
    document.getElementById(
      "activeChatStatus"
    ).textContent =
      online
        ? "Online"
        : formatLastSeen(lastSeen)
  }

  loadConversations()
}

function formatTime(date) {
  return new Date(date)
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
}

function formatLastSeen(date) {
  if (!date) {
    return "Offline"
  }

  return `Last seen ${new Date(date).toLocaleString()}`
}

function scrollMessages() {
  const container =
    document.getElementById(
      "messages"
    )

  container.scrollTop =
    container.scrollHeight
}

function sendEmoji() {
  const input =
    document.getElementById(
      "messageInput"
    )

  input.value += "😊"

  input.focus()
}

function escapeHtml(value) {
  const div =
    document.createElement("div")

  div.textContent =
    value || ""

  return div.innerHTML
}

function logout() {
  if (socket) {
    socket.disconnect()
  }

  localStorage.removeItem("token")

  token = null
  username = ""
  loggedInUserId = ""
  selectedUserId = ""
  selectedConversationId = ""

  closeCall()

  showPage("loginPage")
}

async function initialize() {
  if (!token) {
    showPage("loginPage")
    return
  }

  try {
    const data =
      await api("/api/me")

    username =
      data.user.username

    loggedInUserId =
      data.user._id

    document.getElementById(
      "currentUsername"
    ).textContent =
      username

    connectSocket()

    showPage("chatPage")

    await loadConversations()
    await loadUsers()
  } catch (error) {
    localStorage.removeItem("token")
    token = null
    showPage("loginPage")
  }
}

initialize()