import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : window.location.origin;

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export default socket;
