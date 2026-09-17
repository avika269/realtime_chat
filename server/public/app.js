const socket =io('ws://localhost:3500')

const msginput = document.quertSelector('#message')
const nameinput = document.quertSelector('#name')
const chatinput = document.quertSelector('#room')
const acivity = document.querySelector('.activity')
const userlist = document.querySelector('.user-list')
const chatDisplay = document.querySelector('.chat-display')
const roomlist = document.querySelector('.room-list')

function sendMessage(e){
  e.preventDefault()
  if(nameinput.value && msginput.value && chatinput.value){
    socket.emit('message',{
      name:nameinput.value,
      text:msginput.value
    })
    msginput.value = ""

  }
  msginput.focus()
}

function enterRoom(e){
  e.preventDefault()
  if(nameinput.value && chatinput.value){
    socket.emit('enterRoom',{
      "name":nameinput.value,
    "room":chatinput.value

    })
    
  }
}



document.querySelector('.form-msg')
     .addEventListener('submit',sendMessage)

document.querySelector('.form-join')
     .addEventListener('submit',enterRoom)

     msginput.addEventListener('keypress',()=>{
  socket.emit('activity',nameinput.value)
})
socket.addEventListener("message",(data)=>{
  const li = document.createElement('li')
  li.textContent = data
  document.querySelector('ul').appendChild(li)
})



let activityTimer
socket.on("activity",(name) =>{
  activityTimer,textContent = `${name} is typing...`

  clearTimeout(activityTimer)
  activityTimer = setTimeout(() =>{
    activityTimer.textContent = ""
  },3000)

})