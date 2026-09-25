const API_BASE =
    "/api";

let token =
    localStorage.getItem(
        "token"
    );

let currentUser =
    JSON.parse(
        localStorage.getItem(
            "currentUser"
        ) || "null"
    );

let socket =
    null;


async function apiRequest(
    endpoint,
    options = {}
) {

    const headers =
        options.headers || {};

    if (
        token &&
        !headers.Authorization
    ) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers
            }
        );

    const contentType =
        response.headers.get(
            "content-type"
        );

    let data;

    if (
        contentType &&
        contentType.includes(
            "application/json"
        )
    ) {
        data =
            await response.json();
    } else {
        data =
            await response.text();
    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            "Something went wrong"
        );
    }

    return data;
}


function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        window.toastTimer
    );

    window.toastTimer =
        setTimeout(
            () => {
                toast.classList.remove(
                    "show"
                );
            },
            2500
        );
}


function logout() {

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "currentUser"
    );

    token =
        null;

    currentUser =
        null;

    window.location.reload();
}


function connectSocket() {

    if (!token) {
        return;
    }

    if (typeof io === "undefined") {
        return;
    }

    if (socket) {
        socket.disconnect();
    }

    socket =
        io(
            window.location.origin,
            {
                auth: {
                    token
                }
            }
        );

    socket.on(
        "connect",
        () => {

            console.log(
                "Socket connected"
            );
        }
    );

    socket.on(
        "disconnect",
        () => {

            console.log(
                "Socket disconnected"
            );
        }
    );

    socket.on(
        "auth:error",
        data => {

            console.error(
                data
            );
        }
    );

    socket.on(
        "presence:update",
        data => {

            if (
                typeof handlePresenceUpdate ===
                "function"
            ) {
                handlePresenceUpdate(
                    data
                );
            }
        }
    );

    socket.on(
        "message:new",
        message => {

            if (
                typeof handleIncomingMessage ===
                "function"
            ) {
                handleIncomingMessage(
                    message
                );
            }
        }
    );

    socket.on(
        "message:seen",
        data => {

            if (
                typeof handleMessageSeen ===
                "function"
            ) {
                handleMessageSeen(
                    data
                );
            }
        }
    );

    socket.on(
        "message:edited",
        data => {

            if (
                typeof handleMessageEdited ===
                "function"
            ) {
                handleMessageEdited(
                    data
                );
            }
        }
    );

    socket.on(
        "message:deleted",
        data => {

            if (
                typeof handleMessageDeleted ===
                "function"
            ) {
                handleMessageDeleted(
                    data
                );
            }
        }
    );

    socket.on(
        "typing:start",
        data => {

            if (
                typeof handleTypingStart ===
                "function"
            ) {
                handleTypingStart(
                    data
                );
            }
        }
    );

    socket.on(
        "typing:stop",
        data => {

            if (
                typeof handleTypingStop ===
                "function"
            ) {
                handleTypingStop(
                    data
                );
            }
        }
    );

    socket.on(
        "call:incoming",
        data => {

            if (
                typeof handleIncomingCall ===
                "function"
            ) {
                handleIncomingCall(
                    data
                );
            }
        }
    );

    socket.on(
        "call:accepted",
        data => {

            if (
                typeof handleCallAccepted ===
                "function"
            ) {
                handleCallAccepted(
                    data
                );
            }
        }
    );

    socket.on(
        "call:rejected",
        data => {

            if (
                typeof handleCallRejected ===
                "function"
            ) {
                handleCallRejected(
                    data
                );
            }
        }
    );

    socket.on(
        "call:ended",
        data => {

            if (
                typeof handleCallEnded ===
                "function"
            ) {
                handleCallEnded(
                    data
                );
            }
        }
    );

    socket.on(
        "webrtc:offer",
        data => {

            if (
                typeof handleWebRTCOffer ===
                "function"
            ) {
                handleWebRTCOffer(
                    data
                );
            }
        }
    );

    socket.on(
        "webrtc:answer",
        data => {

            if (
                typeof handleWebRTCAnswer ===
                "function"
            ) {
                handleWebRTCAnswer(
                    data
                );
            }
        }
    );

    socket.on(
        "webrtc:ice",
        data => {

            if (
                typeof handleWebRTCIce ===
                "function"
            ) {
                handleWebRTCIce(
                    data
                );
            }
        }
    );
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        connectSocket();

        if (
            typeof initializeSocial ===
            "function"
        ) {
            initializeSocial();
        }

        if (
            typeof initializeChat ===
            "function"
        ) {
            initializeChat();
        }

        if (
            typeof initializeCalls ===
            "function"
        ) {
            initializeCalls();
        }
    }
);