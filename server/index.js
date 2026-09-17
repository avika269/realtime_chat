import express from "express"
import {Server} from "socket.io"
import path from "path"
import {fileURLToPath} from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"
const app = express()

app.use(express.static(path.join(__dirname,"public")))

const expressServer = app.listen(PORT,()=>{
  console.log('Server is running on port ${PORT}')
})

const UserState={
  users:[],
  setUsers:function(newUsersArray){
    this.uers=newUsersArray
  }
}
const io = new Server(expressServer,{
  cors:{
    origin:process.env.NODE_ENV === 'production' ? false :
    ["http://localhost:5500","http://127.0.0.1:5500"]
  
  }
})


io.on('connection',socket => {

  console.log('User ${socket.id} connected')
  socket.emit('message',buildMsg(ADMIN,"Welcome to the chat app!"))

  socket.on('enterRoom',({name,room})=>{

    const prevRoom = getUser(socket.id)?.room
    if(prevRoom){
      socket.leave(prevRoom)
      io.to(prevRoom).emit('message',buildMsg(ADMIN,`${name} has to left thye room`))
    }
    const user = activateUser(socket.id,name,room)

    if(prevRoom){
      io.to(prevRoom).emit('userList',{
        users:getUsersInRoom(prevRoom)` `
      })
    }
    socket.join(user.room)

    socket.emit('message',buildMsg(ADMIN,`You have joined the  ${user.room} chat room`))

   io.to(user.room).emit('userList',{
    users:getUsersInRoom(user.room)
   })
  }
  )

  socket.broadcast.emit('message',`User ${socket.id.substring(0,5)} connected`)
  socket.on('message',data=>{
    

    console.log(data)
    io.emit('messge',`${socket.id.substring(0,5)}:${data}`)
  })

  socket.on('disconnect',()=>{
    socket.broadcast.emit('message',`user ${socket.id.substring(0,5)} disconnected`)
  })
  socket.on('activity',(name) =>{
    socket.emit('activity',socket.id.substring(0,5))
  })
  socket.on("activity",(name)=>{
    Activity.textContent =`${name} is typing....`
  })
})

function buildMsg(name,text){
  return{
    name,
    text,
    time:new Intl.DateTimeFormat('default',{
      hour:'numeric',
      minute:'numeric',
      second:'numeric'

    }).format(new Date())
  }
}

function activateUser(id,name,room){
  const uder = {id,name,room}
  UsersState.setUsers([
    ...UsersState.users.filter(user =>
      user.id != id
    ),
    user
  ])
  return user
}

function userLeavesApp(id){
  UsersState.setUsers(
    UsersState.users.filter(user => user.id != id)
  )
}

function getUser(id){
  return UserState.users.find(user => user.id === id)
}
function getUserInRoom(room){
   return UserState.users.filter(user => user.room === room)
}

function getAllActiveRooms(){
  return Array.from(new Set(UserState.users.map(user => user.room)))
}


