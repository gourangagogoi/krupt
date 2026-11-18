import { io } from "socket.io-client";

const user1 = io("http://localhost:3000", {
  auth: { token: "test-token" },
});

const user2 = io("http://localhost:3000", {
  auth: { token: "test-token" },
});

user1.on("connect", () => {
  console.log("user1 connected:", user1.id);

  user1.emit("session:join", { sessionId: "room-abc", userId: "priya" });

  user1.on("session:members", (data) => {
    console.log("[user1] my members on join:", data.members);
  });

  user1.on("session:joined", (data) => {
    console.log("[user1] someone joined:", data.userId, "→ members:", data.members);
  });

  user1.on("session:left", (data) => {
    console.log("[user1] someone left:", data.userId, "→ members:", data.members);
  });
});

user2.on("connect", () => {
  console.log("user2 connected:", user2.id);

  setTimeout(() => {
    user2.emit("session:join", { sessionId: "room-abc", userId: "rohan" });
  }, 500);

  user2.on("session:members", (data) => {
    console.log("[user2] my members on join:", data.members);
  });

  setTimeout(() => {
    user2.emit("session:leave", { sessionId: "room-abc", userId: "rohan" });
  }, 2000);
});