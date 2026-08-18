ALTER TABLE conversation_control ADD COLUMN last_human_activity_at TEXT;
ALTER TABLE conversation_control ADD COLUMN human_control_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_conversation_control_human_expiry
  ON conversation_control(mode, human_control_expires_at);

-- Existing active human claims get a fresh full lease at rollout so deployment
-- does not unexpectedly eject a staff member who is currently handling a user.
UPDATE conversation_control
SET last_human_activity_at = CURRENT_TIMESTAMP,
    human_control_expires_at = datetime('now', '+1 hour'),
    updated_at = CURRENT_TIMESTAMP
WHERE mode = 'human';

INSERT OR IGNORE INTO manual_sections
  (manual_key, section_key, title, body, sort_order, version, updated_by, updated_at)
VALUES
  ('owner','human-control-lease','Human takeover lease နှင့် auto-return','Take Over လုပ်ထားသော conversation သည် claimant Admin ၏ activity မရှိဘဲ 1 hour ကြာပါက AI mode သို့ အလိုအလျောက်ပြန်သွားပါမည်။ Claimant က user conversation နှင့်သက်ဆိုင်သော staff reply/interaction ပြုလုပ်ပါက lease ကို ထိုအချိန်မှ နောက်ထပ် 1 hour ပြန်တိုးပေးပါမည်။ System က 5 minutes တစ်ကြိမ် expired lease များကို စစ်သဖြင့် practical auto-return သည် 1 hour မှ 1 hour 5 minutes အတွင်း ဖြစ်နိုင်ပါသည်။\n\nAuto-return ဖြစ်လျှင် user ကို automated assistant ပြန် active ဖြစ်ကြောင်း အသိပေးပြီး previous claimant Admin ကို expiry notification ပို့ပါမည်။ Staff Inbox topic ထဲတွင်လည်း transition note ထားပါမည်။ Bot Owner ၏ manual Return to AI override authority သည် ဆက်လက်အမြင့်ဆုံးဖြစ်ပြီး timer ကိုစောင့်ရန်မလိုပါ။ Case/question/user history မဖျက်ပါ။',97,1,0,CURRENT_TIMESTAMP),
  ('admin','human-control-lease','Take Over timer နှင့် auto-return','Take Over လုပ်သောအခါ 1 hour inactivity lease စတင်ပါသည်။ သင်က claimant ဖြစ်နေစဉ် user conversation နှင့်သက်ဆိုင်သော reply/interaction လုပ်တိုင်း lease ကို ထိုအချိန်မှ နောက်ထပ် 1 hour ပြန်တိုးပေးပါမည်။ Activity မရှိဘဲ lease ပြည့်သွားပါက system က conversation ကို AI mode သို့ အလိုအလျောက်ပြန်ပို့ပြီး သင့်ထံ expiry notification ပို့ပါမည်။ လိုအပ်သေးပါက Take Over ပြန်လုပ်နိုင်ပါသည်။ Bot Owner က မည်သည့် claimant ကိုမဆို manual override ဖြင့် Return to AI လုပ်နိုင်ပါသည်။',97,1,0,CURRENT_TIMESTAMP);
