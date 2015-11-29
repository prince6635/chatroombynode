var socketIO = require('socket.io');

var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

function _assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;

    socket.emit('nameResult', {
        success: true,
        name: name
    });

    namesUsed.push(name);
    return guestNumber + 1;
}

function _joinRoom(socket, room) {
    socket.join(room);

    currentRoom[socket.id] = room;
    socket.emit('joinResult', {room: room});
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    });

    console.log(room);
    //var usersInRoom = io.sockets.clients(room);
    var usersInRoom = io.sockets.adapter.rooms[room];
    console.log(usersInRoom);
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + ': ';
        for (var user in usersInRoom) {
            var userSocketId = user.key;
            if (userSocketId != socket.id) {
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        socket.emit('message', {text: usersInRoomSummary});
    }
}

function _handleNameChangeAttempts(socket) {
    socket.on('nameAttempt', function (name) {
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        } else {
            if (namesUsed.indexOf(name) != -1) {
                socket.emit('nameResult', {
                    sucess: false,
                    message: 'That name is already in use.'
                });
            } else {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);

                namesUsed.push(name);
                nickNames[socket.id] = name;

                delete namesUsed[previousNameIndex];

                socket.emit('nameResult', {
                    success: true,
                    name: name
                });

                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                    text: previousName + ' is now known as ' + name + '.'
                });
            }
        }
    })
}

function _handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]);
        _joinRoom(socket, room.newRoom);
    });
}

function _handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        console.log(message);
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ': ' + message.text
        });
    });
}

function _handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete  namesUsed[nameIndex];
        delete  nickNames[socket.id];
    })
}

exports.listen = function (server) {
    io = socketIO.listen(server);
    //io.set('log level' , 1);
    io.sockets.on('connection', function (socket) {
        // assign a guest name for the newly connected user
        guestNumber = _assignGuestName(socket, guestNumber, nickNames, namesUsed);

        // add the connected user to the lobby
        _joinRoom(socket, 'Lobby');

        // handle user's message, name change and room's creation and change
        _handleMessageBroadcasting(socket);
        _handleNameChangeAttempts(socket);
        _handleRoomJoining(socket);

        // provide all the rooms that are occupied
        socket.on('rooms', function () {
            socket.emit('rooms', io.sockets.rooms);
        });

        _handleClientDisconnection(socket);
    })
};