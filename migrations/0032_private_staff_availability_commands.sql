UPDATE manual_sections
SET body = body || '\n/available — immediate available; recurring schedule clear လုပ်မယ်။ Active Staff Inbox configured ရှိပါက private bot chat သို့ Staff Inbox group နှစ်နေရာလုံးကနေ သုံးနိုင်ပါတယ်။\n/available 09:00 17:00 — Asia/Yangon time အတိုင်း daily schedule သတ်မှတ်မယ်။ /available 9am 5pm alias လည်းရပါတယ်။\n/unavailable — indefinite unavailable။\n/unavailable 3 — 3 hours temporary unavailable; timer ပြည့်ရင် schedule/available state ကို auto-return လုပ်မယ်။\n\nPrivate chat ကနေ /available သို့ /unavailable သုံးလိုက်ရင် resulting staff state ကို active Staff Inbox group ထဲ operational update အဖြစ် အလိုအလျောက်တင်ပေးပါတယ်။ Staff Inbox group configure မထားသေးရင် private availability commands ကို မသုံးနိုင်ပါ။',
    version = version + 1,
    updated_by = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE manual_key='owner' AND section_key='owner-commands';

UPDATE manual_sections
SET body = body || '\n\nAvailability coordination: /available နှင့် /unavailable ကို active Staff Inbox group ထဲသာမက private bot chat ကနေလည်း သုံးနိုင်ပါတယ်။ Private ကပြောင်းထားတဲ့ availability/timer/schedule result ကို Staff Inbox group root ထဲမှာ team visibility အတွက် bot ကပြန်တင်ပေးပါတယ်။ Staff Inbox မ configure ရသေးရင် availability command ကို reject လုပ်ပြီး state မပြောင်းပါ။',
    version = version + 1,
    updated_by = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE manual_key='owner' AND section_key='staff';

UPDATE manual_sections
SET body = body || '\n/available — immediate available; schedule clear။\n/available 09:00 17:00 သို့ /available 9am 5pm — Asia/Yangon daily recurring schedule။\n/unavailable — indefinite unavailable။\n/unavailable 3 — 3 hours temporary unavailable။\n\nActive Staff Inbox configured ရှိပါက /available နှင့် /unavailable ကို private bot chat သို့ Staff Inbox group နှစ်နေရာလုံးကနေ သုံးနိုင်ပါတယ်။ Private ကနေ ပြောင်းထားသော result ကို Staff Inbox group ထဲ team coordination အတွက် အလိုအလျောက်တင်ပေးပါတယ်။',
    version = version + 1,
    updated_by = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE manual_key='admin' AND section_key='commands';

UPDATE manual_sections
SET body = body || '\n\nStaff availability က handoff continuity အတွက်အရေးကြီးပါတယ်။ Private bot chat ကနေ availability timer/schedule ပြောင်းနိုင်ပေမယ့် active Staff Inbox group ရှိရမယ်။ Private-origin availability changes ကို group root ထဲမှာ operational update အဖြစ်မြင်ရလို့ Admin အချင်းချင်း duty/time coordination လုပ်နိုင်ပါတယ်။',
    version = version + 1,
    updated_by = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE manual_key='admin' AND section_key='staff-awareness';

INSERT OR REPLACE INTO manual_sections
  (manual_key, section_key, title, body, sort_order, version, updated_by, updated_at)
VALUES
  ('owner','staff-availability-schedule','Staff Availability Timer & Schedule','Staff availability ကို Asia/Yangon (UTC+06:30) ဖြင့် စီမံပါတယ်။ Active Staff Inbox group configure ရှိရမယ်။\n\nအသုံးပြုနိုင်သည့်နေရာ\n• Private bot chat — convenience အတွက် command သုံးနိုင်ပြီး result ကို Staff Inbox group root ထဲ auto-publish လုပ်မယ်။\n• Active Staff Inbox group — command ကိုတိုက်ရိုက်သုံးနိုင်တယ်။\n• Staff Inbox မရှိပါက command reject လုပ်ပြီး state မပြောင်းပါ။\n\nCommands\n/unavailable = indefinite unavailable\n/unavailable 3 = 3 hours unavailable\n/available = immediate available + recurring schedule clear\n/available 09:00 17:00 = daily 09:00–17:00 schedule\n/available 9am 5pm = alias\n/available 20:00 08:00 = overnight schedule\n\nTemporary unavailable timer က recurring schedule ကိုယာယီ override လုပ်တယ်။ Timer ပြည့်ရင် schedule ရှိပါက schedule state ပြန်ဝင်ပြီး schedule မရှိပါက available ပြန်ဖြစ်မယ်။ Existing 5-minute Cron ကြောင့် persisted transition latency 0–5 minutes ရှိနိုင်ပေမယ့် effective staff count က timer/schedule ကိုတိုက်ရိုက်တွက်ပါတယ်။',97,2,0,CURRENT_TIMESTAMP),
  ('admin','staff-availability-schedule','Staff Availability Timer & Schedule','Active Staff Inbox configured ရှိပါက /available နှင့် /unavailable ကို Staff Inbox group သို့ private bot chat နှစ်နေရာလုံးကနေ သုံးနိုင်ပါတယ်။ Private ကနေပြောင်းလဲမှုတိုင်း Staff Inbox group root ထဲ staff identity နှင့် resulting state ကို auto-publish လုပ်ပြီး team coordination မြင်နိုင်အောင်ထားပါတယ်။ Staff Inbox မရှိပါက command reject လုပ်ပြီး state မပြောင်းပါ။\n\n/unavailable = indefinite unavailable\n/unavailable 3 = 3 hours temporary unavailable\n/available = immediate available + schedule clear\n/available 09:00 17:00 သို့ /available 9am 5pm = Asia/Yangon daily schedule\n/available 20:00 08:00 = overnight schedule\n\nTimer/schedule transitions ကို existing 5-minute Cron reconcile လုပ်ပါတယ်။',97,2,0,CURRENT_TIMESTAMP);
