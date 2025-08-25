// Простейший шаблон для будущего мультиплеера
// Использует WebSocket сервер
let ws;
document.getElementById("multiBtn").addEventListener("click", () => {
  ws = new WebSocket("wss://your-server.example"); // сюда сервер потом
  ws.onopen = () => console.log("Соединение с мультиплеером открыто");
  ws.onmessage = e => console.log("Сообщение:", e.data);
});