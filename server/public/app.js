const socket = io()

const login = document.getElementById("login")
const chat = document.getElementById("chat")

const nameInput = document.getElementById("name")
const roomInput = document.getElementById("room")

const joinBtn = document.getElementById("joinBtn")

const roomTitle = document.getElementById("roomTitle")

const messages = document.getElementById("messages")

const messageForm = document.getElementById("messageForm")
const messageInput = document.getElementById("messageInput")

const activity = document.getElementById("activity")

const userList = document.getElementById("userList")

let username = ""
let room = ""

joinBtn.addEventListener("click", () => {

  username = nameInput.value.trim()
  room = roomInput.value.trim()

  if (!username || !room) {
    return
  }

  login.classList.add("hidden")
  chat.classList.remove("hidden")

  roomTitle.textContent = room

  socket.emit("enterRoom", {
    name: username,
    room: room
  })
})

messageForm.addEventListener("submit", (event) => {

  event.preventDefault()

  const text = messageInput.value.trim()

  if (!text) {
    return
  }

  socket.emit("message", {
    name: username,
    text: text
  })

  messageInput.value = ""
})

messageInput.addEventListener("input", () => {

  socket.emit("activity", username)
})

socket.on("message", (data) => {

  displayMessage(
    data.name,
    data.text,
    data.time
  )
})

socket.on("messageHistory", (data) => {

  messages.innerHTML = ""

  data.forEach((message) => {

    const time = new Date(
      message.createdAt
    ).toLocaleTimeString()

    displayMessage(
      message.name,
      message.text,
      time
    )
  })
})

socket.on("activity", (name) => {

  activity.textContent =
    `${name} is typing...`

  setTimeout(() => {
    activity.textContent = ""
  }, 1500)
})

socket.on("userList", ({ users }) => {

  userList.innerHTML = ""

  users.forEach((user) => {

    const li = document.createElement("li")

    li.textContent = user.name

    userList.appendChild(li)
  })
})

socket.on("roomsList", ({ rooms }) => {

  console.log("Active rooms:", rooms)
})

function displayMessage(name, text, time) {

  const div = document.createElement("div")

  div.classList.add("message")

  div.innerHTML = `
    <strong>${name}</strong>
    <span>${text}</span>
    <small>${time}</small>
  `

  messages.appendChild(div)

  messages.scrollTop =
    messages.scrollHeight
}