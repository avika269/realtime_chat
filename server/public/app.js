const socket = io()

let username = ""
let currentUserId = ""

let localStream = null
let peerConnection = null

let incomingOffer = null
let callerId = null

let cameraEnabled = true
let microphoneEnabled = true

const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
}


/* =========================
   PAGE NAVIGATION
========================= */

function showPage(pageId) {

    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.hidden = true
        })

    document.getElementById(pageId).hidden = false
}


/* =========================
   REGISTER
========================= */

const registerForm = document.getElementById("registerForm")

if (registerForm) {

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault()

        const usernameInput =
            document.getElementById("registerUsername").value.trim()

        const email =
            document.getElementById("registerEmail").value.trim()

        const password =
            document.getElementById("registerPassword").value


        if (!usernameInput || !email || !password) {

            alert("Please fill all fields")

            return
        }


        try {

            const response = await fetch("/api/register", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username: usernameInput,
                    email: email,
                    password: password
                })

            })


            const data = await response.json()


            if (!response.ok) {

                alert(data.message || "Registration failed")

                return
            }


            alert("Registration successful")

            registerForm.reset()

            showPage("loginPage")


        } catch (error) {

            console.error(error)

            alert("Server error during registration")

        }

    })

}


/* =========================
   LOGIN
========================= */

const loginForm = document.getElementById("loginForm")

if (loginForm) {

    loginForm.addEventListener("submit", async function(event) {

        event.preventDefault()


        const email =
            document.getElementById("loginEmail").value.trim()

        const password =
            document.getElementById("loginPassword").value


        if (!email || !password) {

            alert("Please enter email and password")

            return
        }


        try {

            const response = await fetch("/api/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })

            })


            const data = await response.json()


            if (!response.ok) {

                alert(data.message || "Login failed")

                return
            }


            localStorage.setItem(
                "token",
                data.token
            )


            username = data.username

            currentUserId = data.userId


            document.getElementById(
                "currentUsername"
            ).textContent = username


            socket.emit("userLogin", {

                username: username

            })


            loginForm.reset()

            showPage("chatPage")


        } catch (error) {

            console.error(error)

            alert("Server error during login")

        }

    })

}


/* =========================
   LOGOUT
========================= */

function logout() {

    socket.emit("userLogout")

    localStorage.removeItem("token")

    username = ""

    currentUserId = ""

    closeCall()

    showPage("loginPage")
}


/* =========================
   CHAT
========================= */

const messageForm =
    document.getElementById("messageForm")


if (messageForm) {

    messageForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault()


            const messageInput =
                document.getElementById("messageInput")


            const message =
                messageInput.value.trim()


            if (!message) {

                return
            }


            socket.emit("chatMessage", {

                username: username,

                message: message

            })


            messageInput.value = ""

            messageInput.focus()

        }
    )

}


/* =========================
   RECEIVE MESSAGE
========================= */

socket.on("message", function(data) {

    displayMessage(
        data.username,
        data.message
    )

})


/* =========================
   DISPLAY MESSAGE
========================= */

function displayMessage(sender, message) {

    const messages =
        document.getElementById("messages")


    if (!messages) {

        return
    }


    const messageElement =
        document.createElement("p")


    messageElement.textContent =
        sender + ": " + message


    messages.appendChild(messageElement)


    messages.scrollTop =
        messages.scrollHeight

}


/* =========================
   ONLINE USERS
========================= */

socket.on("users", function(users) {

    const usersList =
        document.getElementById("usersList")


    if (!usersList) {

        return
    }


    usersList.innerHTML = ""


    users.forEach(function(user) {

        const userElement =
            document.createElement("p")


        userElement.textContent =
            user.username


        userElement.dataset.userId =
            user.id


        userElement.style.cursor =
            "pointer"


        userElement.addEventListener(
            "click",
            function() {

                currentUserId =
                    user.id

                alert(
                    "Selected " +
                    user.username +
                    " for video call"
                )

            }
        )


        usersList.appendChild(
            userElement
        )

    })

})


/* =========================
   OPEN VIDEO CALL PAGE
========================= */

async function openCallPage() {

    showPage("callPage")

    await startCamera()

}


/* =========================
   CLOSE VIDEO CALL PAGE
========================= */

function closeCallPage() {

    closeCall()

    showPage("chatPage")

}


/* =========================
   START CAMERA
========================= */

async function startCamera() {

    if (localStream) {

        return
    }


    try {

        localStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: true,

                    audio: true

                })


        const localVideo =
            document.getElementById(
                "localVideo"
            )


        localVideo.srcObject =
            localStream


        document.getElementById(
            "callStatus"
        ).textContent =
            "Camera and microphone ready"


    } catch (error) {

        console.error(error)

        alert(
            "Please allow camera and microphone access"
        )

    }

}


/* =========================
   CREATE PEER CONNECTION
========================= */

function createPeerConnection() {

    peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        )


    if (localStream) {

        localStream
            .getTracks()
            .forEach(function(track) {

                peerConnection.addTrack(
                    track,
                    localStream
                )

            })

    }


    /* REMOTE VIDEO */

    peerConnection.ontrack =
        function(event) {

            const remoteVideo =
                document.getElementById(
                    "remoteVideo"
                )


            remoteVideo.srcObject =
                event.streams[0]

        }


    /* ICE CANDIDATE */

    peerConnection.onicecandidate =
        function(event) {

            if (!event.candidate) {

                return
            }


            socket.emit(
                "iceCandidate",
                {

                    candidate:
                        event.candidate,

                    to:
                        currentUserId

                }
            )

        }


    /* CONNECTION STATE */

    peerConnection.onconnectionstatechange =
        function() {

            if (!peerConnection) {

                return
            }


            const status =
                document.getElementById(
                    "callStatus"
                )


            status.textContent =
                peerConnection.connectionState

        }

}


/* =========================
   START CALL
========================= */

async function startCall() {

    if (!currentUserId) {

        alert(
            "Select an online user first"
        )

        return
    }


    if (!localStream) {

        await startCamera()

    }


    if (!localStream) {

        return
    }


    createPeerConnection()


    const offer =
        await peerConnection.createOffer()


    await peerConnection.setLocalDescription(
        offer
    )


    socket.emit("callUser", {

        to: currentUserId,

        from: socket.id,

        username: username,

        offer: offer

    })


    document.getElementById(
        "callStatus"
    ).textContent =
        "Calling..."

}


/* =========================
   INCOMING CALL
========================= */

socket.on(
    "incomingCall",
    function(data) {

        incomingOffer =
            data.offer

        callerId =
            data.from


        document.getElementById(
            "callerName"
        ).textContent =
            data.username +
            " is calling you"


        document.getElementById(
            "incomingCall"
        ).hidden = false

    }
)


/* =========================
   ACCEPT CALL
========================= */

async function acceptCall() {

    document.getElementById(
        "incomingCall"
    ).hidden = true


    showPage("callPage")


    await startCamera()


    if (!localStream) {

        return
    }


    currentUserId =
        callerId


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

        answer: answer

    })


    document.getElementById(
        "callStatus"
    ).textContent =
        "Connecting..."

}


/* =========================
   RECEIVE CALL ANSWER
========================= */

socket.on(
    "callAccepted",
    async function(data) {

        if (!peerConnection) {

            return
        }


        await peerConnection.setRemoteDescription(

            new RTCSessionDescription(
                data.answer
            )

        )


        document.getElementById(
            "callStatus"
        ).textContent =
            "Connected"

    }
)


/* =========================
   RECEIVE ICE CANDIDATE
========================= */

socket.on(
    "iceCandidate",
    async function(data) {

        if (!peerConnection) {

            return
        }


        try {

            await peerConnection.addIceCandidate(

                new RTCIceCandidate(
                    data.candidate
                )

            )

        } catch (error) {

            console.error(
                "ICE candidate error:",
                error
            )

        }

    }
)


/* =========================
   REJECT CALL
========================= */

function rejectCall() {

    document.getElementById(
        "incomingCall"
    ).hidden = true


    socket.emit("callRejected", {

        to: callerId

    })


    incomingOffer = null

    callerId = null

}


/* =========================
   CALL REJECTED
========================= */

socket.on(
    "callRejected",
    function() {

        document.getElementById(
            "callStatus"
        ).textContent =
            "Call rejected"

    }
)


/* =========================
   TOGGLE CAMERA
========================= */

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


    document.getElementById(
        "callStatus"
    ).textContent =
        cameraEnabled
        ? "Camera on"
        : "Camera off"

}


/* =========================
   TOGGLE MICROPHONE
========================= */

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


    document.getElementById(
        "callStatus"
    ).textContent =
        microphoneEnabled
        ? "Microphone on"
        : "Microphone off"

}


/* =========================
   END CALL
========================= */

function endCall() {

    socket.emit("endCall", {

        to: currentUserId

    })


    closeCall()

    showPage("chatPage")

}


/* =========================
   CLOSE CALL
========================= */

function closeCall() {

    if (peerConnection) {

        peerConnection.close()

        peerConnection = null

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(function(track) {

                track.stop()

            })


        localStream = null

    }


    const localVideo =
        document.getElementById(
            "localVideo"
        )


    const remoteVideo =
        document.getElementById(
            "remoteVideo"
        )


    if (localVideo) {

        localVideo.srcObject = null

    }


    if (remoteVideo) {

        remoteVideo.srcObject = null

    }


    const status =
        document.getElementById(
            "callStatus"
        )


    if (status) {

        status.textContent =
            "Ready"

    }

}


/* =========================
   OTHER USER ENDED CALL
========================= */

socket.on(
    "endCall",
    function() {

        closeCall()

        showPage("chatPage")

    }
)