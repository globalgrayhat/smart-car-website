# 🚗 Smart Car Suite — Arduino Control & Camera Streaming

A full-stack dashboard for controlling an Arduino-based smart car and streaming live camera feed using WebRTC, powered by **React + NestJS + Mediasoup**.

---

## ✨ Features

* 📷 **Live camera feed** from an Android phone via WebRTC
* 🕹️ **Car control buttons** (forward, backward, left, right, stop)
* 🔍 **Camera zoom** in/out controls
* ⚡ **Status display**: Car Online/Offline & battery level
* 📱 **Share Android screen** to dashboard
* 🌙 **Dark/Light mode toggle**
* 🎞️ Smooth GSAP animations and transitions
* 📡 Real-time communication via **Socket.io**
* 🧠 Role-based access control (Admin / Viewer / Vehicle)
* ⚙️ Backend using **NestJS + Mediasoup** for scalable media handling

---

## 🧰 Requirements

* **Node.js v22.21.1**
* **npm** (bundled with Node)
* Optional (for production):

  * **PM2** (process manager)
  * **Nginx** (reverse proxy)
  * **Git**

---

## ⚙️ Setup (Development)

### 1️⃣ Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

> Runs at: [http://localhost:5173](http://localhost:5173)

### 2️⃣ Backend (NestJS + Mediasoup)

```bash
cd server
npm install
npm run start:dev
```

> Runs at: [http://localhost:3000](http://localhost:3000)

---

## 🧩 Project Structure

```
smart-car-website/
├─ client/          # React frontend (Vite + Tailwind + WebRTC)
│  ├─ src/components/
│  │  ├─ CameraStream.tsx
│  │  ├─ CarControls.tsx
│  │  └─ ThemeToggle.tsx
│  ├─ vite.config.ts
│  └─ ...
│
├─ server/          # NestJS backend (WebSocket + Mediasoup)
│  ├─ src/modules/mediasoup/
│  │  ├─ mediasoup.gateway.ts
│  │  ├─ mediasoup.service.ts
│  │  └─ mediasoup.types.ts
│  ├─ src/main.ts
│  └─ ...
│
└─ README.md
```

---

## 🛰️ Tech Stack

### Frontend:

* **React 18 + TypeScript**
* **Vite**
* **TailwindCSS**
* **GSAP** for animations
* **Socket.io Client**
* **WebRTC API**

### Backend:

* **NestJS** (modular structure)
* **Socket.io Gateway**
* **Mediasoup** (WebRTC SFU)
* **JWT Authentication**
* **TypeScript**

---

## 🚀 Deployment (VPS + Nginx + PM2)

### 1️⃣ SSH into your server

```bash
ssh smartcar@*.*.*.231
```

### 2️⃣ Install Node.js v22.21.1

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3️⃣ Install PM2 and Nginx

```bash
sudo npm install -g pm2
sudo apt install -y nginx
```

### 4️⃣ Deploy project

Upload your zipped folder and extract inside `/home/smartcar`:

```bash
unzip smart-car-website.zip -d ~/smart-car-website
cd ~/smart-car-website
```

### 5️⃣ Build frontend

```bash
cd client
npm install
npm run build
```

This will generate `dist/`, which you can serve from Nginx:

```
/var/www/smart-car-website/dist
```

### 6️⃣ Run backend with PM2

```bash
cd ../server
npm install
pm2 start dist/main.js --name smartcar-backend
pm2 save
```

### 7️⃣ Configure Nginx

Example `/etc/nginx/sites-available/smartcar.conf`:

```nginx
server {
  server_name smartcarcontrol.shop;

  root /var/www/smart-car-website/dist;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://localhost:3000/;
  }

  location /mediasoup/ {
    proxy_pass http://localhost:3000/mediasoup/;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Then enable & restart:

```bash
sudo ln -s /etc/nginx/sites-available/smartcar.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🧠 Example Flow

1. Vehicle connects using API key → joins channel
2. Admin connects via dashboard (JWT token)
3. Vehicle sends live camera → `mediasoup` distributes to viewers
4. Admin sends control commands → `vehicle:control` event
5. Car (Arduino) acts accordingly via serial/Wi-Fi

---

## 🛠️ Commands Summary

| Action               | Command                                  |
| -------------------- | ---------------------------------------- |
| Start frontend (dev) | `npm run dev`                            |
| Build frontend       | `npm run build`                          |
| Start backend (dev)  | `npm run start:dev`                      |
| Start backend (prod) | `pm2 start dist/main.js --name smartcar` |
| View logs            | `pm2 logs smartcar`                      |
| Reload all           | `pm2 reload all`                         |
