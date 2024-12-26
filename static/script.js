document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username') || 'me';

    const socket = io();
    const chatBox = document.getElementById('chat-box');
    const chatHistory = document.getElementById('chat-history');

    // 获取聊天历史
    socket.on('chat history', function(data) {
        data.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');

            // 添加用户名
            const usernameElement = document.createElement('span');
            usernameElement.classList.add('username');
            usernameElement.textContent = `${message.username}: `;
            messageElement.appendChild(usernameElement);

            if (message.message) {
                const messageText = document.createTextNode(message.message);
                messageElement.appendChild(messageText);
            }

            if (message.file) {
                const fileUrl = 'data:' + message.file.type + ';base64,' + message.file.data;
                const fileElement = document.createElement('a');
                fileElement.href = fileUrl;
                fileElement.download = message.file.name;
                fileElement.textContent = message.file.name;
                messageElement.appendChild(fileElement);
            }

            chatHistory.appendChild(messageElement);
        });
    });

    socket.on('connect', function() {
        console.log('Connected to server');
        // 发送用户名到服务器
        socket.emit('set username', username);
    });

    socket.on('chat message', function(data) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        // 添加用户名
        const usernameElement = document.createElement('span');
        usernameElement.classList.add('username');
        usernameElement.textContent = `${data.username}: `;
        messageElement.appendChild(usernameElement);

        if (data.message) {
            const messageText = document.createTextNode(data.message);
            messageElement.appendChild(messageText);
        }

        if (data.file) {
            const fileUrl = 'data:' + data.file.type + ';base64,' + data.file.data;
            const fileElement = document.createElement('a');
            fileElement.href = fileUrl;
            fileElement.download = data.file.name;
            fileElement.textContent = data.file.name;
            messageElement.appendChild(fileElement);
        }

        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    document.getElementById('message-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const messageInput = document.getElementById('message-input');
        const fileInput = document.getElementById('file-input');
        const fileLabel = document.getElementById('file-label');
        const message = messageInput.value.trim();
        const file = fileInput.files[0];

        if (message || file) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'self'); // 添加 'self' 类

            // 添加消息内容
            if (message) {
                const messageText = document.createTextNode(message);
                messageElement.appendChild(messageText);
            }

            if (file) {
                const fileUrl = URL.createObjectURL(file);
                const fileElement = document.createElement('a');
                fileElement.href = fileUrl;
                fileElement.download = file.name;
                fileElement.textContent = file.name;
                messageElement.appendChild(fileElement);
            }

            // 添加用户名
            const usernameElement = document.createElement('span');
            usernameElement.classList.add('username');
            usernameElement.textContent = `: ${username}`;
            messageElement.appendChild(usernameElement);

            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight;
            messageInput.value = '';
            fileInput.value = '';  // 重置文件输入元素的值

            // Prepare message data to send
            let sendData = { message: message };
            if (file) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    sendData.file = {
                        name: file.name,
                        type: file.type,
                        data: reader.result.split(',')[1]  // Remove the data URL prefix
                    };

                    // Emit message to server
                    socket.emit('chat message', sendData);

                    // 重置文件选择标签的状态
                    fileLabel.textContent = '选择文件';
                    fileLabel.style.backgroundColor = '#007bff'; // 恢复原色
                    fileLabel.style.pointerEvents = 'auto'; // 恢复点击
                };
                reader.readAsDataURL(file);
            } else {
                // Emit message to server immediately if no file
                socket.emit('chat message', sendData);
            }
        }
    });

    // 监听文件输入变化
    document.getElementById('file-input').addEventListener('change', function(event) {
        const fileLabel = document.getElementById('file-label');
        if (event.target.files.length > 0) {
            fileLabel.textContent = '已选择';
            fileLabel.style.backgroundColor = '#b3d4fc'; // 淡蓝色
            fileLabel.style.pointerEvents = 'none'; // 禁用点击
        } else {
            fileLabel.textContent = '选择文件';
            fileLabel.style.backgroundColor = '#007bff'; // 恢复原色
            fileLabel.style.pointerEvents = 'auto'; // 恢复点击
        }
    });

    // 监听用户名更改按钮
    document.getElementById('change-username-button').addEventListener('click', function() {
        const newUsername = prompt('Enter your new username:');
        if (newUsername && newUsername.trim() !== '') {
            socket.emit('change username', newUsername);
            document.getElementById('change-username-button').disabled = true; // 禁用按钮
            document.getElementById('change-username-button').classList.add('disabled'); // 添加淡蓝色样式
            document.getElementById('send-button').disabled = false; // 启用发送按钮
            document.getElementById('send-button').classList.remove('disabled'); // 移除淡蓝色样式
            document.getElementById('send-button').classList.add('enabled'); // 添加蓝色样式
            document.getElementById('file-input').disabled = false; // 启用文件输入
            document.getElementById('file-label').disabled = false; // 启用文件标签
            document.getElementById('file-label').classList.remove('disabled'); // 移除淡蓝色样式
            document.getElementById('file-label').classList.add('enabled'); // 添加蓝色样式
            document.getElementById('username-display').textContent = newUsername; // 更新显示的用户名
        }
    });

    // 处理用户名更改响应
    socket.on('username changed', function(newUsername) {
        document.getElementById('username-display').textContent = newUsername;
    });

    // 处理在线用户更新
    socket.on('update online users', function(users) {
        const onlineUsersCount = document.getElementById('online-users-count');
        const onlineUsersList = document.getElementById('online-users-list');

        onlineUsersCount.textContent = `在线用户数量: ${users.length}`;
        onlineUsersList.textContent = `在线用户: ${users.join(' | ')}`;
    });
});