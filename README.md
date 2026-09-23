# Multi-Site AFDD Platform (Automated Fault Detection and Diagnostics)

แพลตฟอร์มตรวจจับและวิเคราะห์ความผิดปกติของระบบปรับอากาศและอุปกรณ์ภายในอาคาร (AFDD) แบบ Multi-Site อ้างอิงตามมาตรฐาน **Brick Schema** พร้อมระบบจำลองข้อมูล Telemetry (Simulator) และแดชบอร์ดแสดงผลแบบ Real-time

---

## 🚀 Quick Start (เริ่มต้นใช้งานด่วน)

ระบบถูกออกแบบมาให้สามารถติดตั้งและรันทุก Service ได้ง่ายผ่าน **Docker Compose** ด้วยคำสั่งเดียว:

### 1. โคลนและเตรียม Environment
```bash
# คัดลอกไฟล์การตั้งค่า Environment (หากยังไม่มี)
cp .env.example .env
```

### 2. สตาร์ทระบบทั้งหมดด้วย Docker Compose
```bash
docker compose up -d --build
```

---

## 🌐 Service Endpoints & Access URLs

เมื่อรัน Service สำเร็จ สามารถเข้าใช้งานส่วนต่างๆ ได้ผ่านลิงก์ต่อไปนี้:

| Service | URL / Port | รายละเอียด |
| :--- | :--- | :--- |
| **Frontend UI** | [http://localhost:5173](http://localhost:5173) | แดชบอร์ดแสดงผลสถานะอาคาร, Faults, และแผงควบคุม Simulator (มุมซ้ายล่าง) |
| **Backend API (Swagger Docs)** | [http://localhost:8000/docs](http://localhost:8000/docs) | ระบบ API Documentation (FastAPI) |
| **Backend API (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | เอกสาร API สำรอง |
| **TimescaleDB / Postgres** | `localhost:5434` | พอร์ตเชื่อมต่อฐานข้อมูล (Database: `afdd_db`, User: `postgres`) |
| **NanoMQ (MQTT Broker)** | `localhost:1883` (TCP) / `localhost:8083` (WS) | MQTT Broker สำหรับรับ-ส่งข้อมูล Telemetry |
| **Simulator Control Service** | [http://localhost:3333](http://localhost:3333) | Service ควบคุมการจำลองข้อมูล Telemetry |

---

## 🏗️ Architecture & Component Overview

ระบบประกอบด้วย 5 องค์ประกอบหลักที่ทำงานร่วมกัน:

1. **TimescaleDB (PostgreSQL 16):** ฐานข้อมูลสำหรับเก็บข้อมูล Semantic Graph (`entities`, `entity_relations`), Master Data, และข้อมูล Time-Series Telemetry
2. **NanoMQ (MQTT Broker):** Message Broker ประสิทธิภาพสูง น้ำหนักเบา ทำหน้าที่เป็นตัวกลางรับข้อมูล Telemetry จากอุปกรณ์/Simulator
3. **Backend Service (Python FastAPI):**
   * Subscribe ข้อมูล Telemetry จาก NanoMQ
   * ประมวลผล **15-Minute Timing Window AFDD Engine**
   * ให้บริการ REST API และ WebSocket สำหรับส่งต่อข้อมูลแบบ Real-time ไปยัง Frontend
4. **Simulator Service (Python):** ดึงรายการอุปกรณ์จาก Backend และจำลองการ Publish ข้อมูล Telemetry พร้อม Scenario ความผิดปกติต่างๆ
5. **Frontend UI:** แดชบอร์ดตรวจสอบสถานะอาคาร (Multi-site), กราฟ Telemetry, รายการ Incident Alert และการควบคุม Simulator

---

## 🛠️ Management Commands

### ดู Log การทำงานของระบบ
```bash
# ดู Log ทั้งหมด
docker compose logs -f

# ดู Log เฉพาะ Backend API
docker compose logs -f api

# ดู Log เฉพาะ Simulator
docker compose logs -f simulator
```

### หยุดและปิดการทำงาน
```bash
# หยุดการทำงานของ Containers
docker compose down

# หยุดการทำงานพร้อมลบ Volume ข้อมูล
docker compose down -v
```
