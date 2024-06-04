const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

let users = [];

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', ({ userId, interests }) => {
    if (users.find(user => user.userId === userId)) {
      socket.emit('error', 'User ID already exists. Please choose another one.');
    } else {
      users.push({ id: socket.id, userId, interests, socket });
      socket.emit("connected");
      matchUser(socket);
    }
  });

  socket.on('sendMessage', (message) => {
    const sender = users.find((user) => user.id === socket.id);
    if (sender && sender.match) {
      const recipient = users.find((user) => user.id === sender.match);
      if (recipient) {
        recipient.socket.emit('receiveMessage', message);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const disconnectedUser = users.find((user) => user.id === socket.id);
    if (disconnectedUser && disconnectedUser.match) {
      const matchedUser = users.find((user) => user.id === disconnectedUser.match);
      if (matchedUser) {
        matchedUser.socket.emit('chatPartnerDisconnected', 'Your chat partner has disconnected. You can stay here while we are searching a new chat partner for you.');
        matchedUser.match = null;
      }
    }
    users = users.filter((user) => user.id !== socket.id);
  });
});

const matchUser = (socket) => {
  const currentUser = users.find((user) => user.id === socket.id);
  const potentialMatches = users.filter((user) => {
    if (user.id === socket.id || user.match) return false;
    return currentUser.interests.some((interest) => user.interests.includes(interest));
  });

  if (potentialMatches.length > 0) {
    const match = potentialMatches[0];
    const sharedInterests = currentUser.interests.filter(interest => match.interests.includes(interest));

    currentUser.match = match.id;
    match.match = socket.id;
    socket.emit('matched', { userId: match.userId, interests: sharedInterests });
    match.socket.emit('matched', { userId: currentUser.userId, interests: sharedInterests });
  }
};

app.get('/', (req, res) => {
  res.send('Server is running');
});

server.listen(port, () => console.log(`Server is running on port ${port}`));
