let socket = null
let token = localStorage.getItem("token") || null

let username = ""
let loggedInUserId = ""

let selectedUserId = ""
let selectedConversationId = ""

let replyMessageId = null

let localStream = null
let peerConnection = null
let activeCallPartnerId = null

let incomingOffer = null
let callerId = null
let callerCallId = null
let callerType = "video"

let currentCallId = null
let currentCallType = "video"

let cameraEnabled = true
let microphoneEnabled = true

let iceCandidatesQueue = []

let typingTimeout = null
let messagesCache = []

const GOOGLE_CLIENT_ID ="433889585065-9ltgsff9rgd5b6oco7p6f8647uksfp14.apps.googleusercontent.com"
const rtcConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
}

function safeGet(id) {
  return document.getElementById(id)
}

function safeOn(id, event, handler) {
  const el = safeGet(id)
  if (el) {
    el.addEventListener(event, handler)
  }
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.hidden = true
    page.style.display = "none"
  })

  const page = safeGet(pageId)
  if (page) {
    page.hidden = false
    page.style.display = ""
  }

  if (pageId === "loginPage" || pageId === "registerPage") {
    renderGoogleButton()
  }
}

function toggleVisibility(elementId, visible, displayType = "block") {
  const el = safeGet(elementId)
  if (!el) return
  el.hidden = !visible
  el.style.display = visible ? displayType : "none"
}

function escapeHtml(value) {
  if (!value) return ""
  const div = document.createElement("div")
  div.textContent = String(value)
  return div.innerHTML
}

function formatTime(date) {
  if (!date) return ""
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })
}

function formatLastSeen(date) {
  if (!date) return "Offline"
  return `Last seen ${new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

function scrollMessages() {
  const container = safeGet("messages")
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

async function api(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body && !(options.body instanceof FormData)) {
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

function renderGoogleButton() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    setTimeout(renderGoogleButton, 300)
    return
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredentialResponse
  })

  const loginTarget = safeGet("googleBtnLogin")
  if (loginTarget) {
    google.accounts.id.renderButton(loginTarget, {
      theme: "filled_blue",
      size: "large",
      width: 320,
      text: "continue_with"
    })
  }

  const registerTarget = safeGet("googleBtnRegister")
  if (registerTarget) {
    google.accounts.id.renderButton(registerTarget, {
      theme: "filled_blue",
      size: "large",
      width: 320,
      text: "signup_with"
    })
  }
}

async function handleGoogleCredentialResponse(response) {
  try {
    const data = await api("/api/google", {
      method: "POST",
      body: {
        idToken: response.credential
      }
    })

    token = data.token
    username = data.username
    loggedInUserId = data.userId

    localStorage.setItem("token", token)

    const userHeader = safeGet("currentUsername")
    if (userHeader) userHeader.textContent = username

    connectSocket()
    showPage("chatPage")

    await loadConversations()
    await loadUsers()
  } catch (error) {
    const loginMsg = safeGet("loginMessage")
    if (loginMsg) loginMsg.textContent = error.message

    const regMsg = safeGet("registerMessage")
    if (regMsg) regMsg.textContent = error.message
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

  if (!socket || !socket.connected) {
    alert("Socket is not connected. Please check your network.")
    return
  }

  currentCallType = type
  activeCallPartnerId = selectedUserId
  iceCandidatesQueue = []

  showPage("callPage")

  const callStatus = safeGet("callStatus")
  if (callStatus) callStatus.textContent = "Calling..."

  try {
    await startCamera(type)
    createPeerConnection()

    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    socket.emit("callUser", {
      to: activeCallPartnerId,
      type,
      offer
    })
  } catch (error) {
    console.error("Error starting call:", error)
    alert("Could not start the call: " + error.message)
    closeCall()
    showPage("chatPage")
  }
}

async function startCamera(type) {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    video: type === "video",
    audio: true
  })

  const localVideo = safeGet("localVideo")
  if (localVideo) {
    localVideo.srcObject = localStream
  }

  cameraEnabled = type === "video"
  microphoneEnabled = true
}

function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }

  peerConnection = new RTCPeerConnection(rtcConfiguration)

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream)
    })
  }

  peerConnection.ontrack = event => {
    const remoteVideo = safeGet("remoteVideo")
    if (remoteVideo && event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0]
    }
  }

  peerConnection.onicecandidate = event => {
    if (event.candidate && activeCallPartnerId && socket) {
      socket.emit("iceCandidate", {
        to: activeCallPartnerId,
        candidate: event.candidate
      })
    }
  }

  peerConnection.onconnectionstatechange = () => {
    if (!peerConnection) return

    const callStatus = safeGet("callStatus")

    if (peerConnection.connectionState === "connected") {
      if (callStatus) callStatus.textContent = "Connected"
    }

    if (
      peerConnection.connectionState === "disconnected" ||
      peerConnection.connectionState === "failed"
    ) {
      closeCall()
      showPage("chatPage")
    }
  }
}

async function processBufferedIceCandidates() {
  if (!peerConnection) return
  while (iceCandidatesQueue.length > 0) {
    const candidate = iceCandidatesQueue.shift()
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (e) {
      console.error("Failed adding buffered ICE candidate:", e)
    }
  }
}

async function acceptCall() {
  toggleVisibility("incomingCall", false)

  if (!callerId || !callerCallId || !incomingOffer) {
    alert("Call information is missing or expired")
    return
  }

  activeCallPartnerId = callerId
  currentCallId = callerCallId
  currentCallType = callerType
  iceCandidatesQueue = []

  showPage("callPage")

  const callStatus = safeGet("callStatus")
  if (callStatus) callStatus.textContent = "Connecting..."

  try {
    await startCamera(callerType)
    createPeerConnection()

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(incomingOffer)
    )
    await processBufferedIceCandidates()

    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)

    socket.emit("callAccepted", {
      to: callerId,
      callId: callerCallId,
      answer
    })

    incomingOffer = null
  } catch (error) {
    console.error("Error accepting call:", error)
    alert("Could not accept call: " + error.message)
    closeCall()
    showPage("chatPage")
  }
}

function rejectCall() {
  toggleVisibility("incomingCall", false)

  if (socket && callerId) {
    socket.emit("callRejected", {
      to: callerId,
      callId: callerCallId
    })
  }

  incomingOffer = null
  callerId = null
  callerCallId = null
  callerType = "video"
}

function toggleCamera() {
  if (!localStream) return
  const videoTrack = localStream.getVideoTracks()[0]
  if (!videoTrack) return

  cameraEnabled = !cameraEnabled
  videoTrack.enabled = cameraEnabled
}

function toggleMicrophone() {
  if (!localStream) return
  const audioTrack = localStream.getAudioTracks()[0]
  if (!audioTrack) return

  microphoneEnabled = !microphoneEnabled
  audioTrack.enabled = microphoneEnabled
}

function endCall() {
  if (socket && activeCallPartnerId) {
    socket.emit("endCall", {
      to: activeCallPartnerId,
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
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }

  const localVideo = safeGet("localVideo")
  const remoteVideo = safeGet("remoteVideo")

  if (localVideo) localVideo.srcObject = null
  if (remoteVideo) remoteVideo.srcObject = null

  currentCallId = null
  activeCallPartnerId = null
  iceCandidatesQueue = []
  cameraEnabled = true
  microphoneEnabled = true
}

function connectSocket() {
  if (!token) return

  if (socket) {
    socket.disconnect()
  }

  socket = io({
    auth: { token }
  })

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id)
  })

  socket.on("connect_error", error => {
    console.error("Socket error:", error.message)
  })

  socket.on("privateMessage", message => {
    handleIncomingMessage(message)
  })

  socket.on("messageError", data => {
    alert(data.message || "Message error")
  })

  socket.on("userStatus", data => {
    updateUserStatus(data.userId, data.online, data.lastSeen)
  })

  socket.on("typing", data => {
    const senderId = data.userId || data.from
    if (senderId === selectedUserId) {
      const indicator = safeGet("typingIndicator")
      if (indicator) {
        indicator.textContent = data.typing ? `${data.username} is typing...` : ""
      }
    }
  })

  socket.on("messageRead", data => {
    const element = document.querySelector(`[data-message-id="${data.messageId}"]`)
    if (element) {
      const status = element.querySelector(".messageStatus")
      if (status) status.textContent = "✓✓"
    }
  })

  socket.on("messageEdited", message => {
    const element = document.querySelector(`[data-message-id="${message._id}"]`)
    if (element) {
      renderSingleMessage(message, element)
    }
  })

  socket.on("messageDeleted", data => {
    const element = document.querySelector(`[data-message-id="${data.messageId}"]`)
    if (element) {
      const text = element.querySelector(".messageText")
      if (text) text.textContent = "This message was deleted"
    }
  })

  socket.on("reactionUpdated", data => {
    const element = document.querySelector(`[data-message-id="${data.messageId}"]`)
    if (!element) return

    const reactionElement = element.querySelector(".messageReaction")
    if (reactionElement) {
      reactionElement.textContent = data.reactions.map(item => item.reaction).join(" ")
    }
  })

  socket.on("incomingCall", data => {
    callerId = data.from
    callerCallId = data.callId
    callerType = data.type || "video"
    incomingOffer = data.offer

    const callerName = safeGet("callerName")
    const callerTypeElement = safeGet("callerType")

    if (callerName) callerName.textContent = data.username || "Unknown"
    if (callerTypeElement) {
      callerTypeElement.textContent =
        data.type === "video" ? "Incoming Video Call" : "Incoming Audio Call"
    }

    toggleVisibility("incomingCall", true, "flex")
  })

  socket.on("callAccepted", async data => {
    currentCallId = data.callId
    if (!peerConnection) return

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      )
      await processBufferedIceCandidates()

      const callStatus = safeGet("callStatus")
      if (callStatus) callStatus.textContent = "Connected"
    } catch (error) {
      console.error("Error setting call accepted remote description:", error)
    }
  })

  socket.on("iceCandidate", async data => {
    if (!peerConnection || !peerConnection.remoteDescription) {
      iceCandidatesQueue.push(data.candidate)
      return
    }

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
    } catch (error) {
      console.error("Error adding ICE candidate:", error)
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
  const container = safeGet("usersList")
  if (!container) return

  try {
    const users = await api(`/api/users?search=${encodeURIComponent(search)}`)
    container.innerHTML = ""

    if (!Array.isArray(users) || users.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem 1.25rem; text-align: center; color: #94a3b8; font-size: 0.9rem;">
          No other users found.<br>
          <small style="opacity: 0.7;">Sign in with another college account to test.</small>
        </div>
      `
      return
    }

    users.forEach(user => {
      const element = document.createElement("div")
      element.className = "listItem"
      element.innerHTML = `
        <strong>${escapeHtml(user.username)}</strong>
        <span>${user.online ? "Online" : formatLastSeen(user.lastSeen)}</span>
      `
      element.onclick = () => openChat(user)
      container.appendChild(element)
    })
  } catch (error) {
    console.error("Error loading users:", error)
    container.innerHTML = `
      <div style="padding: 1rem; color: #ef4444; text-align: center; font-size: 0.85rem;">
        Failed to load users: ${escapeHtml(error.message)}
      </div>
    `
  }
}

async function loadConversations() {
  try {
    const conversations = await api("/api/conversations")
    const container = safeGet("chatList")
    if (!container) return

    container.innerHTML = ""

    if (!Array.isArray(conversations) || conversations.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem 1.25rem; text-align: center; color: #94a3b8; font-size: 0.88rem;">
          No active conversations.<br>
          <small style="opacity: 0.7;">Click on "Users" to start chatting.</small>
        </div>
      `
      return
    }

    conversations.forEach(conversation => {
      const otherUser = conversation.participants.find(
        u => u._id !== loggedInUserId
      )
      if (!otherUser) return

      const element = document.createElement("div")
      element.className = "listItem"

      const lastMessage =
        conversation.lastMessage?.text ||
        conversation.lastMessage?.mediaName ||
        "No messages yet"

      element.innerHTML = `
        <strong>${escapeHtml(otherUser.username)}</strong>
        <span>${escapeHtml(lastMessage)}</span>
      `
      element.onclick = () => openChat(otherUser, conversation._id)
      container.appendChild(element)
    })
  } catch (error) {
    console.error("Error loading conversations:", error)
  }
}

async function openChat(user, conversationId = null) {
  selectedUserId = user._id

  const activeChatName = safeGet("activeChatName")
  const activeChatStatus = safeGet("activeChatStatus")
  const activeChatAvatarBox = safeGet("activeChatAvatarBox")
  const messages = safeGet("messages")

  if (activeChatName) activeChatName.textContent = user.username
  if (activeChatAvatarBox) activeChatAvatarBox.textContent = user.username.charAt(0).toUpperCase()
  if (activeChatStatus) {
    activeChatStatus.textContent = user.online ? "Online" : formatLastSeen(user.lastSeen)
  }
  if (messages) messages.innerHTML = ""

  if (!conversationId) {
    const conversation = await api(`/api/conversations/${user._id}`, {
      method: "POST"
    })
    selectedConversationId = conversation._id
  } else {
    selectedConversationId = conversationId
  }

  await loadMessages()

  if (window.innerWidth <= 820) {
    const sidebar = document.querySelector(".sidebar")
    if (sidebar) sidebar.style.display = "none"
  }
}

function closeMobileChat() {
  const sidebar = document.querySelector(".sidebar")
  if (sidebar) sidebar.style.display = "flex"
}

async function loadMessages() {
  if (!selectedConversationId) return

  try {
    messagesCache = await api(`/api/messages/${selectedConversationId}`)
    const container = safeGet("messages")
    if (!container) return

    container.innerHTML = ""
    messagesCache.forEach(message => appendMessage(message))
    scrollMessages()
  } catch (error) {
    console.error("Error loading messages:", error)
  }
}

function handleIncomingMessage(message) {
  if (message.conversationId === selectedConversationId) {
    appendMessage(message)
    scrollMessages()

    if (message.receiver?._id === loggedInUserId || message.receiver === loggedInUserId) {
      socket.emit("messageRead", { messageId: message._id })
    }
  }
  loadConversations()
}

function appendMessage(message) {
  const container = safeGet("messages")
  if (!container) return

  const isMine = (message.sender?._id || message.sender) === loggedInUserId
  const element = document.createElement("div")
  element.className = isMine ? "message mine" : "message theirs"
  element.dataset.messageId = message._id

  renderSingleMessage(message, element)
  container.appendChild(element)
}

function renderSingleMessage(message, element) {
  element.innerHTML = ""

  const isMine = (message.sender?._id || message.sender) === loggedInUserId

  if (message.replyTo) {
    const reply = document.createElement("div")
    reply.className = "messageReplyPreview"
    reply.textContent = `Replying to: ${message.replyTo.text || message.replyTo.mediaName || "Media"}`
    element.appendChild(reply)
  }

  const content = document.createElement("div")
  content.className = "messageText"

  if (message.deleted) {
    content.textContent = "This message was deleted"
  } else if (message.type === "image") {
    content.innerHTML = `
      <img class="messageImage" src="/api/media/${message.mediaId}" alt="${escapeHtml(message.mediaName)}">
      ${message.text ? `<div>${escapeHtml(message.text)}</div>` : ""}
    `
  } else if (message.type === "video") {
    content.innerHTML = `
      <video class="messageVideo" controls src="/api/media/${message.mediaId}"></video>
      ${message.text ? `<div>${escapeHtml(message.text)}</div>` : ""}
    `
  } else if (message.type === "audio") {
    content.innerHTML = `
      <audio class="messageAudio" controls src="/api/media/${message.mediaId}"></audio>
    `
  } else if (message.type === "document") {
    content.innerHTML = `
      <div class="messageFile">
        <a href="/api/media/${message.mediaId}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">
          📄 ${escapeHtml(message.mediaName || "Download Document")}
        </a>
      </div>
    `
  } else {
    content.textContent = message.text || ""
  }
  element.appendChild(content)

  const meta = document.createElement("div")
  meta.className = "messageMeta"
  meta.innerHTML = `
    <span>${formatTime(message.createdAt)}</span>
    ${message.edited ? "<span>edited</span>" : ""}
    ${isMine ? `<span class="messageStatus">${message.read ? "✓✓" : "✓"}</span>` : ""}
  `
  element.appendChild(meta)

  const reaction = document.createElement("div")
  reaction.className = "messageReaction"
  reaction.textContent = message.reactions?.map(item => item.reaction).join(" ") || ""
  element.appendChild(reaction)

  const actions = document.createElement("div")
  actions.className = "messageActions"

  const replyBtn = document.createElement("button")
  replyBtn.type = "button"
  replyBtn.textContent = "Reply"
  replyBtn.onclick = () => replyToMessage(message._id)
  actions.appendChild(replyBtn)

  const heartBtn = document.createElement("button")
  heartBtn.type = "button"
  heartBtn.textContent = "❤️"
  heartBtn.onclick = () => reactToMessage(message._id, "❤️")
  actions.appendChild(heartBtn)

  const laughBtn = document.createElement("button")
  laughBtn.type = "button"
  laughBtn.textContent = "😂"
  laughBtn.onclick = () => reactToMessage(message._id, "😂")
  actions.appendChild(laughBtn)

  if (isMine && !message.deleted) {
    const editBtn = document.createElement("button")
    editBtn.type = "button"
    editBtn.textContent = "Edit"
    editBtn.onclick = () => editMessage(message._id)
    actions.appendChild(editBtn)

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.textContent = "Delete"
    deleteBtn.onclick = () => deleteMessage(message._id)
    actions.appendChild(deleteBtn)
  }

  element.appendChild(actions)
}

function replyToMessage(messageId) {
  const message = messagesCache.find(item => item._id === messageId)
  if (!message) return

  replyMessageId = messageId

  const replyText = safeGet("replyText")
  if (replyText) {
    replyText.textContent = message.text || message.mediaName || "Media"
  }

  toggleVisibility("replyBox", true, "flex")
}

function cancelReply() {
  replyMessageId = null
  toggleVisibility("replyBox", false)
}

function editMessage(messageId) {
  const message = messagesCache.find(item => item._id === messageId)
  if (!message) return

  const newText = prompt("Edit message", message.text || "")
  if (newText === null || !newText.trim()) return

  if (socket) {
    socket.emit("editMessage", {
      messageId,
      text: newText.trim()
    })
  }
}

function deleteMessage(messageId) {
  if (!confirm("Delete this message?")) return

  if (socket) {
    socket.emit("deleteMessage", { messageId })
  }
}

function reactToMessage(messageId, reaction) {
  if (socket) {
    socket.emit("reaction", { messageId, reaction })
  }
}

function sendEmoji() {
  const input = safeGet("messageInput")
  if (!input) return
  input.value += "😊"
  input.focus()
}

async function openProfile() {
  try {
    const data = await api("/api/me")

    const usernameEl = safeGet("profileUsername")
    const emailEl = safeGet("profileEmail")
    const aboutEl = safeGet("profileAbout")
    const avatarEl = safeGet("myAvatar")

    if (usernameEl) usernameEl.textContent = data.user.username
    if (emailEl) emailEl.textContent = data.user.email
    if (aboutEl) aboutEl.value = data.user.about || ""
    if (avatarEl) avatarEl.textContent = data.user.username.charAt(0).toUpperCase()

    toggleVisibility("profilePanel", true, "flex")
  } catch (error) {
    alert(error.message)
  }
}

function closeProfile() {
  toggleVisibility("profilePanel", false)
}

async function saveProfile() {
  try {
    const aboutInput = safeGet("profileAbout")
    const about = aboutInput ? aboutInput.value : ""

    await api("/api/profile", {
      method: "PATCH",
      body: { about }
    })

    alert("Profile updated successfully")
    closeProfile()
  } catch (error) {
    alert(error.message)
  }
}

async function openUserProfile() {
  if (!selectedUserId) return

  try {
    const user = await api(`/api/users/${selectedUserId}`)

    const usernameEl = safeGet("otherUsername")
    const aboutEl = safeGet("otherAbout")
    const statusEl = safeGet("otherStatus")
    const avatarEl = safeGet("otherAvatar")

    if (usernameEl) usernameEl.textContent = user.username
    if (aboutEl) aboutEl.textContent = user.about || "Hey there! I am using PulseChat."
    if (statusEl) {
      statusEl.textContent = user.online ? "Online" : formatLastSeen(user.lastSeen)
    }
    if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase()

    toggleVisibility("userProfileModal", true, "flex")
  } catch (error) {
    alert(error.message)
  }
}

function closeUserProfile() {
  toggleVisibility("userProfileModal", false)
}

async function addContact() {
  if (!selectedUserId) return

  try {
    await api(`/api/contacts/${selectedUserId}`, {
      method: "POST"
    })
    alert("Contact added to your list")
  } catch (error) {
    alert(error.message)
  }
}

async function blockUser() {
  if (!selectedUserId) return

  try {
    await api(`/api/block/${selectedUserId}`, {
      method: "POST"
    })
    closeUserProfile()
    alert("User blocked")
  } catch (error) {
    alert(error.message)
  }
}

function showSidebar(type) {
  toggleVisibility("chatList", type === "chats")
  toggleVisibility("usersList", type === "users")
  toggleVisibility("callsList", type === "calls")

  safeGet("tabChats")?.classList.toggle("activeTab", type === "chats")
  safeGet("tabUsers")?.classList.toggle("activeTab", type === "users")
  safeGet("tabCalls")?.classList.toggle("activeTab", type === "calls")

  if (type === "users") loadUsers()
  if (type === "calls") loadCalls()
}

async function loadCalls() {
  try {
    const calls = await api("/api/calls")
    const container = safeGet("callsList")
    if (!container) return

    container.innerHTML = ""

    if (!Array.isArray(calls) || calls.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem 1.25rem; text-align: center; color: #94a3b8; font-size: 0.88rem;">
          No call logs found.
        </div>
      `
      return
    }

    calls.forEach(call => {
      const other =
        (call.caller?._id || call.caller) === loggedInUserId
          ? call.receiver
          : call.caller

      const element = document.createElement("div")
      element.className = "listItem"
      element.innerHTML = `
        <strong>${escapeHtml(other?.username || "Unknown")}</strong>
        <span>${call.type.toUpperCase()} call · ${call.status}</span>
      `
      container.appendChild(element)
    })
  } catch (error) {
    console.error("Error loading calls:", error)
  }
}

function updateUserStatus(userId, online, lastSeen) {
  if (userId === selectedUserId) {
    const status = safeGet("activeChatStatus")
    if (status) {
      status.textContent = online ? "Online" : formatLastSeen(lastSeen)
    }
  }
  loadConversations()
}

function logout() {
  if (socket) {
    socket.disconnect()
    socket = null
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

function setupEventListeners() {
  safeOn("registerForm", "submit", async event => {
    event.preventDefault()
    const usernameInput = safeGet("registerUsername")?.value || ""
    const email = safeGet("registerEmail")?.value || ""
    const password = safeGet("registerPassword")?.value || ""

    try {
      const data = await api("/api/register", {
        method: "POST",
        body: { username: usernameInput, email, password }
      })

      const msg = safeGet("registerMessage")
      if (msg) msg.textContent = data.message || "Registration successful!"

      safeGet("registerForm")?.reset()
      setTimeout(() => showPage("loginPage"), 1000)
    } catch (error) {
      const msg = safeGet("registerMessage")
      if (msg) msg.textContent = error.message
    }
  })

  safeOn("loginForm", "submit", async event => {
    event.preventDefault()
    const email = safeGet("loginEmail")?.value || ""
    const password = safeGet("loginPassword")?.value || ""

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: { email, password }
      })

      token = data.token
      username = data.username
      loggedInUserId = data.userId

      localStorage.setItem("token", token)

      const userHeader = safeGet("currentUsername")
      if (userHeader) userHeader.textContent = username

      connectSocket()
      showPage("chatPage")

      await loadConversations()
      await loadUsers()
    } catch (error) {
      const msg = safeGet("loginMessage")
      if (msg) msg.textContent = error.message
    }
  })

  safeOn("messageForm", "submit", event => {
    event.preventDefault()

    if (!selectedUserId) {
      alert("Select a user first")
      return
    }

    const input = safeGet("messageInput")
    const text = input ? input.value.trim() : ""
    if (!text) return

    if (socket) {
      socket.emit("privateMessage", {
        receiverId: selectedUserId,
        text,
        type: "text",
        replyTo: replyMessageId
      })

      socket.emit("typing", {
        to: selectedUserId,
        receiverId: selectedUserId,
        typing: false
      })
    }

    if (input) input.value = ""
    cancelReply()
  })

  safeOn("messageInput", "input", () => {
    if (!selectedUserId || !socket) return

    socket.emit("typing", {
      to: selectedUserId,
      receiverId: selectedUserId,
      typing: true
    })

    clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => {
      if (socket && selectedUserId) {
        socket.emit("typing", {
          to: selectedUserId,
          receiverId: selectedUserId,
          typing: false
        })
      }
    }, 700)
  })

  safeOn("fileInput", "change", async event => {
    const file = event.target.files[0]
    if (!file || !selectedUserId) return

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      const media = await response.json()
      if (!response.ok) throw new Error(media.message || "File upload failed")

      if (socket) {
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
      }

      cancelReply()
    } catch (error) {
      alert(error.message)
    }

    event.target.value = ""
  })

  safeOn("userSearch", "input", event => {
    showSidebar("users")
    loadUsers(event.target.value)
  })

  const acceptBtn = safeGet("acceptCall")
  if (acceptBtn) {
    acceptBtn.onclick = e => {
      e.preventDefault()
      acceptCall()
    }
  }

  const rejectBtn = safeGet("rejectCall")
  if (rejectBtn) {
    rejectBtn.onclick = e => {
      e.preventDefault()
      rejectCall()
    }
  }

  const incomingModal = safeGet("incomingCall")
  if (incomingModal) {
    incomingModal.onclick = e => {
      if (e.target === incomingModal) rejectCall()
    }
  }
}

async function initialize() {
  setupEventListeners()
  renderGoogleButton()

  if (!token) {
    showPage("loginPage")
    return
  }

  try {
    const data = await api("/api/me")
    username = data.user.username
    loggedInUserId = data.user._id

    const currentUsername = safeGet("currentUsername")
    if (currentUsername) currentUsername.textContent = username

    connectSocket()
    showPage("chatPage")

    await loadConversations()
    await loadUsers()
  } catch (error) {
    console.error("Session verification failed:", error)
    localStorage.removeItem("token")
    token = null
    showPage("loginPage")
  }
}

window.acceptCall = acceptCall
window.rejectCall = rejectCall
window.startVideoCall = startVideoCall
window.startAudioCall = startAudioCall
window.toggleCamera = toggleCamera
window.toggleMicrophone = toggleMicrophone
window.endCall = endCall

window.closeProfile = closeProfile
window.saveProfile = saveProfile
window.openProfile = openProfile
window.openUserProfile = openUserProfile
window.closeUserProfile = closeUserProfile
window.addContact = addContact
window.blockUser = blockUser

window.showSidebar = showSidebar
window.sendEmoji = sendEmoji
window.logout = logout
window.cancelReply = cancelReply

window.replyToMessage = replyToMessage
window.reactToMessage = reactToMessage
window.editMessage = editMessage
window.deleteMessage = deleteMessage
window.showPage = showPage
window.closeMobileChat = closeMobileChat

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize)
} else {
  initialize()
}