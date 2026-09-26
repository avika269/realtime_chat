const API_BASE = ""

let token = localStorage.getItem("token")

let currentUser = JSON.parse(
    localStorage.getItem("currentUser") || "null"
)

let socket = null

let googleInitialized = false


async function apiRequest(endpoint, options = {}) {

    const headers = {
        ...(options.headers || {})
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers["Content-Type"]
    ) {
        headers["Content-Type"] = "application/json"
    }

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    )

    const contentType =
        response.headers.get("content-type")

    let data

    if (
        contentType &&
        contentType.includes("application/json")
    ) {
        data = await response.json()
    } else {
        data = await response.text()
    }

    if (!response.ok) {

        throw new Error(
            data?.message ||
            "Something went wrong"
        )
    }

    return data
}


function showMessage(message) {

    const element =
        document.getElementById("authMessage")

    if (!element) return

    element.textContent = message

    clearTimeout(
        window.authMessageTimer
    )

    window.authMessageTimer =
        setTimeout(() => {
            element.textContent = ""
        }, 4000)
}


function validateCollegeEmail(email) {

    return email
        .trim()
        .toLowerCase()
        .endsWith("@akgec.ac.in")
}


function showLogin() {

    const loginForm =
        document.getElementById("loginForm")

    const registerForm =
        document.getElementById("registerForm")

    const loginTab =
        document.getElementById("loginTab")

    const registerTab =
        document.getElementById("registerTab")

    loginForm.classList.remove("hidden")
    registerForm.classList.add("hidden")

    loginTab.classList.add("active")
    registerTab.classList.remove("active")

    showMessage("")
}


function showRegister() {

    const loginForm =
        document.getElementById("loginForm")

    const registerForm =
        document.getElementById("registerForm")

    const loginTab =
        document.getElementById("loginTab")

    const registerTab =
        document.getElementById("registerTab")

    loginForm.classList.add("hidden")
    registerForm.classList.remove("hidden")

    loginTab.classList.remove("active")
    registerTab.classList.add("active")

    showMessage("")
}


function setupAuthTabs() {

    const loginTab =
        document.getElementById("loginTab")

    const registerTab =
        document.getElementById("registerTab")

    if (loginTab) {
        loginTab.addEventListener(
            "click",
            showLogin
        )
    }

    if (registerTab) {
        registerTab.addEventListener(
            "click",
            showRegister
        )
    }
}


async function handleLogin(event) {

    event.preventDefault()

    const email =
        document.getElementById(
            "loginEmail"
        ).value.trim().toLowerCase()

    const password =
        document.getElementById(
            "loginPassword"
        ).value

    if (!email || !password) {

        showMessage(
            "Please enter email and password."
        )

        return
    }

    if (!validateCollegeEmail(email)) {

        showMessage(
            "Only @akgec.ac.in email addresses are allowed."
        )

        return
    }

    try {

        showMessage("Logging in...")

        const data =
            await apiRequest(
                "/auth/login",
                {
                    method: "POST",

                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            )

        completeLogin(data)

    } catch (error) {

        console.error(
            "Login error:",
            error
        )

        showMessage(
            error.message
        )
    }
}


async function handleRegister(event) {

    event.preventDefault()

    const name =
        document.getElementById(
            "registerName"
        ).value.trim()

    const email =
        document.getElementById(
            "registerEmail"
        ).value.trim().toLowerCase()

    const college =
        document.getElementById(
            "registerCollege"
        ).value.trim()

    const password =
        document.getElementById(
            "registerPassword"
        ).value

    if (!name || !email || !password) {

        showMessage(
            "Please fill all required fields."
        )

        return
    }

    if (!validateCollegeEmail(email)) {

        showMessage(
            "Use your @akgec.ac.in college email."
        )

        return
    }

    if (password.length < 6) {

        showMessage(
            "Password must contain at least 6 characters."
        )

        return
    }

    try {

        showMessage("Creating account...")

        const data =
            await apiRequest(
                "/auth/register",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        college
                    })
                }
            )

        if (data.token) {

            completeLogin(data)

            return
        }

        showMessage(
            "Registration successful. Please login."
        )

        document.getElementById(
            "loginEmail"
        ).value = email

        showLogin()

    } catch (error) {

        console.error(
            "Registration error:",
            error
        )

        showMessage(
            error.message
        )
    }
}


function completeLogin(data) {

    if (!data || !data.token) {

        throw new Error(
            "Authentication succeeded but no token was returned."
        )
    }

    token = data.token

    currentUser =
        data.user || null

    localStorage.setItem(
        "token",
        token
    )

    localStorage.setItem(
        "currentUser",
        JSON.stringify(currentUser)
    )

    showMessage(
        "Login successful."
    )

    setTimeout(() => {

        showCorrectPage()

        connectSocket()

        if (
            typeof initializeSocial ===
            "function"
        ) {
            initializeSocial()
        }

        if (
            typeof initializeChat ===
            "function"
        ) {
            initializeChat()
        }

        if (
            typeof initializeCalls ===
            "function"
        ) {
            initializeCalls()
        }

    }, 300)
}


async function initializeGoogleLogin() {

    const container =
        document.getElementById(
            "googleSignIn"
        )

    if (!container) return

    try {

        const response =
            await fetch(
                "/auth/config"
            )

        const config =
            await response.json()

        if (!config.googleClientId) {

            console.error(
                "GOOGLE_CLIENT_ID is missing."
            )

            return
        }

        const waitForGoogle =
            setInterval(() => {

                if (
                    window.google &&
                    window.google.accounts &&
                    window.google.accounts.id
                ) {

                    clearInterval(
                        waitForGoogle
                    )

                    if (
                        googleInitialized
                    ) {
                        return
                    }

                    google.accounts.id.initialize({

                        client_id:
                            config.googleClientId,

                        callback:
                            handleGoogleLogin

                    })

                    googleInitialized = true

                    container.innerHTML = ""

                    google.accounts.id.renderButton(
                        container,
                        {
                            theme: "outline",
                            size: "large",
                            text: "continue_with",
                            shape: "rectangular",
                            width: 320
                        }
                    )

                }

            }, 100)

        setTimeout(() => {

            clearInterval(
                waitForGoogle
            )

        }, 10000)

    } catch (error) {

        console.error(
            "Google initialization error:",
            error
        )
    }
}


async function handleGoogleLogin(response) {

    try {

        if (
            !response ||
            !response.credential
        ) {

            showMessage(
                "Google authentication failed."
            )

            return
        }

        showMessage(
            "Signing in with Google..."
        )

        const data =
            await apiRequest(
                "/auth/google",
                {
                    method: "POST",

                    body: JSON.stringify({
                        credential:
                            response.credential
                    })
                }
            )

        completeLogin(data)

    } catch (error) {

        console.error(
            "Google login error:",
            error
        )

        showMessage(
            error.message
        )
    }
}


function connectSocket() {

    if (!token) return

    if (
        typeof io ===
        "undefined"
    ) {

        console.error(
            "Socket.IO is not loaded."
        )

        return
    }

    if (socket) {

        socket.disconnect()

    }

    socket =
        io(
            window.location.origin,
            {
                auth: {
                    token
                }
            }
        )

    socket.on(
        "connect",
        () => {
            console.log(
                "Socket connected"
            )
        }
    )

    socket.on(
        "disconnect",
        () => {
            console.log(
                "Socket disconnected"
            )
        }
    )

    socket.on(
        "connect_error",
        error => {
            console.error(
                "Socket connection error:",
                error.message
            )
        }
    )

    socket.on(
        "presence:update",
        data => {

            if (
                typeof handlePresenceUpdate ===
                "function"
            ) {
                handlePresenceUpdate(
                    data
                )
            }

        }
    )

    socket.on(
        "message:new",
        message => {

            if (
                typeof handleIncomingMessage ===
                "function"
            ) {
                handleIncomingMessage(
                    message
                )
            }

        }
    )

    socket.on(
        "message:seen",
        data => {

            if (
                typeof handleMessageSeen ===
                "function"
            ) {
                handleMessageSeen(
                    data
                )
            }

        }
    )

    socket.on(
        "message:edited",
        data => {

            if (
                typeof handleMessageEdited ===
                "function"
            ) {
                handleMessageEdited(
                    data
                )
            }

        }
    )

    socket.on(
        "message:deleted",
        data => {

            if (
                typeof handleMessageDeleted ===
                "function"
            ) {
                handleMessageDeleted(
                    data
                )
            }

        }
    )

    socket.on(
        "typing:start",
        data => {

            if (
                typeof handleTypingStart ===
                "function"
            ) {
                handleTypingStart(
                    data
                )
            }

        }
    )

    socket.on(
        "typing:stop",
        data => {

            if (
                typeof handleTypingStop ===
                "function"
            ) {
                handleTypingStop(
                    data
                )
            }

        }
    )

    socket.on(
        "call:incoming",
        data => {

            if (
                typeof handleIncomingCall ===
                "function"
            ) {
                handleIncomingCall(
                    data
                )
            }

        }
    )

    socket.on(
        "call:accepted",
        data => {

            if (
                typeof handleCallAccepted ===
                "function"
            ) {
                handleCallAccepted(
                    data
                )
            }

        }
    )

    socket.on(
        "call:rejected",
        data => {

            if (
                typeof handleCallRejected ===
                "function"
            ) {
                handleCallRejected(
                    data
                )
            }

        }
    )

    socket.on(
        "call:ended",
        data => {

            if (
                typeof handleCallEnded ===
                "function"
            ) {
                handleCallEnded(
                    data
                )
            }

        }
    )

    socket.on(
        "webrtc:offer",
        data => {

            if (
                typeof handleWebRTCOffer ===
                "function"
            ) {
                handleWebRTCOffer(
                    data
                )
            }

        }
    )

    socket.on(
        "webrtc:answer",
        data => {

            if (
                typeof handleWebRTCAnswer ===
                "function"
            ) {
                handleWebRTCAnswer(
                    data
                )
            }

        }
    )

    socket.on(
        "webrtc:ice",
        data => {

            if (
                typeof handleWebRTCIce ===
                "function"
            ) {
                handleWebRTCIce(
                    data
                )
            }

        }
    )
}


async function logout() {

    try {

        if (token) {

            await fetch(
                "/auth/logout",
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            )

        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        )
    }

    if (socket) {

        socket.disconnect()

        socket = null

    }

    localStorage.removeItem(
        "token"
    )

    localStorage.removeItem(
        "currentUser"
    )

    token = null

    currentUser = null

    showCorrectPage()
}


function showCorrectPage() {

    const authPage =
        document.getElementById(
            "authPage"
        )

    const mainApp =
        document.getElementById(
            "mainApp"
        )

    if (!authPage || !mainApp) {
        return
    }

    if (token && currentUser) {

        authPage.classList.add(
            "hidden"
        )

        mainApp.classList.remove(
            "hidden"
        )

    } else {

        authPage.classList.remove(
            "hidden"
        )

        mainApp.classList.add(
            "hidden"
        )

    }
}


function setupNavigation() {

    const buttons =
        document.querySelectorAll(
            ".nav-item"
        )

    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const page =
                    button.dataset.page

                document
                    .querySelectorAll(
                        ".nav-item"
                    )
                    .forEach(item => {
                        item.classList.remove(
                            "active"
                        )
                    })

                button.classList.add(
                    "active"
                )

                document
                    .querySelectorAll(
                        ".page"
                    )
                    .forEach(section => {
                        section.classList.remove(
                            "active-page"
                        )
                    })

                const target =
                    document.getElementById(
                        `${page}Page`
                    )

                if (target) {
                    target.classList.add(
                        "active-page"
                    )
                }

            }
        )

    })
}


document.addEventListener(
    "DOMContentLoaded",
    () => {

        showCorrectPage()

        setupAuthTabs()

        setupNavigation()

        const loginForm =
            document.getElementById(
                "loginForm"
            )

        const registerForm =
            document.getElementById(
                "registerForm"
            )

        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                handleLogin
            )

        }

        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                handleRegister
            )

        }

        const logoutButton =
            document.getElementById(
                "logoutButton"
            )

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            )

        }

        initializeGoogleLogin()

        if (token && currentUser) {

            connectSocket()

            if (
                typeof initializeSocial ===
                "function"
            ) {
                initializeSocial()
            }

            if (
                typeof initializeChat ===
                "function"
            ) {
                initializeChat()
            }

            if (
                typeof initializeCalls ===
                "function"
            ) {
                initializeCalls()
            }

        }

    }
)