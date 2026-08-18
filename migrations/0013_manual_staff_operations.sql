INSERT OR IGNORE INTO manual_sections
  (manual_key, section_key, title, body, sort_order, version, updated_by, updated_at)
VALUES
(
  'owner',
  'staff-operations-commands',
  'Staff operations — notifications, availability and cleanup',
  '/language — Bot language ကို ပြောင်းရန်။\n\n/noti on — Active Staff Inbox group ရဲ့ staff-facing notification ကို normal mode ပြန်ဖွင့်ရန်။ Group messages/cases ကို မဖျက်ပါ။\n/noti off — Staff Inbox messages/cases ကို ဆက်သိမ်းထားပြီး Telegram push notification ကို silent လုပ်ရန်။ Spam notification မလိုချိန်မှာသုံးပါ။ Owner နှင့် authorized staff/Sudo Admin တို့ active Staff Inbox group ထဲမှာ သုံးနိုင်ပါတယ်။\n\n/available — ကိုယ့် staff presence ကို available အဖြစ် သတ်မှတ်ရန်။\n/unavailable — ကိုယ့် staff presence ကို unavailable အဖြစ် သတ်မှတ်ရန်။\n\nAI/FAQ နှစ်ခုလုံး မဖြေနိုင်ချိန် available staff မရှိပါက bot က user ကို လောလောဆယ် staff မအားသေးကြောင်း၊ မေးခွန်းကို မှတ်တမ်းတင်ထားပြီး နောက်မှ ပြန်ကြိုးစားနိုင်ကြောင်း အသိပေးမယ်။ Case/topic ကို Staff Inbox ထဲမှာ ဆက်ထားမယ်။ Staff ပြန် available ဖြစ်ပြီး အဲဒီ user topic ထဲကနေ reply ပို့လျှင် bot က user ရဲ့ private chat ဆီ staff message ပြန် relay လုပ်ပြီး human conversation ကို ပြန်ချိတ်နိုင်ပါတယ်။\n\n/clearmessage — Owner-only command ဖြစ်ပြီး active Staff Inbox group ထဲက bot သိထားသော recent deletable messages ကို confirmation ပြီးမှ best-effort ရှင်းရန်။ Telegram deletion/history limitations ကြောင့် group history အားလုံးကို အာမခံပြီး မရှင်းနိုင်ပါ။\n\nStaff Inbox group ပြောင်းလိုပါက group အသစ်ထဲ /staff ကို run ပြီး Use / Switch to this Staff Inbox ကိုရွေးပါ။',
  95,
  1,
  0,
  CURRENT_TIMESTAMP
),
(
  'admin',
  'staff-operations-commands',
  'Staff operations — notifications and availability',
  '/language — Bot language ကို ပြောင်းရန်။\n\n/noti on — Active Staff Inbox group ရဲ့ staff-facing notification ကို normal mode ပြန်ဖွင့်ရန်။\n/noti off — Messages/cases ကို မပျောက်စေဘဲ Telegram push notification ကို silent လုပ်ရန်။ Spam notification မလိုချိန်မှာသုံးပါ။\n\n/available — ကိုယ့်ကို available staff အဖြစ် သတ်မှတ်ရန်။\n/unavailable — ကိုယ့်ကို unavailable staff အဖြစ် သတ်မှတ်ရန်။\n\nAI/FAQ မဖြေနိုင်ချိန် available staff မရှိပါက bot က user ကို staff မအားသေးကြောင်းပြောပြီး question/case ကို Staff Inbox ထဲမှာ queue ထားမယ်။ ပြန် available ဖြစ်လာချိန် user ရဲ့ topic ကိုကြည့်ပြီး normal message ရေးလျှင် bot က အဲဒီ message ကို user private chat ဆီ staff reply အဖြစ် relay လုပ်နိုင်ပါတယ်။\n\nTake Over ပြီး human control ဝင်ထားချိန် user reply တွေက topic ထဲကို ဆက်ဝင်မယ်။ လိုအပ်ချိန် Return to AI နဲ့ automated handling ပြန်ပေးနိုင်ပါတယ်။\n\n/clearmessage, /staff configuration, /sudo နှင့် /ai management တို့သည် Owner-level controls ဖြစ်ပြီး Sudo Admin manual workflow မဟုတ်ပါ။',
  95,
  1,
  0,
  CURRENT_TIMESTAMP
);