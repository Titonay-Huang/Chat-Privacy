document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const chatBox = document.getElementById('chat-box');
    const chatHistory = document.getElementById('chat-history');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const fileInput = document.getElementById('file-input');
    const fileLabel = document.getElementById('file-label');
    const sendButton = document.getElementById('send-button');
    const unreadIcon = document.getElementById('unread-icon');
    let currentUsername = '';
    let isWindowFocused = true;
    let unreadMessages = new Set();

    socket.on('connect', function() {
        sendButton.removeAttribute('disabled');
        fileInput.removeAttribute('disabled');
        fileLabel.removeAttribute('disabled');
        
        sendButton.style.backgroundColor = '#007bff';
        sendButton.style.cursor = 'pointer';
        fileLabel.style.backgroundColor = '#007bff';
        fileLabel.style.cursor = 'pointer';
    });

    socket.on('chat history', function(data) {
        data.forEach(message => {
            const messageElement = createMessageElement(message);
            chatHistory.appendChild(messageElement);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    socket.on('chat message', function(data) {
        const messageElement = createMessageElement(data);
        chatHistory.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;

        if (!isWindowFocused && data.username !== currentUsername) {
            unreadIcon.style.display = 'block';
            
            if (Notification.permission === "granted") {
                new Notification("新消息", {
                    body: `${data.username}: ${data.message}`,
                    icon: "/static/img/unread.png"
                });
            }
        }
    });

    socket.on('update online users', function(users) {
        const onlineUsersCount = document.getElementById('online-users-count');
        const onlineUsersList = document.getElementById('online-users-list');

        onlineUsersCount.textContent = `在线用户数量: ${users.length}`;
        onlineUsersList.innerHTML = '';

        users.forEach(user => {
            const userElement = document.createElement('span');
            userElement.textContent = user;
            userElement.classList.add('username');
            userElement.style.cursor = 'pointer';
            userElement.addEventListener('click', function() {
                window.location.href = `/private_chat?target=${user}`;
            });
            onlineUsersList.appendChild(userElement);
        });
    });

    socket.on('set username', function(username) {
        currentUsername = username;
        document.getElementById('current-user').textContent = `我的用户名: ${username}`;
    });

    messageForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const message = messageInput.value.trim();
        const file = fileInput.files[0];

        if (message || file) {
            let sendData = { message: message };
            
            const localMessageData = {
                username: currentUsername,
                message: message
            };
            const messageElement = createMessageElement(localMessageData);
            chatHistory.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
            
            if (file) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    sendData.file = {
                        name: file.name,
                        type: file.type,
                        data: reader.result.split(',')[1]
                    };
                    socket.emit('chat message', sendData);
                    fileLabel.textContent = '选择文件';
                    fileLabel.style.backgroundColor = '#007bff';
                    fileLabel.style.pointerEvents = 'auto';
                };
                reader.readAsDataURL(file);
            } else {
                socket.emit('chat message', sendData);
            }

            messageInput.value = '';
            fileInput.value = '';
        }
    });

    fileInput.addEventListener('change', function(event) {
        if (event.target.files.length > 0) {
            fileLabel.textContent = '已选择';
            fileLabel.style.backgroundColor = '#b3d4fc';
            fileLabel.style.pointerEvents = 'none';
        } else {
            fileLabel.textContent = '选择文件';
            fileLabel.style.backgroundColor = '#007bff';
            fileLabel.style.pointerEvents = 'auto';
        }
    });

    function createMessageElement(data) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        const usernameElement = document.createElement('span');
        usernameElement.classList.add('username');
        usernameElement.style.cursor = 'pointer';
        usernameElement.addEventListener('click', function() {
            window.location.href = `/private_chat?target=${data.username}`;
        });

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        if (data.message) {
            const messageText = document.createTextNode(data.message);
            messageContent.appendChild(messageText);
        }

        if (data.file) {
            const fileUrl = 'data:' + data.file.type + ';base64,' + data.file.data;
            const fileElement = document.createElement('a');
            fileElement.href = fileUrl;
            fileElement.download = data.file.name;
            fileElement.textContent = data.file.name;
            messageContent.appendChild(fileElement);
        }

        if (data.username === currentUsername) {
            usernameElement.textContent = `me`;
            messageElement.classList.add('self');
        } else {
            usernameElement.textContent = data.username;
        }

        messageElement.appendChild(usernameElement);
        messageElement.appendChild(messageContent);
        return messageElement;
    }

    socket.on('private chat notification', function(data) {
        unreadMessages.add(data.from);
        unreadIcon.style.display = 'block';
    });

    document.getElementById('online-users-list').addEventListener('click', function(event) {
        if (event.target.classList.contains('username')) {
            const targetUser = event.target.textContent;
            unreadMessages.delete(targetUser);
            if (unreadMessages.size === 0) {
                unreadIcon.style.display = 'none';
            }
        }
    });

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}); 