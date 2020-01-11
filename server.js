const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (request, response) => {
    response.sendFile(__dirname + '/index.html');
});

let connection_count = 0

io.on("connection", (socket) => {
    connection_count += 1; //hashing method: first one to connect is the leader
    socket.emit('hash', connection_count);
    socket.on('sweepid', (msg) => {
        socket.broadcast.emit('sweepid', msg);
    });
    socket.on('viewmode', () => {
        socket.broadcast.emit('viewmode');
    });
});

http.listen(3000, () => {
    console.log('listening on 3000');   
});
