ALTER TABLE staff_presence ADD COLUMN unavailable_until TEXT;
ALTER TABLE staff_presence ADD COLUMN schedule_start_minute INTEGER;
ALTER TABLE staff_presence ADD COLUMN schedule_end_minute INTEGER;
ALTER TABLE staff_presence ADD COLUMN schedule_enabled INTEGER NOT NULL DEFAULT 0 CHECK (schedule_enabled IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_staff_presence_unavailable_until
ON staff_presence(unavailable_until);

INSERT OR REPLACE INTO manual_sections
  (manual_key, section_key, title, body, sort_order, version, updated_by, updated_at)
VALUES
  ('owner','staff-availability-schedule','Staff Availability Timer & Schedule','Staff availability ကို Asia/Yangon (UTC+06:30) ဖြင့် စီမံနိုင်ပါတယ်။\n\n/unavailable = အချိန်မသတ်မှတ်ဘဲ unavailable\n/unavailable 3 = 3 hours unavailable; timer ပြည့်လျှင် schedule မရှိပါက available ပြန်ဖြစ်မယ်။ Daily schedule ရှိပါက temporary override ပြီး schedule state ကို ပြန်လိုက်မယ်။\n/available = immediate available ဖြစ်ပြီး recurring schedule ကို clear လုပ်မယ်။\n/available 09:00 17:00 = နေ့စဉ် 09:00–17:00 available schedule\n/available 9am 5pm = အထက်ပါ schedule alias\n\n12-hour/24-hour format နှစ်မျိုးလုံး support လုပ်ပြီး overnight window ဥပမာ /available 20:00 08:00 ကိုလည်း support လုပ်ပါတယ်။ Existing 5-minute Cron က timed unavailable expiry နှင့် schedule transitions ကို apply လုပ်သောကြောင့် practical transition latency 0–5 minutes ရှိနိုင်ပါတယ်။',97,1,0,CURRENT_TIMESTAMP),
  ('admin','staff-availability-schedule','Staff Availability Timer & Schedule','/unavailable 3 ဖြင့် 3 hours temporary unavailable ထားနိုင်ပါတယ်။ /available 09:00 17:00 သို့ /available 9am 5pm ဖြင့် Asia/Yangon time အတိုင်း daily recurring availability window သတ်မှတ်နိုင်ပါတယ်။ /available သာသုံးလျှင် recurring schedule clear ပြီး immediate available ဖြစ်မယ်။ /unavailable သာသုံးလျှင် indefinite unavailable ဖြစ်မယ်။ Existing Cron ကြောင့် timer/schedule transition သည် 5 minutes အတွင်း apply ဖြစ်နိုင်ပါတယ်။',97,1,0,CURRENT_TIMESTAMP);
