let peerConnection = null;

let localStream = null;

let currentCall = null;

let pendingIceCandidates = [];

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

async function startCall(type) {
    if (!chatState.currentChat) {
        alert("Open a chat first");
        return;
    }

    const user = chatState.currentChat.user;

    currentCall = {
        callId: crypto.randomUUID(),
        userId: user._id,
        userName: user.name,
        type,
        incoming: false
    };

    try {
        await setupLocalMedia(type);

        createPeerConnection();

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        socket.emit("call:offer", {
            callId: currentCall.callId,
            toUserId: currentCall.userId,
            fromName: currentUser.name,
            type,
            offer
        });

        showCallScreen(
            type,
            user.name
        );
    } catch (error) {
        console.error("Call error:", error);

        cleanupCall();

        alert("Could not start the call.");
    }
}

async function setupLocalMedia(type) {
    localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video"
    });

    const localVideo = document.getElementById("localVideo");

    if (localVideo) {
        localVideo.srcObject = localStream;

        localVideo.muted = true;

        localVideo.play().catch(() => {});
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(
                track,
                localStream
            );
        });
    }

    peerConnection.onicecandidate = event => {
        if (!event.candidate) return;

        if (!currentCall) return;

        socket.emit("call:ice", {
            callId: currentCall.callId,
            toUserId: currentCall.userId,
            candidate: event.candidate
        });
    };

    peerConnection.ontrack = event => {
        const remoteVideo =
            document.getElementById("remoteVideo");

        if (!remoteVideo) return;

        remoteVideo.srcObject = event.streams[0];

        remoteVideo.play().catch(() => {});
    };

    peerConnection.onconnectionstatechange = () => {
        if (!peerConnection) return;

        if (
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "disconnected" ||
            peerConnection.connectionState === "closed"
        ) {
            cleanupCall();
        }
    };
}

function handleIncomingCall(data) {
    if (currentCall) {
        socket.emit("call:reject", {
            callId: data.callId,
            toUserId: data.fromUserId,
            reason: "busy"
        });

        return;
    }

    currentCall = {
        callId: data.callId,
        userId: data.fromUserId,
        userName: data.fromName,
        type: data.type,
        offer: data.offer,
        incoming: true
    };

    const callerName =
        document.getElementById("incomingCallerName");

    const callerType =
        document.getElementById("incomingCallType");

    if (callerName) {
        callerName.textContent = data.fromName;
    }

    if (callerType) {
        callerType.textContent =
            data.type === "video"
                ? "Incoming video call"
                : "Incoming audio call";
    }

    const modal =
        document.getElementById("incomingCallModal");

    if (modal) {
        modal.classList.add("show");
    }
}

async function acceptIncomingCall() {
    if (!currentCall) return;

    const call = currentCall;

    try {
        closeIncomingCallModal();

        await setupLocalMedia(call.type);

        createPeerConnection();

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(call.offer)
        );

        await addPendingIceCandidates();

        const answer =
            await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(answer);

        socket.emit("call:answer", {
            callId: call.callId,
            toUserId: call.userId,
            answer
        });

        showCallScreen(
            call.type,
            call.userName
        );
    } catch (error) {
        console.error(
            "Accept call error:",
            error
        );

        rejectCurrentCall();
    }
}

function rejectCurrentCall() {
    if (!currentCall) return;

    socket.emit("call:reject", {
        callId: currentCall.callId,
        toUserId: currentCall.userId,
        reason: "rejected"
    });

    closeIncomingCallModal();

    cleanupCall();
}

async function handleCallAnswer(data) {
    if (!peerConnection) return;

    if (!currentCall) return;

    if (data.callId !== currentCall.callId) {
        return;
    }

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
    );

    await addPendingIceCandidates();
}

async function handleIceCandidate(data) {
    if (!data.candidate) return;

    if (!peerConnection) {
        pendingIceCandidates.push(data.candidate);

        return;
    }

    if (!peerConnection.remoteDescription) {
        pendingIceCandidates.push(data.candidate);

        return;
    }

    try {
        await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
        );
    } catch (error) {
        console.error(
            "ICE candidate error:",
            error
        );
    }
}

async function addPendingIceCandidates() {
    if (!peerConnection) return;

    if (!peerConnection.remoteDescription) {
        return;
    }

    for (const candidate of pendingIceCandidates) {
        try {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.error(error);
        }
    }

    pendingIceCandidates = [];
}

function endCall() {
    if (currentCall && socket) {
        socket.emit("call:end", {
            callId: currentCall.callId,
            toUserId: currentCall.userId
        });
    }

    cleanupCall();
}

function handleCallEnded() {
    cleanupCall();
}

function handleCallRejected(data) {
    cleanupCall();

    alert(
        data.reason === "busy"
            ? "The user is already on another call."
            : "Call rejected."
    );
}

function showCallScreen(type, name) {
    const modal =
        document.getElementById("callModal");

    const nameElement =
        document.getElementById("callUserName");

    if (nameElement) {
        nameElement.textContent = name;
    }

    if (modal) {
        modal.classList.add("show");
    }

    const localVideo =
        document.getElementById("localVideo");

    const remoteVideo =
        document.getElementById("remoteVideo");

    if (type === "audio") {
        if (localVideo) {
            localVideo.style.display = "none";
        }

        if (remoteVideo) {
            remoteVideo.style.display = "none";
        }
    } else {
        if (localVideo) {
            localVideo.style.display = "block";
        }

        if (remoteVideo) {
            remoteVideo.style.display = "block";
        }
    }
}

function closeIncomingCallModal() {
    const modal =
        document.getElementById("incomingCallModal");

    if (modal) {
        modal.classList.remove("show");
    }
}

function cleanupCall() {
    if (peerConnection) {
        peerConnection.close();

        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });

        localStream = null;
    }

    const localVideo =
        document.getElementById("localVideo");

    const remoteVideo =
        document.getElementById("remoteVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    const callModal =
        document.getElementById("callModal");

    if (callModal) {
        callModal.classList.remove("show");
    }

    closeIncomingCallModal();

    pendingIceCandidates = [];

    currentCall = null;
}

function toggleMute() {
    if (!localStream) return;

    const audioTracks =
        localStream.getAudioTracks();

    if (!audioTracks.length) return;

    audioTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    const button =
        document.getElementById("muteButton");

    if (!button) return;

    const muted = !audioTracks[0].enabled;

    button.innerHTML = muted
        ? '<i class="fa-solid fa-microphone-slash"></i>'
        : '<i class="fa-solid fa-microphone"></i>';
}

function toggleCamera() {
    if (!localStream) return;

    const videoTracks =
        localStream.getVideoTracks();

    if (!videoTracks.length) return;

    videoTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    const button =
        document.getElementById("cameraButton");

    if (!button) return;

    const off = !videoTracks[0].enabled;

    button.innerHTML = off
        ? '<i class="fa-solid fa-video-slash"></i>'
        : '<i class="fa-solid fa-video"></i>';
}

function setupCallEvents() {
    const audioButton =
        document.getElementById("audioCallButton");

    const videoButton =
        document.getElementById("videoCallButton");

    const acceptButton =
        document.getElementById("acceptCallButton");

    const rejectButton =
        document.getElementById("rejectCallButton");

    const endButton =
        document.getElementById("endCallButton");

    const muteButton =
        document.getElementById("muteButton");

    const cameraButton =
        document.getElementById("cameraButton");

    if (audioButton) {
        audioButton.addEventListener(
            "click",
            () => startCall("audio")
        );
    }

    if (videoButton) {
        videoButton.addEventListener(
            "click",
            () => startCall("video")
        );
    }

    if (acceptButton) {
        acceptButton.addEventListener(
            "click",
            acceptIncomingCall
        );
    }

    if (rejectButton) {
        rejectButton.addEventListener(
            "click",
            rejectCurrentCall
        );
    }

    if (endButton) {
        endButton.addEventListener(
            "click",
            endCall
        );
    }

    if (muteButton) {
        muteButton.addEventListener(
            "click",
            toggleMute
        );
    }

    if (cameraButton) {
        cameraButton.addEventListener(
            "click",
            toggleCamera
        );
    }
}

window.startCall = startCall;
window.acceptIncomingCall = acceptIncomingCall;
window.rejectCurrentCall = rejectCurrentCall;
window.endCall = endCall;
window.setupCallEvents = setupCallEvents;
window.handleIncomingCall = handleIncomingCall;
window.handleCallAnswer = handleCallAnswer;
window.handleIceCandidate = handleIceCandidate;
window.handleCallEnded = handleCallEnded;
window.handleCallRejected = handleCallRejected;