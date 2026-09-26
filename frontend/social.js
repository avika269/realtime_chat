const SOCIAL_API = ""

let selectedImageFile = null
let selectedPostImageUrl = ""
let selectedCommentPostId = null
let showingFollowingOnly = false


/* =========================================================
   API
   ========================================================= */

async function socialRequest(endpoint, options = {}) {

    const token = localStorage.getItem("token")

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
        `${SOCIAL_API}${endpoint}`,
        {
            ...options,
            headers
        }
    )

    const contentType = response.headers.get("content-type") || ""

    let data

    if (contentType.includes("application/json")) {
        data = await response.json()
    } else {
        data = await response.text()
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            "Request failed"
        )
    }

    return data
}


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeSocial() {

    setupImageSelection()
    setupCreatePost()
    setupUserSearch()
    setupComments()
    setupNotifications()
    setupFollowingTab()

    loadSocialFeed()
    loadMyFollowStats()
    loadNotifications()
}


/* =========================================================
   IMAGE SELECTION
   ========================================================= */

function setupImageSelection() {

    const input = document.getElementById("postImage")

    if (!input) return

    input.addEventListener(
        "change",
        event => {

            const file = event.target.files[0]

            if (!file) return

            if (!file.type.startsWith("image/")) {

                alert("Please select an image.")

                input.value = ""

                return
            }

            selectedImageFile = file

            const previewContainer =
                document.getElementById("selectedPostImage")

            if (!previewContainer) return

            const reader = new FileReader()

            reader.onload = function(e) {

                previewContainer.innerHTML = `

                    <div class="post-image-preview">

                        <img
                            src="${e.target.result}"
                            alt="Selected image"
                        >

                        <button
                            type="button"
                            class="remove-selected-image"
                            id="removeSelectedImage"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>

                    </div>

                `

                const removeButton =
                    document.getElementById(
                        "removeSelectedImage"
                    )

                if (removeButton) {

                    removeButton.addEventListener(
                        "click",
                        removeSelectedImage
                    )

                }

            }

            reader.readAsDataURL(file)

        }
    )
}


function removeSelectedImage() {

    selectedImageFile = null
    selectedPostImageUrl = ""

    const input =
        document.getElementById("postImage")

    const preview =
        document.getElementById("selectedPostImage")

    if (input) {
        input.value = ""
    }

    if (preview) {
        preview.innerHTML = ""
    }
}


/* =========================================================
   UPLOAD IMAGE
   ========================================================= */

async function uploadPostImage() {

    if (!selectedImageFile) {
        return ""
    }

    const formData = new FormData()

    formData.append(
        "file",
        selectedImageFile
    )

    const data = await socialRequest(
        "/media/upload",
        {
            method: "POST",
            body: formData
        }
    )

    if (!data.url) {

        throw new Error(
            "Image uploaded but no image URL was returned."
        )

    }

    return data.url
}


/* =========================================================
   CREATE POST
   ========================================================= */

function setupCreatePost() {

    const button =
        document.getElementById(
            "createPostButton"
        )

    if (!button) return

    button.addEventListener(
        "click",
        createNewPost
    )
}


async function createNewPost() {

    const contentInput =
        document.getElementById(
            "postContent"
        )

    const button =
        document.getElementById(
            "createPostButton"
        )

    const content =
        contentInput?.value.trim() || ""

    if (!content && !selectedImageFile) {

        alert(
            "Write something or select an image."
        )

        return
    }

    try {

        button.disabled = true

        button.innerHTML =
            `<i class="fa-solid fa-spinner fa-spin"></i> Posting`

        /*
         * STEP 1
         * Upload image first.
         */

        let imageUrl = ""

        if (selectedImageFile) {

            imageUrl =
                await uploadPostImage()

        }


        /*
         * STEP 2
         * Create post using uploaded image URL.
         */

        await socialRequest(
            "/posts",
            {
                method: "POST",
                body: JSON.stringify({
                    content,
                    image: imageUrl
                })
            }
        )


        /*
         * STEP 3
         * Clear composer.
         */

        contentInput.value = ""

        removeSelectedImage()


        /*
         * STEP 4
         * Reload feed.
         */

        await loadSocialFeed()

    } catch (error) {

        console.error(
            "Create post error:",
            error
        )

        alert(error.message)

    } finally {

        button.disabled = false

        button.innerHTML =
            "Post"

    }
}


/* =========================================================
   LOAD FEED
   ========================================================= */

async function loadSocialFeed() {

    const feed =
        document.getElementById("feed")

    if (!feed) return

    feed.innerHTML =
        `<div class="feed-loading">
            Loading posts...
        </div>`

    try {

        let posts =
            await socialRequest(
                "/posts"
            )

        if (!Array.isArray(posts)) {
            posts = []
        }

        if (showingFollowingOnly) {

            posts =
                await filterFollowingPosts(
                    posts
                )

        }

        renderFeed(posts)

    } catch (error) {

        console.error(
            "Load feed error:",
            error
        )

        feed.innerHTML =
            `<div class="feed-empty">
                Unable to load posts.
            </div>`
    }
}


/* =========================================================
   RENDER FEED
   ========================================================= */

function renderFeed(posts) {

    const feed =
        document.getElementById("feed")

    if (!feed) return

    if (!posts.length) {

        feed.innerHTML =
            `<div class="feed-empty">
                No posts yet.
            </div>`

        return
    }

    feed.innerHTML =
        posts.map(
            renderPost
        ).join("")

}


/* =========================================================
   RENDER POST
   ========================================================= */

function renderPost(post) {

    const user =
        post.user || {}

    const currentUser =
        JSON.parse(
            localStorage.getItem(
                "currentUser"
            ) || "null"
        )

    const currentUserId =
        currentUser?._id ||
        currentUser?.id

    const postUserId =
        user._id ||
        user.id ||
        post.user

    const isOwner =
        String(postUserId) ===
        String(currentUserId)

    const likes =
        Array.isArray(post.likes)
            ? post.likes
            : []

    const reposts =
        Array.isArray(post.reposts)
            ? post.reposts
            : []

    const liked =
        likes.some(
            id =>
                String(
                    typeof id === "object"
                        ? id._id
                        : id
                ) ===
                String(currentUserId)
        )

    const reposted =
        reposts.some(
            id =>
                String(
                    typeof id === "object"
                        ? id._id
                        : id
                ) ===
                String(currentUserId)
        )

    const avatar =
        user.profilePicture ||
        ""

    const avatarHTML =
        avatar
            ? `<img src="${avatar}" alt="Profile">`
            : `<i class="fa-solid fa-user"></i>`

    const created =
        post.createdAt
            ? formatPostTime(post.createdAt)
            : ""

    const imageHTML =
        post.image
            ? `
                <img
                    class="social-post-image"
                    src="${getImageUrl(post.image)}"
                    alt="Post image"
                >
            `
            : ""

    return `

        <article
            class="social-post"
            data-post-id="${post._id}"
        >

            <div class="social-post-header">

                <div class="avatar">
                    ${avatarHTML}
                </div>

                <div class="post-user-info">

                    <div class="post-user-name">
                        ${escapeHTML(
                            user.name ||
                            "Campus User"
                        )}
                    </div>

                    <div class="post-user-email">
                        ${escapeHTML(
                            user.email ||
                            ""
                        )}
                    </div>

                </div>

                <span class="post-time">
                    ${created}
                </span>

                ${
                    isOwner
                    ? `
                        <button
                            class="post-delete"
                            onclick="deleteSocialPost('${post._id}')"
                            title="Delete"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    `
                    : ""
                }

            </div>


            ${
                post.content
                ? `
                    <div class="post-content">
                        ${escapeHTML(post.content)}
                    </div>
                `
                : ""
            }


            ${imageHTML}


            <div class="post-actions">

                <button
                    class="post-action ${liked ? "liked" : ""}"
                    onclick="togglePostLike('${post._id}')"
                >

                    <i class="${
                        liked
                        ? "fa-solid"
                        : "fa-regular"
                    } fa-heart"></i>

                    <span>
                        ${likes.length}
                    </span>

                </button>


                <button
                    class="post-action"
                    onclick="openComments('${post._id}')"
                >

                    <i class="fa-regular fa-comment"></i>

                    <span>
                        Comment
                    </span>

                </button>


                <button
                    class="post-action ${reposted ? "reposted" : ""}"
                    onclick="toggleRepost('${post._id}')"
                >

                    <i class="fa-solid fa-retweet"></i>

                    <span>
                        ${reposts.length}
                    </span>

                </button>

            </div>

        </article>

    `
}


/* =========================================================
   IMAGE URL
   ========================================================= */

function getImageUrl(image) {

    if (!image) return ""

    if (
        image.startsWith("http://") ||
        image.startsWith("https://")
    ) {
        return image
    }

    if (image.startsWith("/")) {
        return image
    }

    return "/" + image
}


/* =========================================================
   LIKE
   ========================================================= */

async function togglePostLike(postId) {

    try {

        await socialRequest(
            `/posts/${postId}/like`,
            {
                method: "POST"
            }
        )

        await loadSocialFeed()

    } catch (error) {

        console.error(
            "Like error:",
            error
        )

        alert(error.message)

    }
}


/* =========================================================
   REPOST
   ========================================================= */

async function toggleRepost(postId) {

    try {

        await socialRequest(
            `/posts/${postId}/repost`,
            {
                method: "POST"
            }
        )

        await loadSocialFeed()

    } catch (error) {

        console.error(
            "Repost error:",
            error
        )

        alert(error.message)

    }
}


/* =========================================================
   DELETE POST
   ========================================================= */

async function deleteSocialPost(postId) {

    const confirmed =
        confirm(
            "Delete this post?"
        )

    if (!confirmed) return

    try {

        await socialRequest(
            `/posts/${postId}`,
            {
                method: "DELETE"
            }
        )

        await loadSocialFeed()

    } catch (error) {

        console.error(
            "Delete post error:",
            error
        )

        alert(error.message)
    }
}


/* =========================================================
   COMMENTS
   ========================================================= */

function setupComments() {

    const close =
        document.getElementById(
            "closeCommentModal"
        )

    const send =
        document.getElementById(
            "sendCommentButton"
        )

    const input =
        document.getElementById(
            "commentInput"
        )

    if (close) {

        close.addEventListener(
            "click",
            closeComments
        )

    }

    if (send) {

        send.addEventListener(
            "click",
            sendComment
        )

    }

    if (input) {

        input.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault()

                    sendComment()

                }

            }
        )

    }

}


async function openComments(postId) {

    selectedCommentPostId =
        postId

    const modal =
        document.getElementById(
            "commentModal"
        )

    if (modal) {
        modal.classList.remove("hidden")
    }

    await loadComments(
        postId
    )
}


function closeComments() {

    selectedCommentPostId =
        null

    const modal =
        document.getElementById(
            "commentModal"
        )

    if (modal) {
        modal.classList.add("hidden")
    }

}


async function loadComments(postId) {

    const list =
        document.getElementById(
            "commentsList"
        )

    if (!list) return

    list.innerHTML =
        `<div class="feed-loading">
            Loading comments...
        </div>`

    try {

        const comments =
            await socialRequest(
                `/comments/post/${postId}`
            )

        if (!comments.length) {

            list.innerHTML =
                `<div class="empty-notifications">
                    No comments yet.
                </div>`

            return
        }

        list.innerHTML =
            comments.map(
                comment => {

                    const user =
                        comment.user || {}

                    return `

                        <div class="comment-item">

                            <div class="avatar">

                                ${
                                    user.profilePicture
                                    ? `<img
                                        src="${user.profilePicture}"
                                        alt="Profile"
                                    >`
                                    : `<i class="fa-solid fa-user"></i>`
                                }

                            </div>

                            <div class="comment-body">

                                <div class="comment-author">
                                    ${escapeHTML(
                                        user.name ||
                                        "User"
                                    )}
                                </div>

                                <div class="comment-text">
                                    ${escapeHTML(
                                        comment.text ||
                                        comment.content ||
                                        ""
                                    )}
                                </div>

                            </div>

                        </div>

                    `
                }
            ).join("")

    } catch (error) {

        console.error(
            "Load comments error:",
            error
        )

        list.innerHTML =
            `<div class="empty-notifications">
                Unable to load comments.
            </div>`
    }
}


async function sendComment() {

    if (!selectedCommentPostId) {
        return
    }

    const input =
        document.getElementById(
            "commentInput"
        )

    const text =
        input?.value.trim()

    if (!text) return

    try {

        await socialRequest(
            "/comments",
            {
                method: "POST",
                body: JSON.stringify({
                    postId:
                        selectedCommentPostId,
                    text
                })
            }
        )

        input.value = ""

        await loadComments(
            selectedCommentPostId
        )

    } catch (error) {

        console.error(
            "Comment error:",
            error
        )

        alert(error.message)

    }
}


/* =========================================================
   USER SEARCH
   ========================================================= */

function setupUserSearch() {

    const addButton =
        document.getElementById(
            "addUserButton"
        )

    const panel =
        document.getElementById(
            "userSearchPanel"
        )

    const close =
        document.getElementById(
            "closeUserSearch"
        )

    const input =
        document.getElementById(
            "userSearchInput"
        )

    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                panel?.classList.toggle(
                    "hidden"
                )

                if (!panel?.classList.contains("hidden")) {
                    input?.focus()
                }

            }
        )

    }

    if (close) {

        close.addEventListener(
            "click",
            () => {

                panel?.classList.add(
                    "hidden"
                )

            }
        )

    }

    if (input) {

        let timer

        input.addEventListener(
            "input",
            () => {

                clearTimeout(timer)

                timer = setTimeout(
                    () => searchUsers(
                        input.value.trim()
                    ),
                    300
                )

            }
        )

    }
}


async function searchUsers(query) {

    const results =
        document.getElementById(
            "userSearchResults"
        )

    if (!results) return

    if (!query) {

        results.innerHTML = ""

        return
    }

    results.innerHTML =
        `<div class="feed-loading">
            Searching...
        </div>`

    try {

        const users =
            await socialRequest(
                `/users/search?q=${encodeURIComponent(query)}`
            )

        if (!users.length) {

            results.innerHTML =
                `<div class="empty-notifications">
                    No users found.
                </div>`

            return
        }

        results.innerHTML =
            users.map(
                user => `

                    <div class="user-search-result">

                        <div class="avatar">

                            ${
                                user.profilePicture
                                ? `<img
                                    src="${user.profilePicture}"
                                    alt="Profile"
                                >`
                                : `<i class="fa-solid fa-user"></i>`
                            }

                        </div>

                        <div class="search-user-info">

                            <span class="search-user-name">
                                ${escapeHTML(
                                    user.name ||
                                    "User"
                                )}
                            </span>

                            <span class="search-user-email">
                                ${escapeHTML(
                                    user.email ||
                                    ""
                                )}
                            </span>

                        </div>

                        <button
                            class="follow-button ${
                                user.isFollowing
                                    ? "following"
                                    : ""
                            }"
                            onclick="toggleFollow('${user._id}', this)"
                        >

                            ${
                                user.isFollowing
                                ? "Following"
                                : "Follow"
                            }

                        </button>

                    </div>

                `
            ).join("")

    } catch (error) {

        console.error(
            "User search error:",
            error
        )

        results.innerHTML =
            `<div class="empty-notifications">
                Search failed.
            </div>`
    }
}


/* =========================================================
   FOLLOW / UNFOLLOW
   ========================================================= */

async function toggleFollow(userId, button) {

    try {

        const isFollowing =
            button.classList.contains(
                "following"
            )

        const method =
            isFollowing
                ? "DELETE"
                : "POST"

        await socialRequest(
            `/users/${userId}/follow`,
            {
                method
            }
        )

        button.classList.toggle(
            "following"
        )

        button.textContent =
            isFollowing
                ? "Follow"
                : "Following"

        await loadMyFollowStats()
        await loadNotifications()

    } catch (error) {

        console.error(
            "Follow error:",
            error
        )

        alert(error.message)
    }
}


/* =========================================================
   FOLLOW STATS
   ========================================================= */

async function loadMyFollowStats() {

    try {

        const data =
            await socialRequest(
                "/users/me/follow-stats"
            )

        const followers =
            document.getElementById(
                "myFollowersCount"
            )

        const following =
            document.getElementById(
                "myFollowingCount"
            )

        if (followers) {
            followers.textContent =
                data.followers || 0
        }

        if (following) {
            following.textContent =
                data.following || 0
        }

    } catch (error) {

        console.error(
            "Follow stats error:",
            error
        )
    }
}


/* =========================================================
   FOLLOWING TAB
   ========================================================= */

function setupFollowingTab() {

    const tab =
        document.getElementById(
            "followingTab"
        )

    if (!tab) return

    tab.addEventListener(
        "click",
        async () => {

            showingFollowingOnly =
                !showingFollowingOnly

            document
                .querySelectorAll(
                    ".social-tab"
                )
                .forEach(
                    item =>
                        item.classList.remove(
                            "active"
                        )
                )

            tab.classList.add(
                "active"
            )

            await loadSocialFeed()

        }
    )

    const forYou =
        document.querySelector(
            ".social-tab:first-child"
        )

    if (forYou) {

        forYou.addEventListener(
            "click",
            async () => {

                showingFollowingOnly =
                    false

                document
                    .querySelectorAll(
                        ".social-tab"
                    )
                    .forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    )

                forYou.classList.add(
                    "active"
                )

                await loadSocialFeed()

            }
        )

    }
}


/* =========================================================
   FILTER FOLLOWING POSTS
   ========================================================= */

async function filterFollowingPosts(posts) {

    try {

        const data =
            await socialRequest(
                "/users/me/following"
            )

        const followingIds =
            data.map(
                user =>
                    String(
                        user._id ||
                        user.id
                    )
            )

        const currentUser =
            JSON.parse(
                localStorage.getItem(
                    "currentUser"
                ) || "null"
            )

        const currentUserId =
            currentUser?._id ||
            currentUser?.id

        return posts.filter(
            post => {

                const postUserId =
                    post.user?._id ||
                    post.user

                return (
                    String(postUserId) ===
                    String(currentUserId)
                    ||
                    followingIds.includes(
                        String(postUserId)
                    )
                )

            }
        )

    } catch (error) {

        console.error(
            "Following filter error:",
            error
        )

        return posts
    }
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

function setupNotifications() {

    const button =
        document.getElementById(
            "notificationButton"
        )

    const panel =
        document.getElementById(
            "notificationPanel"
        )

    const close =
        document.getElementById(
            "closeNotificationPanel"
        )

    if (button) {

        button.addEventListener(
            "click",
            async () => {

                panel?.classList.toggle(
                    "hidden"
                )

                if (
                    panel &&
                    !panel.classList.contains(
                        "hidden"
                    )
                ) {

                    await loadNotifications()

                }

            }
        )

    }

    if (close) {

        close.addEventListener(
            "click",
            () => {

                panel?.classList.add(
                    "hidden"
                )

            }
        )

    }
}


async function loadNotifications() {

    try {

        const notifications =
            await socialRequest(
                "/users/me/notifications"
            )

        const list =
            document.getElementById(
                "notificationList"
            )

        const badge =
            document.getElementById(
                "notificationBadge"
            )

        if (!list) return

        if (!notifications.length) {

            list.innerHTML =
                `<div class="empty-notifications">
                    No notifications yet.
                </div>`

            if (badge) {
                badge.classList.add(
                    "hidden"
                )
            }

            return
        }

        const unread =
            notifications.filter(
                notification =>
                    !notification.read
            ).length

        if (badge) {

            if (unread > 0) {

                badge.textContent =
                    unread > 99
                        ? "99+"
                        : unread

                badge.classList.remove(
                    "hidden"
                )

            } else {

                badge.classList.add(
                    "hidden"
                )

            }

        }

        list.innerHTML =
            notifications.map(
                notification => `

                    <div class="notification-item ${
                        notification.read
                            ? ""
                            : "unread"
                    }">

                        <i class="fa-regular fa-bell"></i>

                        <span>
                            ${escapeHTML(
                                notification.message ||
                                ""
                            )}
                        </span>

                    </div>

                `
            ).join("")

    } catch (error) {

        console.error(
            "Notifications error:",
            error
        )
    }
}


/* =========================================================
   TIME
   ========================================================= */

function formatPostTime(date) {

    const time =
        new Date(date)

    const now =
        new Date()

    const seconds =
        Math.floor(
            (now - time) / 1000
        )

    if (seconds < 60) {
        return `${seconds}s`
    }

    const minutes =
        Math.floor(
            seconds / 60
        )

    if (minutes < 60) {
        return `${minutes}m`
    }

    const hours =
        Math.floor(
            minutes / 60
        )

    if (hours < 24) {
        return `${hours}h`
    }

    const days =
        Math.floor(
            hours / 24
        )

    if (days < 7) {
        return `${days}d`
    }

    return time.toLocaleDateString()
}


/* =========================================================
   SECURITY / HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;")
}