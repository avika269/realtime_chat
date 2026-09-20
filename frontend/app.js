function initGoogleAuth() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.id) {
    setTimeout(initGoogleAuth, 200)
    return
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleLoginResponse
  })

  const container = document.getElementById("googleBtn")
  if (container) {
    google.accounts.id.renderButton(container, {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      width: 280,
      text: "continue_with"
    })
  }
}

async function handleGoogleLoginResponse(response) {
  try {
    const res = await fetch(BACKEND_URL + "/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.message || "Google login failed")
      return
    }

    localStorage.setItem("token", data.token)
    token = data.token
    loggedInUserId = data.user._id
    username = data.user.username

    showAppView()
    connectSocket()
  } catch (err) {
    alert("Google authentication error")
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initGoogleAuth()
})