from flask import Flask, render_template, session, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from datetime import datetime
import atexit
import random
import string

def generate_random_username(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))


# 创建保存聊天记录的文件夹
if not os.path.exists('message_data'):
    os.makedirs('message_data')

# 初始化聊天记录列表
chat_history = []

def log_message(username, message):
    timestamp = datetime.now().strftime('%Y-%m-%d-%H:%M:%S')
    chat_history.append({'timestamp': timestamp, 'username': username, 'message': message})

def close_chat_log():
    # 创建日志文件名
    chat_log_filename = os.path.join('message_data', f"{datetime.now().strftime('%Y-%m-%d-%H:%M:%S')}.log")
    with open(chat_log_filename, 'a') as chat_log_file:
        for entry in chat_history:
            chat_log_file.write(f"{entry['timestamp']} - {entry['username']}: {entry['message']}\n")
    chat_log_file.close()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

online_users = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat_history')
def chat_history_route():
    return jsonify(chat_history)

@socketio.on('connect')
def handle_connect():
    username = generate_random_username()
    session['username'] = username
    join_room(username)
    online_users[username] = True
    print(f"User {username} connected")
    emit('set username', username)
    emit('update online users', list(online_users.keys()), broadcast=True)
    # 发送聊天历史给新连接的用户
    emit('chat history', chat_history)

@socketio.on('disconnect')
def handle_disconnect():
    username = session.get('username')
    if username in online_users:
        del online_users[username]
        leave_room(username)
        print(f"User {username} disconnected")
        emit('update online users', list(online_users.keys()), broadcast=True)

# 确保在程序退出时关闭聊天记录文件
atexit.register(close_chat_log)

@socketio.on('chat message')
def handle_chat_message(data):
    message = data.get('message')
    file_info = data.get('file')
    username = session.get('username')

    log_message(username, message)

    if file_info:
        file_base64 = file_info['data']
        file_info = {
            'name': file_info['name'],
            'type': file_info['type'],
            'data': file_base64
        }
        emit('chat message', {'message': message, 'file': file_info, 'username': username}, broadcast=True, include_self=False)
    else:
        emit('chat message', {'message': message, 'username': username}, broadcast=True, include_self=False)

@socketio.on('change username')
def handle_change_username(new_username):
    old_username = session.get('username')
    if old_username:
        leave_room(old_username)
        del online_users[old_username]
        session['username'] = new_username
        join_room(new_username)
        online_users[new_username] = True
        print(f"User {old_username} changed username to {new_username}")
        emit('username changed', new_username, broadcast=False)
        emit('update online users', list(online_users.keys()), broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)