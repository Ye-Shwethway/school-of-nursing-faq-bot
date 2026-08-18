-- Align the editable Owner manual with the canonical main-only production model.
-- Preserve the previous text in manual_revisions before replacing stale TEST-era guidance.

INSERT INTO manual_revisions
  (manual_key, section_key, version, title, body, changed_by, changed_at)
SELECT manual_key, section_key, version, title, body, 0, CURRENT_TIMESTAMP
FROM manual_sections
WHERE manual_key='owner' AND section_key IN ('deployment','safety');

UPDATE manual_sections
SET body='`main` branch က bot ရဲ့ တစ်ခုတည်းသော active development, canonical နှင့် production source ဖြစ်ပါတယ်။ Relevant change ကို `main` သို့တင်လိုက်ရင် GitHub Actions production workflow က typecheck, database migrations, Worker validation, Cloudflare production deploy နဲ့ health verification ကို အလိုအလျောက်လုပ်ပါတယ်။\n\nHistorical `test` branch ကို deployment/testing အတွက် မသုံးတော့ပါ။ Production workflow green ဖြစ်မှ live behavior ကို Telegram မှာ smoke-test လုပ်ပြီး runtime result ကိုအတည်ပြုပါ။',
    version=version+1,
    updated_by=0,
    updated_at=CURRENT_TIMESTAMP
WHERE manual_key='owner' AND section_key='deployment';

UPDATE manual_sections
SET body='Bot changes နဲ့ operational configuration အားလုံးကို current `main` / production model အတိုင်းပဲစီမံပါ။ Historical TEST bot/TEST deployment ကို မသုံးတော့ပါ။ Production pipeline green ဖြစ်ပြီးမှ live Telegram behavior ကို စမ်းပြီးအတည်ပြုပါ။\n\nSecrets/API keys ကို public repo သို့ group chat ထဲမတင်ပါနဲ့။ User authority ကို username မဟုတ်ဘဲ Telegram numeric ID နဲ့ယူပါတယ်။ AI answer ကို school policy အဖြစ်အတည်ပြုမထားတဲ့အချက်ကို မခန့်မှန်းခိုင်းပါနဲ့။\n\nManual content ကိုပြင်ချင်ရင် /ownermanual သို့ /adminmanual ကိုဖွင့်ပြီး Edit section ကိုသုံးပါ။ Manual data က FAQ knowledge နဲ့သီးသန့်ဖြစ်ပြီး FAQ matching/AI grounding ကိုမပြောင်းပါ။',
    version=version+1,
    updated_by=0,
    updated_at=CURRENT_TIMESTAMP
WHERE manual_key='owner' AND section_key='safety';
