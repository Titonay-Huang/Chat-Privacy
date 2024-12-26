from flask import Flask, render_template, session
from flask_socketio import SocketIO, emit, join_room, leave_room

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    username = "undefined"
    session['username'] = username
    join_room(username)
    print(f"User {username} connected")
    emit('set username', username)

@socketio.on('disconnect')
def handle_disconnect():
    username = session.get('username')
    leave_room(username)
    print(f"User {username} disconnected")

@socketio.on('chat message')
def handle_chat_message(data):
    message = data.get('message')
    file_info = data.get('file')
    username = session.get('username')

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
        session['username'] = new_username
        join_room(new_username)
        print(f"User {old_username} changed username to {new_username}")
        emit('username changed', new_username, broadcast=False)

if __name__ == '__main__':
    socketio.run(app, debug=True)