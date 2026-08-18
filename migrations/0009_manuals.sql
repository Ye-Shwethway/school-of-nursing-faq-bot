CREATE TABLE IF NOT EXISTS manual_sections (
  manual_key TEXT NOT NULL CHECK (manual_key IN ('owner','admin')),
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (manual_key, section_key)
);

CREATE TABLE IF NOT EXISTS manual_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manual_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manual_sections_order
ON manual_sections(manual_key, sort_order);

CREATE INDEX IF NOT EXISTS idx_manual_revisions_section
ON manual_revisions(manual_key, section_key, version DESC);

INSERT OR IGNORE INTO manual_sections (manual_key, section_key, title, body, sort_order) VALUES
('owner','overview','1. Bot ကို အလွယ်နားလည်ခြင်း','ဒီ bot မှာ အလုပ်လုပ်တဲ့ အလွှာ ၃ ခုရှိပါတယ်။\n\n1) Bot layer — မေးခွန်းတွေကို လက်ခံတယ်၊ သိမ်းထားတဲ့ FAQ နဲ့ ကိုက်ညီရင် မြန်မြန်ပြန်ဖြေတယ်၊ ဘာသာစကား၊ user identity နဲ့ conversation state ကို ထိန်းတယ်။\n\n2) AI layer — FAQ တိုက်ရိုက်မကိုက်တဲ့ မေးခွန်းကို ကျောင်းက အတည်ပြုထားတဲ့ knowledge အပေါ်မှာပဲ အခြေခံပြီး ဖြေတယ်။ မသေချာရင် မခန့်မှန်းဘဲ လူဝန်ထမ်းဆီ လွှဲတယ်။\n\n3) Human staff layer — AI မဖြေနိုင်တာ၊ ဒါမှမဟုတ် staff က တိုက်ရိုက်ကိုင်တွယ်ချင်တဲ့ conversation ကို Take Over လုပ်ပြီး user နဲ့ bot ကတစ်ဆင့် ဆက်သွယ်တယ်။ Staff ရဲ့ ကိုယ်ရေးအချက်အလက်ကို user ဆီ မဖော်ပြဘူး။',10),
('owner','daily-use','2. ပုံမှန်နေ့စဉ်အသုံးပြုပုံ','ပုံမှန် user က /start နဲ့ စပြီး language ရွေးမယ်။ FAQ ကိုက်ရင် bot ကတိုက်ရိုက်ဖြေမယ်။ မကိုက်ရင် AI က approved information နဲ့ ဖြေမယ်။ AI က မသေချာရင် staff group ထဲ handoff ရောက်မယ်။\n\nStaff Inbox ကို Topics ဖွင့်ထားတဲ့ private Telegram supergroup သုံးတာအကောင်းဆုံးပါ။ User တစ်ယောက်စီကို topic တစ်ခုစီခွဲထားလို့ messages မရောပါဘူး။ Topic header နဲ့ message header မှာ user name/username/ID ပါမယ်။ AI response header မှာ သုံးနေတဲ့ provider/model ပါမယ်။',20),
('owner','owner-commands','3. Owner commands','/start — bot ကို စတင်သုံးရန်\n/whoami — ကိုယ့် Telegram name/username/ID ကိုကြည့်ရန်\n/admin — administrator tools\n/admins — လက်ရှိ authorized admins ကြည့်ရန်\n/faq — FAQ knowledge ကို add/edit/disable/restore လုပ်ရန်\n/adminmanual — Sudo Admin manual ကိုဖတ်ရန်\n/ownermanual — Owner full manual ကိုဖတ်ရန်နှင့် edit လုပ်ရန်\n/sudo — Sudo Admin access grant/revoke လုပ်ရန်\n/ai — AI provider, model, primary/fallback, persona စီမံရန်\n/staff — Staff Inbox, routing, monitoring ကို inline buttons နဲ့စီမံရန်\n/cancel — လက်ရှိ setup/edit wizard ကိုပဲ ပယ်ဖျက်ရန်\n/reset — လက်ရှိ conversation transient state ကို AI mode ပြန်သတ်မှတ်ရန်။ Saved FAQ, AI credentials, model bindings, roles စတာတွေ မဖျက်ပါ။',30),
('owner','ai','4. AI ကို စီမံခြင်း','/ai ကို private chat ထဲမှာသုံးပါ။ Provider ရွေး၊ API key setup လုပ်၊ available models fetch လုပ်၊ Test Ping အောင်မြင်ပြီးမှ Primary သို့မဟုတ် Fallback အဖြစ် bind လုပ်ပါ။\n\nPrimary model က ပထမရွေးချယ်မှုဖြစ်ပြီး အလုပ်မလုပ်ရင် Fallback model ကိုစမ်းတယ်။ နှစ်ခုလုံး မဖြေနိုင်ရင် human handoff လုပ်တယ်။ API key တွေကို chat ထဲမှာ အမြဲမထားဘဲ setup message ကို bot က best-effort ဖျက်ပြီး encrypted storage ထဲသိမ်းတယ်။',40),
('owner','faq','5. FAQ knowledge ကို စီမံခြင်း','/faq ကို Owner သို့မဟုတ် Sudo Admin သုံးနိုင်ပါတယ်။ Add နဲ့ FAQ အသစ်ထည့်၊ Edit နဲ့ အပိုင်းလိုက်ပြင်၊ Disable နဲ့ ယာယီပိတ်၊ Restore နဲ့ ပြန်ဖွင့်နိုင်ပါတယ်။\n\nFAQ က bot ရဲ့ အဓိက approved knowledge ဖြစ်ပြီး AI ကလည်း ဒီ approved knowledge ကိုပဲ grounding အဖြစ်သုံးပါတယ်။ School policy, fees, dates, eligibility စတဲ့ facts ပြောင်းလဲရင် FAQ ကိုအရင်ပြင်တာအကောင်းဆုံးပါ။',50),
('owner','staff','6. Human staff နဲ့ monitoring','Staff group ထဲ /staff လို့ပို့ရင် inline control panel ပေါ်မယ်။ Set this group as Staff Inbox ကိုနှိပ်ရင် group ID ကို bot ကအလိုအလျောက်သိမ်းတယ်။ Route: Group သို့ Auto ကိုရွေးနိုင်တယ်။ Monitoring mode ကိုလည်း buttons နဲ့ပြောင်းနိုင်တယ်။\n\nTake Over ကို staff နှိပ်လိုက်ရင် အဲဒီ user conversation ကို AI မဖြေတော့ဘဲ လူဝန်ထမ်းက ကိုင်တွယ်မယ်။ Human control အချိန် latest user message အောက်မှာ Return to AI button ရှိမယ်။ နောက် user message ဝင်လာရင် button က latest message ဆီရွှေ့မယ်။\n\nUser တစ်ယောက်စီ topic သီးသန့်ဖြစ်ပြီး user တစ်ယောက် Take Over လုပ်တာက တခြား users မသက်ရောက်ပါ။',60),
('owner','deployment','7. Bot online နဲ့ deployment သိရှိခြင်း','TEST branch မှ deploy-relevant change တင်ရင် GitHub Actions က typecheck, database migrations, Worker validation, Cloudflare TEST deploy နဲ့ health check ကို အလိုအလျောက်လုပ်ပါတယ်။\n\nDeployment အသစ် health check ဖြတ်ပြီးရင် Owner နဲ့ Sudo Admins ဆီ 🟢 Bot is Online! message ပို့မယ်။ Message ထဲ environment နဲ့ revision ပါမယ်။ Revision တစ်ခုကို တစ်ခါပဲပို့လို့ health check ထပ်ခေါ်ရင် spam မဖြစ်ပါ။',70),
('owner','safety','8. Owner အတွက် သတိပြုရန်','Production မတင်ခင် TEST bot မှာစမ်းပါ။ Secrets/API keys ကို public repo သို့ group chat ထဲမတင်ပါနဲ့။ User authority ကို username မဟုတ်ဘဲ Telegram numeric ID နဲ့ယူပါတယ်။ AI answer ကို school policy အဖြစ်အတည်ပြုမထားတဲ့အချက်ကို မခန့်မှန်းခိုင်းပါနဲ့။\n\nManual content ကိုပြင်ချင်ရင် /ownermanual သို့ /adminmanual ကိုဖွင့်ပြီး Edit section ကိုသုံးပါ။ Manual data က FAQ knowledge နဲ့သီးသန့်ဖြစ်ပြီး FAQ matching/AI grounding ကိုမပြောင်းပါ။',80),
('admin','overview','1. Admin အလုပ်ကို အလွယ်နားလည်ခြင်း','Sudo Admin က bot ရဲ့ approved knowledge နဲ့ day-to-day administration ကိုကူညီစီမံနိုင်ပါတယ်။ Bot မှာ Bot layer, AI layer, Human staff layer သုံးခုရှိပါတယ်။\n\nBot layer က FAQ ကိုက်ရင်တိုက်ရိုက်ဖြေတယ်။ AI layer က approved knowledge အပေါ်မှာပဲ ထပ်စဉ်းစားပြီးဖြေတယ်။ မသေချာရင် Human staff layer ဆီလွှဲတယ်။ Staff က Take Over လုပ်ရင် user ကို လူဝန်ထမ်းက bot ကတစ်ဆင့် ဆက်ဖြေမယ်။',10),
('admin','commands','2. Admin commands','/start — bot ကို စတင်သုံးရန်\n/whoami — ကိုယ့် Telegram identity နဲ့ numeric ID ကြည့်ရန်\n/admin — administrator tools\n/admins — authorized administrators စာရင်းကြည့်ရန်\n/faq — FAQ knowledge ကို add/edit/disable/restore လုပ်ရန်\n/adminmanual — ဒီ Admin manual ကိုဖတ်ရန်\n/cancel — လက်ရှိ setup/edit wizard ကိုပယ်ဖျက်ရန် (menu မှာမပေါ်နိုင်သော်လည်း command ကိုအသုံးပြုနိုင်သည်)\n\nOwner-only commands ဖြစ်တဲ့ /sudo, /ai, /staff, /ownermanual တို့ကို Sudo Admin ကမပြောင်းလဲနိုင်ပါ။',20),
('admin','faq','3. FAQ ပြင်ဆင်ရာတွင်','FAQ က bot နဲ့ AI နှစ်ခုလုံးအတွက် approved school knowledge ဖြစ်ပါတယ်။ /faq မှ Add, Edit, Disable, Restore ကိုသုံးနိုင်ပါတယ်။\n\nFees, dates, eligibility, accreditation, scholarship/loan/bond rules စတဲ့ policy facts ကိုပြင်တဲ့အခါ source အတည်ပြုပြီးမှ save လုပ်ပါ။ မသေချာတာကို ခန့်မှန်းမထည့်ပါနဲ့။ FAQ edit history ကို revisions အဖြစ်သိမ်းထားပါတယ်။',30),
('admin','staff-awareness','4. Human handoff ကို နားလည်ခြင်း','AI မဖြေနိုင်တဲ့မေးခွန်းတွေက Staff Inbox ဆီရောက်နိုင်ပါတယ်။ Staff group မှာ user တစ်ယောက်စီ topic သီးသန့်ခွဲထားပါတယ်။ Topic/message header မှာ user name, username, numeric ID ပါလို့ ဘယ် user ကိုဖြေနေတာလဲ ခွဲသိနိုင်ပါတယ်။\n\nTake Over ဖြစ်နေတဲ့ conversation ကို AI မဝင်ရောက်တော့ပါ။ Return to AI လုပ်မှ automated assistant ပြန်စတင်မယ်။ Staff reply က user ဆီ School of Nursing Staff ဆိုတဲ့ neutral label နဲ့ရောက်ပြီး staff identity ကိုမဖော်ပြပါ။',40),
('admin','limits','5. Admin rights နဲ့ ကန့်သတ်ချက်','Sudo Admin က FAQ နဲ့ admin-related day-to-day work ကိုလုပ်နိုင်ပေမယ့် Bot Owner ရဲ့အမြင့်ဆုံး authority ကိုမကျော်လွန်ပါ။\n\nSudo Admin အသစ် grant/revoke, AI provider credentials/model bindings, Staff Inbox routing, Owner manual editing စတဲ့အရာတွေက Owner-only ဖြစ်ပါတယ်။ မလုပ်ခွင့်ရှိတဲ့ command ကိုသုံးရင် bot က ခွင့်မပြုပါဘူး။',50);
