
## 1. User Problem

**What problem is the product solving for property engineers and technicians?**

ปกติมีอุปกรณ์จำนวนมากในอาคารที่ต้องอาศััยคนในการนั่งเพื่อมอนิเตอร์ดูสิ่งผิดปกติซึ่งนอกจากต้องใช้ผู้ที่มีความเข้าใจนอกจากนี้ยังมีโอกาสที่จะเกิดความผิดพลาด product นี้จึงเป็นตัวกลางช่วยคอยจับความผิดปกติที่เกิดขึ้นจากอุปกรณ์ต่างๆในอาคารและคอยแจ้งเตือนเพื่อให้ผู้ดูแลสามารถเข้ามาดูแลได้อย่างถูกต้อง และยังให้ฝ่ายเทคนิคสามารถกำหนดค่าต่างๆที่ต้องการสังเกตุการได้อย่างแม่นยำ

## 2. System Boundary

Ontology : กำหนดหรือจำลองโครงสร้างอาหารและพื้นที่ต่างๆภายในอาคาร
Equipment : รวบรวมรายการอุปกรณ์ต่างๆภายในตึกและสามารถตรวจสอบสถานะของอุปกรณ์ได้
FDD Rule : กำหนดกฏในการตรวจสอบความผิดปกติเพื่อดูว่าค่าที่อุปกรณ์ส่งมามีความผิดปกติหรือไม่
Issue : รวบรวมปัญหาที่เกิดขึ้นทั้งรายละเอียดและช่วงเวลาที่เกิดรวมถึงสถานะการ acknowledge เพื่อแสดงการรับรู้
telementry log : รวบรวมประวัติการส่งค่าของอุปกรณ์ที่ส่งมายังระบบเพื่อการตรวจสอบย้อนหลัง

Simulator : service สำหรับ get ข้อมูลอุปกรณ์ทั้งหมดจาก backend api และทำการส่ง publish mqtt เพื่อจำลแงค่าเหมือนอุปกรณ์หน้างานจริง

Summary : รวบรวมค่าต่้างๆและสรุปการใช้พลังงานและเคสผิดปกติเพื่อให้ผู้ใช้สามารถเห็นภาพรวมได้แต่หน้าแรก


## 3. Domain Interpretation

Explain the difference between:

- An AHU's installed location and served space.
AHU's installed location คือพื้นที่ที่มีการติดตั้งอุปกรณ์จัดการอากาศ ส่วน served space คือห้องที่ได้รับผลกระทบจากอากาศที่มาจากอุปกรณ์นั้นๆ

- An HVAC zone and the rooms it contains.
HVAC zone เป็นโซนที่มีใช้เครื่องจัดการอากาศอย่าง AHU และ room contain ก็จะเป็นห้องที่อยู่ภายในโซนนั้นๆที่ได้รับผลจาก AHU

- A device and its telemetry points.
device เป็นการเรียกอุปกรณ์นั้นๆ แต่ telemetry คือค่าต่างๆที่อุปกรณ์นั้นส่งออกมาเช่น อุณหภูมิ co2 etc.

- Missing data and normal operating data.
normal operating data คือคา telemetry ที่ส่งมาอย่างต่อเนื่องปกติ ส่วน missing data คือค่าที่หายไปในช่วงเวลาที่ควรจะมีการส่งมา



## 4. Proposed Telemetry Event Contract
Show your proposed event fields and explain identity, observation time, units, quality, and idempotency.
### Telemetry Payload Schema:
```json
{
  "timestamp": "2026-01-15T08:15:00.000Z",
  "entity_id": "0fb20a52-71ee-48c6-b793-ea4700ecea15",
  "site_id": "9691d739-e491-449b-8022-7772a4d455b1",
  "metric_name": "supply_air_temperature_c",
  "val": 24.85,
  "unit": "degC",
  "tags": {
    "source_point_id": "ahu-a-f01-east-sat",
    "quality": "good"
  }
}

timestamp : เวลาที่เกิดการส่งเป็ฯ bangkok timezone
entity_id : id ของอุปกรณ์หรือเซนเซอร์นั้นๆ ซึ่งจะมี parent เป็ฯ entity อื่นๆ ที่เป็นพวก space room หรือ zone 
site_id : id ที่ระบุว่าระบบำลัวทำการแสดงของ tenant ไหน ซึ่ง site นึงสามารถมีได้หลาย building
metric_name : ระบุประเภทของค่าที่วัดได้
val : ระบุค่าที่วัดได้
ีืunit : หน่วย

```




---

## 5. Proposed Ontology Representation (BrickSchema)

Show how you plan to represent containment, installation, AHU service, measurement scope, and point ownership. Identify which parts follow Brickschema and which parts are application metadata.

-table entity สำหรับเก็บข้อมูลของพื้นที่ต่างๆและอุปกรณ์โดยเราจะแบ่งประเภทของแต่ละส่วนที่ด้วย brickschema และมีข้อมูลของส่วนนั้นๆ
โดยจะมี 
id : ระบุเลข id ซึ่งสุ่มด้วย uuid ทุกครั้งที่มีการสร้าง
code : เลขเฉพาะที่ทางอาคารกำหนด
name : ชื่อของส่วนนั้นๆ
metadata : สำหรับเก็บค่าของ entity ประเภทนั้นๆซึ่งแต่ละประเภทก็จะมีความแตกต่างกันไปเช่น 
พื้นที่ ( Floor, Room )
{
  "floor_number": 1,
  "area_sqm": 250.5,
  "max_occupancy": 30
}

sensor 
{
  "source_point_id": "ahu-a-f01-east-sat",
  "unit": "°C",
  "min_val": 0.0,
  "max_val": 50.0,
  "protocol": "BACnet/IP",
  "poll_interval_sec": 60
}

- table entity_relations สำหรับผูกความสัมพันธ์ว่าห้องไหนหรืออุปกรณ์ไหนมีการเชื่อมไปยังพื้นที่ไหน โดย
 พื้นที่ซ้อนกัน : hasPart
 ตำแหน่งติดตั้งอุปกรณ์ : hasLocation
 ขอบเขตการจ่ายลม : feeds
 เจ้าของเซนเซอร์ : hasPoint


## 6. AFDD Interpretation & Lifecycle

The continuous 15-minute sliding evaluation window follows a deterministic state machine:

1. ระบบจะรับค่าทีอุปกรณ์ส่งมาและเมื่อมีการส่งค่าที่เกิด issue เข้ามาระบบจะเริ่มบันทึก start_time และเก็บเวลาไว้
2. เมื่ออันต่อๆมามีความผิดปกติเข้ามาเรื่อยๆระบบจะเพิ่มเวลาที่สะสมมากขึ้นเรื่อยๆ
3. หากมีค่าที่เป็ฯปกติส่งมาก่อนจะครบช่วงเวลา (โจทย์กำหนดไว้ 15 นาที) จะทำการ reset เวลาเป็ฯ 0 ทันที
4. หากอุปกรณ์หยุดทำงานระบบจะหยุดการนับเวลาไว้ชั่วคราวและยังไม่นำเวลาระหว่างนั้นมาคิดเป็น issue
5. หากเวลาสะสมเกินกว่าที่กำหนด 15 นาทีไว้ระบบจะสร้าง issue ขึ้นมาและบันทึกความรุนแรง critical ที่เซตไว้ใน rule
6. เมื่อระบบมีค่าปกติส่งมาภายหลัวระบบจะปรับค่า issue นั้นให้มีสถานะเป็น resolve และเก็บ Log ไว้ดูภายหลังได้
7. หากเกิดซ้ำก็จะมี issue เกิดขึ้นมาใหม่แต่ยังสามารถดูตัว issue เก่าย้อนหลังได้ใน telementry log

---

## 7. Architecture and risks

Provide a high-level component diagram and identify the three most important technical or product risks.

DB (postgres): เก็บข้อมูลของ site, entity และ table หลักต่างๆ

MQTT Server : ใช้ nano mq ทำเป็น MQTT server เพื่อให้ client มา sub

backend ( python ) : รับข้อมูลจาก device ที่ pub MQTT มา พร้อมอ่านเขียนข้อมูกับ DB และจัดทำ API กับ Web Socket เพื่อการดึงข้อมูลจาก service อื่น 

frontend ( UI ) : ดึงข้อมูลจาก backend โดยการรีโหลดหน้าครั้งแรกจะดึง API มาเพื่อแสดงข้อมูล และหากเป็ฯหน้าที่ต้องการความ realtime จะ handshake ws เพื่อรับส่งข้อมูล

Simulator Survice : service สำหรับรัน simulator โดยใช้การ get device จาก backend และส่วข้อมูล publish ไปยัง MQTT 
ปล. สามารถควบคุมได้ด้านล่างซ้ายของ UI

=== ความเสี่ยงของ product ====
1. database ปัจจุบันมีการรับข้อมูลจาก telementry ทั้งหมดและใช้การดขียนข้อมูล 1 แถวต่อ 1 event ซึ่งถ้าเกิดระบบจริงมีอุปกรณ์จำนวนมากอาจทำให้เกิดปัญหาการเขียน db ซึ่งควรจะทำการ Batch Insert แทนการ insert ลงทีละแถว

2. MQTT ยังไม่ได้มีการ set ให้ดีพอที่จะรองรับการขาดหายของ network ซึ่งสามารถแก้ได้โดยเช็คการ auto reconnect และทดสอบการทำงานเมื่อทีการขาดการเชื่อมต่อหรืออยู่ใน network ที่ไม่เสถียรได้ดี

3. การใช้ websocket ยังไม่มีตัวจัดการที่ดีพอมีการส่งข้อมูลทันทีที่มี Event เข้ามา ทำให้ปริมาณ Traffic ที่ยิงไปหา UI มากเกินความจำเป็นโดยควรจะมีตัวกลางในการรับข้อมูลที่จำเป็นต้อง broadcast เพื่อทำการประมวลผลและส่งไปอย่างเป็ฯระเบียบ

---


## 8. Assumptions and clarification questions

Assumptions
- ระบบสามารถเพิ่มลบและแก้ไขข้อมูลได้ทั้งทำที่หน้า UI และการ import ข้อมูลทีละมากๆผ่าน excel หรืออื่นๆ
- ระบบมีการแบ่ง Role ของผู้ใช้งานที่เข้ามาใช้งานซึ่งจะมีการกำหนดให้ใช้งานได้ตาม scope ที่แต่ละ role ได้รับเท่านั้น
- ระบบสามารถกำหนดค่าการวัดความผิดปกติ (Rule )ได้อย่างอิสระตามที่ user ต้องการ
- ระบบจะมีการแจ้งเตือน issue และเก็บประวัติการแจ้งเตือนไว้เสมอโดยมีระบุข้อมูล เวลา , ความสำคัญ , และประเภทอุปกรณ์เอาไว้

Clarification
- โครงสร้างข้อมูลอาคารและอุปกรณ์จากระบบเดิมของลูกค้ามีรูปแบบ เป็นอย่างไร มีฟิลด์ไหนที่ระบบจำเป็นต้องเพิ่ม นอกเหนือจากมาตรฐาน Brick Schema มั้ย 
- เรื่องการเกิด fault ควรระบุให้ชัดว่าจะมีการจัดการในการรับรู้หรือเข้าเช็คปัญหาอย่างไร ต้องมีการ acknowledge หรือกด approved อะไรหรือไม่ และใครบ้างที่สามารถเข้ามา action ได้
- หาก network มีการหลุดไปต้องการให้จัดการข้อมูลอย่างไรอย่างเช่นต้องประเมินข้อมูลที่ทยอยส่งตามหลังมาหรือประเมินแค่ข้อมูลที่ส่งมาตรงเวลาเท่านั้น