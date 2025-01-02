document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('target');
    let currentUsername = '';

    const privateChatBox = document.getElementById('private-chat-box');
    const privateChatHistory = document.getElementById('private-chat-history');
    const privateMessageForm = document.getElementById('private-message-form');
    const privateMessageInput = document.getElementById('private-message-input');
    const privateChatTitle = document.getElementById('private-chat-title');
    const backButton = document.getElementById('back-to-main-chat');
    const fileInput = document.getElementById('private-file-input');
    const fileLabel = document.getElementById('private-file-label');

    // 设置私聊标题
    privateChatTitle.textContent = `私聊: ${targetUser}`;

    // 连接后加入私聊房间
    socket.on('connect', function() {
        socket.emit('join private chat', { room: targetUser });
        // 启用文件输入
        fileInput.removeAttribute('disabled');
        fileLabel.removeAttribute('disabled');
        fileLabel.style.backgroundColor = '#007bff';
        fileLabel.style.cursor = 'pointer';
    });

    // 添加获取用户名的监听器
    socket.on('set username', function(username) {
        currentUsername = username;
    });

    // 处理私聊消息
    socket.on('private chat message', function(data) {
        // 移除判断条件,显示所有接收到的消息
        const messageElement = createMessageElement({
            ...data,
            isSelf: data.username === currentUsername
        });
        privateChatHistory.appendChild(messageElement);
        privateChatBox.scrollTop = privateChatBox.scrollHeight;
    });

    // 添加历史消息处理
    socket.on('private chat history', function(data) {
        data.forEach(message => {
            const messageElement = createMessageElement({
                ...message,
                isSelf: message.username === currentUsername
            });
            privateChatHistory.appendChild(messageElement);
        });
        privateChatBox.scrollTop = privateChatBox.scrollHeight;
    });

    // 发送私聊消息
    privateMessageForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const message = privateMessageInput.value.trim();
        const file = fileInput.files[0];

        if (message || file) {
            let sendData = { 
                room: targetUser,
                message: message 
            };

            if (file) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    sendData.file = {
                        name: file.name,
                        type: file.type,
                        data: reader.result.split(',')[1]
                    };
                    socket.emit('private chat message', sendData);
                    fileLabel.textContent = '选择文件';
                    fileLabel.style.backgroundColor = '#007bff';
                    fileLabel.style.pointerEvents = 'auto';
                };
                reader.readAsDataURL(file);
            } else {
                socket.emit('private chat message', sendData);
            }

            privateMessageInput.value = '';
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

    // 返回主聊天
    backButton.addEventListener('click', function() {
        window.location.href = '/';
    });

    function createMessageElement(data) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');

        const usernameElement = document.createElement('span');
        usernameElement.classList.add('username');

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

        if (data.isSelf) {
            usernameElement.textContent = `me`;
            messageElement.classList.add('self');
        } else {
            usernameElement.textContent = data.username;
        }

        messageElement.appendChild(usernameElement);
        messageElement.appendChild(messageContent);
        return messageElement;
    }
}); 