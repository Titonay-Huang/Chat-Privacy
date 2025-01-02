from flask import Flask, render_template, session, jsonify, request, redirect
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
from datetime import datetime
import atexit
import random
import string

def generate_random_username(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

if not os.path.exists('message_data'):
    os.makedirs('message_data')

chat_history = []
private_chats = {}

def log_private_message(room, username, message, file_info=None):
    timestamp = datetime.now().strftime('%Y-%m-%d-%H-%M-%S')
    if room not in private_chats:
        private_chats[room] = []
    
    message_data = {
        'timestamp': timestamp,
        'username': username,
        'message': message
    }
    
    # 如果有文件信息,添加到消息数据中
    if file_info:
        message_data['file'] = file_info
        
    private_chats[room].append(message_data)

def close_chat_log():
    # 如果没有任何消息,就不创建日志文件
    if not chat_history and not private_chats:
        return
        
    chat_log_filename = os.path.join('message_data', f"{datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}.log")
    
    with open(chat_log_filename, 'a', encoding='utf-8') as chat_log_file:
        # 添加标题
        chat_log_file.write("="*50 + "\n")
        chat_log_file.write(" "*15 + "聊天记录" + " "*15 + "\n")
        chat_log_file.write("="*50 + "\n\n")

        # 只在有主聊天室消息时才写入该部分
        if chat_history:
            chat_log_file.write("-"*20 + " 主聊天室消息 " + "-"*20 + "\n\n")
            for entry in chat_history:
                chat_log_file.write(f"时间: {entry['timestamp']}\n")
                chat_log_file.write(f"用户: {entry['username']}\n")
                chat_log_file.write(f"消息: {entry['message']}\n")
                if 'file' in entry:
                    chat_log_file.write(f"文件: {entry['file']['name']}\n")
                chat_log_file.write("-"*50 + "\n")
        
        # 只在有私聊消息时才写入该部分
        if private_chats:
            chat_log_file.write("\n" + "-"*20 + " 私聊消息 " + "-"*20 + "\n")
            for room, messages in private_chats.items():
                if messages:  # 只在房间有消息时才写入
                    users = room.replace('private_', '').split('_')
                    chat_log_file.write(f"\n私聊房间: {users[0]} 和 {users[1]}\n")
                    chat_log_file.write("."*40 + "\n")
                    for message in messages:
                        chat_log_file.write(f"时间: {message['timestamp']}\n")
                        chat_log_file.write(f"用户: {message['username']}\n")
                        chat_log_file.write(f"消息: {message['message']}\n")
                        if 'file' in message:
                            chat_log_file.write(f"文件: {message['file']['name']}\n")
                        chat_log_file.write("."*40 + "\n")
        
        chat_log_file.write("\n" + "="*50 + "\n")

def log_message(username, message):
    timestamp = datetime.now().strftime('%Y-%m-%d-%H:%M:%S')
    chat_history.append({'timestamp': timestamp, 'username': username, 'message': message})

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

online_users = {}

@app.route('/')
def index():
    if 'username' not in session:
        username = generate_random_username()
        session['username'] = username
        online_users[username] = True
    return render_template('index.html')

@app.route('/chat_history')
def chat_history_route():
    return jsonify(chat_history)

@socketio.on('connect')
def handle_connect():
    username = session.get('username')
    if username:
        join_room(username)
        online_users[username] = True
        emit('set username', username)
        emit('update online users', list(online_users.keys()), broadcast=True)
        emit('chat history', chat_history)

@socketio.on('disconnect')
def handle_disconnect():
    username = session.get('username')
    if username and username in online_users:
        del online_users[username]
        emit('update online users', list(online_users.keys()), broadcast=True)

@socketio.on('join private chat')
def handle_join_private_chat(data):
    username = session.get('username')
    target_room = data['room']
    
    # 创建一个唯一的房间ID
    chat_room = f"private_{min(username, target_room)}_{max(username, target_room)}"
    
    # 加入私聊房间
    join_room(chat_room)
    
    # 初始化房间的聊天历史(如果不存在)
    if chat_room not in private_chats:
        private_chats[chat_room] = []
    
    # 发送聊天历史记录
    emit('private chat history', private_chats[chat_room])

@socketio.on('private chat message')
def handle_private_chat_message(data):
    username = session.get('username')
    target_room = data['room']
    message = data.get('message')
    file_info = data.get('file')
    
    chat_room = f"private_{min(username, target_room)}_{max(username, target_room)}"
    
    log_private_message(chat_room, username, message, file_info)
    
    emit_data = {
        'message': message,
        'username': username
    }
    
    if file_info:
        emit_data['file'] = file_info
    
    # 发送消息到私聊房间
    emit('private chat message', emit_data, room=chat_room)
    
    # 向目标用户发送通知
    emit('private chat notification', {
        'from': username
    }, room=target_room)

@socketio.on('chat message')
def handle_chat_message(data):
    message = data.get('message')
    file_info = data.get('file')
    username = session.get('username')
    
    log_message(username, message)

    if file_info:
        emit('chat message', {
            'message': message,
            'file': {
                'name': file_info['name'],
                'type': file_info['type'],
                'data': file_info['data']
            },
            'username': username
        }, broadcast=True, include_self=False)
    else:
        emit('chat message', {'message': message, 'username': username}, broadcast=True, include_self=False)

@app.route('/private_chat')
def private_chat():
    target = request.args.get('target')
    if not target:
        return redirect('/')
    return render_template('private_chat.html')

atexit.register(close_chat_log)

if __name__ == '__main__':
    print("Server is running on port 5000")
    socketio.run(app, debug=True)